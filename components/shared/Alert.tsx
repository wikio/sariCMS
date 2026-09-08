// components/shared/Alert.tsx
'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { 
  CheckCircle, AlertCircle, AlertTriangle, Info, X,
  Shield, Bell, Zap, Clock, Heart, Star, Award,
  Package, Users, FileText, Mail, Phone, MapPin
} from 'lucide-react';

interface AlertProps {
  type?: 'success' | 'error' | 'warning' | 'info';
  title?: string;
  message?: string;
  icon?: string;
  onClose?: () => void;
  dismissible?: boolean;
  variant?: 'default' | 'solid' | 'outline';
  children?: React.ReactNode;
}

// Mapping des icônes
const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  'check-circle': CheckCircle,
  'alert-circle': AlertCircle,
  'alert-triangle': AlertTriangle,
  'info': Info,
  'x': X,
  'shield': Shield,
  'bell': Bell,
  'zap': Zap,
  'clock': Clock,
  'heart': Heart,
  'star': Star,
  'award': Award,
  'package': Package,
  'users': Users,
  'file-text': FileText,
  'mail': Mail,
  'phone': Phone,
  'map-pin': MapPin,
};

export default function Alert({
  type = 'info',
  title,
  message,
  icon = undefined,
  onClose,
  dismissible = false,
  variant = 'default',
  children
}: AlertProps) {
  const [visible, setVisible] = useState(true);
  const t = useTranslations('components.shared.Alert');

  const types = {
    success: {
      bg: 'bg-green-50 dark:bg-green-900/20',
      border: 'border-green-300 dark:border-green-700',
      text: 'text-green-700 dark:text-green-400',
      icon: CheckCircle,
      iconBg: 'bg-green-100 dark:bg-green-900/30'
    },
    error: {
      bg: 'bg-red-50 dark:bg-red-900/20',
      border: 'border-red-300 dark:border-red-700',
      text: 'text-red-700 dark:text-red-400',
      icon: AlertCircle,
      iconBg: 'bg-red-100 dark:bg-red-900/30'
    },
    warning: {
      bg: 'bg-yellow-50 dark:bg-yellow-900/20',
      border: 'border-yellow-300 dark:border-yellow-700',
      text: 'text-yellow-700 dark:text-yellow-400',
      icon: AlertTriangle,
      iconBg: 'bg-yellow-100 dark:bg-yellow-900/30'
    },
    info: {
      bg: 'bg-blue-50 dark:bg-blue-900/20',
      border: 'border-blue-300 dark:border-blue-700',
      text: 'text-blue-700 dark:text-blue-400',
      icon: Info,
      iconBg: 'bg-blue-100 dark:bg-blue-900/30'
    }
  };

  const config = types[type] || types.info;
  const IconComponent = icon && iconMap[icon] ? iconMap[icon] : config.icon;

  const handleClose = () => {
    setVisible(false);
    if (onClose) onClose();
  };

  if (!visible) return null;

  return (
    <div className={`${config.bg} ${config.border} border rounded-xl p-4 flex items-start gap-3 animate-fade-in-up`}>
      <div className={`${config.iconBg} ${config.text} p-2 rounded-lg flex-shrink-0`}>
        <IconComponent className="w-5 h-5" />
      </div>
      <div className="flex-1 min-w-0">
        {title && <h4 className={`font-bold ${config.text} mb-1`}>{title}</h4>}
        {message && <p className={`text-sm ${config.text} opacity-90`}>{message}</p>}
        {children}
      </div>
      {dismissible && (
        <button
          onClick={handleClose}
          className={`${config.text} hover:opacity-70 transition-opacity flex-shrink-0`}
          aria-label={t('close')}
        >
          <X className="w-5 h-5" />
        </button>
      )}
    </div>
  );
}