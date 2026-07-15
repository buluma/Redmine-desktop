import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ConflictDialog } from './ConflictDialog'
import { ConflictInfo } from '../services/ConflictResolver'
import { Issue } from '../models/redmine'

function makeConflict(overrides: Partial<ConflictInfo> = {}): ConflictInfo {
    const serverVersion: Issue = {
        id: 1,
        subject: 'Test issue',
        tracker: { id: 1, name: 'Bug' },
        status: { id: 2, name: 'In Progress' },
        priority: { id: 1, name: 'Normal' },
        author: { id: 1, name: 'Author' },
        done_ratio: 0,
        is_private: false,
        created_on: '2024-01-01',
        updated_on: '2024-01-02',
    }
    return {
        mutationId: 1,
        issueId: 1,
        subject: 'Test issue',
        localChanges: { status_id: 3 },
        serverVersion,
        conflictFields: ['status_id'],
        timestamp: Date.now(),
        ...overrides,
    }
}

describe('ConflictDialog', () => {
    it('renders as an accessible modal dialog', () => {
        render(<ConflictDialog conflict={makeConflict()} onResolve={vi.fn()} onDismiss={vi.fn()} />)
        const dialog = screen.getByRole('dialog')
        expect(dialog.getAttribute('aria-modal')).toBe('true')
        expect(dialog.getAttribute('aria-labelledby')).toBeTruthy()
    })

    it('moves focus inside the dialog on mount', () => {
        render(<ConflictDialog conflict={makeConflict()} onResolve={vi.fn()} onDismiss={vi.fn()} />)
        const dialog = screen.getByRole('dialog')
        expect(dialog.contains(document.activeElement)).toBe(true)
    })

    it('calls onDismiss when Escape is pressed', () => {
        const onDismiss = vi.fn()
        render(<ConflictDialog conflict={makeConflict()} onResolve={vi.fn()} onDismiss={onDismiss} />)
        fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
        expect(onDismiss).toHaveBeenCalledTimes(1)
    })

    it('traps Tab focus within the dialog (wraps from last to first)', () => {
        render(<ConflictDialog conflict={makeConflict()} onResolve={vi.fn()} onDismiss={vi.fn()} />)
        const dialog = screen.getByRole('dialog')
        const focusable = dialog.querySelectorAll<HTMLElement>('button, input, [tabindex]:not([tabindex="-1"])')
        const first = focusable[0]
        const last = focusable[focusable.length - 1]

        last.focus()
        fireEvent.keyDown(dialog, { key: 'Tab' })
        expect(document.activeElement).toBe(first)
    })

    it('traps Shift+Tab focus within the dialog (wraps from first to last)', () => {
        render(<ConflictDialog conflict={makeConflict()} onResolve={vi.fn()} onDismiss={vi.fn()} />)
        const dialog = screen.getByRole('dialog')
        const focusable = dialog.querySelectorAll<HTMLElement>('button, input, [tabindex]:not([tabindex="-1"])')
        const first = focusable[0]
        const last = focusable[focusable.length - 1]

        first.focus()
        fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true })
        expect(document.activeElement).toBe(last)
    })
})
