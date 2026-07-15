import { useState, useEffect, useCallback, useMemo, useRef, startTransition } from 'react';
import { RedmineService } from '../services/RedmineService';
import { Project, Issue, Version, User, IssueStatus, IssuePriority } from '../models/redmine';
import { getAssignedWatchers, getAssignedWatchersField, createAssignedWatchersUpdate } from '../utils/assignedWatchers';
import { showToast } from '../components/Toast';
import * as IssueCache from '../services/IssueCache';
import { log } from '../utils/log';

export function useAppViewModel() {
    const [redmineURL, setRedmineURL] = useState(localStorage.getItem('redmineURL') || '');
    const [redmineAPIKey, setRedmineAPIKey] = useState(localStorage.getItem('redmineAPIKey') || '');
    const [refreshInterval, setRefreshInterval] = useState(parseInt(localStorage.getItem('refreshInterval') || '300', 10));
    const [transparencyLevel, setTransparencyLevel] = useState(() => {
        const stored = localStorage.getItem('transparencyLevel');
        if (stored !== null) return Number(stored);
        // Legacy on/off toggle: migrate "on" to a level roughly matching its old fixed alpha.
        return localStorage.getItem('enableTransparency') === 'true' ? 35 : 0;
    });
    const [appTheme, setAppTheme] = useState(localStorage.getItem('appTheme') || 'dark');
    const [showBadge, setShowBadge] = useState(localStorage.getItem('showBadge') === 'true');

    // Explicitly track if the user has successfully configured and saved
    const [isConfigured, setIsConfigured] = useState(!!(redmineURL && redmineAPIKey));

    // Load secure key on mount
    useEffect(() => {
        const loadSecureKey = async () => {
            if (localStorage.getItem('hasSecureKey') === 'true') {
                try {
                    const secureKey = await window.secureStore?.retrieve('redmineAPIKey');
                    if (secureKey && !redmineAPIKey) {
                        setRedmineAPIKey(secureKey);
                        setIsConfigured(!!(redmineURL && secureKey));
                    }
                } catch (e) {
                    console.warn('Failed to load secure key:', e);
                }
                // Secure storage is now authoritative for this key; clear any lingering
                // plaintext copy so it doesn't sit in localStorage indefinitely.
                localStorage.removeItem('redmineAPIKey');
            } else {
                // Migrate a legacy plaintext key (saved before secure storage existed)
                // into secure storage, then remove the plaintext copy.
                const legacyKey = localStorage.getItem('redmineAPIKey');
                if (legacyKey) {
                    try {
                        await window.secureStore?.store('redmineAPIKey', legacyKey);
                        localStorage.setItem('hasSecureKey', 'true');
                        localStorage.removeItem('redmineAPIKey');
                    } catch (e) {
                        console.warn('Failed to migrate legacy API key to secure storage:', e);
                    }
                }
            }
        };
        loadSecureKey();
    }, []);

    const isRefreshingRef = useRef(false);

    const [projects, setProjects] = useState<Project[]>([]);
    // IndexedDB loading is async, so we start empty and load in an effect below.
    const [allIssues, setAllIssues] = useState<Issue[]>([]);
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [issueStatuses, setIssueStatuses] = useState<IssueStatus[]>([]);
    const [issuePriorities, setIssuePriorities] = useState<IssuePriority[]>([]);
    const [projectVersionsMap, setProjectVersionsMap] = useState<Record<number, Version[]>>({});
    const [projectMembersMap, setProjectMembersMap] = useState<Record<number, { id: number; name: string; groups: string[] }[]>>({});
    const [pinnedVersionIds, setPinnedVersionIds] = useState<Set<number>>(() => {
        const saved = localStorage.getItem('pinnedVersionIds');
        return saved ? new Set(JSON.parse(saved)) : new Set();
    });
    // Track which versions are "active" (should be loaded and auto-refreshed)
    // Default: top 3 versions by name (descending) + user-added versions
    const [activeVersionIds, setActiveVersionIds] = useState<Set<number>>(() => {
        try {
            const cached = localStorage.getItem('cachedActiveVersionIds');
            return cached ? new Set(JSON.parse(cached)) : new Set();
        } catch {
            return new Set();
        }
    });
    // Track if we've initialized active versions for each project
    const [initializedProjects, setInitializedProjects] = useState<Set<number>>(() => {
        try {
            const cached = localStorage.getItem('cachedInitializedProjects');
            return cached ? new Set(JSON.parse(cached)) : new Set();
        } catch {
            return new Set();
        }
    });

    const [selectedProjectId, setSelectedProjectId] = useState<number | null>(() => {
        const saved = localStorage.getItem('lastSelectedProjectId');
        return saved ? parseInt(saved, 10) : -1;
    });

    const [selectedVersionId, setSelectedVersionId] = useState<number | null>(() => {
        const saved = localStorage.getItem('lastSelectedVersionId');
        return saved ? parseInt(saved, 10) : null;
    });

    const [searchQuery, setSearchQuery] = useState('');
    const [searchMode, setSearchMode] = useState<'local' | 'remote'>('local');
    const [remoteSearchResults, setRemoteSearchResults] = useState<Issue[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [remoteSearchTotalCount, setRemoteSearchTotalCount] = useState(0);
    const [selectedAssigneeId, setSelectedAssigneeId] = useState<number | null>(() => {
        const saved = localStorage.getItem('lastSelectedAssigneeId');
        return saved ? parseInt(saved, 10) : null;
    });
    const [groupByMode, setGroupByMode] = useState<'status' | 'assignee'>(() => {
        const saved = localStorage.getItem('groupByMode');
        return saved === 'assignee' ? 'assignee' : 'status';
    });
    // Assigned watcher filter
    const [selectedAssignedWatcherIds, setSelectedAssignedWatcherIds] = useState<Set<number>>(() => {
        const saved = localStorage.getItem('selectedAssignedWatcherIds');
        return saved ? new Set(JSON.parse(saved)) : new Set();
    });
    const [selectedStatusId, setSelectedStatusId] = useState<number | null>(null);
    // IndexedDB loading is async, so we start empty and load in an effect below.
    const [followedIssueIds, setFollowedIssueIds] = useState<Set<number>>(new Set());
    const [hideVerifiedInFollowed, setHideVerifiedInFollowed] = useState<boolean>(() => {
        const saved = localStorage.getItem('hideVerifiedInFollowed');
        return saved === 'true';
    });
    const [hideVerifiedInAssigned, setHideVerifiedInAssigned] = useState<boolean>(() => {
        const saved = localStorage.getItem('hideVerifiedInAssigned');
        return saved === 'true';
    });

    const followedIssueIdsRef = useRef(followedIssueIds);
    useEffect(() => {
        followedIssueIdsRef.current = followedIssueIds;
    }, [followedIssueIds]);

    const issueStatusesRef = useRef(issueStatuses);
    useEffect(() => {
        issueStatusesRef.current = issueStatuses;
    }, [issueStatuses]);

    const issuePrioritiesRef = useRef(issuePriorities);
    useEffect(() => {
        issuePrioritiesRef.current = issuePriorities;
    }, [issuePriorities]);

    // Tracks which Issue fields have an in-flight optimistic update per issue id,
    // so a concurrent update's rollback or success only touches its own field(s)
    // instead of replacing the whole issue object and clobbering another
    // concurrent update that's still in flight or already landed.
    const pendingFieldsRef = useRef<Record<number, Set<keyof Issue>>>({});

    // Tracks whether a network refresh has already populated allIssues, so the
    // (slower) IndexedDB cache-load effect below doesn't clobber fresher state
    // with a stale cached snapshot if it resolves afterwards.
    const hasSetIssuesFromNetworkRef = useRef(false);

    // Load cache from IndexedDB on mount (migrating any legacy localStorage cache first)
    useEffect(() => {
        const loadCache = async () => {
            try {
                const migrated = await IssueCache.migrateFromLocalStorage();
                if (migrated > 0) {
                    log.debug(`[useAppViewModel] Migrated ${migrated} issues from localStorage`);
                }

                const cachedIssues = await IssueCache.getAllIssues();
                if (cachedIssues.length > 0 && !hasSetIssuesFromNetworkRef.current) {
                    setAllIssues(cachedIssues);
                }

                const followedRaw = await IssueCache.getMeta('followedIssueIds');
                if (followedRaw) {
                    setFollowedIssueIds(new Set(JSON.parse(followedRaw)));
                }
            } catch (e) {
                console.warn('[useAppViewModel] Failed to load cache from IndexedDB:', e);
            }

            // Non-critical bookkeeping; runs after the active cache is loaded so it
            // never competes with startup, and never touches the active server's db.
            IssueCache.cleanupStaleServerCaches().catch(e =>
                console.warn('[useAppViewModel] Failed to clean up stale server caches:', e)
            );
        };
        loadCache();
    }, []);

    const [isLoading, setIsLoading] = useState(false);
    const [isBackgroundRefreshing, setIsBackgroundRefreshing] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    // Remote search debounce timer
    const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const service = useMemo(() => {
        if (redmineURL && redmineAPIKey) {
            return new RedmineService(redmineURL, redmineAPIKey);
        }
        return null;
    }, [redmineURL, redmineAPIKey]);

    const loadInitialData = useCallback(async () => {
        if (!service) return;
        setIsLoading(true);
        setErrorMessage(null);
        try {
            const [user, statuses, priorities, projectsData] = await Promise.all([
                service.fetchCurrentUser(),
                service.fetchIssueStatuses(),
                service.fetchIssuePriorities(),
                service.fetchProjects()
            ]);
            setCurrentUser(user);
            setIssueStatuses(statuses);
            setIssuePriorities(priorities);
            setProjects(projectsData);

            // Fetch versions and members for all projects
            await Promise.allSettled(projectsData.map(async p => {
                try {
                    const [versions, members] = await Promise.all([
                        service.fetchVersions(p.id),
                        service.fetchAssignableUsers(p.id)
                    ]);

                    const sortedVersions = versions.sort((a, b) => {
                        const aPinned = pinnedVersionIds.has(a.id);
                        const bPinned = pinnedVersionIds.has(b.id);
                        if (aPinned !== bPinned) return aPinned ? -1 : 1;
                        const aIsDigit = /^\d/.test(a.name);
                        const bIsDigit = /^\d/.test(b.name);
                        if (aIsDigit !== bIsDigit) return aIsDigit ? -1 : 1;
                        return b.name.localeCompare(a.name, undefined, { numeric: true });
                    });

                    setProjectVersionsMap(prev => ({ ...prev, [p.id]: sortedVersions }));
                    setProjectMembersMap(prev => ({ ...prev, [p.id]: members }));

                    // Functional update to avoid dependency on initializedProjects/activeVersionIds
                    setInitializedProjects(prevInitialized => {
                        if (prevInitialized.has(p.id)) return prevInitialized;

                        const newInitialized = new Set(prevInitialized);
                        newInitialized.add(p.id);

                        setActiveVersionIds(prevActive => {
                            const newActive = new Set(prevActive);
                            const top3Versions = sortedVersions.slice(0, 3);
                            top3Versions.forEach(v => newActive.add(v.id));
                            return newActive;
                        });

                        return newInitialized;
                    });
                } catch (e) {
                    console.error(`Failed to fetch details for project ${p.id}`, e);
                }
            }));
        } catch (error: any) {
            setErrorMessage(`Failed to connect: ${error.message}`);
            setIsConfigured(false);
            setIsLoading(false);
            return;
        }
        setIsLoading(false);
        setIsConfigured(true);
    }, [service, pinnedVersionIds]);

    const refreshIssues = useCallback(async () => {
        if (!service) return;
        if (isRefreshingRef.current) {
            log.debug('Refresh already in progress, skipping...');
            return;
        }

        isRefreshingRef.current = true;
        setIsBackgroundRefreshing(true);
        try {
            // Fetch issues for all active versions only
            const activeVersionArray = Array.from(activeVersionIds);
            log.debug(`[refreshIssues] Refreshing ${activeVersionArray.length} active versions`);

            let allFetchedIssues: Issue[] = [];

            // Fetch issues for each active version
            for (const versionId of activeVersionArray) {
                let offset = 0;
                let versionFetched = 0;
                const limit = 100;
                while (true) {
                    const { issues, total_count } = await service.fetchIssues({
                        fixed_version_id: versionId,
                        status_id: '*',
                        limit,
                        offset
                    });
                    allFetchedIssues = [...allFetchedIssues, ...issues];
                    versionFetched += issues.length;

                    if (versionFetched >= total_count || issues.length < limit) {
                        break;
                    }
                    offset += limit;
                }
            }

            log.debug(`[refreshIssues] Fetched ${allFetchedIssues.length} issues from ${activeVersionArray.length} active versions`);

            if (activeVersionArray.length > 0) {
                // Only mark network data as authoritative if we actually fetched something —
                // an empty active-version set means this refresh has nothing to say about
                // allIssues, and shouldn't block a legitimate IndexedDB cache load.
                hasSetIssuesFromNetworkRef.current = true;
            }
            // Update issues list - merge active version issues, preserve old issue detail fields (attachments, journals, etc.)
            setAllIssues(prev => {
                const refreshedVersionIds = new Set(activeVersionArray);
                const fetchedIssueMap = new Map(allFetchedIssues.map(i => [i.id, i]));

                // 1. Preserve issues that don't belong to the version that was just refreshed
                const preservedIssues = prev.filter(i =>
                    !i.fixed_version?.id || !refreshedVersionIds.has(i.fixed_version.id)
                );

                // 2. For issues belonging to the refreshed version, only keep those present in fetchedIssueMap (merge update)
                //    Those not present have been deleted or removed from the version.
                //    Note: we can't simply filter because preservedIssues already removed all active version issues.
                //    We should find active version issues from prev and merge them if they exist in fetchedIssueMap.
                const existingActiveIssues = prev.filter(i =>
                    i.fixed_version?.id && refreshedVersionIds.has(i.fixed_version.id)
                );

                let hasChanges = false;

                const mergedActiveIssues = existingActiveIssues
                    .filter(oldIssue => {
                        const exists = fetchedIssueMap.has(oldIssue.id);
                        if (!exists) hasChanges = true; // Removed issue
                        return exists;
                    })
                    .map(oldIssue => {
                        const newIssue = fetchedIssueMap.get(oldIssue.id)!;
                        // Simple comparison of updated_on to check for changes
                        if (newIssue.updated_on !== oldIssue.updated_on) {
                            hasChanges = true;
                        }

                        // Smart merge: preserve attachments, journals, watchers, etc. that may only come from detail endpoint
                        return {
                            ...newIssue,
                            attachments: newIssue.attachments || oldIssue.attachments,
                            journals: newIssue.journals || oldIssue.journals,
                            watchers: newIssue.watchers || oldIssue.watchers,
                            custom_fields: newIssue.custom_fields || oldIssue.custom_fields
                        };
                    });

                // 3. Find brand new issues (in fetchedIssueMap but not in existingActiveIssues)
                const activeIssueIds = new Set(existingActiveIssues.map(i => i.id));
                const brandNewIssues = allFetchedIssues.filter(i => !activeIssueIds.has(i.id));

                if (brandNewIssues.length > 0) {
                    hasChanges = true;
                }

                if (!hasChanges) {
                    // If no changes (no additions, no deletions, all update times match), don't create new object references to avoid unnecessary re-renders
                    log.debug('[refreshIssues] No changes detected in active versions.');
                    return prev;
                }

                const newIssuesList = [...preservedIssues, ...mergedActiveIssues, ...brandNewIssues];

                log.debug(`[refreshIssues] Total issues after update: ${newIssuesList.length} (was: ${prev.length})`);

                hasSetIssuesFromNetworkRef.current = true;
                IssueCache.saveIssues(newIssuesList).catch(e =>
                    console.warn('[useAppViewModel] Failed to save issues to IndexedDB:', e)
                );
                return newIssuesList;
            });

            // Fetch followed issues using watcher_id filter (much faster than individual requests)
            // Use cached currentUser instead of fetching again
            if (currentUser) {
                let followedIds = new Set<number>();
                let followedAndAssignedIssuesList: Issue[] = [];
                let offset = 0;
                const limit = 100;

                while (true) {
                    const { issues, total_count } = await service.fetchIssues({
                        watcher_id: currentUser.id,
                        status_id: '*',
                        limit,
                        offset
                    });
                    issues.forEach(i => {
                        followedIds.add(i.id);
                        followedAndAssignedIssuesList.push(i);
                    });
                    if (followedIds.size >= total_count || issues.length < limit) break;
                    offset += limit;
                }

                // Also fetch tasks assigned to me, ensuring they are synced correctly when deleted or moved
                // Especially those without a fixed version
                offset = 0;
                while (true) {
                    const { issues, total_count } = await service.fetchIssues({
                        assigned_to_id: currentUser.id,
                        status_id: '*',
                        limit,
                        offset
                    });
                    issues.forEach(i => {
                        if (!followedIds.has(i.id)) {
                            followedAndAssignedIssuesList.push(i);
                        }
                    });
                    if (offset + issues.length >= total_count || issues.length < limit) break;
                    offset += limit;
                }

                // Only update state if the set of IDs actually changed
                setFollowedIssueIds(prev => {
                    if (prev.size === followedIds.size && Array.from(prev).every(id => followedIds.has(id))) {
                        return prev;
                    }
                    IssueCache.saveMeta('followedIssueIds', JSON.stringify(Array.from(followedIds))).catch(e =>
                        console.warn('[useAppViewModel] Failed to save followed IDs to IndexedDB:', e)
                    );
                    return followedIds;
                });

                // Merge watched and assigned issues into allIssues, and clean up stale cache
                setAllIssues(prev => {
                    const refreshedVersionIds = new Set(activeVersionIds);
                    const refreshedFollowedAndAssignedIds = new Set(followedAndAssignedIssuesList.map(i => i.id));
                    const issueMap = new Map(prev.map(i => [i.id, i]));
                    let changed = false;

                    // Cleanup logic: if an Issue was originally "watched" or "assigned" but is no longer in the remote response,
                    // and it doesn't belong to any active version, it has been deleted or is no longer relevant - remove from cache.
                    for (const issue of prev) {
                        const wasFollowed = followedIssueIdsRef.current.has(issue.id);
                        const wasAssigned = issue.assigned_to?.id === currentUser.id;

                        if ((wasFollowed || wasAssigned) && !refreshedFollowedAndAssignedIds.has(issue.id)) {
                            const isInActiveVersion = issue.fixed_version?.id && refreshedVersionIds.has(issue.fixed_version.id);
                            if (!isInActiveVersion) {
                                issueMap.delete(issue.id);
                                changed = true;
                            }
                        }
                    }

                    followedAndAssignedIssuesList.forEach(fi => {
                        const existing = issueMap.get(fi.id);
                        if (!existing) {
                            issueMap.set(fi.id, fi);
                            changed = true;
                        } else {
                            // Smart merge to keep details if any
                            issueMap.set(fi.id, {
                                ...fi,
                                attachments: fi.attachments || existing.attachments,
                                journals: fi.journals || existing.journals,
                                watchers: fi.watchers || existing.watchers,
                                custom_fields: fi.custom_fields || existing.custom_fields
                            });
                            changed = true;
                        }
                    });
                    if (changed) {
                        const newIssues = Array.from(issueMap.values());
                        hasSetIssuesFromNetworkRef.current = true;
                        IssueCache.saveIssues(newIssues).catch(e =>
                            console.warn('[useAppViewModel] Failed to save issues to IndexedDB:', e)
                        );
                        return newIssues;
                    }
                    return prev;
                });
            }
            setErrorMessage(null);
        } catch (e: any) {
            setErrorMessage(`Refresh failed: ${e.message}`);
        } finally {
            isRefreshingRef.current = false;
            setIsBackgroundRefreshing(false);
        }
    }, [service, currentUser, activeVersionIds]); // Remove followedIssueIds from dependencies

    // Fetch issues for a specific version (for Others section)
    const fetchVersionIssues = useCallback(async (versionId: number) => {
        if (!service) return;
        try {
            setIsLoading(true);
            let allFetchedIssues: Issue[] = [];
            let offset = 0;
            const limit = 100;
            const FETCH_CAP = 500;
            let lastTotalCount = 0;

            while (true) {
                const { issues, total_count } = await service.fetchIssues({
                    fixed_version_id: versionId,
                    status_id: '*',
                    include: 'journals,attachments,watchers',
                    limit,
                    offset
                });
                allFetchedIssues = [...allFetchedIssues, ...issues];
                lastTotalCount = total_count;

                if (allFetchedIssues.length >= total_count || issues.length < limit || allFetchedIssues.length >= FETCH_CAP) {
                    break;
                }
                offset += limit;
            }

            if (allFetchedIssues.length < lastTotalCount) {
                showToast.info(
                    `This version has ${lastTotalCount} issues; only the first ${FETCH_CAP} loaded.`
                );
            }

            log.debug(`Fetched ${allFetchedIssues.length} issues for version ${versionId}`);
            // Merge with existing issues, avoiding duplicates and preserving details
            setAllIssues(prev => {
                const issueMap = new Map(prev.map(i => [i.id, i]));
                allFetchedIssues.forEach(i => {
                    const existing = issueMap.get(i.id);
                    if (existing) {
                        issueMap.set(i.id, {
                            ...i,
                            attachments: i.attachments || existing.attachments,
                            journals: i.journals || existing.journals,
                            watchers: i.watchers || existing.watchers,
                            custom_fields: i.custom_fields || existing.custom_fields
                        });
                    } else {
                        issueMap.set(i.id, i);
                    }
                });
                return Array.from(issueMap.values());
            });
            setErrorMessage(null);
        } catch (e: any) {
            setErrorMessage(`Failed to fetch version issues: ${e.message}`);
        } finally {
            setIsLoading(false);
        }
    }, [service]);

    const sortVersions = useCallback((versions: Version[], pinnedIds: Set<number>) => {
        return [...versions].sort((a, b) => {
            // 1. Pinned versions first
            const aPinned = pinnedIds.has(a.id);
            const bPinned = pinnedIds.has(b.id);
            if (aPinned !== bPinned) return aPinned ? -1 : 1;

            // 2. Numbers-starting versions next
            const aIsDigit = /^\d/.test(a.name);
            const bIsDigit = /^\d/.test(b.name);
            if (aIsDigit !== bIsDigit) return aIsDigit ? -1 : 1;

            // 3. Descending numeric sort
            return b.name.localeCompare(a.name, undefined, { numeric: true });
        });
    }, []);

    const fetchProjectDetails = useCallback(async (projectId: number) => {
        if (!service) return;
        try {
            // Fetch versions and members independently
            service.fetchVersions(projectId).then(versions => {
                setProjectVersionsMap(prev => ({
                    ...prev,
                    [projectId]: sortVersions(versions, pinnedVersionIds)
                }));
            }).catch(e => console.error(`Failed to fetch versions for project ${projectId}`, e));

            service.fetchAssignableUsers(projectId).then(members => {
                setProjectMembersMap(prev => ({ ...prev, [projectId]: members }));
            }).catch(e => console.error(`Failed to fetch members for project ${projectId}`, e));

        } catch (e: any) {
            console.error('Failed to initiate project details fetch', e);
        }
    }, [service, pinnedVersionIds, sortVersions]);

    const versionIssueCounts = useMemo(() => {
        const counts: Record<number, number> = {};
        allIssues.forEach(i => {
            if (i.fixed_version?.id) {
                counts[i.fixed_version.id] = (counts[i.fixed_version.id] || 0) + 1;
            }
        });
        return counts;
    }, [allIssues]);

    // Status-based counts per version: { versionId: { dev: number; done: number; verified: number } }
    // Filtered by selected assignee
    const versionStatusCounts = useMemo(() => {
        const counts: Record<number, { dev: number; done: number; verified: number }> = {};
        allIssues.forEach(i => {
            // Filter by assignee if one is selected
            if (selectedAssigneeId !== null && i.assigned_to?.id !== selectedAssigneeId) {
                return;
            }
            if (i.fixed_version?.id) {
                const vid = i.fixed_version.id;
                if (!counts[vid]) counts[vid] = { dev: 0, done: 0, verified: 0 };
                const statusName = i.status.name;
                if (statusName.includes('验证完成')) {
                    counts[vid].verified++;
                } else if (statusName.includes('开发完成')) {
                    counts[vid].done++;
                } else {
                    counts[vid].dev++;
                }
            }
        });
        return counts;
    }, [allIssues, selectedAssigneeId]);

    const followedStatusCounts = useMemo(() => {
        const sc = { dev: 0, done: 0, verified: 0 };
        allIssues.forEach(i => {
            if (followedIssueIds.has(i.id)) {
                const statusName = i.status.name;
                if (statusName.includes('验证完成')) {
                    sc.verified++;
                } else if (statusName.includes('开发完成')) {
                    sc.done++;
                } else {
                    sc.dev++;
                }
            }
        });
        return sc;
    }, [allIssues, followedIssueIds]);

    const assignedStatusCounts = useMemo(() => {
        const sc = { dev: 0, done: 0, verified: 0 };
        if (!currentUser) return sc;
        allIssues.forEach(i => {
            if (i.assigned_to?.id === currentUser.id) {
                const statusName = i.status.name;
                if (statusName.includes('验证完成')) {
                    sc.verified++;
                } else if (statusName.includes('开发完成')) {
                    sc.done++;
                } else {
                    sc.dev++;
                }
            }
        });
        return sc;
    }, [allIssues, currentUser]);

    useEffect(() => {
        if (service && isConfigured) {
            loadInitialData();
        }
    }, [service, isConfigured, loadInitialData]);

    useEffect(() => {
        if (isConfigured && selectedProjectId && selectedProjectId > 0) {
            fetchProjectDetails(selectedProjectId);
        }
    }, [selectedProjectId, fetchProjectDetails, isConfigured]);

    useEffect(() => {
        if (isConfigured) {
            refreshIssues();
        }
    }, [isConfigured, selectedAssigneeId, refreshIssues]);

    useEffect(() => {
        if (isConfigured) {
            if (selectedProjectId !== null) localStorage.setItem('lastSelectedProjectId', selectedProjectId.toString());
            else localStorage.removeItem('lastSelectedProjectId');
            if (selectedVersionId !== null) localStorage.setItem('lastSelectedVersionId', selectedVersionId.toString());
            else localStorage.removeItem('lastSelectedVersionId');
            if (selectedAssigneeId !== null) localStorage.setItem('lastSelectedAssigneeId', selectedAssigneeId.toString());
            else localStorage.removeItem('lastSelectedAssigneeId');
        }
        localStorage.setItem('transparencyLevel', transparencyLevel.toString());
        localStorage.setItem('appTheme', appTheme);
        localStorage.setItem('refreshInterval', refreshInterval.toString());
        localStorage.setItem('showBadge', showBadge.toString());
        localStorage.setItem('pinnedVersionIds', JSON.stringify(Array.from(pinnedVersionIds)));
        localStorage.setItem('selectedAssignedWatcherIds', JSON.stringify(Array.from(selectedAssignedWatcherIds)));
        localStorage.setItem('hideVerifiedInFollowed', hideVerifiedInFollowed.toString());
        localStorage.setItem('hideVerifiedInAssigned', hideVerifiedInAssigned.toString());
        localStorage.setItem('groupByMode', groupByMode);
        localStorage.setItem('cachedActiveVersionIds', JSON.stringify(Array.from(activeVersionIds)));
        localStorage.setItem('cachedInitializedProjects', JSON.stringify(Array.from(initializedProjects)));
    }, [selectedProjectId, selectedVersionId, selectedAssigneeId, selectedAssignedWatcherIds, transparencyLevel, appTheme, refreshInterval, showBadge, isConfigured, pinnedVersionIds, hideVerifiedInFollowed, hideVerifiedInAssigned, groupByMode, activeVersionIds, initializedProjects]);

    // Periodical Background Refresh
    useEffect(() => {
        if (!isConfigured || refreshInterval <= 0) return;

        const intervalId = setInterval(() => {
            log.debug('Background refreshing issues...');
            refreshIssues();
        }, refreshInterval * 1000);

        return () => clearInterval(intervalId);
    }, [isConfigured, refreshInterval, refreshIssues]);

    // Reactive badge update - updates whenever allIssues, showBadge, or currentUser changes
    useEffect(() => {
        if (!currentUser) return;

        const myIssues = allIssues.filter(i =>
            i.assigned_to?.id === currentUser.id &&
            !i.status.name.includes('完成') &&
            !i.status.name.includes('关闭')
        );
        const myUnfinishedCount = myIssues.length;

        // Rank issues by priority urgency (urgent/high first) so the tray badge
        // reflects the issues that matter most, not just whichever loaded first.
        const priorityRank = (i: Issue): number => {
            const pName = (i.priority?.name || '').toLowerCase()
            if (pName.includes('urgent') || pName.includes('immediate')) return 0
            if (pName.includes('high')) return 1
            if (pName.includes('medium') || pName.includes('normal')) return 2
            return 3
        }

        // Tray menu: counts per status across ALL issues assigned to me (matching
        // "My Assigned" grouped by status, not just the unfinished subset above),
        // ordered to match the server's status workflow order.
        const statusRank = new Map(issueStatuses.map((s, idx) => [s.name, idx]));
        const assignedIssues = allIssues.filter(i => i.assigned_to?.id === currentUser.id);
        const countsByStatus = new Map<number, { statusId: number; statusName: string; count: number }>();
        for (const issue of assignedIssues) {
            const entry = countsByStatus.get(issue.status.id);
            if (entry) entry.count++;
            else countsByStatus.set(issue.status.id, { statusId: issue.status.id, statusName: issue.status.name, count: 1 });
        }
        const statusCounts = Array.from(countsByStatus.values())
            .sort((a, b) => (statusRank.get(a.statusName) ?? 999) - (statusRank.get(b.statusName) ?? 999));
        (window as any).ipcRenderer?.send('update-tray-status-counts', statusCounts);

        if (showBadge) {
            // Determine urgency based on priority: if any high-urgency issues, show red; if any medium, show orange; else green
            let urgency: 'none' | 'low' | 'medium' | 'high' = 'low'
            if (myUnfinishedCount > 0) {
                const hasHighPriority = myIssues.some(i => priorityRank(i) <= 1)
                const hasMediumPriority = myIssues.some(i => priorityRank(i) === 2)

                if (hasHighPriority) urgency = 'high'
                else if (hasMediumPriority) urgency = 'medium'
                else urgency = 'low'
            }

            log.debug('Badge update (reactive):', { count: myUnfinishedCount, urgency });
            (window as any).ipcRenderer?.send('update-badge', { count: myUnfinishedCount, urgency });
        } else {
            (window as any).ipcRenderer?.send('update-badge', { count: 0, urgency: 'none' });
        }
    }, [allIssues, showBadge, currentUser, issueStatuses]);

    const saveSettings = async (url: string, key: string) => {
        localStorage.setItem('redmineURL', url);
        if (key) {
            await window.secureStore?.store('redmineAPIKey', key);
            localStorage.setItem('hasSecureKey', 'true');
        } else {
            await window.secureStore?.remove('redmineAPIKey');
            localStorage.removeItem('hasSecureKey');
        }
        setRedmineURL(url);
        setRedmineAPIKey(key);
        setIsConfigured(true);
        (window as any).ipcRenderer?.send('save-redmine-url', url);
        // loadInitialData will be triggered by useEffect
    };

    const fetchIssueDetail = useCallback(async (id: number) => {
        if (!service) return;
        try {
            const detail = await service.fetchIssueDetail(id);
            setAllIssues(prev => {
                const oldIssue = prev.find(i => i.id === id);
                // Only update if data actually changed OR if it's the first time we get full details (journals/attachments/watchers)
                if (oldIssue && oldIssue.updated_on === detail.updated_on &&
                    (oldIssue.journals?.length === detail.journals?.length) &&
                    (oldIssue.watchers?.length === detail.watchers?.length)) {
                    return prev;
                }
                return prev.map(i => i.id === id ? detail : i);
            });
        } catch (e: any) {
            console.error(`Failed to fetch detail for issue ${id}`, e);
        }
    }, [service]);

    // Remote search function
    const performRemoteSearch = useCallback(async (query: string) => {
        if (!service || !query.trim()) {
            setRemoteSearchResults([]);
            setRemoteSearchTotalCount(0);
            return;
        }

        setIsSearching(true);
        try {
            const { issues, total_count } = await service.searchIssues(query.trim(), {
                limit: 50
            });
            setRemoteSearchResults(issues);
            setRemoteSearchTotalCount(total_count);
            setErrorMessage(null);
        } catch (e: any) {
            setErrorMessage(`Remote search failed: ${e.message}`);
            setRemoteSearchResults([]);
            setRemoteSearchTotalCount(0);
        } finally {
            setIsSearching(false);
        }
    }, [service]);

    // When search mode is remote and search query changes, execute remote search (with debounce)
    useEffect(() => {
        if (searchMode !== 'remote') {
            // Switching back to local mode, clear remote search results
            setRemoteSearchResults([]);
            setRemoteSearchTotalCount(0);
            return;
        }

        // Clear previous timer
        if (searchTimeoutRef.current) {
            clearTimeout(searchTimeoutRef.current);
        }

        if (!searchQuery.trim()) {
            setRemoteSearchResults([]);
            setRemoteSearchTotalCount(0);
            setIsSearching(false);
            return;
        }

        // Debounce: execute search after 500ms
        searchTimeoutRef.current = setTimeout(() => {
            performRemoteSearch(searchQuery);
        }, 500);

        return () => {
            if (searchTimeoutRef.current) {
                clearTimeout(searchTimeoutRef.current);
            }
        };
    }, [searchQuery, searchMode, performRemoteSearch]);

    const addWatcher = async (issueId: number, userId: number) => {
        if (!service) return;
        try {
            await service.addWatcher(issueId, userId);
            // Update cache if current user was added
            if (currentUser && userId === currentUser.id) {
                setFollowedIssueIds(prev => new Set(prev).add(issueId));
            }
            await fetchIssueDetail(issueId);
        } catch (e: any) {
            setErrorMessage(`Failed to add watcher: ${e.message}`);
        }
    };

    const removeWatcher = async (issueId: number, userId: number) => {
        if (!service) return;
        try {
            await service.removeWatcher(issueId, userId);
            // Update cache if current user was removed
            if (currentUser && userId === currentUser.id) {
                setFollowedIssueIds(prev => {
                    const next = new Set(prev);
                    next.delete(issueId);
                    return next;
                });
            }
            await fetchIssueDetail(issueId);
        } catch (e: any) {
            setErrorMessage(`Failed to remove watcher: ${e.message}`);
        }
    };

    // Assigned watcher management (via custom field)
    const addAssignedWatcher = async (issue: Issue, userId: number) => {
        if (!service) return;
        try {
            // Get current assigned watchers
            const currentAssistants = getAssignedWatchers(issue);
            const assistantIds = currentAssistants.map(a => a.id);

            // Skip if already exists
            if (assistantIds.includes(userId)) {
                return;
            }

            // Add new assigned watcher
            assistantIds.push(userId);

            // Get custom field ID
            const field = getAssignedWatchersField(issue);
            if (!field) {
                setErrorMessage('Assigned watchers custom field not found');
                return;
            }

            // Update Issue
            const customFieldsUpdate = createAssignedWatchersUpdate(field.id, assistantIds);
            await service.updateIssue(issue.id, { custom_fields: customFieldsUpdate });
            await fetchIssueDetail(issue.id);
        } catch (e: any) {
            setErrorMessage(`Failed to add assigned watcher: ${e.message}`);
        }
    };

    const removeAssignedWatcher = async (issue: Issue, userId: number) => {
        if (!service) return;
        try {
            // Get current assigned watchers
            const currentAssistants = getAssignedWatchers(issue);
            const assistantIds = currentAssistants.map(a => a.id).filter(id => id !== userId);

            // Get custom field ID
            const field = getAssignedWatchersField(issue);
            if (!field) {
                setErrorMessage('Assigned watchers custom field not found');
                return;
            }

            // Update Issue
            const customFieldsUpdate = createAssignedWatchersUpdate(field.id, assistantIds);
            await service.updateIssue(issue.id, { custom_fields: customFieldsUpdate });
            await fetchIssueDetail(issue.id);
        } catch (e: any) {
            setErrorMessage(`Failed to remove assigned watcher: ${e.message}`);
        }
    };

    const updateIssue = async (id: number, data: any) => {
        if (!service) return;

        // Read the pre-update snapshot synchronously from the current render's closure
        // (not from inside the setAllIssues updater, which may run after this function
        // has already moved on to the network call, leaving previousIssue unset for rollback).
        const previousIssue = allIssues.find(i => i.id === id);
        if (!previousIssue) return;

        // Optimistic update: immediately apply changes to local state
        const optimistic: Issue = {
            ...previousIssue,
            ...(data.status_id !== undefined && { status: previousIssue.status }),
            ...(data.priority_id !== undefined && { priority: previousIssue.priority }),
            ...(data.assigned_to_id !== undefined && { assigned_to: previousIssue.assigned_to }),
            ...(data.fixed_version_id !== undefined && { fixed_version: previousIssue.fixed_version }),
            updated_on: new Date().toISOString(),
        };

        if (data.status_id !== undefined) {
            // Look up the real name so the change is visible immediately (IssueItem renders
            // status.name), instead of only updating id and waiting on fetchIssueDetail.
            const matchedStatus = issueStatusesRef.current.find(s => s.id === data.status_id);
            optimistic.status = matchedStatus ? { ...previousIssue.status, ...matchedStatus } : { ...previousIssue.status, id: data.status_id };
        }
        if (data.priority_id !== undefined) {
            const matchedPriority = issuePrioritiesRef.current.find(p => p.id === data.priority_id);
            optimistic.priority = matchedPriority ? { ...previousIssue.priority, ...matchedPriority } : { ...previousIssue.priority, id: data.priority_id };
        }
        if (data.assigned_to_id !== undefined) {
            if (data.assigned_to_id) {
                const assigneeId = parseInt(data.assigned_to_id);
                const projectId = previousIssue.project?.id;
                const matchedMember = projectId ? projectMembersMap[projectId]?.find(m => m.id === assigneeId) : undefined;
                optimistic.assigned_to = matchedMember ? { id: matchedMember.id, name: matchedMember.name } : { id: assigneeId, name: '' };
            } else {
                optimistic.assigned_to = undefined;
            }
        }
        if (data.fixed_version_id !== undefined) {
            if (data.fixed_version_id) {
                const versionId = parseInt(data.fixed_version_id);
                const projectId = previousIssue.project?.id;
                const matchedVersion = projectId ? projectVersionsMap[projectId]?.find(v => v.id === versionId) : undefined;
                optimistic.fixed_version = matchedVersion ? { id: matchedVersion.id, name: matchedVersion.name } : { id: versionId, name: '' };
            } else {
                optimistic.fixed_version = undefined;
            }
        }
        if (data.subject !== undefined) {
            optimistic.subject = data.subject;
        }

        const changedKeys: (keyof Issue)[] = [];
        if (data.status_id !== undefined) changedKeys.push('status');
        if (data.priority_id !== undefined) changedKeys.push('priority');
        if (data.assigned_to_id !== undefined) changedKeys.push('assigned_to');
        if (data.fixed_version_id !== undefined) changedKeys.push('fixed_version');
        if (data.subject !== undefined) changedKeys.push('subject');

        if (!pendingFieldsRef.current[id]) pendingFieldsRef.current[id] = new Set();
        changedKeys.forEach(k => pendingFieldsRef.current[id].add(k));

        setAllIssues(prev => prev.map(i => i.id === id ? optimistic : i));

        try {
            await service.updateIssue(id, data);
            const updated = await service.fetchIssueDetail(id);
            setAllIssues(prev => prev.map(i => {
                if (i.id !== id) return i;
                // Keep the current optimistic value for any field a *different*,
                // still-in-flight update is editing -- this fetch's server snapshot
                // predates that update landing, so applying it wholesale would
                // flash the field back to its stale pre-update value.
                const stillPendingElsewhere = Array.from(pendingFieldsRef.current[id] || [])
                    .filter(k => !changedKeys.includes(k));
                if (stillPendingElsewhere.length === 0) return updated;
                const merged: Issue = { ...updated };
                stillPendingElsewhere.forEach(k => { (merged as any)[k] = (i as any)[k]; });
                return merged;
            }));
        } catch (e: any) {
            setAllIssues(prev => prev.map(i => {
                if (i.id !== id) return i;
                // Revert only this call's own field(s) onto the current issue, so a
                // different concurrent update's already-applied change isn't undone.
                const reverted: Issue = { ...i };
                changedKeys.forEach(k => { (reverted as any)[k] = (previousIssue as any)[k]; });
                return reverted;
            }));
            setErrorMessage(e.message);
            showToast.error(`Update failed: ${e.message}`);
        } finally {
            changedKeys.forEach(k => pendingFieldsRef.current[id]?.delete(k));
        }
    };

    const addNote = async (id: number, note: string) => {
        await updateIssue(id, { notes: note });
    };

    const createIssue = async (subject: string, projectId: number, versionId?: number, assignedToId?: number) => {
        if (!service) return;
        setIsLoading(true);
        try {
            const newIssue = await service.createIssue({
                project_id: projectId,
                subject,
                fixed_version_id: versionId,
                assigned_to_id: assignedToId
            });
            // Directly add the new issue to the list instead of refreshing all issues
            // This provides instant feedback to the user
            setAllIssues(prev => [newIssue, ...prev]);
            IssueCache.saveIssues([newIssue]).catch(e =>
                console.warn('[useAppViewModel] Failed to save new issue to IndexedDB:', e)
            );
        } catch (e: any) {
            setErrorMessage(e.message);
        } finally {
            setIsLoading(false);
        }
    };

    const createVersion = async (projectId: number, name: string) => {
        if (!service) return;
        try {
            const newVersion = await service.createVersion(projectId, name);
            // Add to project versions map
            setProjectVersionsMap(prev => {
                const existing = prev[projectId] || [];
                return { ...prev, [projectId]: [newVersion, ...existing] };
            });
            return newVersion;
        } catch (e: any) {
            setErrorMessage(`Failed to create version: ${e.message}`);
        }
    };

    const deleteVersion = async (projectId: number, versionId: number) => {
        if (!service) return;
        try {
            await service.deleteVersion(versionId);
            // Remove from project versions map
            setProjectVersionsMap(prev => {
                const existing = prev[projectId] || [];
                return { ...prev, [projectId]: existing.filter(v => v.id !== versionId) };
            });
        } catch (e: any) {
            setErrorMessage(`Failed to delete version: ${e.message}`);
        }
    };

    const updateVersion = async (projectId: number, versionId: number, data: any) => {
        if (!service) return;
        try {
            await service.updateVersion(versionId, data);
            // Refresh versions for the project
            const versions = await service.fetchVersions(projectId);
            setProjectVersionsMap(prev => ({
                ...prev,
                [projectId]: sortVersions(versions, pinnedVersionIds)
            }));
        } catch (e: any) {
            setErrorMessage(`Failed to update version: ${e.message}`);
        }
    };

    const togglePinVersion = useCallback((projectId: number, versionId: number) => {
        setPinnedVersionIds(prev => {
            const next = new Set(prev);
            if (next.has(versionId)) next.delete(versionId);
            else next.add(versionId);

            // Re-sort current project's versions immediately
            setProjectVersionsMap(currentMap => {
                const versions = currentMap[projectId];
                if (!versions) return currentMap;
                return {
                    ...currentMap,
                    [projectId]: sortVersions(versions, next)
                };
            });

            return next;
        });
    }, [sortVersions]);

    // Toggle a version's active status (move into/out of Others)
    const toggleVersionActive = useCallback(async (versionId: number) => {
        let activating = false;
        setActiveVersionIds(prev => {
            const next = new Set(prev);
            if (next.has(versionId)) {
                next.delete(versionId);
                activating = false;
            } else {
                next.add(versionId);
                activating = true;
            }
            return next;
        });

        if (activating) {
            log.debug(`[toggleVersionActive] Version ${versionId} activated, fetching issues...`);
            await fetchVersionIssues(versionId);
        } else {
            log.debug(`[toggleVersionActive] Version ${versionId} moved to Others`);
        }
    }, [fetchVersionIssues]);

    const deleteIssue = async (issueId: number) => {
        if (!service) return;
        try {
            await service.deleteIssue(issueId);
            // Remove from allIssues
            setAllIssues(prev => prev.filter(i => i.id !== issueId));
        } catch (e: any) {
            setErrorMessage(`Failed to delete issue: ${e.message}`);
        }
    };

    const uploadAttachment = async (file: File) => {
        if (!service) return null;
        try {
            return await service.uploadFile(file);
        } catch (e: any) {
            setErrorMessage(`Upload failed: ${e.message}`);
            return null;
        }
    };

    const selectProject = (projectId: number | null) => {
        setSelectedProjectId(projectId);
        setSelectedVersionId(null);
    };

    const selectVersion = (projectId: number, versionId: number | null) => {
        setSelectedProjectId(projectId);
        setSelectedVersionId(versionId);
    };

    const statusSortMap = useMemo(() => {
        return issueStatuses.reduce((acc, s, idx) => ({ ...acc, [s.name]: idx }), {} as Record<string, number>);
    }, [issueStatuses]);

    // Helper: compute grouped data for a single bucket key
    const computeGroupForKey = useCallback((
        key: string,
        issues: Issue[],
        groupBy: string,
        statusSort: Record<string, number>
    ): { groups: Record<string, Issue[]>; sortedKeys: string[] } => {
        const groups: Record<string, Issue[]> = {};
        const keys: string[] = [];

        if (groupBy === 'assignee') {
            issues.forEach(i => {
                const assigneeName = i.assigned_to?.name || 'Unassigned';
                if (!groups[assigneeName]) {
                    groups[assigneeName] = [];
                    keys.push(assigneeName);
                }
                groups[assigneeName].push(i);
            });
            keys.sort((a, b) => {
                if (a === 'Unassigned') return 1;
                if (b === 'Unassigned') return -1;
                return a.localeCompare(b);
            });
        } else {
            issues.forEach(i => {
                const statusName = i.status.name;
                if (!groups[statusName]) {
                    groups[statusName] = [];
                    keys.push(statusName);
                }
                groups[statusName].push(i);
            });
            keys.sort((a, b) => (statusSort[a] ?? 99) - (statusSort[b] ?? 99));
        }
        return { groups, sortedKeys: keys };
    }, []);

    // --- Lazy versionViewData computation ---
    // Instead of computing ALL versions upfront, we:
    // 1. Compute only the currently active key
    // 2. Cache results so switching back is instant
    // 3. Invalidate cache when dependencies change
    
    // Cache for computed view data
    const viewDataCacheRef = useRef<Record<string, { groups: Record<string, Issue[]>; sortedKeys: string[] }>>({});
    // Version counter to detect when we need to recompute
    const depsVersionRef = useRef(0);
    const lastDepsRef = useRef('');
    // allIssues is compared by reference (all update paths replace it immutably),
    // so this avoids JSON.stringify-ing the whole issue list on every render just
    // to detect changes for cache invalidation.
    const lastAllIssuesRef = useRef<Issue[] | null>(null);

    // Compute current active key
    const activeViewKey = useMemo(() => {
        if (selectedProjectId === -1) return 'all'; // All Projects: no project/version filter
        if (selectedProjectId === -2) return '-2';
        if (selectedProjectId === -3) return '-3';
        if (selectedVersionId) return selectedVersionId.toString();
        if (selectedProjectId !== null) return `p-${selectedProjectId}`;
        return '';
    }, [selectedProjectId, selectedVersionId]);

    // Check if dependencies changed and invalidate cache
    const depsString = JSON.stringify({
        selectedStatusId, searchQuery, selectedAssigneeId, selectedAssignedWatcherIds,
        followedIssueIds: Array.from(followedIssueIds), currentUserId: currentUser?.id,
        hideVerifiedInFollowed, hideVerifiedInAssigned, groupByMode, statusSortMap
    });

    if (depsString !== lastDepsRef.current || lastAllIssuesRef.current !== allIssues) {
        lastDepsRef.current = depsString;
        lastAllIssuesRef.current = allIssues;
        depsVersionRef.current++;
        viewDataCacheRef.current = {}; // Invalidate all cached data
    }

    // Compute data for a specific key (used by both active and adjacent tabs)
    const computeForKey = useCallback((key: string) => {
        // Filter issues for this key
        const filteredIssues = allIssues.filter(i => {
            const matchQuery = !searchQuery ||
                i.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
                i.id.toString().includes(searchQuery);
            if (!matchQuery) return false;
            if (selectedStatusId && i.status.id !== selectedStatusId) return false;

            // Check if issue belongs to this bucket
            if (key === 'all') {
                const matchAssignee = !selectedAssigneeId || i.assigned_to?.id === selectedAssigneeId;
                const assignedWatchers = getAssignedWatchers(i);
                const matchAssignedWatchers = selectedAssignedWatcherIds.size === 0 ||
                    assignedWatchers.some(aw => selectedAssignedWatcherIds.has(aw.id));
                return matchAssignee && matchAssignedWatchers;
            }
            if (key === '-2') {
                return followedIssueIds.has(i.id) &&
                    (!hideVerifiedInFollowed || !i.status.name.includes('验证完成'));
            }
            if (key === '-3') {
                return currentUser && i.assigned_to?.id === currentUser.id &&
                    (!hideVerifiedInAssigned || !i.status.name.includes('验证完成'));
            }
            if (key.startsWith('p-')) {
                const projectId = parseInt(key.slice(2));
                const matchAssignee = !selectedAssigneeId || i.assigned_to?.id === selectedAssigneeId;
                const assignedWatchers = getAssignedWatchers(i);
                const matchAssignedWatchers = selectedAssignedWatcherIds.size === 0 ||
                    assignedWatchers.some(aw => selectedAssignedWatcherIds.has(aw.id));
                return matchAssignee && matchAssignedWatchers && i.project?.id === projectId;
            }
            // Regular version bucket
            const versionId = parseInt(key);
            if (!isNaN(versionId) && i.fixed_version?.id === versionId) {
                const matchAssignee = !selectedAssigneeId || i.assigned_to?.id === selectedAssigneeId;
                const assignedWatchers = getAssignedWatchers(i);
                const matchAssignedWatchers = selectedAssignedWatcherIds.size === 0 ||
                    assignedWatchers.some(aw => selectedAssignedWatcherIds.has(aw.id));
                return matchAssignee && matchAssignedWatchers;
            }
            return false;
        });

        return computeGroupForKey(key, filteredIssues, groupByMode, statusSortMap);
    }, [allIssues, selectedStatusId, searchQuery, selectedAssigneeId, selectedAssignedWatcherIds,
        followedIssueIds, currentUser, hideVerifiedInFollowed, hideVerifiedInAssigned, groupByMode, statusSortMap, computeGroupForKey]);

    // Get data for active key (compute if not cached)
    const currentGroupedIssues = useMemo(() => {
        if (!activeViewKey) return { groups: {}, sortedKeys: [] };
        return computeForKey(activeViewKey);
    }, [activeViewKey, computeForKey]);

    // Store computed result in cache
    useEffect(() => {
        if (activeViewKey) {
            viewDataCacheRef.current[activeViewKey] = currentGroupedIssues;
        }
    }, [activeViewKey, currentGroupedIssues]);

    // versionViewData getter - returns cached or computes on demand
    const getVersionViewData = useCallback((key: string) => {
        if (viewDataCacheRef.current[key]) {
            return viewDataCacheRef.current[key];
        }
        // Compute on demand
        const data = computeForKey(key);
        viewDataCacheRef.current[key] = data;
        return data;
    }, [computeForKey]);

    const followedIssuesCount = useMemo(() => {
        return followedIssueIds.size;
    }, [followedIssueIds]);

    const globalMembers = useMemo(() => {
        const memberMap = new Map<number, { id: number; name: string; groups: string[] }>();

        // Helper to add user to map with consistent name formatting
        const addUser = (u: any, groups?: string[]) => {
            if (!u || !u.id) return;
            const existing = memberMap.get(u.id);
            const name = u.name || (u.firstname && u.lastname ? `${u.firstname} ${u.lastname}` : u.firstname || u.lastname || 'Unknown');
            if (existing) {
                // Merge groups
                if (groups) {
                    groups.forEach(g => {
                        if (!existing.groups.includes(g)) existing.groups.push(g);
                    });
                }
            } else {
                memberMap.set(u.id, {
                    id: u.id,
                    name,
                    groups: groups || []
                });
            }
        };

        // Add from project members map (with groups)
        Object.values(projectMembersMap).flat().forEach(m => addUser(m, m.groups));

        // Add from all fetched issues (assignees, authors, and assigned watchers - no group info)
        allIssues.forEach(i => {
            addUser(i.assigned_to);
            addUser(i.author);
            // Get assigned watchers from custom fields
            const assignedWatchers = getAssignedWatchers(i);
            assignedWatchers.forEach(aw => addUser(aw));
        });

        return Array.from(memberMap.values()).sort((a, b) => a.name.localeCompare(b.name));
    }, [projectMembersMap, allIssues]);

    // Open issue by ID (for deep linking)
    const openIssueById = useCallback(async (issueId: number): Promise<{ projectId: number; versionId: number | null; issueId: number } | null> => {
        if (!service) return null;

        // First, check if the issue already exists locally
        let issue = allIssues.find(i => i.id === issueId);

        if (!issue) {
            // Issue not found locally, fetch it from server
            try {
                log.debug(`[openIssueById] Issue ${issueId} not found locally, fetching from server...`);
                issue = await service.fetchIssueDetail(issueId);

                // Add to allIssues
                setAllIssues(prev => {
                    // Check if it was added while we were fetching
                    if (prev.some(i => i.id === issueId)) {
                        return prev.map(i => i.id === issueId ? issue! : i);
                    }
                    return [...prev, issue!];
                });
            } catch (e: any) {
                console.error(`[openIssueById] Failed to fetch issue ${issueId}:`, e);
                setErrorMessage(`Failed to fetch Issue #${issueId}: ${e.message}`);
                return null;
            }
        }

        if (!issue) return null;

        // Ensure the issue has project information
        if (!issue.project) {
            console.error(`[openIssueById] Issue ${issueId} has no project information`);
            setErrorMessage(`Issue #${issueId} is missing project information`);
            return null;
        }

        const projectId = issue.project.id;
        const versionId = issue.fixed_version?.id || null;

        log.debug(`[openIssueById] Opening issue ${issueId} in project ${projectId}, version ${versionId}`);

        // Return the project/version/issue info for the App component to handle selection
        return { projectId, versionId, issueId };
    }, [service, allIssues]);

    return {
        // Redmine service instance (null until URL + API key are configured)
        service,
        isConfigured,
        saveSettings,
        projects,
        currentUser,
        issueStatuses,
        issuePriorities,
        projectVersionsMap,
        projectMembersMap,
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
        searchQuery,
        setSearchQuery,
        searchMode,
        setSearchMode,
        remoteSearchResults,
        remoteSearchTotalCount,
        isSearching,
        performRemoteSearch,
        isLoading,
        isBackgroundRefreshing,
        errorMessage,
        groupedIssues: currentGroupedIssues, // Export the current one for compatibility
        getVersionViewData, // Lazy getter for version view data
        updateIssue,
        addNote,
        addWatcher,         // Watchers
        removeWatcher,      // Watchers
        addAssignedWatcher,     // Assigned watchers
        removeAssignedWatcher,  // Assigned watchers
        createIssue,
        refreshData: refreshIssues,
        redmineURL,
        redmineAPIKey,
        refreshInterval, setRefreshInterval,
        transparencyLevel, setTransparencyLevel,
        appTheme, setAppTheme,
        showBadge, setShowBadge,
        fetchImageBlob: (url: string) => service?.fetchImageBlob(url),
        versionIssueCounts,
        versionStatusCounts,
        activeVersionIds,
        setActiveVersionIds,
        toggleVersionActive,
        allIssues,
        fetchIssueDetail,
        fetchVersionIssues,
        createVersion,
        updateVersion,
        deleteVersion,
        deleteIssue,
        uploadAttachment,
        globalMembers,
        pinnedVersionIds,
        togglePinVersion,
        followedIssuesCount,
        followedStatusCounts,
        followedIssueIds,
        assignedStatusCounts,
        hideVerifiedInFollowed,
        setHideVerifiedInFollowed,
        hideVerifiedInAssigned,
        setHideVerifiedInAssigned,
        openIssueById
    };
}
