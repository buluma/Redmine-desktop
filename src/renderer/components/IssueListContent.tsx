import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Issue } from '../models/redmine'
import { isGroupDefaultCollapsed } from '../constants/status'
import { IssueItem, GroupedMembers } from './IssueItem'

interface IssueListContentProps {
    data: { groups: Record<string, Issue[]>; sortedKeys: string[]; tabKey?: string }
    vm: any
    isActive: boolean
    tabKey: string
    globalSelectedIssueState: { id: number | null; sourceKey: string } | null
    onSelectIssue: (id: number | null, sourceKey: string) => void
    stableStatusList: any[]
    stablePriorityList: any[]
    stableVersionListCache: Record<number, any[]>
    stableGroupedMemberCache: Record<number | string, GroupedMembers>
    handleUpdateStatus: (id: number, statusId: number) => void
    handleUpdatePriority: (id: number, priorityId: number) => void
    handleUpdateVersion: (id: number, versionId: string) => void
    handleUpdateAssignee: (id: number, assigneeId: string) => void
}

export const IssueListContent = React.memo<IssueListContentProps>(({
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
}) => {
    const [localCollapsed, setLocalCollapsed] = useState<Record<string, boolean>>({})

    const toggleLocalGroup = (groupKey: string) => {
        setLocalCollapsed(prev => ({ ...prev, [groupKey]: !prev[groupKey] }))
    }

    const listRef = useRef<HTMLDivElement>(null)
    const [localSelectedId, setLocalSelectedId] = useState<number | null>(null)

    // Sync with App when this tab becomes active
    useEffect(() => {
        if (isActive) {
            const globalId = globalSelectedIssueState?.id
            const sourceKey = globalSelectedIssueState?.sourceKey
            const isForMe = sourceKey === tabKey

            if (isForMe && globalId) {
                if (globalId !== localSelectedId) {
                    setLocalSelectedId(globalId)
                }
            } else {
                if (localSelectedId !== globalId) {
                    onSelectIssue(localSelectedId, tabKey)
                }
            }
        }
    }, [isActive, globalSelectedIssueState, data, tabKey])

    const onLocalSelect = useCallback((id: number) => {
        setLocalSelectedId(id)
        onSelectIssue(id, tabKey)
    }, [onSelectIssue, tabKey])

    const [indicatorStyle, setIndicatorStyle] = useState<React.CSSProperties>({ opacity: 0 })
    const prevActiveRef = useRef(isActive)

    useEffect(() => {
        if (!isActive) {
            prevActiveRef.current = false
            return
        }

        const justWokeUp = !prevActiveRef.current
        if (justWokeUp) {
            prevActiveRef.current = true
        }

        if (localSelectedId && listRef.current) {
            const delay = justWokeUp ? 2 : 0

            let rafId: number
            const scheduleUpdate = (remaining: number) => {
                if (remaining > 0) {
                    rafId = requestAnimationFrame(() => scheduleUpdate(remaining - 1))
                } else {
                    const el = listRef.current?.querySelector(`[data-issue-id="${localSelectedId}"]`) as HTMLElement
                    if (el) {
                        setIndicatorStyle({
                            top: el.offsetTop,
                            height: el.offsetHeight,
                            opacity: 1
                        })
                    } else {
                        setIndicatorStyle({ opacity: 0 })
                    }
                }
            }

            scheduleUpdate(delay)
            return () => {
                if (rafId) cancelAnimationFrame(rafId)
            }
        } else {
            setIndicatorStyle({ opacity: 0 })
        }
    }, [localSelectedId, data, localCollapsed, isActive])

    const sortedKeys = data.sortedKeys || []
    const groups = data.groups || {}

    if (sortedKeys.length === 0 && !vm.isLoading) {
        return (
            <div style={{ textAlign: 'center', marginTop: 50, color: 'var(--text-secondary)', fontSize: 13 }}>
                No issues found in this section.<br />
                <button onClick={() => vm.refreshData()} style={{ marginTop: 10, background: 'none', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '5px 15px', borderRadius: 4, cursor: 'pointer' }}>Force Refresh</button>
            </div>
        )
    }

    const finalIndicatorStyle = isActive ? indicatorStyle : { opacity: 0, transition: 'none' }

    return (
        <div style={{ position: 'relative' }} ref={listRef}>
            <div className="selection-indicator" style={finalIndicatorStyle} />
            {sortedKeys.map((key: string) => {
                const isCollapsed = localCollapsed[key] ?? isGroupDefaultCollapsed(key)
                const issuesInGroup = groups[key]

                return (
                    <div key={key} style={{ contentVisibility: 'auto', containIntrinsicSize: '0 500px' }}>
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
                            <IssueItem
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
                                    const followed = vm.followedIssueIds.has(id)
                                    if (followed) {
                                        await vm.removeWatcher(id, vm.currentUser!.id)
                                    } else {
                                        await vm.addWatcher(id, vm.currentUser!.id)
                                    }
                                }}
                            />
                        ))}
                    </div>
                )
            })}
        </div>
    )
})

export default IssueListContent
