// components/shared/Badge.tsx
'use client';

import { 
  CheckCircle, AlertCircle, Star, Heart, Zap, Clock,
  Package, Users, FileText, Mail, Phone, MapPin,
  Shield, Bell, Award, X, Plus, Minus, Edit, Trash2,
  Eye, Download, Upload, Search, Filter
} from 'lucide-react';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'lime' | 'purple' | 'pink' | 'outline';
  size?: 'small' | 'medium' | 'large';
  icon?: string;
  dot?: boolean;
  className?: string;
}

// Mapping des icônes
const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  'check-circle': CheckCircle,
  'alert-circle': AlertCircle,
  'star': Star,
  'heart': Heart,
  'zap': Zap,
  'clock': Clock,
  'package': Package,
  'users': Users,
  'file-text': FileText,
  'mail': Mail,
  'phone': Phone,
  'map-pin': MapPin,
  'shield': Shield,
  'bell': Bell,
  'award': Award,
  'x': X,
  'plus': Plus,
  'minus': Minus,
  'edit': Edit,
  'trash-2': Trash2,
  'eye': Eye,
  'download': Download,
  'upload': Upload,
  'search': Search,
  'filter': Filter,
};

export default function Badge({
  children,
  variant = 'default',
  size = 'medium',
  icon = null,
  dot = false,
  className = ''
}: BadgeProps) {
  const variants = {
    default: 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300',
    primary: 'bg-sari-blue/10 text-sari-blue',
    success: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
    warning: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400',
    danger: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
    info: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
    lime: 'bg-sari-lime text-sari-dark',
    purple: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400',
    pink: 'bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-400',
    outline: 'border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300'
  };

  const sizes = {
    small: 'px-2 py-0.5 text-xs',
    medium: 'px-3 py-1 text-sm',
    large: 'px-4 py-1.5 text-base'
  };

  const IconComponent = icon && iconMap[icon] ? iconMap[icon] : null;

  return (
    <span className={`inline-flex items-center gap-1.5 font-semibold rounded-full ${variants[variant]} ${sizes[size]} ${className}`}>
      {dot && <span className="w-2 h-2 rounded-full bg-current"></span>}
      {IconComponent && <IconComponent className={size === 'small' ? 'w-3 h-3' : 'w-4 h-4'} />}
      {children}
    </span>
  );
}