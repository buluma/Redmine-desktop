import { Issue, CustomField } from '../models/redmine';

// Name of the assigned watchers custom field (adjust according to your Redmine configuration)
const ASSIGNED_WATCHERS_FIELD_NAME = '协助者';

/**
 * Get assigned watchers list from Issue custom fields
 */
export function getAssignedWatchers(issue: Issue): { id: number; name: string }[] {
    if (!issue.custom_fields) return [];

    const field = issue.custom_fields.find(cf => cf.name === ASSIGNED_WATCHERS_FIELD_NAME);
    if (!field || !field.value) {
        return [];
    }

    // Custom field value is an array of string IDs
    if (Array.isArray(field.value)) {
        return field.value.map((v: any) => ({
            id: typeof v === 'object' ? parseInt(v.id) : parseInt(v),
            name: '' // Name needs to be looked up from globalMembers in the UI layer
        })).filter(u => u.id && !isNaN(u.id));
    }

    return [];
}

/**
 * Get the assigned watchers custom field object from Issue custom fields
 */
export function getAssignedWatchersField(issue: Issue): CustomField | undefined {
    if (!issue.custom_fields) return undefined;
    return issue.custom_fields.find(cf => cf.name === ASSIGNED_WATCHERS_FIELD_NAME);
}

/**
 * Create custom field data for updating assigned watchers
 * @param fieldId Custom field ID
 * @param assistantIds Array of assigned watcher user IDs
 * @returns custom_fields array for updateIssue API
 */
export function createAssignedWatchersUpdate(fieldId: number, assistantIds: number[]): any[] {
    return [{
        id: fieldId,
        value: assistantIds
    }];
}
