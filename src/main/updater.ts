import { autoUpdater, UpdateInfo, ProgressInfo } from 'electron-updater';
import { BrowserWindow, ipcMain, dialog, shell, app, net } from 'electron';
import log from 'electron-log';
import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import Store from 'electron-store';

// 配置存储
const store = new Store();

// 保存最新版本信息
let latestUpdateInfo: UpdateInfo | null = null;
// 保存下载的 DMG 路径 (macOS)
let downloadedDmgPath: string | null = null;
// 后台检查定时器
let autoCheckTimer: NodeJS.Timeout | null = null;

// Configure logging
log.transports.file.level = 'info';
autoUpdater.logger = log;

// GitHub Release configuration
autoUpdater.autoDownload = false; // Don't auto-download, let user decide
autoUpdater.autoInstallOnAppQuit = true;

let mainWindow: BrowserWindow | null = null;

// Check if running in development mode
const isDev = !app.isPackaged;

/**
 * 下载文件到指定路径，支持重定向和进度回调
 */
function downloadFile(
    url: string,
    destPath: string,
    onProgress: (progress: { percent: number; bytesPerSecond: number; transferred: number; total: number }) => void
): Promise<void> {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(destPath);
        let downloadedBytes = 0;
        let totalBytes = 0;
        let startTime = Date.now();

        const makeRequest = (requestUrl: string) => {
            https.get(requestUrl, (response) => {
                // 处理重定向
                if (response.statusCode === 301 || response.statusCode === 302) {
                    const redirectUrl = response.headers.location;
                    if (redirectUrl) {
                        log.info(`Redirecting to: ${redirectUrl}`);
                        makeRequest(redirectUrl);
                        return;
                    }
                }

                if (response.statusCode !== 200) {
                    file.close();
                    fs.unlink(destPath, () => { });
                    reject(new Error(`Download failed: HTTP ${response.statusCode}`));
                    return;
                }

                totalBytes = parseInt(response.headers['content-length'] || '0', 10);

                response.on('data', (chunk: Buffer) => {
                    downloadedBytes += chunk.length;
                    const elapsed = (Date.now() - startTime) / 1000;
                    const bytesPerSecond = elapsed > 0 ? downloadedBytes / elapsed : 0;
                    const percent = totalBytes > 0 ? (downloadedBytes / totalBytes) * 100 : 0;

                    onProgress({
                        percent,
                        bytesPerSecond,
                        transferred: downloadedBytes,
                        total: totalBytes
                    });
                });

                response.pipe(file);

                file.on('finish', () => {
                    file.close();
                    resolve();
                });

                file.on('error', (err) => {
                    file.close();
                    fs.unlink(destPath, () => { });
                    reject(err);
                });

            }).on('error', (err) => {
                file.close();
                fs.unlink(destPath, () => { });
                reject(err);
            });
        };

        makeRequest(url);
    });
}

/**
 * Initialize the auto-updater with the main window reference
 */
export function initUpdater(win: BrowserWindow) {
    mainWindow = win;
    setupAutoUpdaterEvents();
    setupIpcHandlers();

    // 启动自动检测
    startAutoCheck();
}

/**
 * 获取自动检测设置
 */
function getAutoCheckSettings(): { enabled: boolean; interval: number } {
    return {
        enabled: store.get('autoCheckUpdate', true) as boolean,
        interval: store.get('autoCheckInterval', 24) as number  // 默认 24 小时
    };
}

/**
 * 启动后台自动检测
 */
let initialCheckTimeout: NodeJS.Timeout | null = null;
let isFirstStart = true;  // 标记是否是首次启动

