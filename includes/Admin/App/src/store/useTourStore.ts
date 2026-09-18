import { create } from 'zustand';
const lazyTourReset = () => import( '@/components/Tour/tourReset' );
import {
	getSectionStartingStepIndex,
	getSectionById,
	getSectionForStep,
	getSectionContentStartIndex,
	TOUR_SECTIONS
} from '@/components/Tour/tourSections';

import { doAction, getAction } from '@/utils/api';
import { getLocalStorage, setLocalStorage, removeLocalStorage } from '@/utils/storage';

export type TourStepAction =
	| 'click_tab'
	| 'change_date_range'
	| 'click_element'
	| 'open_modal'
	| 'hover_element'
	| 'change_metrics'
	| 'apply_filter'
	| 'toggle_columns'
	| 'generate_share_link';

export interface TourStep {
	id: string;
	feature_id?: string;
	section?: string;
	keep_open?: 'sheet' | 'wizard' | 'chat';
	title: string;
	text: string;
	pro?: boolean;
	anchor: string;
	placement?: 'top' | 'bottom' | 'left' | 'right' | 'center' | 'auto';
	action?: TourStepAction;
	route?: string;
	target_url?: string;
	delay?: number;
}

interface LocalizedTourData {
	active?: boolean;
	tour_id?: string;
	steps?: TourStep[];
	completed_features?: string[];
	mock_data_enabled?: boolean;
	last_section?: string;
	completed?: boolean;
}

interface TourState {
	tourActive: boolean;
	tourId: string;
	stepIndex: number;
	steps: TourStep[];
	completedFeatures: string[];
	mockDataActive: boolean;
	isHotspotActive: boolean;
	interactionComplete: boolean;
	lastSectionId: string;
	isResumeModalOpen: boolean;
	startTour: ( tourId?: string, customSteps?: TourStep[]) => void | Promise<void>;
	stopTour: () => void;
	setStepIndex: ( index: number ) => void;
	nextStep: () => void;
	prevStep: () => void;
	setIsHotspotActive: ( active: boolean ) => void;
	setInteractionComplete: ( complete: boolean ) => void;
	completeFeature: ( featureId: string ) => Promise<void>;
	dismissTour: () => Promise<void>;
	updateSectionProgress: ( sectionId: string ) => Promise<void>;
	markTourCompleted: () => Promise<void>;
	setIsResumeModalOpen: ( open: boolean ) => void;
	resumeFromSection: ( sectionId: string ) => void;
	restartTour: () => void;
}

// Read localized settings if available on page load.
const initialData: LocalizedTourData = ( window as unknown as { burst_settings?: { tour?: LocalizedTourData } })?.burst_settings?.tour || {};

const rawSteps = Array.isArray( initialData.steps ) ? initialData.steps : [];

export const ensureTourInUrl = () => {
	if ( 'undefined' !== typeof window ) {
		try {
			const burstSettings = ( window as unknown as { burst_settings?: { tour?: LocalizedTourData } })?.burst_settings;
			if ( burstSettings ) {
				burstSettings.tour = {
					...( burstSettings.tour || {}),
					active: true,
					mock_data_enabled: true
				};
			}
			const url = new URL( window.location.href );
			if ( 'dashboard' !== url.searchParams.get( 'tour' ) ) {
				url.searchParams.set( 'tour', 'dashboard' );
				window.history.replaceState({}, '', url.pathname + ( url.search ? url.search : '' ) + url.hash );
			}
		} catch {

			// ignore
		}
	}
};

const removeTourFromUrl = () => {
	if ( 'undefined' !== typeof window ) {
		try {
			const burstSettings = ( window as unknown as { burst_settings?: { tour?: LocalizedTourData } })?.burst_settings;
			if ( burstSettings?.tour ) {
				burstSettings.tour.active = false;
				burstSettings.tour.mock_data_enabled = false;
			}
			const url = new URL( window.location.href );
			if ( url.searchParams.has( 'tour' ) ) {
				url.searchParams.delete( 'tour' );
				window.history.replaceState({}, '', url.pathname + ( url.search ? url.search : '' ) + url.hash );
			}
		} catch {

			// ignore
		}
	}
};

