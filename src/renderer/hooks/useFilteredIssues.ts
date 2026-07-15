import { useMemo } from 'react'
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
    versionViewData: Record<string, { groups: Record<string, Issue[]>; sortedKeys: string[] }>
    currentGroupedIssues: { groups: Record<string, Issue[]>; sortedKeys: string[] }
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

    const versionViewData = useMemo(() => {
        const baseFiltered = allIssues.filter(i => {
            const matchQuery = !searchQuery ||
                i.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
                i.id.toString().includes(searchQuery)
            if (!matchQuery) return false
            if (selectedStatusId && i.status.id !== selectedStatusId) return false
            return true
        })

        const buckets: Record<string, Issue[]> = {}
        const addToBucket = (key: string, issue: Issue) => {
            if (!buckets[key]) buckets[key] = []
            buckets[key].push(issue)
        }

        const matchFilters = (i: Issue) => {
            const matchAssignee = !selectedAssigneeId || i.assigned_to?.id === selectedAssigneeId
            const watchers = getAssignedWatchers(i)
            const matchWatchers = selectedAssignedWatcherIds.size === 0 ||
                watchers.some(aw => selectedAssignedWatcherIds.has(aw.id))
            return matchAssignee && matchWatchers
        }

        baseFiltered.forEach(i => {
            if (i.fixed_version?.id && matchFilters(i)) {
                addToBucket(i.fixed_version.id.toString(), i)
            }
            if (matchFilters(i) && i.project?.id) {
                addToBucket(`p-${i.project.id}`, i)
            }
            if (matchFilters(i)) {
                addToBucket('p--1', i)
            }
            if (followedIssueIds.has(i.id)) {
                if (!hideVerifiedInFollowed || !isVerified(i.status.name)) {
                    addToBucket('-2', i)
                }
            }
            if (currentUser && i.assigned_to?.id === currentUser.id) {
                if (!hideVerifiedInAssigned || !isVerified(i.status.name)) {
                    addToBucket('-3', i)
                }
            }
        })

        const result: Record<string, { groups: Record<string, Issue[]>; sortedKeys: string[] }> = {}

        Object.keys(buckets).forEach(key => {
            const issues = buckets[key]
            const groups: Record<string, Issue[]> = {}
            const keys: string[] = []

            if (groupByMode === 'assignee') {
                issues.forEach(i => {
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
                issues.forEach(i => {
                    const name = i.status.name
                    if (!groups[name]) { groups[name] = []; keys.push(name) }
                    groups[name].push(i)
                })
                keys.sort((a, b) => (statusSortMap[a] ?? 99) - (statusSortMap[b] ?? 99))
            }
            result[key] = { groups, sortedKeys: keys }
        })

        return result
    }, [allIssues, selectedStatusId, searchQuery, selectedAssigneeId, selectedAssignedWatcherIds,
        followedIssueIds, currentUser, hideVerifiedInFollowed, hideVerifiedInAssigned, groupByMode, statusSortMap])

    const currentGroupedIssues = useMemo(() => {
        let key = ''
        if (selectedProjectId === -2) key = '-2'
        else if (selectedProjectId === -3) key = '-3'
        else if (selectedVersionId) key = selectedVersionId.toString()
        else if (selectedProjectId !== null) key = `p-${selectedProjectId}`
        return versionViewData[key] || { groups: {}, sortedKeys: [] }
    }, [versionViewData, selectedProjectId, selectedVersionId])

    return {
        versionViewData,
        currentGroupedIssues,
        versionIssueCounts,
        versionStatusCounts,
        followedStatusCounts,
        assignedStatusCounts,
        followedIssuesCount,
        statusSortMap,
    }
}
