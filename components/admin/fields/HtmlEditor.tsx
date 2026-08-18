'use client';

import { useEffect } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import { Bold, Heading2, Italic, Link2, List, ListOrdered, Quote, Redo2, Undo2 } from 'lucide-react';

export default function HtmlEditor({
  value,
  onChange,
  placeholder = 'Rédigez le contenu…',
}: {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
}) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({ openOnClick: false }),
      Placeholder.configure({ placeholder }),
    ],
    content: value || '',
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: 'ad-tiptap min-h-[220px] outline-none px-3 py-2 prose prose-sm max-w-none',
      },
    },
    onUpdate: ({ editor: ed }) => onChange(ed.getHTML()),
  });

  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    if (value && value !== current && !editor.isFocused) {
      editor.commands.setContent(value);
    }
  }, [value, editor]);

  if (!editor) return <div className="ad-input min-h-[220px]" />;

  const btn = (active: boolean) =>
    `ad-btn ad-btn-icon ${active ? 'ad-btn-primary' : 'ad-btn-ghost'}`;

  return (
    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--ad-line)', background: 'var(--ad-surface-2)' }}>
      <div className="flex flex-wrap gap-1 p-2 border-b" style={{ borderColor: 'var(--ad-line)' }}>
        <button type="button" className={btn(editor.isActive('bold'))} onClick={() => editor.chain().focus().toggleBold().run()}><Bold className="w-4 h-4" /></button>
        <button type="button" className={btn(editor.isActive('italic'))} onClick={() => editor.chain().focus().toggleItalic().run()}><Italic className="w-4 h-4" /></button>
        <button type="button" className={btn(editor.isActive('heading', { level: 2 }))} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}><Heading2 className="w-4 h-4" /></button>
        <button type="button" className={btn(editor.isActive('bulletList'))} onClick={() => editor.chain().focus().toggleBulletList().run()}><List className="w-4 h-4" /></button>
        <button type="button" className={btn(editor.isActive('orderedList'))} onClick={() => editor.chain().focus().toggleOrderedList().run()}><ListOrdered className="w-4 h-4" /></button>
        <button type="button" className={btn(editor.isActive('blockquote'))} onClick={() => editor.chain().focus().toggleBlockquote().run()}><Quote className="w-4 h-4" /></button>
        <button type="button" className="ad-btn ad-btn-icon ad-btn-ghost" onClick={() => {
          const url = window.prompt('URL du lien');
          if (url) editor.chain().focus().setLink({ href: url }).run();
        }}><Link2 className="w-4 h-4" /></button>
        <button type="button" className="ad-btn ad-btn-icon ad-btn-ghost" onClick={() => editor.chain().focus().undo().run()}><Undo2 className="w-4 h-4" /></button>
        <button type="button" className="ad-btn ad-btn-icon ad-btn-ghost" onClick={() => editor.chain().focus().redo().run()}><Redo2 className="w-4 h-4" /></button>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
