import React from 'react'
import { Issue } from '../models/redmine'
import { isDevComplete, isCircleActionDisabled, isSubjectDone, getIssueStatusColor } from '../constants/status'

export interface GroupedMembers {
    grouped: Record<string, { id: number; name: string }[]>
    noGroup: { id: number; name: string }[]
    sortedGroups: string[]
}

interface IssueItemProps {
    issue: Issue
    isSelected: boolean
    onSelect: (id: number) => void
    onUpdateStatus: (id: number, statusId: number) => void
    onUpdatePriority: (id: number, priorityId: number) => void
    onUpdateVersion: (id: number, versionId: string) => void
    onUpdateAssignee: (id: number, assigneeId: string) => void
    statusList: any[]
    priorityList: any[]
    versionList: any[]
    groupedMembers: GroupedMembers
    isFollowed: boolean
    onToggleFollow: (id: number) => void
}

const areEqual = (prev: IssueItemProps, next: IssueItemProps) => (
    prev.isSelected === next.isSelected &&
    prev.issue.id === next.issue.id &&
    prev.issue.subject === next.issue.subject &&
    prev.issue.status.id === next.issue.status.id &&
    prev.issue.priority.id === next.issue.priority.id &&
    prev.issue.fixed_version?.id === next.issue.fixed_version?.id &&
    prev.issue.assigned_to?.id === next.issue.assigned_to?.id &&
    prev.statusList === next.statusList &&
    prev.priorityList === next.priorityList &&
    prev.versionList === next.versionList &&
    prev.groupedMembers === next.groupedMembers &&
    prev.isFollowed === next.isFollowed
)

export const IssueItem = React.memo<IssueItemProps>(({
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
}) => {
    return (
        <div className={`issue-item ${isSelected ? 'selected' : ''}`} data-issue-id={issue.id} onClick={() => onSelect(issue.id)} style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 10, position: 'relative' }}>
            <div className="issue-icon-circle"
                onClick={(e) => {
                    e.stopPropagation();
                    if (isCircleActionDisabled(issue.status.name)) return;
                    const doneStatus = statusList.find((s: any) => isDevComplete(s.name));
                    if (doneStatus) {
                        onUpdateStatus(issue.id, doneStatus.id);
                    }
                }}
                style={{
                    borderColor: getIssueStatusColor(issue.status.name),
                    width: 18, height: 18, fontSize: 9, flexShrink: 0,
                    color: getIssueStatusColor(issue.status.name),
                    cursor: isCircleActionDisabled(issue.status.name) ? 'default' : 'pointer'
                }}>
                {isCircleActionDisabled(issue.status.name) ? '✓' : ''}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
                <div className="issue-subject" style={{
                    fontSize: 13,
                    color: isSubjectDone(issue.status.name) ? 'var(--text-secondary)' : 'var(--text-primary)',
                    textDecoration: isSubjectDone(issue.status.name) ? 'line-through' : 'none',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                }}>{issue.subject}</div>
                <div className="issue-meta" style={{ fontSize: 10, marginTop: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--text-secondary)' }}>
                    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                        <span style={{ background: 'rgba(255,69,58,0.15)', borderRadius: 8, padding: '1px 6px', fontSize: 10, color: '#ff453a', position: 'relative', fontWeight: 500, border: '1px solid rgba(255,69,58,0.3)' }}>
                            {issue.status.name}
                            <select value={issue.status.id} onClick={e => e.stopPropagation()} onChange={e => onUpdateStatus(issue.id, parseInt(e.target.value))} style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }}>
                                {statusList.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                            </select>
                            <span style={{ marginLeft: 3, fontSize: 10 }}>⌄</span>
                        </span>
                        <span>•</span>
                        <span style={{ color: 'var(--text-secondary)', fontSize: 10, position: 'relative' }}>
                            {issue.priority.name}
                            <select value={issue.priority.id} onClick={e => e.stopPropagation()} onChange={e => onUpdatePriority(issue.id, parseInt(e.target.value))} style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }}>
                                {priorityList.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
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
                                {versionList.map((v: any) => <option key={v.id} value={v.id}>{v.name}</option>)}
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
                                                    {grouped[g].sort((a: any, b: any) => a.name.localeCompare(b.name)).map((m: any) => (
                                                        <option key={m.id} value={m.id}>{m.name}</option>
                                                    ))}
                                                </optgroup>
                                            ))}
                                            {noGroup.length > 0 && (
                                                <optgroup label="Others">
                                                    {noGroup.sort((a: any, b: any) => a.name.localeCompare(b.name)).map((m: any) => (
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
}, areEqual);

export default IssueItem
