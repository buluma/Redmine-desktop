import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { Issue, User } from '../models/redmine'

// Mock RedmineService so the hook never performs real network I/O.
// Methods resolve to empty/harmless defaults by default; individual tests
// override return values (e.g. fetchIssueDetail) as needed.
const mocks = vi.hoisted(() => {
    return {
        fetchCurrentUser: vi.fn(),
        fetchIssueStatuses: vi.fn(),
        fetchIssuePriorities: vi.fn(),
        fetchProjects: vi.fn(),
        fetchVersions: vi.fn(),
        fetchAssignableUsers: vi.fn(),
        fetchIssues: vi.fn(),
        updateIssue: vi.fn(),
        fetchIssueDetail: vi.fn(),
    }
})

vi.mock('../services/RedmineService', () => ({
    RedmineService: vi.fn().mockImplementation(() => mocks),
}))

// Mock the IndexedDB-backed cache so tests control cache contents directly
// instead of depending on a real (fake-indexeddb) Dexie instance shared across tests.
vi.mock('../services/IssueCache', () => ({
    migrateFromLocalStorage: vi.fn().mockResolvedValue(0),
    getAllIssues: vi.fn().mockResolvedValue([]),
    getMeta: vi.fn().mockResolvedValue(null),
    saveIssues: vi.fn().mockResolvedValue(undefined),
    saveMeta: vi.fn().mockResolvedValue(undefined),
}))

import * as IssueCache from '../services/IssueCache'

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

import { useAppViewModel } from './useAppViewModel'

const mockUser: User = {
    id: 1, login: 'me', firstname: 'Current', lastname: 'User', created_on: '2024-01-01', name: 'Current User',
}

function makeIssue(overrides: Partial<Issue> = {}): Issue {
    return {
        id: 1,
        subject: 'Test issue',
        tracker: { id: 1, name: 'Bug' },
        status: { id: 1, name: 'New' },
        priority: { id: 1, name: 'Normal' },
        author: { id: 1, name: 'Author' },
        done_ratio: 0,
        is_private: false,
        created_on: '2024-01-01',
        updated_on: '2024-01-01',
        ...overrides,
    }
}

describe('useAppViewModel - version view data cache', () => {
    beforeEach(() => {
        localStorage.clear()
        vi.clearAllMocks()

        mocks.fetchCurrentUser.mockResolvedValue(mockUser)
        mocks.fetchIssueStatuses.mockResolvedValue([])
        mocks.fetchIssuePriorities.mockResolvedValue([])
        mocks.fetchProjects.mockResolvedValue([])
        mocks.fetchVersions.mockResolvedValue([])
        mocks.fetchAssignableUsers.mockResolvedValue([])
        // Generic fallback for any fetchIssues call (active-version refresh, followed/assigned lookups).
        // activeVersionIds is empty in this test, so these calls are effectively no-ops.
        mocks.fetchIssues.mockResolvedValue({ issues: [], total_count: 0 })
        mocks.updateIssue.mockResolvedValue(undefined)

        localStorage.setItem('redmineURL', 'http://redmine.test')
        localStorage.setItem('redmineAPIKey', 'test-key')

        const issueA = makeIssue({ id: 100, fixed_version: { id: 10, name: 'v1.0' }, status: { id: 1, name: 'New' } })
        const issueB = makeIssue({ id: 200, fixed_version: { id: 20, name: 'v2.0' }, status: { id: 1, name: 'New' } })
        ;(IssueCache.getAllIssues as any).mockResolvedValue([issueA, issueB])

        // Active tab is version 10; version 20 is a previously-visited, now-inactive tab.
        localStorage.setItem('lastSelectedVersionId', '10')
    })

    it('refreshes the inactive tab cache when allIssues changes without a filter change', async () => {
        const { result } = renderHook(() => useAppViewModel())

        // Let the async IndexedDB cache-load effect apply the seeded issues.
        await waitFor(() => expect(result.current.allIssues.length).toBe(2))

        // Let initial load / mount-time refresh settle.
        await waitFor(() => expect(result.current.isLoading).toBe(false))
        await waitFor(() => expect(result.current.isBackgroundRefreshing).toBe(false))

        // Sanity: active tab (10) and inactive tab (20) both populate the cache.
        expect(result.current.getVersionViewData('10').groups['New']).toHaveLength(1)
        const before = result.current.getVersionViewData('20')
        expect(before.groups['New']).toHaveLength(1)

        // Mutate allIssues (e.g. a status update landing) without touching any filter.
        mocks.fetchIssueDetail.mockResolvedValueOnce(
            makeIssue({ id: 200, fixed_version: { id: 20, name: 'v2.0' }, status: { id: 2, name: 'In Progress' } })
        )
        await act(async () => {
            await result.current.updateIssue(200, { status_id: 2 })
        })

        // The inactive tab's cached data must reflect the mutation, not the stale snapshot.
        const after = result.current.getVersionViewData('20')
        expect(after.groups['New']).toBeUndefined()
        expect(after.groups['In Progress']).toHaveLength(1)
    })
})

