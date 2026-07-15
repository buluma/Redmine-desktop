import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useOffline } from './useOffline'
import * as OfflineQueue from '../services/OfflineQueue'
import { Issue } from '../models/redmine'

// Mock OfflineQueue
vi.mock('../services/OfflineQueue', () => ({
    getPendingCount: vi.fn().mockResolvedValue(0),
    clearStaleMutations: vi.fn().mockResolvedValue(0),
    processQueue: vi.fn().mockResolvedValue({ succeeded: 0, failed: 0, remaining: 0 }),
    getPendingMutations: vi.fn().mockResolvedValue([]),
    removeMutation: vi.fn().mockResolvedValue(undefined),
    shouldRetry: vi.fn().mockReturnValue(true),
    updateMutationError: vi.fn().mockResolvedValue(undefined),
    getRetryDelay: vi.fn().mockReturnValue(0),
}))

// Mock service
const mockService = {
    updateIssue: vi.fn().mockResolvedValue({}),
} as any

// Mock fetchIssueDetail
const mockFetchIssueDetail = vi.fn().mockResolvedValue({
    id: 1,
    status: { id: 1, name: 'New' },
    priority: { id: 1, name: 'Normal' },
} as Issue)

describe('useOffline', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        // Mock navigator.onLine
        Object.defineProperty(navigator, 'onLine', { value: true, writable: true })
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    it('returns online status', () => {
        const { result } = renderHook(() => useOffline(mockService, mockFetchIssueDetail))
        expect(result.current.isOnline).toBe(true)
    })

    it('returns offline status when navigator.onLine is false', () => {
        Object.defineProperty(navigator, 'onLine', { value: false })
        const { result } = renderHook(() => useOffline(mockService, mockFetchIssueDetail))
        expect(result.current.isOnline).toBe(false)
    })

    it('initializes pending count from queue', async () => {
        vi.mocked(OfflineQueue.getPendingCount).mockResolvedValue(5)
        
        const { result } = renderHook(() => useOffline(mockService, mockFetchIssueDetail))
        
        // Wait for the async initialization
        await act(async () => {
            await new Promise(resolve => setTimeout(resolve, 0))
        })
        
        expect(result.current.pendingCount).toBe(5)
    })

    it('refreshPendingCount updates the count', async () => {
        vi.mocked(OfflineQueue.getPendingCount)
            .mockResolvedValueOnce(0)
            .mockResolvedValueOnce(3)
        
        const { result } = renderHook(() => useOffline(mockService, mockFetchIssueDetail))
        
        await act(async () => {
            await result.current.refreshPendingCount()
        })
        
        expect(result.current.pendingCount).toBe(3)
    })

    it('isProcessingQueue is initially false', () => {
        const { result } = renderHook(() => useOffline(mockService, mockFetchIssueDetail))
        expect(result.current.isProcessingQueue).toBe(false)
    })
})

describe('useOffline - Online/Offline Events', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        Object.defineProperty(navigator, 'onLine', { value: true, writable: true })
    })

    it('updates isOnline when going offline', async () => {
        const { result } = renderHook(() => useOffline(mockService, mockFetchIssueDetail))
        
        expect(result.current.isOnline).toBe(true)
        
        act(() => {
            window.dispatchEvent(new Event('offline'))
        })
        
        expect(result.current.isOnline).toBe(false)
    })

    it('updates isOnline when coming back online', async () => {
        Object.defineProperty(navigator, 'onLine', { value: false })

        const { result } = renderHook(() => useOffline(mockService, mockFetchIssueDetail))

        expect(result.current.isOnline).toBe(false)

        act(() => {
            Object.defineProperty(navigator, 'onLine', { value: true })
            window.dispatchEvent(new Event('online'))
        })

        expect(result.current.isOnline).toBe(true)
    })

    it('does not process the queue twice concurrently on a flapping reconnect', async () => {
        vi.useFakeTimers()
        // Hold the first processQueue run "in flight" (mimicking a real, slow sync)
        // so a second reconnect while it's still running can be observed as a no-op.
        let resolveClear: () => void = () => {}
        const inFlight = new Promise<number>(resolve => { resolveClear = () => resolve(0) })
        vi.mocked(OfflineQueue.clearStaleMutations).mockReturnValueOnce(inFlight)

        try {
            renderHook(() => useOffline(mockService, mockFetchIssueDetail))

            // First reconnect: fires, starts processQueue, which is now stuck awaiting `inFlight`.
            act(() => {
                window.dispatchEvent(new Event('online'))
            })
            await act(async () => {
                await vi.advanceTimersByTimeAsync(1000)
            })

            // Flapping reconnect while the first run is still in flight.
            act(() => {
                window.dispatchEvent(new Event('online'))
            })
            await act(async () => {
                await vi.advanceTimersByTimeAsync(1000)
            })

            // Let the first run finish.
            await act(async () => {
                resolveClear()
                await Promise.resolve()
                await Promise.resolve()
            })

            expect(vi.mocked(OfflineQueue.getPendingMutations)).toHaveBeenCalledTimes(1)
        } finally {
            vi.mocked(OfflineQueue.clearStaleMutations).mockResolvedValue(0)
            vi.useRealTimers()
        }
    })

    it('paces a retried mutation by getRetryDelay instead of retrying immediately', async () => {
        vi.useFakeTimers()
        try {
            const retriedMutation = {
                id: 1,
                type: 'update' as const,
                endpoint: '/issues/1.json',
                method: 'PUT' as const,
                issueId: 1,
                timestamp: Date.now(),
                retryCount: 1, // already failed once -- this is a retry, not a first attempt
            }
            vi.mocked(OfflineQueue.getPendingMutations).mockResolvedValue([retriedMutation])
            vi.mocked(OfflineQueue.getRetryDelay).mockReturnValue(5000)

            renderHook(() => useOffline(mockService, mockFetchIssueDetail))

            act(() => {
                window.dispatchEvent(new Event('online'))
            })
            // Fire the existing 1s "process after reconnect" delay.
            await act(async () => {
                await vi.advanceTimersByTimeAsync(1000)
            })

            // Backoff for this retry hasn't elapsed yet -- must not have executed.
            expect(mockService.updateIssue).not.toHaveBeenCalled()
            expect(vi.mocked(OfflineQueue.getRetryDelay)).toHaveBeenCalledWith(1)

            // Now let the backoff delay elapse.
            await act(async () => {
                await vi.advanceTimersByTimeAsync(5000)
            })

            expect(mockService.updateIssue).toHaveBeenCalledWith(1, undefined)
        } finally {
            vi.mocked(OfflineQueue.getPendingMutations).mockResolvedValue([])
            vi.mocked(OfflineQueue.getRetryDelay).mockReturnValue(0)
            vi.useRealTimers()
        }
    })
})
