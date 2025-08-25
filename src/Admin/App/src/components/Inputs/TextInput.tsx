import { forwardRef, InputHTMLAttributes } from "react";

interface TextInputProps extends InputHTMLAttributes<HTMLInputElement> {
  type?: string;
}

interface TextInputProps extends InputHTMLAttributes<HTMLInputElement> {
  storedValue?: string; // Add the storedValue property
}

/**
 * Styled text input component
 * @param props - Props for the input component
 * @returns {JSX.Element} The rendered input element
 */
const TextInput = forwardRef<HTMLInputElement, TextInputProps>(
  ({ type = "text", className, ...props }, ref) => {
    return (
      <input
        ref={ref}
        type={type}
        className={`w-full rounded-md border border-gray-400 p-2 focus:border-primary-dark focus:outline-none focus:ring disabled:cursor-not-allowed disabled:border-gray-200 disabled:bg-gray-200 ${className || ""}`}
        {...props}
      />
    );
  },
);

TextInput.displayName = "TextInput";

export default TextInput;
