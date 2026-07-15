import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import Toast, { showToast, ToastContainer } from './Toast'

describe('Toast', () => {
    beforeEach(() => {
        vi.useFakeTimers()
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it('renders success toast with message', () => {
        const onDismiss = vi.fn()
        render(
            <Toast
                message={{ id: '1', type: 'success', message: 'Operation completed' }}
                onDismiss={onDismiss}
            />
        )

        expect(screen.getByText('Operation completed')).toBeDefined()
        expect(screen.getByText('✓')).toBeDefined()
    })

    it('renders error toast with message', () => {
        const onDismiss = vi.fn()
        render(
            <Toast
                message={{ id: '1', type: 'error', message: 'Something went wrong' }}
                onDismiss={onDismiss}
            />
        )

        expect(screen.getByText('Something went wrong')).toBeDefined()
        // Error toasts have ✕ icon and dismiss button, so use getAllByText
        expect(screen.getAllByText('✕').length).toBe(2)
    })

    it('renders info toast with message', () => {
        const onDismiss = vi.fn()
        render(
            <Toast
                message={{ id: '1', type: 'info', message: 'For your information' }}
                onDismiss={onDismiss}
            />
        )

        expect(screen.getByText('For your information')).toBeDefined()
        expect(screen.getByText('ℹ')).toBeDefined()
    })

    it('auto-dismisses after duration', () => {
        const onDismiss = vi.fn()
        render(
            <Toast
                message={{ id: '1', type: 'success', message: 'Test', duration: 3000 }}
                onDismiss={onDismiss}
            />
        )

        act(() => {
            vi.advanceTimersByTime(3000)
        })

        expect(onDismiss).toHaveBeenCalledWith('1')
    })

    it('dismisses on button click', () => {
        const onDismiss = vi.fn()
        render(
            <Toast
                message={{ id: '1', type: 'success', message: 'Test' }}
                onDismiss={onDismiss}
            />
        )

        // Find the dismiss button (the one with ✕ text that's not the type icon)
        const buttons = screen.getAllByText('✕')
        const dismissButton = buttons[buttons.length - 1] // Last one is the button
        fireEvent.click(dismissButton)

        expect(onDismiss).toHaveBeenCalledWith('1')
    })
})

describe('showToast', () => {
    it('has success, error, and info methods', () => {
        expect(typeof showToast.success).toBe('function')
        expect(typeof showToast.error).toBe('function')
        expect(typeof showToast.info).toBe('function')
    })
})

describe('ToastContainer', () => {
    beforeEach(() => {
        vi.useFakeTimers()
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it('renders without toasts', () => {
        const { container } = render(<ToastContainer />)
        // Should render nothing initially
        expect(container.innerHTML).toBe('')
    })
})
