import { useState, useCallback, useRef } from 'react'
import { QueuedMutation } from '../services/OfflineQueue'
import { ConflictInfo, detectConflict, autoMerge, ConflictResolution } from '../services/ConflictResolver'
import { RedmineService } from '../services/RedmineService'
import { Issue } from '../models/redmine'

interface UseConflictResolutionReturn {
    currentConflict: ConflictInfo | null
    resolveConflict: (resolution: ConflictResolution) => Promise<void>
    skipConflict: () => void
    hasPendingConflicts: boolean
}

export function useConflictResolution(
    service: RedmineService | null,
    onConflictResolved?: (mutation: QueuedMutation, resolution: ConflictResolution) => Promise<void>
): UseConflictResolutionReturn {
    const [currentConflict, setCurrentConflict] = useState<ConflictInfo | null>(null)
    const conflictQueueRef = useRef<Array<{ mutation: QueuedMutation; conflict: ConflictInfo }>>([])
    const currentMutationRef = useRef<QueuedMutation | null>(null)

    /**
     * Check a mutation for conflicts before applying
     * Returns true if safe to proceed, false if conflict detected
     */
    const checkForConflict = useCallback(async (mutation: QueuedMutation): Promise<boolean> => {
        if (!service || mutation.type !== 'update') {
            return true // Can't check conflicts for non-update mutations
        }

        try {
            // Fetch current server state
            const serverIssue = await service.fetchIssueDetail(mutation.issueId)
            
            // Convert expected state format
            const expectedState: Issue | null = mutation.expectedState ? {
                id: mutation.issueId,
                subject: mutation.subject || '',
                status: { id: mutation.expectedState.statusId || 0, name: '' },
                priority: { id: mutation.expectedState.priorityId || 0, name: '' },
                assigned_to: mutation.expectedState.assignedToId ? { id: mutation.expectedState.assignedToId, name: '' } : undefined,
                fixed_version: mutation.expectedState.fixedVersionId ? { id: mutation.expectedState.fixedVersionId, name: '' } : undefined,
                updated_on: mutation.expectedState.updatedAt || '',
                // Required fields
                tracker: { id: 0, name: '' },
                author: { id: 0, name: '' },
                done_ratio: 0,
                is_private: false,
                created_on: '',
            } : null

            // Detect conflict
            const conflict = detectConflict(
                mutation.id!,
                expectedState,
                serverIssue,
                mutation.body || {}
            )

            if (conflict) {
                setCurrentConflict(conflict)
                currentMutationRef.current = mutation
                return false // Conflict detected, don't proceed
            }

            return true // No conflict, safe to proceed
        } catch (error) {
            // If we can't fetch the issue, assume no conflict and let it fail naturally
            console.warn('[ConflictResolution] Failed to check for conflicts:', error)
            return true
        }
    }, [service])

    /**
     * Resolve the current conflict
     */
    const resolveConflict = useCallback(async (resolution: ConflictResolution) => {
        const mutation = currentMutationRef.current
        if (!mutation) return

        try {
            await onConflictResolved?.(mutation, resolution)
        } catch (error) {
            console.error('[ConflictResolution] Failed to resolve conflict:', error)
        } finally {
            setCurrentConflict(null)
            currentMutationRef.current = null
            
            // Process next conflict in queue if any
            const next = conflictQueueRef.current.shift()
            if (next) {
                setCurrentConflict(next.conflict)
                currentMutationRef.current = next.mutation
            }
        }
    }, [onConflictResolved])

    /**
     * Skip the current conflict (leave in queue for later)
     */
    const skipConflict = useCallback(() => {
        setCurrentConflict(null)
        currentMutationRef.current = null
        
        // Process next conflict in queue if any
        const next = conflictQueueRef.current.shift()
        if (next) {
            setCurrentConflict(next.conflict)
            currentMutationRef.current = next.mutation
        }
    }, [])

    /**
     * Add a conflict to the queue
     */
    const queueConflict = useCallback((mutation: QueuedMutation, conflict: ConflictInfo) => {
        if (currentConflict) {
            conflictQueueRef.current.push({ mutation, conflict })
        } else {
            setCurrentConflict(conflict)
            currentMutationRef.current = mutation
        }
    }, [currentConflict])

    return {
        currentConflict,
        resolveConflict,
        skipConflict,
        hasPendingConflicts: conflictQueueRef.current.length > 0,
        // Expose internal methods via ref for external use
        checkForConflict,
        queueConflict,
    } as UseConflictResolutionReturn & {
        checkForConflict: (mutation: QueuedMutation) => Promise<boolean>
        queueConflict: (mutation: QueuedMutation, conflict: ConflictInfo) => void
    }
}
