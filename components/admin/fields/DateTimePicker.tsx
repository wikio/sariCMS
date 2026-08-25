'use client';

import { useState, useEffect } from 'react';
import { Calendar, Clock, X } from 'lucide-react';

interface DateTimePickerProps {
  value?: string;
  onChange: (value: string) => void;
  label: string;
  includeTime?: boolean;
  placeholder?: string;
  required?: boolean;
}

/**
 * Composant DateTimePicker avec sélection de date et heure optionnelle
 * Stocke la valeur au format ISO 8601
 */
export default function DateTimePicker({
  value,
  onChange,
  label,
  includeTime = true,
  placeholder,
  required = false,
}: DateTimePickerProps) {
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');

  // Parse la valeur ISO en date et heure
  useEffect(() => {
    if (value) {
      try {
        const dateObj = new Date(value);
        if (!isNaN(dateObj.getTime())) {
          const year = dateObj.getFullYear();
          const month = String(dateObj.getMonth() + 1).padStart(2, '0');
          const day = String(dateObj.getDate()).padStart(2, '0');
          setDate(`${year}-${month}-${day}`);

          if (includeTime) {
            const hours = String(dateObj.getHours()).padStart(2, '0');
            const minutes = String(dateObj.getMinutes()).padStart(2, '0');
            setTime(`${hours}:${minutes}`);
          }
        }
      } catch (error) {
        console.error('Erreur de parsing de date:', error);
      }
    } else {
      setDate('');
      setTime('');
    }
  }, [value, includeTime]);

  // Combine date et time en ISO string
  const handleChange = (newDate: string, newTime: string) => {
    if (!newDate) {
      onChange('');
      return;
    }

    if (includeTime && newTime) {
      const isoString = `${newDate}T${newTime}:00`;
      onChange(isoString);
    } else {
      const isoString = `${newDate}T00:00:00`;
      onChange(isoString);
    }
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newDate = e.target.value;
    setDate(newDate);
    handleChange(newDate, time);
  };

  const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = e.target.value;
    setTime(newTime);
    handleChange(date, newTime);
  };

  const handleClear = () => {
    setDate('');
    setTime('');
    onChange('');
  };

  return (
    <div className="space-y-2">
      <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      
      <div className="flex gap-2">
        {/* Champ date */}
        <div className="flex-1 relative">
          <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <input
            type="date"
            value={date}
            onChange={handleDateChange}
            placeholder={placeholder}
            required={required}
            className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-sari-blue focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          />
        </div>

        {/* Champ heure (optionnel) */}
        {includeTime && (
          <div className="w-32 relative">
            <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <input
              type="time"
              value={time}
              onChange={handleTimeChange}
              disabled={!date}
              className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-sari-blue focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>
        )}

        {/* Bouton effacer */}
        {(date || time) && (
          <button
            type="button"
            onClick={handleClear}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            title="Effacer"
          >
            <X className="w-4 h-4 text-gray-600 dark:text-gray-400" />
          </button>
        )}
      </div>

      {/* Affichage de la valeur formatée */}
      {value && (
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {new Date(value).toLocaleString('fr-FR', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            ...(includeTime && time ? { hour: '2-digit', minute: '2-digit' } : {}),
          })}
        </p>
      )}
    </div>
  );
}
