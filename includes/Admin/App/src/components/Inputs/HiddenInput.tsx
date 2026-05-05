import React, { forwardRef, InputHTMLAttributes } from 'react';

interface HiddenInputProps extends InputHTMLAttributes<HTMLInputElement> {
	type?: string;
}

/**
 * Styled text input component
 * @param  props - Props for the input component
 * @return {JSX.Element} The rendered input element
 */
const HiddenInput = forwardRef<HTMLInputElement, HiddenInputProps>(
	({ type = 'hidden', className = '', ...props }, ref ) => {
		return <input className={ className } ref={ref} type={ type } {...props} />;
	}
);

HiddenInput.displayName = 'HiddenInput';

export default HiddenInput;
