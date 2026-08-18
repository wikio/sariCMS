// components/ui/ProductFilters.tsx
'use client';

interface ProductFiltersProps {
  categories?: string[];
  selectedCategory?: string;
  onCategoryChange: (category: string) => void;
  showCount?: boolean;
  counts?: Record<string, number>;
}

export default function ProductFilters({
  categories = [],
  selectedCategory = 'Tous',
  onCategoryChange,
  showCount = true,
  counts = {},
}: ProductFiltersProps) {
  return (
    <div className="flex flex-wrap gap-2 mb-8">
      {categories.map((cat) => {
        const isSelected = selectedCategory === cat;
        const count = counts[cat];

        return (
          <button
            key={cat}
            onClick={() => onCategoryChange(cat)}
            className={`px-4 py-2 font-medium rounded-lg transition-all ${
              isSelected
                ? 'bg-sari-blue text-white shadow-lg'
                : 'bg-gray-100 dark:bg-[#1a1a1a] text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-800'
            }`}
          >
            {cat}
            {showCount && count !== undefined && (
              <span className={`ml-2 text-xs ${isSelected ? 'text-white/80' : 'text-gray-500'}`}>
                ({count})
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}