export const invalidateAllBurstQueries = () => {
	if ( 'undefined' !== typeof window ) {
		try {
			const qc = ( window as unknown as { __burst_query_client?: { invalidateQueries: () => void } }).__burst_query_client;
			if ( qc ) {
				qc.invalidateQueries();
			}
		} catch {

			// ignore
		}
	}
};

// The tour cannot run inside the MainWP dashboard: its entry points are not
// offered there and a stray ?tour parameter on the dashboard URL is ignored.
const isTourSupported = true !== ( window as unknown as { burst_settings?: { is_mainwp?: boolean } })?.burst_settings?.is_mainwp;
const isUrlTourActive = isTourSupported && 'undefined' !== typeof window && new URLSearchParams( window.location.search ).has( 'tour' );
const isInitialTourActive = isTourSupported && Boolean( initialData.active || isUrlTourActive );

const resolveLastSection = ( candidateA?: string | null, candidateB?: string | null ): string => {
	if ( candidateA && 'overview' !== candidateA ) {
		return candidateA;
	}
	if ( candidateB && 'overview' !== candidateB ) {
		return candidateB;
	}
	return candidateA || candidateB || 'overview';
};

const rawLocalStorageSection = getLocalStorage<string | null>( 'tour_last_section', null );
const storedLastSection = resolveLastSection( rawLocalStorageSection, initialData.last_section );

// A tour is completed only if the server explicitly records it as completed
// and there is no active uncompleted progress to resume.
const isServerCompleted = Boolean( initialData.completed );
const hasProgressToResume = Boolean( storedLastSection && 'overview' !== storedLastSection );
const storedCompleted = Boolean( isServerCompleted && ! hasProgressToResume );

const shouldShowResumeInitially = Boolean( isInitialTourActive && ! storedCompleted && hasProgressToResume );

// If tour is requested/active on initial load, synchronize URL and defaults
if ( isInitialTourActive ) {
	ensureTourInUrl();
	if ( ! shouldShowResumeInitially ) {
		void lazyTourReset().then( ( m ) => {
			m.snapshotPreTourLocalStorage();
			m.resetDashboardToTourDefaults();
		});
	}
}

const fetchTourSteps = async( tourId: string = 'dashboard' ): Promise<TourStep[]> => {
	try {
		const response = await getAction( 'tour_steps', { tour_id: tourId }) as { success: boolean; tour_id: string; steps: TourStep[] };
		return Array.isArray( response?.steps ) ? response.steps : [];
	} catch ( e ) {
		console.debug( 'Failed to fetch tour steps', e );
		return [];
	}
};

// Mark the tour active server side: the mutation interceptor keys on that
// flag, and fetching the steps is a read that no longer sets it.
const markTourActiveOnServer = async(): Promise<void> => {
	try {
		await doAction( 'tour_resume' );
	} catch ( e ) {
		console.debug( 'Tour resume sync failed', e );
	}
};

const prepareTourSession = async( currentSteps: TourStep[], tourId: string ): Promise<TourStep[]> => {
	let steps = currentSteps;
	if ( 0 === steps.length ) {
		steps = await fetchTourSteps( tourId );
	}

	await markTourActiveOnServer();
	ensureTourInUrl();
	void lazyTourReset().then( ( m ) => {
		m.snapshotPreTourLocalStorage();
		m.resetDashboardToTourDefaults();
	});
	return steps;
};

