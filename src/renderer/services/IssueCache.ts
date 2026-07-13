import Dexie, { Table } from 'dexie'
import { Issue } from '../models/redmine'

/**
 * IndexedDB-backed issue cache.
 *
 * Replaces localStorage for issue storage, giving us:
 * - No 5MB limit (IndexedDB can store hundreds of MB)
 * - Non-blocking async reads (won't freeze the main thread)
 * - Structured data with indexes for fast queries
 * - Better serialization (no JSON.stringify/parse overhead)
 */

interface CachedIssue extends Issue {
    /** Timestamp when this issue was cached */
    cachedAt: number
}

interface CacheMeta {
    key: string
    value: string
    updatedAt: number
}

class IssueCacheDB extends Dexie {
    issues!: Table<CachedIssue, number>
    meta!: Table<CacheMeta, string>

    constructor() {
        super('RedmineDesktopCache')
        this.version(1).stores({
            issues: 'id, fixed_version.id, assigned_to.id, status.id, cachedAt',
            meta: 'key',
        })
    }
}

const db = new IssueCacheDB()

// ── Issue Operations ────────────────────────────────────────────────────────

/**
 * Save issues to cache (upsert by id).
 * Preserves existing cachedAt for unchanged issues.
 */
export async function saveIssues(issues: Issue[]): Promise<void> {
    const now = Date.now()
    const existing = await db.issues.bulkGet(issues.map(i => i.id))
    const existingMap = new Map(existing.filter(Boolean).map(e => [e!.id, e!]))

    const toUpsert: CachedIssue[] = issues.map(issue => ({
        ...issue,
        cachedAt: existingMap.get(issue.id)?.cachedAt ?? now,
    }))

    await db.issues.bulkPut(toUpsert)
}

/**
 * Get all cached issues.
 */
export async function getAllIssues(): Promise<Issue[]> {
    const cached = await db.issues.toArray()
    // Strip internal fields
    return cached.map(({ cachedAt, ...issue }) => issue)
}

/**
 * Get issues by version ID.
 */
export async function getIssuesByVersion(versionId: number): Promise<Issue[]> {
    const cached = await db.issues
        .where('fixed_version.id')
        .equals(versionId)
        .toArray()
    return cached.map(({ cachedAt, ...issue }) => issue)
}

/**
 * Get issues by assignee ID.
 */
export async function getIssuesByAssignee(assigneeId: number): Promise<Issue[]> {
    const cached = await db.issues
        .where('assigned_to.id')
        .equals(assigneeId)
        .toArray()
    return cached.map(({ cachedAt, ...issue }) => issue)
}

/**
 * Get specific issues by their IDs.
 */
export async function getIssuesByIds(ids: number[]): Promise<Issue[]> {
    const cached = await db.issues.bulkGet(ids)
    return cached
        .filter((item): item is CachedIssue => item !== undefined)
        .map(({ cachedAt, ...issue }) => issue)
}

/**
 * Get a single issue by ID.
 */
export async function getIssue(id: number): Promise<Issue | undefined> {
    const cached = await db.issues.get(id)
    if (!cached) return undefined
    const { cachedAt, ...issue } = cached
    return issue
}

/**
 * Update a single issue.
 */
export async function updateIssue(issue: Issue): Promise<void> {
    const existing = await db.issues.get(issue.id)
    await db.issues.put({
        ...issue,
        cachedAt: existing?.cachedAt ?? Date.now(),
    })
}

/**
 * Remove issues by their IDs.
 */
export async function removeIssues(ids: number[]): Promise<void> {
    await db.issues.bulkDelete(ids)
}

/**
 * Remove all issues for a set of version IDs.
 */
export async function removeIssuesByVersion(versionIds: number[]): Promise<void> {
    await db.issues
        .where('fixed_version.id')
        .anyOf(versionIds)
        .delete()
}

/**
 * Clear all cached issues.
 */
export async function clearAllIssues(): Promise<void> {
    await db.issues.clear()
}

/**
 * Get the count of cached issues.
 */
export async function getIssueCount(): Promise<number> {
    return db.issues.count()
}

// ── Metadata Operations ─────────────────────────────────────────────────────

/**
 * Save a metadata key-value pair.
 */
export async function saveMeta(key: string, value: string): Promise<void> {
    await db.meta.put({ key, value, updatedAt: Date.now() })
}

/**
 * Get a metadata value by key.
 */
export async function getMeta(key: string): Promise<string | null> {
    const entry = await db.meta.get(key)
    return entry?.value ?? null
}

/**
 * Remove a metadata entry.
 */
export async function removeMeta(key: string): Promise<void> {
    await db.meta.delete(key)
}

// ── Migration Helpers ───────────────────────────────────────────────────────

/**
 * Migrate issues from localStorage to IndexedDB.
 * Call once on app startup if localStorage has cached issues.
 */
export async function migrateFromLocalStorage(): Promise<number> {
    try {
        const raw = localStorage.getItem('cachedIssues')
        if (!raw) return 0

        const issues: Issue[] = JSON.parse(raw)
        if (!Array.isArray(issues) || issues.length === 0) return 0

        await saveIssues(issues)

        // Also migrate followed issue IDs
        const followedRaw = localStorage.getItem('cachedFollowedIssueIds')
        if (followedRaw) {
            const followedIds: number[] = JSON.parse(followedRaw)
            await saveMeta('followedIssueIds', JSON.stringify(followedIds))
        }

        // Clean up localStorage
        localStorage.removeItem('cachedIssues')
        localStorage.removeItem('cachedFollowedIssueIds')

        console.log(`[IssueCache] Migrated ${issues.length} issues from localStorage to IndexedDB`)
        return issues.length
    } catch (e) {
        console.warn('[IssueCache] Migration from localStorage failed:', e)
        return 0
    }
}

export default db
