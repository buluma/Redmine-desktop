import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useIssues } from './useIssues'
import { Issue } from '../models/redmine'
import { RedmineService } from '../services/RedmineService'

// Mock the IndexedDB-backed cache so we can control the timing of the
// cache-load effect relative to a network refresh.
vi.mock('../services/IssueCache', () => ({
    migrateFromLocalStorage: vi.fn().mockResolvedValue(0),
    getAllIssues: vi.fn(),
    getMeta: vi.fn().mockResolvedValue(null),
    saveIssues: vi.fn().mockResolvedValue(undefined),
    saveMeta: vi.fn().mockResolvedValue(undefined),
}))

import * as IssueCache from '../services/IssueCache'

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

        const mockService = {
            fetchIssues: vi.fn().mockResolvedValue({ issues: [freshNetworkIssue], total_count: 1 }),
        } as unknown as RedmineService

        const { result } = renderHook(() => useIssues())

        // Network refresh finishes first and populates allIssues.
        await act(async () => {
            await result.current.refreshIssues(mockService, new Set([1]))
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
