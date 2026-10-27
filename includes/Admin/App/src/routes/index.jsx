import { createFileRoute, notFound } from '@tanstack/react-router';
import OverviewBlock from '@/components/Dashboard/OverviewBlock';
import TodayBlock from '@/components/Dashboard/TodayBlock';
import GoalsBlock from '@/components/Dashboard/GoalsBlock';
import TipsTricksBlock from '@/components/Dashboard/TipsTricksBlock';
import OtherPluginsBlock from '@/components/Dashboard/OtherPluginsBlock';

import { shouldLoadRoute } from '@/utils/helper';
import { useIsFeatureEnabled } from '@/hooks/useIsFeatureEnabled';

export const Route = createFileRoute( '/' )({

	// Throwing notFound in beforeLoad does not render header.
	loader: ({ context }) => {
		if ( context?.menus && ! shouldLoadRoute( 'dashboard', context.menus ) ) {
			throw notFound();
		}
	},
	component: Dashboard
});

function Dashboard() {
	const isGoalsEnabled = useIsFeatureEnabled( 'goals' );

	return (
		<>
			<OverviewBlock />
			<TodayBlock />
			{ isGoalsEnabled && <GoalsBlock /> }
			<TipsTricksBlock />
			<OtherPluginsBlock />
		</>
	);
}
