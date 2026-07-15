import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import { RedmineService } from '../services/RedmineService'
import { Issue, User, IssueStatus, IssuePriority } from '../models/redmine'
import { getAssignedWatchers, getAssignedWatchersField, createAssignedWatchersUpdate } from '../utils/assignedWatchers'
import { isVerified, isDevComplete, isComplete } from '../constants/status'
import { showToast } from '../components/Toast'
import * as IssueCache from '../services/IssueCache'

export interface StatusCounts {
    dev: number
    done: number
    verified: number
}

export interface IssuesState {
    allIssues: Issue[]
    currentUser: User | null
    issueStatuses: IssueStatus[]
    issuePriorities: IssuePriority[]
    isLoading: boolean
    isBackgroundRefreshing: boolean
    errorMessage: string | null
    followedIssueIds: Set<number>
}

export interface IssuesActions {
    loadInitialData: (service: RedmineService, pinnedVersionIds: Set<number>) => Promise<void>
    refreshIssues: (service: RedmineService, activeVersionIds: Set<number>) => Promise<void>
    fetchVersionIssues: (service: RedmineService, versionId: number) => Promise<void>
    fetchIssueDetail: (service: RedmineService, id: number) => Promise<void>
    updateIssue: (service: RedmineService, id: number, data: any) => Promise<void>
    addNote: (service: RedmineService, id: number, note: string) => Promise<void>
    createIssue: (service: RedmineService, subject: string, projectId: number, versionId?: number, assignedToId?: number) => Promise<void>
    deleteIssue: (service: RedmineService, issueId: number) => Promise<void>
    addWatcher: (service: RedmineService, issueId: number, userId: number) => Promise<void>
    removeWatcher: (service: RedmineService, issueId: number, userId: number) => Promise<void>
    addAssignedWatcher: (service: RedmineService, issue: Issue, userId: number) => Promise<void>
    removeAssignedWatcher: (service: RedmineService, issue: Issue, userId: number) => Promise<void>
    openIssueById: (service: RedmineService, issueId: number) => Promise<{ projectId: number; versionId: number | null; issueId: number } | null>
    setErrorMessage: (msg: string | null) => void
}

// Load from IndexedDB on startup (async, returns empty initially)
function loadCachedIssues(): Issue[] {
    // IndexedDB loading is async, so we start empty and load in useEffect
    return []
}

function loadFollowedIds(): Set<number> {
    return new Set()
}

function mergeIssueMaps(prev: Issue[], fetched: Issue[]): { result: Issue[]; changed: boolean } {
    const issueMap = new Map(prev.map(i => [i.id, i]))
    let changed = false

    fetched.forEach(fi => {
        const existing = issueMap.get(fi.id)
        if (!existing) {
            issueMap.set(fi.id, fi)
            changed = true
        } else if (fi.updated_on !== existing.updated_on) {
            issueMap.set(fi.id, {
                ...fi,
                attachments: fi.attachments || existing.attachments,
                journals: fi.journals || existing.journals,
                watchers: fi.watchers || existing.watchers,
                custom_fields: fi.custom_fields || existing.custom_fields
            })
            changed = true
        }
    })

    return { result: Array.from(issueMap.values()), changed }
}

