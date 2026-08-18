// components/admin/InlineEditor.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { Pencil, Bold, Italic, Underline, List, ListOrdered } from 'lucide-react';

interface InlineEditorProps {
  value: string;
  onChange: (value: string) => void;
  type?: 'text' | 'textarea' | 'html' | 'number';
  placeholder?: string;
  className?: string;
}

export default function InlineEditor({
  value,
  onChange,
  type = 'text',
  placeholder = 'Cliquez pour éditer',
  className = ''
}: InlineEditorProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | HTMLDivElement>(null);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [editing]);

  const handleSave = () => {
    setEditing(false);
    if (draft !== value) {
      onChange(draft);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && type !== 'textarea' && type !== 'html') {
      e.preventDefault();
      handleSave();
    }
    if (e.key === 'Escape') {
      setDraft(value);
      setEditing(false);
    }
  };

  // Mode édition
  if (editing) {
    if (type === 'textarea') {
      return (
        <textarea
          ref={inputRef as React.RefObject<HTMLTextAreaElement>}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
          rows={4}
          className={`w-full px-3 py-2 border-2 border-sari-blue rounded-lg bg-white dark:bg-[#111111] dark:text-white outline-none resize-none ${className}`}
        />
      );
    }

    if (type === 'html') {
      return (
        <div className="border-2 border-sari-blue rounded-lg p-4 bg-white dark:bg-[#111111]">
          <div className="flex gap-1 mb-2 pb-2 border-b border-gray-200 dark:border-gray-700">
            <button type="button" onMouseDown={(e) => { e.preventDefault(); document.execCommand('bold'); }} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded">
              <Bold className="w-4 h-4" />
            </button>
            <button type="button" onMouseDown={(e) => { e.preventDefault(); document.execCommand('italic'); }} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded">
              <Italic className="w-4 h-4" />
            </button>
            <button type="button" onMouseDown={(e) => { e.preventDefault(); document.execCommand('underline'); }} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded">
              <Underline className="w-4 h-4" />
            </button>
            <div className="w-px bg-gray-300 dark:bg-gray-700 mx-1" />
            <button type="button" onMouseDown={(e) => { e.preventDefault(); document.execCommand('insertUnorderedList'); }} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded">
              <List className="w-4 h-4" />
            </button>
            <button type="button" onMouseDown={(e) => { e.preventDefault(); document.execCommand('insertOrderedList'); }} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded">
              <ListOrdered className="w-4 h-4" />
            </button>
          </div>
          <div
            ref={inputRef as React.RefObject<HTMLDivElement>}
            contentEditable
            suppressContentEditableWarning
            dangerouslySetInnerHTML={{ __html: draft }}
            onBlur={(e) => {
              setDraft((e.target as HTMLDivElement).innerHTML);
              handleSave();
            }}
            className="prose dark:prose-invert min-h-[100px] outline-none"
          />
        </div>
      );
    }

    return (
      <input
        ref={inputRef as React.RefObject<HTMLInputElement>}
        type={type === 'number' ? 'number' : 'text'}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={handleSave}
        onKeyDown={handleKeyDown}
        className={`w-full px-3 py-2 border-2 border-sari-blue rounded-lg bg-white dark:bg-[#111111] dark:text-white outline-none ${className}`}
      />
    );
  }

  // Mode affichage
  return (
    <div
      onClick={() => { setDraft(value); setEditing(true); }}
      className={`cursor-pointer hover:outline hover:outline-2 hover:outline-sari-blue/50 hover:outline-offset-2 rounded transition-all group relative min-h-[24px] ${className}`}
      title="Cliquer pour éditer"
    >
      {type === 'html' ? (
        <div
          dangerouslySetInnerHTML={{
            __html: value || `<span class="text-gray-400 italic">${placeholder}</span>`
          }}
          className="prose dark:prose-invert"
        />
      ) : (
        <span className={value ? '' : 'text-gray-400 italic'}>
          {value || placeholder}
        </span>
      )}
      <Pencil className="w-3 h-3 text-sari-blue absolute -top-1 -right-1 opacity-0 group-hover:opacity-100 transition-opacity bg-white dark:bg-[#1a1a1a] rounded-full p-0.5 shadow" />
    </div>
  );
}