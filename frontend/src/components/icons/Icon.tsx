// frontend/src/components/icons/Icon.tsx
import {
  // Layout / nav
  Home, LayoutDashboard, ListChecks, Wallet, PieChart, FileText, MessageSquare,
  Tag, Folder, Settings, User as UserIcon, LogOut, Search, ChevronLeft, ChevronRight,
  ChevronDown, ChevronUp, X, Menu, MoreVertical, MoreHorizontal, PanelLeft,

  // Actions
  Plus, Minus, Edit3, Trash2, Save, RefreshCw, Download, Upload, Copy, Check,
  CheckCircle2, AlertCircle, AlertTriangle, Info, HelpCircle, Send,

  // Status / direction
  ArrowUp, ArrowDown, ArrowLeft, ArrowUpRight, ArrowDownRight, ArrowDownLeft,
  ArrowLeftRight, TrendingUp, TrendingDown,
  Minus as Equals,

  // Finance / shopping
  CreditCard, Banknote, Coins, Receipt, PiggyBank, Target, Calendar, Clock,
  Building, Store, ShoppingCart, ShoppingBag, Coffee, Car, Plane,

  // Comms
  Mail, MessageCircle, Bell, Smartphone, Globe,

  // Misc
  Sparkles, Sparkle, Zap, Sun, Moon, Eye, EyeOff, Filter, SlidersHorizontal, Lock,
  Unlock, ShieldCheck, KeyRound, Heart, Star, Bot, Link, Unlink, Repeat, Flame,
  Camera, Command,
} from 'lucide-react'

import type { ComponentType, SVGProps } from 'react'

type LucideIcon = ComponentType<SVGProps<SVGSVGElement> & { size?: number | string }>

// Handoff name (left) → lucide component (right).
// Keep keys in sync with .handoff/design/icons.jsx.
const ICON_MAP: Record<string, LucideIcon> = {
  // Layout / nav
  home: Home,
  dashboard: LayoutDashboard,
  list: ListChecks,
  wallet: Wallet,
  pie: PieChart,
  report: FileText,
  doc: FileText,
  chat: MessageSquare,
  'message-square': MessageSquare,
  tag: Tag,
  folder: Folder,
  settings: Settings,
  user: UserIcon,
  logout: LogOut,
  search: Search,
  'chevron-left': ChevronLeft,
  'chevron-right': ChevronRight,
  'chevron-down': ChevronDown,
  'chevron-up': ChevronUp,
  close: X,
  x: X,
  menu: Menu,
  more: MoreVertical,
  dots: MoreHorizontal,
  'panel-left': PanelLeft,

  // Actions
  plus: Plus,
  minus: Minus,
  edit: Edit3,
  trash: Trash2,
  save: Save,
  refresh: RefreshCw,
  download: Download,
  upload: Upload,
  copy: Copy,
  check: Check,
  'check-circle': CheckCircle2,
  'alert-circle': AlertCircle,
  warning: AlertTriangle,
  alert: AlertTriangle,
  info: Info,
  help: HelpCircle,
  send: Send,

  // Status / direction
  'arrow-up': ArrowUp,
  'arrow-down': ArrowDown,
  'arrow-left': ArrowLeft,
  'arrow-up-right': ArrowUpRight,
  'arrow-down-right': ArrowDownRight,
  'arrow-down-left': ArrowDownLeft,
  'trending-up': TrendingUp,
  'trending-down': TrendingDown,
  'trend-up': TrendingUp,
  'trend-down': TrendingDown,
  swap: ArrowLeftRight,
  equals: Equals,

  // Finance / shopping
  card: CreditCard,
  cash: Banknote,
  coins: Coins,
  receipt: Receipt,
  goal: PiggyBank,
  target: Target,
  calendar: Calendar,
  clock: Clock,
  building: Building,
  store: Store,
  cart: ShoppingCart,
  bag: ShoppingBag,
  coffee: Coffee,
  car: Car,
  plane: Plane,

  // Comms
  mail: Mail,
  message: MessageCircle,
  bell: Bell,
  phone: Smartphone,
  globe: Globe,

  // Misc
  sparkles: Sparkles,
  sparkle: Sparkle,
  zap: Zap,
  bolt: Zap,
  sun: Sun,
  moon: Moon,
  eye: Eye,
  'eye-off': EyeOff,
  filter: Filter,
  sliders: SlidersHorizontal,
  lock: Lock,
  unlock: Unlock,
  shield: ShieldCheck,
  key: KeyRound,
  heart: Heart,
  star: Star,
  bot: Bot,
  link: Link,
  unlink: Unlink,
  repeat: Repeat,
  flame: Flame,
  camera: Camera,
  command: Command,
}

interface IconProps {
  name: keyof typeof ICON_MAP | string
  size?: number | string
  stroke?: number | string
  className?: string
}

export function Icon({ name, size = 18, stroke = 1.75, className }: IconProps) {
  const Component = ICON_MAP[name]
  if (!Component) {
    if (import.meta.env.DEV) {
      console.warn(`[Icon] Unknown name: ${name}`)
    }
    return null
  }
  return <Component size={size} strokeWidth={stroke as number} className={className} aria-hidden="true" />
}

export type IconName = keyof typeof ICON_MAP
