import { Issue } from '../models/redmine'
import { QueuedMutation } from './OfflineQueue'

export interface ConflictInfo {
    mutationId: number
    issueId: number
    subject: string
    localChanges: Record<string, any>
    serverVersion: Issue
    conflictFields: string[]
    timestamp: number
}

export interface ConflictResolution {
    mutationId: number
    resolution: 'local' | 'server' | 'merge'
    mergedData?: Record<string, unknown>
}

// Fields that can conflict
const MUTABLE_FIELDS = [
    'status_id',
    'priority_id',
    'assigned_to_id',
    'fixed_version_id',
    'subject',
    'description',
    'notes',
]

// Human-readable field names
const FIELD_LABELS: Record<string, string> = {
    status_id: 'Status',
    priority_id: 'Priority',
    assigned_to_id: 'Assignee',
    fixed_version_id: 'Version',
    subject: 'Subject',
    description: 'Description',
    notes: 'Notes',
}

/**
 * Detect if a mutation conflicts with server state
 * 
 * @param expectedState - The issue state when the user made the change
 * @param currentServerState - The current state from the server
 * @param localChanges - What the user changed
 * @returns Conflict info if conflict detected, null otherwise
 */
export function detectConflict(
    mutationId: number,
    expectedState: Issue | null,
    currentServerState: Issue,
    localChanges: Record<string, any>
): ConflictInfo | null {
    if (!expectedState) {
        // We don't have the expected state, can't detect conflict
        // Assume conflict on all changed fields
        return {
            mutationId,
            issueId: currentServerState.id,
            subject: currentServerState.subject,
            localChanges,
            serverVersion: currentServerState,
            conflictFields: Object.keys(localChanges).filter(f => f !== 'notes'),
            timestamp: Date.now(),
        }
    }

    const conflictFields: string[] = []

    // Check each field we're trying to change
    for (const field of Object.keys(localChanges)) {
        if (field === 'notes') continue // Notes are always additive, never conflict

        const localNewValue = localChanges[field]
        const expectedOldValue = getFieldValue(expectedState, field)
        const serverCurrentValue = getFieldValue(currentServerState, field)

        // If server value changed from what we expected, there's a potential conflict
        if (JSON.stringify(expectedOldValue) !== JSON.stringify(serverCurrentValue)) {
            // But if our new value matches the server, no real conflict
            if (JSON.stringify(localNewValue) !== JSON.stringify(serverCurrentValue)) {
                conflictFields.push(field)
            }
        }
    }

    if (conflictFields.length === 0) {
        return null // No conflict
    }

    return {
        mutationId,
        issueId: currentServerState.id,
        subject: currentServerState.subject,
        localChanges,
        serverVersion: currentServerState,
        conflictFields,
        timestamp: Date.now(),
    }
}

/**
 * Get field value from an issue
 */
function getFieldValue(issue: Issue, field: string): any {
    switch (field) {
        case 'status_id': return issue.status?.id
        case 'priority_id': return issue.priority?.id
        case 'assigned_to_id': return issue.assigned_to?.id
        case 'fixed_version_id': return issue.fixed_version?.id
        case 'subject': return issue.subject
        case 'description': return (issue as any).description
        default: return undefined
    }
}

/**
 * Try to auto-merge non-conflicting changes
 * 
 * @param conflict - The conflict info
 * @returns Merged data that applies non-conflicting local changes to server state
 */
export function autoMerge(conflict: ConflictInfo): Record<string, any> | null {
    const merged: Record<string, any> = {}
    let hasNonConflictingChanges = false

    for (const [field, localValue] of Object.entries(conflict.localChanges)) {
        if (field === 'notes') {
            // Notes are always additive
            merged[field] = localValue
            hasNonConflictingChanges = true
            continue
        }

        if (!conflict.conflictFields.includes(field)) {
            // No conflict on this field, apply local change
            merged[field] = localValue
            hasNonConflictingChanges = true
        }
        // Conflicting fields are excluded - server wins for those
    }

    return hasNonConflictingChanges ? merged : null
}

/**
 * Get human-readable description of a conflict
 */
export function describeConflict(conflict: ConflictInfo): string {
    const fieldNames = conflict.conflictFields
        .map(f => FIELD_LABELS[f] || f)
        .join(', ')
    
    return `Conflict on "${conflict.subject}": ${fieldNames} was modified by another user while you were offline.`
}

/**
 * Get human-readable description of a field value
 */
export function describeFieldValue(field: string, value: any, issue?: Issue): string {
    if (value === undefined || value === null || value === '') {
        return '(empty)'
    }

    switch (field) {
        case 'status_id': {
            const statusName = issue?.status?.name || `Status #${value}`
            return statusName
        }
        case 'priority_id': {
            const priorityName = issue?.priority?.name || `Priority #${value}`
            return priorityName
        }
        case 'assigned_to_id': {
            if (!value) return 'Unassigned'
            return issue?.assigned_to?.name || `User #${value}`
        }
        case 'fixed_version_id': {
            if (!value) return 'No version'
            return issue?.fixed_version?.name || `Version #${value}`
        }
        default:
            return String(value)
    }
}
