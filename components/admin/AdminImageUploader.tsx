// components/admin/AdminImageUploader.tsx
'use client';

import { useState, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { Upload, X, Image as ImageIcon, Link as LinkIcon } from 'lucide-react';

interface AdminImageUploaderProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  maxSizeMB?: number;
}

export default function AdminImageUploader({ 
  value, 
  onChange, 
  label,
  maxSizeMB = 5 
}: AdminImageUploaderProps) {
  const t = useTranslations('admin.imageUploader');
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    setError('');
    
    if (!file.type.startsWith('image/')) {
      setError(t('invalidType'));
      return;
    }
    
    if (file.size > maxSizeMB * 1024 * 1024) {
      setError(t('tooLarge', { max: maxSizeMB }));
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = e.target?.result as string;
      onChange(base64);
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => setIsDragging(false);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const handleRemove = () => {
    onChange('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="space-y-3">
      {label && (
        <label className="block text-sm font-bold text-sari-dark dark:text-white flex items-center gap-2">
          <ImageIcon className="w-4 h-4 text-sari-blue" />
          {label}
        </label>
      )}

      {/* Zone de drop ou aperçu */}
      {value ? (
        <div className="relative border-2 border-gray-300 dark:border-gray-700 rounded-lg p-4 text-center group">
          <img 
            src={value} 
            alt={t('preview')} 
            className="max-h-48 mx-auto rounded" 
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} 
          />
          <button
            onClick={handleRemove}
            className="absolute top-2 right-2 bg-red-500 text-white p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
            title={t('remove')}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-all ${
            isDragging 
              ? 'border-sari-blue bg-sari-blue/5' 
              : 'border-gray-300 dark:border-gray-700 hover:border-sari-blue hover:bg-sari-blue/5'
          }`}
        >
          <Upload className={`w-10 h-10 mx-auto mb-2 ${isDragging ? 'text-sari-blue' : 'text-gray-400'}`} />
          <p className="text-sm font-medium text-sari-dark dark:text-white">
            {t('dropHere')}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {t('formats')} (max {maxSizeMB}MB)
          </p>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Séparateur OU */}
      <div className="relative flex items-center">
        <div className="flex-grow border-t border-gray-300 dark:border-gray-700"></div>
        <span className="flex-shrink mx-3 text-xs text-gray-500 flex items-center gap-1">
          <LinkIcon className="w-3 h-3" /> {t('orUrl')}
        </span>
        <div className="flex-grow border-t border-gray-300 dark:border-gray-700"></div>
      </div>

      {/* Champ URL */}
      <input
        type="text"
        value={value && !value.startsWith('data:') ? value : ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder="https://example.com/image.jpg"
        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 dark:bg-[#111111] dark:text-white rounded-lg outline-none focus:border-sari-blue font-mono text-sm"
      />

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-700 p-2 rounded text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      )}
    </div>
  );
}