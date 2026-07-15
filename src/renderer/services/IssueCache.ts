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
 *
 * Scoped per Redmine server: switching redmineURL (a different company/
 * instance) gets its own isolated database instead of sharing one cache,
 * since issue IDs from different servers can collide.
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

const BASE_DB_NAME = 'RedmineDesktopCache'

class IssueCacheDB extends Dexie {
    issues!: Table<CachedIssue, number>
    meta!: Table<CacheMeta, string>

    constructor(dbName: string) {
        super(dbName)
        this.version(1).stores({
            issues: 'id, fixed_version.id, assigned_to.id, status.id, cachedAt',
            meta: 'key',
        })
    }
}

/** Normalizes a Redmine URL into a stable scope key (host only, no protocol/trailing slash/case). */
function getScopeKey(): string {
    try {
        const url = localStorage.getItem('redmineURL') || ''
        return url.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/+$/, '')
    } catch {
        return ''
    }
}

const dbInstances = new Map<string, IssueCacheDB>()

/** Returns the Dexie instance for the currently-configured Redmine server, creating it on first use. */
function getDb(): IssueCacheDB {
    const scopeKey = getScopeKey()
    const dbName = scopeKey ? `${BASE_DB_NAME}::${scopeKey}` : BASE_DB_NAME
    let instance = dbInstances.get(dbName)
    if (!instance) {
        instance = new IssueCacheDB(dbName)
        dbInstances.set(dbName, instance)
    }
    return instance
}

// ── Issue Operations ────────────────────────────────────────────────────────

/**
 * Save issues to cache (upsert by id).
 * Preserves existing cachedAt for unchanged issues.
 */
export async function saveIssues(issues: Issue[]): Promise<void> {
    const db = getDb()
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
    const cached = await getDb().issues.toArray()
    // Strip internal fields
    return cached.map(({ cachedAt, ...issue }) => issue)
}

/**
 * Clear all cached issues.
 */
export async function clearAllIssues(): Promise<void> {
    await getDb().issues.clear()
}

// ── Metadata Operations ─────────────────────────────────────────────────────

/**
 * Save a metadata key-value pair.
 */
export async function saveMeta(key: string, value: string): Promise<void> {
    await getDb().meta.put({ key, value, updatedAt: Date.now() })
}

/**
 * Get a metadata value by key.
 */
export async function getMeta(key: string): Promise<string | null> {
    const entry = await getDb().meta.get(key)
    return entry?.value ?? null
}

/**
 * Remove a metadata entry.
 */
export async function removeMeta(key: string): Promise<void> {
    await getDb().meta.delete(key)
}

// ── Migration Helpers ───────────────────────────────────────────────────────

/**
 * Migrate issues from localStorage to IndexedDB.
 * Call once on app startup if localStorage has cached issues.
 */
export async function migrateFromLocalStorage(): Promise<number> {
    let migratedCount = 0

    // Migrate issues. Guarded independently so a failure here doesn't affect
    // the followed-ids migration below, and vice versa.
    try {
        const raw = localStorage.getItem('cachedIssues')
        if (raw) {
            const issues: Issue[] = JSON.parse(raw)
            if (Array.isArray(issues) && issues.length > 0) {
                await saveIssues(issues)
                migratedCount = issues.length
                // Only remove the key once its data has actually been persisted.
                localStorage.removeItem('cachedIssues')
                console.log(`[IssueCache] Migrated ${issues.length} issues from localStorage to IndexedDB`)
            }
        }
    } catch (e) {
        console.warn('[IssueCache] Migration of issues from localStorage failed:', e)
    }

    // Migrate followed issue IDs independently of the issues migration above.
    try {
        const followedRaw = localStorage.getItem('cachedFollowedIssueIds')
        if (followedRaw) {
            const followedIds: number[] = JSON.parse(followedRaw)
            await saveMeta('followedIssueIds', JSON.stringify(followedIds))
            localStorage.removeItem('cachedFollowedIssueIds')
        }
    } catch (e) {
        console.warn('[IssueCache] Migration of followed issue IDs from localStorage failed:', e)
    }

    return migratedCount
}

export default getDb
