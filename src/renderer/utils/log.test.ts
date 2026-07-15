import { describe, it, expect, vi, afterEach } from 'vitest'
import { createLogger } from './log'

describe('createLogger', () => {
    afterEach(() => {
        vi.restoreAllMocks()
    })

    it('logs to console when isDev is true', () => {
        const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
        const log = createLogger(true)

        log.debug('hello', 42)

        expect(logSpy).toHaveBeenCalledWith('hello', 42)
    })

    it('does not log to console when isDev is false', () => {
        const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
        const log = createLogger(false)

        log.debug('hello', 42)

        expect(logSpy).not.toHaveBeenCalled()
    })
})
