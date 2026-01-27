import axios, { AxiosInstance } from 'axios';
import { Project, Issue, Version, User, IssueStatus, IssuePriority } from '../models/redmine';

export class RedmineService {
    private axios: AxiosInstance;

    constructor(private url: string, private apiKey: string) {
        const normalizedUrl = url.endsWith('/') ? url : `${url}/`;
        this.axios = axios.create({
            baseURL: normalizedUrl,
            headers: {
                'X-Redmine-API-Key': apiKey,
                'Content-Type': 'application/json',
            },
        });
    }

    async fetchCurrentUser(): Promise<User> {
        const response = await this.axios.get('users/current.json');
        return response.data.user;
    }

    async fetchProjects(): Promise<Project[]> {
        const response = await this.axios.get('projects.json?limit=100');
        return response.data.projects;
    }

    async fetchVersions(projectId: number): Promise<Version[]> {
        const response = await this.axios.get(`projects/${projectId}/versions.json`);
        return response.data.versions;
    }

    async fetchIssueStatuses(): Promise<IssueStatus[]> {
        const response = await this.axios.get('issue_statuses.json');
        return response.data.issue_statuses;
    }

    async fetchIssuePriorities(): Promise<IssuePriority[]> {
        const response = await this.axios.get('enumerations/issue_priorities.json');
        return response.data.issue_priorities;
    }

    async fetchIssues(params: {
        project_id?: number | string;
        status_id?: string;
        assigned_to_id?: number | string;
        fixed_version_id?: number | string;
        watcher_id?: number | string; // Filter by watcher user ID
        limit?: number;
        offset?: number;
        updated_on?: string; // e.g. ">=2025-11-24"
        sort?: string; // e.g. "updated_on:desc"
        include?: string; // e.g. "journals,attachments"
    }): Promise<{ issues: Issue[]; total_count: number }> {
        const response = await this.axios.get('issues.json', { params });
        return {
            issues: response.data.issues,
            total_count: response.data.total_count,
        };
    }

    async fetchIssueDetail(issueId: number): Promise<Issue> {
        // 包含 journals, attachments, watchers(关注者)
        // 自定义字段（包括协助者）会自动包含在 Issue 响应中
        const response = await this.axios.get(`issues/${issueId}.json?include=journals,attachments,watchers`);
        return response.data.issue;
    }

    async updateIssue(issueId: number, data: any): Promise<void> {
        await this.axios.put(`issues/${issueId}.json`, { issue: data });
    }

    async createIssue(data: any): Promise<Issue> {
        const response = await this.axios.post('issues.json', { issue: data });
        return response.data.issue;
    }

    async deleteIssue(issueId: number): Promise<void> {
        await this.axios.delete(`issues/${issueId}.json`);
    }

    // 远程搜索 API
    async searchIssues(query: string, params?: {
        project_id?: number;
        limit?: number;
        offset?: number;
    }): Promise<{ issues: Issue[]; total_count: number }> {
        // 使用 Redmine 的 search.json 端点进行全局搜索
        // 返回的结果格式和 issues.json 不同，需要提取 issue IDs 然后获取详情
        const searchParams: Record<string, any> = {
            q: query,
            issues: 1,  // 只搜索 issues
            limit: params?.limit || 25,
            offset: params?.offset || 0
        };
        if (params?.project_id) {
            searchParams.scope = 'subprojects';  // 包含子项目
        }

        const response = await this.axios.get('search.json', { params: searchParams });

        // search.json 返回的结果结构
        // { results: [{ id, title, type, url, description, datetime }], total_count, offset, limit }
        const searchResults = response.data.results || [];
        const totalCount = response.data.total_count || 0;

        // 过滤出 issues 类型的结果并提取 ID (URL 格式: /issues/12345)
        const issueIds: number[] = [];
        for (const result of searchResults) {
            if (result.type === 'issue' && result.url) {
                const match = result.url.match(/\/issues\/(\d+)/);
                if (match) {
                    issueIds.push(parseInt(match[1], 10));
                }
            }
        }

        // 如果没有搜索结果，返回空数组
        if (issueIds.length === 0) {
            return { issues: [], total_count: totalCount };
        }

        // 使用 issues.json 的 issue_id 参数批量获取 issue 详情
        // 这比逐个请求效率更高
        const issueIdStr = issueIds.join(',');
        const issuesResponse = await this.axios.get('issues.json', {
            params: {
                issue_id: issueIdStr,
                status_id: '*',  // 包含所有状态
                limit: issueIds.length
            }
        });

        return {
            issues: issuesResponse.data.issues || [],
            total_count: totalCount
        };
    }

    // 关注者 API
    async addWatcher(issueId: number, userId: number): Promise<void> {
        await this.axios.post(`issues/${issueId}/watchers.json`, { user_id: userId });
    }

    async removeWatcher(issueId: number, userId: number): Promise<void> {
        await this.axios.delete(`issues/${issueId}/watchers/${userId}.json`);
    }

    async fetchImageBlob(imageUrl: string): Promise<Blob> {
        let url = imageUrl;
        let configBaseURL = this.axios.defaults.baseURL;

        if (imageUrl.startsWith('http')) {
            configBaseURL = '';
        } else if (imageUrl.startsWith('//')) {
            url = 'https:' + imageUrl;
            configBaseURL = '';
        } else if (imageUrl.startsWith('/')) {
            url = imageUrl.substring(1);
        }

        // Add API key as query parameter for better compatibility with redirects
        // Only add if not already present
        let finalUrl = url;
        if (!url.includes('key=')) {
            const connector = url.includes('?') ? '&' : '?';
            finalUrl = `${url}${connector}key=${this.axios.defaults.headers['X-Redmine-API-Key']}`;
        }

        console.log(`Fetching image: ${finalUrl} (Base: ${configBaseURL})`);

        try {
            const response = await this.axios.get(finalUrl, {
                responseType: 'blob',
                baseURL: configBaseURL
            });
            return response.data;
        } catch (e: any) {
            console.error(`Failed to fetch image blob: ${finalUrl}`, e);
            throw e;
        }
    }

    async fetchAssignableUsers(projectId: number): Promise<{ id: number; name: string; groups: string[] }[]> {
        const response = await this.axios.get(`projects/${projectId}/memberships.json?limit=100`);
        return response.data.memberships
            .filter((m: any) => m.user)
            .map((m: any) => ({
                id: m.user.id,
                name: m.user.name,
                groups: (m.roles || []).map((r: any) => r.name)
            }));
    }

    async createVersion(projectId: number, name: string): Promise<Version> {
        const response = await this.axios.post(`projects/${projectId}/versions.json`, {
            version: { name, status: 'open' }
        });
        return response.data.version;
    }

    async deleteVersion(versionId: number): Promise<void> {
        await this.axios.delete(`versions/${versionId}.json`);
    }

    async updateVersion(versionId: number, data: any): Promise<void> {
        await this.axios.put(`versions/${versionId}.json`, { version: data });
    }

    async uploadFile(file: File): Promise<{ token: string }> {
        const response = await this.axios.post('uploads.json', file, {
            headers: {
                'Content-Type': 'application/octet-stream',
            },
            params: {
                filename: file.name
            }
        });
        return response.data.upload;
    }
}
