import React, { Component, ErrorInfo, ReactNode } from 'react'

interface Props {
    children: ReactNode
    fallback?: ReactNode
}

interface State {
    hasError: boolean
    error: Error | null
    errorInfo: ErrorInfo | null
}

export class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props)
        this.state = { hasError: false, error: null, errorInfo: null }
    }

    static getDerivedStateFromError(error: Error): Partial<State> {
        return { hasError: true, error }
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        this.setState({ errorInfo })
        console.error('[ErrorBoundary] Caught error:', error, errorInfo)
    }

    handleReset = () => {
        this.setState({ hasError: false, error: null, errorInfo: null })
    }

    handleReload = () => {
        window.location.reload()
    }

    render() {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback
            }

            return (
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: '100vh',
                    padding: 40,
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                    background: 'var(--bg-color, #1a1a1a)',
                    color: 'var(--text-primary, #fff)',
                }}>
                    <div style={{
                        fontSize: 48,
                        marginBottom: 16,
                    }}>
                        ⚠️
                    </div>
                    <h2 style={{
                        fontSize: 20,
                        fontWeight: 600,
                        marginBottom: 8,
                        color: '#ff453a',
                    }}>
                        Something went wrong
                    </h2>
                    <p style={{
                        fontSize: 14,
                        color: 'var(--text-secondary, #888)',
                        marginBottom: 24,
                        textAlign: 'center',
                        maxWidth: 400,
                    }}>
                        An unexpected error occurred. You can try reloading the app or report this issue.
                    </p>
                    {this.state.error && (
                        <details style={{
                            marginBottom: 24,
                            padding: 12,
                            background: 'rgba(255,255,255,0.05)',
                            borderRadius: 8,
                            maxWidth: 500,
                            width: '100%',
                        }}>
                            <summary style={{
                                cursor: 'pointer',
                                fontSize: 12,
                                color: 'var(--text-secondary, #888)',
                                marginBottom: 8,
                            }}>
                                Error details
                            </summary>
                            <pre style={{
                                fontSize: 11,
                                color: '#ff453a',
                                whiteSpace: 'pre-wrap',
                                wordBreak: 'break-word',
                                margin: 0,
                            }}>
                                {this.state.error.message}
                                {this.state.errorInfo?.componentStack && (
                                    <>
                                        {'\n\nComponent Stack:'}
                                        {this.state.errorInfo.componentStack}
                                    </>
                                )}
                            </pre>
                        </details>
                    )}
                    <div style={{ display: 'flex', gap: 12 }}>
                        <button
                            onClick={this.handleReset}
                            style={{
                                padding: '10px 20px',
                                background: 'var(--button-secondary, #333)',
                                color: 'var(--text-primary, #fff)',
                                border: 'none',
                                borderRadius: 8,
                                cursor: 'pointer',
                                fontSize: 13,
                            }}
                        >
                            Try Again
                        </button>
                        <button
                            onClick={this.handleReload}
                            style={{
                                padding: '10px 20px',
                                background: '#0c66ff',
                                color: '#fff',
                                border: 'none',
                                borderRadius: 8,
                                cursor: 'pointer',
                                fontSize: 13,
                            }}
                        >
                            Reload App
                        </button>
                    </div>
                </div>
            )
        }

        return this.props.children
    }
}

export default ErrorBoundary
