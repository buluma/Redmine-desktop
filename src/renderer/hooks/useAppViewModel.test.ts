import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useAppViewModel } from './useAppViewModel'
import { RedmineService } from '../services/RedmineService'

// Prevent real network calls from the effects useAppViewModel fires once a
// service is configured (loadInitialData, refreshIssues, etc.) — this test
// only cares about the service instance being exposed, not what it fetches.
const emptyResponse = {
    data: {
        projects: [],
        versions: [],
        users: [],
        memberships: [],
        issue_statuses: [],
        issue_priorities: [],
        issues: [],
        total_count: 0,
        user: {},
        issue: {},
    },
}
vi.mock('axios', () => ({
    default: {
        create: () => ({
            get: vi.fn().mockResolvedValue(emptyResponse),
            post: vi.fn().mockResolvedValue(emptyResponse),
            put: vi.fn().mockResolvedValue(emptyResponse),
            delete: vi.fn().mockResolvedValue(emptyResponse),
        }),
    },
}))

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

describe('useAppViewModel', () => {
    beforeEach(() => {
        while (localStorage.length > 0) {
            const key = localStorage.key(0)
            if (key) localStorage.removeItem(key)
        }
        vi.clearAllMocks()
    })

    it('exposes a null service when Redmine is not configured', () => {
        const { result } = renderHook(() => useAppViewModel())

        expect(result.current.service).toBeNull()
    })

    it('exposes a real RedmineService instance once configured, for offline sync to use', async () => {
        const { result } = renderHook(() => useAppViewModel())

        await act(async () => {
            await result.current.saveSettings('http://redmine.example.com', 'api-key-123')
        })

        await waitFor(() => {
            expect(result.current.service).toBeInstanceOf(RedmineService)
        })
        expect(typeof result.current.service!.updateIssue).toBe('function')
    })
})
