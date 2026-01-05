import { clsx } from 'clsx';
import Icon from '@/utils/Icon';

interface IconButtonProps
	extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onClick'> {
	onClick?: React.MouseEventHandler<HTMLButtonElement>;
	icon?: string;
	iconSize?: number;
	label?: string;
	variant?: 'default' | 'dashed' | 'solid';
	size?: 'sm' | 'md' | 'lg';
	disabled?: boolean;
	className?: string;
	ariaLabel?: string;
}

/**
 * A versatile icon button component that supports icons with optional labels.
 *
 * Variants:
 * - "default" - Standard button styling.
 * - "dashed" - Dashed border style (used for AddFilterButton).
 * - "solid" - Solid background button.
 *
 * Sizes:
 * - "sm" - Small padding and text.
 * - "md" - Default spacing.
 * - "lg" - Increased padding and larger text.
 *
 * @param {IconButtonProps} props - Props for configuring the button.
 * @return {JSX.Element} The rendered button component.
 */
const IconButton: React.FC<IconButtonProps> = ({
	onClick,
	icon,
	iconSize = 16,
	label,
	variant = 'default',
	size = 'md',
	disabled = false,
	className = '',
	ariaLabel,
	...props
}) => {
	const handleKeyDown = ( e: React.KeyboardEvent<HTMLButtonElement> ) => {

		// Handle keyboard activation for custom onClick handlers.
		if ( ( 'Enter' === e.key || ' ' === e.key ) && onClick && ! disabled ) {
			e.preventDefault();
			onClick( e as any ); // eslint-disable-line @typescript-eslint/no-explicit-any
		}

		// Call any existing onKeyDown handler.
		if ( props.onKeyDown ) {
			props.onKeyDown( e );
		}
	};

	const classes = clsx(

		// Base styles for all button variants.
		'inline-flex items-center gap-2 rounded-md transition-all duration-200 cursor-pointer',
		'focus:outline-none focus:ring-2 focus:ring-offset-2',

		// Variant-specific styles.
		{

			// Default variant - minimal styling.
			'bg-transparent border border-transparent hover:bg-gray-50':
				'default' === variant,

			// Dashed variant - matches AddFilterButton style exactly.
			'bg-white border border-gray-300 border-dashed shadow-sm hover:bg-gray-50 hover:[box-shadow:0_0_0_3px_rgba(0,0,0,0.05)]':
				'dashed' === variant,

			// Solid variant - filled background.
			'bg-gray-100 border border-gray-300 hover:bg-gray-200':
				'solid' === variant
		},

		// Size-specific styles.
		{
			'py-1 px-2 text-xs': 'sm' === size,
			'py-2 px-3 text-sm': 'md' === size,
			'py-3 px-4 text-base': 'lg' === size
		},

		// Disabled styles.
		{
			'opacity-50 cursor-not-allowed focus:ring-0 focus:ring-offset-0':
				disabled
		},
		className
	);

	// Build ARIA attributes, filtering out undefined values.
	const ariaAttributes = Object.fromEntries(
		Object.entries({
			'aria-label': ariaLabel || label,
			'aria-disabled': disabled ? true : undefined
		}).filter( ([ _, value ]) => value !== undefined ) // eslint-disable-line @typescript-eslint/no-unused-vars
	);

	return (
		<button
			type={props.type || 'button'}
			onClick={onClick}
			onKeyDown={handleKeyDown}
			className={classes}
			disabled={disabled}
			{...ariaAttributes}
			{...props}
		>
			{icon && <Icon name={icon} size={iconSize} />}
			{label && <span className="font-medium text-base">{label}</span>}
		</button>
	);
};

IconButton.displayName = 'IconButton';

export default IconButton;

