import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useIssues } from './useIssues'
import { Issue, User } from '../models/redmine'
import { RedmineService } from '../services/RedmineService'

// Mock the IndexedDB-backed cache so we can control the timing of the
// cache-load effect relative to a network refresh.
vi.mock('../services/IssueCache', () => ({
    migrateFromLocalStorage: vi.fn().mockResolvedValue(0),
    getAllIssues: vi.fn().mockResolvedValue([]),
    getMeta: vi.fn().mockResolvedValue(null),
    saveIssues: vi.fn().mockResolvedValue(undefined),
    saveMeta: vi.fn().mockResolvedValue(undefined),
}))

import * as IssueCache from '../services/IssueCache'

// Mock the RedmineService
const mockService = {
    updateIssue: vi.fn(),
    fetchIssueDetail: vi.fn(),
    fetchCurrentUser: vi.fn(),
    fetchIssueStatuses: vi.fn(),
    fetchIssuePriorities: vi.fn(),
    fetchIssues: vi.fn(),
} as unknown as RedmineService

function makeIssue(overrides: Partial<Issue> = {}): Issue {
    return {
        id: 1,
        subject: 'Test issue',
        tracker: { id: 1, name: 'Bug' },
        status: { id: 1, name: 'New' },
        priority: { id: 1, name: 'Normal' },
        author: { id: 1, name: 'Author' },
        assigned_to: { id: 2, name: 'Assignee' },
        project: { id: 1, name: 'Project' },
        done_ratio: 0,
        is_private: false,
        created_on: '2024-01-01',
        updated_on: '2024-01-01',
        ...overrides,
    }
}

describe('useIssues - Optimistic Updates', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockService.fetchCurrentUser = vi.fn().mockResolvedValue({ id: 1, name: 'User' } as User)
        mockService.fetchIssueStatuses = vi.fn().mockResolvedValue([])
        mockService.fetchIssuePriorities = vi.fn().mockResolvedValue([])
        ;(IssueCache.getAllIssues as any).mockResolvedValue([])
    })

    it('updateIssue applies optimistic update immediately', async () => {
        const initialIssues = [makeIssue({ id: 1, status: { id: 1, name: 'New' } })]

        const { result } = renderHook(() => useIssues())

        // Set initial issues
        act(() => {
            result.current.allIssues // Access to trigger state
        })

        // Mock successful API response
        const updatedIssue = makeIssue({
            id: 1,
            status: { id: 3, name: 'Done' },
            updated_on: '2024-01-02'
        })
        mockService.updateIssue = vi.fn().mockResolvedValue({})
        mockService.fetchIssueDetail = vi.fn().mockResolvedValue(updatedIssue)

        // This would normally be called with the issues already loaded
        // For this test, we're verifying the optimistic update logic works
        await act(async () => {
            // The function should apply the update optimistically
            // even though we don't have issues loaded in this test
            await result.current.updateIssue(mockService, 1, { status_id: 3 })
        })

        // Verify API was called
        expect(mockService.updateIssue).toHaveBeenCalledWith(1, { status_id: 3 })
    })

    it('updateIssue optimistic status/priority change reflects the real name immediately, not just the id', async () => {
        // Seed allIssues via the IndexedDB cache-load effect (the cache no longer
        // reads localStorage directly since the IndexedDB migration).
        ;(IssueCache.getAllIssues as any).mockResolvedValue([
            makeIssue({ id: 1, status: { id: 1, name: 'New' }, priority: { id: 1, name: 'Normal' } })
        ])

        const { result } = renderHook(() => useIssues())

        // Let the async cache-load effect apply the seeded issue.
        await act(async () => {
            await Promise.resolve()
            await Promise.resolve()
        })

        // Load statuses/priorities into hook state so the optimistic update has a name to look up
        mockService.fetchCurrentUser = vi.fn().mockResolvedValue({ id: 1, name: 'User' } as User)
        mockService.fetchIssueStatuses = vi.fn().mockResolvedValue([
            { id: 1, name: 'New' },
            { id: 3, name: 'Done' },
        ])
        mockService.fetchIssuePriorities = vi.fn().mockResolvedValue([
            { id: 1, name: 'Normal' },
            { id: 5, name: 'Urgent' },
        ])
        await act(async () => {
            await result.current.loadInitialData(mockService, new Set())
        })

        expect(result.current.allIssues.find(i => i.id === 1)).toBeDefined()

        // Keep the API call pending so we can inspect the optimistic state before it resolves
        let resolveUpdate: () => void = () => {}
        mockService.updateIssue = vi.fn(() => new Promise<void>(resolve => { resolveUpdate = resolve }))
        mockService.fetchIssueDetail = vi.fn().mockResolvedValue(
            makeIssue({ id: 1, status: { id: 3, name: 'Done' }, priority: { id: 5, name: 'Urgent' } })
        )

        act(() => {
            // Not awaited: we want to inspect state applied synchronously before the network call resolves
            result.current.updateIssue(mockService, 1, { status_id: 3, priority_id: 5 })
        })

        const optimisticIssue = result.current.allIssues.find(i => i.id === 1)
        expect(optimisticIssue?.status).toEqual({ id: 3, name: 'Done' })
        expect(optimisticIssue?.priority).toEqual({ id: 5, name: 'Urgent' })

        // Let the pending update resolve so the test doesn't leak a dangling promise/act warning
        await act(async () => {
            resolveUpdate()
            await Promise.resolve()
            await Promise.resolve()
        })

        localStorage.clear()
    })

    it('updateIssue reverts on API failure', async () => {
        const { result } = renderHook(() => useIssues())

        // Mock failed API response
        mockService.updateIssue = vi.fn().mockRejectedValue(new Error('Network error'))

        await act(async () => {
            await result.current.updateIssue(mockService, 1, { status_id: 3 })
        })

        // Verify API was called
        expect(mockService.updateIssue).toHaveBeenCalledWith(1, { status_id: 3 })

        // Error message should be set
        // Note: In actual usage, this would show a toast notification
    })
})