function startAutoCheck() {
    // 先清除所有之前的定时器
    if (autoCheckTimer) {
        clearInterval(autoCheckTimer);
        autoCheckTimer = null;
    }
    if (initialCheckTimeout) {
        clearTimeout(initialCheckTimeout);
        initialCheckTimeout = null;
    }

    const settings = getAutoCheckSettings();

    if (!settings.enabled || isDev) {
        log.info('Auto update check disabled or in dev mode');
        return;
    }

    const intervalMs = settings.interval * 60 * 60 * 1000; // 转换为毫秒
    log.info(`Auto update check enabled, interval: ${settings.interval} hours (${intervalMs}ms)`);

    // 启动定时检测
    autoCheckTimer = setInterval(() => {
        log.info('Background auto check for updates...');
        silentCheckForUpdates();
    }, intervalMs);

    // 只在首次启动时延迟检测一次
    if (isFirstStart) {
        isFirstStart = false;
        initialCheckTimeout = setTimeout(() => {
            log.info('Initial auto check for updates...');
            silentCheckForUpdates();
            initialCheckTimeout = null;
        }, 10000); // 启动后 10 秒
    }
}

/**
 * 静默检测更新（不弹窗，只在有更新时通知）
 */
async function silentCheckForUpdates() {
    try {
        if (isDev) return;

        const result = await autoUpdater.checkForUpdates();
        if (result && result.updateInfo) {
            const currentVersion = app.getVersion();
            if (result.updateInfo.version !== currentVersion) {
                log.info(`Silent check found update: ${result.updateInfo.version}`);
                // 发送通知到渲染进程
                sendToRenderer('update-available-silent', {
                    version: result.updateInfo.version,
                    releaseDate: result.updateInfo.releaseDate
                });
            }
        }
    } catch (error) {
        log.error('Silent update check error:', error);
    }
}

/**
 * Setup auto-updater event listeners
 */
function setupAutoUpdaterEvents() {
    // Check for updates error
    autoUpdater.on('error', (error: Error) => {
        log.error('Update error:', error);
        sendToRenderer('update-error', {
            message: error.message,
            stack: error.stack
        });
    });

    // Checking for updates
    autoUpdater.on('checking-for-update', () => {
        log.info('Checking for updates...');
        sendToRenderer('checking-for-update', null);
    });

    // Update available
    autoUpdater.on('update-available', (info: UpdateInfo) => {
        log.info('Update available:', info.version);
        latestUpdateInfo = info;  // 保存版本信息
        sendToRenderer('update-available', {
            version: info.version,
            releaseDate: info.releaseDate,
            releaseNotes: info.releaseNotes,
            releaseName: info.releaseName
        });
    });

    // No update available
    autoUpdater.on('update-not-available', (info: UpdateInfo) => {
        log.info('No update available, current version is latest:', info.version);
        sendToRenderer('update-not-available', {
            version: info.version
        });
    });

    // Download progress
    autoUpdater.on('download-progress', (progress: ProgressInfo) => {
        log.info(`Download progress: ${progress.percent.toFixed(1)}%`);
        sendToRenderer('download-progress', {
            percent: progress.percent,
            bytesPerSecond: progress.bytesPerSecond,
            transferred: progress.transferred,
            total: progress.total
        });
    });

    // Update downloaded
    autoUpdater.on('update-downloaded', (info: UpdateInfo) => {
        log.info('Update downloaded:', info.version);
        sendToRenderer('update-downloaded', {
            version: info.version,
            releaseNotes: info.releaseNotes,
            releaseName: info.releaseName
        });

        // Show dialog to prompt user to restart
        if (mainWindow) {
            dialog.showMessageBox(mainWindow, {
                type: 'info',
                title: '更新已就绪',
                message: `新版本 ${info.version} 已下载完成`,
                detail: '重启应用以完成更新。',
                buttons: ['立即重启', '稍后'],
                defaultId: 0,
                cancelId: 1
            }).then(({ response }) => {
                if (response === 0) {
                    autoUpdater.quitAndInstall(false, true);
                }
            });
        }
    });
}

/**
 * Fetch latest release info from GitHub API (for dev mode fallback)
 */
