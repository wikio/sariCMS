// components/admin/AdminHtmlEditor.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Undo, Redo, Bold, Italic, Underline, Strikethrough,
  List, ListOrdered, AlignLeft, AlignCenter, AlignRight, AlignJustify,
  Link, Image, Table, Quote, Eraser, Edit, Code
} from 'lucide-react';

interface AdminHtmlEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
}

export default function AdminHtmlEditor({
  value,
  onChange,
  placeholder = 'Contenu HTML...'
}: AdminHtmlEditorProps) {
  const [mode, setMode] = useState<'wysiwyg' | 'code'>('wysiwyg');
  const [html, setHtml] = useState(value || '');
  const editorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setHtml(value || '');
  }, [value]);

  const execCommand = (command: string, cmdValue: string | null = null) => {
    document.execCommand(command, false, cmdValue);
    if (editorRef.current) {
      editorRef.current.focus();
      const newHtml = editorRef.current.innerHTML;
      setHtml(newHtml);
      if (onChange) onChange(newHtml);
    }
  };

  const handleInput = () => {
    if (editorRef.current && mode === 'wysiwyg') {
      const newHtml = editorRef.current.innerHTML;
      setHtml(newHtml);
      if (onChange) onChange(newHtml);
    }
  };

  const handleCodeChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newHtml = e.target.value;
    setHtml(newHtml);
    if (onChange) onChange(newHtml);
  };

  const insertLink = () => {
    const url = prompt('URL du lien :', 'https://');
    if (url) execCommand('createLink', url);
  };

  const insertImage = () => {
    const url = prompt("URL de l'image :", 'https://');
    if (url) execCommand('insertImage', url);
  };

  const insertTable = () => {
    const rows = prompt('Nombre de lignes :', '3');
    const cols = prompt('Nombre de colonnes :', '3');
    if (rows && cols) {
      let table = '<table style="border-collapse: collapse; width: 100%; margin: 1rem 0;">';
      for (let i = 0; i < parseInt(rows); i++) {
        table += '<tr>';
        for (let j = 0; j < parseInt(cols); j++) {
          const tag = i === 0 ? 'th' : 'td';
          table += `<${tag} style="border: 1px solid #ddd; padding: 8px;">${i === 0 ? 'En-tête' : 'Cellule'}</${tag}>`;
        }
        table += '</tr>';
      }
      table += '</table>';
      execCommand('insertHTML', table);
    }
  };

  const insertBlockquote = () => execCommand('formatBlock', 'blockquote');

  interface ToolbarButton {
    icon?: React.ElementType;
    label?: string;
    cmd: string | (() => void);
    title: string;
  }

  interface ToolbarGroup {
    buttons: ToolbarButton[];
  }

  const toolbarGroups: ToolbarGroup[] = [
    {
      buttons: [
        { icon: Undo, cmd: 'undo', title: 'Annuler' },
        { icon: Redo, cmd: 'redo', title: 'Rétablir' },
      ]
    },
    {
      buttons: [
        { icon: Bold, cmd: 'bold', title: 'Gras (Ctrl+B)' },
        { icon: Italic, cmd: 'italic', title: 'Italique (Ctrl+I)' },
        { icon: Underline, cmd: 'underline', title: 'Souligné (Ctrl+U)' },
        { icon: Strikethrough, cmd: 'strikeThrough', title: 'Barré' },
      ]
    },
    {
      buttons: [
        { label: 'H1', cmd: () => execCommand('formatBlock', 'h1'), title: 'Titre 1' },
        { label: 'H2', cmd: () => execCommand('formatBlock', 'h2'), title: 'Titre 2' },
        { label: 'H3', cmd: () => execCommand('formatBlock', 'h3'), title: 'Titre 3' },
        { label: 'P', cmd: () => execCommand('formatBlock', 'p'), title: 'Paragraphe' },
      ]
    },
    {
      buttons: [
        { icon: List, cmd: 'insertUnorderedList', title: 'Liste à puces' },
        { icon: ListOrdered, cmd: 'insertOrderedList', title: 'Liste numérotée' },
      ]
    },
    {
      buttons: [
        { icon: AlignLeft, cmd: 'justifyLeft', title: 'Aligner à gauche' },
        { icon: AlignCenter, cmd: 'justifyCenter', title: 'Centrer' },
        { icon: AlignRight, cmd: 'justifyRight', title: 'Aligner à droite' },
        { icon: AlignJustify, cmd: 'justifyFull', title: 'Justifier' },
      ]
    },
    {
      buttons: [
        { icon: Link, cmd: insertLink, title: 'Insérer un lien' },
        { icon: Image, cmd: insertImage, title: 'Insérer une image' },
        { icon: Table, cmd: insertTable, title: 'Insérer un tableau' },
        { icon: Quote, cmd: insertBlockquote, title: 'Citation' },
      ]
    },
    {
      buttons: [
        { icon: Eraser, cmd: 'removeFormat', title: 'Supprimer le formatage' },
      ]
    },
  ];

  return (
    <div className="border border-gray-300 dark:border-gray-700 rounded-lg overflow-hidden bg-white dark:bg-[#1a1a1a]">
      {/* Mode Switcher */}
      <div className="flex items-center justify-between px-3 py-2 bg-gray-100 dark:bg-gray-800 border-b border-gray-300 dark:border-gray-700">
        <div className="flex gap-1">
          <button
            onClick={() => setMode('wysiwyg')}
            className={`px-3 py-1 text-xs font-semibold rounded flex items-center gap-1 ${
              mode === 'wysiwyg'
                ? 'bg-sari-blue text-white'
                : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300'
            }`}
          >
            <Edit className="w-3 h-3 inline mr-1" />
            Visuel
          </button>
          <button
            onClick={() => setMode('code')}
            className={`px-3 py-1 text-xs font-semibold rounded flex items-center gap-1 ${
              mode === 'code'
                ? 'bg-sari-blue text-white'
                : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300'
            }`}
          >
            <Code className="w-3 h-3 inline mr-1" />
            HTML
          </button>
        </div>
        <div className="text-xs text-gray-500">
          {html.length} caractères
        </div>
      </div>

      {/* Toolbar (only in wysiwyg mode) */}
      {mode === 'wysiwyg' && (
        <div className="flex flex-wrap gap-1 p-2 bg-gray-50 dark:bg-gray-800 border-b border-gray-300 dark:border-gray-700">
          {toolbarGroups.map((group, gi) => (
            <div key={gi} className="flex items-center">
              {gi > 0 && <div className="w-px bg-gray-300 dark:bg-gray-600 mx-1" />}
              {group.buttons.map((btn, bi) => (
                <button
                  key={bi}
                  onClick={typeof btn.cmd === 'function' ? btn.cmd : () => execCommand(btn.cmd as string)}
                  title={btn.title}
                  className="p-1.5 hover:bg-white dark:hover:bg-gray-700 rounded text-gray-700 dark:text-gray-300 transition-colors"
                >
                  {btn.icon ? (
                    <btn.icon className="w-4 h-4" />
                  ) : (
                    <span className="text-xs font-bold px-1">{btn.label}</span>
                  )}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Editor */}
      {mode === 'wysiwyg' ? (
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          onInput={handleInput}
          dangerouslySetInnerHTML={{ __html: html }}
          className="prose dark:prose-invert max-w-none p-4 min-h-[300px] outline-none"
          style={{ minHeight: '300px' }}
        />
      ) : (
        <textarea
          value={html}
          onChange={handleCodeChange}
          placeholder={placeholder}
          className="w-full p-4 font-mono text-sm bg-gray-900 text-green-400 outline-none resize-none"
          style={{ minHeight: '300px' }}
          spellCheck={false}
        />
      )}
    </div>
  );
}