describe('useAppViewModel - optimistic updates', () => {
    beforeEach(() => {
        localStorage.clear()
        vi.clearAllMocks()

        mocks.fetchCurrentUser.mockResolvedValue(mockUser)
        mocks.fetchIssueStatuses.mockResolvedValue([
            { id: 1, name: 'New' },
            { id: 3, name: 'Done' },
        ])
        mocks.fetchIssuePriorities.mockResolvedValue([
            { id: 1, name: 'Normal' },
            { id: 5, name: 'Urgent' },
        ])
        mocks.fetchProjects.mockResolvedValue([])
        mocks.fetchVersions.mockResolvedValue([])
        mocks.fetchAssignableUsers.mockResolvedValue([])
        mocks.fetchIssues.mockResolvedValue({ issues: [], total_count: 0 })

        localStorage.setItem('redmineURL', 'http://redmine.test')
        localStorage.setItem('redmineAPIKey', 'test-key')
        ;(IssueCache.getAllIssues as any).mockResolvedValue([
            makeIssue({ id: 1, status: { id: 1, name: 'New' }, priority: { id: 1, name: 'Normal' } })
        ])
    })

    it('applies the optimistic status/priority change with the real name immediately, not just the id', async () => {
        const { result } = renderHook(() => useAppViewModel())

        await waitFor(() => expect(result.current.isLoading).toBe(false))
        await waitFor(() => expect(result.current.allIssues.find(i => i.id === 1)).toBeDefined())

        // Keep the API call pending so we can inspect the optimistic state before it resolves.
        let resolveUpdate: () => void = () => {}
        mocks.updateIssue.mockReturnValue(new Promise<void>(resolve => { resolveUpdate = resolve }))
        mocks.fetchIssueDetail.mockResolvedValue(
            makeIssue({ id: 1, status: { id: 3, name: 'Done' }, priority: { id: 5, name: 'Urgent' } })
        )

        act(() => {
            // Not awaited: we want to inspect state applied synchronously before the network call resolves.
            result.current.updateIssue(1, { status_id: 3, priority_id: 5 })
        })

        const optimisticIssue = result.current.allIssues.find(i => i.id === 1)
        expect(optimisticIssue?.status).toEqual({ id: 3, name: 'Done' })
        expect(optimisticIssue?.priority).toEqual({ id: 5, name: 'Urgent' })

        await act(async () => {
            resolveUpdate()
            await Promise.resolve()
            await Promise.resolve()
        })
    })

    it('reverts the optimistic update if the API call fails', async () => {
        const { result } = renderHook(() => useAppViewModel())

        await waitFor(() => expect(result.current.isLoading).toBe(false))
        await waitFor(() => expect(result.current.allIssues.find(i => i.id === 1)?.status).toEqual({ id: 1, name: 'New' }))

        mocks.updateIssue.mockRejectedValue(new Error('Network error'))

        await act(async () => {
            await result.current.updateIssue(1, { status_id: 3 })
        })

        // Reverted back to the pre-optimistic state on failure.
        expect(result.current.allIssues.find(i => i.id === 1)?.status).toEqual({ id: 1, name: 'New' })
    })

    it('does not let one update\'s rollback or success clobber a different concurrent update\'s field', async () => {
        const { result } = renderHook(() => useAppViewModel())

        await waitFor(() => expect(result.current.isLoading).toBe(false))
        await waitFor(() => expect(result.current.allIssues.find(i => i.id === 1)).toBeDefined())

        // Call A: status change, kept pending.
        let resolveA: () => void = () => {}
        let rejectA: (e: Error) => void = () => {}
        const pendingA = new Promise<void>((resolve, reject) => { resolveA = resolve; rejectA = reject })
        // Call B: priority change, kept pending separately.
        let resolveB: () => void = () => {}
        const pendingB = new Promise<void>(resolve => { resolveB = resolve })

        mocks.updateIssue.mockReturnValueOnce(pendingA).mockReturnValueOnce(pendingB)

        act(() => {
            // Neither awaited: both optimistic updates apply, both network calls pending.
            result.current.updateIssue(1, { status_id: 3 })
        })
        act(() => {
            result.current.updateIssue(1, { priority_id: 5 })
        })

        let issue = result.current.allIssues.find(i => i.id === 1)
        expect(issue?.status).toEqual({ id: 3, name: 'Done' })
        expect(issue?.priority).toEqual({ id: 5, name: 'Urgent' })

        // B's network call succeeds first. The server snapshot it fetches doesn't
        // know about A's not-yet-applied status change (still "New" server-side).
        mocks.fetchIssueDetail.mockResolvedValueOnce(
            makeIssue({ id: 1, status: { id: 1, name: 'New' }, priority: { id: 5, name: 'Urgent' } })
        )
        await act(async () => {
            resolveB()
            await pendingB
            await Promise.resolve()
            await Promise.resolve()
        })

        // B's success must not stomp A's still-in-flight optimistic status.
        issue = result.current.allIssues.find(i => i.id === 1)
        expect(issue?.status).toEqual({ id: 3, name: 'Done' })
        expect(issue?.priority).toEqual({ id: 5, name: 'Urgent' })

        // A's network call now fails.
        await act(async () => {
            rejectA(new Error('Network error'))
            await pendingA.catch(() => {})
            await Promise.resolve()
            await Promise.resolve()
        })

        // A's rollback must only revert status (its own field), not B's already-applied priority.
        issue = result.current.allIssues.find(i => i.id === 1)
        expect(issue?.status).toEqual({ id: 1, name: 'New' })
        expect(issue?.priority).toEqual({ id: 5, name: 'Urgent' })
    })

    it('applies the optimistic assignee/version change with the real name immediately, not a blank one', async () => {
        mocks.fetchProjects.mockResolvedValue([{ id: 1, name: 'Project One' }])
        mocks.fetchAssignableUsers.mockResolvedValue([{ id: 7, name: 'Alice', groups: [] }])
        mocks.fetchVersions.mockResolvedValue([
            { id: 10, project: { id: 1, name: 'Project One' }, name: 'v1.0', status: 'open', created_on: '2024-01-01', updated_on: '2024-01-01' },
        ])
        ;(IssueCache.getAllIssues as any).mockResolvedValue([
            makeIssue({ id: 1, project: { id: 1, name: 'Project One' } })
        ])

        const { result } = renderHook(() => useAppViewModel())

        await waitFor(() => expect(result.current.isLoading).toBe(false))
        await waitFor(() => expect(result.current.allIssues.find(i => i.id === 1)).toBeDefined())
        // Wait for loadInitialData's per-project fetch of members/versions to land.
        await waitFor(() => expect(result.current.projectMembersMap[1]).toBeDefined())
        await waitFor(() => expect(result.current.projectVersionsMap[1]).toBeDefined())

        let resolveUpdate: () => void = () => {}
        mocks.updateIssue.mockReturnValue(new Promise<void>(resolve => { resolveUpdate = resolve }))
        mocks.fetchIssueDetail.mockResolvedValue(
            makeIssue({
                id: 1,
                project: { id: 1, name: 'Project One' },
                assigned_to: { id: 7, name: 'Alice' },
                fixed_version: { id: 10, name: 'v1.0' },
            })
        )

        act(() => {
            result.current.updateIssue(1, { assigned_to_id: '7', fixed_version_id: '10' })
        })

        const optimisticIssue = result.current.allIssues.find(i => i.id === 1)
        expect(optimisticIssue?.assigned_to).toEqual({ id: 7, name: 'Alice' })
        expect(optimisticIssue?.fixed_version).toEqual({ id: 10, name: 'v1.0' })

        await act(async () => {
            resolveUpdate()
            await Promise.resolve()
            await Promise.resolve()
        })
    })
})