function fetchLatestReleaseFromGitHub(): Promise<{ version: string; releaseDate: string; releaseNotes: string; releaseName: string }> {
    return new Promise((resolve, reject) => {
        const request = net.request({
            method: 'GET',
            protocol: 'https:',
            hostname: 'api.github.com',
            path: '/repos/buluma/Redmine-desktop/releases/latest',
        });

        request.setHeader('User-Agent', 'Redmine-Desktop-App/1.0');
        request.setHeader('Accept', 'application/vnd.github.v3+json');

        let data = '';
        let statusCode = 0;

        request.on('response', (response) => {
            statusCode = response.statusCode;

            response.on('data', (chunk: Buffer) => {
                data += chunk.toString();
            });

            response.on('end', () => {
                try {
                    if (statusCode === 200) {
                        const release = JSON.parse(data);
                        resolve({
                            version: release.tag_name?.replace(/^v/, '') || release.name,
                            releaseDate: release.published_at,
                            releaseNotes: release.body || '',
                            releaseName: release.name
                        });
                    } else if (statusCode === 404) {
                        reject(new Error('No releases found'));
                    } else {
                        log.error('GitHub API response:', statusCode, data.substring(0, 200));
                        reject(new Error(`GitHub API error: ${statusCode}`));
                    }
                } catch (e) {
                    reject(e);
                }
            });

            response.on('error', (error: Error) => {
                reject(error);
            });
        });

        request.on('error', (error: Error) => {
            log.error('Request error:', error);
            reject(error);
        });

        // Set timeout
        setTimeout(() => {
            request.abort();
            reject(new Error('Request timeout'));
        }, 15000);

        request.end();
    });
}

/**
 * Compare version strings (returns true if latest > current)
 */
function isNewerVersion(latest: string, current: string): boolean {
    const latestParts = latest.split('.').map(Number);
    const currentParts = current.split('.').map(Number);

    for (let i = 0; i < Math.max(latestParts.length, currentParts.length); i++) {
        const l = latestParts[i] || 0;
        const c = currentParts[i] || 0;
        if (l > c) return true;
        if (l < c) return false;
    }
    return false;
}

/**
 * Setup IPC handlers for renderer process communication
 */
