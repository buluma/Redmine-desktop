import { useState, useCallback, useEffect, useRef } from 'react'
import { RedmineService } from '../services/RedmineService'
import { Issue } from '../models/redmine'

export interface SearchState {
    searchQuery: string
    searchMode: 'local' | 'remote'
    remoteSearchResults: Issue[]
    remoteSearchTotalCount: number
    isSearching: boolean
}

export interface SearchActions {
    setSearchQuery: (query: string) => void
    setSearchMode: (mode: 'local' | 'remote') => void
    performRemoteSearch: (service: RedmineService, query: string) => Promise<void>
}

export function useSearch(): SearchState & SearchActions {
    const [searchQuery, setSearchQuery] = useState('')
    const [searchMode, setSearchMode] = useState<'local' | 'remote'>('local')
    const [remoteSearchResults, setRemoteSearchResults] = useState<Issue[]>([])
    const [remoteSearchTotalCount, setRemoteSearchTotalCount] = useState(0)
    const [isSearching, setIsSearching] = useState(false)

    const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    const performRemoteSearch = useCallback(async (service: RedmineService, query: string) => {
        if (!query.trim()) {
            setRemoteSearchResults([])
            setRemoteSearchTotalCount(0)
            return
        }

        setIsSearching(true)
        try {
            const { issues, total_count } = await service.searchIssues(query.trim(), { limit: 50 })
            setRemoteSearchResults(issues)
            setRemoteSearchTotalCount(total_count)
        } catch (e: any) {
            console.error('Remote search failed:', e)
            setRemoteSearchResults([])
            setRemoteSearchTotalCount(0)
        } finally {
            setIsSearching(false)
        }
    }, [])

    // Debounced remote search
    useEffect(() => {
        if (searchMode !== 'remote') {
            setRemoteSearchResults([])
            setRemoteSearchTotalCount(0)
            return
        }

        if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current)

        if (!searchQuery.trim()) {
            setRemoteSearchResults([])
            setRemoteSearchTotalCount(0)
            setIsSearching(false)
            return
        }

        searchTimeoutRef.current = setTimeout(() => {
            // We need to call performRemoteSearch, but we don't have service here
            // The parent (useAppViewModel) will handle this via effect
        }, 500)

        return () => {
            if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current)
        }
    }, [searchQuery, searchMode])

    return {
        searchQuery,
        searchMode,
        remoteSearchResults,
        remoteSearchTotalCount,
        isSearching,
        setSearchQuery,
        setSearchMode,
        performRemoteSearch,
    }
}
