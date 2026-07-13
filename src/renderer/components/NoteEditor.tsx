import React, { useState, useRef } from 'react'

interface NoteEditorProps {
    issueId: number
    onAddNote: (id: number, text: string) => Promise<void>
}

export const NoteEditor: React.FC<NoteEditorProps> = ({ issueId, onAddNote }) => {
    const [noteText, setNoteText] = useState('')
    const textareaRef = useRef<HTMLTextAreaElement>(null)

    const handleSend = async () => {
        if (noteText.trim()) {
            await onAddNote(issueId, noteText.trim())
            setNoteText('')
            if (textareaRef.current) {
                textareaRef.current.style.height = '36px'
                textareaRef.current.style.background = 'var(--input-bg)'
                textareaRef.current.blur()
            }
        }
    }

    return (
        <div className="note-editor-bar pane-footer" style={{ flexDirection: 'column', alignItems: 'stretch', justifyContent: 'flex-end' }}>
            <div style={{ position: 'relative', width: '100%' }}>
                <textarea
                    ref={textareaRef}
                    className="note-input"
                    value={noteText}
                    onChange={e => setNoteText(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && e.shiftKey) {
                            e.preventDefault()
                            handleSend()
                        } else if (e.key === 'Escape') {
                            e.currentTarget.blur()
                        }
                    }}
                    placeholder="Add a note... (Shift + Enter to send)"
                    style={{ width: '100%', height: 36, display: 'block', background: 'var(--input-bg)', border: 'none', borderRadius: 8, padding: '9px 50px 9px 15px', color: 'var(--text-primary)', resize: 'none', fontSize: 13, transition: 'all 0.2s', outline: 'none' }}
                    onFocus={e => {
                        (e.target as any).style.height = '100px'
                        ;(e.target as any).style.background = 'var(--editor-bg)'
                        ;(e.target as any).style.backdropFilter = 'blur(50px)'
                    }}
                    onBlur={e => {
                        if (!noteText) {
                            (e.target as any).style.height = '36px'
                        }
                        ;(e.target as any).style.background = 'var(--input-bg)'
                        ;(e.target as any).style.backdropFilter = 'none'
                    }}
                />
                <button
                    onClick={handleSend}
                    style={{ position: 'absolute', right: 8, bottom: 4, background: '#0c66ff', border: 'none', width: 28, height: 28, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', cursor: 'pointer', transition: 'all 0.12s' }}
                    onMouseDown={e => { (e.currentTarget as any).style.transform = 'scale(0.95)' }}
                    onMouseUp={e => { (e.currentTarget as any).style.transform = 'scale(1)' }}
                >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="22" y1="2" x2="11" y2="13"></line>
                        <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                    </svg>
                </button>
            </div>
        </div>
    )
}

export default NoteEditor
