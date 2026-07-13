import React, { useState, useEffect, useCallback } from 'react';
import type { UpdateInfo, DownloadProgress, UpdateStatus, UpdateError } from '../types/updater';

interface UpdaterModalProps {
    isOpen: boolean;
    onClose: () => void;
    isDark: boolean;
}

const UpdaterModal: React.FC<UpdaterModalProps> = ({ isOpen, onClose, isDark }) => {
    const [status, setStatus] = useState<UpdateStatus>('idle');
    const [currentVersion, setCurrentVersion] = useState<string>('');
    const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
    const [downloadProgress, setDownloadProgress] = useState<DownloadProgress | null>(null);
    const [error, setError] = useState<UpdateError | null>(null);
    const [isDevMode, setIsDevMode] = useState(false);
    const [isManualInstall, setIsManualInstall] = useState(false);

    // Get current app version
    useEffect(() => {
        window.updater?.getAppVersion().then(setCurrentVersion);
    }, []);

    // Setup event listeners
    useEffect(() => {
        if (!window.updater) return;

        const unsubscribers = [
            window.updater.onCheckingForUpdate(() => {
                setStatus('checking');
                setError(null);
            }),
            window.updater.onUpdateAvailable((info) => {
                setStatus('available');
                setUpdateInfo(info);
            }),
            window.updater.onUpdateNotAvailable((info: any) => {
                setStatus('not-available');
                setUpdateInfo(info);
                if (info?.devMode) {
                    setIsDevMode(true);
                }
            }),
            window.updater.onDownloadProgress((progress) => {
                setStatus('downloading');
                setDownloadProgress(progress);
            }),
            window.updater.onUpdateDownloaded((info: any) => {
                setStatus('downloaded');
                setUpdateInfo(info);
                if (info?.manualInstall) {
                    setIsManualInstall(true);
                }
            }),
            window.updater.onUpdateError((err) => {
                setStatus('error');
                setError(err);
            }),
        ];

        return () => {
            unsubscribers.forEach(unsub => unsub?.());
        };
    }, []);

    const handleCheckForUpdates = useCallback(async () => {
        setStatus('checking');
        setError(null);
        setUpdateInfo(null);
        setDownloadProgress(null);
        try {
            const result = await window.updater?.checkForUpdates();
            // 如果没有通过事件更新状态，手动处理返回结果
            if (result?.updateInfo && result.updateInfo.version) {
                // 检查是否有新版本
                const currentVersion = await window.updater?.getAppVersion();
                if (result.updateInfo.version !== currentVersion) {
                    setStatus('available');
                    setUpdateInfo(result.updateInfo);
                } else {
                    setStatus('not-available');
                    setUpdateInfo(result.updateInfo);
                }
            }
        } catch (e) {
            console.error('Check for updates failed:', e);
            setStatus('error');
            setError({ message: String(e) });
        }
    }, []);

    const handleDownloadUpdate = useCallback(async () => {
        setStatus('downloading');
        setDownloadProgress({ percent: 0, bytesPerSecond: 0, transferred: 0, total: 0 });
        await window.updater?.downloadUpdate();
    }, []);

    const handleInstallUpdate = useCallback(async () => {
        // 延迟一小段时间确保 UI 更新后再执行
        setTimeout(async () => {
            try {
                await window.updater?.installUpdate();
            } catch (e) {
                console.error('Install failed:', e);
            }
        }, 100);
    }, []);

    const handleOpenReleasePage = useCallback(async () => {
        await window.updater?.openReleasePage();
    }, []);

    const formatBytes = (bytes: number): string => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const formatReleaseNotes = (notes: string | { version: string; note: string }[] | undefined): string => {
        if (!notes) return '';
        let text = '';
        if (typeof notes === 'string') {
            text = notes;
        } else {
            text = notes.map(n => `${n.version}: ${n.note}`).join('\n');
        }
        // 解码 HTML 实体
        text = text.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&quot;/g, '"');
        // 为链接添加样式并修改为使用 data-href，阻止默认行为
        // 匹配所有 <a href="..." 或 <a href='...' 格式
        text = text.replace(/<a\s+href=["']([^"']+)["']/gi, (match, url) => {
            return `<a data-href="${url}" href="#" style="color: ${isDark ? '#60a5fa' : '#2563eb'}; text-decoration: underline; cursor: pointer;"`;
        });
        return text || 'View release page for details';
    };

    // 处理链接点击
    const handleLinkClick = (e: React.MouseEvent<HTMLDivElement>) => {
        const target = e.target as HTMLElement;
        if (target.tagName === 'A') {
            e.preventDefault();
            e.stopPropagation();
            const href = target.getAttribute('data-href');
            if (href) {
                (window as any).ipcRenderer?.send('open-external', href);
            }
        }
    };

    if (!isOpen) return null;

    const modalStyles: React.CSSProperties = {
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
        backdropFilter: 'blur(10px)',
    };

    const contentStyles: React.CSSProperties = {
        backgroundColor: isDark ? '#1a1a1a' : '#ffffff',
        borderRadius: 16,
        padding: 24,
        width: 420,
        maxWidth: '90vw',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
        border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
    };

    const titleStyles: React.CSSProperties = {
        fontSize: 20,
        fontWeight: 700,
        marginBottom: 8,
        color: isDark ? '#fff' : '#1c1c1e',
    };

    const subtitleStyles: React.CSSProperties = {
        fontSize: 13,
        color: isDark ? '#888' : '#666',
        marginBottom: 20,
    };

    const buttonStyles = (primary = false): React.CSSProperties => ({
        padding: '10px 20px',
        borderRadius: 10,
        border: 'none',
        cursor: 'pointer',
        fontSize: 14,
        fontWeight: 600,
        transition: 'all 0.2s',
        backgroundColor: primary
            ? (isDark ? '#0c66ff' : '#6750a4')
            : (isDark ? '#333' : '#f0f0f0'),
        color: primary ? '#fff' : (isDark ? '#fff' : '#1c1c1e'),
    });

    const progressBarContainerStyles: React.CSSProperties = {
        height: 8,
        backgroundColor: isDark ? '#333' : '#e0e0e0',
        borderRadius: 4,
        overflow: 'hidden',
        marginTop: 12,
        marginBottom: 8,
    };

    const progressBarStyles: React.CSSProperties = {
        height: '100%',
        backgroundColor: isDark ? '#0c66ff' : '#6750a4',
        borderRadius: 4,
        transition: 'width 0.3s ease',
        width: `${downloadProgress?.percent || 0}%`,
    };

    const statusCardStyles: React.CSSProperties = {
        backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
        borderRadius: 12,
        padding: 16,
        marginBottom: 20,
    };

    return (
        <div style={modalStyles} onClick={onClose}>
            <div style={contentStyles} onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                    <div>
                        <h2 style={titleStyles}>Software Update</h2>
                        <p style={subtitleStyles}>Current version: v{currentVersion}</p>
                    </div>
                    <button
                        onClick={onClose}
                        style={{
                            background: 'none',
                            border: 'none',
                            fontSize: 20,
                            cursor: 'pointer',
                            color: isDark ? '#666' : '#999',
                            padding: 4,
                        }}
                    >
                        ✕
                    </button>
                </div>

                {/* Status Display */}
                <div style={statusCardStyles}>
                    {status === 'idle' && (
                        <div style={{ textAlign: 'center', padding: 20 }}>
                            <div style={{ fontSize: 40, marginBottom: 12 }}>🚀</div>
                            <p style={{ color: isDark ? '#888' : '#666' }}>
                                Click the button below to check for updates
                            </p>
                        </div>
                    )}

                    {status === 'checking' && (
                        <div style={{ textAlign: 'center', padding: 20 }}>
                            <div style={{
                                width: 32,
                                height: 32,
                                border: `3px solid ${isDark ? '#333' : '#e0e0e0'}`,
                                borderTopColor: isDark ? '#0c66ff' : '#6750a4',
                                borderRadius: '50%',
                                animation: 'spin 1s linear infinite',
                                margin: '0 auto 12px',
                            }} />
                            <p style={{ color: isDark ? '#fff' : '#1c1c1e' }}>
                                Checking for updates...
                            </p>
                        </div>
                    )}

                    {status === 'not-available' && (
                        <div style={{ textAlign: 'center', padding: 20 }}>
                            <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
                            <p style={{ color: isDark ? '#4ade80' : '#22c55e', fontWeight: 600, marginBottom: 4 }}>
                                {isDevMode ? 'Dev Mode' : 'You are up to date'}
                            </p>
                            <p style={{ color: isDark ? '#888' : '#666', fontSize: 13 }}>
                                v{updateInfo?.version || currentVersion}
                            </p>
                            {isDevMode && (
                                <p style={{ color: isDark ? '#888' : '#666', fontSize: 12, marginTop: 8 }}>
                                    Cannot check for updates in dev mode<br />
                                    Click "View Release Page" to see the latest version
                                </p>
                            )}
                        </div>
                    )}

                    {status === 'available' && updateInfo && (
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                                <div style={{
                                    width: 48,
                                    height: 48,
                                    borderRadius: 12,
                                    backgroundColor: isDark ? 'rgba(12, 102, 255, 0.2)' : 'rgba(103, 80, 164, 0.1)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: 24,
                                }}>
                                    📦
                                </div>
                                <div>
                                    <p style={{ fontWeight: 700, color: isDark ? '#fff' : '#1c1c1e', marginBottom: 2 }}>
                                        New version available: v{updateInfo.version}
                                    </p>
                                    {updateInfo.releaseDate && (
                                        <p style={{ fontSize: 12, color: isDark ? '#888' : '#666' }}>
                                            Release date: {new Date(updateInfo.releaseDate).toLocaleDateString()}
                                        </p>
                                    )}
                                </div>
                            </div>
                            {updateInfo.releaseNotes && (
                                <div
                                    onClick={handleLinkClick}
                                    style={{
                                        backgroundColor: isDark ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.05)',
                                        borderRadius: 8,
                                        padding: 12,
                                        maxHeight: 150,
                                        overflow: 'auto',
                                        fontSize: 13,
                                        color: isDark ? '#aaa' : '#555',
                                    }}
                                    className="release-notes-content"
                                    dangerouslySetInnerHTML={{ __html: formatReleaseNotes(updateInfo.releaseNotes) }}
                                />
                            )}
                        </div>
                    )}

                    {status === 'downloading' && downloadProgress && (
                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                <span style={{ color: isDark ? '#fff' : '#1c1c1e', fontWeight: 600 }}>
                                    Downloading update...
                                </span>
                                <span style={{ color: isDark ? '#888' : '#666', fontSize: 13 }}>
                                    {downloadProgress.percent.toFixed(1)}%
                                </span>
                            </div>
                            <div style={progressBarContainerStyles}>
                                <div style={progressBarStyles} />
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: isDark ? '#666' : '#888' }}>
                                <span>{formatBytes(downloadProgress.transferred)} / {formatBytes(downloadProgress.total)}</span>
                                <span>{formatBytes(downloadProgress.bytesPerSecond)}/s</span>
                            </div>
                        </div>
                    )}

                    {status === 'downloaded' && (
                        <div style={{ textAlign: 'center', padding: 20 }}>
                            <div style={{ fontSize: 40, marginBottom: 12 }}>🎉</div>
                            <p style={{ color: isDark ? '#4ade80' : '#22c55e', fontWeight: 600, marginBottom: 4 }}>
                                Update downloaded
                            </p>
                            <p style={{ color: isDark ? '#888' : '#666', fontSize: 13 }}>
                                Click "Install Now" to open the installer and quit the app
                            </p>
                        </div>
                    )}

                    {status === 'error' && error && (
                        <div style={{ textAlign: 'center', padding: 20 }}>
                            <div style={{ fontSize: 40, marginBottom: 12 }}>❌</div>
                            <p style={{ color: '#ef4444', fontWeight: 600, marginBottom: 4 }}>
                                Update failed
                            </p>
                            <p style={{ color: isDark ? '#888' : '#666', fontSize: 13, wordBreak: 'break-word' }}>
                                {error.message}
                            </p>
                        </div>
                    )}
                </div>

                {/* Action Buttons */}
                <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                    <button
                        style={buttonStyles(false)}
                        onClick={handleOpenReleasePage}
                    >
                        View Release Page
                    </button>

                    {(status === 'idle' || status === 'not-available' || status === 'error') && (
                        <button
                            style={buttonStyles(true)}
                            onClick={handleCheckForUpdates}
                        >
                            Check for Updates
                        </button>
                    )}

                    {status === 'available' && (
                        <button
                            style={buttonStyles(true)}
                            onClick={handleDownloadUpdate}
                        >
                            Download Update
                        </button>
                    )}

                    {status === 'downloaded' && (
                        <button
                            style={buttonStyles(true)}
                            onClick={handleInstallUpdate}
                        >
                            Install Now
                        </button>
                    )}

                    {status === 'checking' && (
                        <button
                            style={{ ...buttonStyles(true), opacity: 0.5, cursor: 'not-allowed' }}
                            disabled
                        >
                            Checking...
                        </button>
                    )}

                    {status === 'downloading' && (
                        <button
                            style={{ ...buttonStyles(true), opacity: 0.5, cursor: 'not-allowed' }}
                            disabled
                        >
                            Downloading...
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default UpdaterModal;