describe('useAppViewModel - secure API key storage', () => {
    beforeEach(() => {
        localStorage.clear()
        vi.clearAllMocks()
        mockSecureStore.store.mockResolvedValue(true)
        mockSecureStore.retrieve.mockResolvedValue(null)
        mockSecureStore.remove.mockResolvedValue(true)

        mocks.fetchCurrentUser.mockResolvedValue(mockUser)
        mocks.fetchIssueStatuses.mockResolvedValue([])
        mocks.fetchIssuePriorities.mockResolvedValue([])
        mocks.fetchProjects.mockResolvedValue([])
    })

    it('migrates a legacy plaintext API key into secure storage and clears it from localStorage', async () => {
        localStorage.setItem('redmineURL', 'http://redmine.test')
        localStorage.setItem('redmineAPIKey', 'legacy-plaintext-key')

        renderHook(() => useAppViewModel())

        await waitFor(() => {
            expect(mockSecureStore.store).toHaveBeenCalledWith('redmineAPIKey', 'legacy-plaintext-key')
        })
        await waitFor(() => {
            expect(localStorage.getItem('redmineAPIKey')).toBeNull()
        })
        expect(localStorage.getItem('hasSecureKey')).toBe('true')
    })

    it('clears any leftover plaintext key once the secure key has loaded', async () => {
        localStorage.setItem('redmineURL', 'http://redmine.test')
        localStorage.setItem('hasSecureKey', 'true')
        localStorage.setItem('redmineAPIKey', 'stale-plaintext-copy')
        mockSecureStore.retrieve.mockResolvedValue('secure-key-value')

        renderHook(() => useAppViewModel())

        await waitFor(() => {
            expect(localStorage.getItem('redmineAPIKey')).toBeNull()
        })
    })

    it('saveSettings stores the key via secureStore, not plaintext localStorage', async () => {
        const { result } = renderHook(() => useAppViewModel())

        await act(async () => {
            await result.current.saveSettings('http://redmine.test', 'new-api-key')
        })

        expect(mockSecureStore.store).toHaveBeenCalledWith('redmineAPIKey', 'new-api-key')
        expect(localStorage.getItem('hasSecureKey')).toBe('true')
    })
})