export function useIssues(): IssuesState & IssuesActions {
    const [allIssues, setAllIssues] = useState<Issue[]>(loadCachedIssues)
    const [currentUser, setCurrentUser] = useState<User | null>(null)
    const [issueStatuses, setIssueStatuses] = useState<IssueStatus[]>([])
    const [issuePriorities, setIssuePriorities] = useState<IssuePriority[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const [isBackgroundRefreshing, setIsBackgroundRefreshing] = useState(false)
    const [errorMessage, setErrorMessage] = useState<string | null>(null)
    const [followedIssueIds, setFollowedIssueIds] = useState<Set<number>>(loadFollowedIds)
    const [isCacheLoaded, setIsCacheLoaded] = useState(false)

    const isRefreshingRef = useRef(false)
    const followedIssueIdsRef = useRef(followedIssueIds)
    const issueStatusesRef = useRef(issueStatuses)
    const issuePrioritiesRef = useRef(issuePriorities)
    // Tracks whether a network refresh has already populated allIssues, so the
    // (slower) IndexedDB cache-load effect below doesn't clobber fresher state
    // with a stale cached snapshot if it resolves afterwards.
    const hasSetIssuesFromNetworkRef = useRef(false)

    useEffect(() => {
        followedIssueIdsRef.current = followedIssueIds
    }, [followedIssueIds])

    useEffect(() => {
        issueStatusesRef.current = issueStatuses
    }, [issueStatuses])

    useEffect(() => {
        issuePrioritiesRef.current = issuePriorities
    }, [issuePriorities])

    // Load cache from IndexedDB on mount
    useEffect(() => {
        const loadCache = async () => {
            try {
                // Try migrating from localStorage first
                const migrated = await IssueCache.migrateFromLocalStorage()
                if (migrated > 0) {
                    console.log(`[useIssues] Migrated ${migrated} issues from localStorage`)
                }

                const cachedIssues = await IssueCache.getAllIssues()
                if (cachedIssues.length > 0 && !hasSetIssuesFromNetworkRef.current) {
                    setAllIssues(cachedIssues)
                }

                const followedRaw = await IssueCache.getMeta('followedIssueIds')
                if (followedRaw) {
                    setFollowedIssueIds(new Set(JSON.parse(followedRaw)))
                }
            } catch (e) {
                console.warn('[useIssues] Failed to load cache from IndexedDB:', e)
            }
            setIsCacheLoaded(true)
        }
        loadCache()
    }, [])

    const loadInitialData = useCallback(async (service: RedmineService, pinnedVersionIds: Set<number>) => {
        setIsLoading(true)
        setErrorMessage(null)
        try {
            const [user, statuses, priorities] = await Promise.all([
                service.fetchCurrentUser(),
                service.fetchIssueStatuses(),
                service.fetchIssuePriorities()
            ])
            setCurrentUser(user)
            setIssueStatuses(statuses)
            setIssuePriorities(priorities)
        } catch (error: any) {
            setErrorMessage(`Failed to connect: ${error.message}`)
            setIsLoading(false)
            throw error
        }
        setIsLoading(false)
    }, [])

    const refreshIssues = useCallback(async (service: RedmineService, activeVersionIds: Set<number>) => {
        if (isRefreshingRef.current) return
        isRefreshingRef.current = true
        setIsBackgroundRefreshing(true)

        try {
            const activeVersionArray = Array.from(activeVersionIds)
            let allFetchedIssues: Issue[] = []

            for (const versionId of activeVersionArray) {
                let offset = 0
                let versionFetched = 0
                const limit = 100
                while (true) {
                    const { issues, total_count } = await service.fetchIssues({
                        fixed_version_id: versionId,
                        status_id: '*',
                        limit,
                        offset
                    })
                    allFetchedIssues = [...allFetchedIssues, ...issues]
                    versionFetched += issues.length
                    if (versionFetched >= total_count || issues.length < limit) break
                    offset += limit
                }
            }

            hasSetIssuesFromNetworkRef.current = true
            setAllIssues(prev => {
                const refreshedVersionIds = new Set(activeVersionArray)
                const fetchedIssueMap = new Map(allFetchedIssues.map(i => [i.id, i]))

                const preservedIssues = prev.filter(i =>
                    !i.fixed_version?.id || !refreshedVersionIds.has(i.fixed_version.id)
                )

                const existingActiveIssues = prev.filter(i =>
                    i.fixed_version?.id && refreshedVersionIds.has(i.fixed_version.id)
                )

                let hasChanges = false
                const mergedActiveIssues = existingActiveIssues
                    .filter(oldIssue => {
                        const exists = fetchedIssueMap.has(oldIssue.id)
                        if (!exists) hasChanges = true
                        return exists
                    })
                    .map(oldIssue => {
                        const newIssue = fetchedIssueMap.get(oldIssue.id)!
                        if (newIssue.updated_on !== oldIssue.updated_on) hasChanges = true
                        return {
                            ...newIssue,
                            attachments: newIssue.attachments || oldIssue.attachments,
                            journals: newIssue.journals || oldIssue.journals,
                            watchers: newIssue.watchers || oldIssue.watchers,
                            custom_fields: newIssue.custom_fields || oldIssue.custom_fields
                        }
                    })

                const activeIssueIds = new Set(existingActiveIssues.map(i => i.id))
                const brandNewIssues = allFetchedIssues.filter(i => !activeIssueIds.has(i.id))
                if (brandNewIssues.length > 0) hasChanges = true

                if (!hasChanges) return prev

                const newIssuesList = [...preservedIssues, ...mergedActiveIssues, ...brandNewIssues]
                // Save to IndexedDB (async, non-blocking)
                IssueCache.saveIssues(newIssuesList).catch(e =>
                    console.warn('[useIssues] Failed to save issues to IndexedDB:', e)
                )
                return newIssuesList
            })

            // Fetch followed + assigned issues
            if (currentUser) {
                let followedIds = new Set<number>()
                let followedAndAssigned: Issue[] = []
                let offset = 0
                const limit = 100

                while (true) {
                    const { issues, total_count } = await service.fetchIssues({
                        watcher_id: currentUser.id,
                        status_id: '*',
                        limit,
                        offset
                    })
                    issues.forEach(i => { followedIds.add(i.id); followedAndAssigned.push(i) })
                    if (followedIds.size >= total_count || issues.length < limit) break
                    offset += limit
                }

                offset = 0
                while (true) {
                    const { issues, total_count } = await service.fetchIssues({
                        assigned_to_id: currentUser.id,
                        status_id: '*',
                        limit,
                        offset
                    })
                    issues.forEach(i => { if (!followedIds.has(i.id)) followedAndAssigned.push(i) })
                    if (offset + issues.length >= total_count || issues.length < limit) break
                    offset += limit
                }

                setFollowedIssueIds(prev => {
                    if (prev.size === followedIds.size && Array.from(prev).every(id => followedIds.has(id))) return prev
                    // Save to IndexedDB (async, non-blocking)
                    IssueCache.saveMeta('followedIssueIds', JSON.stringify(Array.from(followedIds))).catch(e =>
                        console.warn('[useIssues] Failed to save followed IDs to IndexedDB:', e)
                    )
                    return followedIds
                })

                setAllIssues(prev => {
                    const refreshedVersionIds = new Set(activeVersionIds)
                    const refreshedFollowedIds = new Set(followedAndAssigned.map(i => i.id))
                    const issueMap = new Map(prev.map(i => [i.id, i]))
                    let changed = false

                    for (const issue of prev) {
                        const wasFollowed = followedIssueIdsRef.current.has(issue.id)
                        const wasAssigned = issue.assigned_to?.id === currentUser.id
                        if ((wasFollowed || wasAssigned) && !refreshedFollowedIds.has(issue.id)) {
                            const isInActiveVersion = issue.fixed_version?.id && refreshedVersionIds.has(issue.fixed_version.id)
                            if (!isInActiveVersion) { issueMap.delete(issue.id); changed = true }
                        }
                    }

                    followedAndAssigned.forEach(fi => {
                        const existing = issueMap.get(fi.id)
                        if (!existing) { issueMap.set(fi.id, fi); changed = true }
                        else {
                            issueMap.set(fi.id, {
                                ...fi,
                                attachments: fi.attachments || existing.attachments,
                                journals: fi.journals || existing.journals,
                                watchers: fi.watchers || existing.watchers,
                                custom_fields: fi.custom_fields || existing.custom_fields
                            })
                            changed = true
                        }
                    })

                    if (changed) {
                        const newIssues = Array.from(issueMap.values())
                        IssueCache.saveIssues(newIssues).catch(e =>
                            console.warn('[useIssues] Failed to save issues to IndexedDB:', e)
                        )
                        return newIssues
                    }
                    return prev
                })
            }
            setErrorMessage(null)
        } catch (e: any) {
            setErrorMessage(`Refresh failed: ${e.message}`)
        } finally {
            isRefreshingRef.current = false
            setIsBackgroundRefreshing(false)
        }
    }, [currentUser])

    const fetchVersionIssues = useCallback(async (service: RedmineService, versionId: number) => {
        setIsLoading(true)
        try {
            let allFetched: Issue[] = []
            let offset = 0
            const limit = 100

            while (true) {
                const { issues, total_count } = await service.fetchIssues({
                    fixed_version_id: versionId,
                    status_id: '*',
                    include: 'journals,attachments,watchers',
                    limit,
                    offset
                })
                allFetched = [...allFetched, ...issues]
                if (allFetched.length >= total_count || issues.length < limit || allFetched.length >= 500) break
                offset += limit
            }

            setAllIssues(prev => {
                const { result, changed } = mergeIssueMaps(prev, allFetched)
                return changed ? result : prev
            })
            setErrorMessage(null)
        } catch (e: any) {
            setErrorMessage(`Failed to fetch version issues: ${e.message}`)
        } finally {
            setIsLoading(false)
        }
    }, [])

    const fetchIssueDetail = useCallback(async (service: RedmineService, id: number) => {
        try {
            const detail = await service.fetchIssueDetail(id)
            setAllIssues(prev => {
                const old = prev.find(i => i.id === id)
                if (old && old.updated_on === detail.updated_on &&
                    (old.journals?.length === detail.journals?.length) &&
                    (old.watchers?.length === detail.watchers?.length)) return prev
                return prev.map(i => i.id === id ? detail : i)
            })
        } catch (e: any) {
            console.error(`Failed to fetch detail for issue ${id}`, e)
        }
    }, [])

    const updateIssue = useCallback(async (service: RedmineService, id: number, data: any) => {
        // Optimistic update: immediately apply changes to local state
        let previousIssue: Issue | undefined
        setAllIssues(prev => {
            const issue = prev.find(i => i.id === id)
            if (!issue) return prev
            previousIssue = issue
            
            // Create optimistic update with partial data
            const optimistic: Issue = {
                ...issue,
                ...(data.status_id !== undefined && { status: issue.status }), // Keep status object for now
                ...(data.priority_id !== undefined && { priority: issue.priority }),
                ...(data.assigned_to_id !== undefined && { assigned_to: issue.assigned_to }),
                ...(data.fixed_version_id !== undefined && { fixed_version: issue.fixed_version }),
                updated_on: new Date().toISOString(), // Mark as recently updated
            }
            
            // Apply specific field changes
            if (data.status_id !== undefined) {
                // Look up the real name so the change is visible immediately (IssueItem renders status.name),
                // instead of only updating id and waiting on the follow-up fetchIssueDetail call.
                const matchedStatus = issueStatusesRef.current.find(s => s.id === data.status_id)
                optimistic.status = matchedStatus ? { ...issue.status, ...matchedStatus } : { ...issue.status, id: data.status_id }
            }
            if (data.priority_id !== undefined) {
                const matchedPriority = issuePrioritiesRef.current.find(p => p.id === data.priority_id)
                optimistic.priority = matchedPriority ? { ...issue.priority, ...matchedPriority } : { ...issue.priority, id: data.priority_id }
            }
            if (data.assigned_to_id !== undefined) {
                optimistic.assigned_to = data.assigned_to_id 
                    ? { id: parseInt(data.assigned_to_id), name: '' } 
                    : undefined
            }
            if (data.fixed_version_id !== undefined) {
                optimistic.fixed_version = data.fixed_version_id
                    ? { id: parseInt(data.fixed_version_id), name: '' }
                    : undefined
            }
            if (data.subject !== undefined) {
                optimistic.subject = data.subject
            }
            
            return prev.map(i => i.id === id ? optimistic : i)
        })

        try {
            // Make API call in background
            await service.updateIssue(id, data)
            // Fetch fresh data from server to ensure consistency
            const updated = await service.fetchIssueDetail(id)
            setAllIssues(prev => prev.map(i => i.id === id ? updated : i))
        } catch (e: any) {
            // Revert optimistic update on failure
            if (previousIssue) {
                setAllIssues(prev => prev.map(i => i.id === id ? previousIssue! : i))
            }
            showToast.error(`Update failed: ${e.message}`)
        }
    }, [])

    const addNote = useCallback(async (service: RedmineService, id: number, note: string) => {
        await updateIssue(service, id, { notes: note })
    }, [updateIssue])

    const createIssue = useCallback(async (service: RedmineService, subject: string, projectId: number, versionId?: number, assignedToId?: number) => {
        setIsLoading(true)
        try {
            const newIssue = await service.createIssue({
                project_id: projectId,
                subject,
                fixed_version_id: versionId,
                assigned_to_id: assignedToId
            })
            setAllIssues(prev => [newIssue, ...prev])
            // Save to IndexedDB
            IssueCache.saveIssues([newIssue]).catch(e =>
                console.warn('[useIssues] Failed to save new issue to IndexedDB:', e)
            )
        } catch (e: any) {
            setErrorMessage(e.message)
        } finally {
            setIsLoading(false)
        }
    }, [])

    const deleteIssue = useCallback(async (service: RedmineService, issueId: number) => {
        try {
            await service.deleteIssue(issueId)
            setAllIssues(prev => prev.filter(i => i.id !== issueId))
        } catch (e: any) {
            setErrorMessage(`Failed to delete issue: ${e.message}`)
        }
    }, [])

    const addWatcher = useCallback(async (service: RedmineService, issueId: number, userId: number) => {
        try {
            await service.addWatcher(issueId, userId)
            if (currentUser && userId === currentUser.id) {
                setFollowedIssueIds(prev => new Set(prev).add(issueId))
            }
            await fetchIssueDetail(service, issueId)
        } catch (e: any) {
            setErrorMessage(`Failed to add watcher: ${e.message}`)
        }
    }, [currentUser, fetchIssueDetail])

    const removeWatcher = useCallback(async (service: RedmineService, issueId: number, userId: number) => {
        try {
            await service.removeWatcher(issueId, userId)
            if (currentUser && userId === currentUser.id) {
                setFollowedIssueIds(prev => { const next = new Set(prev); next.delete(issueId); return next })
            }
            await fetchIssueDetail(service, issueId)
        } catch (e: any) {
            setErrorMessage(`Failed to remove watcher: ${e.message}`)
        }
    }, [currentUser, fetchIssueDetail])

    const addAssignedWatcher = useCallback(async (service: RedmineService, issue: Issue, userId: number) => {
        try {
            const current = getAssignedWatchers(issue)
            const ids = current.map(a => a.id)
            if (ids.includes(userId)) return
            ids.push(userId)
            const field = getAssignedWatchersField(issue)
            if (!field) { setErrorMessage('Assigned watchers custom field not found'); return }
            await service.updateIssue(issue.id, { custom_fields: createAssignedWatchersUpdate(field.id, ids) })
            await fetchIssueDetail(service, issue.id)
        } catch (e: any) {
            setErrorMessage(`Failed to add assigned watcher: ${e.message}`)
        }
    }, [fetchIssueDetail])

    const removeAssignedWatcher = useCallback(async (service: RedmineService, issue: Issue, userId: number) => {
        try {
            const ids = getAssignedWatchers(issue).map(a => a.id).filter(id => id !== userId)
            const field = getAssignedWatchersField(issue)
            if (!field) { setErrorMessage('Assigned watchers custom field not found'); return }
            await service.updateIssue(issue.id, { custom_fields: createAssignedWatchersUpdate(field.id, ids) })
            await fetchIssueDetail(service, issue.id)
        } catch (e: any) {
            setErrorMessage(`Failed to remove assigned watcher: ${e.message}`)
        }
    }, [fetchIssueDetail])

    const openIssueById = useCallback(async (service: RedmineService, issueId: number) => {
        let issue = allIssues.find(i => i.id === issueId)
        if (!issue) {
            try {
                issue = await service.fetchIssueDetail(issueId)
                setAllIssues(prev => {
                    if (prev.some(i => i.id === issueId)) return prev.map(i => i.id === issueId ? issue! : i)
                    return [...prev, issue!]
                })
            } catch (e: any) {
                setErrorMessage(`Failed to fetch Issue #${issueId}: ${e.message}`)
                return null
            }
        }
        if (!issue?.project) return null
        return { projectId: issue.project.id, versionId: issue.fixed_version?.id || null, issueId }
    }, [allIssues])

    return {
        allIssues,
        currentUser,
        issueStatuses,
        issuePriorities,
        isLoading,
        isBackgroundRefreshing,
        errorMessage,
        followedIssueIds,
        loadInitialData,
        refreshIssues,
        fetchVersionIssues,
        fetchIssueDetail,
        updateIssue,
        addNote,
        createIssue,
        deleteIssue,
        addWatcher,
        removeWatcher,
        addAssignedWatcher,
        removeAssignedWatcher,
        openIssueById,
        setErrorMessage,
    }
}
