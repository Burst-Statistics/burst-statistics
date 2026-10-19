import { __, sprintf } from '@wordpress/i18n';

type MeasuringStateProps = {

	/** How far sampling has come towards enough samples per page, 0 to 1. */
	samplingProgress: number;
};

/**
 * Placeholder shown while too few pages have been sampled to report on.
 *
 * Page weight is sampled during normal visits, so a fresh install has nothing
 * to show for the first weeks. Saying so plainly beats a chart built on three
 * measurements.
 *
 * @param {MeasuringStateProps} props - Component props.
 * @return {JSX.Element} The measuring placeholder.
 */
const MeasuringState = ({ samplingProgress }: MeasuringStateProps ) => {
	const percentage = Math.round( samplingProgress * 100 );

	return (
		<div className="flex flex-col gap-3 px-5 py-4">
			<p className="font-semibold text-text-black">
				{ __( 'Measuring your pages…', 'burst-statistics' ) }
			</p>
			<p className="text-sm text-text-gray">
				{ __( 'Burst samples page weight during normal visits. Results appear once enough pages are measured.', 'burst-statistics' ) }
			</p>
			<div
				className="h-2 w-full overflow-hidden rounded-full bg-gray-200"
				role="progressbar"
				aria-valuenow={percentage}
				aria-valuemin={0}
				aria-valuemax={100}
			>
				<div className="h-full rounded-full bg-green" style={{ width: `${ percentage }%` }} />
			</div>
			<p className="text-sm text-text-gray">
				{ sprintf(

					/* translators: %d is how far page weight sampling has come, as a percentage. */
					__( 'Sampling is %d%% complete', 'burst-statistics' ),
					percentage
				) }
			</p>
		</div>
	);
};

export default MeasuringState;
