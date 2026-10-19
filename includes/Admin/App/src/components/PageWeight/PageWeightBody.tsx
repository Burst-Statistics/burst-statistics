import { usePageWeightStore } from '@/store/usePageWeightStore';
import { useDisplayFigures } from './useDisplayFigures';
import { getFooterSections } from './footerSections';
import { isMeasuring } from './usePageWeightData';
import PageWeightContent from './PageWeightContent';
import PageWeightFooter from './PageWeightFooter';
import type { PageWeightData } from './usePageWeightData';

type PageWeightBodyProps = {

	/** The block payload, or null before the first response. */
	data: PageWeightData | null;

	/** Whether the block's data request is in flight. */
	isLoading: boolean;

	/** Whether a green hosting check is in flight. */
	isChecking: boolean;

	/** Starts a green hosting check. */
	onCheck: () => void;
};

/**
 * Everything below the Page weight title bar.
 *
 * Until enough pageviews sit on measured pages this shows no figures, because
 * an average over a handful of samples is noise (see PageWeightContent). The footer
 * is outside that choice on purpose: checking the site's hosting does not
 * depend on having measured any pages, so it shows in both states.
 *
 * @param {PageWeightBodyProps} props - Component props.
 * @return {JSX.Element|null} The block body, or null before the first response.
 */
const PageWeightBody = ({ data, isLoading, isChecking, onCheck }: PageWeightBodyProps ) => {
	const showCo2 = usePageWeightStore( ( state ) => state.showCo2 );
	const showRating = usePageWeightStore( ( state ) => state.showRating );
	const { figures, isPreviewing } = useDisplayFigures( data );

	if ( null === data || null === figures ) {
		return null;
	}

	const measuring = isMeasuring( data );
	const sections = getFooterSections({ figures, isPreviewing, measuring, showCo2, showRating });

	return (
		<>
			<PageWeightContent data={data} measuring={measuring} isLoading={isLoading} />

			<PageWeightFooter
				figures={sections.figures}
				showEstimate={sections.showEstimate}
				showRating={sections.showRating}
				isAssumed={sections.isAssumed}
				measuredRatio={data.measured_ratio}
				greenHosting={data.green_hosting}
				isChecking={isChecking}
				onCheck={onCheck}
			/>
		</>
	);
};

export default PageWeightBody;
