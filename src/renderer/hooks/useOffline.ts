import { useState, useEffect, useCallback, useRef } from 'react'
import * as OfflineQueue from '../services/OfflineQueue'
import { showToast } from '../components/Toast'

interface UseOfflineReturn {
    isOnline: boolean
    isProcessingQueue: boolean
    pendingCount: number
    refreshPendingCount: () => Promise<void>
}

export function useOffline(
    processMutation?: (mutation: any) => Promise<void>
): UseOfflineReturn {
    const [isOnline, setIsOnline] = useState(navigator.onLine)
    const [isProcessingQueue, setIsProcessingQueue] = useState(false)
    const [pendingCount, setPendingCount] = useState(0)
    const processMutationRef = useRef(processMutation)
    const hasShownOfflineToast = useRef(false)

    // Keep ref in sync
    useEffect(() => {
        processMutationRef.current = processMutation
    }, [processMutation])

    // Refresh pending count
    const refreshPendingCount = useCallback(async () => {
        try {
            const count = await OfflineQueue.getPendingCount()
            setPendingCount(count)
        } catch (e) {
            console.warn('[useOffline] Failed to get pending count:', e)
        }
    }, [])

    // Process queue when back online
    const processQueue = useCallback(async () => {
        if (!processMutationRef.current) return
        
        setIsProcessingQueue(true)
        try {
            // Clear stale mutations first
            await OfflineQueue.clearStaleMutations()
            
            const result = await OfflineQueue.processQueue(processMutationRef.current)
            
            if (result.succeeded > 0) {
                showToast.success(`Synced ${result.succeeded} offline change${result.succeeded > 1 ? 's' : ''}`)
            }
            
            if (result.failed > 0 && result.remaining === 0) {
                showToast.error(`Failed to sync ${result.failed} change${result.failed > 1 ? 's' : ''}`)
            }
            
            await refreshPendingCount()
        } catch (e: any) {
            console.error('[useOffline] Failed to process queue:', e)
            showToast.error('Failed to sync offline changes')
        } finally {
            setIsProcessingQueue(false)
        }
    }, [refreshPendingCount])

    // Handle online/offline events
    useEffect(() => {
        const handleOnline = () => {
            setIsOnline(true)
            hasShownOfflineToast.current = false
            showToast.success('Back online')
            
            // Process queue after a short delay
            setTimeout(() => {
                processQueue()
            }, 1000)
        }

        const handleOffline = () => {
            setIsOnline(false)
            if (!hasShownOfflineToast.current) {
                showToast.info('You are offline. Changes will be synced later.')
                hasShownOfflineToast.current = true
            }
        }

        window.addEventListener('online', handleOnline)
        window.addEventListener('offline', handleOffline)

        // Initial count
        refreshPendingCount()

        return () => {
            window.removeEventListener('online', handleOnline)
            window.removeEventListener('offline', handleOffline)
        }
    }, [processQueue, refreshPendingCount])

    // Poll pending count periodically when online
    useEffect(() => {
        if (!isOnline) return

        const interval = setInterval(refreshPendingCount, 30000) // Every 30 seconds
        return () => clearInterval(interval)
    }, [isOnline, refreshPendingCount])

    return {
        isOnline,
        isProcessingQueue,
        pendingCount,
        refreshPendingCount,
    }
}
