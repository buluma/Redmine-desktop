import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useSettings } from './useSettings'

// Mock secureStore
const mockSecureStore = {
    store: vi.fn().mockResolvedValue(true),
    retrieve: vi.fn().mockResolvedValue(null),
    remove: vi.fn().mockResolvedValue(true),
}
Object.defineProperty(window, 'secureStore', { value: mockSecureStore, writable: true })

// Mock ipcRenderer
Object.defineProperty(window, 'ipcRenderer', {
    value: { send: vi.fn() },
    writable: true,
})

declare global {
    interface Window {
        ipcRenderer: { send: (...args: any[]) => void }
    }
}

describe('useSettings', () => {
    beforeEach(() => {
        // Clear localStorage manually (jsdom doesn't have .clear())
        while (localStorage.length > 0) {
            const key = localStorage.key(0)
            if (key) localStorage.removeItem(key)
        }
        vi.clearAllMocks()
    })

    it('uses defaults when localStorage is empty', () => {
        const { result } = renderHook(() => useSettings())

        expect(result.current.redmineURL).toBe('')
        expect(result.current.refreshInterval).toBe(300)
        expect(result.current.appTheme).toBe('dark')
        expect(result.current.showBadge).toBe(false)
        expect(result.current.enableTransparency).toBe(false)
    })

    it('saveSettings persists to localStorage and secureStore', async () => {
        const { result } = renderHook(() => useSettings())

        await act(async () => {
            await result.current.saveSettings('http://new.com', 'api-key-123')
        })

        expect(result.current.redmineURL).toBe('http://new.com')
        expect(result.current.redmineAPIKey).toBe('api-key-123')
        expect(result.current.isConfigured).toBe(true)
        expect(localStorage.getItem('redmineURL')).toBe('http://new.com')
        expect(mockSecureStore.store).toHaveBeenCalledWith('redmineAPIKey', 'api-key-123')
        expect(window.ipcRenderer.send).toHaveBeenCalledWith('save-redmine-url', 'http://new.com')
    })

    it('saveSettings with empty key removes from secureStore', async () => {
        const { result } = renderHook(() => useSettings())

        await act(async () => {
            await result.current.saveSettings('http://new.com', '')
        })

        expect(mockSecureStore.remove).toHaveBeenCalledWith('redmineAPIKey')
        expect(localStorage.getItem('hasSecureKey')).toBeNull()
    })

    it('setRefreshInterval updates state and persists', () => {
        const { result } = renderHook(() => useSettings())

        act(() => {
            result.current.setRefreshInterval(600)
        })

        expect(result.current.refreshInterval).toBe(600)
        expect(localStorage.getItem('refreshInterval')).toBe('600')
    })

    it('setAppTheme updates state and persists', () => {
        const { result } = renderHook(() => useSettings())

        act(() => {
            result.current.setAppTheme('light')
        })

        expect(result.current.appTheme).toBe('light')
        expect(localStorage.getItem('appTheme')).toBe('light')
    })

    it('setShowBadge updates state and persists', () => {
        const { result } = renderHook(() => useSettings())

        act(() => {
            result.current.setShowBadge(true)
        })

        expect(result.current.showBadge).toBe(true)
        expect(localStorage.getItem('showBadge')).toBe('true')
    })
})
