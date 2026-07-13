import { useState, useCallback, useMemo } from 'react'
import { RedmineService } from '../services/RedmineService'
import { Project, Version } from '../models/redmine'

export interface ProjectMembers {
    id: number
    name: string
    groups: string[]
}

export interface ProjectsState {
    projects: Project[]
    projectVersionsMap: Record<number, Version[]>
    projectMembersMap: Record<number, ProjectMembers[]>
    pinnedVersionIds: Set<number>
    activeVersionIds: Set<number>
    initializedProjects: Set<number>
}

export interface ProjectsActions {
    loadProjects: (service: RedmineService) => Promise<void>
    fetchProjectDetails: (projectId: number, service: RedmineService) => void
    togglePinVersion: (projectId: number, versionId: number) => void
    toggleVersionActive: (versionId: number) => void
    setActiveVersionIds: (updater: (prev: Set<number>) => Set<number>) => void
    createVersion: (service: RedmineService, projectId: number, name: string) => Promise<Version | undefined>
    deleteVersion: (service: RedmineService, projectId: number, versionId: number) => Promise<void>
    updateVersion: (service: RedmineService, projectId: number, versionId: number, data: any) => Promise<void>
}

function loadSetFromStorage(key: string): Set<number> {
    try {
        const raw = localStorage.getItem(key)
        return raw ? new Set(JSON.parse(raw)) : new Set()
    } catch {
        return new Set()
    }
}

function sortVersions(versions: Version[], pinnedIds: Set<number>): Version[] {
    return [...versions].sort((a, b) => {
        const aPinned = pinnedIds.has(a.id)
        const bPinned = pinnedIds.has(b.id)
        if (aPinned !== bPinned) return aPinned ? -1 : 1
        const aIsDigit = /^\d/.test(a.name)
        const bIsDigit = /^\d/.test(b.name)
        if (aIsDigit !== bIsDigit) return aIsDigit ? -1 : 1
        return b.name.localeCompare(a.name, undefined, { numeric: true })
    })
}

export function useProjects(): ProjectsState & ProjectsActions {
    const [projects, setProjects] = useState<Project[]>([])
    const [projectVersionsMap, setProjectVersionsMap] = useState<Record<number, Version[]>>({})
    const [projectMembersMap, setProjectMembersMap] = useState<Record<number, ProjectMembers[]>>({})
    const [pinnedVersionIds, setPinnedVersionIds] = useState<Set<number>>(() => loadSetFromStorage('pinnedVersionIds'))
    const [activeVersionIds, setActiveVersionIds] = useState<Set<number>>(() => loadSetFromStorage('cachedActiveVersionIds'))
    const [initializedProjects, setInitializedProjects] = useState<Set<number>>(() => loadSetFromStorage('cachedInitializedProjects'))

    // Persist state
    const persistSetActiveVersionIds = useCallback((updater: (prev: Set<number>) => Set<number>) => {
        setActiveVersionIds(prev => {
            const next = updater(prev)
            localStorage.setItem('cachedActiveVersionIds', JSON.stringify(Array.from(next)))
            return next
        })
    }, [])

    const persistSetInitializedProjects = useCallback((updater: (prev: Set<number>) => Set<number>) => {
        setInitializedProjects(prev => {
            const next = updater(prev)
            localStorage.setItem('cachedInitializedProjects', JSON.stringify(Array.from(next)))
            return next
        })
    }, [])

    const loadProjects = useCallback(async (service: RedmineService) => {
        const projectsData = await service.fetchProjects()
        setProjects(projectsData)

        await Promise.allSettled(projectsData.map(async p => {
            try {
                const [versions, members] = await Promise.all([
                    service.fetchVersions(p.id),
                    service.fetchAssignableUsers(p.id)
                ])

                const sorted = sortVersions(versions, pinnedVersionIds)
                setProjectVersionsMap(prev => ({ ...prev, [p.id]: sorted }))
                setProjectMembersMap(prev => ({ ...prev, [p.id]: members }))

                persistSetInitializedProjects(prev => {
                    if (prev.has(p.id)) return prev
                    const next = new Set(prev)
                    next.add(p.id)
                    persistSetActiveVersionIds(prevActive => {
                        const newActive = new Set(prevActive)
                        sorted.slice(0, 3).forEach(v => newActive.add(v.id))
                        return newActive
                    })
                    return next
                })
            } catch (e) {
                console.error(`Failed to fetch details for project ${p.id}`, e)
            }
        }))
    }, [pinnedVersionIds, persistSetInitializedProjects, persistSetActiveVersionIds])

    const fetchProjectDetails = useCallback((projectId: number, service: RedmineService) => {
        service.fetchVersions(projectId).then(versions => {
            setProjectVersionsMap(prev => ({
                ...prev,
                [projectId]: sortVersions(versions, pinnedVersionIds)
            }))
        }).catch(e => console.error(`Failed to fetch versions for project ${projectId}`, e))

        service.fetchAssignableUsers(projectId).then(members => {
            setProjectMembersMap(prev => ({ ...prev, [projectId]: members }))
        }).catch(e => console.error(`Failed to fetch members for project ${projectId}`, e))
    }, [pinnedVersionIds])

    const togglePinVersion = useCallback((projectId: number, versionId: number) => {
        setPinnedVersionIds(prev => {
            const next = new Set(prev)
            if (next.has(versionId)) next.delete(versionId)
            else next.add(versionId)
            localStorage.setItem('pinnedVersionIds', JSON.stringify(Array.from(next)))

            setProjectVersionsMap(currentMap => {
                const versions = currentMap[projectId]
                if (!versions) return currentMap
                return { ...currentMap, [projectId]: sortVersions(versions, next) }
            })
            return next
        })
    }, [])

    const toggleVersionActive = useCallback((versionId: number) => {
        persistSetActiveVersionIds(prev => {
            const next = new Set(prev)
            if (next.has(versionId)) next.delete(versionId)
            else next.add(versionId)
            return next
        })
    }, [persistSetActiveVersionIds])

    const createVersion = useCallback(async (service: RedmineService, projectId: number, name: string) => {
        const newVersion = await service.createVersion(projectId, name)
        setProjectVersionsMap(prev => ({
            ...prev,
            [projectId]: [newVersion, ...(prev[projectId] || [])]
        }))
        return newVersion
    }, [])

    const deleteVersion = useCallback(async (service: RedmineService, projectId: number, versionId: number) => {
        await service.deleteVersion(versionId)
        setProjectVersionsMap(prev => ({
            ...prev,
            [projectId]: (prev[projectId] || []).filter(v => v.id !== versionId)
        }))
    }, [])

    const updateVersion = useCallback(async (service: RedmineService, projectId: number, versionId: number, data: any) => {
        await service.updateVersion(versionId, data)
        const versions = await service.fetchVersions(projectId)
        setProjectVersionsMap(prev => ({
            ...prev,
            [projectId]: sortVersions(versions, pinnedVersionIds)
        }))
    }, [pinnedVersionIds])

    return {
        projects,
        projectVersionsMap,
        projectMembersMap,
        pinnedVersionIds,
        activeVersionIds,
        initializedProjects,
        loadProjects,
        fetchProjectDetails,
        togglePinVersion,
        toggleVersionActive,
        setActiveVersionIds: persistSetActiveVersionIds,
        createVersion,
        deleteVersion,
        updateVersion,
    }
}
