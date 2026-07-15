import React, { useState, useEffect } from 'react'
import { Issue } from '../models/redmine'
import { IssueListContent } from './IssueListContent'
import { GroupedMembers } from './IssueItem'

interface TabbedIssueListProps {
    currentKey: string
    versionViewData: Record<string, { groups: Record<string, Issue[]>; sortedKeys: string[] }>
    vm: any
    selectedIssueState: { id: number | null; sourceKey: string } | null
    handleSelectIssue: (id: number | null, sourceKey: string) => void
    handleUpdateStatus: (id: number, statusId: number) => void
    handleUpdatePriority: (id: number, priorityId: number) => void
    handleUpdateVersion: (id: number, versionId: string) => void
    handleUpdateAssignee: (id: number, assigneeId: string) => void
    stableStatusList: any[]
    stablePriorityList: any[]
    stableVersionListCache: Record<number, any[]>
    stableGroupedMemberCache: Record<number | string, GroupedMembers>
}

export const TabbedIssueList = React.memo<TabbedIssueListProps>(({
    currentKey,
    versionViewData,
    vm,
    selectedIssueState,
    handleSelectIssue,
    handleUpdateStatus,
    handleUpdatePriority,
    handleUpdateVersion,
    handleUpdateAssignee,
    stableStatusList,
    stablePriorityList,
    stableVersionListCache,
    stableGroupedMemberCache,
}) => {
    const [visitedTabs, setVisitedTabs] = useState<Set<string>>(new Set())

    useEffect(() => {
        if (currentKey && !visitedTabs.has(currentKey)) {
            setVisitedTabs(prev => {
                const newSet = new Set(prev)
                newSet.add(currentKey)
                return newSet
            })
        }
    }, [currentKey, visitedTabs])

    const tabsToRender = Array.from(visitedTabs)

    return (
        <div style={{ position: 'relative', width: '100%', height: '100%' }}>
            {tabsToRender.map(key => {
                const isActive = key === currentKey
                const data = versionViewData[key]
                if (!data) return null

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
                        <div style={{ paddingBottom: 20 }}>
                            <IssueListContent
                                isActive={isActive}
                                tabKey={key}
                                globalSelectedIssueState={selectedIssueState}
                                data={{ ...data, tabKey: key }}
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
                )
            })}
        </div>
    )
})

export default TabbedIssueList
