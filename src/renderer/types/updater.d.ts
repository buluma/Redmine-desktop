/**
 * TypeScript declarations for updater API exposed via preload
 */

export interface UpdateInfo {
    version: string;
    releaseDate?: string;
    releaseNotes?: string | ReleaseNoteInfo[];
    releaseName?: string;
}

export interface ReleaseNoteInfo {
    version: string;
    note: string;
}

export interface DownloadProgress {
    percent: number;
    bytesPerSecond: number;
    transferred: number;
    total: number;
}

export interface UpdateError {
    message: string;
    stack?: string;
}

export type UpdateStatus =
    | 'idle'
    | 'checking'
    | 'available'
    | 'not-available'
    | 'downloading'
    | 'downloaded'
    | 'error';

export interface AutoUpdateSettings {
    enabled: boolean;
    interval: number;  // Hours
}

export interface UpdaterAPI {
    checkForUpdates: () => Promise<{ success: boolean; updateInfo?: UpdateInfo; error?: string }>;
    downloadUpdate: () => Promise<{ success: boolean; error?: string }>;
    installUpdate: () => Promise<{ success: boolean; error?: string }>;
    getAppVersion: () => Promise<string>;
    openReleasePage: () => Promise<{ success: boolean; error?: string }>;
    getAutoUpdateSettings: () => Promise<AutoUpdateSettings>;
    setAutoUpdateSettings: (settings: Partial<AutoUpdateSettings>) => Promise<AutoUpdateSettings>;
    onCheckingForUpdate: (callback: () => void) => () => void;
    onUpdateAvailable: (callback: (info: UpdateInfo) => void) => () => void;
    onUpdateNotAvailable: (callback: (info: UpdateInfo) => void) => () => void;
    onDownloadProgress: (callback: (progress: DownloadProgress) => void) => () => void;
    onUpdateDownloaded: (callback: (info: UpdateInfo) => void) => () => void;
    onUpdateError: (callback: (error: UpdateError) => void) => () => void;
    onUpdateAvailableSilent: (callback: (info: { version: string; releaseDate?: string }) => void) => () => void;
}

declare global {
    interface Window {
        updater: UpdaterAPI;
    }
}
