import { useState, useEffect } from 'react'

export interface SettingsState {
    redmineURL: string
    redmineAPIKey: string
    refreshInterval: number
    enableTransparency: boolean
    appTheme: string
    showBadge: boolean
    isConfigured: boolean
}

export interface SettingsActions {
    saveSettings: (url: string, key: string) => Promise<void>
    setRefreshInterval: (v: number) => void
    setEnableTransparency: (v: boolean) => void
    setAppTheme: (v: string) => void
    setShowBadge: (v: boolean) => void
}

function loadFromStorage<T>(key: string, fallback: T): T {
    try {
        const raw = localStorage.getItem(key)
        if (raw === null) return fallback
        return JSON.parse(raw) as T
    } catch {
        return fallback
    }
}

export function useSettings(): SettingsState & SettingsActions {
    const [redmineURL, setRedmineURL] = useState(() => localStorage.getItem('redmineURL') || '')
    const [redmineAPIKey, setRedmineAPIKey] = useState(() => localStorage.getItem('redmineAPIKey') || '')
    const [refreshInterval, setRefreshInterval] = useState(() => loadFromStorage('refreshInterval', 300))
    const [enableTransparency, setEnableTransparency] = useState(() => loadFromStorage('enableTransparency', false))
    const [appTheme, setAppTheme] = useState(() => loadFromStorage('appTheme', 'dark'))
    const [showBadge, setShowBadge] = useState(() => loadFromStorage('showBadge', false))
    const [isConfigured, setIsConfigured] = useState(() => !!(redmineURL && redmineAPIKey))

    // Persist simple settings
    useEffect(() => {
        localStorage.setItem('enableTransparency', enableTransparency.toString())
        localStorage.setItem('appTheme', appTheme)
        localStorage.setItem('refreshInterval', refreshInterval.toString())
        localStorage.setItem('showBadge', showBadge.toString())
    }, [enableTransparency, appTheme, refreshInterval, showBadge])

    // Load secure key on mount
    useEffect(() => {
        const loadSecureKey = async () => {
            if (localStorage.getItem('hasSecureKey') === 'true') {
                try {
                    const secureKey = await window.secureStore?.retrieve('redmineAPIKey')
                    if (secureKey && !redmineAPIKey) {
                        setRedmineAPIKey(secureKey)
                        setIsConfigured(!!(redmineURL && secureKey))
                    }
                } catch (e) {
                    console.warn('Failed to load secure key:', e)
                }
                // Secure storage is now authoritative for this key; clear any lingering
                // plaintext copy so it doesn't sit in localStorage indefinitely.
                localStorage.removeItem('redmineAPIKey')
            } else {
                // Migrate a legacy plaintext key (saved before secure storage existed)
                // into secure storage, then remove the plaintext copy.
                const legacyKey = localStorage.getItem('redmineAPIKey')
                if (legacyKey) {
                    try {
                        await window.secureStore?.store('redmineAPIKey', legacyKey)
                        localStorage.setItem('hasSecureKey', 'true')
                        localStorage.removeItem('redmineAPIKey')
                    } catch (e) {
                        console.warn('Failed to migrate legacy API key to secure storage:', e)
                    }
                }
            }
        }
        loadSecureKey()
    }, [])

    const saveSettings = async (url: string, key: string) => {
        localStorage.setItem('redmineURL', url)
        if (key) {
            await window.secureStore?.store('redmineAPIKey', key)
            localStorage.setItem('hasSecureKey', 'true')
        } else {
            await window.secureStore?.remove('redmineAPIKey')
            localStorage.removeItem('hasSecureKey')
        }
        setRedmineURL(url)
        setRedmineAPIKey(key)
        setIsConfigured(true)
        ;(window as any).ipcRenderer?.send('save-redmine-url', url)
    }

    return {
        redmineURL,
        redmineAPIKey,
        refreshInterval,
        enableTransparency,
        appTheme,
        showBadge,
        isConfigured,
        saveSettings,
        setRefreshInterval,
        setEnableTransparency,
        setAppTheme,
        setShowBadge,
    }
}
