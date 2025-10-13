import React, { forwardRef, InputHTMLAttributes } from "react";

interface HiddenInputProps extends InputHTMLAttributes<HTMLInputElement> {
    type?: string;
}

/**
 * Styled text input component
 * @param props - Props for the input component
 * @returns {JSX.Element} The rendered input element
 */
const HiddenInput = forwardRef<HTMLInputElement, HiddenInputProps>(({ type = "hidden", className, ...props }, ref) => {
    return (
        <input
            ref={ref}
            type="hidden"
            {...props}
        />
    );
});

HiddenInput.displayName = 'HiddenInput';

export default HiddenInput;
