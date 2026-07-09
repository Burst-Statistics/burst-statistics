import React, { ReactNode } from 'react';

interface UpsellOverlayProps {
	children: ReactNode;
	className?: string;
	containerClassName?: string;
	cardClassName?: string;
}

/**
 * UpsellOverlay component that displays an overlay with upsell content.
 * Used to promote premium features or license activation.
 *
 * @param {ReactNode} children  - The content to display in the overlay.
 * @param {string}    className - Additional CSS classes for styling.
 * @return {JSX.Element} The rendered overlay component.
 */
const UpsellOverlay: React.FC<UpsellOverlayProps> = ({
	children,
	className = '',
	containerClassName = 'pt-8 m-8 mt-24',
	cardClassName = 'mx-4 min-w-fit rounded-md border border-gray-300 bg-gray-100 px-8 py-12 shadow-sm'
}) => {
	return (
		<div
			className={`burst-upsell-overlay absolute inset-0 z-50 ${className}`}
		>
			{/* Backdrop with blur effect and lttle darker */}
			<div className="absolute inset-0 backdrop-blur-sm" />

			{/* Content container positioned at top-middle */}
			<div className={`relative flex justify-center ${containerClassName}`}>
				<div className={cardClassName}>
					{children}
				</div>
			</div>
		</div>
	);
};

export default UpsellOverlay;
