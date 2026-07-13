import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useKeyboardShortcuts, KeyboardShortcutHandlers } from './useKeyboardShortcuts'

function pressKey(key: string, opts: Partial<KeyboardEventInit> = {}) {
    window.dispatchEvent(new KeyboardEvent('keydown', { key, ...opts }))
}

describe('useKeyboardShortcuts', () => {
    let handlers: KeyboardShortcutHandlers

    beforeEach(() => {
        handlers = {
            onNextIssue: vi.fn(),
            onPrevIssue: vi.fn(),
            onSelectIssue: vi.fn(),
            onEscape: vi.fn(),
            onToggleSearch: vi.fn(),
            onRefresh: vi.fn(),
            onNewTask: vi.fn(),
            onToggleSettings: vi.fn(),
        }
    })

    it('calls onNextIssue on ArrowDown', () => {
        renderHook(() => useKeyboardShortcuts(handlers))
        pressKey('ArrowDown')
        expect(handlers.onNextIssue).toHaveBeenCalledOnce()
    })

    it('calls onPrevIssue on ArrowUp', () => {
        renderHook(() => useKeyboardShortcuts(handlers))
        pressKey('ArrowUp')
        expect(handlers.onPrevIssue).toHaveBeenCalledOnce()
    })

    it('calls onNextIssue on j', () => {
        renderHook(() => useKeyboardShortcuts(handlers))
        pressKey('j')
        expect(handlers.onNextIssue).toHaveBeenCalledOnce()
    })

    it('calls onPrevIssue on k', () => {
        renderHook(() => useKeyboardShortcuts(handlers))
        pressKey('k')
        expect(handlers.onPrevIssue).toHaveBeenCalledOnce()
    })

    it('calls onSelectIssue on Enter', () => {
        renderHook(() => useKeyboardShortcuts(handlers))
        pressKey('Enter')
        expect(handlers.onSelectIssue).toHaveBeenCalledOnce()
    })

    it('calls onEscape on Escape', () => {
        renderHook(() => useKeyboardShortcuts(handlers))
        pressKey('Escape')
        expect(handlers.onEscape).toHaveBeenCalledOnce()
    })

    it('calls onToggleSearch on Cmd+F', () => {
        renderHook(() => useKeyboardShortcuts(handlers))
        pressKey('f', { metaKey: true })
        expect(handlers.onToggleSearch).toHaveBeenCalledOnce()
    })

    it('calls onToggleSearch on Ctrl+F', () => {
        renderHook(() => useKeyboardShortcuts(handlers))
        pressKey('f', { ctrlKey: true })
        expect(handlers.onToggleSearch).toHaveBeenCalledOnce()
    })

    it('calls onRefresh on Cmd+R', () => {
        renderHook(() => useKeyboardShortcuts(handlers))
        pressKey('r', { metaKey: true })
        expect(handlers.onRefresh).toHaveBeenCalledOnce()
    })

    it('calls onNewTask on Cmd+N', () => {
        renderHook(() => useKeyboardShortcuts(handlers))
        pressKey('n', { metaKey: true })
        expect(handlers.onNewTask).toHaveBeenCalledOnce()
    })

    it('calls onToggleSettings on Cmd+,', () => {
        renderHook(() => useKeyboardShortcuts(handlers))
        pressKey(',', { metaKey: true })
        expect(handlers.onToggleSettings).toHaveBeenCalledOnce()
    })

    it('does not trigger shortcuts when event target is an input', () => {
        renderHook(() => useKeyboardShortcuts(handlers))
        const input = document.createElement('input')
        document.body.appendChild(input)

        // Dispatch event with target set to input element
        const event = new KeyboardEvent('keydown', { key: 'j', bubbles: true })
        Object.defineProperty(event, 'target', { value: input, writable: false })
        window.dispatchEvent(event)

        expect(handlers.onNextIssue).not.toHaveBeenCalled()
        document.body.removeChild(input)
    })

    it('does not trigger shortcuts when event target is a textarea', () => {
        renderHook(() => useKeyboardShortcuts(handlers))
        const textarea = document.createElement('textarea')
        document.body.appendChild(textarea)

        const event = new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true })
        Object.defineProperty(event, 'target', { value: textarea, writable: false })
        window.dispatchEvent(event)

        expect(handlers.onNextIssue).not.toHaveBeenCalled()
        document.body.removeChild(textarea)
    })

    it('Escape calls onEscape (blur handled by browser)', () => {
        renderHook(() => useKeyboardShortcuts(handlers))
        pressKey('Escape')
        expect(handlers.onEscape).toHaveBeenCalledOnce()
    })
})
