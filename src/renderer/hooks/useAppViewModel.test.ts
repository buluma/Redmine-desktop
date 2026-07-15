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
        localStorage.setItem('cachedIssues', JSON.stringify([issueA, issueB]))

        // Active tab is version 10; version 20 is a previously-visited, now-inactive tab.
        localStorage.setItem('lastSelectedVersionId', '10')
    })

    it('refreshes the inactive tab cache when allIssues changes without a filter change', async () => {
        const { result } = renderHook(() => useAppViewModel())

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
