import { __ } from '@wordpress/i18n';
import type { TourStep } from '@/store/useTourStore';

export interface TourSection {
	id: string;
	title: string;
	description: string;
	icon: string;
	route: string;
	startStepId: string;
	stepIds: string[];
}

interface SectionDefinition {
	id: string;
	title: string;
	description: string;
	icon: string;
	route: string;
}

const SECTION_DEFINITIONS: SectionDefinition[] = [
	{
		id: 'overview',
		title: __( 'Dashboard overview', 'burst-statistics' ),
		description: __( 'Live traffic, daily summary metrics, and conversion goals.', 'burst-statistics' ),
		icon: '⚡',
		route: '/'
	},
	{
		id: 'insights',
		title: __( 'Detailed insights & graphs', 'burst-statistics' ),
		description: __( 'Metric trends, date ranges, shareable links, and community comparisons.', 'burst-statistics' ),
		icon: '📈',
		route: '/statistics'
	},
	{
		id: 'datatables',
		title: __( 'Data tables & page analytics', 'burst-statistics' ),
		description: __( 'Interactive row filtering, deep-dive per-page metrics, and expandable rows.', 'burst-statistics' ),
		icon: '📋',
		route: '/statistics'
	},
	{
		id: 'sources',
		title: __( 'Traffic sources', 'burst-statistics' ),
		description: __( 'Acquisition channels, UTM tracking parameters, and Google Search Console.', 'burst-statistics' ),
		icon: '🌐',
		route: '/sources'
	},
	{
		id: 'ai_chat',
		title: __( 'AI assistant', 'burst-statistics' ),
		description: __( 'Ask questions and gain actionable insights using the conversational AI assistant.', 'burst-statistics' ),
		icon: '🤖',
		route: '/sources'
	},
	{
		id: 'engagement',
		title: __( 'Reading engagement', 'burst-statistics' ),
		description: __( 'Time on page, scroll depth, and content rankings.', 'burst-statistics' ),
		icon: '📖',
		route: '/engagement'
	},
	{
		id: 'reporting',
		title: __( 'Automated reports wizard', 'burst-statistics' ),
		description: __( 'Story report builder, block selections, recipients, and automated email delivery.', 'burst-statistics' ),
		icon: '📊',
		route: '/reporting/reports'
	},
	{
		id: 'customization',
		title: __( 'Report customization & branding', 'burst-statistics' ),
		description: __( 'Brand email reports with custom logos, accent colors, hero headers, and custom CSS.', 'burst-statistics' ),
		icon: '🎨',
		route: '/reporting/customization'
	},
	{
		id: 'goals',
		title: __( 'Conversion goals setup', 'burst-statistics' ),
		description: __( 'Create and customize conversion goals with visual selector and block tracking.', 'burst-statistics' ),
		icon: '🎯',
		route: '/settings/goals'
	},
	{
		id: 'settings',
		title: __( 'Settings, privacy & advanced', 'burst-statistics' ),
		description: __( 'Privacy controls, low-traffic auto updates, and stealth Ghost Mode.', 'burst-statistics' ),
		icon: '⚙️',
		route: '/settings/general'
	}
];

function getRuntimeSteps(): TourStep[] {
	if ( 'undefined' !== typeof window ) {
		const steps = ( window as unknown as { burst_settings?: { tour?: { steps?: TourStep[] } } })?.burst_settings?.tour?.steps;
		if ( Array.isArray( steps ) && 0 < steps.length ) {
			return steps;
		}
	}
	return [];
}

function getSections( steps: TourStep[] = []): TourSection[] {
	const stepList = 0 < steps.length ? steps : getRuntimeSteps();
	return SECTION_DEFINITIONS.map( ( def ) => {
		const matchingSteps = stepList.filter( ( s ) => s.section === def.id );
		const contentStep = matchingSteps.find( ( s ) => {
			if ( ! def.route || ! s.route ) {
				return true;
			}
			return s.route === def.route || s.route.startsWith( def.route );
		}) || matchingSteps[ 0 ];

		return {
			...def,
			startStepId: contentStep?.id || '',
			stepIds: matchingSteps.map( ( s ) => s.id )
		};
	});
}

export const TOUR_SECTIONS: TourSection[] = getSections();

/**
 * Returns the TourSection that contains the given step ID or matches step.section.
 */
export function getSectionForStep( stepId: string, steps: TourStep[] = []): TourSection | undefined {
	const stepList = 0 < steps.length ? steps : getRuntimeSteps();
	const step = stepList.find( ( s ) => s.id === stepId );
	if ( step?.section ) {
		return getSectionById( step.section, stepList );
	}
	const sections = getSections( stepList );
	return sections.find( ( section ) => section.stepIds.includes( stepId ) );
}

/**
 * Returns the TourSection by its ID.
 */
export function getSectionById( sectionId: string, steps: TourStep[] = []): TourSection | undefined {
	const stepList = 0 < steps.length ? steps : getRuntimeSteps();
	const sections = getSections( stepList );
	const found = sections.find( ( section ) => section.id === sectionId );
	if ( found ) {
		return found;
	}
	const def = SECTION_DEFINITIONS.find( ( s ) => s.id === sectionId );
	if ( def ) {
		return {
			...def,
			startStepId: '',
			stepIds: []
		};
	}
	return undefined;
}

/**
 * Finds the starting content step index in the steps array for a given section ID,
 * skipping any transitional click_tab prompts that belong to previous routes.
 */
export function getSectionContentStartIndex( sectionId: string, steps: TourStep[] = []): number {
	const section = getSectionById( sectionId, steps );
	if ( ! section ) {
		return 0;
	}
	const sectionSteps = steps
		.map( ( s, i ) => ({ step: s, index: i }) )
		.filter( ( item ) => item.step.section === sectionId );

	if ( 0 === sectionSteps.length ) {
		return 0;
	}

	const matchingRouteStep = sectionSteps.find( ( item ) => {
		if ( ! section.route || ! item.step.route ) {
			return true;
		}
		return item.step.route === section.route || item.step.route.startsWith( section.route );
	});

	return matchingRouteStep ? matchingRouteStep.index : sectionSteps[ 0 ].index;
}

/**
 * Finds the starting step index in the steps array for a given section ID.
 */
export function getSectionStartingStepIndex( sectionId: string, steps: TourStep[]): number {
	return getSectionContentStartIndex( sectionId, steps );
}
