import { __ } from '@wordpress/i18n';
import { BlockContent } from '@/components/Blocks/BlockContent';
import MeasuredView from './MeasuredView';
import MeasuringState from './MeasuringState';
import NotEnoughDataState from './NotEnoughDataState';
import type { PageWeightData } from './usePageWeightData';

type PageWeightContentProps = {

	/** The block payload. */
	data: PageWeightData;

	/** Whether too few pageviews sit on measured pages to show figures. */
	measuring: boolean;

	/** Whether the block's data request is in flight. */
	isLoading: boolean;
};

/**
 * The block's main content: figures, or the reason there are none.
 *
 * A range that reaches now says it is still measuring; a closed range never
 * gains samples, so it says there was not enough data instead of promising
 * results.
 *
 * @param {PageWeightContentProps} props - Component props.
 * @return {JSX.Element} The block content.
 */
const PageWeightContent = ({ data, measuring, isLoading }: PageWeightContentProps ) => {

	// No pageviews in the period is not the same as unmeasured pages: the
	// pages may be fully measured, there is just no traffic to weigh.
	if ( 0 === data.pageviews ) {
		return (
			<BlockContent className="px-0 py-0">
				<p className="px-5 py-4 text-sm text-text-gray">
					{ __( 'No pageviews in this period.', 'burst-statistics' ) }
				</p>
			</BlockContent>
		);
	}

	if ( ! measuring ) {
		return <MeasuredView data={data} isLoading={isLoading} />;
	}

	return (
		<BlockContent className="px-0 py-0">
			{ data.is_ongoing ? (
				<MeasuringState samplingProgress={data.sampling_progress} />
			) : (
				<NotEnoughDataState />
			) }
		</BlockContent>
	);
};

export default PageWeightContent;
