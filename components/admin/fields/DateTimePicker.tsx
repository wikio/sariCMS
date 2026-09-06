'use client';

import { useState, useEffect } from 'react';
import { Calendar, Clock, X } from 'lucide-react';
import { useDateFormat } from '@/lib/use-date-format';

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
  const { format: formatPreview } = useDateFormat();
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

  // Combine date et time en ISO string complet (ISO-8601 avec fuseau horaire)
  const handleChange = (newDate: string, newTime: string) => {
    if (!newDate) {
      onChange('');
      return;
    }

    try {
      let dateObj: Date;
      
      if (includeTime && newTime) {
        // Combiner date et heure
        dateObj = new Date(`${newDate}T${newTime}:00`);
      } else {
        // Date uniquement, heure à minuit
        dateObj = new Date(`${newDate}T00:00:00`);
      }
      
      // Vérifier que la date est valide
      if (isNaN(dateObj.getTime())) {
        console.error('Date invalide:', newDate, newTime);
        return;
      }
      
      // Convertir en ISO-8601 complet avec fuseau horaire
      const isoString = dateObj.toISOString();
      onChange(isoString);
    } catch (error) {
      console.error('Erreur de conversion de date:', error);
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

      {/* Aperçu : rendu exact tel qu'il apparaîtra sur la vitrine. */}
      {value && (
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {formatPreview(value, { includeTime: includeTime && Boolean(time) })}
        </p>
      )}
    </div>
  );
}
