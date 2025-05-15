import {createFileRoute} from '@tanstack/react-router';
import ProgressBlock from '@/components/Dashboard/ProgressBlock';
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
        <ProgressBlock/>
        <TodayBlock/>
        <GoalsBlock/>
        <TipsTricksBlock/>
        <OtherPluginsBlock/>
      </>
  );
}
