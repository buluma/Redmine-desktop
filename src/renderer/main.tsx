import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { ErrorBoundary } from './components/ErrorBoundary'
import { ToastContainer } from './components/Toast'
import { OfflineBanner } from './components/OfflineBanner'
import { useOffline } from './hooks/useOffline'
import './index.css'

// Wrapper to provide offline context
function AppWithOffline() {
    const offlineState = useOffline()
    return (
        <>
            <OfflineBanner {...offlineState} />
            <App />
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
