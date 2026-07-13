import React, { useEffect, useRef } from 'react';
import Editor from '@toast-ui/editor';
import '@toast-ui/editor/dist/toastui-editor.css';
import '@toast-ui/editor/dist/theme/toastui-editor-dark.css';

interface RichEditorProps {
    initialValue: string;
    onChange: (value: string) => void;
    onSave: () => void;
    onCancel: () => void;
    onUpload: (file: File) => Promise<{ token: string } | null>;
}

export const RichEditor: React.FC<RichEditorProps> = ({ initialValue, onChange, onSave, onCancel, onUpload }) => {
    const editorRef = useRef<HTMLDivElement>(null);
    const editorInstance = useRef<Editor | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (editorRef.current) {
            editorInstance.current = new Editor({
                el: editorRef.current,
                height: '400px',
                initialEditType: 'wysiwyg',
                previewStyle: 'vertical',
                initialValue: initialValue,
                theme: 'dark',
                toolbarItems: [
                    ['heading', 'bold', 'italic', 'strike'],
                    ['hr', 'quote'],
                    ['ul', 'ol', 'task', 'indent', 'outdent'],
                    ['table', 'image', 'link'],
                    ['code', 'codeblock'],
                ],
                hooks: {
                    addImageBlobHook: async (blob: Blob | File, callback) => {
                        const file = blob as File;
                        const result = await onUpload(file);
                        if (result) {
                            const reader = new FileReader();
                            reader.onload = (e) => {
                                callback(e.target?.result as string, file.name);
                            };
                            reader.readAsDataURL(blob);
                        }
                    }
                }
            });

            editorInstance.current.on('change', () => {
                onChange(editorInstance.current!.getMarkdown());
            });
        }

        return () => {
            if (editorInstance.current) {
                editorInstance.current.destroy();
            }
        };
    }, []);

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const result = await onUpload(file);
            if (result) {
                if (file.type.startsWith('image/')) {
                    const url = URL.createObjectURL(file);
                    editorInstance.current?.exec('addImage', {
                        altText: file.name,
                        imageUrl: url
                    });
                }
                // Non-image files are just uploaded and will appear in the Attachments list
            }
        }
    };

    return (
        <div className="rich-editor-container" style={{ background: '#1a1a1a', borderRadius: 8, overflow: 'hidden', border: '1px solid #333' }}>
            <div ref={editorRef} />
            <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                style={{ display: 'none' }}
            />
            <div style={{ display: 'flex', gap: 10, padding: '8px 15px', alignItems: 'center', background: '#222', borderTop: '1px solid #333' }}>
                <button
                    onClick={() => fileInputRef.current?.click()}
                    style={{ background: '#333', border: 'none', color: '#ccc', padding: '5px 10px', borderRadius: 4, cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', gap: 5 }}
                >📎 Upload Attachment</button>
                <div style={{ flex: 1 }} />
                <button
                    onClick={onSave}
                    style={{ background: '#0c66ff', border: 'none', color: 'white', padding: '6px 15px', borderRadius: 4, cursor: 'pointer', fontSize: 13, fontWeight: 500 }}
                >Save</button>
                <button
                    onClick={onCancel}
                    style={{ background: '#333', border: 'none', color: '#888', padding: '6px 15px', borderRadius: 4, cursor: 'pointer', fontSize: 13 }}
                >Cancel</button>
            </div>
            <style>{`
                .toastui-editor-defaultUI {
                    border: none !important;
                }
                .toastui-editor-toolbar {
                    background-color: #222 !important;
                    border-bottom: 1px solid #333 !important;
                }
                .toastui-editor-main {
                    background-color: #111 !important;
                }
                .toastui-editor-contents {
                    color: #ccc !important;
                }
                .toastui-editor-ww-container {
                    background-color: #111 !important;
                }
                .toastui-editor-contents p, .toastui-editor-contents h1, .toastui-editor-contents h2, .toastui-editor-contents h3 {
                    color: #fff !important;
                }
            `}</style>
        </div>
    );
};
