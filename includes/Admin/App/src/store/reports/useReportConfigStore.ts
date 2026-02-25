import { create } from 'zustand';
import { __, sprintf } from '@wordpress/i18n';
import {
	ReportFormat,
	WizardStep,
	DayOfWeekType,
	FrequencyType,
	ContentItems,
	WeekOfMonthType, ReportLogStatus, ReportLogSeverity, BlockComponentProps
} from './types';
import InsightsBlock from '@/components/Statistics/InsightsBlock';
import CompareBlock from '@/components/Statistics/CompareBlock';
import DevicesBlock from '@/components/Statistics/DevicesBlock';
import WorldMapBlock from '@/components/Sources/WorldMapBlock';
import DataTableBlock from '@/components/Statistics/DataTableBlock';
import Sales from '@/components/Sales/Sales';
import TopPerformers from '@/components/Sales/TopPerformers';
import FunnelChartSection from '@/components/Sales/FunnelChartSection';
import Logo from '@/components/Reporting/ReportWizard/Blocks/Logo';
import {ComponentType} from 'react';
const AVAILABLE_CONTENT: ContentItems = [
	{
		id: 'logo',
		label: __( 'Logo', 'burst-statistics' ),
		icon: 'image',
		pro: false,
		component: Logo
	},
	{
		id: 'insights',
		label: __( 'Insights', 'burst-statistics' ),
		icon: 'bulb',
		pro: true,
		component: InsightsBlock
	},
	{
		id: 'compare_story',
		label: __( 'Compare', 'burst-statistics' ),
		icon: 'arrow-down-up',
		pro: true,
		component: CompareBlock
	},
	{
		id: 'compare',
		label: __( 'Compare', 'burst-statistics' ),
		icon: 'arrow-down-up',
		pro: false
	},
	{
		id: 'devices',
		label: __( 'Devices', 'burst-statistics' ),
		icon: 'mobile',
		pro: true,
		component: DevicesBlock
	},
	{
		id: 'world',
		label: __( 'World Map', 'burst-statistics' ),
		icon: 'world',
		pro: true,
		component: WorldMapBlock
	},
	{
		id: 'pages',
		label: __( 'Pages', 'burst-statistics' ),
		icon: 'page',
		pro: true,
		component: DataTableBlock as ComponentType<BlockComponentProps>,
		blockProps: { allowedConfigs: [ 'pages' ] }
	},
	{
		id: 'referrers',
		label: __( 'Referrers', 'burst-statistics' ),
		icon: 'external-link',
		pro: true,
		component: DataTableBlock as ComponentType<BlockComponentProps>,
		blockProps: { allowedConfigs: [ 'referrers' ] }
	},
	{
		id: 'locations',
		label: __( 'Locations', 'burst-statistics' ),
		icon: 'map-pinned',
		pro: true,
		component: DataTableBlock as ComponentType<BlockComponentProps>,
		blockProps: { allowedConfigs: [ 'locations' ] }
	},
	{
		id: 'campaigns',
		label: __( 'Campaigns', 'burst-statistics' ),
		icon: 'campaign',
		pro: true,
		component: DataTableBlock as ComponentType<BlockComponentProps>,
		blockProps: { allowedConfigs: [ 'campaigns' ] }
	},
	{
		id: 'sales',
		label: __( 'Sales', 'burst-statistics' ),
		icon: 'shopping-cart',
		pro: true,
		component: Sales,
		ecommerce: true
	},
	{
		id: 'top_performers',
		label: __( 'Top Performers', 'burst-statistics' ),
		icon: 'trophy',
		pro: true,
		component: TopPerformers,
		ecommerce: true
	},
	{
		id: 'funnel',
		label: __( 'Funnel', 'burst-statistics' ),
		icon: 'filter',
		pro: true,
		component: FunnelChartSection,
		ecommerce: true
	},
	{
		id: 'most_visited_pages',
		label: __( 'Most visited pages', 'burst-statistics' ),
		icon: 'page',
		pro: false
	},
	{
		id: 'top_referrers',
		label: __( 'Top referrers', 'burst-statistics' ),
		icon: 'external-link',
		pro: false
	},
	{
		id: 'top_campaigns',
		label: __( 'Top campaigns', 'burst-statistics' ),
		icon: 'campaign',
		pro: true
	},
	{
		id: 'countries',
		label: __( 'Top countries', 'burst-statistics' ),
		icon: 'world',
		pro: true
	}
];

const STATUS_SEVERITY_CLASSES = {
	success: 'bg-green-light text-green',
	error: 'bg-red-light text-red',
	warning: 'bg-gray-200 text-black',
	info: 'bg-blue-light text-blue'
};

const REPORT_LOG_STATUS_CONFIG: Record<
	ReportLogStatus,
	{
		severity: ReportLogSeverity;
	}
> = {
	ready_to_send: {
		severity: 'info'
	},
	sending_successful: {
		severity: 'success'
	},
	sending_failed: {
		severity: 'error'
	},
	email_domain_error: {
		severity: 'error'
	},
	email_address_error: {
		severity: 'error'
	},
	partly_sent: {
		severity: 'error'
	},
	cron_miss: {
		severity: 'warning'
	},
	concept: {
		severity: 'warning'
	},
	scheduled: {
		severity: 'info'
	},
	processing: {
		severity: 'info'
	}
};

