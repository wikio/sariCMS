'use client';

import { useEffect, useState } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import {
  AlignCenter, AlignLeft, AlignRight, Bold, Code2, Heading1, Heading2, Heading3,
  ImagePlus, Italic, Link2, List, ListOrdered, Quote, Redo2, Table, Undo2,
} from 'lucide-react';
import GedPicker from '@/components/admin/GedPicker';
import { MERGE_VARS } from '@/lib/notify-store';

export default function HtmlEditor({
  value,
  onChange,
  placeholder = 'Rédigez le contenu…',
  readOnly = false,
  mergeVars = false,
}: {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  readOnly?: boolean;
  mergeVars?: boolean;
}) {
  const [code, setCode] = useState(false);
  const [ged, setGed] = useState(false);
  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({ openOnClick: false }),
      Placeholder.configure({ placeholder }),
    ],
    content: value || '',
    editable: !readOnly,
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
    if (value && value !== current && !editor.isFocused && !code) {
      editor.commands.setContent(value);
    }
  }, [value, editor, code]);

  if (!editor) return <div className="ad-input min-h-[220px]" />;

  const btn = (active: boolean) => `ad-btn ad-btn-icon ${active ? 'ad-btn-primary' : 'ad-btn-ghost'}`;

  return (
    <div className="overflow-hidden" style={{ border: '1px solid var(--ad-line)', background: 'var(--ad-surface-2)', borderRadius: 2 }}>
      {!readOnly && (
        <div className="flex flex-wrap gap-1 p-2 border-b" style={{ borderColor: 'var(--ad-line)' }}>
          <button type="button" className={btn(editor.isActive('bold'))} onClick={() => editor.chain().focus().toggleBold().run()}><Bold className="w-4 h-4" /></button>
          <button type="button" className={btn(editor.isActive('italic'))} onClick={() => editor.chain().focus().toggleItalic().run()}><Italic className="w-4 h-4" /></button>
          <button type="button" className={btn(editor.isActive('heading', { level: 1 }))} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}><Heading1 className="w-4 h-4" /></button>
          <button type="button" className={btn(editor.isActive('heading', { level: 2 }))} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}><Heading2 className="w-4 h-4" /></button>
          <button type="button" className={btn(editor.isActive('heading', { level: 3 }))} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}><Heading3 className="w-4 h-4" /></button>
          <button type="button" className={btn(editor.isActive('bulletList'))} onClick={() => editor.chain().focus().toggleBulletList().run()}><List className="w-4 h-4" /></button>
          <button type="button" className={btn(editor.isActive('orderedList'))} onClick={() => editor.chain().focus().toggleOrderedList().run()}><ListOrdered className="w-4 h-4" /></button>
          <button type="button" className={btn(editor.isActive('blockquote'))} onClick={() => editor.chain().focus().toggleBlockquote().run()}><Quote className="w-4 h-4" /></button>
          <button type="button" className="ad-btn ad-btn-icon ad-btn-ghost" title="Tableau" onClick={() => editor.chain().focus().insertContent('<table><tr><th>Col 1</th><th>Col 2</th></tr><tr><td>—</td><td>—</td></tr></table>').run()}><Table className="w-4 h-4" /></button>
          <button type="button" className="ad-btn ad-btn-icon ad-btn-ghost" onClick={() => {
            const url = window.prompt('URL du lien');
            if (url) editor.chain().focus().setLink({ href: url }).run();
          }}><Link2 className="w-4 h-4" /></button>
          <button type="button" className="ad-btn ad-btn-icon ad-btn-ghost" onClick={() => setGed(true)}><ImagePlus className="w-4 h-4" /></button>
          <button type="button" className="ad-btn ad-btn-icon ad-btn-ghost" onClick={() => editor.chain().focus().insertContent('<p style="text-align:left"></p>').run()}><AlignLeft className="w-4 h-4" /></button>
          <button type="button" className="ad-btn ad-btn-icon ad-btn-ghost" onClick={() => editor.chain().focus().insertContent('<p style="text-align:center"></p>').run()}><AlignCenter className="w-4 h-4" /></button>
          <button type="button" className="ad-btn ad-btn-icon ad-btn-ghost" onClick={() => editor.chain().focus().insertContent('<p style="text-align:right"></p>').run()}><AlignRight className="w-4 h-4" /></button>
          <input type="color" className="w-11 h-11 p-1" title="Couleur" onChange={(e) => editor.chain().focus().insertContent(`<span style="color:${e.target.value}">■</span>`).run()} />
          <button type="button" className="ad-btn ad-btn-icon ad-btn-ghost" onClick={() => editor.chain().focus().undo().run()}><Undo2 className="w-4 h-4" /></button>
          <button type="button" className="ad-btn ad-btn-icon ad-btn-ghost" onClick={() => editor.chain().focus().redo().run()}><Redo2 className="w-4 h-4" /></button>
          <button type="button" className={`ad-btn ${code ? 'ad-btn-primary' : 'ad-btn-ghost'}`} onClick={() => setCode((v) => !v)}>
            <Code2 className="w-4 h-4" /> {code ? 'Visuel' : 'Code'}
          </button>
          {mergeVars && (
            <select
              className="ad-select w-52"
              defaultValue=""
              onChange={(e) => {
                if (!e.target.value) return;
                editor.chain().focus().insertContent(e.target.value).run();
                e.target.value = '';
              }}
            >
              <option value="">Insérer une variable…</option>
              {MERGE_VARS.map((v) => <option key={v.key} value={v.key}>{v.label} · {v.key}</option>)}
            </select>
          )}
        </div>
      )}
      {code ? (
        <textarea className="ad-textarea min-h-[240px] font-mono text-sm" value={value} onChange={(e) => {
          onChange(e.target.value);
          editor.commands.setContent(e.target.value);
        }} />
      ) : (
        <EditorContent editor={editor} />
      )}
      {ged && (
        <GedPicker
          onClose={() => setGed(false)}
          onPick={(url) => {
            editor.chain().focus().insertContent(`<img src="${url}" alt="" />`).run();
            setGed(false);
          }}
        />
      )}
    </div>
  );
}
