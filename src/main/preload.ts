import { contextBridge, ipcRenderer } from 'electron'

// --------- Expose some API to the Renderer process ---------
contextBridge.exposeInMainWorld('ipcRenderer', {
    on(...args: Parameters<typeof ipcRenderer.on>) {
        const [channel, listener] = args
        return ipcRenderer.on(channel, (event, ...args) => listener(event, ...args))
    },
    off(...args: Parameters<typeof ipcRenderer.off>) {
        const [channel, ...omit] = args
        return ipcRenderer.off(channel, ...omit)
    },
    send(...args: Parameters<typeof ipcRenderer.send>) {
        const [channel, ...omit] = args
        return ipcRenderer.send(channel, ...omit)
    },
    invoke(...args: Parameters<typeof ipcRenderer.invoke>) {
        const [channel, ...omit] = args
        return ipcRenderer.invoke(channel, ...omit)
    },

    // Platform info
    platform: process.platform,
})

// Expose updater API
contextBridge.exposeInMainWorld('updater', {
    // Check for updates
    checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),

    // Download update
    downloadUpdate: () => ipcRenderer.invoke('download-update'),

    // Install update and restart
    installUpdate: () => ipcRenderer.invoke('install-update'),

    // Get current app version
    getAppVersion: () => ipcRenderer.invoke('get-app-version'),

    // Open release page
    openReleasePage: () => ipcRenderer.invoke('open-release-page'),

    // Listen for update events
    onCheckingForUpdate: (callback: () => void) => {
        ipcRenderer.on('checking-for-update', callback)
        return () => ipcRenderer.off('checking-for-update', callback)
    },
    onUpdateAvailable: (callback: (info: any) => void) => {
        const handler = (_: any, info: any) => callback(info)
        ipcRenderer.on('update-available', handler)
        return () => ipcRenderer.off('update-available', handler)
    },
    onUpdateNotAvailable: (callback: (info: any) => void) => {
        const handler = (_: any, info: any) => callback(info)
        ipcRenderer.on('update-not-available', handler)
        return () => ipcRenderer.off('update-not-available', handler)
    },
    onDownloadProgress: (callback: (progress: any) => void) => {
        const handler = (_: any, progress: any) => callback(progress)
        ipcRenderer.on('download-progress', handler)
        return () => ipcRenderer.off('download-progress', handler)
    },
    onUpdateDownloaded: (callback: (info: any) => void) => {
        const handler = (_: any, info: any) => callback(info)
        ipcRenderer.on('update-downloaded', handler)
        return () => ipcRenderer.off('update-downloaded', handler)
    },
    onUpdateError: (callback: (error: any) => void) => {
        const handler = (_: any, error: any) => callback(error)
        ipcRenderer.on('update-error', handler)
        return () => ipcRenderer.off('update-error', handler)
    },

    // Silent update notification (when background detects an update)
    onUpdateAvailableSilent: (callback: (info: any) => void) => {
        const handler = (_: any, info: any) => callback(info)
        ipcRenderer.on('update-available-silent', handler)
        return () => ipcRenderer.off('update-available-silent', handler)
    },

    // Get auto update settings
    getAutoUpdateSettings: () => ipcRenderer.invoke('get-auto-update-settings'),

    // Set auto update configuration
    setAutoUpdateSettings: (settings: { enabled?: boolean; interval?: number }) =>
        ipcRenderer.invoke('set-auto-update-settings', settings),
})
