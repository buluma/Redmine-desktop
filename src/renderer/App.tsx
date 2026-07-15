import React, { useState, useMemo, useEffect, useCallback, useRef, useDeferredValue, useLayoutEffect } from 'react';
import { useAppViewModel } from './hooks/useAppViewModel';
import { Issue, IssueJournal } from './models/redmine';
import { format } from 'date-fns';
import { AuthenticatedImage } from './components/AuthenticatedImage';
import { RichEditor } from './components/RichEditor';
import UpdaterModal from './components/UpdaterModal';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { marked } from 'marked';
import { getAssignedWatchers } from './utils/assignedWatchers';


const MemoIssueItem = React.memo(({
    issue,
    isSelected,
    onSelect,
    onUpdateStatus,
    onUpdatePriority,
    onUpdateVersion,
    onUpdateAssignee,
    statusList,
    priorityList,
    versionList,
    groupedMembers,
    isFollowed,
    onToggleFollow
}: {
    issue: Issue,
    isSelected: boolean,
    onSelect: (id: number) => void,
    onUpdateStatus: (id: number, statusId: number) => void,
    onUpdatePriority: (id: number, priorityId: number) => void,
    onUpdateVersion: (id: number, versionId: string) => void,
    onUpdateAssignee: (id: number, assigneeId: string) => void,
    statusList: any[],
    priorityList: any[],
    versionList: any[],
    groupedMembers: { grouped: Record<string, { id: number; name: string }[]>, noGroup: { id: number; name: string }[], sortedGroups: string[] },
    isFollowed: boolean,
    onToggleFollow: (id: number) => void
}) => {
    return (
        <div className={`issue-item ${isSelected ? 'selected' : ''}`} data-issue-id={issue.id} onClick={() => onSelect(issue.id)} style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 10, position: 'relative' }}>
            <div className="issue-icon-circle"
                onClick={(e) => {
                    e.stopPropagation();
                    if (issue.status.name.includes('Verification Complete') || issue.status.name.includes('验证完成') || issue.status.name.includes('Development Complete') || issue.status.name.includes('开发完成')) return;
                    const doneStatus = statusList.find(s => s.name.includes('Development Complete') || s.name.includes('开发完成'));
                    if (doneStatus) {
                        onUpdateStatus(issue.id, doneStatus.id);
                    }
                }}
                style={{
                    borderColor: (issue.status.name.includes('开发完成') || issue.status.name.includes('Development Complete')) ? '#30d158' : (issue.status.name.includes('验证完成') || issue.status.name.includes('Verification Complete')) ? 'var(--text-secondary)' : '#ff453a',
                    width: 18, height: 18, fontSize: 9, flexShrink: 0,
                    color: (issue.status.name.includes('开发完成') || issue.status.name.includes('Development Complete')) ? '#30d158' : (issue.status.name.includes('验证完成') || issue.status.name.includes('Verification Complete')) ? 'var(--text-secondary)' : '#ff453a',
                    cursor: (issue.status.name.includes('开发完成') || issue.status.name.includes('Development Complete') || issue.status.name.includes('验证完成') || issue.status.name.includes('Verification Complete')) ? 'default' : 'pointer'
                }}>
                {(issue.status.name.includes('开发完成') || issue.status.name.includes('Development Complete') || issue.status.name.includes('验证完成') || issue.status.name.includes('Verification Complete')) ? '✓' : ''}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
                <div className="issue-subject" style={{
                    fontSize: 13,
                    color: (issue.status.name.includes('验证完成') || issue.status.name.includes('Verification Complete')) ? 'var(--text-secondary)' : 'var(--text-primary)',
                    textDecoration: (issue.status.name.includes('验证完成') || issue.status.name.includes('Verification Complete')) ? 'line-through' : 'none',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                }}>{issue.subject}</div>
                <div className="issue-meta" style={{ fontSize: 10, marginTop: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--text-secondary)' }}>
                    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                        <span style={{ background: 'rgba(255,69,58,0.15)', borderRadius: 8, padding: '1px 6px', fontSize: 10, color: '#ff453a', position: 'relative', fontWeight: 500, border: '1px solid rgba(255,69,58,0.3)' }}>
                            {issue.status.name}
                            <select value={issue.status.id} onClick={e => e.stopPropagation()} onChange={e => onUpdateStatus(issue.id, parseInt(e.target.value))} style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }}>
                                {statusList.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                            </select>
                            <span style={{ marginLeft: 3, fontSize: 10 }}>⌄</span>
                        </span>
                        <span>•</span>
                        <span style={{ color: 'var(--text-secondary)', fontSize: 10, position: 'relative' }}>
                            {issue.priority.name}
                            <select value={issue.priority.id} onClick={e => e.stopPropagation()} onChange={e => onUpdatePriority(issue.id, parseInt(e.target.value))} style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }}>
                                {priorityList.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </select>
                            <span style={{ marginLeft: 3, fontSize: 10, color: 'var(--text-secondary)' }}>⌄</span>
                        </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ color: 'var(--text-secondary)' }}>▷</span>
                        <span style={{ color: 'var(--text-secondary)', fontSize: 10, position: 'relative' }}>
                            {issue.fixed_version?.name || '-'}
                            <select value={issue.fixed_version?.id || ''} onClick={e => e.stopPropagation()} onChange={e => onUpdateVersion(issue.id, e.target.value)} style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }}>
                                <option value="">-</option>
                                {versionList.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                            </select>
                            <span style={{ marginLeft: 3, fontSize: 10, color: 'var(--text-secondary)' }}>⌄</span>
                        </span>
                        <span style={{ color: 'var(--text-secondary)', marginLeft: 8 }}>👤</span>
                        <span style={{ color: 'var(--text-secondary)', fontSize: 10, position: 'relative' }}>
                            {issue.assigned_to?.name || '-'}
                            <select value={issue.assigned_to?.id || ''} onClick={e => e.stopPropagation()} onChange={e => onUpdateAssignee(issue.id, e.target.value)} style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }}>
                                <option value="">-</option>
                                {(() => {
                                    const { grouped, noGroup, sortedGroups } = groupedMembers;
                                    if (sortedGroups.length === 0) {
                                        return noGroup.map((m: any) => <option key={m.id} value={m.id}>{m.name}</option>);
                                    }
                                    return (
                                        <>
                                            {sortedGroups.map(g => (
                                                <optgroup key={g} label={g}>
                                                    {grouped[g].sort((a, b) => a.name.localeCompare(b.name)).map(m => (
                                                        <option key={m.id} value={m.id}>{m.name}</option>
                                                    ))}
                                                </optgroup>
                                            ))}
                                            {noGroup.length > 0 && (
                                                <optgroup label="Others">
                                                    {noGroup.sort((a, b) => a.name.localeCompare(b.name)).map(m => (
                                                        <option key={m.id} value={m.id}>{m.name}</option>
                                                    ))}
                                                </optgroup>
                                            )}
                                        </>
                                    );
                                })()}
                            </select>
                            <span style={{ marginLeft: 3, fontSize: 10, color: 'var(--text-secondary)' }}>⌄</span>
                        </span>
                    </div>
                </div>
            </div>
            {/* Follow Button (Eye Icon) */}
            <div
                className="follow-button"
                onClick={(e) => { e.stopPropagation(); onToggleFollow(issue.id); }}
                style={{
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: isFollowed ? '#0c66ff' : 'var(--text-secondary)',
                    opacity: isFollowed ? 1 : 0.3,
                    transition: 'all 0.2s',
                    padding: '4px',
                    borderRadius: '4px'
                }}
                onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                onMouseLeave={e => { if (!isFollowed) e.currentTarget.style.opacity = '0.3'; }}
                title={isFollowed ? 'Unfollow' : 'Follow'}
            >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                    <circle cx="12" cy="12" r="3"></circle>
                </svg>
            </div>
        </div>
    );
}, (prevProps, nextProps) => {
    // Custom comparison: only re-render if these specific props changed
    // We add a ref check or callback to notify parent about position? 
    // Actually, for indicator, we need the DOM element. 
    // But since we can't easily pass ref through memo without forwardRef, 
    // and we have many items, maybe we just use a data attribute and let parent find it?
    // Using `data-issue-id` is good.
    return (
        prevProps.isSelected === nextProps.isSelected &&
        prevProps.issue.id === nextProps.issue.id &&
        prevProps.issue.subject === nextProps.issue.subject &&
        prevProps.issue.status.id === nextProps.issue.status.id &&
        prevProps.issue.priority.id === nextProps.issue.priority.id &&
        prevProps.issue.fixed_version?.id === nextProps.issue.fixed_version?.id &&
        prevProps.issue.assigned_to?.id === nextProps.issue.assigned_to?.id &&
        prevProps.statusList === nextProps.statusList &&
        prevProps.priorityList === nextProps.priorityList &&
        prevProps.versionList === nextProps.versionList &&
        prevProps.groupedMembers === nextProps.groupedMembers &&
        prevProps.isFollowed === nextProps.isFollowed
    );
});

const NoteEditor: React.FC<{ issueId: number, onAddNote: (id: number, text: string) => Promise<void> }> = ({ issueId, onAddNote }) => {
    const [noteText, setNoteText] = useState('');
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const handleSend = async () => {
        if (noteText.trim()) {
            await onAddNote(issueId, noteText.trim());
            setNoteText('');
            // Reset textarea size after sending
            if (textareaRef.current) {
                textareaRef.current.style.height = '36px';
                textareaRef.current.style.background = 'var(--input-bg)';
                textareaRef.current.blur();
            }
        }
    };

    return (
        <div className="note-editor-bar pane-footer" style={{ flexDirection: 'column', alignItems: 'stretch', justifyContent: 'flex-end' }}>
            <div style={{ position: 'relative', width: '100%' }}>
                <textarea
                    ref={textareaRef}
                    className="note-input"
                    value={noteText}
                    onChange={e => setNoteText(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && e.shiftKey) {
                            e.preventDefault();
                            handleSend();
                        } else if (e.key === 'Escape') {
                            e.currentTarget.blur();
                        }
                    }}
                    placeholder="Add a note... (Shift + Enter to send)"
                    style={{ width: '100%', height: 36, display: 'block', background: 'var(--input-bg)', border: 'none', borderRadius: 8, padding: '9px 50px 9px 15px', color: 'var(--text-primary)', resize: 'none', fontSize: 13, transition: 'all 0.2s', outline: 'none' }}
                    onFocus={e => {
                        (e.target as any).style.height = '100px';
                        (e.target as any).style.background = 'var(--editor-bg)';
                        (e.target as any).style.backdropFilter = 'blur(50px)';
                    }}
                    onBlur={e => {
                        if (!noteText) {
                            (e.target as any).style.height = '36px';
                        }
                        (e.target as any).style.background = 'var(--input-bg)';
                        (e.target as any).style.backdropFilter = 'none';
                    }}
                />
                <button
                    onClick={handleSend}
                    style={{ position: 'absolute', right: 8, bottom: 4, background: '#0c66ff', border: 'none', width: 28, height: 28, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', cursor: 'pointer', transition: 'all 0.12s' }}
                    onMouseDown={e => { (e.currentTarget as any).style.transform = 'scale(0.95)' }}
                    onMouseUp={e => { (e.currentTarget as any).style.transform = 'scale(1)' }}
                >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="22" y1="2" x2="11" y2="13"></line>
                        <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                    </svg>
                </button>
            </div>
        </div>
    );
};



const TabbedIssueList = React.memo(({
    currentKey,
    getVersionViewData,
    vm,
    deferredGroupedIssues,
    selectedIssueState, // Pass full state object
    handleSelectIssue,
    handleUpdateStatus,
    handleUpdatePriority,
    handleUpdateVersion,
    handleUpdateAssignee,
    stableStatusList,
    stablePriorityList,
    stableVersionListCache,
    stableGroupedMemberCache,
}: any) => {
    // Keep track of which tabs we have rendered at least once
    const [visitedTabs, setVisitedTabs] = useState<Set<string>>(new Set());

    useEffect(() => {
        // Mark current as visited
        if (currentKey && !visitedTabs.has(currentKey)) {
            setVisitedTabs(prev => {
                const newSet = new Set(prev);
                newSet.add(currentKey);
                return newSet;
            });
        }
    }, [currentKey, visitedTabs]);

    const tabsToRender = Array.from(visitedTabs);

    return (
        <div style={{ position: 'relative', width: '100%', height: '100%' }}>
            {tabsToRender.map(key => {
                const isActive = key === currentKey;
                const data = vm.getVersionViewData(key);
                if (!data) return null;

                // Use visibility: hidden + absolute positioning to preserve scroll position and layout state
                // This is much more reliable than display: none + manual scroll restoration
                return (
                    <div
                        key={key}
                        data-tab-key={key}
                        style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: '100%',
                            height: '100%',
                            overflowY: 'auto',
                            visibility: isActive ? 'visible' : 'hidden',
                            zIndex: isActive ? 1 : 0,
                            backgroundColor: 'transparent'
                        }}
                    >
                        {/* Wrapper for padding - ensure it doesn't break absolute layout */}
                        <div style={{ paddingBottom: 20 }}>
                            <IssueListContent
                                isActive={isActive}
                                tabKey={key} // Pass tabKey so content knows who it is
                                globalSelectedIssueState={selectedIssueState}
                                data={data}
                                vm={vm}
                                onSelectIssue={handleSelectIssue}
                                handleUpdateStatus={handleUpdateStatus}
                                handleUpdatePriority={handleUpdatePriority}
                                handleUpdateVersion={handleUpdateVersion}
                                handleUpdateAssignee={handleUpdateAssignee}
                                stableStatusList={stableStatusList}
                                stablePriorityList={stablePriorityList}
                                stableVersionListCache={stableVersionListCache}
                                stableGroupedMemberCache={stableGroupedMemberCache}
                            />
                        </div>
                    </div>
                );
            })}
        </div>
    );
});

