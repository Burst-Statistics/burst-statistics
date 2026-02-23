import { memo, ReactNode } from 'react';
import { BlockHeadingReport } from './BlockHeadingReport';
import { BlockHeadingStandard } from './BlockHeadingStandard';

type BlockHeadingProps = {
	title: string;
	controls?: ReactNode;
	className?: string;
	isReport?: boolean;
	reportBlockIndex?: number;
};

/**
 * Wrapper component that conditionally renders the appropriate heading type.
 *
 * @param {Object} props - Component props.
 * @param {string} props.title - The heading title.
 * @param {React.ReactNode} props.controls - Optional controls to render on the right side.
 * @param {string} props.className - Additional CSS classes.
 * @param {boolean} props.isReport - Whether this is a report view.
 * @param {number} props.reportBlockIndex - Index of the block in the report's content array (for report views only).
 * @return {JSX.Element} The block heading component.
 */
export const BlockHeading = memo( ({ title, controls, className = '', isReport = false, reportBlockIndex }: BlockHeadingProps ) => {
	if ( isReport ) {
		return <BlockHeadingReport title={title} controls={controls} className={className} reportBlockIndex={reportBlockIndex} />;
	}

	return <BlockHeadingStandard title={title} controls={controls} className={className} />;
});

BlockHeading.displayName = 'BlockHeading';
