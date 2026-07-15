import React, { useEffect, useState } from 'react'

export interface ToastMessage {
    id: string
    type: 'success' | 'error' | 'info'
    message: string
    duration?: number
}

interface ToastProps {
    message: ToastMessage
    onDismiss: (id: string) => void
}

const Toast: React.FC<ToastProps> = ({ message, onDismiss }) => {
    useEffect(() => {
        const timer = setTimeout(() => {
            onDismiss(message.id)
        }, message.duration || 3000)

        return () => clearTimeout(timer)
    }, [message, onDismiss])

    const bgColor = {
        success: 'rgba(34, 197, 94, 0.95)',
        error: 'rgba(239, 68, 68, 0.95)',
        info: 'rgba(59, 130, 246, 0.95)',
    }[message.type]

    const icon = {
        success: '✓',
        error: '✕',
        info: 'ℹ',
    }[message.type]

    return (
        <div
            style={{
                position: 'fixed',
                bottom: '20px',
                right: '20px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '12px 16px',
                background: bgColor,
                color: 'white',
                borderRadius: '8px',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
                zIndex: 9999,
                animation: 'slideIn 0.3s ease-out',
                maxWidth: '400px',
            }}
        >
            <span style={{ fontSize: '16px', fontWeight: 'bold' }}>{icon}</span>
            <span style={{ flex: 1 }}>{message.message}</span>
            <button
                onClick={() => onDismiss(message.id)}
                style={{
                    background: 'none',
                    border: 'none',
                    color: 'white',
                    cursor: 'pointer',
                    padding: '0 4px',
                    fontSize: '14px',
                    opacity: 0.8,
                }}
            >
                ✕
            </button>
        </div>
    )
}

// Toast Container and Manager
let toastIdCounter = 0
let addToastCallback: ((toast: ToastMessage) => void) | null = null

export const showToast = {
    success: (message: string, duration?: number) => {
        const toast: ToastMessage = {
            id: `toast-${++toastIdCounter}`,
            type: 'success',
            message,
            duration,
        }
        addToastCallback?.(toast)
    },
    error: (message: string, duration?: number) => {
        const toast: ToastMessage = {
            id: `toast-${++toastIdCounter}`,
            type: 'error',
            message,
            duration: duration || 5000, // Errors stay longer
        }
        addToastCallback?.(toast)
    },
    info: (message: string, duration?: number) => {
        const toast: ToastMessage = {
            id: `toast-${++toastIdCounter}`,
            type: 'info',
            message,
            duration,
        }
        addToastCallback?.(toast)
    },
}

export const ToastContainer: React.FC = () => {
    const [toasts, setToasts] = useState<ToastMessage[]>([])

    useEffect(() => {
        addToastCallback = (toast: ToastMessage) => {
            setToasts(prev => [...prev, toast])
        }
        return () => {
            addToastCallback = null
        }
    }, [])

    const handleDismiss = (id: string) => {
        setToasts(prev => prev.filter(t => t.id !== id))
    }

    return (
        <>
            {toasts.map(toast => (
                <Toast key={toast.id} message={toast} onDismiss={handleDismiss} />
            ))}
        </>
    )
}

export default Toast