// Extracted Inner List Content
const IssueListContent = React.memo(({
    data,
    vm,
    isActive,
    tabKey,
    globalSelectedIssueState,
    onSelectIssue,
    stableStatusList,
    stablePriorityList,
    stableVersionListCache,
    stableGroupedMemberCache,
    handleUpdateStatus,
    handleUpdatePriority,
    handleUpdateVersion,
    handleUpdateAssignee,
}: any) => {
    // We need local collapsed state for THIS list instance?
    // Parent App has `collapsedGroups` which is global (keyed by group name).
    // This is fine as long as group names are unique enough or we want shared collapsed state.
    // Ideally, local state per tab is better for "memory", but let's stick to simple "toggleGroup" from parent if passed?
    // Wait, toggleGroup is in App. We need to pass it or use local state here.
    // Using local state here ensures each tab has its own expand/collapse memory which is even better!
    const [localCollapsed, setLocalCollapsed] = useState<Record<string, boolean>>({});

    const toggleLocalGroup = (groupKey: string) => {
        setLocalCollapsed(prev => ({ ...prev, [groupKey]: !prev[groupKey] }));
    };

    const listRef = useRef<HTMLDivElement>(null);

    // Local selection state for this tab
    const [localSelectedId, setLocalSelectedId] = useState<number | null>(null);

    // Sync with App when this tab becomes active
    useEffect(() => {
        if (isActive) {
            // Check if global selection is intended for THIS tab (Deep Link or same-tab click)
            // Or if global selection is empty/null (we can restore ours)
            // sourceKey comparison is crucial to prevent "inheriting" selection from another tab
            const globalId = globalSelectedIssueState?.id;
            const sourceKey = globalSelectedIssueState?.sourceKey;

            const isForMe = sourceKey === tabKey;

            if (isForMe && globalId) {
                // It's explicitly for us, adopt it
                if (globalId !== localSelectedId) {
                    setLocalSelectedId(globalId);
                }
            } else {
                // Not for us (or empty), check if we should restore OUR selection to App
                // Only if current global is NOT for us (i.e. we are switching TO this tab)
                // If global is empty, we restore. if global is for another key, we still restore (overwriting it)
                if (localSelectedId !== globalId) {
                    onSelectIssue(localSelectedId, tabKey);
                }
            }
        }
    }, [isActive, globalSelectedIssueState, data, tabKey]);

    // Handle local click - notify parent with our key
    const onLocalSelect = useCallback((id: number) => {
        setLocalSelectedId(id);
        onSelectIssue(id, data.tabKey); // Pass tabKey (we need to inject this prop)
    }, [onSelectIssue, data]);


    const [indicatorStyle, setIndicatorStyle] = useState<React.CSSProperties>({ opacity: 0 });
    const prevActiveRef = useRef(isActive);

    useEffect(() => {
        if (!isActive) {
            prevActiveRef.current = false;
            return;
        }

        const justWokeUp = !prevActiveRef.current;
        if (justWokeUp) {
            prevActiveRef.current = true;
        }

        if (localSelectedId && listRef.current) {
            // Find the selected item element
            // For tab activation, delay the query to avoid blocking the visibility switch
            const delay = justWokeUp ? 2 : 0; // 2 RAF for tab switch, immediate for selection change

            let rafId: number;
            const scheduleUpdate = (remaining: number) => {
                if (remaining > 0) {
                    rafId = requestAnimationFrame(() => scheduleUpdate(remaining - 1));
                } else {
                    const el = listRef.current?.querySelector(`[data-issue-id="${localSelectedId}"]`) as HTMLElement;
                    if (el) {
                        setIndicatorStyle({
                            top: el.offsetTop,
                            height: el.offsetHeight,
                            opacity: 1
                        });
                    } else {
                        setIndicatorStyle({ opacity: 0 });
                    }
                }
            };

            scheduleUpdate(delay);
            return () => {
                if (rafId) cancelAnimationFrame(rafId);
            };
        } else {
            setIndicatorStyle({ opacity: 0 });
        }
    }, [localSelectedId, data, localCollapsed, isActive]);


    const sortedKeys = data.sortedKeys || [];
    const groups = data.groups || {};

    if (sortedKeys.length === 0 && !vm.isLoading) {
        return (
            <div style={{ textAlign: 'center', marginTop: 50, color: 'var(--text-secondary)', fontSize: 13 }}>
                No issues found in this section.<br />
                <button onClick={() => vm.refreshData()} style={{ marginTop: 10, background: 'none', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '5px 15px', borderRadius: 4, cursor: 'pointer' }}>Force Refresh</button>
            </div>
        );
    }

    // Force hide indicator if not active to prevent any "ghost" residue
    // This is a safety guard on top of parent visibility:hidden
    const finalIndicatorStyle = isActive ? indicatorStyle : { opacity: 0, transition: 'none' };

    return (
        <div style={{ position: 'relative' }} ref={listRef}>
            <div className="selection-indicator" style={finalIndicatorStyle} />
            {sortedKeys.map((key: string) => {
                const isCollapsed = localCollapsed[key] ?? (key.includes('验证完成') || key.includes('Verification Complete'));
                const issuesInGroup = groups[key];

                return (
                    <div key={key}>
                        <div
                            className="group-header"
                            onClick={() => toggleLocalGroup(key)}
                            style={{
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8,
                                userSelect: 'none'
                            }}
                        >
                            <span style={{
                                fontSize: 10,
                                width: 12,
                                display: 'inline-block',
                                transform: isCollapsed ? 'rotate(-90deg)' : 'none',
                                transition: 'transform 0.2s',
                                textAlign: 'center'
                            }}>▼</span>
                            <span style={{ flex: 1 }}>{key}</span>
                            <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 'normal' }}>{issuesInGroup.length}</span>
                        </div>

                        {!isCollapsed && issuesInGroup.map((i: Issue) => (
                            <MemoIssueItem
                                key={i.id}
                                issue={i}
                                isSelected={localSelectedId === i.id}
                                onSelect={onLocalSelect}
                                onUpdateStatus={handleUpdateStatus}
                                onUpdatePriority={handleUpdatePriority}
                                onUpdateVersion={handleUpdateVersion}
                                onUpdateAssignee={handleUpdateAssignee}
                                statusList={stableStatusList}
                                priorityList={stablePriorityList}
                                versionList={stableVersionListCache[i.project?.id || -1] || []}
                                groupedMembers={stableGroupedMemberCache[i.project?.id || -1] || stableGroupedMemberCache['global']}
                                isFollowed={vm.followedIssueIds.has(i.id)}
                                onToggleFollow={async (id: number) => {
                                    const followed = vm.followedIssueIds.has(id);
                                    if (followed) {
                                        await vm.removeWatcher(id, vm.currentUser!.id);
                                    } else {
                                        await vm.addWatcher(id, vm.currentUser!.id);
                                    }
                                }}
                            />
                        ))}
                    </div>
                );
            })}
        </div>
    );
});

// Remote search results list component
const RemoteSearchResults = React.memo(({
    results,
    isSearching,
    searchQuery,
    totalCount,
    selectedIssueId,
    onSelectIssue,
    vm,
    handleUpdateStatus,
    handleUpdatePriority,
    handleUpdateVersion,
    handleUpdateAssignee,
    stableStatusList,
    stablePriorityList,
    stableVersionListCache,
    stableGroupedMemberCache
}: {
    results: Issue[],
    isSearching: boolean,
    searchQuery: string,
    totalCount: number,
    selectedIssueId: number | null,
    onSelectIssue: (id: number, sourceKey: string) => void,
    vm: any,
    handleUpdateStatus: (id: number, statusId: number) => void,
    handleUpdatePriority: (id: number, priorityId: number) => void,
    handleUpdateVersion: (id: number, versionId: string) => void,
    handleUpdateAssignee: (id: number, assigneeId: string) => void,
    stableStatusList: any[],
    stablePriorityList: any[],
    stableVersionListCache: Record<number, any[]>,
    stableGroupedMemberCache: Record<number | string, any>
}) => {
    const listRef = useRef<HTMLDivElement>(null);
    const [indicatorStyle, setIndicatorStyle] = useState<React.CSSProperties>({ opacity: 0 });

    // Update selection indicator position
    useEffect(() => {
        if (selectedIssueId && listRef.current) {
            const el = listRef.current.querySelector(`[data-issue-id="${selectedIssueId}"]`) as HTMLElement;
            if (el) {
                setIndicatorStyle({
                    top: el.offsetTop,
                    height: el.offsetHeight,
                    opacity: 1
                });
            } else {
                setIndicatorStyle({ opacity: 0 });
            }
        } else {
            setIndicatorStyle({ opacity: 0 });
        }
    }, [selectedIssueId, results]);

    if (!searchQuery.trim()) {
        return (
            <div style={{ textAlign: 'center', marginTop: 80, color: 'var(--text-secondary)', fontSize: 13 }}>
                <div style={{ marginBottom: 10 }}>
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.4 }}>
                        <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"></path>
                    </svg>
                </div>
                Type keywords to search issues on the server<br />
                <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Supports searching by title, description, and more</span>
            </div>
        );
    }

    if (isSearching) {
        return (
            <div style={{ textAlign: 'center', marginTop: 80, color: 'var(--text-secondary)', fontSize: 13 }}>
                <div style={{ marginBottom: 10 }}>
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: 'spin 1s linear infinite' }}>
                        <circle cx="12" cy="12" r="10" strokeDasharray="32" strokeDashoffset="12"></circle>
                    </svg>
                </div>
                Searching on server...
            </div>
        );
    }

    if (results.length === 0) {
        return (
            <div style={{ textAlign: 'center', marginTop: 80, color: 'var(--text-secondary)', fontSize: 13 }}>
                <div style={{ marginBottom: 10 }}>🔍</div>
                No issues found matching "{searchQuery}"<br />
                <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Try different keywords</span>
            </div>
        );
    }

    return (
        <div style={{ padding: '0 0 20px', position: 'relative' }} ref={listRef}>
            {/* Selection indicator */}
            <div className="selection-indicator" style={indicatorStyle} />

            {/* Search results header */}
            <div style={{
                padding: '10px 15px',
                fontSize: 11,
                color: 'var(--text-secondary)',
                borderBottom: '1px solid var(--border-color)',
                background: 'var(--bg-secondary)',
                position: 'sticky',
                top: 0,
                zIndex: 10
            }}>
                Found {totalCount} results, showing first {results.length}
            </div>

            {results.map((issue: Issue) => (
                <div key={issue.id}>
                    {/* Project and version info tags */}
                    <div style={{
                        padding: '6px 15px 2px',
                        fontSize: 10,
                        color: 'var(--text-tertiary)',
                        display: 'flex',
                        gap: 8,
                        alignItems: 'center'
                    }}>
                        <span style={{
                            background: 'rgba(12, 102, 255, 0.1)',
                            padding: '2px 6px',
                            borderRadius: 4,
                            color: 'var(--accent-color)'
                        }}>
                            {issue.project?.name || 'Unknown Project'}
                        </span>
                        {issue.fixed_version && (
                            <span style={{
                                background: 'rgba(48, 209, 88, 0.1)',
                                padding: '2px 6px',
                                borderRadius: 4,
                                color: '#30d158'
                            }}>
                                {issue.fixed_version.name}
                            </span>
                        )}
                    </div>
                    <MemoIssueItem
                        issue={issue}
                        isSelected={selectedIssueId === issue.id}
                        onSelect={(id) => onSelectIssue(id, 'remote-search')}
                        onUpdateStatus={handleUpdateStatus}
                        onUpdatePriority={handleUpdatePriority}
                        onUpdateVersion={handleUpdateVersion}
                        onUpdateAssignee={handleUpdateAssignee}
                        statusList={stableStatusList}
                        priorityList={stablePriorityList}
                        versionList={stableVersionListCache[issue.project?.id || -1] || []}
                        groupedMembers={stableGroupedMemberCache[issue.project?.id || -1] || stableGroupedMemberCache['global']}
                        isFollowed={vm.followedIssueIds.has(issue.id)}
                        onToggleFollow={async (id: number) => {
                            const followed = vm.followedIssueIds.has(id);
                            if (followed) {
                                await vm.removeWatcher(id, vm.currentUser!.id);
                            } else {
                                await vm.addWatcher(id, vm.currentUser!.id);
                            }
                        }}
                    />
                </div>
            ))}
        </div>
    );
});

