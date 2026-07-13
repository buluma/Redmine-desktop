import { useEffect, useCallback } from 'react'

export interface KeyboardShortcutHandlers {
    /** Navigate to next issue in list */
    onNextIssue: () => void
    /** Navigate to previous issue in list */
    onPrevIssue: () => void
    /** Select/focus the current issue */
    onSelectIssue: () => void
    /** Deselect / go back */
    onEscape: () => void
    /** Toggle search mode */
    onToggleSearch: () => void
    /** Refresh data */
    onRefresh: () => void
    /** Create new task */
    onNewTask: () => void
    /** Toggle settings */
    onToggleSettings: () => void
}

/**
 * Global keyboard shortcuts for the app.
 *
 * Shortcuts:
 *   ArrowDown / j     → next issue
 *   ArrowUp   / k     → previous issue
 *   Enter             → select focused issue
 *   Escape            → deselect / close
 *   Cmd/Ctrl+F        → focus search
 *   Cmd/Ctrl+R        → refresh
 *   Cmd/Ctrl+N        → new task
 *   Cmd/Ctrl+,        → settings
 */
export function useKeyboardShortcuts(handlers: KeyboardShortcutHandlers) {
    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        // Don't intercept when typing in an input/textarea
        const tag = (e.target as HTMLElement)?.tagName
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
            // Allow Escape to blur inputs
            if (e.key === 'Escape') {
                ;(e.target as HTMLElement).blur()
                e.preventDefault()
            }
            return
        }

        const isMeta = e.metaKey || e.ctrlKey

        switch (e.key) {
            case 'ArrowDown':
            case 'j':
                e.preventDefault()
                handlers.onNextIssue()
                break
            case 'ArrowUp':
            case 'k':
                e.preventDefault()
                handlers.onPrevIssue()
                break
            case 'Enter':
                e.preventDefault()
                handlers.onSelectIssue()
                break
            case 'Escape':
                e.preventDefault()
                handlers.onEscape()
                break
            case 'f':
                if (isMeta) {
                    e.preventDefault()
                    handlers.onToggleSearch()
                }
                break
            case 'r':
                if (isMeta) {
                    e.preventDefault()
                    handlers.onRefresh()
                }
                break
            case 'n':
                if (isMeta) {
                    e.preventDefault()
                    handlers.onNewTask()
                }
                break
            case ',':
                if (isMeta) {
                    e.preventDefault()
                    handlers.onToggleSettings()
                }
                break
        }
    }, [handlers])

    useEffect(() => {
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [handleKeyDown])
}
