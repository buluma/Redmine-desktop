import React, { useState, useRef, useEffect } from 'react'
import { ConflictInfo, describeFieldValue } from '../services/ConflictResolver'

interface ConflictDialogProps {
    conflict: ConflictInfo
    onResolve: (resolution: 'local' | 'server' | 'merge', mergedData?: Record<string, unknown>) => void
    onDismiss: () => void
}

const DIALOG_TITLE_ID = 'conflict-dialog-title'

export const ConflictDialog: React.FC<ConflictDialogProps> = ({
    conflict,
    onResolve,
    onDismiss,
}) => {
    const [selectedResolution, setSelectedResolution] = useState<'local' | 'server' | 'merge'>('server')
    const [fieldOverrides, setFieldOverrides] = useState<Record<string, 'local' | 'server'>>({})
    const dialogRef = useRef<HTMLDivElement>(null)

    // Move focus into the dialog on mount, so keyboard/screen-reader users
    // land here instead of whatever was focused behind it.
    useEffect(() => {
        dialogRef.current?.focus()
    }, [])

    const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
        if (e.key === 'Escape') {
            e.preventDefault()
            onDismiss()
            return
        }
        if (e.key !== 'Tab' || !dialogRef.current) return

        const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
            'button, input, [tabindex]:not([tabindex="-1"])'
        )
        if (focusable.length === 0) return
        const first = focusable[0]
        const last = focusable[focusable.length - 1]

        if (e.shiftKey && document.activeElement === first) {
            e.preventDefault()
            last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault()
            first.focus()
        }
    }

    const handleFieldToggle = (field: string) => {
        setFieldOverrides(prev => ({
            ...prev,
            [field]: prev[field] === 'local' ? 'server' : 'local'
        }))
    }

    const handleResolve = () => {
        if (selectedResolution === 'merge') {
            // Build merged data based on field-level selections
            const mergedData: Record<string, unknown> = {}
            for (const field of conflict.conflictFields) {
                const choice = fieldOverrides[field] || 'server'
                if (choice === 'local') {
                    mergedData[field] = conflict.localChanges[field]
                }
                // Server value is already applied by default
            }
            onResolve('merge', mergedData)
        } else {
            onResolve(selectedResolution)
        }
    }

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
        }}>
            <div
                ref={dialogRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby={DIALOG_TITLE_ID}
                tabIndex={-1}
                onKeyDown={handleKeyDown}
                style={{
                    background: 'var(--bg-primary, #1e1e1e)',
                    borderRadius: '12px',
                    padding: '24px',
                    maxWidth: '500px',
                    width: '90%',
                    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
                }}>
                {/* Header */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    marginBottom: '20px',
                }}>
                    <span style={{ fontSize: '24px' }}>⚠️</span>
                    <div>
                        <h3 id={DIALOG_TITLE_ID} style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>
                            Sync Conflict
                        </h3>
                        <p style={{ margin: '4px 0 0', fontSize: '13px', opacity: 0.7 }}>
                            Issue #{conflict.issueId}
                        </p>
                    </div>
                </div>

                {/* Conflict Description */}
                <p style={{
                    fontSize: '14px',
                    lineHeight: '1.5',
                    marginBottom: '20px',
                    padding: '12px',
                    background: 'rgba(234, 179, 8, 0.1)',
                    borderRadius: '8px',
                    borderLeft: '3px solid rgba(234, 179, 8, 1)',
                }}>
                    Your offline changes conflict with changes made by another user.
                    Please choose how to resolve:
                </p>

                {/* Conflicting Fields */}
                <div style={{ marginBottom: '20px' }}>
                    <h4 style={{ margin: '0 0 12px', fontSize: '14px', fontWeight: 500 }}>
                        Conflicting Fields:
                    </h4>
                    {conflict.conflictFields.map(field => (
                        <div key={field} style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '10px 12px',
                            background: 'rgba(255, 255, 255, 0.05)',
                            borderRadius: '6px',
                            marginBottom: '8px',
                        }}>
                            <span style={{ fontSize: '13px', fontWeight: 500 }}>
                                {field.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                            </span>
                            <div style={{ display: 'flex', gap: '8px', fontSize: '12px' }}>
                                <span style={{ 
                                    padding: '4px 8px', 
                                    background: 'rgba(239, 68, 68, 0.2)',
                                    borderRadius: '4px',
                                }}>
                                    You: {describeFieldValue(field, conflict.localChanges[field])}
                                </span>
                                <span style={{ 
                                    padding: '4px 8px', 
                                    background: 'rgba(34, 197, 94, 0.2)',
                                    borderRadius: '4px',
                                }}>
                                    Server: {describeFieldValue(field, getServerValue(conflict, field))}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Resolution Options */}
                <div style={{ marginBottom: '20px' }}>
                    <h4 style={{ margin: '0 0 12px', fontSize: '14px', fontWeight: 500 }}>
                        Resolution:
                    </h4>
                    
                    <label style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        padding: '12px',
                        background: selectedResolution === 'local' ? 'rgba(59, 130, 246, 0.1)' : 'rgba(255, 255, 255, 0.05)',
                        borderRadius: '8px',
                        marginBottom: '8px',
                        cursor: 'pointer',
                        border: selectedResolution === 'local' ? '1px solid rgba(59, 130, 246, 0.5)' : '1px solid transparent',
                    }}>
                        <input
                            type="radio"
                            name="resolution"
                            value="local"
                            checked={selectedResolution === 'local'}
                            onChange={() => setSelectedResolution('local')}
                        />
                        <div>
                            <div style={{ fontWeight: 500, fontSize: '14px' }}>Keep My Changes</div>
                            <div style={{ fontSize: '12px', opacity: 0.7 }}>Overwrite server with your offline changes</div>
                        </div>
                    </label>

                    <label style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        padding: '12px',
                        background: selectedResolution === 'server' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(255, 255, 255, 0.05)',
                        borderRadius: '8px',
                        marginBottom: '8px',
                        cursor: 'pointer',
                        border: selectedResolution === 'server' ? '1px solid rgba(34, 197, 94, 0.5)' : '1px solid transparent',
                    }}>
                        <input
                            type="radio"
                            name="resolution"
                            value="server"
                            checked={selectedResolution === 'server'}
                            onChange={() => setSelectedResolution('server')}
                        />
                        <div>
                            <div style={{ fontWeight: 500, fontSize: '14px' }}>Use Server Version</div>
                            <div style={{ fontSize: '12px', opacity: 0.7 }}>Discard your changes, keep server version</div>
                        </div>
                    </label>

                    <label style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        padding: '12px',
                        background: selectedResolution === 'merge' ? 'rgba(168, 85, 247, 0.1)' : 'rgba(255, 255, 255, 0.05)',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        border: selectedResolution === 'merge' ? '1px solid rgba(168, 85, 247, 0.5)' : '1px solid transparent',
                    }}>
                        <input
                            type="radio"
                            name="resolution"
                            value="merge"
                            checked={selectedResolution === 'merge'}
                            onChange={() => setSelectedResolution('merge')}
                        />
                        <div>
                            <div style={{ fontWeight: 500, fontSize: '14px' }}>Merge Manually</div>
                            <div style={{ fontSize: '12px', opacity: 0.7 }}>Choose per-field which version to keep</div>
                        </div>
                    </label>
                </div>

                {/* Manual Merge Options */}
                {selectedResolution === 'merge' && (
                    <div style={{
                        marginBottom: '20px',
                        padding: '12px',
                        background: 'rgba(168, 85, 247, 0.1)',
                        borderRadius: '8px',
                    }}>
                        <h4 style={{ margin: '0 0 12px', fontSize: '13px', fontWeight: 500 }}>
                            Choose per field:
                        </h4>
                        {conflict.conflictFields.map(field => (
                            <div key={field} style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                padding: '8px',
                                marginBottom: '4px',
                            }}>
                                <span style={{ fontSize: '13px' }}>
                                    {field.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                                </span>
                                <div style={{ display: 'flex', gap: '4px' }}>
                                    <button
                                        onClick={() => setFieldOverrides(prev => ({ ...prev, [field]: 'local' }))}
                                        style={{
                                            padding: '4px 10px',
                                            fontSize: '12px',
                                            background: fieldOverrides[field] === 'local' ? 'rgba(239, 68, 68, 0.3)' : 'rgba(255, 255, 255, 0.1)',
                                            border: 'none',
                                            borderRadius: '4px',
                                            cursor: 'pointer',
                                            color: 'inherit',
                                        }}
                                    >
                                        Mine
                                    </button>
                                    <button
                                        onClick={() => setFieldOverrides(prev => ({ ...prev, [field]: 'server' }))}
                                        style={{
                                            padding: '4px 10px',
                                            fontSize: '12px',
                                            background: fieldOverrides[field] === 'server' || !fieldOverrides[field] ? 'rgba(34, 197, 94, 0.3)' : 'rgba(255, 255, 255, 0.1)',
                                            border: 'none',
                                            borderRadius: '4px',
                                            cursor: 'pointer',
                                            color: 'inherit',
                                        }}
                                    >
                                        Server
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Action Buttons */}
                <div style={{
                    display: 'flex',
                    justifyContent: 'flex-end',
                    gap: '10px',
                }}>
                    <button
                        onClick={onDismiss}
                        style={{
                            padding: '10px 16px',
                            background: 'rgba(255, 255, 255, 0.1)',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '14px',
                            color: 'inherit',
                        }}
                    >
                        Skip for Now
                    </button>
                    <button
                        onClick={handleResolve}
                        style={{
                            padding: '10px 20px',
                            background: 'rgba(59, 130, 246, 1)',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '14px',
                            fontWeight: 500,
                            color: 'white',
                        }}
                    >
                        Resolve Conflict
                    </button>
                </div>
            </div>
        </div>
    )
}

function getServerValue(conflict: ConflictInfo, field: string): string | number | undefined {
    const server = conflict.serverVersion
    switch (field) {
        case 'status_id': return server.status?.id
        case 'priority_id': return server.priority?.id
        case 'assigned_to_id': return server.assigned_to?.id
        case 'fixed_version_id': return server.fixed_version?.id
        default: return undefined
    }
}

export default ConflictDialog
