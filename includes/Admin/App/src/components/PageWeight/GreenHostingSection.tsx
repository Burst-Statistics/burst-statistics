import useShareableLinkStore from '@/store/useShareableLinkStore';
import { GreenHostingStatus, hasCurrentCheck } from './GreenHostingMeta';
import GreenHostingActions from './GreenHostingActions';
import type { GreenHostingState } from './usePageWeightData';

type GreenHostingSectionProps = {

	/** Green hosting state behind the check action. */
	greenHosting: GreenHostingState;

	/** Whether a green hosting check is in flight. */
	isChecking: boolean;

	/** Starts a green hosting check. */
	onCheck: () => void;

	/** Spacing applied when an estimate sits above this section. */
	className?: string;
};

/**
 * The green hosting status and the check that sets it.
 *
 * Present in every state of the block, including while measuring: checking the
 * site's hosting does not depend on having measured any pages. Shared-link and
 * PDF viewers only see the status: the check is a manager-only write.
 *
 * @param {GreenHostingSectionProps} props - Component props.
 * @return {JSX.Element} The green hosting section.
 */
const GreenHostingSection = ({
	greenHosting,
	isChecking,
	onCheck,
	className = ''
}: GreenHostingSectionProps ) => {
	const isShareableLinkViewer = useShareableLinkStore( ( state ) => state.isShareableLinkViewer );
	const canCheck = ! isShareableLinkViewer && Boolean( window.burst_settings?.manage_burst_statistics );

	return (
		<div className={className}>
			<p className="text-xs text-text-gray">
				<GreenHostingStatus greenHosting={greenHosting} />
			</p>

			{ canCheck && (
				<GreenHostingActions
					hasResult={hasCurrentCheck( greenHosting )}
					isChecking={isChecking}
					onCheck={onCheck}
				/>
			) }
		</div>
	);
};

export default GreenHostingSection;
