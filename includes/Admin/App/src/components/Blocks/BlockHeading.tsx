import { memo, ReactNode } from 'react';
import { BlockHeadingReport } from './BlockHeadingReport';
import { BlockHeadingStandard } from './BlockHeadingStandard';

type BlockHeadingProps = {
	title: ReactNode;
	controls?: ReactNode;
	className?: string;
	isReport?: boolean;
	reportBlockIndex?: number;
	isLoading?: boolean;
};

/**
 * Wrapper component that conditionally renders the appropriate heading type.
 *
 * @param {Object}           props                 - Component props.
 * @param {React.ReactNode}  props.title            - The heading title.
 * @param {React.ReactNode}  props.controls         - Optional controls to render on the right side.
 * @param {string}           props.className        - Additional CSS classes.
 * @param {boolean}          props.isReport         - Whether this is a report view.
 * @param {number}           props.reportBlockIndex - Index of the block in the report's content array (for report views only).
 * @param {boolean}          props.isLoading        - Whether the block is currently loading.
 * @return {JSX.Element} The block heading component.
 */
export const BlockHeading = memo( ({ title, controls, className = '', isReport = false, reportBlockIndex, isLoading = false }: BlockHeadingProps ) => {
	if ( isReport ) {
		return <BlockHeadingReport title={title} controls={controls} className={className} reportBlockIndex={reportBlockIndex} />;
	}

	return <BlockHeadingStandard title={title} controls={controls} className={className} isLoading={isLoading} />;
});

BlockHeading.displayName = 'BlockHeading';
