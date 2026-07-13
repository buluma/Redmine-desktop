import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'
import { ErrorBoundary } from './ErrorBoundary'

// Component that throws on render
const ThrowingComponent = ({ shouldThrow = true }: { shouldThrow?: boolean }) => {
    if (shouldThrow) {
        throw new Error('Test error')
    }
    return <div>Child rendered</div>
}

// Suppress console.error for expected errors
const originalError = console.error
beforeEach(() => {
    console.error = vi.fn()
})
afterEach(() => {
    console.error = originalError
})

describe('ErrorBoundary', () => {
    it('renders children when no error', () => {
        render(
            <ErrorBoundary>
                <div>Test content</div>
            </ErrorBoundary>
        )
        expect(screen.getByText('Test content')).toBeInTheDocument()
    })

    it('renders fallback UI when child throws', () => {
        render(
            <ErrorBoundary>
                <ThrowingComponent />
            </ErrorBoundary>
        )
        expect(screen.getByText('Something went wrong')).toBeInTheDocument()
        expect(screen.getByText('Try Again')).toBeInTheDocument()
        expect(screen.getByText('Reload App')).toBeInTheDocument()
    })

    it('shows error details in collapsible section', () => {
        render(
            <ErrorBoundary>
                <ThrowingComponent />
            </ErrorBoundary>
        )
        const details = screen.getByText('Error details')
        expect(details).toBeInTheDocument()
    })

    it('renders custom fallback when provided', () => {
        render(
            <ErrorBoundary fallback={<div>Custom fallback</div>}>
                <ThrowingComponent />
            </ErrorBoundary>
        )
        expect(screen.getByText('Custom fallback')).toBeInTheDocument()
        expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument()
    })

    it('Try Again button resets error state', () => {
        const { rerender } = render(
            <ErrorBoundary>
                <ThrowingComponent shouldThrow={true} />
            </ErrorBoundary>
        )
        expect(screen.getByText('Something went wrong')).toBeInTheDocument()

        // Click Try Again
        const tryAgainButton = screen.getByText('Try Again')
        tryAgainButton.click()

        // Re-render with non-throwing component
        rerender(
            <ErrorBoundary>
                <ThrowingComponent shouldThrow={false} />
            </ErrorBoundary>
        )
        expect(screen.getByText('Child rendered')).toBeInTheDocument()
    })
})
