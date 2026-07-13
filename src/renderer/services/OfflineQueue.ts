import Dexie from 'dexie'

export interface QueuedMutation {
    id?: number
    type: 'update' | 'create' | 'delete'
    endpoint: string
    method: 'POST' | 'PUT' | 'PATCH' | 'DELETE'
    body?: any
    issueId: number
    subject?: string // For display purposes
    timestamp: number
    retryCount: number
    lastError?: string
    expectedState?: {
        statusId?: number
        priorityId?: number
        assignedToId?: number
        fixedVersionId?: number
        updatedAt?: string
    }
}

class OfflineQueueDB extends Dexie {
    mutations!: Dexie.Table<QueuedMutation, number>

    constructor() {
        super('RedmineOfflineQueue')
        this.version(1).stores({
            mutations: '++id, type, issueId, timestamp, retryCount'
        })
    }
}

const db = new OfflineQueueDB()

// Maximum retries before giving up
const MAX_RETRIES = 3
// Delay between retries (exponential backoff)
const BASE_RETRY_DELAY = 1000

/**
 * Add a mutation to the offline queue
 */
export async function enqueueMutation(mutation: Omit<QueuedMutation, 'id' | 'retryCount'>): Promise<number> {
    const id = await db.mutations.add({
        ...mutation,
        retryCount: 0,
    })
    console.log(`[OfflineQueue] Enqueued mutation: ${mutation.type} for issue ${mutation.issueId}`)
    return id as number
}

/**
 * Get all pending mutations
 */
export async function getPendingMutations(): Promise<QueuedMutation[]> {
    return db.mutations.orderBy('timestamp').toArray()
}

/**
 * Get count of pending mutations
 */
export async function getPendingCount(): Promise<number> {
    return db.mutations.count()
}

/**
 * Remove a mutation from the queue (after successful execution)
 */
export async function removeMutation(id: number): Promise<void> {
    await db.mutations.delete(id)
    console.log(`[OfflineQueue] Removed mutation ${id}`)
}

/**
 * Update mutation retry count and error
 */
export async function updateMutationError(id: number, error: string): Promise<void> {
    const mutation = await db.mutations.get(id)
    if (mutation) {
        await db.mutations.update(id, {
            retryCount: mutation.retryCount + 1,
            lastError: error,
        })
    }
}

/**
 * Clear all pending mutations
 */
export async function clearQueue(): Promise<void> {
    await db.mutations.clear()
    console.log('[OfflineQueue] Queue cleared')
}

/**
 * Get retry delay based on retry count (exponential backoff)
 */
export function getRetryDelay(retryCount: number): number {
    return Math.min(BASE_RETRY_DELAY * Math.pow(2, retryCount), 30000)
}

/**
 * Check if a mutation should be retried
 */
export function shouldRetry(mutation: QueuedMutation): boolean {
    return mutation.retryCount < MAX_RETRIES
}

/**
 * Process the queue - retry all pending mutations
 * Returns { succeeded, failed } counts
 */
export async function processQueue(
    executor: (mutation: QueuedMutation) => Promise<void>
): Promise<{ succeeded: number; failed: number; remaining: number }> {
    const mutations = await getPendingMutations()
    let succeeded = 0
    let failed = 0

    for (const mutation of mutations) {
        try {
            await executor(mutation)
            await removeMutation(mutation.id!)
            succeeded++
            console.log(`[OfflineQueue] Succeeded: ${mutation.type} for issue ${mutation.issueId}`)
        } catch (error: any) {
            if (shouldRetry(mutation)) {
                await updateMutationError(mutation.id!, error.message)
                failed++
                console.warn(`[OfflineQueue] Failed (will retry): ${mutation.type} for issue ${mutation.issueId}`, error.message)
            } else {
                await removeMutation(mutation.id!)
                failed++
                console.error(`[OfflineQueue] Failed (max retries): ${mutation.type} for issue ${mutation.issueId}`, error.message)
            }
        }
    }

    const remaining = await getPendingCount()
    return { succeeded, failed, remaining }
}

/**
 * Clear old mutations (older than 24 hours)
 */
export async function clearStaleMutations(): Promise<number> {
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000
    const stale = await db.mutations.where('timestamp').below(oneDayAgo).toArray()
    for (const mutation of stale) {
        await db.mutations.delete(mutation.id!)
    }
    if (stale.length > 0) {
        console.log(`[OfflineQueue] Cleared ${stale.length} stale mutations`)
    }
    return stale.length
}
