// components/ui/CTAButton.tsx
'use client';

import Link from 'next/link';
import { useLocale } from 'next-intl';
import { 
  ArrowRight, ArrowLeft, ShoppingCart, User, Mail, Phone,
  Download, Upload, Search, Filter, Check, X, Plus, Minus,
  Edit, Trash2, Eye, Heart, Share2, Send, LogIn, LogOut,
  Home, Settings, Bell, Calendar, MapPin, Clock, Star,
  Award, Shield, Zap, Activity, Package, Briefcase, FileText
} from 'lucide-react';

interface CTAButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  href?: string;
  variant?: 'primary' | 'secondary' | 'outline' | 'lime' | 'danger';
  size?: 'small' | 'medium' | 'large';
  icon?: string;
  disabled?: boolean;
  fullWidth?: boolean;
  type?: 'button' | 'submit' | 'reset';
  className?: string;
}

// Mapping des icônes
const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  'arrow-right': ArrowRight,
  'arrow-left': ArrowLeft,
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
};

export default function CTAButton({
  children,
  onClick,
  href,
  variant = 'primary',
  size = 'medium',
  icon = undefined,
  disabled = false,
  fullWidth = false,
  type = 'button',
  className = ''
}: CTAButtonProps) {
  const locale = useLocale();
  const isRtl = locale === 'ar';

  const variants = {
    primary: 'bg-sari-blue text-white hover:bg-sari-blue/90 shadow-lg hover:shadow-xl',
    secondary: 'bg-white dark:bg-[#1a1a1a] text-sari-dark dark:text-white border-2 border-sari-dark dark:border-white hover:bg-sari-dark hover:text-white dark:hover:bg-white dark:hover:text-sari-dark',
    outline: 'border-2 border-sari-blue text-sari-blue hover:bg-sari-blue hover:text-white',
    lime: 'bg-sari-lime text-sari-dark hover:bg-white font-bold',
    danger: 'bg-red-500 text-white hover:bg-red-600'
  };

  const sizes = {
    small: 'px-4 py-2 text-sm',
    medium: 'px-6 py-3 text-base',
    large: 'px-8 py-4 text-lg'
  };

  const baseClasses = `inline-flex items-center justify-center gap-2 font-semibold rounded-lg transition-all ${variants[variant]} ${sizes[size]} ${fullWidth ? 'w-full' : ''} ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`;

  const IconComponent = icon ? iconMap[icon] : null;

  const content = (
    <>
      {IconComponent && <IconComponent className="w-5 h-5" />}
      {children}
    </>
  );

  if (href) {
    return (
      <Link href={`/${locale}${href.replace('#', '')}`} className={baseClasses}>
        {content}
      </Link>
    );
  }

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={baseClasses}
    >
      {content}
    </button>
  );
}