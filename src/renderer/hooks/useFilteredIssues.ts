import { useMemo, useCallback, useRef, useEffect } from 'react'
import { Issue } from '../models/redmine'
import { User, IssueStatus } from '../models/redmine'
import { getAssignedWatchers } from '../utils/assignedWatchers'
import { isVerified, isDevComplete } from '../constants/status'

export interface StatusCounts {
    dev: number
    done: number
    verified: number
}

export interface FilteredIssuesState {
    currentGroupedIssues: { groups: Record<string, Issue[]>; sortedKeys: string[] }
    getVersionViewData: (key: string) => { groups: Record<string, Issue[]>; sortedKeys: string[] }
    versionIssueCounts: Record<number, number>
    versionStatusCounts: Record<number, StatusCounts>
    followedStatusCounts: StatusCounts
    assignedStatusCounts: StatusCounts
    followedIssuesCount: number
    statusSortMap: Record<string, number>
}

interface UseFilteredIssuesParams {
    allIssues: Issue[]
    currentUser: User | null
    issueStatuses: IssueStatus[]
    followedIssueIds: Set<number>
    selectedProjectId: number | null
    selectedVersionId: number | null
    selectedAssigneeId: number | null
    selectedAssignedWatcherIds: Set<number>
    selectedStatusId: number | null
    searchQuery: string
    groupByMode: 'status' | 'assignee'
    hideVerifiedInFollowed: boolean
    hideVerifiedInAssigned: boolean
}

