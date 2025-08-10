import { Link } from "@tanstack/react-router";
import { clsx } from "clsx";

interface ButtonInputProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  link?: { to: string; from?: string };
  btnVariant?: "primary" | "secondary" | "tertiary" | "danger";
  disabled?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
  ariaLabel?: string;
  ariaPressed?: boolean;
  ariaExpanded?: boolean;
}

/**
 * A versatile button component that can render as either a <button> or a <Link> element.
 *
 * Use the `btnVariant` prop to adjust the visual style:
 * - "primary" for a green-themed button.
 * - "secondary" for a blue-themed button.
 * - "tertiary" for a neutral, gray-themed button.
 * - "danger" for a red-themed button.
 *
 * The `size` prop controls button dimensions:
 * - "sm" for smaller padding and text.
 * - "md" for default spacing.
 * - "lg" for increased padding and larger, bolder text.
 *
 * @param {ButtonInputProps} props - Props for configuring the button.
 * @returns {JSX.Element} The rendered button or link component.
 */
const ButtonInput: React.FC<ButtonInputProps> = ({
  children,
  onClick,
  link,
  btnVariant = "secondary",
  disabled = false,
  size = "md",
  className = "",
  ariaLabel,
  ariaPressed,
  ariaExpanded,
  ...props
}) => {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    // Handle keyboard activation for custom onClick handlers
    if ((e.key === 'Enter' || e.key === ' ') && onClick && !disabled) {
      e.preventDefault();
      onClick(e as any);
    }
    
    // Call any existing onKeyDown handler
    if (props.onKeyDown) {
      props.onKeyDown(e);
    }
  };

  const classes = clsx(
    // Base styles for all button variants
    "rounded transition-all duration-200 min-w-fit",
    // Focus styles (distinct from hover)
    "focus:outline-none focus:ring-2 focus:ring-offset-2",
    // Variant-specific styles
    {
      "bg-primary text-white hover:bg-primary hover:[box-shadow:0_0_0_3px_rgba(43,129,51,0.5)] focus:ring-primary":
        btnVariant === "primary",
      "bg-wp-blue text-white border border-accent-dark hover:bg-wp-blue hover:[box-shadow:0_0_0_3px_rgba(34,113,177,0.5)] focus:ring-wp-blue":
        btnVariant === "secondary",
      "border border-gray-400 bg-gray-100 text-gray hover:bg-gray-200 hover:text-gray hover:[box-shadow:0_0_0_3px_rgba(0,0,0,0.1)] focus:ring-gray-400":
        btnVariant === "tertiary",
      "bg-red text-white hover:bg-red hover:[box-shadow:0_0_0_3px_rgba(198,39,59,0.5)] focus:ring-red":
        btnVariant === "danger",
    },
    // Size-specific styles
    {
      "py-0.5 px-3 text-sm font-normal": size === "sm", // Small: Reduced padding and smaller text
      "py-1 px-4 text-base font-medium": size === "md", // Medium (default): Standard padding and text size
      "py-3 px-8 text-lg font-semibold": size === "lg", // Large: Increased padding and larger, bolder text
    },
    // Disabled styles
    {
      "opacity-50 cursor-not-allowed focus:ring-0 focus:ring-offset-0": disabled,
    },
    className,
  );

  // Build ARIA attributes, filtering out undefined values
  const ariaAttributes = Object.fromEntries(
    Object.entries({
      'aria-label': ariaLabel,
      'aria-pressed': ariaPressed,
      'aria-expanded': ariaExpanded,
      'aria-disabled': disabled ? true : undefined,
    }).filter(([_, value]) => value !== undefined)
  );

  if (link) {
    if (disabled) {
      // Render as disabled span when link is provided but component is disabled
      return (
        <span 
          className={classes}
          {...ariaAttributes}
          tabIndex={-1}
          role="button"
        >
          {children}
        </span>
      );
    }
    
    return (
      <Link 
        to={link.to} 
        className={classes}
        {...ariaAttributes}
        tabIndex={0}
        role="button"
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            // Link navigation will be handled by the Link component
            (e.target as HTMLElement).click();
          }
        }}
      >
        {children}
      </Link>
    );
  }

  return (
    <button
      type={props.type || "button"}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      className={classes}
      disabled={disabled}
      {...ariaAttributes}
      {...props}
    >
      {children}
    </button>
  );
};

ButtonInput.displayName = "ButtonInput";

export default ButtonInput;
