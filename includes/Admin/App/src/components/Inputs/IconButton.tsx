import { forwardRef } from 'react';
import { clsx } from 'clsx';
import Icon from '@/utils/Icon';

interface IconButtonProps
	extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onClick'> {
	onClick?: React.MouseEventHandler<HTMLButtonElement>;
	icon?: string;
	iconSize?: number;
	iconPosition?: 'left' | 'right';
	label?: string;
	variant?:
		| 'primary'
		| 'secondary'
		| 'tertiary'
		| 'danger'
		| 'default'
		| 'dashed'
		| 'solid';
	size?: 'sm' | 'md' | 'lg';
	disabled?: boolean;
	className?: string;
	ariaLabel?: string;
	ariaPressed?: boolean;
	ariaExpanded?: boolean;
}

/**
 * A versatile icon button component that supports icons with optional labels.
 *
 * Variants:
 * - "primary", "secondary", "tertiary", and "danger" mirror ButtonInput styles.
 * - "default" maps to "secondary" for backward compatibility.
 * - "solid" maps to "tertiary" for backward compatibility.
 * - "dashed" keeps a custom dashed style for AddFilterButton.
 *
 * Sizes:
 * - "sm" - Small padding and text.
 * - "md" - Default spacing.
 * - "lg" - Increased padding and larger text.
 *
 * @param {IconButtonProps} props - Props for configuring the button.
 * @return {JSX.Element} The rendered button component.
 */
const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>( (
	{
		onClick,
		icon,
		iconSize = 16,
		iconPosition = 'left',
		label,
		variant = 'solid',
		size = 'md',
		disabled = false,
		className = '',
		ariaLabel,
		ariaPressed,
		ariaExpanded,
		...props
	},
	ref
) => {
	const hasLabel = Boolean( label );
	const shouldRenderIconOnRight = hasLabel && 'right' === iconPosition;
	const normalizedVariant =
		'default' === variant ?
			'secondary' :
			'solid' === variant ?
				'tertiary' :
				variant;

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
		'inline-flex items-center gap-2 rounded transition-all duration-200 min-w-fit cursor-pointer',
		'focus:outline-hidden focus:ring-2 focus:ring-offset-2',
		{ 'justify-center': ! hasLabel },

		// Variant-specific styles.
		{

		// Mirror ButtonInput variants to keep a consistent button look.
			'bg-primary text-text-white hover:bg-primary hover:shadow-ringPrimary focus:ring-primary':
			'primary' === normalizedVariant,
			'bg-blue text-text-white border border-blue-700 hover:bg-wp-blue hover:shadow-ringSecondary focus:ring-blue':
			'secondary' === normalizedVariant,
			'border border-gray-400 bg-gray-100 text-text-gray hover:bg-gray-200 hover:text-gray hover:shadow-ringNeutral focus:ring-gray-400':
			'tertiary' === normalizedVariant,
			'bg-red text-text-white hover:bg-red hover:shadow-ringDanger focus:ring-red':
			'danger' === normalizedVariant,

			// Keep custom dashed styling used by AddFilterButton.
			'bg-white border border-gray-300 border-dashed shadow-sm hover:bg-gray-50 hover:shadow-ringSubtle':
			'dashed' === normalizedVariant
		},

		// Size-specific styles.
		{
			'py-0.5 px-3 text-sm font-normal': hasLabel && 'sm' === size,
			'py-1 px-4 text-base font-medium': hasLabel && 'md' === size,
			'py-2 px-4 text-base font-medium': hasLabel && 'lg' === size,
			'p-1 text-sm font-normal': ! hasLabel && 'sm' === size,
			'p-2 text-base font-medium': ! hasLabel && 'md' === size,
			'p-2.5 text-base font-medium': ! hasLabel && 'lg' === size
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
			'aria-pressed': ariaPressed,
			'aria-expanded': ariaExpanded,
			'aria-disabled': disabled ? true : undefined
		}).filter( ([ _, value ]) => value !== undefined ) // eslint-disable-line @typescript-eslint/no-unused-vars
	);

	return (
		<button
			ref={ref}
			type={props.type || 'button'}
			onClick={onClick}
			onKeyDown={handleKeyDown}
			className={classes}
			disabled={disabled}
			{...ariaAttributes}
			{...props}
		>
			{icon && ! shouldRenderIconOnRight && <Icon name={icon} size={iconSize} />}
			{label && <span>{label}</span>}
			{icon && shouldRenderIconOnRight && <Icon name={icon} size={iconSize} />}
		</button>
	);
});

IconButton.displayName = 'IconButton';

export default IconButton;

