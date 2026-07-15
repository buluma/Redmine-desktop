import React from 'react'

interface OfflineBannerProps {
    isOnline: boolean
    isProcessingQueue: boolean
    pendingCount: number
}

export const OfflineBanner: React.FC<OfflineBannerProps> = ({
    isOnline,
    isProcessingQueue,
    pendingCount,
}) => {
    // Don't show banner if online and no pending changes
    if (isOnline && pendingCount === 0 && !isProcessingQueue) {
        return null
    }

    let message = ''
    let bgColor = ''
    let icon = ''

    if (!isOnline) {
        message = `Offline${pendingCount > 0 ? ` — ${pendingCount} change${pendingCount > 1 ? 's' : ''} pending` : ''}`
        bgColor = 'rgba(234, 179, 8, 0.95)' // Yellow
        icon = '⚡'
    } else if (isProcessingQueue) {
        message = `Syncing ${pendingCount} change${pendingCount > 1 ? 's' : ''}...`
        bgColor = 'rgba(59, 130, 246, 0.95)' // Blue
        icon = '🔄'
    } else if (pendingCount > 0) {
        message = `${pendingCount} change${pendingCount > 1 ? 's' : ''} pending sync`
        bgColor = 'rgba(234, 179, 8, 0.95)' // Yellow
        icon = '⏳'
    } else {
        return null
    }

    return (
        <div
            style={{
                position: 'fixed',
                top: '38px', // Below title bar
                left: 0,
                right: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                padding: '8px 16px',
                background: bgColor,
                color: 'white',
                fontSize: '13px',
                fontWeight: 500,
                zIndex: 9998,
                animation: 'slideDown 0.3s ease-out',
            }}
        >
            <span>{icon}</span>
            <span>{message}</span>
            {isProcessingQueue && (
                <div
                    style={{
                        width: '16px',
                        height: '16px',
                        border: '2px solid rgba(255,255,255,0.3)',
                        borderTopColor: 'white',
                        borderRadius: '50%',
                        animation: 'spin 1s linear infinite',
                    }}
                />
            )}
        </div>
    )
}

export default OfflineBanner