function setupIpcHandlers() {
    // Check for updates manually
    ipcMain.handle('check-for-updates', async () => {
        try {
            log.info('Manual update check triggered, isDev:', isDev);
            sendToRenderer('checking-for-update', null);

            if (isDev) {
                // In dev mode, show a friendly message and open releases page
                log.info('Dev mode: skipping API call, showing dev mode notice');
                const currentVersion = app.getVersion();

                // Simulate a brief check then show result
                setTimeout(() => {
                    sendToRenderer('update-not-available', {
                        version: currentVersion,
                        devMode: true
                    });
                }, 500);

                return {
                    success: true,
                    updateInfo: { version: currentVersion },
                    devMode: true
                };
            } else {
                // Production mode: use electron-updater
                const result = await autoUpdater.checkForUpdates();
                return {
                    success: true,
                    updateInfo: result?.updateInfo
                };
            }
        } catch (error: any) {
            log.error('Failed to check for updates:', error);
            sendToRenderer('update-error', { message: error.message });
            return {
                success: false,
                error: error.message
            };
        }
    });

    // Start downloading update
    ipcMain.handle('download-update', async () => {
        try {
            if (isDev) {
                // In dev mode, just open the releases page
                log.info('Dev mode: opening releases page instead of downloading');
                await shell.openExternal('https://github.com/buluma/Redmine-desktop/releases');
                sendToRenderer('update-error', {
                    message: '开发模式下无法自动下载，已打开 GitHub Releases 页面'
                });
                return { success: false, error: 'Dev mode - opened releases page' };
            }

            // macOS: 自动下载 DMG 文件并打开
            if (process.platform === 'darwin' && latestUpdateInfo) {
                const version = latestUpdateInfo.version;
                const dmgFileName = `Redmine-${version}-arm64.dmg`;
                const downloadUrl = `https://github.com/buluma/Redmine-desktop/releases/download/v${version}/${dmgFileName}`;
                const downloadPath = path.join(app.getPath('downloads'), dmgFileName);

                log.info(`macOS: Downloading DMG from ${downloadUrl}`);
                sendToRenderer('download-progress', { percent: 0, bytesPerSecond: 0, transferred: 0, total: 0 });

                try {
                    await downloadFile(downloadUrl, downloadPath, (progress) => {
                        sendToRenderer('download-progress', progress);
                    });

                    log.info(`DMG downloaded to ${downloadPath}`);
                    downloadedDmgPath = downloadPath;  // 保存路径
                    sendToRenderer('update-downloaded', {
                        version: version,
                        dmgPath: downloadPath
                    });
                    return { success: true, dmgPath: downloadPath };
                } catch (downloadError: any) {
                    log.error('Failed to download DMG:', downloadError);
                    // 下载失败时打开 releases 页面
                    await shell.openExternal('https://github.com/buluma/Redmine-desktop/releases/latest');
                    sendToRenderer('update-error', {
                        message: `下载失败，已打开下载页面: ${downloadError.message}`
                    });
                    return { success: false, error: downloadError.message };
                }
            }

            log.info('Starting update download...');
            await autoUpdater.downloadUpdate();
            return { success: true };
        } catch (error: any) {
            log.error('Failed to download update:', error);
            sendToRenderer('update-error', { message: error.message });
            return {
                success: false,
                error: error.message
            };
        }
    });

    // Install update and restart
    ipcMain.handle('install-update', async () => {
        try {
            if (isDev) {
                sendToRenderer('update-error', { message: '开发模式下无法安装更新' });
                return { success: false, error: 'Cannot install in dev mode' };
            }

            // macOS: 打开下载的 DMG 文件并退出应用
            if (process.platform === 'darwin' && downloadedDmgPath) {
                log.info(`Opening DMG: ${downloadedDmgPath}`);

                // 打开 DMG 文件
                shell.openPath(downloadedDmgPath).then((error) => {
                    if (error) {
                        log.error('Failed to open DMG:', error);
                    }
                });

                // 延迟后退出应用，给用户时间看到 DMG 打开
                setTimeout(() => {
                    log.info('Quitting app for manual update...');
                    app.quit();
                }, 1500);

                return { success: true };
            }

            log.info('Installing update and restarting...');

            // Windows: 使用 quitAndInstall
            setTimeout(() => {
                log.info('Calling quitAndInstall...');
                try {
                    autoUpdater.quitAndInstall(false, true);
                } catch (e) {
                    log.error('quitAndInstall error:', e);
                    app.quit();
                }
            }, 500);

            return { success: true };
        } catch (error: any) {
            log.error('Failed to install update:', error);
            sendToRenderer('update-error', { message: error.message });
            return {
                success: false,
                error: error.message
            };
        }
    });

    // Get current app version
    ipcMain.handle('get-app-version', () => {
        return app.getVersion();
    });

    // Open release page in browser
    ipcMain.handle('open-release-page', async () => {
        try {
            await shell.openExternal('https://github.com/buluma/Redmine-desktop/releases');
            return { success: true };
        } catch (error: any) {
            return {
                success: false,
                error: error.message
            };
        }
    });

    // 获取自动更新设置
    ipcMain.handle('get-auto-update-settings', () => {
        return getAutoCheckSettings();
    });

    // 设置自动更新配置
    ipcMain.handle('set-auto-update-settings', (_, settings: { enabled?: boolean; interval?: number }) => {
        if (settings.enabled !== undefined) {
            store.set('autoCheckUpdate', settings.enabled);
        }
        if (settings.interval !== undefined) {
            store.set('autoCheckInterval', settings.interval);
        }

        // 重新启动自动检测
        startAutoCheck();

        return getAutoCheckSettings();
    });
}

/**
 * Send message to renderer process
 */
function sendToRenderer(channel: string, data: any) {
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send(channel, data);
    }
}

/**
 * Trigger update check (can be called from outside)
 */
export function checkForUpdates() {
    if (isDev) {
        log.info('Skipping auto update check in dev mode');
        return;
    }

    autoUpdater.checkForUpdates().catch((error) => {
        log.error('Background update check failed:', error);
    });
}
