import { forwardRef, TextareaHTMLAttributes } from "react";

interface TextAreaInputProps
  extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  rows?: number;
}

/**
 * Styled textarea input component
 */
const TextAreaInput = forwardRef<HTMLTextAreaElement, TextAreaInputProps>(
  ({ className, rows = 4, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        rows={rows}
        className={`w-full rounded-md border border-gray-400 p-2 focus:border-primary-dark focus:outline-none focus:ring disabled:cursor-not-allowed disabled:border-gray-200 disabled:bg-gray-200 ${className || ""}`}
        {...props}
      />
    );
  },
);

TextAreaInput.displayName = "TextAreaInput";

export default TextAreaInput;
