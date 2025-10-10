import {createFileRoute} from '@tanstack/react-router';
import OverviewBlock from '@/components/Dashboard/OverviewBlock';
import TodayBlock from '@/components/Dashboard/TodayBlock';
import GoalsBlock from '@/components/Dashboard/GoalsBlock';
import TipsTricksBlock from '@/components/Dashboard/TipsTricksBlock';
import OtherPluginsBlock from '@/components/Dashboard/OtherPluginsBlock';

export const Route = createFileRoute( '/' )({
  component: Dashboard
});

function Dashboard() {
  return (
      <>
        <OverviewBlock />
        <TodayBlock />
        <GoalsBlock />
        <TipsTricksBlock />
        <OtherPluginsBlock />
      </>
  );
}