const STEPS: WizardStep[] = [
	{ number: 1, label: __( 'Create', 'burst-statistics' ), fields: [ 'create' ] },
	{ number: 2, label: __( 'Edit', 'burst-statistics' ), fields: [ 'editContent' ] },
	{ number: 3, label: __( 'Schedule', 'burst-statistics' ), fields: [ 'recipients' ] },
	{ number: 4, label: __( 'Review', 'burst-statistics' ), fields: [ 'reportName' ] }
];

const FORMATS: ReportFormat[] = [
	{ key: 'classic', label: __( 'Classic', 'burst-statistics' ), disabled: false, pro: false },
	{ key: 'story', label: __( 'Story', 'burst-statistics' ), disabled: true, pro: true }
];

const capitalize = ( value: string ) =>
	value.charAt( 0 ).toUpperCase() + value.slice( 1 );

export const useReportConfigStore = create( () => ({
	availableContent: AVAILABLE_CONTENT,
	steps: STEPS,
	stepCount: STEPS.length,
	formats: FORMATS,
	reportLogStatusConfig: REPORT_LOG_STATUS_CONFIG,
	statusSeverityClasses: STATUS_SEVERITY_CLASSES,

	frequencyOptions: [
		{ value: 'daily', label: __( 'Daily', 'burst-statistics' ) },
		{ value: 'weekly', label: __( 'Weekly', 'burst-statistics' ) },
		{ value: 'monthly', label: __( 'Monthly', 'burst-statistics' ) }
	],

	dayOptions: [
		{ value: 'monday', label: __( 'Monday', 'burst-statistics' ) },
		{ value: 'tuesday', label: __( 'Tuesday', 'burst-statistics' ) },
		{ value: 'wednesday', label: __( 'Wednesday', 'burst-statistics' ) },
		{ value: 'thursday', label: __( 'Thursday', 'burst-statistics' ) },
		{ value: 'friday', label: __( 'Friday', 'burst-statistics' ) },
		{ value: 'saturday', label: __( 'Saturday', 'burst-statistics' ) },
		{ value: 'sunday', label: __( 'Sunday', 'burst-statistics' ) }
	],

	getTimeOptions: () =>
		Array.from({ length: 24 }, ( _, i ) => {
			const h = String( i ).padStart( 2, '0' );
			return { value: `${ h }:00`, label: `${ h }:00` };
		}),

	getMonthlyWeekdayOptions: () => [
		{ value: 1, label: __( 'First', 'burst-statistics' ) },
		{ value: 2, label: __( 'Second', 'burst-statistics' ) },
		{ value: 3, label: __( 'Third', 'burst-statistics' ) },
		{ value: -1, label: __( 'Last', 'burst-statistics' ) }
	],

	getWeekOfMonthTypeLabel: (
		rule: WeekOfMonthType,
		dayOfWeek?: DayOfWeekType
	): string => {
		const state = useReportConfigStore.getState();

		const weekLabel = state
			.getMonthlyWeekdayOptions()
			.find( ( o ) => o.value === rule )
			?.label;

		// Rules like "on the 15th" don’t need a weekday.
		if ( ! weekLabel ) {
			return '';
		}

		// Weekday-based rules (e.g. "First Monday").
		if ( dayOfWeek ) {
			const dayLabel = state.dayOptions.find(
				( d ) => d.value === dayOfWeek
			)?.label;

			return dayLabel ? `${ weekLabel } ${ dayLabel }` : weekLabel;
		}

		return weekLabel;
	},

	getScheduleLabel: (
		scheduled: boolean,
		frequency: FrequencyType,
		dayOfWeek?: DayOfWeekType,
		weekOfMonth?: WeekOfMonthType,
		sendTime?: string
	): string => {
		if ( ! scheduled ) {
			return __( 'No schedule', 'burst-statistics' );
		}

		let label: string;

		switch ( frequency ) {
			case 'weekly': {
				if ( ! dayOfWeek ) {
					label = __( 'Weekly', 'burst-statistics' );
					break;
				}

				const day = `${ capitalize( dayOfWeek ) }s`;
				label = sprintf(
					__( 'Weekly on %s', 'burst-statistics' ),
					day
				);
				break;
			}

			case 'monthly': {
				if ( ! weekOfMonth ) {
					label = __( 'Monthly', 'burst-statistics' );
					break;
				}

				const ruleLabel =
					useReportConfigStore
						.getState()
						.getWeekOfMonthTypeLabel( weekOfMonth, dayOfWeek );

				label = sprintf(
					__( 'Monthly on %s', 'burst-statistics' ),
					ruleLabel
				);
				break;
			}

			default:
				label = __( 'Daily', 'burst-statistics' );
		}

		return sendTime ?
			sprintf(
				__( '%s at %s', 'burst-statistics' ),
				label,
				sendTime
			) :
			label;
	}
}) );
