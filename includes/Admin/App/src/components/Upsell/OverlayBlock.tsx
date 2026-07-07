import React, { ReactNode } from 'react';
import { Block } from '@/components/Blocks/Block';
import { BlockHeading } from '@/components/Blocks/BlockHeading';
import { BlockContent } from '@/components/Blocks/BlockContent';
import UpsellOverlay from '@/components/Upsell/UpsellOverlay';

interface OverlayBlockProps {

	/** Heading shown at the top of the block. */
	title: ReactNode;

	/** Faint, blurred placeholder label rendered behind the overlay card. */
	blurLabel: string;

	/** Overlay card content (e.g. UpsellCopy or ActivationCopy). */
	children: ReactNode;

	/** Extra classes forwarded to the wrapping Block (e.g. grid placement). */
	className?: string;
}

/**
 * Dashboard block that shows a blurred placeholder with a centered call-to-action
 * card on top. Shared shell for gated blocks — Pro upsells (UpsellCopy) and
 * integration activation prompts (ActivationCopy) drop into `children`.
 *
 * @param {OverlayBlockProps} props - Component props.
 * @return {JSX.Element} The rendered overlay block.
 */
const OverlayBlock: React.FC<OverlayBlockProps> = ({
	title,
	blurLabel,
	children,
	className = ''
}) => {
	return (
		<Block className={ `${ className } relative min-h-[320px] overflow-hidden` }>
			<BlockHeading title={ title } />
			<BlockContent className="px-0 py-0 overflow-y-auto">
				<div className="flex h-48 flex-col items-center justify-center p-4 text-center text-sm text-gray-400 select-none blur-[1px]">
					<p className="font-medium text-gray-500 mb-1">{ blurLabel }</p>
				</div>
				<UpsellOverlay
					className="flex items-center justify-center pt-0 mt-0 m-0 border-0 bg-transparent"
					containerClassName="pt-1 m-1 mt-4"
					cardClassName="mx-4 min-w-fit rounded-md border border-gray-300 bg-gray-100 px-6 py-6 shadow-sm"
				>
					{ children }
				</UpsellOverlay>
			</BlockContent>
		</Block>
	);
};

export default OverlayBlock;
