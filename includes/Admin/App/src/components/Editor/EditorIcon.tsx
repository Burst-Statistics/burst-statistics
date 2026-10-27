import React from 'react';

interface EditorIconProps {
	className?: string;
	size?: number;
	strokeWidth?: number;
	style?: React.CSSProperties;
}

/**
 * Three-bar vertical chart icon matching Burst statistics branding.
 *
 * @param props             - Component properties.
 * @param props.className   - Tailwind classes for color/sizing.
 * @param props.size        - Icon dimensions (square).
 * @param props.strokeWidth - SVG stroke width.
 * @param props.style       - Inline style attributes.
 * @return SVG element.
 */
export const EditorIcon: React.FC<EditorIconProps> = ({
	className = 'text-green-600',
	size = 18,
	strokeWidth = 2.5,
	style
}) => (
	<svg
		width={ size }
		height={ size }
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		strokeWidth={ strokeWidth }
		strokeLinecap="round"
		strokeLinejoin="round"
		className={ className }
		style={ style }
		aria-hidden="true"
	>
		<path d="M6 20V14" />
		<path d="M12 20V8" />
		<path d="M18 20V4" />
	</svg>
);
