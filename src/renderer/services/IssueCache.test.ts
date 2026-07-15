import { describe, it, expect, beforeEach } from 'vitest'
import {
    saveIssues,
    getAllIssues,
    clearAllIssues,
    saveMeta,
    getMeta,
    removeMeta,
    migrateFromLocalStorage,
    cleanupStaleServerCaches,
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
        const { default: getDb } = await import('./IssueCache')
        await getDb().meta.clear()
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
        const { default: getDb } = await import('./IssueCache')
        await getDb().meta.clear()
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

describe('per-server cache scoping', () => {
    beforeEach(() => {
        localStorage.removeItem('redmineURL')
    })

    it('does not show issues cached under a different redmineURL', async () => {
        localStorage.setItem('redmineURL', 'https://scope-test-1-a.example.com')
        await saveIssues([makeIssue({ id: 1, subject: 'From server A' })])
        expect(await getAllIssues()).toHaveLength(1)

        localStorage.setItem('redmineURL', 'https://scope-test-1-b.example.com')
        expect(await getAllIssues()).toHaveLength(0)

        await saveIssues([makeIssue({ id: 1, subject: 'From server B (different issue, same id)' })])
        expect((await getAllIssues())[0].subject).toBe('From server B (different issue, same id)')
    })

    it('keeps a server\'s cache intact when switching away and back to it', async () => {
        localStorage.setItem('redmineURL', 'https://scope-test-2-a.example.com')
        await saveIssues([makeIssue({ id: 1, subject: 'From server A' })])

        localStorage.setItem('redmineURL', 'https://scope-test-2-b.example.com')
        await saveIssues([makeIssue({ id: 2, subject: 'From server B' })])

        localStorage.setItem('redmineURL', 'https://scope-test-2-a.example.com')
        const cached = await getAllIssues()
        expect(cached).toHaveLength(1)
        expect(cached[0].subject).toBe('From server A')
    })

    it('treats http/https and trailing-slash variants of the same host as the same scope', async () => {
        localStorage.setItem('redmineURL', 'https://scope-test-3.example.com/')
        await saveIssues([makeIssue({ id: 1, subject: 'Cached' })])

        localStorage.setItem('redmineURL', 'http://scope-test-3.example.com')
        expect(await getAllIssues()).toHaveLength(1)
    })
})

describe('cleanupStaleServerCaches', () => {
    it('deletes a server\'s cache once its last-accessed timestamp is past maxAgeDays', async () => {
        localStorage.setItem('redmineURL', 'https://cleanup-test-old.example.com')
        await saveIssues([makeIssue({ id: 1 })])
        expect(await getAllIssues()).toHaveLength(1)

        // Backdate that server's registry entry past the cutoff.
        const registry = JSON.parse(localStorage.getItem('issueCacheDbRegistry') || '{}')
        const oldDbName = Object.keys(registry).find(k => k.includes('cleanup-test-old'))!
        registry[oldDbName] = Date.now() - 100 * 24 * 60 * 60 * 1000 // 100 days ago
        localStorage.setItem('issueCacheDbRegistry', JSON.stringify(registry))

        // A different server is now the active one.
        localStorage.setItem('redmineURL', 'https://cleanup-test-current.example.com')

        const deleted = await cleanupStaleServerCaches(90)
        expect(deleted).toContain(oldDbName)

        // Switching back shows an empty cache -- its database was actually deleted.
        localStorage.setItem('redmineURL', 'https://cleanup-test-old.example.com')
        expect(await getAllIssues()).toHaveLength(0)
    })

    it('never deletes the currently active server\'s cache, regardless of recorded age', async () => {
        localStorage.setItem('redmineURL', 'https://cleanup-test-active.example.com')
        await saveIssues([makeIssue({ id: 1 })])

        const registry = JSON.parse(localStorage.getItem('issueCacheDbRegistry') || '{}')
        const dbName = Object.keys(registry).find(k => k.includes('cleanup-test-active'))!
        registry[dbName] = Date.now() - 1000 * 24 * 60 * 60 * 1000 // very old
        localStorage.setItem('issueCacheDbRegistry', JSON.stringify(registry))

        const deleted = await cleanupStaleServerCaches(90)

        expect(deleted).not.toContain(dbName)
        expect(await getAllIssues()).toHaveLength(1)
    })

    it('leaves a recently-accessed server\'s cache alone', async () => {
        localStorage.setItem('redmineURL', 'https://cleanup-test-recent.example.com')
        await saveIssues([makeIssue({ id: 1 })])

        localStorage.setItem('redmineURL', 'https://cleanup-test-other.example.com')
        const deleted = await cleanupStaleServerCaches(90)

        const registry = JSON.parse(localStorage.getItem('issueCacheDbRegistry') || '{}')
        const recentDbName = Object.keys(registry).find(k => k.includes('cleanup-test-recent'))!
        expect(deleted).not.toContain(recentDbName)

        localStorage.setItem('redmineURL', 'https://cleanup-test-recent.example.com')
        expect(await getAllIssues()).toHaveLength(1)
    })
})
