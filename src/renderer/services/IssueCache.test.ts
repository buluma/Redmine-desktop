import { describe, it, expect, beforeEach } from 'vitest'
import {
    saveIssues,
    getAllIssues,
    getIssuesByVersion,
    getIssuesByAssignee,
    getIssuesByIds,
    getIssue,
    updateIssue,
    removeIssues,
    clearAllIssues,
    getIssueCount,
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

    describe('getIssuesByVersion', () => {
        it('filters issues by version', async () => {
            await saveIssues([
                makeIssue({ id: 1, fixed_version: { id: 10, name: 'v1.0' } }),
                makeIssue({ id: 2, fixed_version: { id: 20, name: 'v2.0' } }),
                makeIssue({ id: 3, fixed_version: { id: 10, name: 'v1.0' } }),
            ])

            const v1Issues = await getIssuesByVersion(10)
            expect(v1Issues).toHaveLength(2)
            expect(v1Issues.map(i => i.id).sort()).toEqual([1, 3])
        })

        it('returns empty for non-existent version', async () => {
            await saveIssues([makeIssue({ id: 1, fixed_version: { id: 10, name: 'v1' } })])
            const result = await getIssuesByVersion(999)
            expect(result).toHaveLength(0)
        })
    })

    describe('getIssuesByAssignee', () => {
        it('filters issues by assignee', async () => {
            await saveIssues([
                makeIssue({ id: 1, assigned_to: { id: 1, name: 'Alice' } }),
                makeIssue({ id: 2, assigned_to: { id: 2, name: 'Bob' } }),
                makeIssue({ id: 3, assigned_to: { id: 1, name: 'Alice' } }),
            ])

            const aliceIssues = await getIssuesByAssignee(1)
            expect(aliceIssues).toHaveLength(2)
        })
    })

    describe('getIssuesByIds', () => {
        it('retrieves specific issues', async () => {
            await saveIssues([
                makeIssue({ id: 1 }),
                makeIssue({ id: 2 }),
                makeIssue({ id: 3 }),
            ])

            const result = await getIssuesByIds([1, 3])
            expect(result).toHaveLength(2)
            expect(result.map(i => i.id).sort()).toEqual([1, 3])
        })
    })

    describe('getIssue', () => {
        it('retrieves a single issue', async () => {
            await saveIssues([makeIssue({ id: 42, subject: 'Special' })])
            const issue = await getIssue(42)
            expect(issue?.subject).toBe('Special')
        })

        it('returns undefined for non-existent issue', async () => {
            const issue = await getIssue(999)
            expect(issue).toBeUndefined()
        })
    })

    describe('updateIssue', () => {
        it('updates a single issue', async () => {
            await saveIssues([makeIssue({ id: 1, subject: 'Old' })])
            await updateIssue(makeIssue({ id: 1, subject: 'New' }))

            const issue = await getIssue(1)
            expect(issue?.subject).toBe('New')
        })
    })

    describe('removeIssues', () => {
        it('removes issues by ID', async () => {
            await saveIssues([
                makeIssue({ id: 1 }),
                makeIssue({ id: 2 }),
                makeIssue({ id: 3 }),
            ])

            await removeIssues([1, 3])
            const remaining = await getAllIssues()
            expect(remaining).toHaveLength(1)
            expect(remaining[0].id).toBe(2)
        })
    })

    describe('clearAllIssues', () => {
        it('clears all issues', async () => {
            await saveIssues([makeIssue({ id: 1 }), makeIssue({ id: 2 })])
            await clearAllIssues()

            const count = await getIssueCount()
            expect(count).toBe(0)
        })
    })

    describe('getIssueCount', () => {
        it('returns correct count', async () => {
            expect(await getIssueCount()).toBe(0)
            await saveIssues([makeIssue({ id: 1 }), makeIssue({ id: 2 })])
            expect(await getIssueCount()).toBe(2)
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
        expect(await getIssueCount()).toBe(0)
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
