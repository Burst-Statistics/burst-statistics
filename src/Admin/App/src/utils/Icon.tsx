import { memo } from 'react';
import Tooltip from '../components/Common/Tooltip';
import { LucideProps, OctagonAlert, Percent, ShoppingCart, UserRoundCheck, UserRoundPlus, TriangleAlert } from 'lucide-react';
import {
	AlertCircle,
	AlertOctagon,
	AlertTriangle,
	Braces,
	Building,
	Calendar,
	CalendarX,
	Car,
	Check,
	CircleCheck,
	ChevronDown,
	ChevronLeft,
	ChevronRight,
	ChevronUp,
	Circle,
	CircleDot,
	CircleOff,
	Clock,
	Copy,
	Cpu,
	Eye,
	ExternalLink,
	File,
	FileDown,
	FileText,
	FileX,
	Filter,
	Globe,
	Goal,
	Grid3x3,
	Hash,
	HelpCircle,
	Infinity,
	Layers,
	LineChart,
	Link,
	Loader,
	LogOut,
	MapPin,
	Megaphone,
	Minus,
	Monitor,
	Mouse,
	PanelTop,
	PieChart,
	Plus,
	Radio,
	RefreshCw,
	Search,
	Settings,
	Smartphone,
	SlidersHorizontal,
	Star,
	Sun,
	Tablet,
	Tag,
	Target,
	Trash,
	Trophy,
	User,
	UserCircle,
	Users,
	X,
	XCircle,
	Activity,
	Webhook,
	Earth,
	LogIn,
	CircleAlert,
	MapPinned,
	Milestone,
	Brain,
	Frown,
	Hourglass,
	Scale,
	LineSquiggle,
	PartyPopper
} from 'lucide-react';
import { clsx } from "clsx";

// Color mapping from our custom colors to CSS variables
const iconColors = {
	black: 'black',
	green: 'green',
	yellow: 'yellow',
	red: 'red',
	blue: 'blue',
	gray: 'gray-500',
	lightgray: 'gray-300',
	white: 'white',
	gold: 'gold',
};

// Map existing icon names to Lucide icon components
const iconComponents = {
	'circle-open': Circle,
	bullet: Circle,
	dot: Circle,
	circle: CircleOff,
	period: CircleDot,
	check: Check,
	warning: AlertTriangle,
	error: AlertCircle,
	times: X,
	trophy: Trophy,
	frown: Frown,
	hourglass: Hourglass,
	scale: Scale,
	'circle-check': CircleCheck,
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
	hook: Webhook,
	'log-in': LogIn,
	'log-out': LogOut,
	alert: CircleAlert,
	search: Search,
	// Filter icons from useFiltersStore
	bounce: LogOut,
	user: User,
	conversion: Target,
	parameters: Settings,
	campaign: Megaphone,
	source: Milestone,
	medium: Radio,
	term: Tag,
	content: FileText,
	location: MapPin,
	city: Building,
	'operating-system': Monitor,
	browser: Globe,
	// Filter category icons
	traffic: Car,
	behavior: Brain,
	technology: Cpu,
	// Star icons
	'star-filled': Star,
	'star-outline': Star,
	'map-pinned': MapPinned,
	// Additional icons
	empty: CircleOff,
	grid: Grid3x3,
	'user-check': UserRoundCheck,
	'user-plus': UserRoundPlus,
	'line-squiggle': LineSquiggle,
	'shopping-cart': ShoppingCart,
	'party-popper': PartyPopper,
	'error-octagon': OctagonAlert,
	'warning-triangle': TriangleAlert,
	'percent': Percent
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
	style?: React.CSSProperties;
}

const Icon = memo( ( { style = {}, name = 'bullet', color = 'black', size = 18, strokeWidth = 1.5, tooltip, onClick, className }: IconProps ) => {
	// Get color value from our color mappings or use the provided color directly
	const colorVal = iconColors[ color as keyof typeof iconColors ] || color;

	// Get the icon component or fallback to Circle
	const IconComponent = iconComponents[ name as keyof typeof iconComponents ] || Circle;

	// Create the icon component props
	const iconProps: LucideProps = {
		size,
		color: 'currentColor',
		strokeWidth,
		style
	};

	/**
	 * Render the icon with special handling for certain icons
	 *
	 * @returns {JSX.Element} The rendered icon component
	 */
	const renderIcon = () => {
		// Special handling for bullet and dot icons - they should be filled
		if ( ( name === 'bullet' || name === 'dot' ) && IconComponent === Circle ) {
			return <Circle {...iconProps} className={ colorVal && `fill-${colorVal}`} />;
		}

		// Special handling for star-filled - should be filled
		if ( name === 'star-filled' && IconComponent === Star ) {
			return <Star {...iconProps} className={ colorVal && `fill-${colorVal}`} />;
		}

		return <IconComponent className={ clsx( className, colorVal && `text-${colorVal}` ) } { ...iconProps } />;
	};

	/**
	 * Handle click event
	 *
	 * @returns void
	 */
	const handleClick = () => {
		if ( onClick ) {
			onClick();
		}
	};

	const iconElement = (
		<div onClick={ () => handleClick() } className='flex items-center justify-center'>
			{ renderIcon() }
		</div>
	);

	if ( tooltip ) {
		return <Tooltip content={ tooltip }>{ iconElement }</Tooltip>;
	}

	return iconElement;
});

export default Icon;