export function useFilteredIssues(params: UseFilteredIssuesParams): FilteredIssuesState {
    const {
        allIssues,
        currentUser,
        issueStatuses,
        followedIssueIds,
        selectedProjectId,
        selectedVersionId,
        selectedAssigneeId,
        selectedAssignedWatcherIds,
        selectedStatusId,
        searchQuery,
        groupByMode,
        hideVerifiedInFollowed,
        hideVerifiedInAssigned,
    } = params

    const statusSortMap = useMemo(() => {
        return issueStatuses.reduce((acc, s, idx) => ({ ...acc, [s.name]: idx }), {} as Record<string, number>)
    }, [issueStatuses])

    const versionIssueCounts = useMemo(() => {
        const counts: Record<number, number> = {}
        allIssues.forEach(i => {
            if (i.fixed_version?.id) {
                counts[i.fixed_version.id] = (counts[i.fixed_version.id] || 0) + 1
            }
        })
        return counts
    }, [allIssues])

    const versionStatusCounts = useMemo(() => {
        const counts: Record<number, StatusCounts> = {}
        allIssues.forEach(i => {
            if (selectedAssigneeId !== null && i.assigned_to?.id !== selectedAssigneeId) return
            if (i.fixed_version?.id) {
                const vid = i.fixed_version.id
                if (!counts[vid]) counts[vid] = { dev: 0, done: 0, verified: 0 }
                const sn = i.status.name
                if (isVerified(sn)) counts[vid].verified++
                else if (isDevComplete(sn)) counts[vid].done++
                else counts[vid].dev++
            }
        })
        return counts
    }, [allIssues, selectedAssigneeId])

    const followedStatusCounts = useMemo(() => {
        const sc: StatusCounts = { dev: 0, done: 0, verified: 0 }
        allIssues.forEach(i => {
            if (followedIssueIds.has(i.id)) {
                const sn = i.status.name
                if (isVerified(sn)) sc.verified++
                else if (isDevComplete(sn)) sc.done++
                else sc.dev++
            }
        })
        return sc
    }, [allIssues, followedIssueIds])

    const assignedStatusCounts = useMemo(() => {
        const sc: StatusCounts = { dev: 0, done: 0, verified: 0 }
        if (!currentUser) return sc
        allIssues.forEach(i => {
            if (i.assigned_to?.id === currentUser.id) {
                const sn = i.status.name
                if (isVerified(sn)) sc.verified++
                else if (isDevComplete(sn)) sc.done++
                else sc.dev++
            }
        })
        return sc
    }, [allIssues, currentUser])

    const followedIssuesCount = useMemo(() => followedIssueIds.size, [followedIssueIds])

    // --- Lazy versionViewData computation ---
    // Instead of computing ALL versions upfront, we:
    // 1. Compute only the currently active key
    // 2. Cache results so switching back is instant
    // 3. Invalidate cache when dependencies change

    // Cache for computed view data
    const viewDataCacheRef = useRef<Record<string, { groups: Record<string, Issue[]>; sortedKeys: string[] }>>({})
    const lastDepsRef = useRef('')

    // Compute current active key
    const activeViewKey = useMemo(() => {
        if (selectedProjectId === -2) return '-2'
        if (selectedProjectId === -3) return '-3'
        if (selectedVersionId) return selectedVersionId.toString()
        if (selectedProjectId !== null) return `p-${selectedProjectId}`
        return ''
    }, [selectedProjectId, selectedVersionId])

    // Check if dependencies changed and invalidate cache
    const depsString = JSON.stringify({
        selectedStatusId, searchQuery, selectedAssigneeId, selectedAssignedWatcherIds,
        followedIssueIds: Array.from(followedIssueIds), currentUserId: currentUser?.id,
        hideVerifiedInFollowed, hideVerifiedInAssigned, groupByMode, statusSortMap
    })

    if (depsString !== lastDepsRef.current) {
        lastDepsRef.current = depsString
        viewDataCacheRef.current = {} // Invalidate all cached data
    }

    // Helper: compute grouped data for a single key
    const computeForKey = useCallback((key: string) => {
        const filteredIssues = allIssues.filter(i => {
            const matchQuery = !searchQuery ||
                i.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
                i.id.toString().includes(searchQuery)
            if (!matchQuery) return false
            if (selectedStatusId && i.status.id !== selectedStatusId) return false

            // Check if issue belongs to this bucket
            if (key === '-2') {
                return followedIssueIds.has(i.id) &&
                    (!hideVerifiedInFollowed || !isVerified(i.status.name))
            }
            if (key === '-3') {
                return currentUser && i.assigned_to?.id === currentUser.id &&
                    (!hideVerifiedInAssigned || !isVerified(i.status.name))
            }
            if (key.startsWith('p-')) {
                const projectId = parseInt(key.slice(2))
                const matchAssignee = !selectedAssigneeId || i.assigned_to?.id === selectedAssigneeId
                const watchers = getAssignedWatchers(i)
                const matchWatchers = selectedAssignedWatcherIds.size === 0 ||
                    watchers.some(aw => selectedAssignedWatcherIds.has(aw.id))
                return matchAssignee && matchWatchers && i.project?.id === projectId
            }
            // Regular version bucket
            const versionId = parseInt(key)
            if (!isNaN(versionId) && i.fixed_version?.id === versionId) {
                const matchAssignee = !selectedAssigneeId || i.assigned_to?.id === selectedAssigneeId
                const watchers = getAssignedWatchers(i)
                const matchWatchers = selectedAssignedWatcherIds.size === 0 ||
                    watchers.some(aw => selectedAssignedWatcherIds.has(aw.id))
                return matchAssignee && matchWatchers
            }
            return false
        })

        // Group the filtered issues
        const groups: Record<string, Issue[]> = {}
        const keys: string[] = []

        if (groupByMode === 'assignee') {
            filteredIssues.forEach(i => {
                const name = i.assigned_to?.name || 'Unassigned'
                if (!groups[name]) { groups[name] = []; keys.push(name) }
                groups[name].push(i)
            })
            keys.sort((a, b) => {
                if (a === 'Unassigned') return 1
                if (b === 'Unassigned') return -1
                return a.localeCompare(b)
            })
        } else {
            filteredIssues.forEach(i => {
                const name = i.status.name
                if (!groups[name]) { groups[name] = []; keys.push(name) }
                groups[name].push(i)
            })
            keys.sort((a, b) => (statusSortMap[a] ?? 99) - (statusSortMap[b] ?? 99))
        }

        return { groups, sortedKeys: keys }
    }, [allIssues, selectedStatusId, searchQuery, selectedAssigneeId, selectedAssignedWatcherIds,
        followedIssueIds, currentUser, hideVerifiedInFollowed, hideVerifiedInAssigned, groupByMode, statusSortMap])

    // Get data for active key (compute if not cached)
    const currentGroupedIssues = useMemo(() => {
        if (!activeViewKey) return { groups: {}, sortedKeys: [] }
        return computeForKey(activeViewKey)
    }, [activeViewKey, computeForKey])

    // Store computed result in cache
    useEffect(() => {
        if (activeViewKey) {
            viewDataCacheRef.current[activeViewKey] = currentGroupedIssues
        }
    }, [activeViewKey, currentGroupedIssues])

    // versionViewData getter - returns cached or computes on demand
    const getVersionViewData = useCallback((key: string) => {
        if (viewDataCacheRef.current[key]) {
            return viewDataCacheRef.current[key]
        }
        // Compute on demand
        const data = computeForKey(key)
        viewDataCacheRef.current[key] = data
        return data
    }, [computeForKey])

    return {
        currentGroupedIssues,
        getVersionViewData,
        versionIssueCounts,
        versionStatusCounts,
        followedStatusCounts,
        assignedStatusCounts,
        followedIssuesCount,
        statusSortMap,
    }
}