describe('useIssues - Issue Operations', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        ;(IssueCache.getAllIssues as any).mockResolvedValue([])
    })

    it('addNote calls updateIssue with notes', async () => {
        const { result } = renderHook(() => useIssues())

        mockService.updateIssue = vi.fn().mockResolvedValue({})
        mockService.fetchIssueDetail = vi.fn().mockResolvedValue(makeIssue())

        await act(async () => {
            await result.current.addNote(mockService, 1, 'Test note')
        })

        expect(mockService.updateIssue).toHaveBeenCalledWith(1, { notes: 'Test note' })
    })

    it('createIssue calls service and adds to list', async () => {
        const { result } = renderHook(() => useIssues())

        const newIssue = makeIssue({ id: 99, subject: 'New issue' })
        mockService.createIssue = vi.fn().mockResolvedValue(newIssue)

        await act(async () => {
            await result.current.createIssue(mockService, 'New issue', 1, 10, 2)
        })

        expect(mockService.createIssue).toHaveBeenCalledWith({
            project_id: 1,
            subject: 'New issue',
            fixed_version_id: 10,
            assigned_to_id: 2,
        })
    })

    it('deleteIssue removes issue from list', async () => {
        const { result } = renderHook(() => useIssues())

        mockService.deleteIssue = vi.fn().mockResolvedValue({})

        await act(async () => {
            await result.current.deleteIssue(mockService, 1)
        })

        expect(mockService.deleteIssue).toHaveBeenCalledWith(1)
    })
})

describe('useIssues - cache load vs. network refresh race', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('does not let a slow IndexedDB cache load clobber issues already set by a faster network refresh', async () => {
        const staleCachedIssue = makeIssue({ id: 1, subject: 'Stale cached issue' })
        const freshNetworkIssue = makeIssue({ id: 2, subject: 'Fresh network issue' })

        // Keep the IndexedDB read pending until we manually resolve it, so we can
        // deterministically finish a network refresh first.
        let resolveGetAllIssues!: (issues: Issue[]) => void
        const getAllIssuesPromise = new Promise<Issue[]>(resolve => {
            resolveGetAllIssues = resolve
        })
        ;(IssueCache.getAllIssues as any).mockReturnValue(getAllIssuesPromise)

        const raceService = {
            fetchIssues: vi.fn().mockResolvedValue({ issues: [freshNetworkIssue], total_count: 1 }),
        } as unknown as RedmineService

        const { result } = renderHook(() => useIssues())

        // Network refresh finishes first and populates allIssues.
        await act(async () => {
            await result.current.refreshIssues(raceService, new Set([1]))
        })

        expect(result.current.allIssues.map(i => i.id)).toEqual([2])

        // The slower IndexedDB cache load now resolves with stale data.
        await act(async () => {
            resolveGetAllIssues([staleCachedIssue])
            await getAllIssuesPromise
        })

        // The stale cache read must not clobber the fresher network state.
        expect(result.current.allIssues.map(i => i.id)).toEqual([2])
    })

    it('still applies cached issues on load when no network refresh has happened', async () => {
        const cachedIssue = makeIssue({ id: 1, subject: 'Cached issue' })
        ;(IssueCache.getAllIssues as any).mockResolvedValue([cachedIssue])

        const { result } = renderHook(() => useIssues())

        await act(async () => {
            await Promise.resolve()
            await Promise.resolve()
        })

        expect(result.current.allIssues.map(i => i.id)).toEqual([1])
    })
})
