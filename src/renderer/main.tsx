import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { ErrorBoundary } from './components/ErrorBoundary'
import { ToastContainer } from './components/Toast'
import { OfflineBanner } from './components/OfflineBanner'
import { ConflictDialog } from './components/ConflictDialog'
import { useOffline } from './hooks/useOffline'
import { RedmineService } from './services/RedmineService'
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
                    onResolve={offlineState.resolveConflict}
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
