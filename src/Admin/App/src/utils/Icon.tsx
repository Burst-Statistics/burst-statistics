import { memo } from 'react';
import Tooltip from '../components/Common/Tooltip';
import clsx from 'clsx';
import { LucideProps } from 'lucide-react';
import {
  AlertCircle,
  AlertOctagon,
  AlertTriangle,
  Braces,
  Calendar,
  CalendarX,
  Check,
  CheckCircle,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Circle,
  CircleDot,
  CircleOff,
  Clock,
  Copy,
  Eye,
  ExternalLink,
  File,
  FileDown,
  FileText,
  FileX,
  Filter,
  PanelTop,
  Goal,
  Hash,
  HelpCircle,
  Infinity,
  Layers,
  LineChart,
  Link,
  Loader,
  LogOut,
  Minus,
  Monitor,
  Mouse,
  PieChart,
  Plus,
  RefreshCw,
  Smartphone,
  SlidersHorizontal,
  Sun,
  Tablet,
  Trash,
  Trophy,
  User,
  UserCircle,
  Users,
  X,
  XCircle,
  Activity,
  Webhook,
  Earth
} from 'lucide-react';

// Color mapping from our custom colors to CSS variables
const iconColors = {
  black: 'var(--rsp-black)',
  green: 'var(--rsp-green)',
  yellow: 'var(--rsp-yellow)',
  red: 'var(--rsp-red)',
  blue: 'var(--rsp-blue)',
  gray: 'var(--rsp-grey-400)',
  white: 'var(--rsp-white)'
};

// Map existing icon names to Lucide icon components
const iconComponents = {
  bullet: Circle,
  dot: Circle,
  circle: CircleOff,
  period: CircleDot,
  check: Check,
  warning: AlertTriangle,
  error: AlertCircle,
  times: X,
  'circle-check': CheckCircle,
  'circle-times': XCircle,
  'chevron-up': ChevronUp,
  'chevron-down': ChevronDown,
  'chevron-right': ChevronRight,
  'chevron-left': ChevronLeft,
  plus: Plus,
  minus: Minus,
  sync: RefreshCw,
  'sync-error': AlertOctagon,
  shortcode: Braces,
  file: FileText,
  'file-disabled': FileX,
  'file-download': FileDown,
  calendar: Calendar,
  'calendar-error': CalendarX,
  website: PanelTop,
  help: HelpCircle,
  copy: Copy,
  trash: Trash,
  visitor: User,
  visitors: Users,
  'visitors-crowd': Users,
  time: Clock,
  pageviews: Eye,
  referrer: Link,
  sessions: UserCircle,
  bounces: LogOut,
  bounced_sessions: LogOut,
  bounce_rate: LogOut,
  winner: Trophy,
  live: Activity,
  total: Infinity,
  graph: LineChart,
  conversion_rate: PieChart,
  goals: Goal,
  conversions: Goal,
  'goals-empty': CircleDot,
  filter: SlidersHorizontal,
  loading: Loader,
  desktop: Monitor,
  tablet: Tablet,
  mobile: Smartphone,
  other: Layers,
  mouse: Mouse,
  eye: Eye,
  page: File,
  hashtag: Hash,
  sun: Sun,
  world: Earth,
  filters: Filter,
  referrers: ExternalLink,
  hook: Webhook
};

// Define types for icon names and colors
export type IconName = keyof typeof iconComponents | string;
export type ColorName = keyof typeof iconColors | string;

// Props interface for the Icon component
export interface IconProps {
  name?: IconName;
  color?: ColorName;
  size?: number;
  strokeWidth?: number;
  tooltip?: string;
  onClick?: () => void;
  className?: string;
}

const Icon = memo(({ 
  name = 'bullet', 
  color = 'black', 
  size = 18, 
  strokeWidth = 1.5,
  tooltip, 
  onClick, 
  className 
}: IconProps) => {
  // Get color value from our color mappings or use the provided color directly
  const colorVal = iconColors[color as keyof typeof iconColors] || color;
  
  // Get the icon component or fallback to Circle
  const IconComponent = iconComponents[name as keyof typeof iconComponents] || Circle;
  
  // Create the icon component props
  const iconProps: LucideProps = {
    size,
    color: colorVal,
    strokeWidth
  };
  
  // Render the icon
  const renderIcon = () => {
    // Special handling for bullet and dot icons - they should be filled
    if ((name === 'bullet' || name === 'dot') && IconComponent === Circle) {
      return <Circle {...iconProps} fill={colorVal} />;
    }
    
    return <IconComponent {...iconProps} />;
  };

  const handleClick = () => {
    if (onClick) {
      onClick();
    }
  };

  const iconElement = (
    <div onClick={handleClick} className='flex items-center justify-center'>
      {renderIcon()}
    </div>
  );

  if (tooltip) {
    return <Tooltip content={tooltip}>{iconElement}</Tooltip>;
  }

  return iconElement;
});

export default Icon;
