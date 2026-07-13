import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import OfflineBanner from './OfflineBanner'

describe('OfflineBanner', () => {
    it('renders nothing when online with no pending changes', () => {
        const { container } = render(
            <OfflineBanner
                isOnline={true}
                isProcessingQueue={false}
                pendingCount={0}
            />
        )
        expect(container.innerHTML).toBe('')
    })

    it('shows offline message when offline', () => {
        render(
            <OfflineBanner
                isOnline={false}
                isProcessingQueue={false}
                pendingCount={0}
            />
        )
        expect(screen.getByText(/Offline/)).toBeDefined()
    })

    it('shows pending count when offline with pending changes', () => {
        render(
            <OfflineBanner
                isOnline={false}
                isProcessingQueue={false}
                pendingCount={3}
            />
        )
        expect(screen.getByText(/Offline/)).toBeDefined()
        expect(screen.getByText(/3 changes pending/)).toBeDefined()
    })

    it('shows syncing message when processing queue', () => {
        render(
            <OfflineBanner
                isOnline={true}
                isProcessingQueue={true}
                pendingCount={2}
            />
        )
        expect(screen.getByText(/Syncing 2 changes/)).toBeDefined()
    })

    it('shows pending message when online with pending changes', () => {
        render(
            <OfflineBanner
                isOnline={true}
                isProcessingQueue={false}
                pendingCount={5}
            />
        )
        expect(screen.getByText(/5 changes pending sync/)).toBeDefined()
    })

    it('uses singular form for one change', () => {
        render(
            <OfflineBanner
                isOnline={false}
                isProcessingQueue={false}
                pendingCount={1}
            />
        )
        expect(screen.getByText(/1 change pending/)).toBeDefined()
    })
})
