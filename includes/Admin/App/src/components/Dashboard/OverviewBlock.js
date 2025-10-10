import { useEffect } from 'react';
import { Block } from '@/components/Blocks/Block';
import { BlockHeading } from '@/components/Blocks/BlockHeading';
import { BlockContent } from '@/components/Blocks/BlockContent';
import { BlockFooter } from '@/components/Blocks/BlockFooter';
import { __ } from '@wordpress/i18n';
import Tasks from './Tasks';
import OverviewFooter from '@/components/Dashboard/OverviewFooter';
import { useNonPersistedTabsStore } from '@/store/useTabsStore'
import LiveTraffic from '@/components/Dashboard/LiveTraffic'
import { TabsContent, TabsList } from "@/components/Common/Tabs";

/**
 * Framer Motion variants for list items.
 *
 * @param {number} index - The index of the item in the list.
 *
 * @return {Object} Variants for Framer Motion.
 */
export const listSlideAnimation = ( index ) => ( {
	initial: {
		opacity: 0,
		y: -20,
	},
	animate: {
		opacity: 1,
		y: 0,
		transition: {
			delay: index * 0.05,
			duration: 0.3,
			ease: 'easeOut',
		},
	},
	exit: {
		opacity: 0,
		y: 30,
		transition: {
			duration: 0.3,
			ease: 'easeIn',
		},
	},
} );

/**
 * OverviewBlock component to display tasks overview
 *
 * @return { React.ReactElement } OverviewBlock component
 */
const OverviewBlock = () => {
	const tabGroup = 'dashboard-overview';
	const activeTab = useNonPersistedTabsStore( ( state ) => state.getActiveTab( 'dashboard-overview' ) );
	const setActiveTab = useNonPersistedTabsStore( ( state ) => state.setActiveTab );
	useEffect(
		/**
		 * Set default active tab to 'activity' on mount.
		 */
		() => {
			setActiveTab( tabGroup, 'activity' );
		},
		[]
	);
	const tabConfig = [
		{
			id: 'activity',
			title: __( 'Activity', 'burst-statistics' ),
		},
		{
			id: 'live-visitors',
			title: __( 'Live visitors', 'burst-statistics' ),
		},
	]

	return (
		<Block className="row-span-2 lg:col-span-12 xl:col-span-6">
			<BlockHeading
				title={ __( 'Overview', 'burst-statistics' ) }
				className='border-b border-gray-200'
				controls={
					<TabsList
						tabConfig={ tabConfig }
						tabGroup={ tabGroup }
					/>
				} />
			<BlockContent className="px-0 py-0 border-b border-gray-200">
				{
					activeTab === 'activity' &&
					<TabsContent className="bg-blue-light" group={ tabGroup } id='activity'>
						<Tasks />
					</TabsContent>
				}
				{
					activeTab === 'live-visitors' &&
					<TabsContent className="bg-brand-lightest" group={ tabGroup } id='live-visitors'>
						<LiveTraffic />
					</TabsContent>
				}
			</BlockContent>

			<BlockFooter>
				<OverviewFooter />
			</BlockFooter>
		</Block>
	);
};

export default OverviewBlock;
