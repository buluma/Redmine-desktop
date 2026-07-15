/**
 * Debug-only logging. Routine progress/trace logs (issue counts, cache
 * migrations, queue activity, etc.) should use `log.debug` instead of
 * `console.log` directly, so they don't ship to the packaged app's console.
 * Real problems should still use `console.warn`/`console.error` directly --
 * those stay visible in production for user bug reports.
 */
export function createLogger(isDev: boolean) {
    return {
        debug: (...args: unknown[]) => {
            if (isDev) console.log(...args)
        },
    }
}

export const log = createLogger(import.meta.env.DEV)
