import React, { useState, useEffect, useRef } from 'react'
import { Issue } from '../models/redmine'
import { IssueItem, GroupedMembers } from './IssueItem'

interface RemoteSearchResultsProps {
    results: Issue[]
    isSearching: boolean
    searchQuery: string
    totalCount: number
    selectedIssueId: number | null
    onSelectIssue: (id: number, sourceKey: string) => void
    vm: any
    handleUpdateStatus: (id: number, statusId: number) => void
    handleUpdatePriority: (id: number, priorityId: number) => void
    handleUpdateVersion: (id: number, versionId: string) => void
    handleUpdateAssignee: (id: number, assigneeId: string) => void
    stableStatusList: any[]
    stablePriorityList: any[]
    stableVersionListCache: Record<number, any[]>
    stableGroupedMemberCache: Record<number | string, GroupedMembers>
}

export const RemoteSearchResults = React.memo<RemoteSearchResultsProps>(({
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
}) => {
    const listRef = useRef<HTMLDivElement>(null)
    const [indicatorStyle, setIndicatorStyle] = useState<React.CSSProperties>({ opacity: 0 })

    useEffect(() => {
        if (selectedIssueId && listRef.current) {
            const el = listRef.current.querySelector(`[data-issue-id="${selectedIssueId}"]`) as HTMLElement
            if (el) {
                setIndicatorStyle({
                    top: el.offsetTop,
                    height: el.offsetHeight,
                    opacity: 1
                })
            } else {
                setIndicatorStyle({ opacity: 0 })
            }
        } else {
            setIndicatorStyle({ opacity: 0 })
        }
    }, [selectedIssueId, results])

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
        )
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
        )
    }

    if (results.length === 0) {
        return (
            <div style={{ textAlign: 'center', marginTop: 80, color: 'var(--text-secondary)', fontSize: 13 }}>
                <div style={{ marginBottom: 10 }}>🔍</div>
                No issues found matching &quot;{searchQuery}&quot;<br />
                <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Try different keywords</span>
            </div>
        )
    }

    return (
        <div style={{ padding: '0 0 20px', position: 'relative' }} ref={listRef}>
            <div className="selection-indicator" style={indicatorStyle} />

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
                    <IssueItem
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
                            const followed = vm.followedIssueIds.has(id)
                            if (followed) {
                                await vm.removeWatcher(id, vm.currentUser!.id)
                            } else {
                                await vm.addWatcher(id, vm.currentUser!.id)
                            }
                        }}
                    />
                </div>
            ))}
        </div>
    )
})

export default RemoteSearchResults