describe('useAppViewModel - IndexedDB issue cache', () => {
    beforeEach(() => {
        localStorage.clear()
        vi.clearAllMocks()
        ;(IssueCache.getAllIssues as any).mockResolvedValue([])
        ;(IssueCache.migrateFromLocalStorage as any).mockResolvedValue(0)
        ;(IssueCache.getMeta as any).mockResolvedValue(null)

        mocks.fetchCurrentUser.mockResolvedValue(mockUser)
        mocks.fetchIssueStatuses.mockResolvedValue([])
        mocks.fetchIssuePriorities.mockResolvedValue([])
        mocks.fetchProjects.mockResolvedValue([])
        mocks.fetchVersions.mockResolvedValue([])
        mocks.fetchAssignableUsers.mockResolvedValue([])
        mocks.fetchIssues.mockResolvedValue({ issues: [], total_count: 0 })

        localStorage.setItem('redmineURL', 'http://redmine.test')
        localStorage.setItem('hasSecureKey', 'true')
        mockSecureStore.retrieve.mockResolvedValue('test-key')
    })

    it('migrates legacy localStorage issues into IndexedDB on mount', async () => {
        renderHook(() => useAppViewModel())

        await waitFor(() => {
            expect(IssueCache.migrateFromLocalStorage).toHaveBeenCalled()
        })
    })

    it('loads cached issues from IndexedDB on mount', async () => {
        const cachedIssue = makeIssue({ id: 1, subject: 'Cached issue' })
        ;(IssueCache.getAllIssues as any).mockResolvedValue([cachedIssue])

        const { result } = renderHook(() => useAppViewModel())

        await waitFor(() => {
            expect(result.current.allIssues.map(i => i.id)).toEqual([1])
        })
    })

    it('does not let a slow IndexedDB cache load clobber issues already set by a faster network refresh', async () => {
        const staleCachedIssue = makeIssue({ id: 1, subject: 'Stale cached issue' })
        const freshNetworkIssue = makeIssue({ id: 2, subject: 'Fresh network issue' })

        let resolveGetAllIssues!: (issues: Issue[]) => void
        const getAllIssuesPromise = new Promise<Issue[]>(resolve => {
            resolveGetAllIssues = resolve
        })
        ;(IssueCache.getAllIssues as any).mockReturnValue(getAllIssuesPromise)
        mocks.fetchIssues.mockResolvedValue({ issues: [freshNetworkIssue], total_count: 1 })
        localStorage.setItem('cachedActiveVersionIds', JSON.stringify([1]))

        const { result } = renderHook(() => useAppViewModel())

        // Network refresh finishes first and populates allIssues.
        await waitFor(() => {
            expect(result.current.allIssues.map(i => i.id)).toEqual([2])
        })

        // The slower IndexedDB cache load now resolves with stale data.
        await act(async () => {
            resolveGetAllIssues([staleCachedIssue])
            await getAllIssuesPromise
        })

        // The stale cache read must not clobber the fresher network state.
        expect(result.current.allIssues.map(i => i.id)).toEqual([2])
    })
})

