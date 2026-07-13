import { app, BrowserWindow, ipcMain, Menu, Tray, nativeImage } from 'electron'
import path from 'node:path'
import { initUpdater } from './updater'

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

// Disable CORS and certificate errors for internal Redmine servers
app.commandLine.appendSwitch('ignore-certificate-errors')
app.commandLine.appendSwitch('disable-site-isolation-trials')

// Better scrolling performance
app.commandLine.appendSwitch('enable-smooth-scrolling')


let win: BrowserWindow | null
let tray: Tray | null = null

// 🚧 Use ['ENV_NAME'] avoid vite:define dev replacement
const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']

function createTray() {
    // Load tray icon from file
    // macOS will automatically use @2x version for Retina displays
    const iconPath = path.join(process.env.VITE_PUBLIC || path.join(__dirname, '../public'), 'trayTemplate.png');

    console.log('Loading tray icon from:', iconPath);

    const icon = nativeImage.createFromPath(iconPath);

    console.log('Tray icon loaded, size:', icon.getSize(), 'isEmpty:', icon.isEmpty());

    if (icon.isEmpty()) {
        console.error('Failed to load tray icon from:', iconPath);
        // Fallback: create tray without icon (will only show title)
        tray = new Tray(nativeImage.createEmpty());
    } else {
        icon.setTemplateImage(true);
        tray = new Tray(icon);
    }

    tray.setToolTip('Redmine');
    console.log('Tray created successfully');

    tray.on('click', () => {
        // Check if window exists and is not destroyed
        if (!win || win.isDestroyed()) {
            createWindow();
            return;
        }
        if (win.isVisible()) {
            win.hide()
        } else {
            win.show()
        }
    })
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

    // 拦截导航，外部链接在系统浏览器打开
    win.webContents.on('will-navigate', (event, url) => {
        // 如果是外部链接（不是本地文件或开发服务器）
        if (!url.startsWith('file://') && !url.startsWith('http://localhost')) {
            event.preventDefault()
            const { shell } = require('electron')
            shell.openExternal(url)
        }
    })

    // 处理新窗口打开请求
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

    // Initialize auto-updater (自动检测由 updater.ts 处理)
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

ipcMain.on('update-badge', (_, count: number) => {
    console.log('Received update-badge:', count);
    if (count > 0) {
        app.setBadgeCount(count)
        if (tray && !tray.isDestroyed()) {
            tray.setTitle(count.toString())
            tray.setToolTip(`Redmine: ${count} unfinished issues`)
        }
    } else {
        app.setBadgeCount(0)
        if (tray && !tray.isDestroyed()) {
            tray.setTitle('')
            tray.setToolTip('Redmine')
        }
    }
})

ipcMain.on('open-external', (_, url) => {
    const { shell } = require('electron');
    shell.openExternal(url);
});

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
