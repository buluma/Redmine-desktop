import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { ErrorBoundary } from './components/ErrorBoundary'
import { ToastContainer } from './components/Toast'
import { OfflineBanner } from './components/OfflineBanner'
import { ConflictDialog } from './components/ConflictDialog'
import { useOffline } from './hooks/useOffline'
import './index.css'

// Wrapper to provide offline context
function AppWithOffline() {
    // These would typically come from context or props
    // For now, we'll use placeholder values
    const service = null // Would be provided by App context
    const fetchIssueDetail = async (id: number) => {
        throw new Error('Not implemented - needs App context')
    }

    const offlineState = useOffline(service, fetchIssueDetail)

    // Adapt ConflictDialog's simpler callback to useOffline's typed callback
    const handleConflictResolve = (
        resolution: 'local' | 'server' | 'merge', 
        mergedData?: Record<string, unknown>
    ) => {
        if (offlineState.currentConflict) {
            offlineState.resolveConflict({
                mutationId: offlineState.currentConflict.mutationId,
                resolution,
                mergedData,
            })
        }
    }

    return (
        <>
            <OfflineBanner 
                isOnline={offlineState.isOnline}
                isProcessingQueue={offlineState.isProcessingQueue}
                pendingCount={offlineState.pendingCount}
            />
            <App />
            {offlineState.currentConflict && (
                <ConflictDialog
                    conflict={offlineState.currentConflict}
                    onResolve={handleConflictResolve}
                    onDismiss={offlineState.skipConflict}
                />
            )}
        </>
    )
}

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <ErrorBoundary>
            <AppWithOffline />
            <ToastContainer />
        </ErrorBoundary>
    </React.StrictMode>,
)
