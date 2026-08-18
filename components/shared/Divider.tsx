// components/shared/Divider.tsx
interface DividerProps {
  text?: string;
  orientation?: 'horizontal' | 'vertical';
  variant?: 'solid' | 'dashed' | 'dotted';
  spacing?: 'small' | 'medium' | 'large';
}

export default function Divider({
  text = '',
  orientation = 'horizontal',
  variant = 'solid',
  spacing = 'medium'
}: DividerProps) {
  const orientations = {
    horizontal: 'w-full',
    vertical: 'h-full w-px'
  };

  const variants = {
    solid: 'border-gray-200 dark:border-gray-800',
    dashed: 'border-dashed border-gray-300 dark:border-gray-700',
    dotted: 'border-dotted border-gray-300 dark:border-gray-700'
  };

  const spacings = {
    small: 'my-4',
    medium: 'my-8',
    large: 'my-12'
  };

  if (!text) {
    return (
      <div className={`${orientations[orientation]} border-t ${variants[variant]} ${orientation === 'horizontal' ? spacings[spacing] : ''}`}></div>
    );
  }

  return (
    <div className={`flex items-center ${spacings[spacing]}`}>
      <div className={`flex-1 border-t ${variants[variant]}`}></div>
      <span className="px-4 text-sm text-gray-500 dark:text-gray-400 font-medium">{text}</span>
      <div className={`flex-1 border-t ${variants[variant]}`}></div>
    </div>
  );
}