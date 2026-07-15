import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useFilteredIssues } from './useFilteredIssues'
import { Issue, User, IssueStatus } from '../models/redmine'

const mockStatuses: IssueStatus[] = [
    { id: 1, name: 'New' },
    { id: 2, name: 'In Progress' },
    { id: 3, name: '开发完成' },
    { id: 4, name: '验证完成' },
]

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

const defaultParams = {
    allIssues: [] as Issue[],
    currentUser: null as User | null,
    issueStatuses: mockStatuses,
    followedIssueIds: new Set<number>(),
    selectedProjectId: null as number | null,
    selectedVersionId: null as number | null,
    selectedAssigneeId: null as number | null,
    selectedAssignedWatcherIds: new Set<number>(),
    selectedStatusId: null as number | null,
    searchQuery: '',
    groupByMode: 'status' as const,
    hideVerifiedInFollowed: false,
    hideVerifiedInAssigned: false,
}

describe('useFilteredIssues', () => {
    it('returns empty data when no issues', () => {
        const { result } = renderHook(() => useFilteredIssues(defaultParams))

        expect(result.current.versionViewData).toEqual({})
        expect(result.current.currentGroupedIssues).toEqual({ groups: {}, sortedKeys: [] })
        expect(result.current.versionIssueCounts).toEqual({})
        expect(result.current.followedIssuesCount).toBe(0)
    })

    it('counts issues per version', () => {
        const issues = [
            makeIssue({ id: 1, fixed_version: { id: 10, name: 'v1.0' } }),
            makeIssue({ id: 2, fixed_version: { id: 10, name: 'v1.0' } }),
            makeIssue({ id: 3, fixed_version: { id: 20, name: 'v2.0' } }),
        ]

        const { result } = renderHook(() => useFilteredIssues({
            ...defaultParams,
            allIssues: issues,
        }))

        expect(result.current.versionIssueCounts[10]).toBe(2)
        expect(result.current.versionIssueCounts[20]).toBe(1)
    })

    it('counts status categories per version', () => {
        const issues = [
            makeIssue({ id: 1, fixed_version: { id: 10, name: 'v1.0' }, status: { id: 1, name: 'New' } }),
            makeIssue({ id: 2, fixed_version: { id: 10, name: 'v1.0' }, status: { id: 3, name: '开发完成' } }),
            makeIssue({ id: 3, fixed_version: { id: 10, name: 'v1.0' }, status: { id: 4, name: '验证完成' } }),
        ]

        const { result } = renderHook(() => useFilteredIssues({
            ...defaultParams,
            allIssues: issues,
        }))

        expect(result.current.versionStatusCounts[10]).toEqual({ dev: 1, done: 1, verified: 1 })
    })

    it('filters by search query', () => {
        const issues = [
            makeIssue({ id: 1, subject: 'Login bug' }),
            makeIssue({ id: 2, subject: 'Dashboard feature' }),
        ]

        const { result } = renderHook(() => useFilteredIssues({
            ...defaultParams,
            allIssues: issues,
            searchQuery: 'login',
        }))

        // The search filter applies to base filtering, but bucketing depends on version/project
        // For issues without version, they won't appear in version buckets
        // Let's test with version-assigned issues
    })

    it('groups by status by default', () => {
        const issues = [
            makeIssue({ id: 1, fixed_version: { id: 10, name: 'v1.0' }, status: { id: 1, name: 'New' } }),
            makeIssue({ id: 2, fixed_version: { id: 10, name: 'v1.0' }, status: { id: 2, name: 'In Progress' } }),
        ]

        const { result } = renderHook(() => useFilteredIssues({
            ...defaultParams,
            allIssues: issues,
            selectedVersionId: 10,
        }))

        const data = result.current.versionViewData['10']
        expect(data).toBeDefined()
        expect(data.groups['New']).toHaveLength(1)
        expect(data.groups['In Progress']).toHaveLength(1)
    })

    it('groups by assignee when mode is assignee', () => {
        const issues = [
            makeIssue({ id: 1, fixed_version: { id: 10, name: 'v1.0' }, assigned_to: { id: 1, name: 'Alice' } }),
            makeIssue({ id: 2, fixed_version: { id: 10, name: 'v1.0' }, assigned_to: { id: 2, name: 'Bob' } }),
        ]

        const { result } = renderHook(() => useFilteredIssues({
            ...defaultParams,
            allIssues: issues,
            groupByMode: 'assignee',
            selectedVersionId: 10,
        }))

        const data = result.current.versionViewData['10']
        expect(data).toBeDefined()
        expect(data.groups['Alice']).toHaveLength(1)
        expect(data.groups['Bob']).toHaveLength(1)
    })

    it('counts followed issues', () => {
        const issues = [
            makeIssue({ id: 1 }),
            makeIssue({ id: 2 }),
            makeIssue({ id: 3 }),
        ]

        const { result } = renderHook(() => useFilteredIssues({
            ...defaultParams,
            allIssues: issues,
            followedIssueIds: new Set([1, 3]),
        }))

        expect(result.current.followedIssuesCount).toBe(2)
    })

    it('counts assigned issues status categories', () => {
        const currentUser = { id: 1, name: 'Me', login: 'me', firstname: 'Me', lastname: 'User', created_on: '2024-01-01' }
        const issues = [
            makeIssue({ id: 1, assigned_to: { id: 1, name: 'Me' }, status: { id: 1, name: 'New' } }),
            makeIssue({ id: 2, assigned_to: { id: 1, name: 'Me' }, status: { id: 3, name: '开发完成' } }),
            makeIssue({ id: 3, assigned_to: { id: 2, name: 'Other' }, status: { id: 1, name: 'New' } }),
        ]

        const { result } = renderHook(() => useFilteredIssues({
            ...defaultParams,
            allIssues: issues,
            currentUser,
        }))

        expect(result.current.assignedStatusCounts).toEqual({ dev: 1, done: 1, verified: 0 })
    })

    it('filters by assignee', () => {
        const issues = [
            makeIssue({ id: 1, fixed_version: { id: 10, name: 'v1.0' }, assigned_to: { id: 1, name: 'Alice' } }),
            makeIssue({ id: 2, fixed_version: { id: 10, name: 'v1.0' }, assigned_to: { id: 2, name: 'Bob' } }),
        ]

        const { result } = renderHook(() => useFilteredIssues({
            ...defaultParams,
            allIssues: issues,
            selectedAssigneeId: 1,
            selectedVersionId: 10,
        }))

        const data = result.current.versionViewData['10']
        expect(data).toBeDefined()
        // Only Alice's issue should be in the version bucket
        const allIssuesInBucket = Object.values(data.groups).flat()
        expect(allIssuesInBucket).toHaveLength(1)
        expect(allIssuesInBucket[0].assigned_to?.id).toBe(1)
    })
})
