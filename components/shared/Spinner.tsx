// components/shared/Spinner.tsx
interface SpinnerProps {
  size?: 'small' | 'medium' | 'large' | 'xl';
  color?: 'primary' | 'white' | 'gray' | 'lime';
  text?: string;
  overlay?: boolean;
}

export default function Spinner({
  size = 'medium',
  color = 'primary',
  text = '',
  overlay = false
}: SpinnerProps) {
  const sizes = {
    small: 'w-4 h-4 border-2',
    medium: 'w-8 h-8 border-3',
    large: 'w-12 h-12 border-4',
    xl: 'w-16 h-16 border-4'
  };

  const colors = {
    primary: 'border-sari-blue border-t-transparent',
    white: 'border-white border-t-transparent',
    gray: 'border-gray-400 border-t-transparent',
    lime: 'border-sari-lime border-t-transparent'
  };

  const spinner = (
    <div className={`${sizes[size]} ${colors[color]} rounded-full animate-spin`}></div>
  );

  if (overlay) {
    return (
      <div className="fixed inset-0 z-[80] bg-black/30 backdrop-blur-sm flex items-center justify-center">
        <div className="bg-white dark:bg-[#1a1a1a] p-8 rounded-2xl shadow-2xl flex flex-col items-center gap-4">
          {spinner}
          {text && <p className="text-gray-600 dark:text-gray-400 font-medium">{text}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="inline-flex flex-col items-center gap-3">
      {spinner}
      {text && <p className="text-gray-600 dark:text-gray-400 text-sm font-medium">{text}</p>}
    </div>
  );
}