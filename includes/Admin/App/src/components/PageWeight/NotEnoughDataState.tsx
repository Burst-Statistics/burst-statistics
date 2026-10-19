import { __ } from '@wordpress/i18n';

/**
 * Shown for a closed range that had too few measured pages by its end.
 *
 * A past range is weighed with the weights known when it ended, so new
 * samples never fill it in. Unlike the measuring state this shows no progress,
 * since there is none to show, and points to Today, where progress moves.
 *
 * @return {JSX.Element} The empty state.
 */
const NotEnoughDataState = () => (
	<div className="flex flex-col gap-3 px-5 py-4">
		<p className="font-semibold text-text-black">
			{ __( 'Not enough page weight data for this period', 'burst-statistics' ) }
		</p>
		<p className="text-sm text-text-gray">
			{ __( 'By the end of this period Burst had measured too few pages. Select Today to follow the measuring progress.', 'burst-statistics' ) }
		</p>
	</div>
);

export default NotEnoughDataState;
