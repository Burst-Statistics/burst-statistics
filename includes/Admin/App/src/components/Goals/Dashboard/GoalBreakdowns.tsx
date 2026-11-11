import { useMemo } from 'react';
import { __ } from '@wordpress/i18n';
import DataTableBlock from '@/components/Statistics/DataTableBlock';
import ErrorBoundary from '@/components/Common/ErrorBoundary';
import OverlayBlock from '@/components/Upsell/OverlayBlock';
import UpsellCopy from '@/components/Upsell/UpsellCopy';
import useLicenseData from '@/hooks/useLicenseData';
import { isTourActive } from '@/store/useTourStore';

interface GoalBreakdownsProps {
	goalId: number;
}

/**
 * Where a goal's conversions come from: sources and entry pages (Pro).
 *
 * The existing statistics blocks, fixed to this goal. Their datatable ids are
 * the statistics ones, so access, query shapes and share routing stay as they are.
 *
 * @param {GoalBreakdownsProps} props        Component props.
 * @param {number}              props.goalId The goal.
 * @return {JSX.Element} The breakdown blocks, or the upsell.
 */
const GoalBreakdowns = ({ goalId }: GoalBreakdownsProps ): JSX.Element => {
	const { isLicenseValid } = useLicenseData();

	// Filters are strings, like the ones read from the URL.
	const filters = useMemo( () => ({ goal_id: String( goalId ) }), [ goalId ]);

	if ( ! isTourActive() && ! isLicenseValid ) {
		return (
			<OverlayBlock
				className="col-span-12"
				dataTour="goal-breakdowns"
				title={__( 'Where conversions come from', 'burst-statistics' )}
				blurLabel={__( 'Goal breakdowns are a Pro feature.', 'burst-statistics' )}
			>
				<UpsellCopy type="goals" compact={true} />
			</OverlayBlock>
		);
	}

	return (
		<>
			<div className="col-span-12 flex flex-col @xl:col-span-6" data-tour="goal-breakdowns">
				<ErrorBoundary>
					<DataTableBlock allowedConfigs={[ 'referrers' ]} id="statistics_referrers" customFilters={filters} focusConversions />
				</ErrorBoundary>
			</div>
			<div className="col-span-12 flex flex-col @xl:col-span-6">
				<ErrorBoundary>
					<DataTableBlock allowedConfigs={[ 'pages' ]} id="statistics_pages" customFilters={filters} focusConversions />
				</ErrorBoundary>
			</div>
		</>
	);
};

export default GoalBreakdowns;
