// components/admin/JsonEditor.tsx
'use client';

import { useState, useEffect } from 'react';
import { AlignLeft, Check, CheckCircle, AlertCircle } from 'lucide-react';

interface JsonEditorProps {
  value: any;
  onChange: (data: any) => void;
  height?: string;
}

export default function JsonEditor({ value, onChange, height = '400px' }: JsonEditorProps) {
  const [content, setContent] = useState(JSON.stringify(value, null, 2));
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setContent(JSON.stringify(value, null, 2));
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);
    setError(null);
    setSaved(false);
  };

  const handleValidate = () => {
    try {
      const parsed = JSON.parse(content);
      setError(null);
      onChange(parsed);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      return true;
    } catch (err: any) {
      setError(err.message);
      return false;
    }
  };

  const handleFormat = () => {
    try {
      const parsed = JSON.parse(content);
      setContent(JSON.stringify(parsed, null, 2));
      setError(null);
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <button
            onClick={handleFormat}
            className="px-3 py-1.5 bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700 rounded text-sm flex items-center gap-1"
          >
            <AlignLeft className="w-4 h-4" /> Formater
          </button>
          <button
            onClick={handleValidate}
            className="px-3 py-1.5 bg-sari-blue hover:bg-sari-blue/90 text-white rounded text-sm flex items-center gap-1"
          >
            <Check className="w-4 h-4" /> Valider & Sauvegarder
          </button>
        </div>
        {saved && (
          <span className="text-green-500 text-sm flex items-center gap-1">
            <CheckCircle className="w-4 h-4" /> Sauvegardé !
          </span>
        )}
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-700 p-3 rounded-lg text-sm text-red-600 dark:text-red-400 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>Erreur JSON : {error}</span>
        </div>
      )}

      <textarea
        value={content}
        onChange={handleChange}
        style={{ height }}
        className="w-full font-mono text-sm bg-gray-900 text-green-400 p-4 rounded-lg border border-gray-700 outline-none focus:border-sari-blue resize-none"
        spellCheck={false}
      />
    </div>
  );
}