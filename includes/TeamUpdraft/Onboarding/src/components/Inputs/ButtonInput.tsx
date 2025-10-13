import { clsx } from "clsx";

interface ButtonInputProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  link?: string;
  btnVariant?: "primary" | "secondary" | "tertiary" | "danger";
  disabled?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
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
  ...props
}) => {
  const classes = clsx(
    // Base styles for all button variants
    "rounded text-center transition-all duration-200",
    // Variant-specific styles
    {
      "bg-primary text-white hover:bg-primary hover:[box-shadow:0_0_0_3px_rgba(43,129,51,0.5)]": btnVariant === "primary",
      "bg-wp-blue text-white border border-accent-dark hover:bg-wp-blue hover:[box-shadow:0_0_0_3px_rgba(34,113,177,0.5)]": btnVariant === "secondary",
      "border border-gray-400 bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray hover:[box-shadow:0_0_0_3px_rgba(0,0,0,0.1)]": btnVariant === "tertiary",
      "bg-red text-white hover:bg-red hover:[box-shadow:0_0_0_3px_rgba(198,39,59,0.5)]": btnVariant === "danger",
    },
    // Size-specific styles
    {
      "py-0.5 px-3 text-sm font-normal": size === "sm",    // Small: Reduced padding and smaller text
      "py-1.5 px-4 text-base font-medium": size === "md",       // Medium (default): Standard padding and text size
      "py-3 px-8 text-lg font-semibold": size === "lg",     // Large: Increased padding and larger, bolder text
    },
    // Disabled styles
    {
      "opacity-50 cursor-not-allowed": disabled,
    },
      className
  );

  if (link) {
    return (
      <a href={link} target={"_blank"} className={classes}>
        {children}
      </a>
    );
  }

  return (
    <button
      type={props.type || "button"}
      onClick={onClick}
      className={classes}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
};

ButtonInput.displayName = "ButtonInput";

export default ButtonInput;