const App: React.FC = () => {
    const vm = useAppViewModel();

    // Derived current tab key
    const currentTabKey = useMemo(() =>
        vm.selectedProjectId === -2 ? '-2' :
            vm.selectedProjectId === -3 ? '-3' :
                vm.selectedVersionId ? vm.selectedVersionId.toString() :
                    // Default to project bucket if no version is selected
                    (vm.selectedProjectId !== null ? `p-${vm.selectedProjectId}` : ''),
        [vm.selectedProjectId, vm.selectedVersionId]
    );

    // Track active selection with its source tab to prevent cross-tab auto-selection
    const [selectedIssueState, setSelectedIssueState] = useState<{ id: number | null, sourceKey: string }>({ id: null, sourceKey: '' });
    const selectedIssueId = selectedIssueState.id; // derived for compatibility



    // Track which projects are expanded (independent toggle)
    const [expandedProjects, setExpandedProjects] = useState<Record<number, boolean>>(() => {
        const saved = localStorage.getItem('expandedProjects');
        return saved ? JSON.parse(saved) : {};
    });

    // Track which project's "Others" section is expanded
    const [expandedOthers, setExpandedOthers] = useState<Record<number, boolean>>({});

    // Version editing state
    const [editingVersionId, setEditingVersionId] = useState<number | null>(null);
    const [editVersionName, setEditVersionName] = useState('');
    const [showSettings, setShowSettings] = useState(false);
    const [showUpdaterModal, setShowUpdaterModal] = useState(false);
    const [autoUpdateEnabled, setAutoUpdateEnabled] = useState(true);
    const [autoUpdateInterval, setAutoUpdateInterval] = useState(24);
    const [newTaskSubject, setNewTaskSubject] = useState('');

    // Track which groups are collapsed in the issue list
    const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>(() => {
        const saved = localStorage.getItem('collapsedGroups');
        return saved ? JSON.parse(saved) : {};
    });



    // Selection Indicator State (Sidebar only now, List indicator moved to IssueListContent)
    const sidebarRef = useRef<HTMLDivElement>(null);
    const [sidebarIndicatorStyle, setSidebarIndicatorStyle] = useState<React.CSSProperties>({ opacity: 0 });

    // Defer groupedIssues update to avoid blocking UI during version switch
    const deferredGroupedIssues = useDeferredValue(vm.groupedIssues);
    const isVersionSwitching = deferredGroupedIssues !== vm.groupedIssues;

    // Track previous version to detect version switches
    const prevVersionIdRef = useRef<number | null>(vm.selectedVersionId);
    const shouldScrollToSelectedRef = useRef(false);

    // Resizable pane widths
    // Sidebar uses fixed width, list uses ratio of remaining space
    const [sidebarWidth, setSidebarWidth] = useState(() => parseInt(localStorage.getItem('sidebarWidth') || '220'));
    const [listRatio, setListRatio] = useState(() => parseFloat(localStorage.getItem('listRatio') || '0.35')); // 35% of remaining space
    const [resizingPane, setResizingPane] = useState<'sidebar' | 'list' | null>(null);
    const [windowWidth, setWindowWidth] = useState(window.innerWidth);

    // Listen for window resize
    useEffect(() => {
        const handleResize = () => setWindowWidth(window.innerWidth);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Load auto update settings
    useEffect(() => {
        const loadAutoUpdateSettings = async () => {
            try {
                const settings = await window.updater?.getAutoUpdateSettings();
                if (settings) {
                    setAutoUpdateEnabled(settings.enabled);
                    setAutoUpdateInterval(settings.interval);
                }
            } catch (e) {
                console.error('Failed to load auto update settings:', e);
            }
        };
        loadAutoUpdateSettings();

        // Listen for background silent update notifications
        const unsubscribe = window.updater?.onUpdateAvailableSilent((info) => {
            // Show update UI
            setShowUpdaterModal(true);
        });

        return () => {
            unsubscribe?.();
        };
    }, []);

    // Calculate actual list width from ratio
    const remainingWidth = windowWidth - sidebarWidth - 8; // 8px for resize handles
    const listWidth = Math.max(300, Math.min(800, Math.round(remainingWidth * listRatio)));

    // Track previous groupedIssues to detect reordering
    const prevGroupedIssuesRef = useRef(vm.groupedIssues);

    // Detect version switch or issue reordering for scroll behavior
    useEffect(() => {
        if (prevVersionIdRef.current !== vm.selectedVersionId) {
            shouldScrollToSelectedRef.current = true;
            prevVersionIdRef.current = vm.selectedVersionId;
        }
        // Also scroll when issue list is reordered (e.g., status change)
        if (prevGroupedIssuesRef.current !== vm.groupedIssues && selectedIssueId) {
            // Check if the selected issue moved to a different group
            const findGroup = (issues: typeof vm.groupedIssues, id: number) => {
                for (const key of issues.sortedKeys) {
                    if (issues.groups[key]?.some(i => i.id === id)) return key;
                }
                return null;
            };
            const prevGroup = findGroup(prevGroupedIssuesRef.current, selectedIssueId);
            const newGroup = findGroup(vm.groupedIssues, selectedIssueId);
            if (prevGroup && newGroup && prevGroup !== newGroup) {
                shouldScrollToSelectedRef.current = true;
            }
        }
        prevGroupedIssuesRef.current = vm.groupedIssues;
    }, [vm.selectedVersionId, vm.groupedIssues, selectedIssueId]);

    // Track if sidebar indicator has been initialized
    const [sidebarIndicatorInitialized, setSidebarIndicatorInitialized] = useState(false);

    // Update sidebar indicator position
    const updateSidebarIndicator = useCallback(() => {
        if (!sidebarRef.current) return;

        const update = () => {
            if (!sidebarRef.current) return;
            const selectedItem = sidebarRef.current.querySelector('.sidebar-item.selected') as HTMLElement;
            if (selectedItem) {
                // Use transform instead of top/left for GPU-accelerated animation
                setSidebarIndicatorStyle({
                    transform: `translate(${selectedItem.offsetLeft}px, ${selectedItem.offsetTop}px)`,
                    width: selectedItem.offsetWidth,
                    height: selectedItem.offsetHeight,
                    opacity: 1
                });
            } else {
                setSidebarIndicatorStyle({ opacity: 0 });
            }
        };

        // Multiple frames to ensure smooth layout transitions during resize or expansion
        let count = 0;
        const sync = () => {
            update();
            if (count < 3) { // Reduced to 3 for better performance
                count++;
                requestAnimationFrame(sync);
            }
        };
        requestAnimationFrame(sync);
    }, []);
    // Optimistic click handler for immediate indicator response
    const handleSidebarItemClick = useCallback((e: React.MouseEvent<HTMLElement>) => {
        const target = (e.target as HTMLElement).closest('.sidebar-item') as HTMLElement;
        if (target) {
            setSidebarIndicatorStyle({
                transform: `translate(${target.offsetLeft}px, ${target.offsetTop}px)`,
                width: target.offsetWidth,
                height: target.offsetHeight,
                opacity: 1
            });
        }
    }, []);

    useLayoutEffect(() => {
        updateSidebarIndicator();
    }, [expandedProjects, vm.projects, vm.projectVersionsMap, vm.activeVersionIds, updateSidebarIndicator, windowWidth, sidebarWidth]);

    useEffect(() => {
        const handleGlobalClick = (e: MouseEvent) => {
            const dropdown = document.getElementById('watcher-filter-dropdown');
            if (dropdown && dropdown.style.display === 'block') {
                const target = e.target as HTMLElement;
                if (!dropdown.contains(target) && !target.closest('.watcher-filter-trigger')) {
                    dropdown.style.display = 'none';
                }
            }
        };
        document.addEventListener('mousedown', handleGlobalClick);
        (window as any).toggleAssignedWatcherFilter = () => {
            const dropdown = document.getElementById('assigned-watcher-filter-dropdown');
            if (dropdown) {
                dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
            }
        };
        return () => {
            document.removeEventListener('mousedown', handleGlobalClick);
            delete (window as any).toggleAssignedWatcherFilter;
        };
    }, []);

    // Initialize sidebar indicator after data loads
    useEffect(() => {
        if (!vm.isLoading && vm.projects.length > 0 && !sidebarIndicatorInitialized) {
            // Wait for DOM to be ready after data loads
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    updateSidebarIndicator();
                    setSidebarIndicatorInitialized(true);
                });
            });
        }
    }, [vm.isLoading, vm.projects, sidebarIndicatorInitialized, updateSidebarIndicator]);

    // Image lightbox state
    const [lightboxImage, setLightboxImage] = useState<string | null>(null);
    const [lightboxScale, setLightboxScale] = useState(1);
    const [lightboxOffset, setLightboxOffset] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

    // Lightbox control handlers - memoized for performance
    const handleLightboxShrink = useCallback(() => {
        setLightboxScale(s => Math.max(0.25, s - 0.25));
    }, []);

    const handleLightboxReset = useCallback(() => {
        setLightboxScale(1);
        setLightboxOffset({ x: 0, y: 0 });
    }, []);

    const handleLightboxEnlarge = useCallback(() => {
        setLightboxScale(s => Math.min(4, s + 0.25));
    }, []);

    const handleLightboxClose = useCallback(() => {
        setLightboxImage(null);
        setLightboxOffset({ x: 0, y: 0 });
        setLightboxScale(1);
    }, []);

    // Calculate actual list width from ratio (Moved up)


    // Quick add task version - defaults to selected version or highest numbered version
    const defaultQuickAddVersion = useMemo(() => {
        if (vm.selectedVersionId) return vm.selectedVersionId;
        if (vm.selectedProjectId === -1 || vm.selectedProjectId === null) return null;
        const versions = vm.projectVersionsMap[vm.selectedProjectId] || [];
        // Find highest version that starts with a digit
        const numberedVersions = versions.filter((v: { name: string }) => /^\d/.test(v.name));
        if (numberedVersions.length === 0) return versions[0]?.id || null;
        // Sort by version name descending (assuming semantic versioning like 0.6.0 > 0.5.0)
        numberedVersions.sort((a: { name: string }, b: { name: string }) => b.name.localeCompare(a.name, undefined, { numeric: true }));
        return numberedVersions[0]?.id || null;
    }, [vm.selectedVersionId, vm.selectedProjectId, vm.projectVersionsMap]);

    const [quickAddVersionId, setQuickAddVersionId] = useState<number | null>(null);
    const [quickAddAssigneeId, setQuickAddAssigneeId] = useState<number | null>(null);

    // Default quick add assignee to current user
    useEffect(() => {
        if (vm.currentUser && quickAddAssigneeId === null) {
            setQuickAddAssigneeId(vm.currentUser.id);
        }
    }, [vm.currentUser]);


    // New version dialog state
    const [newVersionProjectId, setNewVersionProjectId] = useState<number | null>(null);
    const [newVersionName, setNewVersionName] = useState('');

    // Delete confirmation state
    const [deleteVersionConfirm, setDeleteVersionConfirm] = useState<{ projectId: number; versionId: number; name: string } | null>(null);
    const [deleteIssueConfirm, setDeleteIssueConfirm] = useState<number | null>(null);

    // Inline editing state
    const [editingTitle, setEditingTitle] = useState(false);
    const [editingDescription, setEditingDescription] = useState(false);
    const [editTitleValue, setEditTitleValue] = useState('');
    const [editDescriptionValue, setEditDescriptionValue] = useState('');
    const [pendingUploads, setPendingUploads] = useState<{ token: string, filename: string, content_type: string, tempUrl?: string }[]>([]);

    // Refresh button state
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const issueListRef = React.useRef<HTMLDivElement>(null);
    const detailPaneRef = React.useRef<HTMLElement>(null);
    // Cache scroll position per issue to restore after refresh
    const detailScrollPositionRef = React.useRef<Map<number, number>>(new Map());

    // Sync quickAddVersionId with default when project/version changes
    useEffect(() => {
        setQuickAddVersionId(defaultQuickAddVersion);
    }, [defaultQuickAddVersion]);

    // Persist expanded projects state
    useEffect(() => {
        localStorage.setItem('expandedProjects', JSON.stringify(expandedProjects));
    }, [expandedProjects]);

    // Persistence for draft settings in the modal to avoid reset on re-renders
    const [draftURL, setDraftURL] = useState(localStorage.getItem('redmineURL') || 'http://192.168.0.191:9999');
    const [draftKey, setDraftKey] = useState(localStorage.getItem('redmineAPIKey') || '');

    // Sync drafts if VM values change (e.g. from background tasks or initial load correction)
    useEffect(() => {
        if (vm.redmineURL) setDraftURL(vm.redmineURL);
        if (vm.redmineAPIKey) setDraftKey(vm.redmineAPIKey);
    }, [vm.redmineURL, vm.redmineAPIKey]);

    // Persistence for collapsed groups
    useEffect(() => {
        localStorage.setItem('collapsedGroups', JSON.stringify(collapsedGroups));
    }, [collapsedGroups]);

    const toggleGroup = useCallback((groupName: string) => {
        setCollapsedGroups(prev => ({
            ...prev,
            [groupName]: !prev[groupName]
        }));
    }, []);

    const downloadFile = async (url: string, filename: string) => {
        try {
            const blob = await vm.fetchImageBlob(url);
            if (!blob) throw new Error('Failed to fetch file content');
            const arrayBuffer = await blob.arrayBuffer();
            await (window as any).ipcRenderer.invoke('save-file', {
                data: new Uint8Array(arrayBuffer),
                filename
            });
        } catch (e: any) {
            console.error('Download failed', e);
            alert('Download failed: ' + e.message);
        }
    };

    const handleUpdateStatus = useCallback((id: number, sid: number) => vm.updateIssue(id, { status_id: sid }), [vm.updateIssue]);
    const handleUpdatePriority = useCallback((id: number, pid: number) => vm.updateIssue(id, { priority_id: pid }), [vm.updateIssue]);
    const handleUpdateVersion = useCallback((id: number, vid: string) => vm.updateIssue(id, { fixed_version_id: vid || '' }), [vm.updateIssue]);
    const handleUpdateAssignee = useCallback((id: number, aid: string) => vm.updateIssue(id, { assigned_to_id: aid || '' }), [vm.updateIssue]);
    const handleSelectIssue = useCallback((id: number | null, sourceKey: string = '') => {
        setSelectedIssueState({ id, sourceKey });
    }, []);

    // Stable references for MemoIssueItem props to prevent unnecessary re-renders
    const stableStatusList = useMemo(() => vm.issueStatuses, [vm.issueStatuses]);
    const stablePriorityList = useMemo(() => vm.issuePriorities, [vm.issuePriorities]);
    const stableMemberList = useMemo(() => vm.globalMembers, [vm.globalMembers]);
    // Cache version lists per project
    const stableVersionListCache = useMemo(() => {
        const cache: Record<number, any[]> = {};
        Object.entries(vm.projectVersionsMap).forEach(([k, v]) => {
            cache[parseInt(k)] = v;
        });
        return cache;
    }, [vm.projectVersionsMap]);
    // Cache member lists per project
    const stableMemberListCache = useMemo(() => {
        const cache: Record<number, any[]> = {};
        Object.entries(vm.projectMembersMap).forEach(([k, v]) => {
            cache[parseInt(k)] = v;
        });
        return cache;
    }, [vm.projectMembersMap]);

    // Cache grouped members per project to avoid calculation during render

    // Get current project's member list or fall back to global
    const currentProjectMembers = useMemo(() => {
        if (vm.selectedProjectId && vm.selectedProjectId > 0) {
            return stableMemberListCache[vm.selectedProjectId] || stableMemberList;
        }
        return stableMemberList;
    }, [vm.selectedProjectId, stableMemberListCache, stableMemberList]);
    // Get members for selected issue's project (for detail view)
    const getProjectMembers = (projectId: number | undefined) => {
        if (projectId && stableMemberListCache[projectId]) {
            return stableMemberListCache[projectId];
        }
        return stableMemberList;
    };

    // Group members by their roles/groups for dropdown display
    const groupMembersByRole = useCallback((members: { id: number; name: string; groups?: string[] }[]) => {
        const grouped: Record<string, { id: number; name: string }[]> = {};
        const noGroup: { id: number; name: string }[] = [];

        members.forEach(m => {
            if (m.groups && m.groups.length > 0) {
                // Add to first group (primary role)
                const primaryGroup = m.groups[0];
                if (!grouped[primaryGroup]) grouped[primaryGroup] = [];
                grouped[primaryGroup].push({ id: m.id, name: m.name });
            } else {
                noGroup.push({ id: m.id, name: m.name });
            }
        });

        // Sort groups and members within groups
        const sortedGroups = Object.keys(grouped).sort((a, b) => a.localeCompare(b));
        sortedGroups.forEach(g => grouped[g].sort((a, b) => a.name.localeCompare(b.name)));
        noGroup.sort((a, b) => a.name.localeCompare(b.name));

        return { grouped, noGroup, sortedGroups };
    }, []);

    // Cache grouped members per project to avoid calculation during render
    const stableGroupedMemberCache = useMemo(() => {
        const cache: Record<string, any> = {};
        Object.entries(stableMemberListCache).forEach(([k, v]) => {
            cache[k] = groupMembersByRole(v);
        });
        // Also cache global list grouping
        cache['global'] = groupMembersByRole(stableMemberList);
        return cache;
    }, [stableMemberListCache, stableMemberList, groupMembersByRole]);

    // Render grouped member options with optgroup
    const renderGroupedMemberOptions = useCallback((members: { id: number; name: string; groups?: string[] }[], excludeIds?: number[]) => {
        const { grouped, noGroup, sortedGroups } = groupMembersByRole(members);
        const filtered = excludeIds ? (m: { id: number }) => !excludeIds.includes(m.id) : () => true;

        const hasGroups = sortedGroups.length > 0;

        if (!hasGroups) {
            // No groups, just render flat list
            return members.filter(filtered).map(m => (
                <option key={m.id} value={m.id}>{m.name}</option>
            ));
        }

        return (
            <>
                {sortedGroups.map(groupName => {
                    const groupMembers = grouped[groupName].filter(filtered);
                    if (groupMembers.length === 0) return null;
                    return (
                        <optgroup key={groupName} label={groupName}>
                            {groupMembers.map(m => (
                                <option key={m.id} value={m.id}>{m.name}</option>
                            ))}
                        </optgroup>
                    );
                })}
                {noGroup.filter(filtered).length > 0 && (
                    <optgroup label="Others">
                        {noGroup.filter(filtered).map(m => (
                            <option key={m.id} value={m.id}>{m.name}</option>
                        ))}
                    </optgroup>
                )}
            </>
        );
    }, [groupMembersByRole]);

    // Listen for 'show-settings' from main process
    useEffect(() => {
        const handler = () => setShowSettings(true);
        (window as any).ipcRenderer.on('show-settings', handler);
        return () => {
            (window as any).ipcRenderer.off('show-settings', handler);
        };
    }, []);

    // Listen for 'open-issue-by-id' from main process (deep linking)
    // Listen for 'open-issue-by-id' from main process (deep linking)
    // Use ref to hold the latest handler dependencies to avoid rebinding listener
    const openIssueByIdDepsRef = useRef({ openIssueById: vm.openIssueById, selectProject: vm.selectProject, selectVersion: vm.selectVersion });
    useEffect(() => {
        openIssueByIdDepsRef.current = { openIssueById: vm.openIssueById, selectProject: vm.selectProject, selectVersion: vm.selectVersion };
    }, [vm.openIssueById, vm.selectProject, vm.selectVersion]);

    useEffect(() => {
        const handler = async (_: any, issueId: number) => {
            console.log('[App] Received open-issue-by-id:', issueId);
            const { openIssueById, selectProject, selectVersion } = openIssueByIdDepsRef.current;

            try {
                const result = await openIssueById(issueId);

                if (result) {
                    const { projectId, versionId, issueId: foundIssueId } = result;

                    // Switch to the project and version
                    if (versionId) {
                        selectVersion(projectId, versionId);
                    } else {
                        selectProject(projectId);
                    }

                    // Select the issue
                    // Select the issue
                    // We need to set it globally so the newly active tab picks it up
                    // Calculate target sourceKey to ensure correct tab picks it up
                    const targetKey = versionId ? versionId.toString() : (projectId === -2 ? '-2' : projectId === -3 ? '-3' : '');
                    setSelectedIssueState({ id: foundIssueId, sourceKey: targetKey });

                    console.log(`[App] Successfully opened issue #${foundIssueId} in project ${projectId}, version ${versionId}`);
                }
            } catch (error) {
                console.error('[App] Failed to open issue by ID:', error);
            }
        };

        (window as any).ipcRenderer?.on('open-issue-by-id', handler);
        return () => {
            (window as any).ipcRenderer?.off('open-issue-by-id', handler);
        };
    }, []);






    // Cache ref for selectedIssue to avoid unnecessary re-renders during background refresh
    const selectedIssueCacheRef = React.useRef<Issue | undefined>(undefined);

    // Deep comparison function for Issue objects
    const issueEquals = (a: Issue | undefined, b: Issue | undefined): boolean => {
        if (a === b) return true;
        if (!a || !b) return false;
        // Compare key fields that would affect rendering
        return a.id === b.id &&
            a.updated_on === b.updated_on &&
            a.subject === b.subject &&
            a.description === b.description &&
            a.status?.id === b.status?.id &&
            a.priority?.id === b.priority?.id &&
            a.assigned_to?.id === b.assigned_to?.id &&
            a.fixed_version?.id === b.fixed_version?.id &&
            a.journals?.length === b.journals?.length &&
            a.attachments?.length === b.attachments?.length &&
            a.watchers?.length === b.watchers?.length;
    };

    const selectedIssue = useMemo(() => {
        // First look in allIssues
        let newIssue = vm.allIssues.find((i: Issue) => i.id === selectedIssueId);

        // If not found in allIssues, try remote search results
        if (!newIssue && vm.searchMode === 'remote' && vm.remoteSearchResults.length > 0) {
            newIssue = vm.remoteSearchResults.find((i: Issue) => i.id === selectedIssueId);
        }

        // Only update cache if data actually changed
        if (!issueEquals(selectedIssueCacheRef.current, newIssue)) {
            selectedIssueCacheRef.current = newIssue;
        }
        return selectedIssueCacheRef.current;
    }, [vm.allIssues, vm.remoteSearchResults, vm.searchMode, selectedIssueId]);

    const processedDescription = useMemo(() => {
        if (!selectedIssue) return '';
        let text = selectedIssue.description || '';
        // 1. Convert Textile images !url! to Markdown ![](url)
        let processed = text.replace(/!([^!\s]+(?:\.[a-z0-9]+)+)!/gi, '![]($1)');

        // 2. Resolve filenames to absolute Redmine URLs with API key
        processed = processed.replace(/!\[(.*?)\]\((.*?)\)/g, (match, alt, url) => {
            let finalUrl = decodeURIComponent(url);
            if (!finalUrl.includes('/') && selectedIssue?.attachments) {
                const attachment = selectedIssue.attachments.find(a => a.filename === finalUrl);
                if (attachment) {
                    finalUrl = attachment.content_url;
                }
            }

            if (finalUrl.startsWith('http') && !finalUrl.includes('key=')) {
                const connector = finalUrl.includes('?') ? '&' : '?';
                finalUrl = `${finalUrl}${connector}key=${vm.redmineAPIKey}`;
            }
            // Re-encode spaces for the editor
            const encodedUrl = finalUrl.includes(' ') ? finalUrl.replace(/ /g, '%20') : finalUrl;
            return `![${alt}](${encodedUrl})`;
        });
        return processed;
    }, [selectedIssue?.description, selectedIssue?.attachments, vm.redmineAPIKey]);

    useEffect(() => {
        if (selectedIssueId) {
            vm.fetchIssueDetail(selectedIssueId);
        }
    }, [selectedIssueId]);

    // Save scroll position when scrolling in detail pane
    useEffect(() => {
        const el = detailPaneRef.current;
        if (!el || !selectedIssueId) return;

        const handleScroll = () => {
            detailScrollPositionRef.current.set(selectedIssueId, el.scrollTop);
        };

        el.addEventListener('scroll', handleScroll, { passive: true });
        return () => el.removeEventListener('scroll', handleScroll);
    }, [selectedIssueId]);

    // Restore scroll position when selectedIssue content stabilizes
    useEffect(() => {
        if (!selectedIssue || !detailPaneRef.current) return;

        const savedPosition = detailScrollPositionRef.current.get(selectedIssue.id);
        if (savedPosition !== undefined && savedPosition > 0) {
            // Use requestAnimationFrame to ensure DOM is ready
            requestAnimationFrame(() => {
                if (detailPaneRef.current) {
                    detailPaneRef.current.scrollTop = savedPosition;
                }
            });
        }
    }, [selectedIssue]);

    // Lightbox keyboard handlers
    useEffect(() => {
        if (!lightboxImage) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            const step = 50;
            if (e.key === 'Escape') {
                setLightboxImage(null);
                setLightboxOffset({ x: 0, y: 0 });
                setLightboxScale(1);
            } else if (e.key === '+' || e.key === '=' || e.key === '.') {
                setLightboxScale(s => Math.min(4, s + 0.25));
            } else if (e.key === '-' || e.key === ',') {
                setLightboxScale(s => Math.max(0.25, s - 0.25));
            } else if (e.key === '0') {
                setLightboxScale(1);
                setLightboxOffset({ x: 0, y: 0 });
            } else if (e.key === 'h' || e.key === 'ArrowLeft') {
                setLightboxOffset(o => ({ ...o, x: o.x - step }));
            } else if (e.key === 'l' || e.key === 'ArrowRight') {
                setLightboxOffset(o => ({ ...o, x: o.x + step }));
            } else if (e.key === 'k' || e.key === 'ArrowUp') {
                setLightboxOffset(o => ({ ...o, y: o.y - step }));
            } else if (e.key === 'j' || e.key === 'ArrowDown') {
                setLightboxOffset(o => ({ ...o, y: o.y + step }));
            }
        };

        window.addEventListener('keydown', handleKeyDown);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [lightboxImage]);

    // Pane resize handlers
    useEffect(() => {
        if (!resizingPane) return;

        const handleMouseMove = (e: MouseEvent) => {
            if (resizingPane === 'sidebar') {
                const newWidth = Math.max(120, Math.min(350, e.clientX));
                setSidebarWidth(newWidth);
            } else if (resizingPane === 'list') {
                // Calculate ratio from pixel position
                const newListWidth = e.clientX - sidebarWidth - 4;
                const currentRemainingWidth = window.innerWidth - sidebarWidth - 8;
                const newRatio = Math.max(0.2, Math.min(0.6, newListWidth / currentRemainingWidth));
                setListRatio(newRatio);
            }
        };

        const handleMouseUp = () => {
            if (resizingPane === 'sidebar') {
                localStorage.setItem('sidebarWidth', sidebarWidth.toString());
            } else if (resizingPane === 'list') {
                localStorage.setItem('listRatio', listRatio.toString());
            }
            setResizingPane(null);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [resizingPane, sidebarWidth, listRatio]);

    const [isEditing, setIsEditing] = useState(false);

    const renderMarkdownWithImages = (text: string | null | undefined) => {
        if (!text) return null;

        // Pre-process for Textile images (if any left)
        let processed = text;
        processed = processed.replace(/!([^!\s]+(?:\.[a-z0-9]+)+)!/gi, (match, url) => {
            if (!url.includes('/') && url.includes('.')) {
                return `![${url}](${encodeURIComponent(url)})`;
            }
            return match;
        });

        return (
            <div className="markdown-body" style={{ color: 'var(--text-primary)', fontSize: 14 }}>
                <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                        img: ({ node, src, alt, ...props }) => {
                            let finalSrc = src || '';
                            const decodedSrc = decodeURIComponent(finalSrc);

                            // Resolve filenames
                            if (!decodedSrc.includes('/') && selectedIssue?.attachments) {
                                const attachment = selectedIssue.attachments.find(a => a.filename === decodedSrc);
                                if (attachment) {
                                    finalSrc = attachment.content_url;
                                }
                            }

                            return (
                                <div
                                    style={{
                                        margin: '20px 0',
                                        border: `1px solid ${isLightTheme ? 'rgba(0,0,0,0.05)' : '#222'}`,
                                        borderRadius: 12,
                                        overflow: 'hidden',
                                        display: 'inline-block',
                                        maxWidth: '100%',
                                        cursor: 'zoom-in',
                                        boxShadow: isLightTheme ? '0 10px 30px rgba(0,0,0,0.1)' : '0 15px 45px rgba(0,0,0,0.5)',
                                        transition: 'transform 0.2s ease, box-shadow 0.2s ease'
                                    }}
                                    onClick={() => { setLightboxImage(finalSrc); setLightboxScale(1); }}
                                >
                                    <AuthenticatedImage
                                        src={finalSrc}
                                        alt={alt || ''}
                                        fetchBlob={(u) => vm.fetchImageBlob(u)}
                                        style={{ display: 'block', maxWidth: '100%', height: 'auto' }}
                                    />
                                </div>
                            );
                        },
                        a: ({ node, href, children, ...props }) => {
                            const url = href || '';
                            const decodedUrl = decodeURIComponent(url);

                            if (url.startsWith('attachment:') || (!decodedUrl.includes('/') && selectedIssue?.attachments?.some(a => a.filename === decodedUrl))) {
                                const filename = decodedUrl.replace('attachment:', '');
                                const attachment = selectedIssue?.attachments?.find(a => a.filename === filename);
                                if (attachment) {
                                    return (
                                        <div style={{ margin: '5px 0', padding: '8px 12px', background: '#111', borderRadius: 8, display: 'inline-flex', alignItems: 'center', gap: 10, border: '1px solid #222' }}>
                                            <span style={{ fontSize: 16 }}>📎</span>
                                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                <a href="#" onClick={(e) => { e.preventDefault(); downloadFile(attachment.content_url, filename); }} style={{ color: '#0c66ff', textDecoration: 'none', fontSize: 13, fontWeight: 500 }}>{filename}</a>
                                                <span style={{ fontSize: 10, color: '#444' }}>{(attachment.filesize / 1024).toFixed(1)} KB</span>
                                            </div>
                                        </div>
                                    );
                                }
                            }
                            return <a href={url} onClick={(e) => { e.preventDefault(); (window as any).ipcRenderer.send('open-external', url); }} style={{ color: '#0c66ff', textDecoration: 'none' }}>{children}</a>;
                        }
                    }}
                >
                    {processed}
                </ReactMarkdown>
                <style>{`
                    .markdown-body h1, .markdown-body h2, .markdown-body h3 { margin-top: 20px; marginBottom: 10px; color: #fff; }
                    .markdown-body p { margin-bottom: 15px; line-height: 1.6; }
                    .markdown-body ul, .markdown-body ol { margin-bottom: 15px; padding-left: 20px; }
                    .markdown-body li { margin-bottom: 5px; }
                    .markdown-body code { background: #111; padding: 2px 4px; borderRadius: 4px; font-family: monospace; }
                `}</style>
            </div>
        );
    };

    const SettingsModal = ({ forceShow }: { forceShow?: boolean }) => {
        return (
            <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                <div style={{ width: 500, background: 'var(--modal-bg)', padding: '30px', borderRadius: 20, boxShadow: '0 20px 40px rgba(0,0,0,0.5)', border: '1px solid var(--border-color)' }}>
                    <h2 style={{ marginBottom: 25, fontWeight: 500, color: 'var(--text-primary)' }}>Settings</h2>

                    {vm.errorMessage && (
                        <div style={{ padding: '10px 15px', background: 'rgba(255,69,58,0.1)', color: '#ff453a', borderRadius: 8, marginBottom: 20, fontSize: 13, border: '1px solid rgba(255,69,58,0.2)' }}>
                            {vm.errorMessage}
                        </div>
                    )}

                    <div style={{ marginBottom: 20 }}>
                        <h3 style={{ fontSize: 13, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: 15 }}>Redmine Connection</h3>
                        <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr', gap: '15px', alignItems: 'center', marginBottom: 10 }}>
                            <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>URL</span>
                            <input type="text" value={draftURL} onChange={e => setDraftURL(e.target.value)} placeholder="https://redmine.example.com" style={{ padding: '8px 12px', background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--text-primary)', borderRadius: 6 }} />
                            <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>API Key</span>
                            <input type="password" value={draftKey} onChange={e => setDraftKey(e.target.value)} placeholder="Enter API Key" style={{ padding: '8px 12px', background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--text-primary)', borderRadius: 6 }} />
                        </div>
                    </div>
                    <div style={{ marginBottom: 20 }}>
                        <h3 style={{ fontSize: 13, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: 15 }}>Preferences</h3>
                        <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr', gap: '15px', alignItems: 'center', marginBottom: 10 }}>
                            <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>Refresh</span>
                            <select value={vm.refreshInterval} onChange={e => vm.setRefreshInterval(parseInt(e.target.value))} style={{ padding: '8px', background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--text-primary)', borderRadius: 6 }}>
                                <option value="60">1 Minute</option>
                                <option value="300">5 Minutes</option>
                                <option value="600">10 Minutes</option>
                            </select>
                            <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>Transparency</span>
                            <input type="checkbox" checked={vm.enableTransparency} onChange={e => vm.setEnableTransparency(e.target.checked)} style={{ width: 20, height: 20 }} />
                            <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>Theme</span>
                            <select value={vm.appTheme} onChange={e => vm.setAppTheme(e.target.value)} style={{ padding: '8px', background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--text-primary)', borderRadius: 6 }}>
                                <option value="dark">Dark</option>
                                <option value="light">Light</option>
                            </select>
                            <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>Show Badge</span>
                            <input type="checkbox" checked={vm.showBadge} onChange={e => vm.setShowBadge(e.target.checked)} style={{ width: 20, height: 20 }} />
                        </div>
                    </div>
                    <div style={{ marginBottom: 20 }}>
                        <h3 style={{ fontSize: 13, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: 15 }}>Auto Update</h3>
                        <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '15px', alignItems: 'center', marginBottom: 10 }}>
                            <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>Auto Check for Updates</span>
                            <input
                                type="checkbox"
                                checked={autoUpdateEnabled}
                                onChange={async (e) => {
                                    const newValue = e.target.checked;
                                    setAutoUpdateEnabled(newValue);
                                    await window.updater?.setAutoUpdateSettings({ enabled: newValue });
                                }}
                                style={{ width: 20, height: 20 }}
                            />
                            <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>Check Frequency</span>
                            <select
                                value={autoUpdateInterval}
                                onChange={async (e) => {
                                    const newValue = parseFloat(e.target.value);
                                    setAutoUpdateInterval(newValue);
                                    await window.updater?.setAutoUpdateSettings({ interval: newValue });
                                }}
                                style={{ padding: '8px', background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--text-primary)', borderRadius: 6 }}
                            >
                                <option value="0.0167">1 Minute (Test)</option>
                                <option value="1">Every Hour</option>
                                <option value="6">Every 6 Hours</option>
                                <option value="12">Every 12 Hours</option>
                                <option value="24">Daily</option>
                                <option value="168">Weekly</option>
                            </select>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 15 }}>
                            <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>Check Manually</span>
                            <button
                                onClick={() => { setShowSettings(false); setShowUpdaterModal(true); }}
                                style={{ padding: '8px 16px', background: 'var(--button-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: 6, cursor: 'pointer', fontSize: 13 }}
                            >
                                🚀 Check for Updates
                            </button>
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: 10, marginTop: 30 }}>
                        <button
                            disabled={vm.isLoading}
                            onClick={async () => {
                                await vm.saveSettings(draftURL, draftKey);
                                if (!forceShow) setShowSettings(false);
                            }}
                            style={{ flex: 1, padding: '12px', background: '#0c66ff', color: 'white', border: 'none', borderRadius: 8, fontWeight: 500, cursor: vm.isLoading ? 'not-allowed' : 'pointer', opacity: vm.isLoading ? 0.7 : 1 }}
                        >
                            {vm.isLoading ? 'Connecting...' : 'Save & Connect'}
                        </button>
                        {!forceShow && (
                            <button onClick={() => setShowSettings(false)} style={{ padding: '12px 25px', background: 'var(--button-secondary)', color: 'var(--text-primary)', border: 'none', borderRadius: 8, cursor: 'pointer' }}>Cancel</button>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    if (!vm.isConfigured) {
        return (
            <div className="light-theme" style={{ background: '#f5f5f7', height: '100vh', width: '100vw' }}>
                <SettingsModal forceShow />
                <UpdaterModal isOpen={showUpdaterModal} onClose={() => setShowUpdaterModal(false)} isDark={false} />
            </div>
        );
    }

    const isLightTheme = vm.appTheme === 'light';

    return (
        <div className={`app-container ${isLightTheme ? 'light-theme' : ''} ${vm.enableTransparency && !isLightTheme ? 'transparency-enabled' : ''}`} style={{ background: vm.enableTransparency && !isLightTheme ? 'rgba(0,0,0,0.02)' : 'var(--bg-color)' }}>
            {/* Title bar drag region for window dragging */}
            <div className="title-bar-drag-region" />

            {showSettings && <SettingsModal />}
            <UpdaterModal isOpen={showUpdaterModal} onClose={() => setShowUpdaterModal(false)} isDark={!isLightTheme} />

            {/* New Version Dialog */}
            {newVersionProjectId !== null && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
                    <div style={{ background: '#1a1a1a', padding: 20, borderRadius: 12, width: 300 }}>
                        <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 15 }}>New Version</div>
                        <input
                            type="text"
                            placeholder="Version name (e.g. 0.7.0)"
                            value={newVersionName}
                            onChange={e => setNewVersionName(e.target.value)}
                            autoFocus
                            onKeyDown={async e => {
                                if (e.key === 'Enter' && newVersionName.trim()) {
                                    await vm.createVersion(newVersionProjectId, newVersionName.trim());
                                    setNewVersionProjectId(null);
                                    setNewVersionName('');
                                } else if (e.key === 'Escape') {
                                    setNewVersionProjectId(null);
                                }
                            }}
                            style={{ width: '100%', padding: 10, background: 'var(--input-bg)', border: '1px solid var(--input-border)', borderRadius: 6, color: 'var(--text-primary)', marginBottom: 15 }}
                        />
                        <div style={{ display: 'flex', gap: 10 }}>
                            <button
                                onClick={async () => {
                                    if (newVersionName.trim()) {
                                        await vm.createVersion(newVersionProjectId, newVersionName.trim());
                                        setNewVersionProjectId(null);
                                        setNewVersionName('');
                                    }
                                }}
                                style={{ flex: 1, padding: 10, background: '#0c66ff', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer' }}
                            >Create</button>
                            <button
                                onClick={() => setNewVersionProjectId(null)}
                                style={{ padding: '10px 20px', background: '#333', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer' }}
                            >Cancel</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Version Confirmation */}
            {deleteVersionConfirm && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
                    <div style={{ background: '#1a1a1a', padding: 20, borderRadius: 12, width: 300 }}>
                        <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 15 }}>Delete Version</div>
                        <div style={{ fontSize: 12, color: '#888', marginBottom: 15 }}>Are you sure you want to delete version "{deleteVersionConfirm.name}"? This action cannot be undone.</div>
                        <div style={{ display: 'flex', gap: 10 }}>
                            <button
                                onClick={async () => {
                                    await vm.deleteVersion(deleteVersionConfirm.projectId, deleteVersionConfirm.versionId);
                                    setDeleteVersionConfirm(null);
                                }}
                                style={{ flex: 1, padding: 10, background: '#ff453a', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer' }}
                            >Delete</button>
                            <button
                                onClick={() => setDeleteVersionConfirm(null)}
                                style={{ padding: '10px 20px', background: '#333', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer' }}
                            >Cancel</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Issue Confirmation */}
            {deleteIssueConfirm && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
                    <div style={{ background: '#1a1a1a', padding: 20, borderRadius: 12, width: 300 }}>
                        <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 15 }}>Delete Issue</div>
                        <div style={{ fontSize: 12, color: '#888', marginBottom: 15 }}>Are you sure you want to delete issue #{deleteIssueConfirm}? This action cannot be undone.</div>
                        <div style={{ display: 'flex', gap: 10 }}>
                            <button
                                onClick={async () => {
                                    await vm.deleteIssue(deleteIssueConfirm);
                                    setDeleteIssueConfirm(null);
                                    if (selectedIssueId === deleteIssueConfirm) {
                                        setSelectedIssueState({ id: null, sourceKey: '' });
                                    }
                                }}
                                style={{ flex: 1, padding: 10, background: '#ff453a', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer' }}
                            >Delete</button>
                            <button
                                onClick={() => setDeleteIssueConfirm(null)}
                                style={{ padding: '10px 20px', background: '#333', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer' }}
                            >Cancel</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Sidebar */}
            <aside className="sidebar" style={{ width: sidebarWidth, minWidth: sidebarWidth, maxWidth: sidebarWidth }}>
                <div className="sidebar-content" ref={sidebarRef} style={{ scrollbarWidth: 'none' }}>
                    {/* Sliding Sidebar Selection Indicator */}
                    <div className="sidebar-selection-indicator" style={sidebarIndicatorStyle} />

                    <div
                        className={`sidebar-item ${vm.selectedProjectId === -1 ? 'selected' : ''}`}
                        style={{ marginTop: 20, display: 'flex', alignItems: 'center', gap: 10 }}
                        onClick={(e) => { handleSidebarItemClick(e); vm.selectProject(-1); }}
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                            <rect x="3" y="3" width="7" height="7"></rect>
                            <rect x="14" y="3" width="7" height="7"></rect>
                            <rect x="14" y="14" width="7" height="7"></rect>
                            <rect x="3" y="14" width="7" height="7"></rect>
                        </svg>
                        <span>All Projects</span>
                    </div>

                    <div
                        className={`sidebar-item ${vm.selectedProjectId === -2 ? 'selected' : ''}`}
                        style={{ marginTop: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                        onClick={(e) => { handleSidebarItemClick(e); vm.selectProject(-2); }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                                <circle cx="12" cy="12" r="3"></circle>
                            </svg>
                            <span>My Followed</span>
                        </div>
                        <span style={{ fontSize: 10, display: 'flex', gap: 4, alignItems: 'center' }}>
                            {vm.followedStatusCounts.dev > 0 && <span style={{ color: '#ff453a' }}>{vm.followedStatusCounts.dev}</span>}
                            {vm.followedStatusCounts.done > 0 && <span style={{ color: '#30d158' }}>{vm.followedStatusCounts.done}</span>}
                            {!vm.hideVerifiedInFollowed && vm.followedStatusCounts.verified > 0 && <span style={{ color: '#666' }}>{vm.followedStatusCounts.verified}</span>}
                        </span>
                    </div>

                    <div
                        className={`sidebar-item ${vm.selectedProjectId === -3 ? 'selected' : ''}`}
                        style={{ marginTop: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                        onClick={(e) => { handleSidebarItemClick(e); vm.selectProject(-3); }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                                <circle cx="12" cy="7" r="4"></circle>
                            </svg>
                            <span>My Assigned</span>
                        </div>
                        <span style={{ fontSize: 10, display: 'flex', gap: 4, alignItems: 'center' }}>
                            {vm.assignedStatusCounts.dev > 0 && <span style={{ color: '#ff453a' }}>{vm.assignedStatusCounts.dev}</span>}
                            {vm.assignedStatusCounts.done > 0 && <span style={{ color: '#30d158' }}>{vm.assignedStatusCounts.done}</span>}
                            {!vm.hideVerifiedInAssigned && vm.assignedStatusCounts.verified > 0 && <span style={{ color: '#666' }}>{vm.assignedStatusCounts.verified}</span>}
                        </span>
                    </div>

                    {vm.projects.map(p => {
                        const versions = vm.projectVersionsMap[p.id] || [];
                        // Use activeVersionIds to determine which versions are active vs in Others
                        const activeVersions = versions.filter(v => vm.activeVersionIds.has(v.id));
                        const emptyVersions = versions.filter(v => !vm.activeVersionIds.has(v.id));

                        return (
                            <div key={p.id}>
                                <div
                                    className={`sidebar-item ${vm.selectedProjectId === p.id && !vm.selectedVersionId ? 'selected' : ''}`}
                                    style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                                    onClick={(e) => {
                                        handleSidebarItemClick(e);
                                        vm.selectProject(p.id);
                                    }}
                                >
                                    <span
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setExpandedProjects(prev => ({ ...prev, [p.id]: !prev[p.id] }));
                                        }}
                                        style={{ cursor: 'pointer', paddingRight: 5, width: 15, display: 'inline-block', textAlign: 'center' }}
                                    >
                                        {expandedProjects[p.id] ? '⌄' : '›'}
                                    </span>
                                    <span style={{ flex: 1 }}>
                                        {p.name}
                                    </span>
                                    <span
                                        onClick={(e) => { e.stopPropagation(); setNewVersionProjectId(p.id); setNewVersionName(''); }}
                                        style={{ color: '#666', fontSize: 14, padding: '0 5px', cursor: 'pointer' }}
                                        title="Add Version"
                                    >+</span>
                                </div>
                                {expandedProjects[p.id] && (
                                    <div style={{ borderLeft: '1px solid #222', marginLeft: 15 }}>
                                        {versions.length === 0 && <div style={{ fontSize: 11, color: '#444', padding: '5px 20px' }}>No versions</div>}
                                        {activeVersions.map(v => {
                                            const sc = vm.versionStatusCounts[v.id] || { dev: 0, done: 0, verified: 0 };
                                            const totalCount = sc.dev + sc.done + sc.verified;
                                            const isPinned = vm.pinnedVersionIds.has(v.id);
                                            return (
                                                <div
                                                    key={v.id}
                                                    className={`sidebar-item ${vm.selectedVersionId === v.id ? 'selected' : ''}`}
                                                    onClick={(e) => { handleSidebarItemClick(e); vm.selectVersion(p.id, v.id); }}
                                                    style={{ fontSize: 12, paddingLeft: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                                                >
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, flex: 1, minWidth: 0 }}>
                                                        <span
                                                            onClick={(e) => { e.stopPropagation(); vm.togglePinVersion(p.id, v.id); }}
                                                            style={{
                                                                cursor: 'pointer',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                                width: 20,
                                                                height: 20,
                                                                color: isPinned ? '#30d158' : 'var(--text-secondary)',
                                                                opacity: isPinned ? 1 : 0.4,
                                                                transform: isPinned ? 'none' : 'rotate(45deg)',
                                                                transition: 'all 0.2s',
                                                                padding: '0 4px'
                                                            }}
                                                            title={isPinned ? "Unpin" : "Pin Version"}
                                                        >
                                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                                                                <path d="M16 9V4l1 0V2H7v2l1 0v5c0 1.66-1.34 3-3 3v2h5.97v7l1 1 1-1v-7H19v-2c-1.66 0-3-1.34-3-3z" />
                                                            </svg>
                                                        </span>
                                                        {editingVersionId === v.id ? (
                                                            <input
                                                                value={editVersionName}
                                                                autoFocus
                                                                onChange={e => setEditVersionName(e.target.value)}
                                                                onBlur={async () => {
                                                                    if (editVersionName.trim() && editVersionName !== v.name) {
                                                                        await vm.updateVersion(p.id, v.id, { name: editVersionName.trim() });
                                                                    }
                                                                    setEditingVersionId(null);
                                                                }}
                                                                onKeyDown={async e => {
                                                                    if (e.key === 'Enter') {
                                                                        if (editVersionName.trim() && editVersionName !== v.name) {
                                                                            await vm.updateVersion(p.id, v.id, { name: editVersionName.trim() });
                                                                        }
                                                                        setEditingVersionId(null);
                                                                    } else if (e.key === 'Escape') {
                                                                        setEditingVersionId(null);
                                                                    }
                                                                }}
                                                                style={{ background: '#333', border: '1px solid #0c66ff', color: 'white', fontSize: 11, padding: '2px 5px', borderRadius: 4, width: '100%', outline: 'none' }}
                                                            />
                                                        ) : (
                                                            <span onDoubleClick={() => { setEditingVersionId(v.id); setEditVersionName(v.name); }} style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{v.name}</span>
                                                        )}
                                                    </div>
                                                    <span style={{ fontSize: 10, display: 'flex', gap: 4, alignItems: 'center' }}>
                                                        {sc.dev > 0 && <span style={{ color: '#ff453a' }}>{sc.dev}</span>}
                                                        {sc.done > 0 && <span style={{ color: '#30d158' }}>{sc.done}</span>}
                                                        {sc.verified > 0 && <span style={{ color: '#666' }}>{sc.verified}</span>}
                                                        {/* Move to Others button */}
                                                        <span
                                                            onClick={(e) => { e.stopPropagation(); vm.toggleVersionActive(v.id); }}
                                                            style={{ color: 'var(--text-secondary)', fontSize: 11, padding: '0 3px', cursor: 'pointer', opacity: 0.6 }}
                                                            title="Move to Others"
                                                        >↓</span>
                                                        {totalCount === 0 && (
                                                            <span
                                                                onClick={(e) => { e.stopPropagation(); setDeleteVersionConfirm({ projectId: p.id, versionId: v.id, name: v.name }); }}
                                                                style={{ color: '#ff453a', fontSize: 12, padding: '0 3px', cursor: 'pointer' }}
                                                                title="Delete Version"
                                                            >×</span>
                                                        )}
                                                    </span>
                                                </div>
                                            );
                                        })}
                                        {emptyVersions.length > 0 && (
                                            <div style={{ marginTop: 5 }}>
                                                <div
                                                    style={{ fontSize: 10, color: '#333', padding: '5px 20px', textTransform: 'uppercase', letterSpacing: 1, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}
                                                    onClick={() => setExpandedOthers(prev => ({ ...prev, [p.id]: !prev[p.id] }))}
                                                >
                                                    <span style={{ fontSize: 8 }}>{expandedOthers[p.id] ? '▼' : '►'}</span>
                                                    Others ({emptyVersions.length})
                                                </div>
                                                {expandedOthers[p.id] && emptyVersions.map(v => {
                                                    const isPinned = vm.pinnedVersionIds.has(v.id);
                                                    return (
                                                        <div
                                                            key={v.id}
                                                            className={`sidebar-item ${vm.selectedVersionId === v.id ? 'selected' : ''}`}
                                                            style={{ fontSize: 11, paddingLeft: 10, color: '#444', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                                                        >
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: 5, flex: 1, minWidth: 0 }}>
                                                                <span
                                                                    onClick={(e) => { e.stopPropagation(); vm.togglePinVersion(p.id, v.id); }}
                                                                    style={{
                                                                        cursor: 'pointer',
                                                                        display: 'flex',
                                                                        alignItems: 'center',
                                                                        justifyContent: 'center',
                                                                        width: 20,
                                                                        height: 20,
                                                                        color: isPinned ? '#30d158' : 'var(--text-secondary)',
                                                                        opacity: isPinned ? 1 : 0.4,
                                                                        transform: isPinned ? 'none' : 'rotate(45deg)',
                                                                        transition: 'all 0.2s',
                                                                        padding: '0 4px'
                                                                    }}
                                                                    title={isPinned ? "Unpin" : "Pin Version"}
                                                                >
                                                                    <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                                                                        <path d="M16 9V4l1 0V2H7v2l1 0v5c0 1.66-1.34 3-3 3v2h5.97v7l1 1 1-1v-7H19v-2c-1.66 0-3-1.34-3-3z" />
                                                                    </svg>
                                                                </span>
                                                                {editingVersionId === v.id ? (
                                                                    <input
                                                                        value={editVersionName}
                                                                        autoFocus
                                                                        onChange={e => setEditVersionName(e.target.value)}
                                                                        onBlur={async () => {
                                                                            if (editVersionName.trim() && editVersionName !== v.name) {
                                                                                await vm.updateVersion(p.id, v.id, { name: editVersionName.trim() });
                                                                            }
                                                                            setEditingVersionId(null);
                                                                        }}
                                                                        onKeyDown={async e => {
                                                                            if (e.key === 'Enter') {
                                                                                if (editVersionName.trim() && editVersionName !== v.name) {
                                                                                    await vm.updateVersion(p.id, v.id, { name: editVersionName.trim() });
                                                                                }
                                                                                setEditingVersionId(null);
                                                                            } else if (e.key === 'Escape') {
                                                                                setEditingVersionId(null);
                                                                            }
                                                                        }}
                                                                        style={{ background: 'var(--input-bg)', border: '1px solid var(--accent-color)', color: 'var(--text-primary)', fontSize: 11, padding: '2px 5px', borderRadius: 4, width: '100%', outline: 'none' }}
                                                                    />
                                                                ) : (
                                                                    <span
                                                                        onDoubleClick={() => { setEditingVersionId(v.id); setEditVersionName(v.name); }}
                                                                        onClick={() => { vm.selectVersion(p.id, v.id); vm.fetchVersionIssues(v.id); }}
                                                                        style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                                                                    >
                                                                        {v.name}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <span style={{ fontSize: 10, display: 'flex', gap: 4, alignItems: 'center' }}>
                                                                {/* Move out of Others button */}
                                                                <span
                                                                    onClick={(e) => { e.stopPropagation(); vm.toggleVersionActive(v.id); }}
                                                                    style={{ color: '#30d158', fontSize: 11, padding: '0 3px', cursor: 'pointer' }}
                                                                    title="Move out of Others (Activate)"
                                                                >↑</span>
                                                                {(vm.versionIssueCounts[v.id] || 0) === 0 && (
                                                                    <span
                                                                        onClick={(e) => { e.stopPropagation(); setDeleteVersionConfirm({ projectId: p.id, versionId: v.id, name: v.name }); }}
                                                                        style={{ color: '#ff453a', fontSize: 12, padding: '0 5px', cursor: 'pointer' }}
                                                                        title="Delete Version"
                                                                    >×</span>
                                                                )}
                                                            </span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* Sidebar Footer with Settings */}
                <div className="pane-footer" style={{ borderTop: '1px solid var(--border-color)' }}>
                    <div
                        className="sidebar-item"
                        onClick={() => setShowSettings(true)}
                        style={{ margin: 0, padding: 0, flex: 1, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--input-bg)', borderRadius: 8, fontSize: 13 }}
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 6 }}><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
                        Settings
                    </div>
                </div>
            </aside>

            <div
                className="no-drag"
                onMouseDown={() => setResizingPane('sidebar')}
                style={{ width: 4, cursor: 'col-resize', background: resizingPane === 'sidebar' ? '#0c66ff' : 'transparent', flexShrink: 0, margin: '0 -2px', zIndex: 100, transition: 'background 0.2s' }}
                onMouseEnter={e => (e.target as HTMLDivElement).style.background = '#0c66ff'}
                onMouseLeave={e => (e.target as HTMLDivElement).style.background = resizingPane === 'sidebar' ? '#0c66ff' : 'transparent'}
            />

            {/* List */}
            <section className="issue-list-pane" style={{ width: listWidth, minWidth: 300, maxWidth: 800, flexShrink: 0 }}>
                <div style={{ padding: '40px 15px 10px', display: 'flex', gap: 10, alignItems: 'center' }}>
                    <div style={{ flex: 1, position: 'relative' }}>
                        <span style={{ position: 'absolute', left: 10, top: '48%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center', color: vm.searchMode === 'remote' ? 'var(--accent-color)' : 'var(--text-secondary)' }}>
                            {vm.isSearching ? (
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: 'spin 1s linear infinite' }}>
                                    <circle cx="12" cy="12" r="10" strokeDasharray="32" strokeDashoffset="12"></circle>
                                </svg>
                            ) : vm.searchMode === 'remote' ? (
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"></path>
                                </svg>
                            ) : (
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                            )}
                        </span>
                        <input
                            type="text"
                            placeholder={vm.searchMode === 'remote' ? "Remote search..." : "Local search"}
                            value={vm.searchQuery}
                            onChange={e => vm.setSearchQuery(e.target.value)}
                            onKeyDown={e => {
                                // ESC clears search and returns to local mode
                                if (e.key === 'Escape') {
                                    vm.setSearchQuery('');
                                    vm.setSearchMode('local');
                                    (e.target as HTMLInputElement).blur();
                                }
                            }}
                            style={{
                                width: '100%',
                                padding: (vm.searchQuery || vm.searchMode === 'remote') ? '10px 115px 10px 35px' : '10px 80px 10px 35px',
                                background: 'var(--input-bg)',
                                border: vm.searchMode === 'remote' ? '1px solid var(--accent-color)' : '1px solid var(--input-border)',
                                borderRadius: 8,
                                color: 'var(--text-primary)'
                            }}
                        />
                        {/* Search mode toggle button */}
                        <div style={{
                            position: 'absolute',
                            right: 8,
                            top: '50%',
                            transform: 'translateY(-50%)',
                            display: 'flex',
                            gap: 2,
                            background: 'var(--bg-secondary)',
                            borderRadius: 6,
                            padding: 2
                        }}>
                            <button
                                onClick={() => vm.setSearchMode('local')}
                                title="Local search (search within loaded tasks)"
                                style={{
                                    padding: '4px 8px',
                                    fontSize: 10,
                                    background: vm.searchMode === 'local' ? 'var(--accent-color)' : 'transparent',
                                    color: vm.searchMode === 'local' ? 'white' : 'var(--text-secondary)',
                                    border: 'none',
                                    borderRadius: 4,
                                    cursor: 'pointer',
                                    fontWeight: 500,
                                    transition: 'all 0.2s'
                                }}
                            >Local</button>
                            <button
                                onClick={() => vm.setSearchMode('remote')}
                                title="Remote search (search via API on server)"
                                style={{
                                    padding: '4px 8px',
                                    fontSize: 10,
                                    background: vm.searchMode === 'remote' ? 'var(--accent-color)' : 'transparent',
                                    color: vm.searchMode === 'remote' ? 'white' : 'var(--text-secondary)',
                                    border: 'none',
                                    borderRadius: 4,
                                    cursor: 'pointer',
                                    fontWeight: 500,
                                    transition: 'all 0.2s'
                                }}
                            >Remote</button>
                        </div>
                        {/* Clear search button - shown when search content exists or in remote mode */}
                        {(vm.searchQuery || vm.searchMode === 'remote') && (
                            <button
                                onClick={() => {
                                    vm.setSearchQuery('');
                                    vm.setSearchMode('local');
                                }}
                                title="Clear search, return to version view"
                                style={{
                                    position: 'absolute',
                                    right: 88,
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    background: 'rgba(255,69,58,0.1)',
                                    border: 'none',
                                    borderRadius: 4,
                                    width: 20,
                                    height: 20,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: 'pointer',
                                    color: '#ff453a',
                                    fontSize: 12,
                                    fontWeight: 'bold',
                                    transition: 'all 0.2s'
                                }}
                                onMouseEnter={e => {
                                    e.currentTarget.style.background = 'rgba(255,69,58,0.2)';
                                }}
                                onMouseLeave={e => {
                                    e.currentTarget.style.background = 'rgba(255,69,58,0.1)';
                                }}
                            >×</button>
                        )}
                    </div>
                </div>
                <div style={{ padding: '0 15px 10px', display: 'flex', flexDirection: 'column', gap: 5 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, fontSize: 11, color: '#444' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span>
                                {vm.searchMode === 'remote' ? (
                                    vm.isSearching
                                        ? '🔍 Searching remotely...'
                                        : vm.searchQuery.trim()
                                            ? `☁️ Remote results: ${vm.remoteSearchResults.length} / ${vm.remoteSearchTotalCount}`
                                            : '☁️ Remote search mode (enter keywords to search)'
                                ) : (
                                    vm.isLoading
                                        ? '⏳ Loading...'
                                        : `✅ API loaded: ${vm.allIssues.length} | Showing: ${vm.groupedIssues.sortedKeys.reduce((acc, k) => acc + vm.groupedIssues.groups[k].length, 0)}${vm.isBackgroundRefreshing ? ' | 🔄 Background refreshing...' : ''}`
                                )}
                            </span>
                            <button
                                onClick={async () => {
                                    if (!isRefreshing && !vm.isLoading) {
                                        setIsRefreshing(true);
                                        await vm.refreshData();
                                        setIsRefreshing(false);
                                    }
                                }}
                                disabled={isRefreshing || vm.isLoading}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    cursor: isRefreshing || vm.isLoading ? 'not-allowed' : 'pointer',
                                    color: 'var(--accent-color)',
                                    fontSize: 14,
                                    padding: '2px 6px',
                                    borderRadius: 4,
                                    opacity: isRefreshing || vm.isLoading ? 0.5 : 1,
                                    transition: 'opacity 0.2s'
                                }}
                                title="Refresh"
                            >
                                <span style={{
                                    display: 'inline-block',
                                    animation: isRefreshing ? 'spin 1s linear infinite' : 'none'
                                }}>↻</span>
                            </button>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                            {/* Group by toggle */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                Group by:
                                <select
                                    value={vm.groupByMode}
                                    onChange={e => {
                                        const newMode = e.target.value as 'status' | 'assignee';
                                        vm.setGroupByMode(newMode);
                                        // Reset the filter that corresponds to the new grouping
                                        if (newMode === 'status') {
                                            vm.setSelectedStatusId(null);
                                        } else {
                                            vm.setSelectedAssigneeId(null);
                                        }
                                    }}
                                    style={{ background: 'var(--input-bg)', border: 'none', color: 'var(--text-secondary)', borderRadius: 4, padding: '1px 5px', fontSize: 11 }}
                                >
                                    <option value="status">By Status</option>
                                    <option value="assignee">By Assignee</option>
                                </select>
                            </div>
                            {vm.selectedProjectId !== -2 && vm.selectedProjectId !== -3 && (
                                <>
                                    {/* Show assignee filter when grouping by status, status filter when grouping by assignee */}
                                    {vm.groupByMode === 'status' ? (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                            Assigned to:
                                            <select
                                                value={vm.selectedAssigneeId || ''}
                                                onChange={e => vm.setSelectedAssigneeId(e.target.value ? parseInt(e.target.value) : null)}
                                                style={{ background: 'var(--input-bg)', border: 'none', color: 'var(--text-secondary)', borderRadius: 4, padding: '1px 5px', fontSize: 11 }}
                                            >
                                                <option value="">All</option>
                                                {vm.currentUser && <option value={vm.currentUser.id}>Me ({vm.currentUser.firstname})</option>}
                                                {renderGroupedMemberOptions(currentProjectMembers, vm.currentUser ? [vm.currentUser.id] : undefined)}
                                            </select>
                                        </div>
                                    ) : (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                            Status:
                                            <select
                                                value={vm.selectedStatusId || ''}
                                                onChange={e => vm.setSelectedStatusId(e.target.value ? parseInt(e.target.value) : null)}
                                                style={{ background: 'var(--input-bg)', border: 'none', color: 'var(--text-secondary)', borderRadius: 4, padding: '1px 5px', fontSize: 11 }}
                                            >
                                                <option value="">All</option>
                                                {vm.issueStatuses.map(s => (
                                                    <option key={s.id} value={s.id}>{s.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                    )}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, position: 'relative' }}>
                                        Assigned Watcher:
                                        <div className="assigned-watcher-filter-trigger" style={{ background: 'var(--input-bg)', borderRadius: 4, padding: '1px 8px', fontSize: 11, cursor: 'pointer', color: 'var(--text-secondary)', border: vm.selectedAssignedWatcherIds.size > 0 ? '1px solid var(--accent-color)' : 'none' }} onClick={() => (window as any).toggleAssignedWatcherFilter?.()}>
                                            {vm.selectedAssignedWatcherIds.size > 0 ? `${vm.selectedAssignedWatcherIds.size} selected` : 'All'}
                                            <span style={{ marginLeft: 3 }}>⌄</span>
                                        </div>
                                        <div id="assigned-watcher-filter-dropdown" style={{
                                            display: 'none',
                                            position: 'absolute',
                                            top: 22,
                                            right: 0,
                                            background: 'var(--modal-bg)',
                                            border: '1px solid var(--border-color)',
                                            borderRadius: 8,
                                            padding: '6px 0',
                                            zIndex: 100,
                                            boxShadow: '0 8px 20px rgba(0,0,0,0.25)',
                                            width: 160,
                                            maxHeight: 240,
                                            overflowY: 'auto'
                                        }}>
                                            {(() => {
                                                const { grouped, noGroup, sortedGroups } = groupMembersByRole(currentProjectMembers);
                                                const hasGroups = sortedGroups.length > 0;

                                                const renderMemberCheckbox = (m: { id: number; name: string }) => (
                                                    <label
                                                        key={m.id}
                                                        className="dropdown-item"
                                                        style={{
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: 10,
                                                            padding: '6px 12px',
                                                            cursor: 'pointer',
                                                            fontSize: 12,
                                                            color: 'var(--text-primary)',
                                                            transition: 'background 0.1s'
                                                        }}
                                                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(128,128,128,0.1)'}
                                                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                                    >
                                                        <input
                                                            type="checkbox"
                                                            checked={vm.selectedAssignedWatcherIds.has(m.id)}
                                                            style={{ cursor: 'pointer', accentColor: 'var(--accent-color)' }}
                                                            onChange={() => {
                                                                const next = new Set(vm.selectedAssignedWatcherIds);
                                                                if (next.has(m.id)) next.delete(m.id);
                                                                else next.add(m.id);
                                                                vm.setSelectedAssignedWatcherIds(next);
                                                            }}
                                                        />
                                                        <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.name}</span>
                                                    </label>
                                                );

                                                if (!hasGroups) {
                                                    return currentProjectMembers.map(m => renderMemberCheckbox(m));
                                                }

                                                return (
                                                    <>
                                                        {sortedGroups.map(groupName => (
                                                            <React.Fragment key={groupName}>
                                                                <div style={{ padding: '6px 12px 4px', fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5, background: 'rgba(128,128,128,0.05)' }}>
                                                                    {groupName}
                                                                </div>
                                                                {grouped[groupName].map(m => renderMemberCheckbox(m))}
                                                            </React.Fragment>
                                                        ))}
                                                        {noGroup.length > 0 && (
                                                            <React.Fragment>
                                                                <div style={{ padding: '6px 12px 4px', fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5, background: 'rgba(128,128,128,0.05)' }}>
                                                                    Other
                                                                </div>
                                                                {noGroup.map(m => renderMemberCheckbox(m))}
                                                            </React.Fragment>
                                                        )}
                                                    </>
                                                );
                                            })()}
                                        </div>
                                    </div>
                                </>
                            )}
                            {vm.selectedProjectId === -2 && (
                                <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 11 }}>
                                    <input
                                        type="checkbox"
                                        checked={vm.hideVerifiedInFollowed}
                                        onChange={e => vm.setHideVerifiedInFollowed(e.target.checked)}
                                        style={{ cursor: 'pointer', accentColor: 'var(--accent-color)' }}
                                    />
                                    Hide Verified
                                </label>
                            )}
                            {vm.selectedProjectId === -3 && (
                                <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 11 }}>
                                    <input
                                        type="checkbox"
                                        checked={vm.hideVerifiedInAssigned}
                                        onChange={e => vm.setHideVerifiedInAssigned(e.target.checked)}
                                        style={{ cursor: 'pointer', accentColor: 'var(--accent-color)' }}
                                    />
                                    Hide Verified
                                </label>
                            )}
                        </div>
                    </div>
                    {vm.errorMessage && (
                        <div style={{ fontSize: 10, color: '#ff453a', background: 'rgba(255,69,58,0.1)', padding: '4px 8px', borderRadius: 4 }}>
                            🚫 {vm.errorMessage}
                        </div>
                    )}
                </div>

                <div
                    style={{ flex: 1, position: 'relative', overflow: 'hidden' }}
                >
                    <div className="issue-list-content" style={{ width: '100%', height: '100%', overflowY: vm.searchMode === 'remote' ? 'auto' : 'hidden' }}>
                        {/* Show different lists based on search mode */}
                        {vm.searchMode === 'remote' ? (
                            <RemoteSearchResults
                                results={vm.remoteSearchResults}
                                isSearching={vm.isSearching}
                                searchQuery={vm.searchQuery}
                                totalCount={vm.remoteSearchTotalCount}
                                selectedIssueId={selectedIssueId}
                                onSelectIssue={handleSelectIssue}
                                vm={vm}
                                handleUpdateStatus={handleUpdateStatus}
                                handleUpdatePriority={handleUpdatePriority}
                                handleUpdateVersion={handleUpdateVersion}
                                handleUpdateAssignee={handleUpdateAssignee}
                                stableStatusList={stableStatusList}
                                stablePriorityList={stablePriorityList}
                                stableVersionListCache={stableVersionListCache}
                                stableGroupedMemberCache={stableGroupedMemberCache}
                            />
                        ) : (
                            <TabbedIssueList
                                currentKey={currentTabKey}
                                getVersionViewData={vm.getVersionViewData}
                                vm={vm}
                                selectedIssueState={selectedIssueState}
                                handleSelectIssue={handleSelectIssue}
                                handleUpdateStatus={handleUpdateStatus}
                                handleUpdatePriority={handleUpdatePriority}
                                handleUpdateVersion={handleUpdateVersion}
                                handleUpdateAssignee={handleUpdateAssignee}
                                stableStatusList={stableStatusList}
                                stablePriorityList={stablePriorityList}
                                stableVersionListCache={stableVersionListCache}
                                stableGroupedMemberCache={stableGroupedMemberCache}
                            />
                        )}
                    </div>
                </div>

                <div className="add-task-bar pane-footer">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--input-bg)', borderRadius: 8, padding: '0 12px', flex: 1, height: 36 }}>
                        <span style={{ color: '#0c66ff', fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center' }}>+</span>
                        <input type="text" placeholder="Quick add task..." value={newTaskSubject} onChange={e => setNewTaskSubject(e.target.value)} onKeyDown={e => {
                            if (e.key === 'Enter' && newTaskSubject.trim() && vm.selectedProjectId !== -1) {
                                vm.createIssue(newTaskSubject, vm.selectedProjectId!, quickAddVersionId || undefined, quickAddAssigneeId || undefined);
                                setNewTaskSubject('');
                            }
                        }} style={{ flex: 1, background: 'transparent', border: 'none', color: 'var(--text-primary)', padding: '4px 0', fontSize: 13, outline: 'none' }} />
                        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                            {vm.selectedProjectId !== -1 && vm.selectedProjectId !== null && (
                                <span style={{ fontSize: 11, color: '#888', position: 'relative' }}>
                                    {(vm.projectVersionsMap[vm.selectedProjectId] || []).find((v: { id: number }) => v.id === quickAddVersionId)?.name || 'No version'}
                                    <select
                                        value={quickAddVersionId || ''}
                                        onChange={e => setQuickAddVersionId(e.target.value ? parseInt(e.target.value) : null)}
                                        style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }}
                                    >
                                        <option value="">No version</option>
                                        {(vm.projectVersionsMap[vm.selectedProjectId] || []).map((v: { id: number; name: string }) => (
                                            <option key={v.id} value={v.id}>{v.name}</option>
                                        ))}
                                    </select>
                                    <span style={{ marginLeft: 3, fontSize: 10, color: '#666' }}>⌄</span>
                                </span>
                            )}
                            <span style={{ fontSize: 11, color: '#888', position: 'relative' }}>
                                {quickAddAssigneeId === null
                                    ? '👤 Unassigned'
                                    : currentProjectMembers.find(m => m.id === quickAddAssigneeId)?.name || '👤 Unassigned'}
                                <select
                                    value={quickAddAssigneeId || ''}
                                    onChange={e => setQuickAddAssigneeId(e.target.value ? parseInt(e.target.value) : null)}
                                    style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }}
                                >
                                    <option value="">👤 Unassigned</option>
                                    {renderGroupedMemberOptions(currentProjectMembers)}
                                </select>
                                <span style={{ marginLeft: 3, fontSize: 10, color: '#666' }}>⌄</span>
                            </span>
                        </div>
                        {vm.selectedProjectId === -1 && (
                            <div style={{ fontSize: 11, color: '#444' }}>Please select a project</div>
                        )}
                    </div>
                </div>
            </section>

            <div
                className="no-drag"
                onMouseDown={() => setResizingPane('list')}
                style={{ width: 4, cursor: 'col-resize', background: resizingPane === 'list' ? '#0c66ff' : 'transparent', flexShrink: 0, margin: '0 -2px', zIndex: 100, transition: 'background 0.2s' }}
                onMouseEnter={e => (e.target as HTMLDivElement).style.background = '#0c66ff'}
                onMouseLeave={e => (e.target as HTMLDivElement).style.background = resizingPane === 'list' ? '#0c66ff' : 'transparent'}
            />

            {/* Detail */}
            <main className="issue-detail-pane" ref={detailPaneRef}>
                {selectedIssue ? (
                    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', alignItems: 'stretch' }}>
                        <div style={{ padding: '40px 30px 20px' }}>
                            {/* ID and actions row */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <a
                                        href={`${vm.redmineURL.replace(/\/$/, '')}/issues/${selectedIssue.id}`}
                                        target="_blank"
                                        onClick={(e) => {
                                            e.preventDefault();
                                            window.open(`${vm.redmineURL.replace(/\/$/, '')}/issues/${selectedIssue.id}`, '_blank');
                                        }}
                                        style={{ color: '#0c66ff', fontSize: 13, textDecoration: 'none', cursor: 'pointer' }}
                                        title="Open in browser"
                                    >
                                        #{selectedIssue.id}
                                    </a>
                                    <button
                                        onClick={() => {
                                            const url = `${vm.redmineURL.replace(/\/$/, '')}/issues/${selectedIssue.id}`;
                                            navigator.clipboard.writeText(url);
                                            // Optional: visual feedback could be added here
                                        }}
                                        title="Copy link"
                                        className="icon-button"
                                        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, opacity: 0.6, padding: 2, display: 'flex', alignItems: 'center', color: 'var(--text-primary)' }}
                                    >
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>
                                    </button>
                                    <button
                                        onClick={() => {
                                            const text = `#${selectedIssue.id}: ${selectedIssue.subject}`;
                                            navigator.clipboard.writeText(text);
                                        }}
                                        title="Copy ID + title (#id: title)"
                                        className="icon-button"
                                        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, opacity: 0.6, padding: 2, display: 'flex', alignItems: 'center', color: 'var(--text-primary)' }}
                                    >
                                        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M0 6.75C0 5.784.784 5 1.75 5h1.5a.75.75 0 0 1 0 1.5h-1.5a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-1.5a.75.75 0 0 1 1.5 0v1.5A1.75 1.75 0 0 1 9.25 16h-7.5A1.75 1.75 0 0 1 0 14.25Z"></path><path d="M5 1.75C5 .784 5.784 0 6.75 0h7.5C15.216 0 16 .784 16 1.75v7.5A1.75 1.75 0 0 1 14.25 11h-7.5A1.75 1.75 0 0 1 5 9.25Zm1.75-.25a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-7.5a.25.25 0 0 0-.25-.25Z"></path></svg>
                                    </button>
                                </div>
                                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                                    <button
                                        onClick={() => setDeleteIssueConfirm(selectedIssue.id)}
                                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ff453a', fontSize: 14, display: 'flex', alignItems: 'center' }}
                                        title="Delete task"
                                    >
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                                    </button>
                                </div>
                            </div>
                            {/* Title row */}
                            <div>
                                {editingTitle ? (
                                    <textarea
                                        value={editTitleValue}
                                        onChange={e => {
                                            setEditDescriptionValue(e.target.value); // Sync with local state if needed
                                            setEditTitleValue(e.target.value);
                                            e.target.style.height = 'auto';
                                            e.target.style.height = e.target.scrollHeight + 'px';
                                        }}
                                        onBlur={async () => {
                                            if (editTitleValue.trim() && editTitleValue !== selectedIssue.subject) {
                                                await vm.updateIssue(selectedIssue.id, { subject: editTitleValue.trim() });
                                            }
                                            setEditingTitle(false);
                                        }}
                                        onKeyDown={async e => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                if (editTitleValue.trim() && editTitleValue !== selectedIssue.subject) {
                                                    await vm.updateIssue(selectedIssue.id, { subject: editTitleValue.trim() });
                                                }
                                                setEditingTitle(false);
                                            } else if (e.key === 'Escape') {
                                                setEditingTitle(false);
                                            }
                                        }}
                                        autoFocus
                                        ref={(el) => {
                                            if (el) {
                                                el.style.height = 'auto';
                                                el.style.height = el.scrollHeight + 'px';
                                                // Focus and move cursor to end
                                                if (document.activeElement !== el) {
                                                    el.focus();
                                                }
                                                if (el.selectionStart === 0 && el.selectionStart === el.selectionEnd) {
                                                    const len = el.value.length;
                                                    el.setSelectionRange(len, len);
                                                }
                                            }
                                        }}
                                        style={{
                                            fontSize: 24,
                                            fontWeight: 600,
                                            width: '100%',
                                            background: 'transparent',
                                            border: 'none',
                                            borderBottom: '2px solid #0c66ff',
                                            color: 'var(--text-primary)',
                                            outline: 'none',
                                            padding: 0,
                                            margin: 0,
                                            fontFamily: 'inherit',
                                            lineHeight: '1.2',
                                            resize: 'none',
                                            overflow: 'hidden',
                                            display: 'block'
                                        }}
                                    />
                                ) : (
                                    <h1
                                        style={{ fontSize: 24, fontWeight: 600, cursor: 'pointer', margin: 0, lineHeight: '1.2', color: 'var(--text-primary)' }}
                                        onClick={() => { setEditTitleValue(selectedIssue.subject); setEditingTitle(true); }}
                                        title="Click to edit title"
                                    >{selectedIssue.subject}</h1>
                                )}
                            </div>
                            <div style={{ marginTop: 15, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                                    <select
                                        className="status-tag"
                                        value={selectedIssue.status.id}
                                        onChange={e => vm.updateIssue(selectedIssue.id, { status_id: parseInt(e.target.value) })}
                                        style={{
                                            border: 'none',
                                            color: '#ff453a',
                                            background: 'rgba(255,69,58,0.12)',
                                            fontWeight: 600,
                                            borderRadius: 20,
                                            padding: '3px 22px 3px 12px',
                                            outline: 'none',
                                            cursor: 'pointer',
                                            fontSize: 11,
                                            WebkitAppearance: 'none',
                                            MozAppearance: 'none',
                                            appearance: 'none',
                                            width: 'fit-content'
                                        }}
                                    >
                                        {vm.issueStatuses.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                    </select>
                                    <span style={{ position: 'absolute', right: 8, fontSize: 8, pointerEvents: 'none', color: '#ff453a', opacity: 0.8 }}>▼</span>
                                </div>
                                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                                    <select
                                        className="status-tag"
                                        value={selectedIssue.assigned_to?.id || ''}
                                        onChange={e => vm.updateIssue(selectedIssue.id, { assigned_to_id: e.target.value || '' })}
                                        style={{
                                            border: 'none',
                                            color: 'var(--text-primary)',
                                            background: 'var(--button-secondary)',
                                            borderRadius: 20,
                                            padding: '3px 22px 3px 12px',
                                            outline: 'none',
                                            cursor: 'pointer',
                                            fontSize: 11,
                                            WebkitAppearance: 'none',
                                            MozAppearance: 'none',
                                            appearance: 'none',
                                            width: 'fit-content'
                                        }}
                                    >
                                        <option value="">👤 Unassigned</option>
                                        {renderGroupedMemberOptions(getProjectMembers(selectedIssue.project?.id))}
                                    </select>
                                    <span style={{ position: 'absolute', right: 8, fontSize: 8, pointerEvents: 'none', color: 'var(--text-secondary)' }}>▼</span>
                                </div>
                                {selectedIssue && (() => {
                                    const assignedWatchers = getAssignedWatchers(selectedIssue);
                                    return (
                                        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                                            <select
                                                value=""
                                                onChange={async e => {
                                                    if (e.target.value) {
                                                        await vm.addAssignedWatcher(selectedIssue, parseInt(e.target.value));
                                                    }
                                                }}
                                                style={{
                                                    border: 'none',
                                                    color: 'var(--text-secondary)',
                                                    background: 'var(--button-secondary)',
                                                    borderRadius: 20,
                                                    padding: '3px 22px 3px 12px',
                                                    outline: 'none',
                                                    cursor: 'pointer',
                                                    fontSize: 11,
                                                    WebkitAppearance: 'none',
                                                    MozAppearance: 'none',
                                                    appearance: 'none',
                                                    width: 'fit-content'
                                                }}
                                            >
                                                <option value="">＋ Add assigned watcher</option>
                                                {renderGroupedMemberOptions(getProjectMembers(selectedIssue.project?.id), assignedWatchers.map(w => w.id))}
                                            </select>
                                            <span style={{ position: 'absolute', right: 8, fontSize: 8, pointerEvents: 'none', color: 'var(--text-secondary)' }}>▼</span>
                                        </div>
                                    )
                                })()}
                            </div>
                            {(() => {
                                const assignedWatchers = getAssignedWatchers(selectedIssue);

                                // Look up username from globalMembers by ID
                                const assignedWatchersWithNames = assignedWatchers.map(aw => {
                                    const member = vm.globalMembers.find(m => m.id === aw.id);
                                    return {
                                        id: aw.id,
                                        name: member ? member.name : `User ${aw.id}`
                                    };
                                });

                                return assignedWatchersWithNames.length > 0 && (
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                                        {assignedWatchersWithNames.map(w => (
                                            <div key={w.id} style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'var(--input-bg)', padding: '2px 8px', borderRadius: 12, fontSize: 11, color: 'var(--text-secondary)' }}>
                                                <span>{w.name}</span>
                                                <span
                                                    onClick={() => vm.removeAssignedWatcher(selectedIssue, w.id)}
                                                    style={{ cursor: 'pointer', opacity: 0.6, fontSize: 13 }}
                                                    title="Remove assigned watcher"
                                                >×</span>
                                            </div>
                                        ))}
                                    </div>
                                )
                            })()}
                            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 15 }}>Created by: {selectedIssue.author.name} • {format(new Date(selectedIssue.created_on), 'yyyy-MM-dd HH:mm')}</div>
                        </div>

                        <div
                            style={{ flex: 1, overflowY: 'auto', overflowX: 'auto', paddingBottom: 20 }}
                            onWheel={(e) => {
                                if (e.shiftKey && e.deltaY !== 0) {
                                    e.currentTarget.scrollLeft += e.deltaY;
                                    e.preventDefault();
                                }
                            }}
                        >
                            <div style={{ padding: '0 30px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
                                    <h3 style={{ fontSize: 13, fontWeight: 500, color: '#666', textTransform: 'uppercase' }}>Description</h3>
                                    {!editingDescription && (
                                        <button
                                            onClick={() => { setEditDescriptionValue(selectedIssue.description || ''); setEditingDescription(true); }}
                                            style={{ background: 'none', border: 'none', color: '#0c66ff', fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                                        >
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                                        </button>
                                    )}
                                </div>
                                {editingDescription ? (
                                    <RichEditor
                                        initialValue={processedDescription}
                                        onChange={(val) => setEditDescriptionValue(val)}
                                        onSave={async () => {
                                            let cleanedDescription = editDescriptionValue;
                                            pendingUploads.forEach(u => {
                                                if (u.tempUrl) {
                                                    const escapedUrl = u.tempUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                                                    const regex = new RegExp(escapedUrl, 'g');
                                                    const finalFilename = encodeURIComponent(u.filename);
                                                    cleanedDescription = cleanedDescription.replace(regex, finalFilename);
                                                }
                                            });

                                            await vm.updateIssue(selectedIssue.id, {
                                                description: cleanedDescription,
                                                uploads: pendingUploads.map(u => ({
                                                    token: u.token,
                                                    filename: u.filename,
                                                    content_type: u.content_type
                                                }))
                                            });
                                            setEditingDescription(false);
                                            setPendingUploads([]);
                                        }}
                                        onCancel={() => {
                                            setEditingDescription(false);
                                            setPendingUploads([]);
                                        }}
                                        onUpload={async (file) => {
                                            const result = await vm.uploadAttachment(file);
                                            if (result) {
                                                let tempUrl = '';
                                                if (file.type.startsWith('image/')) {
                                                    tempUrl = await new Promise((resolve) => {
                                                        const reader = new FileReader();
                                                        reader.onload = (e) => resolve(e.target?.result as string);
                                                        reader.readAsDataURL(file);
                                                    });
                                                } else {
                                                    tempUrl = `attachment:${file.name}`;
                                                }

                                                setPendingUploads(prev => [...prev, {
                                                    token: result.token,
                                                    filename: file.name,
                                                    content_type: file.type,
                                                    tempUrl
                                                }]);
                                                return result;
                                            }
                                            return null;
                                        }}
                                    />
                                ) : (
                                    <div
                                        style={{ lineHeight: 1.6, fontSize: 14, minHeight: 50 }}
                                    >
                                        {renderMarkdownWithImages(selectedIssue.description)}
                                        {!selectedIssue.description && <i style={{ color: '#444' }}>No description</i>}
                                    </div>
                                )}
                            </div>

                            {/* Attachments Section */}
                            {(() => {
                                const currentDescription = editingDescription ? editDescriptionValue : (selectedIssue.description || '');
                                const journals = selectedIssue.journals || [];
                                const allNotes = journals.map((j: IssueJournal) => j.notes || '').join('\n');
                                const allText = currentDescription + '\n' + allNotes;

                                const isImageReferenced = (filename: string, contentUrl: string | undefined, text: string) => {
                                    if (!text) return false;

                                    // Check if full content_url appears in text (most reliable)
                                    if (contentUrl && text.includes(contentUrl)) return true;

                                    const encoded = encodeURIComponent(filename);
                                    const escapedFilename = filename.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                                    const escapedEncoded = encoded.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

                                    // Check for Textile image syntax: !filename!
                                    const textilePattern = new RegExp(`!${escapedFilename}!`, 'i');
                                    const textileEncodedPattern = new RegExp(`!${escapedEncoded}!`, 'i');

                                    // Check for Markdown image syntax: ![](filename) or ![](attachment:filename)
                                    const hasMarkdown = text.includes(`(${filename})`) ||
                                        text.includes(`(${encoded})`) ||
                                        text.includes(`(attachment:${filename})`) ||
                                        text.includes(`(attachment:${encoded})`);

                                    if (hasMarkdown) return true;
                                    return textilePattern.test(text) || textileEncodedPattern.test(text);
                                };

                                const filteredAttachments = selectedIssue.attachments?.filter(a => {
                                    if (a.content_type?.startsWith('image/')) {
                                        if (isImageReferenced(a.filename, a.content_url, allText)) return false;
                                    }
                                    return true;
                                }) || [];

                                const filteredPending = pendingUploads.filter(u => {
                                    if (u.content_type?.startsWith('image/')) {
                                        // Check if tempUrl is used in markdown image syntax: ![](data:...) or textile !data:...!
                                        const isTempInImage = u.tempUrl && (
                                            allText.includes(`](${u.tempUrl})`) ||
                                            allText.includes(`!${u.tempUrl}!`)
                                        );

                                        if (isTempInImage) return false;
                                        if (isImageReferenced(u.filename, undefined, allText)) return false;
                                    }
                                    return true;
                                });

                                return (
                                    <div style={{ marginTop: 40, padding: '0 30px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
                                            <h3 style={{ fontSize: 13, fontWeight: 500, color: '#666', textTransform: 'uppercase', margin: 0 }}>Attachments</h3>
                                            <label style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 6,
                                                padding: '4px 10px',
                                                borderRadius: 6,
                                                border: '1px solid #222',
                                                fontSize: 12,
                                                cursor: isUploading ? 'not-allowed' : 'pointer',
                                                color: '#0c66ff',
                                                background: 'rgba(12, 102, 255, 0.05)'
                                            }}>
                                                {isUploading ? '⌛ Uploading...' : '📎 Upload File'}
                                                <input
                                                    type="file"
                                                    multiple
                                                    style={{ display: 'none' }}
                                                    disabled={isUploading}
                                                    onChange={async (e) => {
                                                        const files = e.target.files;
                                                        if (!files || files.length === 0) return;

                                                        setIsUploading(true);
                                                        try {
                                                            for (let i = 0; i < files.length; i++) {
                                                                const file = files[i];
                                                                const result = await vm.uploadAttachment(file);
                                                                if (result) {
                                                                    if (editingDescription) {
                                                                        // If editing, add to pending so it saves with the description
                                                                        let tempUrl = '';
                                                                        if (file.type.startsWith('image/')) {
                                                                            tempUrl = await new Promise((resolve) => {
                                                                                const reader = new FileReader();
                                                                                reader.onload = (e) => resolve(e.target?.result as string);
                                                                                reader.readAsDataURL(file);
                                                                            });
                                                                        }
                                                                        setPendingUploads(prev => [...prev, {
                                                                            token: result.token,
                                                                            filename: file.name,
                                                                            content_type: file.type,
                                                                            tempUrl
                                                                        }]);
                                                                    } else {
                                                                        // If not editing, save immediately to issue
                                                                        await vm.updateIssue(selectedIssue.id, {
                                                                            uploads: [{
                                                                                token: result.token,
                                                                                filename: file.name,
                                                                                content_type: file.type
                                                                            }]
                                                                        });
                                                                    }
                                                                }
                                                            }
                                                        } finally {
                                                            setIsUploading(false);
                                                            e.target.value = ''; // Reset input
                                                        }
                                                    }}
                                                />
                                            </label>
                                        </div>

                                        {(filteredAttachments.length > 0 || filteredPending.length > 0) ? (
                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 15 }}>
                                                {filteredAttachments.map(a => (
                                                    <div key={a.id} style={{ background: '#111', padding: '12px', borderRadius: 12, border: '1px solid #222', display: 'flex', alignItems: 'center', gap: 12 }}>
                                                        <div style={{ width: 32, height: 32, background: 'var(--card-bg)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>
                                                            {a.content_type?.startsWith('image/') ? '🖼️' : '📎'}
                                                        </div>
                                                        <div style={{ flex: 1, minWidth: 0 }}>
                                                            <a href="#" onClick={(e) => { e.preventDefault(); downloadFile(a.content_url, a.filename); }} style={{ color: '#0c66ff', fontSize: 13, fontWeight: 500, textDecoration: 'none', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.filename}</a>
                                                            <span style={{ fontSize: 11, color: '#555' }}>{(a.filesize / 1024).toFixed(1)} KB</span>
                                                        </div>
                                                    </div>
                                                ))}
                                                {filteredPending.map((u, idx) => (
                                                    <div key={`pending-${idx}`} style={{ background: '#111', padding: '12px', borderRadius: 12, border: '1px dashed #0c66ff', display: 'flex', alignItems: 'center', gap: 12, opacity: 0.8 }}>
                                                        <div style={{ width: 32, height: 32, background: 'var(--card-bg)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>
                                                            ⏳
                                                        </div>
                                                        <div style={{ flex: 1, minWidth: 0 }}>
                                                            <div style={{ color: '#0c66ff', fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.filename}</div>
                                                            <span style={{ fontSize: 11, color: '#444' }}>Ready to save</span>
                                                        </div>
                                                        <button onClick={() => setPendingUploads(prev => prev.filter(item => item.token !== u.token))} style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', padding: '0 5px', fontSize: 16 }}>✕</button>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div style={{ fontSize: 12, color: '#333', fontStyle: 'italic' }}>No attachments yet.</div>
                                        )}
                                    </div>
                                );
                            })()}

                            <div style={{ marginTop: 40, padding: '0 30px' }}>
                                <h3 style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 20, textTransform: 'uppercase' }}>History</h3>
                                {selectedIssue.journals?.filter((j: IssueJournal) => j.notes).slice().reverse().map((j: IssueJournal) => (
                                    <div key={j.id} style={{ marginBottom: 25, paddingBottom: 20, borderBottom: '1px solid var(--border-color)' }}>
                                        <div style={{ display: 'flex', gap: 10, fontSize: 12, color: 'var(--text-secondary)', marginBottom: 10 }}>
                                            <strong style={{ color: 'var(--text-primary)', opacity: 0.8 }}>{j.user.name}</strong> • {format(new Date(j.created_on), 'MMM d, HH:mm')}
                                        </div>
                                        <div style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.6 }}>{renderMarkdownWithImages(j.notes || '')}</div>
                                    </div>
                                ))}
                                {(!selectedIssue.journals || selectedIssue.journals.filter((j: any) => j.notes).length === 0) && (
                                    <div style={{ color: 'var(--text-secondary)', fontSize: 13, fontStyle: 'italic', padding: '10px 0' }}>No history yet.</div>
                                )}
                            </div>
                        </div>

                        <NoteEditor issueId={selectedIssue.id} onAddNote={vm.addNote} />
                    </div>
                ) : (
                    <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#222', fontSize: 14 }}>Select an issue</div>
                )
                }
            </main >

            {/* Modals & Overlays */}
            {
                lightboxImage && (
                    <div
                        className="image-lightbox-overlay"
                        onClick={handleLightboxClose}
                        onWheel={(e) => {
                            e.preventDefault();
                            const delta = e.deltaY;
                            if (delta < 0) {
                                setLightboxScale(s => Math.min(4, s + 0.1));
                            } else {
                                setLightboxScale(s => Math.max(0.25, s - 0.1));
                            }
                        }}
                        onMouseMove={(e) => {
                            if (isDragging) {
                                setLightboxOffset({
                                    x: e.clientX - dragStart.x,
                                    y: e.clientY - dragStart.y
                                });
                            }
                        }}
                        onMouseUp={() => setIsDragging(false)}
                        onMouseLeave={() => setIsDragging(false)}
                    >
                        <div
                            onClick={(e) => e.stopPropagation()}
                            onMouseDown={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setIsDragging(true);
                                setDragStart({ x: e.clientX - lightboxOffset.x, y: e.clientY - lightboxOffset.y });
                            }}
                            style={{
                                cursor: isDragging ? 'grabbing' : 'grab',
                                userSelect: 'none',
                                display: 'inline-block',
                                transform: `translate(${lightboxOffset.x}px, ${lightboxOffset.y}px) scale(${lightboxScale})`,
                                transformOrigin: 'center center'
                            }}
                        >
                            <AuthenticatedImage
                                src={lightboxImage}
                                alt="Enlarged"
                                fetchBlob={(u) => vm.fetchImageBlob(u)}
                                className="image-lightbox-content"
                                style={{
                                    pointerEvents: 'none',
                                    display: 'block'
                                }}
                            />
                        </div>
                        <div className="image-lightbox-controls" onClick={e => e.stopPropagation()}>
                            <button onClick={handleLightboxShrink}>−</button>
                            <button onClick={handleLightboxReset}>○</button>
                            <button onClick={handleLightboxEnlarge}>+</button>
                            <button onClick={handleLightboxClose}>✕</button>
                        </div>
                    </div>
                )
            }
        </div >
    );
};

export default App;
