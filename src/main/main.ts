import { app, BrowserWindow, ipcMain, Menu, Tray, nativeImage, Notification, safeStorage } from 'electron'
import path from 'node:path'
import { initUpdater } from './updater'
import Store from 'electron-store'

// Persistent store for main-process settings (Redmine URL, secure keys, etc.)
const mainStore = new Store<Record<string, string>>()

// The built directory structure
//
// ├─┬─┬─ dist
// │ │ └── index.html
// │ │
// │ ├─┬─ dist-electron
// │ │ ├── main.js
// │ │ └── preload.js
// │
process.env.DIST = path.join(__dirname, '../dist')
process.env.VITE_PUBLIC = app.isPackaged ? process.env.DIST : path.join(process.env.DIST, '../public')

// Keep site isolation disabled (needed for cross-origin image fetching from Redmine)
app.commandLine.appendSwitch('disable-site-isolation-trials')

// Better scrolling performance
app.commandLine.appendSwitch('enable-smooth-scrolling')

// ── Scoped certificate-error handler ───────────────────────────────────────
// Instead of ignoring ALL certificate errors globally, we selectively accept
// self-signed certs only for the configured Redmine host.
app.on('certificate-error', (event, webContents, url, error, certificate, callback) => {
    const redmineHost = mainStore.get('redmineHost')
    if (redmineHost) {
        try {
            const parsed = new URL(url)
            if (parsed.hostname === redmineHost) {
                // Accept self-signed cert for the configured Redmine host
                event.preventDefault()
                callback(true)
                return
            }
        } catch { /* malformed URL, fall through to reject */ }
    }
    // Reject all other certificate errors
    callback(false)
})


let win: BrowserWindow | null
let tray: Tray | null = null
let trayMenu: Menu | null = null
let currentBadgeCount = 0
let currentBadgeUrgency: 'none' | 'low' | 'medium' | 'high' = 'none'
let currentStatusCounts: { statusId: number; statusName: string; count: number }[] = []

// Cached tray icons
type TrayIconVariant = 'gray' | 'red' | 'orange' | 'green'
const trayIconCache: Record<TrayIconVariant, Electron.NativeImage> = {} as Record<TrayIconVariant, Electron.NativeImage>

// 🚧 Use ['ENV_NAME'] avoid vite:define dev replacement
const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']

