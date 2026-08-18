// components/ui/FAQ.tsx
'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface FAQItem {
  q: string;
  a: string;
}

interface FAQProps {
  items?: FAQItem[];
  variant?: 'default' | 'numbered';
}

export default function FAQ({ items = [], variant = 'default' }: FAQProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const toggle = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  if (items.length === 0) return null;

  return (
    <div className="space-y-4">
      {items.map((item, i) => {
        const isOpen = openIndex === i;
        return (
          <div
            key={i}
            className={`border rounded-xl overflow-hidden transition-all ${
              isOpen
                ? 'border-sari-blue/30 shadow-lg bg-white dark:bg-[#1a1a1a]'
                : 'border-gray-200 dark:border-gray-800 bg-white dark:bg-[#1a1a1a]'
            }`}
          >
            <button
              onClick={() => toggle(i)}
              className="w-full flex items-center justify-between p-6 text-left font-semibold text-sari-dark dark:text-white hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              <span className="flex items-start gap-3 pr-4">
                {variant === 'numbered' && (
                  <span className="w-8 h-8 bg-sari-blue/10 text-sari-blue rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                )}
                <span className="flex-1">{item.q}</span>
              </span>
              {isOpen ? (
                <ChevronUp className="w-5 h-5 text-sari-blue flex-shrink-0 transition-transform" />
              ) : (
                <ChevronDown className="w-5 h-5 text-sari-blue flex-shrink-0 transition-transform" />
              )}
            </button>
            {isOpen && (
              <div className="p-6 pt-0 text-gray-600 dark:text-gray-400 border-t border-gray-100 dark:border-gray-800 animate-fade-in-up">
                {variant === 'numbered' && <div className="pl-11">{item.a}</div>}
                {variant !== 'numbered' && item.a}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}