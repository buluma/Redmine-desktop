export interface User {
    id: number;
    login: string;
    firstname: string;
    lastname: string;
    mail?: string;
    created_on: string;
    last_login_on?: string;
    api_key?: string;
    status?: number;
    name?: string;
}

// Member with group/role information for grouped display
export interface MemberWithGroup {
    id: number;
    name: string;
    groups: string[]; // Role names like "Client", "Server", "Test" etc.
}

export interface Project {
    id: number;
    name: string;
    identifier: string;
    description?: string;
    status: number;
    is_public: boolean;
    created_on: string;
    updated_on: string;
    parent?: { id: number; name: string };
}

export interface IssueStatus {
    id: number;
    name: string;
    is_closed?: boolean;
}

export interface IssuePriority {
    id: number;
    name: string;
}

export interface Version {
    id: number;
    project: { id: number; name: string };
    name: string;
    status: string;
    due_date?: string;
    description?: string;
    created_on: string;
    updated_on: string;
}

export interface Attachment {
    id: number;
    filename: string;
    filesize: number;
    content_type: string;
    description: string;
    content_url: string;
    author: { id: number; name: string };
    created_on: string;
}

export interface CustomField {
    id: number;
    name: string;
    value?: any;  // Can be string, array, etc.
}

export interface Issue {
    id: number;
    project?: { id: number; name: string };
    tracker: { id: number; name: string };
    status: IssueStatus;
    priority: IssuePriority;
    author: { id: number; name: string };
    assigned_to?: { id: number; name: string };
    fixed_version?: { id: number; name: string };
    subject: string;
    description?: string;
    start_date?: string;
    due_date?: string;
    done_ratio: number;
    is_private: boolean;
    estimated_hours?: number;
    spent_hours?: number;
    created_on: string;
    updated_on: string;
    closed_on?: string;
    journals?: IssueJournal[];
    attachments?: Attachment[];
    watchers?: { id: number; name: string }[];  // Watchers
    custom_fields?: CustomField[];  // Custom fields (including assigned watchers)
}

export interface IssueJournal {
    id: number;
    user: { id: number; name: string };
    notes: string;
    created_on: string;
    details?: { property: string; name: string; old_value?: string; new_value?: string }[];
}