function generateColoredIcon(baseColor: string): Electron.NativeImage {
    // Generate a colored version of the tray icon by modifying the SVG inline.
    // Bold solid badge + single glyph: multi-curve line art anti-aliases to
    // near-invisible at 16px menu-bar size, so keep this shape simple and
    // high-contrast (a filled square is legible where fine strokes aren't).
    const size = process.platform === 'darwin' ? 16 : 32
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="${size}" height="${size}">
  <rect x="2" y="2" width="28" height="28" rx="7" fill="${baseColor}"/>
  <text x="16" y="23" font-family="-apple-system, Helvetica, Arial, sans-serif" font-size="20" font-weight="700" text-anchor="middle" fill="#ffffff">R</text>
</svg>`
    // Not a template image: template mode makes macOS render the icon as a plain
    // monochrome silhouette (ignoring these colors entirely), which would defeat
    // the whole point of gray/green/orange/red urgency coloring.
    return nativeImage.createFromDataURL(`data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`)
}

function cacheTrayIcons() {
    trayIconCache['gray'] = generateColoredIcon('#808080')
    trayIconCache['green'] = generateColoredIcon('#30d158')
    trayIconCache['orange'] = generateColoredIcon('#ff9f0a')
    trayIconCache['red'] = generateColoredIcon('#ff453a')
}

function openMyAssignedStatusFromTray(statusName: string) {
    if (!win || win.isDestroyed()) {
        createWindow()
    }
    win?.show()
    win?.focus()
    win?.webContents.send('open-my-assigned-status', statusName)
}

function buildTrayContextMenu() {
    const isDev = !app.isPackaged
    const statusCountItems: Electron.MenuItemConstructorOptions[] = currentStatusCounts.length > 0
        ? [
            { label: 'My Issues', enabled: false },
            ...currentStatusCounts.map(s => ({
                label: `${s.statusName}  (${s.count})`,
                click: () => openMyAssignedStatusFromTray(s.statusName),
            })),
            { type: 'separator' as const },
        ]
        : []
    trayMenu = Menu.buildFromTemplate([
        {
            label: 'Show Redmine',
            click: () => {
                if (!win || win.isDestroyed()) {
                    createWindow()
                } else {
                    win.show()
                    win.focus()
                }
            }
        },
        { type: 'separator' },
        ...statusCountItems,
        {
            label: 'Settings...',
            accelerator: 'CmdOrCtrl+,',
            click: () => {
                if (win && !win.isDestroyed()) {
                    win.show()
                    win.focus()
                    win.webContents.send('show-settings')
                }
            }
        },
        { type: 'separator' },
        {
            label: 'Check for Updates',
            click: () => {
                if (win && !win.isDestroyed()) {
                    win.show()
                    win.focus()
                    win.webContents.send('show-updater')
                }
            }
        },
        ...(isDev ? [
            { type: 'separator' as const },
            { label: 'Toggle DevTools', accelerator: 'CmdOrCtrl+Alt+I', role: 'toggleDevTools' as const }
        ] : []),
        { type: 'separator' },
        { role: 'quit' }
    ])
}

function updateTrayAppearance() {
    if (!tray || tray.isDestroyed()) return

    // Choose icon color based on urgency
    let variant: TrayIconVariant = 'gray'
    if (currentBadgeCount > 0) {
        if (currentBadgeUrgency === 'high') variant = 'red'
        else if (currentBadgeUrgency === 'medium') variant = 'orange'
        else variant = 'green'
    }

    const cached = trayIconCache[variant]
    if (cached && !cached.isEmpty()) {
        try {
            tray.setImage(cached)
        } catch (e) {
            // Silently ignore if the image is invalid
        }
    }

    // Set title/badge text
    if (currentBadgeCount > 0) {
        const displayCount = currentBadgeCount > 99 ? '99+' : String(currentBadgeCount)
        tray.setTitle(displayCount)
        tray.setToolTip(`Redmine: ${currentBadgeCount} issue${currentBadgeCount !== 1 ? 's' : ''} assigned`)
    } else {
        tray.setTitle('')
        tray.setToolTip('Redmine - No pending issues')
    }

    // Update context menu if it exists
    if (trayMenu) {
        tray.setContextMenu(trayMenu)
    }
}

function createTray() {
    // Cache all colored icon variants
    cacheTrayIcons()

    // Build context menu
    buildTrayContextMenu()

    // Start with gray (inactive) icon
    const icon = trayIconCache['gray']

    if (!icon || icon.isEmpty()) {
        console.error('Failed to create tray icon, using empty fallback')
        tray = new Tray(nativeImage.createEmpty())
    } else {
        tray = new Tray(icon)
    }

    tray.setToolTip('Redmine')

    if (trayMenu) {
        tray.setContextMenu(trayMenu)
    }

    tray.on('click', () => {
        if (!win || win.isDestroyed()) {
            createWindow()
            return
        }
        if (win.isVisible()) {
            win.hide()
        } else {
            win.show()
            win.focus()
        }
    })

    updateTrayAppearance()
}


function createMenu() {
    const template: any[] = [
        {
            label: app.name,
            submenu: [
                { role: 'about' },
                { type: 'separator' },
                {
                    label: 'Settings...',
                    accelerator: 'CmdOrCtrl+,',
                    click: () => {
                        win?.webContents.send('show-settings')
                    }
                },
                { type: 'separator' },
                { role: 'services' },
                { type: 'separator' },
                { role: 'hide' },
                { role: 'hideOthers' },
                { role: 'unhide' },
                { type: 'separator' },
                { role: 'quit' }
            ]
        },
        {
            label: 'Edit',
            submenu: [
                { role: 'undo' },
                { role: 'redo' },
                { type: 'separator' },
                { role: 'cut' },
                { role: 'copy' },
                { role: 'paste' },
                { role: 'selectAll' }
            ]
        },
        {
            label: 'View',
            submenu: [
                { role: 'reload' },
                { role: 'forceReload' },
                { role: 'toggleDevTools' },
                { type: 'separator' },
                { role: 'resetZoom' },
                { role: 'zoomIn' },
                { role: 'zoomOut' },
                { type: 'separator' },
                { role: 'togglefullscreen' }
            ]
        },
        {
            label: 'Window',
            submenu: [
                { role: 'minimize' },
                { role: 'zoom' },
                { type: 'separator' },
                { role: 'front' },
                { type: 'separator' },
                { role: 'window' }
            ]
        }
    ]

    const menu = Menu.buildFromTemplate(template)
    Menu.setApplicationMenu(menu)
}


function createWindow() {
    const isMac = process.platform === 'darwin'

    win = new BrowserWindow({
        width: 1200,
        height: 800,
        minWidth: 1000,
        minHeight: 700,
        titleBarStyle: isMac ? 'hiddenInset' : 'default',
        // NOTE: Do NOT use transparent:true with vibrancy in Electron 33+ (causes blank window).
        // vibrancy alone handles the frosted glass effect on macOS.
        // On Windows/Linux, use a solid background since vibrancy is not available.
        backgroundColor: isMac ? '#00000000' : '#000000',
        vibrancy: isMac ? 'under-window' : undefined,
        visualEffectState: isMac ? 'active' : undefined,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            webSecurity: false,
            backgroundThrottling: false,
        },
    })

    createMenu()

    // Test active push message to Renderer-process.
    win.webContents.on('did-finish-load', () => {
        win?.webContents.send('main-process-message', (new Date).toLocaleString())
    })

    console.log('VITE_DEV_SERVER_URL:', VITE_DEV_SERVER_URL)
    console.log('process.env.DIST:', process.env.DIST)

    if (VITE_DEV_SERVER_URL) {
        win.loadURL(VITE_DEV_SERVER_URL)
    } else {
        // win.loadFile('dist/index.html')
        const indexPath = path.join(process.env.DIST || '', 'index.html')
        console.log('Loading local file:', indexPath)
        win.loadFile(indexPath)
    }

    // Intercept navigation, open external links in system browser
    win.webContents.on('will-navigate', (event, url) => {
        // If it's an external link (not a local file or dev server)
        if (!url.startsWith('file://') && !url.startsWith('http://localhost')) {
            event.preventDefault()
            const { shell } = require('electron')
            shell.openExternal(url)
        }
    })

    // Handle new window open requests
    win.webContents.setWindowOpenHandler(({ url }) => {
        const { shell } = require('electron')
        shell.openExternal(url)
        return { action: 'deny' }
    })
}

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit()
        win = null
    }
})

app.on('activate', () => {
    // On OS X it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow()
    }
})

// Register custom protocol for deep linking (redmine://)
if (process.defaultApp) {
    if (process.argv.length >= 2) {
        app.setAsDefaultProtocolClient('redmine', process.execPath, [path.resolve(process.argv[1])])
    }
} else {
    app.setAsDefaultProtocolClient('redmine')
}

// Handle deep link on macOS
app.on('open-url', (event, url) => {
    event.preventDefault()
    console.log('Received deep link:', url)
    handleDeepLink(url)
})

// Handle deep link on Windows
const gotTheLock = app.requestSingleInstanceLock()
if (!gotTheLock) {
    app.quit()
} else {
    app.on('second-instance', (event, commandLine, workingDirectory) => {
        // Someone tried to run a second instance, we should focus our window.
        if (win) {
            if (win.isMinimized()) win.restore()
            win.focus()
        }

        // Check for deep link in command line
        const url = commandLine.find(arg => arg.startsWith('redmine://'))
        if (url) {
            console.log('Received deep link from second instance:', url)
            handleDeepLink(url)
        }
    })
}

// Function to handle deep link
function handleDeepLink(url: string) {
    console.log('Processing deep link:', url)

    // Extract issue ID from URL (e.g., redmine://20435 -> 20435)
    const match = url.match(/^redmine:\/\/(\d+)$/i)
    if (match) {
        const issueId = parseInt(match[1], 10)
        console.log('Extracted issue ID:', issueId)

        // Send to renderer process
        if (win && !win.isDestroyed()) {
            win.webContents.send('open-issue-by-id', issueId)

            // Make sure window is visible
            if (!win.isVisible()) {
                win.show()
            }
            win.focus()
        }
    } else {
        console.error('Invalid redmine:// URL format:', url)
    }
}

app.whenReady().then(() => {
    createWindow()
    if (process.platform === 'darwin' || process.platform === 'win32') {
        createTray()
    }

    // Initialize auto-updater (auto check handled by updater.ts)
    if (win) {
        initUpdater(win)
    }

    // Handle deep link from command line on Windows
    if (process.platform === 'win32') {
        const url = process.argv.find(arg => arg.startsWith('redmine://'))
        if (url) {
            console.log('Received deep link from argv:', url)
            // Delay to ensure window is ready
            setTimeout(() => handleDeepLink(url), 1000)
        }
    }
})

ipcMain.on('update-badge', (_, data: { count: number; urgency?: 'none' | 'low' | 'medium' | 'high' }) => {
    // Support both old format (just a number) and new format (object with count + urgency)
    const count = typeof data === 'number' ? data : data.count
    const urgency = typeof data === 'object' ? (data.urgency || 'low') : 'low'

    currentBadgeCount = count
    currentBadgeUrgency = count > 0 ? urgency : 'none'

    console.log('Received update-badge:', { count, urgency: currentBadgeUrgency });

    if (count > 0) {
        app.setBadgeCount(count)
    } else {
        app.setBadgeCount(0)
    }

    updateTrayAppearance()
})

ipcMain.on('update-tray-status-counts', (_, counts: { statusId: number; statusName: string; count: number }[]) => {
    currentStatusCounts = Array.isArray(counts) ? counts : []
    buildTrayContextMenu()
    updateTrayAppearance()
})

ipcMain.on('update-tray-urgency', (_, urgency: 'none' | 'low' | 'medium' | 'high') => {
    currentBadgeUrgency = urgency
    updateTrayAppearance()
})

ipcMain.on('show-window', () => {
    if (win && !win.isDestroyed()) {
        win.show()
        win.focus()
    } else {
        createWindow()
    }
})

ipcMain.on('open-external', (_, url) => {
    const { shell } = require('electron');
    shell.openExternal(url);
});

// ── Settings IPC ───────────────────────────────────────────────────────────
// Sync the Redmine URL from renderer → main so the certificate handler knows
// which host to accept self-signed certs for.
ipcMain.on('save-redmine-url', (_, url: string) => {
    try {
        const host = new URL(url).hostname
        mainStore.set('redmineHost', host)
        console.log(`[main] Redmine host registered for cert bypass: ${host}`)
    } catch {
        console.warn('[main] Invalid Redmine URL, skipping cert host registration')
    }
})

// ── Secure credential storage ──────────────────────────────────────────────
// Use Electron's safeStorage to encrypt API keys at rest.
// Falls back to base64 (obfuscation only) if safeStorage is unavailable.

ipcMain.handle('secure-store', async (_, { key, value }: { key: string; value: string }) => {
    try {
        if (safeStorage.isEncryptionAvailable()) {
            const encrypted = safeStorage.encryptString(value)
            mainStore.set(`secure:${key}`, encrypted.toString('base64'))
        } else {
            // Fallback: base64 obfuscation (not true encryption)
            mainStore.set(`secure:${key}`, Buffer.from(value).toString('base64'))
        }
        return true
    } catch (e: any) {
        console.error(`[main] Failed to store secure key '${key}':`, e)
        return false
    }
})

ipcMain.handle('secure-retrieve', async (_, { key }: { key: string }) => {
    try {
        const stored = mainStore.get(`secure:${key}`) as string | undefined
        if (!stored) return null

        if (safeStorage.isEncryptionAvailable()) {
            const buffer = Buffer.from(stored, 'base64')
            return safeStorage.decryptString(buffer)
        } else {
            // Fallback: base64 decode
            return Buffer.from(stored, 'base64').toString()
        }
    } catch (e: any) {
        console.error(`[main] Failed to retrieve secure key '${key}':`, e)
        return null
    }
})

ipcMain.handle('secure-delete', async (_, { key }: { key: string }) => {
    try {
        mainStore.delete(`secure:${key}`)
        return true
    } catch {
        return false
    }
})

ipcMain.handle('save-file', async (_, { data, filename }) => {
    const { dialog } = require('electron');
    const fs = require('node:fs');
    const { filePath } = await dialog.showSaveDialog({
        defaultPath: filename,
    });
    if (filePath) {
        fs.writeFileSync(filePath, Buffer.from(data));
        return true;
    }
    return false;
});
