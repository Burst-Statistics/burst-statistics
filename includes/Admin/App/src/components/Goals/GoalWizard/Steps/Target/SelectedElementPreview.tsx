import { __ } from '@wordpress/i18n';
import type useSelectorMatches from '@/hooks/useSelectorMatches';
import MatchStepper from '@/components/Goals/GoalWizard/Fields/MatchStepper';

/**
 * The matched element as it looks on the site, with a stepper when the selector matches more than one.
 *
 * @param {Object} props         Component props.
 * @param {Object} props.matches Match state of the selector.
 * @return {JSX.Element} The preview.
 */
const SelectedElementPreview = ({ matches }: { matches: ReturnType<typeof useSelectorMatches> }): JSX.Element => (
	<div className="flex flex-col gap-2 sm:w-2/5 shrink-0">
		{0 < matches.previews.length ? (
			<iframe
				srcDoc={matches.previews[ matches.previewIndex ]}
				sandbox=""
				title={__( 'Selected element', 'burst-statistics' )}
				className="h-44 w-full rounded border border-gray-200 bg-white"
				aria-live="polite"
			/>
		) : (
			<div className="flex h-44 w-full items-center justify-center rounded border border-dashed border-gray-300 bg-gray-50 text-sm text-text-gray-light">
				{matches.isTesting ? __( 'Looking for the element…', 'burst-statistics' ) : __( 'No preview', 'burst-statistics' )}
			</div>
		)}
		{1 < matches.previews.length && (
			<MatchStepper index={matches.previewIndex} total={matches.previews.length} onStep={matches.stepPreview} />
		)}
	</div>
);

export default SelectedElementPreview;
