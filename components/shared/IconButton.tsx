// components/shared/IconButton.tsx
'use client';

import { 
  Edit, Trash2, Eye, Heart, Share2, Send, LogIn, LogOut,
  Home, Settings, Bell, Calendar, MapPin, Clock, Star,
  Award, Shield, Zap, Activity, Package, Briefcase, FileText,
  ShoppingCart, User, Mail, Phone, Download, Upload, Search,
  Filter, Check, X, Plus, Minus, ChevronRight, ChevronLeft
} from 'lucide-react';

interface IconButtonProps {
  icon: string;
  onClick?: () => void;
  size?: 'small' | 'medium' | 'large';
  variant?: 'default' | 'primary' | 'outline' | 'ghost' | 'danger';
  label?: string;
  disabled?: boolean;
  badge?: number | null;
  type?: 'button' | 'submit' | 'reset';
}

// Mapping des icônes
const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  'edit': Edit,
  'trash-2': Trash2,
  'eye': Eye,
  'heart': Heart,
  'share-2': Share2,
  'send': Send,
  'log-in': LogIn,
  'log-out': LogOut,
  'home': Home,
  'settings': Settings,
  'bell': Bell,
  'calendar': Calendar,
  'map-pin': MapPin,
  'clock': Clock,
  'star': Star,
  'award': Award,
  'shield': Shield,
  'zap': Zap,
  'activity': Activity,
  'package': Package,
  'briefcase': Briefcase,
  'file-text': FileText,
  'shopping-cart': ShoppingCart,
  'user': User,
  'mail': Mail,
  'phone': Phone,
  'download': Download,
  'upload': Upload,
  'search': Search,
  'filter': Filter,
  'check': Check,
  'x': X,
  'plus': Plus,
  'minus': Minus,
  'chevron-right': ChevronRight,
  'chevron-left': ChevronLeft,
};

export default function IconButton({
  icon,
  onClick,
  size = 'medium',
  variant = 'default',
  label = '',
  disabled = false,
  badge = null,
  type = 'button'
}: IconButtonProps) {
  const sizes = {
    small: 'w-8 h-8',
    medium: 'w-10 h-10',
    large: 'w-12 h-12'
  };

  const iconSizes = {
    small: 'w-4 h-4',
    medium: 'w-5 h-5',
    large: 'w-6 h-6'
  };

  const variants = {
    default: 'bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300',
    primary: 'bg-sari-blue hover:bg-sari-blue/90 text-white',
    outline: 'border-2 border-gray-300 dark:border-gray-700 hover:border-sari-blue hover:text-sari-blue text-gray-700 dark:text-gray-300',
    ghost: 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300',
    danger: 'bg-red-100 dark:bg-red-900/30 hover:bg-red-200 dark:hover:bg-red-900/50 text-red-700 dark:text-red-400'
  };

  const IconComponent = iconMap[icon] || Package;

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      aria-label={label || icon}
      className={`${sizes[size]} ${variants[variant]} rounded-full flex items-center justify-center transition-all ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:scale-110'} relative`}
    >
      <IconComponent className={iconSizes[size]} />
      {badge !== null && badge > 0 && (
        <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold">
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </button>
  );
}