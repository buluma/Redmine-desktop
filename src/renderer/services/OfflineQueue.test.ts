import { describe, it, expect, beforeEach, vi } from 'vitest'
import * as OfflineQueue from './OfflineQueue'

describe('OfflineQueue', () => {
    beforeEach(async () => {
        // Clear queue before each test
        await OfflineQueue.clearQueue()
    })

    describe('enqueueMutation', () => {
        it('adds a mutation to the queue', async () => {
            const id = await OfflineQueue.enqueueMutation({
                type: 'update',
                endpoint: '/issues/1.json',
                method: 'PUT',
                body: { status_id: 3 },
                issueId: 1,
                subject: 'Test issue',
                timestamp: Date.now(),
            })

            expect(id).toBeDefined()
            expect(typeof id).toBe('number')
        })

        it('returns unique ids for multiple mutations', async () => {
            const id1 = await OfflineQueue.enqueueMutation({
                type: 'update',
                endpoint: '/issues/1.json',
                method: 'PUT',
                body: {},
                issueId: 1,
                timestamp: Date.now(),
            })

            const id2 = await OfflineQueue.enqueueMutation({
                type: 'update',
                endpoint: '/issues/2.json',
                method: 'PUT',
                body: {},
                issueId: 2,
                timestamp: Date.now(),
            })

            expect(id1).not.toBe(id2)
        })
    })

    describe('getPendingMutations', () => {
        it('returns empty array when queue is empty', async () => {
            const mutations = await OfflineQueue.getPendingMutations()
            expect(mutations).toEqual([])
        })

        it('returns mutations in timestamp order', async () => {
            await OfflineQueue.enqueueMutation({
                type: 'update',
                endpoint: '/issues/1.json',
                method: 'PUT',
                body: {},
                issueId: 1,
                timestamp: 2000,
            })

            await OfflineQueue.enqueueMutation({
                type: 'update',
                endpoint: '/issues/2.json',
                method: 'PUT',
                body: {},
                issueId: 2,
                timestamp: 1000,
            })

            const mutations = await OfflineQueue.getPendingMutations()
            expect(mutations).toHaveLength(2)
            expect(mutations[0].issueId).toBe(2) // Earlier timestamp first
            expect(mutations[1].issueId).toBe(1)
        })
    })

    describe('getPendingCount', () => {
        it('returns 0 when queue is empty', async () => {
            const count = await OfflineQueue.getPendingCount()
            expect(count).toBe(0)
        })

        it('returns correct count', async () => {
            await OfflineQueue.enqueueMutation({
                type: 'update',
                endpoint: '/issues/1.json',
                method: 'PUT',
                body: {},
                issueId: 1,
                timestamp: Date.now(),
            })

            await OfflineQueue.enqueueMutation({
                type: 'create',
                endpoint: '/issues.json',
                method: 'POST',
                body: {},
                issueId: 2,
                timestamp: Date.now(),
            })

            const count = await OfflineQueue.getPendingCount()
            expect(count).toBe(2)
        })
    })

    describe('removeMutation', () => {
        it('removes a mutation from the queue', async () => {
            const id = await OfflineQueue.enqueueMutation({
                type: 'update',
                endpoint: '/issues/1.json',
                method: 'PUT',
                body: {},
                issueId: 1,
                timestamp: Date.now(),
            })

            await OfflineQueue.removeMutation(id)

            const count = await OfflineQueue.getPendingCount()
            expect(count).toBe(0)
        })
    })

    describe('clearQueue', () => {
        it('removes all mutations', async () => {
            await OfflineQueue.enqueueMutation({
                type: 'update',
                endpoint: '/issues/1.json',
                method: 'PUT',
                body: {},
                issueId: 1,
                timestamp: Date.now(),
            })

            await OfflineQueue.enqueueMutation({
                type: 'update',
                endpoint: '/issues/2.json',
                method: 'PUT',
                body: {},
                issueId: 2,
                timestamp: Date.now(),
            })

            await OfflineQueue.clearQueue()

            const count = await OfflineQueue.getPendingCount()
            expect(count).toBe(0)
        })
    })

    describe('processQueue', () => {
        it('processes all mutations successfully', async () => {
            await OfflineQueue.enqueueMutation({
                type: 'update',
                endpoint: '/issues/1.json',
                method: 'PUT',
                body: { status_id: 3 },
                issueId: 1,
                timestamp: Date.now(),
            })

            await OfflineQueue.enqueueMutation({
                type: 'update',
                endpoint: '/issues/2.json',
                method: 'PUT',
                body: { status_id: 4 },
                issueId: 2,
                timestamp: Date.now(),
            })

            const executor = vi.fn().mockResolvedValue(undefined)
            const result = await OfflineQueue.processQueue(executor)

            expect(result.succeeded).toBe(2)
            expect(result.failed).toBe(0)
            expect(result.remaining).toBe(0)
            expect(executor).toHaveBeenCalledTimes(2)
        })

        it('handles failed mutations with retry', async () => {
            await OfflineQueue.enqueueMutation({
                type: 'update',
                endpoint: '/issues/1.json',
                method: 'PUT',
                body: {},
                issueId: 1,
                timestamp: Date.now(),
            })

            const executor = vi.fn().mockRejectedValue(new Error('Network error'))
            const result = await OfflineQueue.processQueue(executor)

            expect(result.succeeded).toBe(0)
            expect(result.failed).toBe(1)
            expect(result.remaining).toBe(1) // Still in queue for retry
        })

        it('removes mutations that exceed max retries', async () => {
            const id = await OfflineQueue.enqueueMutation({
                type: 'update',
                endpoint: '/issues/1.json',
                method: 'PUT',
                body: {},
                issueId: 1,
                timestamp: Date.now(),
            })

            // Simulate 3 previous failures
            for (let i = 0; i < 3; i++) {
                await OfflineQueue.updateMutationError(id, 'Error')
            }

            const executor = vi.fn().mockRejectedValue(new Error('Still failing'))
            const result = await OfflineQueue.processQueue(executor)

            expect(result.failed).toBe(1)
            expect(result.remaining).toBe(0) // Removed after max retries
        })
    })

    describe('getRetryDelay', () => {
        it('returns exponential backoff delays', () => {
            expect(OfflineQueue.getRetryDelay(0)).toBe(1000)
            expect(OfflineQueue.getRetryDelay(1)).toBe(2000)
            expect(OfflineQueue.getRetryDelay(2)).toBe(4000)
            expect(OfflineQueue.getRetryDelay(3)).toBe(8000)
            expect(OfflineQueue.getRetryDelay(4)).toBe(16000)
            expect(OfflineQueue.getRetryDelay(10)).toBe(30000) // Capped at 30s
        })
    })

    describe('shouldRetry', () => {
        it('returns true for mutations under max retries', () => {
            expect(OfflineQueue.shouldRetry({ retryCount: 0 } as any)).toBe(true)
            expect(OfflineQueue.shouldRetry({ retryCount: 2 } as any)).toBe(true)
        })

        it('returns false for mutations at max retries', () => {
            expect(OfflineQueue.shouldRetry({ retryCount: 3 } as any)).toBe(false)
            expect(OfflineQueue.shouldRetry({ retryCount: 10 } as any)).toBe(false)
        })
    })
})
