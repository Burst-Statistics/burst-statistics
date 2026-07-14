import React from 'react';

// fallow-ignore-next-line complexity
export const handleButtonActivationKey = ({
	e,
	onClick,
	disabled,
	onKeyDown
}: {
	e: React.KeyboardEvent<HTMLButtonElement>;
	onClick?: React.MouseEventHandler<HTMLButtonElement>;
	disabled?: boolean;
	onKeyDown?: React.KeyboardEventHandler<HTMLButtonElement>;
}) => {
	if ( ( 'Enter' === e.key || ' ' === e.key ) && onClick && ! disabled ) {
		e.preventDefault();
		onClick( e as unknown as React.MouseEvent<HTMLButtonElement> );
	}

	onKeyDown?.( e );
};

export const getDefinedAriaAttributes = (
	attributes: Record<string, unknown>
): Record<string, unknown> => {
	return Object.fromEntries(
		Object.entries( attributes ).filter( ([ , value ]) => value !== undefined )
	);
};
