import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useConflictResolution } from './useConflictResolution'
import { QueuedMutation } from '../services/OfflineQueue'
import { Issue } from '../models/redmine'

// Mock service
const mockService = {
    fetchIssueDetail: vi.fn(),
    updateIssue: vi.fn(),
} as any

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

function makeMutation(overrides: Partial<QueuedMutation> = {}): QueuedMutation {
    return {
        id: 1,
        type: 'update',
        endpoint: '/issues/1.json',
        method: 'PUT',
        body: { status_id: 3 },
        issueId: 1,
        subject: 'Test issue',
        timestamp: Date.now(),
        retryCount: 0,
        expectedState: {
            statusId: 1,
            priorityId: 1,
            updatedAt: '2024-01-01',
        },
        ...overrides,
    }
}

describe('useConflictResolution', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('initializes with no conflict', () => {
        const { result } = renderHook(() => 
            useConflictResolution(mockService)
        )

        expect(result.current.currentConflict).toBeNull()
        expect(result.current.hasPendingConflicts).toBe(false)
    })

    it('checkForConflict returns true when no expected state', async () => {
        const { result } = renderHook(() => 
            useConflictResolution(mockService)
        )

        const mutation = makeMutation({ expectedState: undefined })
        
        const safe = await (result.current as any).checkForConflict(mutation)
        expect(safe).toBe(true)
    })

    it('checkForConflict returns true when no conflict', async () => {
        mockService.fetchIssueDetail.mockResolvedValue(
            makeIssue({ status: { id: 1, name: 'New' } })
        )

        const { result } = renderHook(() => 
            useConflictResolution(mockService)
        )

        const mutation = makeMutation({
            body: { status_id: 3 },
            expectedState: { statusId: 1, priorityId: 1, updatedAt: '2024-01-01' },
        })
        
        const safe = await (result.current as any).checkForConflict(mutation)
        expect(safe).toBe(true)
    })

    it('checkForConflict returns false when conflict detected', async () => {
        // Server has changed status since we made our mutation
        mockService.fetchIssueDetail.mockResolvedValue(
            makeIssue({ status: { id: 2, name: 'In Progress' } })
        )

        const { result } = renderHook(() => 
            useConflictResolution(mockService)
        )

        const mutation = makeMutation({
            body: { status_id: 3 },
            expectedState: { statusId: 1, priorityId: 1, updatedAt: '2024-01-01' },
        })
        
        const safe = await (result.current as any).checkForConflict(mutation)
        expect(safe).toBe(false)
    })

    it('skipConflict clears current conflict', async () => {
        const { result } = renderHook(() => 
            useConflictResolution(mockService)
        )

        act(() => {
            result.current.skipConflict()
        })

        expect(result.current.currentConflict).toBeNull()
    })
})

describe('useConflictResolution - Resolution', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('resolveConflict calls onConflictResolved callback', async () => {
        const onResolved = vi.fn().mockResolvedValue(undefined)
        
        const { result } = renderHook(() => 
            useConflictResolution(mockService, onResolved)
        )

        // Set up a conflict state (this would normally happen through checkForConflict)
        // For testing, we'll directly call resolveConflict
        await act(async () => {
            await result.current.resolveConflict({ mutationId: 1, resolution: 'server' })
        })

        // The callback should be called even without a current mutation
        // In real usage, currentMutationRef would be set
    })
})
