import type { LucideIcon } from 'lucide-react';
import {
  Activity, Archive, Award, Banknote, Bell, BookOpen, Box, Briefcase, Building2,
  Calendar, Camera, Check, CircleCheck, CircleHelp, Clipboard, Clock, Cloud,
  Compass, Cpu, CreditCard, Database, Download, Droplet, Eye, FileText, Filter,
  Flag, Folder, Globe, GraduationCap, GripVertical, Hammer, Handshake, Headphones,
  Heart, HeartPulse, Home, Image, Inbox, Info, Key, Layers, LayoutDashboard,
  LifeBuoy, Link, List, Lock, Mail, MapPin, Megaphone, Menu, MessageCircle,
  Monitor, Newspaper, Package, Paperclip, Pen, Phone, Play, Plus, Printer,
  Radio, Receipt, RefreshCw, Save, Scale, Search, Send, Settings, Share2, Shield,
  ShoppingBag, ShoppingCart, Sparkles, Star, Stethoscope, Sun, Table, Tag, Target,
  Thermometer, ThumbsUp, Trash2, Truck, Upload, User, Users, Video, Wallet, Wifi,
  Wrench, Zap,
} from 'lucide-react';

const ICONS: Array<[string, LucideIcon]> = [
  ['activity', Activity], ['archive', Archive], ['award', Award], ['banknote', Banknote],
  ['bell', Bell], ['book-open', BookOpen], ['box', Box], ['briefcase', Briefcase],
  ['building-2', Building2], ['calendar', Calendar], ['camera', Camera], ['check', Check],
  ['check-circle', CircleCheck], ['clipboard', Clipboard], ['clock', Clock], ['cloud', Cloud],
  ['compass', Compass], ['cpu', Cpu], ['credit-card', CreditCard], ['database', Database],
  ['download', Download], ['droplet', Droplet], ['eye', Eye], ['file-text', FileText],
  ['filter', Filter], ['flag', Flag], ['folder', Folder], ['globe', Globe],
  ['graduation-cap', GraduationCap], ['grip-vertical', GripVertical], ['hammer', Hammer],
  ['handshake', Handshake], ['headphones', Headphones], ['heart', Heart],
  ['heart-pulse', HeartPulse], ['help-circle', CircleHelp], ['home', Home],
  ['hospital', Building2], ['image', Image], ['inbox', Inbox], ['info', Info], ['key', Key],
  ['layers', Layers], ['layout-dashboard', LayoutDashboard], ['life-buoy', LifeBuoy],
  ['link', Link], ['list', List], ['lock', Lock], ['mail', Mail], ['map-pin', MapPin],
  ['megaphone', Megaphone], ['menu', Menu], ['message-circle', MessageCircle],
  ['monitor', Monitor], ['newspaper', Newspaper], ['package', Package], ['paperclip', Paperclip],
  ['pen', Pen], ['phone', Phone], ['play', Play], ['plus', Plus], ['printer', Printer],
  ['radio', Radio], ['receipt', Receipt], ['refresh-cw', RefreshCw], ['save', Save],
  ['scale', Scale], ['search', Search], ['send', Send], ['settings', Settings],
  ['share-2', Share2], ['shield', Shield], ['shopping-bag', ShoppingBag],
  ['shopping-cart', ShoppingCart], ['sparkles', Sparkles], ['star', Star],
  ['stethoscope', Stethoscope], ['sun', Sun], ['syringe', Plus], ['table', Table],
  ['tag', Tag], ['target', Target], ['thermometer', Thermometer], ['thumbs-up', ThumbsUp],
  ['trash-2', Trash2], ['truck', Truck], ['upload', Upload], ['user', User], ['users', Users],
  ['video', Video], ['wallet', Wallet], ['wifi', Wifi], ['wrench', Wrench], ['zap', Zap],
];

export const LUCIDE_CATALOG = ICONS.map(([name]) => name);

const BY_SLUG = new Map(ICONS);
const BY_PASCAL = new Map(ICONS.map(([name, icon]) => [toPascalCase(name), icon]));

export function toPascalCase(name: string) {
  return String(name || '')
    .split(/[-_\s./]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

export function getLucideIcon(name?: string | null): LucideIcon {
  const raw = String(name || '').trim();
  if (!raw) return CircleHelp;
  return BY_SLUG.get(raw)
    || BY_SLUG.get(raw.toLowerCase())
    || BY_PASCAL.get(toPascalCase(raw))
    || CircleHelp;
}

export function searchLucideIcons(q: string, limit = 40) {
  const needle = q.trim().toLowerCase();
  const list = needle
    ? LUCIDE_CATALOG.filter((name) => name.includes(needle) || toPascalCase(name).toLowerCase().includes(needle))
    : LUCIDE_CATALOG;
  return list.slice(0, limit);
}
