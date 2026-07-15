import { describe, it, expect, beforeEach } from 'vitest'
import {
    saveIssues,
    getAllIssues,
    clearAllIssues,
    saveMeta,
    getMeta,
    removeMeta,
    migrateFromLocalStorage,
} from './IssueCache'
import { Issue } from '../models/redmine'

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

describe('IssueCache', () => {
    beforeEach(async () => {
        await clearAllIssues()
    })

    describe('saveIssues / getAllIssues', () => {
        it('saves and retrieves issues', async () => {
            const issues = [
                makeIssue({ id: 1, subject: 'Issue 1' }),
                makeIssue({ id: 2, subject: 'Issue 2' }),
            ]

            await saveIssues(issues)
            const retrieved = await getAllIssues()

            expect(retrieved).toHaveLength(2)
            expect(retrieved.map(i => i.id).sort()).toEqual([1, 2])
        })

        it('upserts issues (no duplicates)', async () => {
            const issues = [makeIssue({ id: 1, subject: 'V1' })]
            await saveIssues(issues)

            const updated = [makeIssue({ id: 1, subject: 'V2' })]
            await saveIssues(updated)

            const retrieved = await getAllIssues()
            expect(retrieved).toHaveLength(1)
            expect(retrieved[0].subject).toBe('V2')
        })

        it('strips internal cachedAt field', async () => {
            await saveIssues([makeIssue({ id: 1 })])
            const retrieved = await getAllIssues()

            expect(retrieved[0]).not.toHaveProperty('cachedAt')
        })
    })

    describe('clearAllIssues', () => {
        it('clears all issues', async () => {
            await saveIssues([makeIssue({ id: 1 }), makeIssue({ id: 2 })])
            await clearAllIssues()

            expect(await getAllIssues()).toHaveLength(0)
        })
    })
})

describe('Metadata', () => {
    beforeEach(async () => {
        // Clear meta table
        const { default: db } = await import('./IssueCache')
        await db.meta.clear()
    })

    it('saves and retrieves metadata', async () => {
        await saveMeta('testKey', 'testValue')
        const value = await getMeta('testKey')
        expect(value).toBe('testValue')
    })

    it('returns null for non-existent key', async () => {
        const value = await getMeta('nonExistent')
        expect(value).toBeNull()
    })

    it('removes metadata', async () => {
        await saveMeta('toDelete', 'value')
        await removeMeta('toDelete')
        const value = await getMeta('toDelete')
        expect(value).toBeNull()
    })

    it('overwrites existing metadata', async () => {
        await saveMeta('key', 'v1')
        await saveMeta('key', 'v2')
        const value = await getMeta('key')
        expect(value).toBe('v2')
    })
})

describe('migrateFromLocalStorage', () => {
    beforeEach(async () => {
        await clearAllIssues()
        const { default: db } = await import('./IssueCache')
        await db.meta.clear()
        localStorage.clear()
    })

    it('migrates both issues and followed IDs, removing both localStorage keys', async () => {
        const issues = [
            makeIssue({ id: 1, subject: 'Issue 1' }),
            makeIssue({ id: 2, subject: 'Issue 2' }),
        ]
        localStorage.setItem('cachedIssues', JSON.stringify(issues))
        localStorage.setItem('cachedFollowedIssueIds', JSON.stringify([1, 2]))

        const migrated = await migrateFromLocalStorage()

        expect(migrated).toBe(2)
        const cached = await getAllIssues()
        expect(cached.map(i => i.id).sort()).toEqual([1, 2])

        const followedRaw = await getMeta('followedIssueIds')
        expect(JSON.parse(followedRaw!)).toEqual([1, 2])

        expect(localStorage.getItem('cachedIssues')).toBeNull()
        expect(localStorage.getItem('cachedFollowedIssueIds')).toBeNull()
    })

    it('returns 0 and migrates nothing when there is no cached data', async () => {
        const migrated = await migrateFromLocalStorage()
        expect(migrated).toBe(0)
        expect(await getAllIssues()).toHaveLength(0)
    })

    it('still migrates and removes issues when followed-ids data is corrupt', async () => {
        const issues = [makeIssue({ id: 1, subject: 'Issue 1' })]
        localStorage.setItem('cachedIssues', JSON.stringify(issues))
        // Malformed JSON for followed IDs - should not roll back the issue migration
        localStorage.setItem('cachedFollowedIssueIds', '{not valid json')

        const migrated = await migrateFromLocalStorage()

        expect(migrated).toBe(1)
        const cached = await getAllIssues()
        expect(cached.map(i => i.id)).toEqual([1])

        // The issues key should be cleaned up even though followed-ids migration failed
        expect(localStorage.getItem('cachedIssues')).toBeNull()
    })
})
