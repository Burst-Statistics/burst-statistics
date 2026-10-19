import MetricInfo from '@/components/Common/MetricInfo';
import { ExpandTableButton } from '@/components/Blocks/ExpandTableButton';

type ExpandableBlockTitleProps = {
	metricKey: string;
	label: string;
	hasData: boolean;
	onExpand: () => void;
};

/**
 * Shared block-heading title: a MetricInfo label plus an expand-to-overlay
 * button shown once data exists. Used by compact dashboard blocks that open
 * their full table in the DataTableOverlay.
 *
 * @param {ExpandableBlockTitleProps} props - Metric key/label, whether to show the expand button, and its handler.
 * @return {JSX.Element} The block title content.
 */
const ExpandableBlockTitle = ({ metricKey, label, hasData, onExpand }: ExpandableBlockTitleProps ) => (
	<>
		<MetricInfo metricKey={ metricKey } side="bottom">
			{ label }
		</MetricInfo>
		{ hasData && <ExpandTableButton onClick={ onExpand } /> }
	</>
);

export default ExpandableBlockTitle;
