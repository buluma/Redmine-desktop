import { useState, useCallback, useMemo, useEffect } from 'react'
import { RedmineService } from '../services/RedmineService'
import { Issue } from '../models/redmine'
import { useSettings } from './useSettings'
import { useProjects } from './useProjects'
import { useIssues } from './useIssues'
import { useSearch } from './useSearch'
import { useFilteredIssues } from './useFilteredIssues'
import { getAssignedWatchers } from '../utils/assignedWatchers'
import { isComplete, getPriorityUrgency } from '../constants/status'

/**
 * Main ViewModel hook that composes smaller, focused hooks.
 *
 * This hook is a thin orchestrator:
 * - useSettings: connection & UI preferences
 * - useProjects: project/version/member data
 * - useIssues: issue data, CRUD, watchers
 * - useSearch: search state & remote search
 * - useFilteredIssues: derived grouping, counts, filtering
 */
export function useAppViewModel() {
    const settings = useSettings()
    const projects = useProjects()
    const issues = useIssues()
    const search = useSearch()

    const [selectedProjectId, setSelectedProjectId] = useState<number | null>(() => {
        const saved = localStorage.getItem('lastSelectedProjectId')
        return saved ? parseInt(saved, 10) : -1
    })
    const [selectedVersionId, setSelectedVersionId] = useState<number | null>(() => {
        const saved = localStorage.getItem('lastSelectedVersionId')
        return saved ? parseInt(saved, 10) : null
    })
    const [selectedAssigneeId, setSelectedAssigneeId] = useState<number | null>(() => {
        const saved = localStorage.getItem('lastSelectedAssigneeId')
        return saved ? parseInt(saved, 10) : null
    })
    const [groupByMode, setGroupByMode] = useState<'status' | 'assignee'>(() => {
        const saved = localStorage.getItem('groupByMode')
        return saved === 'assignee' ? 'assignee' : 'status'
    })
    const [selectedAssignedWatcherIds, setSelectedAssignedWatcherIds] = useState<Set<number>>(() => {
        const saved = localStorage.getItem('selectedAssignedWatcherIds')
        return saved ? new Set(JSON.parse(saved)) : new Set()
    })
    const [selectedStatusId, setSelectedStatusId] = useState<number | null>(null)
    const [hideVerifiedInFollowed, setHideVerifiedInFollowed] = useState<boolean>(() => {
        return localStorage.getItem('hideVerifiedInFollowed') === 'true'
    })
    const [hideVerifiedInAssigned, setHideVerifiedInAssigned] = useState<boolean>(() => {
        return localStorage.getItem('hideVerifiedInAssigned') === 'true'
    })

    // Create service instance
    const service = useMemo(() => {
        if (settings.redmineURL && settings.redmineAPIKey) {
            return new RedmineService(settings.redmineURL, settings.redmineAPIKey)
        }
        return null
    }, [settings.redmineURL, settings.redmineAPIKey])

    // Persist selection state
    useEffect(() => {
        if (settings.isConfigured) {
            if (selectedProjectId !== null) localStorage.setItem('lastSelectedProjectId', selectedProjectId.toString())
            else localStorage.removeItem('lastSelectedProjectId')
            if (selectedVersionId !== null) localStorage.setItem('lastSelectedVersionId', selectedVersionId.toString())
            else localStorage.removeItem('lastSelectedVersionId')
            if (selectedAssigneeId !== null) localStorage.setItem('lastSelectedAssigneeId', selectedAssigneeId.toString())
            else localStorage.removeItem('lastSelectedAssigneeId')
        }
        localStorage.setItem('pinnedVersionIds', JSON.stringify(Array.from(projects.pinnedVersionIds)))
        localStorage.setItem('selectedAssignedWatcherIds', JSON.stringify(Array.from(selectedAssignedWatcherIds)))
        localStorage.setItem('hideVerifiedInFollowed', hideVerifiedInFollowed.toString())
        localStorage.setItem('hideVerifiedInAssigned', hideVerifiedInAssigned.toString())
        localStorage.setItem('groupByMode', groupByMode)
    }, [selectedProjectId, selectedVersionId, selectedAssigneeId, selectedAssignedWatcherIds,
        settings.isConfigured, projects.pinnedVersionIds, hideVerifiedInFollowed, hideVerifiedInAssigned, groupByMode])

    // Load initial data on config
    useEffect(() => {
        if (service && settings.isConfigured) {
            if (settings.redmineURL) {
                (window as any).ipcRenderer?.send('save-redmine-url', settings.redmineURL)
            }
            issues.loadInitialData(service, projects.pinnedVersionIds).then(() => {
                projects.loadProjects(service)
            })
        }
    }, [service, settings.isConfigured])

    // Fetch project details when project changes
    useEffect(() => {
        if (settings.isConfigured && selectedProjectId && selectedProjectId > 0 && service) {
            projects.fetchProjectDetails(selectedProjectId, service)
        }
    }, [selectedProjectId, service, settings.isConfigured])

    // Refresh issues on config/assignee change
    useEffect(() => {
        if (settings.isConfigured && service) {
            issues.refreshIssues(service, projects.activeVersionIds)
        }
    }, [settings.isConfigured, selectedAssigneeId, service, projects.activeVersionIds])

    // Periodic background refresh
    useEffect(() => {
        if (!settings.isConfigured || settings.refreshInterval <= 0 || !service) return
        const intervalId = setInterval(() => {
            issues.refreshIssues(service, projects.activeVersionIds)
        }, settings.refreshInterval * 1000)
        return () => clearInterval(intervalId)
    }, [settings.isConfigured, settings.refreshInterval, service, projects.activeVersionIds])

    // Badge update
    useEffect(() => {
        if (!issues.currentUser) return
        if (settings.showBadge) {
            const myIssues = issues.allIssues.filter(i =>
                i.assigned_to?.id === issues.currentUser!.id && !isComplete(i.status.name)
            )
            const count = myIssues.length
            let urgency: 'none' | 'low' | 'medium' | 'high' = 'low'
            if (count > 0) {
                const highest = myIssues.reduce<'low' | 'medium' | 'high'>((acc, i) => {
                    const u = getPriorityUrgency(i.priority?.name || '')
                    if (u === 'high') return 'high'
                    if (u === 'medium' && acc !== 'high') return 'medium'
                    return acc
                }, 'low')
                urgency = highest
            }
            ;(window as any).ipcRenderer?.send('update-badge', { count, urgency })
        } else {
            ;(window as any).ipcRenderer?.send('update-badge', { count: 0, urgency: 'none' })
        }
    }, [issues.allIssues, settings.showBadge, issues.currentUser])

    // Remote search effect
    useEffect(() => {
        if (search.searchMode !== 'remote' || !service) return
        if (!search.searchQuery.trim()) return

        const timer = setTimeout(() => {
            search.performRemoteSearch(service, search.searchQuery)
        }, 500)
        return () => clearTimeout(timer)
    }, [search.searchQuery, search.searchMode, service])

    // Derived data
    const filtered = useFilteredIssues({
        allIssues: issues.allIssues,
        currentUser: issues.currentUser,
        issueStatuses: issues.issueStatuses,
        followedIssueIds: issues.followedIssueIds,
        selectedProjectId,
        selectedVersionId,
        selectedAssigneeId,
        selectedAssignedWatcherIds,
        selectedStatusId,
        searchQuery: search.searchQuery,
        groupByMode,
        hideVerifiedInFollowed,
        hideVerifiedInAssigned,
    })

    const globalMembers = useMemo(() => {
        const memberMap = new Map<number, { id: number; name: string; groups: string[] }>()
        const addUser = (u: any, groups?: string[]) => {
            if (!u?.id) return
            const existing = memberMap.get(u.id)
            const name = u.name || (u.firstname && u.lastname ? `${u.firstname} ${u.lastname}` : u.firstname || u.lastname || 'Unknown')
            if (existing) {
                if (groups) groups.forEach(g => { if (!existing.groups.includes(g)) existing.groups.push(g) })
            } else {
                memberMap.set(u.id, { id: u.id, name, groups: groups || [] })
            }
        }
        Object.values(projects.projectMembersMap).flat().forEach(m => addUser(m, m.groups))
        issues.allIssues.forEach(i => {
            addUser(i.assigned_to)
            addUser(i.author)
            getAssignedWatchers(i).forEach(aw => addUser(aw))
        })
        return Array.from(memberMap.values()).sort((a, b) => a.name.localeCompare(b.name))
    }, [projects.projectMembersMap, issues.allIssues])

    // Wrapper functions that bind service
    const updateIssue = useCallback((id: number, data: any) => {
        if (!service) return
        return issues.updateIssue(service, id, data)
    }, [service, issues.updateIssue])

    const addNote = useCallback(async (id: number, note: string) => {
        if (!service) return
        await issues.addNote(service, id, note)
    }, [service, issues.addNote])

    const createIssue = useCallback((subject: string, projectId: number, versionId?: number, assignedToId?: number) => {
        if (!service) return
        return issues.createIssue(service, subject, projectId, versionId, assignedToId)
    }, [service, issues.createIssue])

    const deleteIssue = useCallback((issueId: number) => {
        if (!service) return
        return issues.deleteIssue(service, issueId)
    }, [service, issues.deleteIssue])

    const addWatcher = useCallback((issueId: number, userId: number) => {
        if (!service) return
        return issues.addWatcher(service, issueId, userId)
    }, [service, issues.addWatcher])

    const removeWatcher = useCallback((issueId: number, userId: number) => {
        if (!service) return
        return issues.removeWatcher(service, issueId, userId)
    }, [service, issues.removeWatcher])

    const addAssignedWatcher = useCallback((issue: Issue, userId: number) => {
        if (!service) return
        return issues.addAssignedWatcher(service, issue, userId)
    }, [service, issues.addAssignedWatcher])

    const removeAssignedWatcher = useCallback((issue: Issue, userId: number) => {
        if (!service) return
        return issues.removeAssignedWatcher(service, issue, userId)
    }, [service, issues.removeAssignedWatcher])

    const fetchIssueDetail = useCallback((id: number) => {
        if (!service) return
        return issues.fetchIssueDetail(service, id)
    }, [service, issues.fetchIssueDetail])

    const fetchVersionIssues = useCallback((versionId: number) => {
        if (!service) return
        return issues.fetchVersionIssues(service, versionId)
    }, [service, issues.fetchVersionIssues])

    const openIssueById = useCallback((issueId: number) => {
        if (!service) return Promise.resolve(null)
        return issues.openIssueById(service, issueId)
    }, [service, issues.openIssueById])

    const refreshData = useCallback(() => {
        if (!service) return
        return issues.refreshIssues(service, projects.activeVersionIds)
    }, [service, issues.refreshIssues, projects.activeVersionIds])

    const toggleVersionActive = useCallback(async (versionId: number) => {
        projects.toggleVersionActive(versionId)
        const isActivating = !projects.activeVersionIds.has(versionId)
        if (isActivating && service) {
            await fetchVersionIssues(versionId)
        }
    }, [projects.toggleVersionActive, projects.activeVersionIds, service, fetchVersionIssues])

    const createVersion = useCallback((projectId: number, name: string) => {
        if (!service) return
        return projects.createVersion(service, projectId, name)
    }, [service, projects.createVersion])

    const deleteVersion = useCallback((projectId: number, versionId: number) => {
        if (!service) return
        return projects.deleteVersion(service, projectId, versionId)
    }, [service, projects.deleteVersion])

    const updateVersion = useCallback((projectId: number, versionId: number, data: any) => {
        if (!service) return
        return projects.updateVersion(service, projectId, versionId, data)
    }, [service, projects.updateVersion])

    const selectProject = useCallback((projectId: number | null) => {
        setSelectedProjectId(projectId)
        setSelectedVersionId(null)
    }, [])

    const selectVersion = useCallback((projectId: number, versionId: number | null) => {
        setSelectedProjectId(projectId)
        setSelectedVersionId(versionId)
    }, [])

    const uploadAttachment = useCallback(async (file: File) => {
        if (!service) return null
        try {
            return await service.uploadFile(file)
        } catch (e: any) {
            issues.setErrorMessage(`Upload failed: ${e.message}`)
            return null
        }
    }, [service, issues.setErrorMessage])

    const fetchImageBlob = useCallback((url: string) => {
        return service?.fetchImageBlob(url)
    }, [service])

    return {
        // Redmine service instance (null until URL + API key are configured)
        service,

        // Settings
        isConfigured: settings.isConfigured,
        saveSettings: settings.saveSettings,
        redmineURL: settings.redmineURL,
        redmineAPIKey: settings.redmineAPIKey,
        refreshInterval: settings.refreshInterval,
        setRefreshInterval: settings.setRefreshInterval,
        enableTransparency: settings.enableTransparency,
        setEnableTransparency: settings.setEnableTransparency,
        appTheme: settings.appTheme,
        setAppTheme: settings.setAppTheme,
        showBadge: settings.showBadge,
        setShowBadge: settings.setShowBadge,

        // Projects
        projects: projects.projects,
        projectVersionsMap: projects.projectVersionsMap,
        projectMembersMap: projects.projectMembersMap,
        pinnedVersionIds: projects.pinnedVersionIds,
        togglePinVersion: projects.togglePinVersion,
        activeVersionIds: projects.activeVersionIds,
        toggleVersionActive,

        // Issues
        allIssues: issues.allIssues,
        currentUser: issues.currentUser,
        issueStatuses: issues.issueStatuses,
        issuePriorities: issues.issuePriorities,
        isLoading: issues.isLoading,
        isBackgroundRefreshing: issues.isBackgroundRefreshing,
        errorMessage: issues.errorMessage,
        followedIssueIds: issues.followedIssueIds,

        // Search
        searchQuery: search.searchQuery,
        setSearchQuery: search.setSearchQuery,
        searchMode: search.searchMode,
        setSearchMode: search.setSearchMode,
        remoteSearchResults: search.remoteSearchResults,
        remoteSearchTotalCount: search.remoteSearchTotalCount,
        isSearching: search.isSearching,

        // Selection
        selectedProjectId,
        selectProject,
        selectedVersionId,
        selectVersion,
        selectedAssigneeId,
        setSelectedAssigneeId,
        selectedAssignedWatcherIds,
        setSelectedAssignedWatcherIds,
        selectedStatusId,
        setSelectedStatusId,
        groupByMode,
        setGroupByMode,
        hideVerifiedInFollowed,
        setHideVerifiedInFollowed,
        hideVerifiedInAssigned,
        setHideVerifiedInAssigned,

        // Filtered data
        groupedIssues: filtered.currentGroupedIssues,
        versionViewData: filtered.versionViewData,
        versionIssueCounts: filtered.versionIssueCounts,
        versionStatusCounts: filtered.versionStatusCounts,
        followedStatusCounts: filtered.followedStatusCounts,
        assignedStatusCounts: filtered.assignedStatusCounts,
        followedIssuesCount: filtered.followedIssuesCount,

        // Actions
        updateIssue,
        addNote,
        addWatcher,
        removeWatcher,
        addAssignedWatcher,
        removeAssignedWatcher,
        createIssue,
        deleteIssue,
        refreshData,
        fetchIssueDetail,
        fetchVersionIssues,
        createVersion,
        updateVersion,
        deleteVersion,
        globalMembers,
        uploadAttachment,
        fetchImageBlob,
        openIssueById,
    }
}
