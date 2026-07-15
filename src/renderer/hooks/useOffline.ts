import { useState, useEffect, useCallback, useRef } from 'react'
import * as OfflineQueue from '../services/OfflineQueue'
import { QueuedMutation, UpdateIssueBody } from '../services/OfflineQueue'
import { detectConflict, ConflictInfo, ConflictResolution } from '../services/ConflictResolver'
import { RedmineService } from '../services/RedmineService'
import { Issue } from '../models/redmine'
import { showToast } from '../components/Toast'

interface UseOfflineReturn {
    isOnline: boolean
    isProcessingQueue: boolean
    pendingCount: number
    currentConflict: ConflictInfo | null
    refreshPendingCount: () => Promise<void>
    resolveConflict: (resolution: ConflictResolution) => Promise<void>
    skipConflict: () => void
}

export function useOffline(
    service: RedmineService | null,
    fetchIssueDetail: (id: number) => Promise<Issue>
): UseOfflineReturn {
    const [isOnline, setIsOnline] = useState(navigator.onLine)
    const [isProcessingQueue, setIsProcessingQueue] = useState(false)
    const [pendingCount, setPendingCount] = useState(0)
    const [currentConflict, setCurrentConflict] = useState<ConflictInfo | null>(null)
    const hasShownOfflineToast = useRef(false)
    const currentMutationRef = useRef<QueuedMutation | null>(null)
    const conflictQueueRef = useRef<Array<{ mutation: QueuedMutation; conflict: ConflictInfo }>>([])
    const isProcessingRef = useRef(false)

    // Refresh pending count
    const refreshPendingCount = useCallback(async () => {
        try {
            const count = await OfflineQueue.getPendingCount()
            setPendingCount(count)
        } catch (e) {
            console.warn('[useOffline] Failed to get pending count:', e)
        }
    }, [])

    // Execute a single mutation
    const executeMutation = useCallback(async (mutation: QueuedMutation): Promise<void> => {
        if (!service) throw new Error('No service available')

        if (mutation.type === 'update') {
            await service.updateIssue(mutation.issueId, mutation.body)
        } else if (mutation.type === 'create') {
            await service.createIssue(mutation.body)
        } else if (mutation.type === 'delete') {
            await service.deleteIssue(mutation.issueId)
        }
    }, [service])

    // Check for conflicts before applying mutation
    const checkForConflict = useCallback(async (mutation: QueuedMutation): Promise<ConflictInfo | null> => {
        if (mutation.type !== 'update' || !mutation.expectedState) {
            return null // Can't detect conflicts for non-update mutations
        }

        try {
            const serverIssue = await fetchIssueDetail(mutation.issueId)
            
            // Convert expected state format
            const expectedState: Issue | null = {
                id: mutation.issueId,
                subject: mutation.subject || '',
                status: { id: mutation.expectedState.statusId || 0, name: '' },
                priority: { id: mutation.expectedState.priorityId || 0, name: '' },
                assigned_to: mutation.expectedState.assignedToId 
                    ? { id: mutation.expectedState.assignedToId, name: '' } 
                    : undefined,
                fixed_version: mutation.expectedState.fixedVersionId 
                    ? { id: mutation.expectedState.fixedVersionId, name: '' } 
                    : undefined,
                updated_on: mutation.expectedState.updatedAt || '',
                // Required fields
                tracker: { id: 0, name: '' },
                author: { id: 0, name: '' },
                done_ratio: 0,
                is_private: false,
                created_on: '',
            }

            return detectConflict(
                mutation.id!,
                expectedState,
                serverIssue,
                mutation.body || {}
            )
        } catch (error) {
            console.warn('[useOffline] Failed to check for conflicts:', error)
            return null
        }
    }, [fetchIssueDetail])

    // Apply conflict resolution
    const applyResolution = useCallback(async (
        mutation: QueuedMutation,
        resolution: ConflictResolution
    ): Promise<void> => {
        if (!service) return

        if (resolution.resolution === 'server') {
            // Discard local changes, just remove from queue
            await OfflineQueue.removeMutation(mutation.id!)
            return
        }

        if (resolution.resolution === 'local') {
            // Apply local changes (client wins)
            await executeMutation(mutation)
            await OfflineQueue.removeMutation(mutation.id!)
            return
        }

        if (resolution.resolution === 'merge' && resolution.mergedData) {
            // Apply merged data
            await service.updateIssue(mutation.issueId, resolution.mergedData as UpdateIssueBody)
            await OfflineQueue.removeMutation(mutation.id!)
            return
        }
    }, [service, executeMutation])

    // Resolve current conflict
    const resolveConflict = useCallback(async (resolution: ConflictResolution) => {
        const mutation = currentMutationRef.current
        if (!mutation) return

        try {
            await applyResolution(mutation, resolution)
            showToast.success('Conflict resolved')
        } catch (error: any) {
            showToast.error(`Failed to resolve conflict: ${error.message}`)
        } finally {
            setCurrentConflict(null)
            currentMutationRef.current = null

            // Process next conflict in queue
            const next = conflictQueueRef.current.shift()
            if (next) {
                setCurrentConflict(next.conflict)
                currentMutationRef.current = next.mutation
            } else {
                // No more conflicts, continue processing queue
                await refreshPendingCount()
            }
        }
    }, [applyResolution, refreshPendingCount])

    // Skip current conflict (leave in queue)
    const skipConflict = useCallback(() => {
        setCurrentConflict(null)
        currentMutationRef.current = null

        // Process next conflict
        const next = conflictQueueRef.current.shift()
        if (next) {
            setCurrentConflict(next.conflict)
            currentMutationRef.current = next.mutation
        }
    }, [])

    // Process the queue when back online
    const processQueue = useCallback(async () => {
        if (!service) return
        if (isProcessingRef.current) return // guard against overlapping runs from a flapping reconnect
        isProcessingRef.current = true

        setIsProcessingQueue(true)
        try {
            // Clear stale mutations first
            await OfflineQueue.clearStaleMutations()

            const mutations = await OfflineQueue.getPendingMutations()
            let succeeded = 0
            let failed = 0

            for (const mutation of mutations) {
                try {
                    // A retryCount > 0 means this mutation already failed at least once;
                    // pace the retry with exponential backoff instead of hammering the
                    // server again immediately.
                    if (mutation.retryCount > 0) {
                        const delay = OfflineQueue.getRetryDelay(mutation.retryCount)
                        await new Promise(resolve => setTimeout(resolve, delay))
                    }

                    // Check for conflicts first
                    const conflict = await checkForConflict(mutation)
                    
                    if (conflict) {
                        // Queue conflict for resolution
                        if (currentConflict) {
                            conflictQueueRef.current.push({ mutation, conflict })
                        } else {
                            setCurrentConflict(conflict)
                            currentMutationRef.current = mutation
                        }
                        continue // Don't process this mutation yet
                    }

                    // No conflict, execute mutation
                    await executeMutation(mutation)
                    await OfflineQueue.removeMutation(mutation.id!)
                    succeeded++
                } catch (error: any) {
                    if (OfflineQueue.shouldRetry(mutation)) {
                        await OfflineQueue.updateMutationError(mutation.id!, error.message)
                        failed++
                    } else {
                        await OfflineQueue.removeMutation(mutation.id!)
                        failed++
                    }
                }
            }

            if (succeeded > 0) {
                showToast.success(`Synced ${succeeded} offline change${succeeded > 1 ? 's' : ''}`)
            }

            if (failed > 0 && succeeded === 0) {
                showToast.error(`Failed to sync ${failed} change${failed > 1 ? 's' : ''}`)
            }
        } catch (error: any) {
            console.error('[useOffline] Failed to process queue:', error)
            showToast.error('Failed to sync offline changes')
        } finally {
            isProcessingRef.current = false
            setIsProcessingQueue(false)
            await refreshPendingCount()
        }
    }, [service, checkForConflict, executeMutation, currentConflict, refreshPendingCount])

    // Handle online/offline events
    useEffect(() => {
        const handleOnline = () => {
            setIsOnline(true)
            hasShownOfflineToast.current = false
            showToast.success('Back online')

            // Process queue after a short delay
            setTimeout(() => {
                processQueue()
            }, 1000)
        }

        const handleOffline = () => {
            setIsOnline(false)
            if (!hasShownOfflineToast.current) {
                showToast.info('You are offline. Changes will be synced later.')
                hasShownOfflineToast.current = true
            }
        }

        window.addEventListener('online', handleOnline)
        window.addEventListener('offline', handleOffline)

        // Initial count
        refreshPendingCount()

        return () => {
            window.removeEventListener('online', handleOnline)
            window.removeEventListener('offline', handleOffline)
        }
    }, [processQueue, refreshPendingCount])

    // Poll pending count periodically when online
    useEffect(() => {
        if (!isOnline) return

        const interval = setInterval(refreshPendingCount, 30000)
        return () => clearInterval(interval)
    }, [isOnline, refreshPendingCount])

    return {
        isOnline,
        isProcessingQueue,
        pendingCount,
        currentConflict,
        refreshPendingCount,
        resolveConflict,
        skipConflict,
    }
}
