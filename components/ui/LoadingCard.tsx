// components/ui/LoadingCard.tsx
'use client';

interface LoadingCardProps {
  variant?: 'product' | 'event' | 'news';
  count?: number;
}

export default function LoadingCard({ variant = 'product', count = 1 }: LoadingCardProps) {
  const renderProduct = (key: number) => (
    <div key={key} className="bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-800 p-6 rounded-xl animate-pulse">
      <div className="w-full h-48 bg-gray-200 dark:bg-gray-800 rounded-lg mb-4"></div>
      <div className="h-3 bg-gray-200 dark:bg-gray-800 rounded w-1/4 mb-2"></div>
      <div className="h-5 bg-gray-200 dark:bg-gray-800 rounded w-3/4 mb-2"></div>
      <div className="h-3 bg-gray-200 dark:bg-gray-800 rounded w-full mb-2"></div>
      <div className="h-3 bg-gray-200 dark:bg-gray-800 rounded w-2/3 mb-4"></div>
      <div className="h-10 bg-gray-200 dark:bg-gray-800 rounded w-full"></div>
    </div>
  );

  const renderEvent = (key: number) => (
    <div key={key} className="bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-800 p-6 rounded-xl animate-pulse flex gap-6">
      <div className="w-32 h-32 bg-gray-200 dark:bg-gray-800 rounded-lg flex-shrink-0"></div>
      <div className="flex-1">
        <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded w-1/4 mb-3"></div>
        <div className="h-6 bg-gray-200 dark:bg-gray-800 rounded w-3/4 mb-2"></div>
        <div className="h-3 bg-gray-200 dark:bg-gray-800 rounded w-full mb-2"></div>
        <div className="h-3 bg-gray-200 dark:bg-gray-800 rounded w-1/2"></div>
      </div>
    </div>
  );

  const renderNews = (key: number) => (
    <div key={key} className="bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden animate-pulse">
      <div className="w-full h-48 bg-gray-200 dark:bg-gray-800"></div>
      <div className="p-6">
        <div className="h-3 bg-gray-200 dark:bg-gray-800 rounded w-1/3 mb-3"></div>
        <div className="h-5 bg-gray-200 dark:bg-gray-800 rounded w-full mb-2"></div>
        <div className="h-3 bg-gray-200 dark:bg-gray-800 rounded w-2/3"></div>
      </div>
    </div>
  );

  const renderers: Record<string, (key: number) => React.ReactElement> = {
    product: renderProduct,
    event: renderEvent,
    news: renderNews,
  };

  const renderer = renderers[variant] || renderProduct;

  return (
    <>
      {Array.from({ length: count }).map((_, i) => renderer(i))}
    </>
  );
}