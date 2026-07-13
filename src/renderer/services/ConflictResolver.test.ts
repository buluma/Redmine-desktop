import { describe, it, expect } from 'vitest'
import { detectConflict, autoMerge, describeConflict } from './ConflictResolver'
import { Issue } from '../models/redmine'

function makeIssue(overrides: Partial<Issue> = {}): Issue {
    return {
        id: 1,
        subject: 'Test issue',
        tracker: { id: 1, name: 'Bug' },
        status: { id: 1, name: 'New' },
        priority: { id: 1, name: 'Normal' },
        author: { id: 1, name: 'Author' },
        done_ratio: 0,
        is_private: false,
        created_on: '2024-01-01',
        updated_on: '2024-01-01',
        ...overrides,
    }
}

describe('ConflictResolver', () => {
    describe('detectConflict', () => {
        it('returns null when no conflict (same state)', () => {
            const expected = makeIssue({ status: { id: 1, name: 'New' } })
            const current = makeIssue({ status: { id: 1, name: 'New' } })
            const localChanges = { status_id: 3 }

            const conflict = detectConflict(1, expected, current, localChanges)
            expect(conflict).toBeNull()
        })

        it('detects conflict when server changed the same field', () => {
            const expected = makeIssue({ status: { id: 1, name: 'New' } })
            const current = makeIssue({ status: { id: 2, name: 'In Progress' } })
            const localChanges = { status_id: 3 }

            const conflict = detectConflict(1, expected, current, localChanges)
            expect(conflict).not.toBeNull()
            expect(conflict!.conflictFields).toContain('status_id')
        })

        it('no conflict when server changed different field', () => {
            const expected = makeIssue({ 
                status: { id: 1, name: 'New' },
                priority: { id: 1, name: 'Normal' }
            })
            const current = makeIssue({ 
                status: { id: 1, name: 'New' },
                priority: { id: 2, name: 'High' }
            })
            const localChanges = { status_id: 3 }

            const conflict = detectConflict(1, expected, current, localChanges)
            expect(conflict).toBeNull()
        })

        it('no conflict when local change matches server', () => {
            const expected = makeIssue({ status: { id: 1, name: 'New' } })
            const current = makeIssue({ status: { id: 3, name: 'Done' } })
            const localChanges = { status_id: 3 }

            const conflict = detectConflict(1, expected, current, localChanges)
            expect(conflict).toBeNull()
        })

        it('handles notes as non-conflicting (always additive)', () => {
            const expected = makeIssue()
            const current = makeIssue({ updated_on: '2024-01-02' })
            const localChanges = { notes: 'My comment' }

            const conflict = detectConflict(1, expected, current, localChanges)
            expect(conflict).toBeNull()
        })

        it('returns conflict info with correct structure', () => {
            const expected = makeIssue({ status: { id: 1, name: 'New' } })
            const current = makeIssue({ status: { id: 2, name: 'In Progress' } })
            const localChanges = { status_id: 3 }

            const conflict = detectConflict(1, expected, current, localChanges)
            expect(conflict).toEqual(expect.objectContaining({
                mutationId: 1,
                issueId: 1,
                subject: 'Test issue',
                localChanges,
                conflictFields: ['status_id'],
            }))
        })

        it('handles null expected state (assume all fields conflict)', () => {
            const current = makeIssue({ status: { id: 2, name: 'In Progress' } })
            const localChanges = { status_id: 3 }

            const conflict = detectConflict(1, null, current, localChanges)
            expect(conflict).not.toBeNull()
            expect(conflict!.conflictFields).toContain('status_id')
        })

        it('detects multiple field conflicts', () => {
            const expected = makeIssue({ 
                status: { id: 1, name: 'New' },
                priority: { id: 1, name: 'Normal' }
            })
            const current = makeIssue({ 
                status: { id: 2, name: 'In Progress' },
                priority: { id: 3, name: 'High' }
            })
            const localChanges = { status_id: 3, priority_id: 2 }

            const conflict = detectConflict(1, expected, current, localChanges)
            expect(conflict).not.toBeNull()
            expect(conflict!.conflictFields).toHaveLength(2)
            expect(conflict!.conflictFields).toContain('status_id')
            expect(conflict!.conflictFields).toContain('priority_id')
        })
    })

    describe('autoMerge', () => {
        it('returns non-conflicting changes for merge', () => {
            const conflict = {
                mutationId: 1,
                issueId: 1,
                subject: 'Test',
                localChanges: { status_id: 3, priority_id: 2 },
                serverVersion: makeIssue(),
                conflictFields: ['status_id'],
                timestamp: Date.now(),
            }

            const merged = autoMerge(conflict)
            expect(merged).toEqual({ priority_id: 2 })
        })

        it('returns null when all changes conflict', () => {
            const conflict = {
                mutationId: 1,
                issueId: 1,
                subject: 'Test',
                localChanges: { status_id: 3 },
                serverVersion: makeIssue(),
                conflictFields: ['status_id'],
                timestamp: Date.now(),
            }

            const merged = autoMerge(conflict)
            expect(merged).toBeNull()
        })

        it('includes notes as non-conflicting', () => {
            const conflict = {
                mutationId: 1,
                issueId: 1,
                subject: 'Test',
                localChanges: { status_id: 3, notes: 'My comment' },
                serverVersion: makeIssue(),
                conflictFields: ['status_id'],
                timestamp: Date.now(),
            }

            const merged = autoMerge(conflict)
            expect(merged).toEqual({ notes: 'My comment' })
        })
    })

    describe('describeConflict', () => {
        it('returns human-readable description', () => {
            const conflict = {
                mutationId: 1,
                issueId: 123,
                subject: 'Fix login bug',
                localChanges: {},
                serverVersion: makeIssue(),
                conflictFields: ['status_id', 'priority_id'],
                timestamp: Date.now(),
            }

            const desc = describeConflict(conflict)
            expect(desc).toContain('Fix login bug')
            expect(desc).toContain('Status')
            expect(desc).toContain('Priority')
        })
    })
})