describe('useAppViewModel - All Projects view (default state)', () => {
    beforeEach(() => {
        localStorage.clear()
        vi.clearAllMocks()

        mocks.fetchCurrentUser.mockResolvedValue(mockUser)
        mocks.fetchIssueStatuses.mockResolvedValue([])
        mocks.fetchIssuePriorities.mockResolvedValue([])
        mocks.fetchProjects.mockResolvedValue([])
        mocks.fetchVersions.mockResolvedValue([])
        mocks.fetchAssignableUsers.mockResolvedValue([])
        mocks.fetchIssues.mockResolvedValue({ issues: [], total_count: 0 })

        localStorage.setItem('redmineURL', 'http://redmine.test')
        localStorage.setItem('redmineAPIKey', 'test-key')
        // No lastSelectedProjectId/lastSelectedVersionId set: this is a fresh
        // install's default state, selectedProjectId defaults to -1 (All Projects).
        ;(IssueCache.getAllIssues as any).mockResolvedValue([
            makeIssue({ id: 1, project: { id: 10, name: 'Project A' } }),
            makeIssue({ id: 2, project: { id: 20, name: 'Project B' } }),
        ])
    })

    it('shows issues from every project, not an empty list, when no project/version is selected', async () => {
        const { result } = renderHook(() => useAppViewModel())

        await waitFor(() => expect(result.current.isLoading).toBe(false))
        await waitFor(() => expect(result.current.allIssues.length).toBe(2))

        expect(result.current.selectedProjectId).toBe(-1)
        const allIssueIds = Object.values(result.current.groupedIssues.groups).flat().map((i: any) => i.id)
        expect(allIssueIds.sort()).toEqual([1, 2])
    })
})

describe('useAppViewModel - tray status counts', () => {
    beforeEach(() => {
        localStorage.clear()
        vi.clearAllMocks()

        mocks.fetchIssuePriorities.mockResolvedValue([])
        mocks.fetchProjects.mockResolvedValue([])
        mocks.fetchVersions.mockResolvedValue([])
        mocks.fetchAssignableUsers.mockResolvedValue([])

        localStorage.setItem('redmineURL', 'http://redmine.test')
        localStorage.setItem('redmineAPIKey', 'test-key')
    })

    it('sends per-status counts of all my assigned issues to the tray, ordered by the server workflow order', async () => {
        const me: User = { id: 1, login: 'me', firstname: 'Michael', lastname: 'B', created_on: '2024-01-01', name: 'Michael' }
        mocks.fetchCurrentUser.mockResolvedValue(me)
        mocks.fetchIssueStatuses.mockResolvedValue([
            { id: 1, name: 'New' },
            { id: 2, name: 'In Progress' },
            { id: 3, name: 'Resolved' },
        ])

        const assignedIssues = [
            makeIssue({ id: 1, status: { id: 1, name: 'New' }, assigned_to: { id: 1, name: 'Michael' } }),
            makeIssue({ id: 2, status: { id: 1, name: 'New' }, assigned_to: { id: 1, name: 'Michael' } }),
            makeIssue({ id: 3, status: { id: 3, name: 'Resolved' }, assigned_to: { id: 1, name: 'Michael' } }),
            makeIssue({ id: 4, status: { id: 2, name: 'In Progress' }, assigned_to: { id: 1, name: 'Michael' } }),
        ]
        const notMine = makeIssue({ id: 5, status: { id: 1, name: 'New' }, assigned_to: { id: 99, name: 'Someone else' } })
        ;(IssueCache.getAllIssues as any).mockResolvedValue([...assignedIssues, notMine])
        // refreshIssues' post-load cleanup pass drops any previously-assigned/followed issue
        // that the fresh watcher_id/assigned_to_id fetch doesn't also return, so it doesn't
        // silently purge our seeded cache issues as "no longer assigned" before the test asserts.
        mocks.fetchIssues.mockResolvedValue({ issues: assignedIssues, total_count: assignedIssues.length })

        renderHook(() => useAppViewModel())

        await waitFor(() => {
            const calls = (window as any).ipcRenderer.send.mock.calls.filter((c: any[]) => c[0] === 'update-tray-status-counts')
            const last = calls[calls.length - 1]
            expect(last?.[1]?.length).toBeGreaterThan(0)
        })

        const calls = (window as any).ipcRenderer.send.mock.calls.filter((c: any[]) => c[0] === 'update-tray-status-counts')
        const lastPayload = calls[calls.length - 1][1]

        // Excludes the issue not assigned to me; ordered to match issueStatuses (server workflow order).
        expect(lastPayload).toEqual([
            { statusId: 1, statusName: 'New', count: 2 },
            { statusId: 2, statusName: 'In Progress', count: 1 },
            { statusId: 3, statusName: 'Resolved', count: 1 },
        ])
    })
})