export const useTourStore = create<TourState>( ( set, get ) => ({
	tourActive: Boolean( isInitialTourActive && ! shouldShowResumeInitially ),
	tourId: initialData.tour_id || 'dashboard',
	stepIndex: 0,
	steps: rawSteps,
	completedFeatures: Array.isArray( initialData.completed_features ) ? initialData.completed_features : [],
	mockDataActive: isInitialTourActive,
	isHotspotActive: false,
	interactionComplete: false,
	lastSectionId: storedLastSection,
	isResumeModalOpen: shouldShowResumeInitially,

	startTour: async( tourId = 'dashboard', customSteps ) => {
		if ( ! isTourSupported ) {
			return;
		}
		const rawStoreSection = get().lastSectionId;
		const rawLocalSection = getLocalStorage<string | null>( 'tour_last_section', null );
		const effectiveLastSection = resolveLastSection(
			resolveLastSection( rawStoreSection, rawLocalSection ),
			initialData.last_section
		);

		let steps = customSteps || ( 0 < rawSteps.length ? rawSteps : get().steps );

		if ( 0 === steps.length ) {
			steps = await fetchTourSteps( tourId );
		}

		ensureTourInUrl();

		// If user has previous section progress (beyond overview), ask if they want to resume
		if ( effectiveLastSection && 'overview' !== effectiveLastSection ) {
			set({
				tourId,
				steps,
				lastSectionId: effectiveLastSection,
				isResumeModalOpen: true,
				tourActive: false,
				mockDataActive: true
			});
			return;
		}

		await markTourActiveOnServer();
		void lazyTourReset().then( ( m ) => {
			m.snapshotPreTourLocalStorage();
			m.resetDashboardToTourDefaults();
		});
		set({
			tourActive: true,
			tourId,
			stepIndex: 0,
			steps,
			mockDataActive: true,
			isHotspotActive: false,
			interactionComplete: false,
			isResumeModalOpen: false
		});
		invalidateAllBurstQueries();
	},

	setIsResumeModalOpen: ( isResumeModalOpen: boolean ) => {
		set({ isResumeModalOpen });
	},

	resumeFromSection: async( sectionId: string ) => {
		const steps = await prepareTourSession( get().steps, get().tourId || 'dashboard' );

		const startStepIndex = getSectionStartingStepIndex( sectionId, steps );
		const section = getSectionById( sectionId, steps );

		if ( 'undefined' !== typeof window && section ) {
			window.location.hash = '#' + section.route;
		}

		set({
			steps,
			tourActive: true,
			stepIndex: startStepIndex,
			lastSectionId: sectionId,
			mockDataActive: true,
			isHotspotActive: false,
			interactionComplete: false,
			isResumeModalOpen: false
		});

		invalidateAllBurstQueries();
		void get().updateSectionProgress( sectionId );
	},

	restartTour: async() => {
		const steps = await prepareTourSession( get().steps, get().tourId || 'dashboard' );

		removeLocalStorage( 'tour_last_section' );
		removeLocalStorage( 'tour_completed' );
		try {
			void doAction( 'tour_reset' );
		} catch ( e ) {
			console.debug( 'Tour reset sync failed', e );
		}

		if ( 'undefined' !== typeof window ) {
			window.location.hash = '#/';
		}

		set({
			steps,
			tourActive: true,
			stepIndex: 0,
			lastSectionId: 'overview',
			mockDataActive: true,
			isHotspotActive: false,
			interactionComplete: false,
			isResumeModalOpen: false
		});

		invalidateAllBurstQueries();
		void get().updateSectionProgress( 'overview' );
	},

	stopTour: () => {
		void lazyTourReset().then( ( m ) => {
			m.restorePreTourLocalStorage();
		});
		removeTourFromUrl();
		set({
			tourActive: false,
			mockDataActive: false,
			isHotspotActive: false,
			interactionComplete: false,
			isResumeModalOpen: false
		});
		invalidateAllBurstQueries();
	},

	setStepIndex: ( index: number ) => {
		const { steps } = get();
		if ( 0 <= index && index < steps.length ) {
			set({ stepIndex: index, interactionComplete: false });
		}
	},

	nextStep: () => {
		const { stepIndex, steps } = get();
		if ( stepIndex < steps.length - 1 ) {
			set({ stepIndex: stepIndex + 1, isHotspotActive: false, interactionComplete: false });
		} else {
			void get().markTourCompleted();
			get().dismissTour();
		}
	},

	prevStep: () => {
		const { stepIndex, steps } = get();
		if ( 0 >= stepIndex || 0 === steps.length ) {
			return;
		}

		const currentStep = steps[ stepIndex ];
		if ( ! currentStep ) {
			return;
		}

		const currentSection = getSectionForStep( currentStep.id, steps );
		const currentSectionIndex = TOUR_SECTIONS.findIndex( ( s ) => s.id === currentSection?.id );
		const currentSectionStart = currentSection ?
			getSectionContentStartIndex( currentSection.id, steps ) :
			0;

		let targetStepIndex = 0;
		let targetSection = currentSection;

		if ( stepIndex > currentSectionStart ) {
			targetStepIndex = currentSectionStart;
		} else if ( 0 < currentSectionIndex ) {
			const prevSection = TOUR_SECTIONS[ currentSectionIndex - 1 ];
			targetSection = prevSection;
			targetStepIndex = getSectionContentStartIndex( prevSection.id, steps );
		} else {
			return;
		}

		if ( targetSection?.route && 'undefined' !== typeof window ) {
			const curPath = ( window.location.hash || '' ).replace( /^#/, '' ) || '/';
			if ( curPath !== targetSection.route && ! curPath.startsWith( targetSection.route ) ) {
				window.location.hash = '#' + targetSection.route;
			}
		}

		if ( targetSection?.id ) {
			void get().updateSectionProgress( targetSection.id );
		}

		set({ stepIndex: targetStepIndex, isHotspotActive: false, interactionComplete: false });
	},

	setIsHotspotActive: ( isHotspotActive: boolean ) => {
		set({ isHotspotActive });
	},

	setInteractionComplete: ( interactionComplete: boolean ) => {
		set({ interactionComplete });
	},

	updateSectionProgress: async( sectionId: string ) => {
		set({ lastSectionId: sectionId });

		setLocalStorage( 'tour_last_section', sectionId );

		try {
			await doAction( 'tour_progress', { section_id: sectionId });
		} catch ( e ) {
			console.debug( 'Section progress sync failed', e );
		}
	},

	markTourCompleted: async() => {
		setLocalStorage( 'tour_completed', true );

		try {
			await doAction( 'tour_progress', { completed: true });
		} catch ( e ) {
			console.debug( 'Tour completion sync failed', e );
		}
	},

	completeFeature: async( featureId: string ) => {
		const { completedFeatures } = get();
		if ( completedFeatures.includes( featureId ) ) {
			return;
		}

		set({ completedFeatures: [ ...completedFeatures, featureId ] });

		try {
			await doAction( 'tour_complete_feature', { feature_id: featureId });
		} catch ( e ) {

			// Non-blocking telemetry
			console.debug( 'Feature completion sync failed', e );
		}
	},

	dismissTour: async() => {
		get().stopTour();

		try {
			await doAction( 'tour_dismiss' );
		} catch ( e ) {
			console.debug( 'Tour dismiss sync failed', e );
		}

		if ( 'undefined' !== typeof window ) {
			const url = new URL( window.location.href );
			url.searchParams.delete( 'tour' );

			// Remove hash routing subpath and reset to burst dashboard index
			window.location.href = url.pathname + ( url.search ? url.search : '' );
		}
	}
}) );

export const isTourActive = (): boolean => {
	if ( 'undefined' === typeof window ) {
		return false;
	}
	try {
		const state = useTourStore.getState();
		return Boolean( state.tourActive || state.mockDataActive || state.isResumeModalOpen );
	} catch {
		return new URLSearchParams( window.location.search ).has( 'tour' );
	}
};

if ( 'undefined' !== typeof window ) {
	( window as unknown as { __burst_is_tour_active?: () => boolean }).__burst_is_tour_active = isTourActive;
}

