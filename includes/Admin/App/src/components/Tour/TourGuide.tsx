import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from '@tanstack/react-router';
import { useTourStore, TourStepAction, ensureTourInUrl, invalidateAllBurstQueries } from '@/store/useTourStore';
import { TourInteractiveHUD } from './TourTooltip';
import TourActionHint from './TourActionHint';
import TourOverlay from './TourOverlay';
import ResumeTourModal from './ResumeTourModal';
import {
	TOUR_SECTIONS,
	getSectionForStep,
	getSectionStartingStepIndex,
	getSectionContentStartIndex
} from './tourSections';
import {
	resetDashboardToTourDefaults,
	snapshotPreTourLocalStorage,
	restorePreTourLocalStorage
} from './tourReset';
import { useWizardStore } from '@/store/reports/useWizardStore';
import { useInsightsStore } from '@/store/useInsightsStore';
import { useFiltersStore } from '@/store/useFiltersStore';
import { useDataTableStore } from '@/store/useDataTableStore';
import { useTheme } from '@/hooks/useTheme';
import { useDate } from '@/store/useDateStore';
import { __ } from '@wordpress/i18n';

/**
 * Returns true when currentPath satisfies the step target URL.
 * For generic /settings or /reporting, any corresponding sub-page matches.
 * For specific subroutes like /settings/goals or /reporting/customization, only that exact path matches.
 */
function pathMatchesTarget( currentPath: string, targetPath: string, exact = false ): boolean {
	const cur = currentPath.replace( /\/$/, '' );
	const tgt = targetPath.replace( /\/$/, '' );

	if ( cur === tgt ) {
		return true;
	}

	if ( exact ) {
		return false;
	}

	// /reporting or /reporting/reports → any /reporting/* satisfies generic tab
	// Specific subroutes (/reporting/customization, /reporting/logs) require exact match
	const reportingGeneric = '/reporting' === tgt || '/reporting/reports' === tgt;
	if ( reportingGeneric && cur.startsWith( '/reporting' ) ) {
		return true;
	}

	// /settings or /settings/general → any /settings/* satisfies generic tab
	// Specific subroutes (/settings/goals, /settings/features, /settings/advanced) require exact match
	const settingsGeneric = '/settings' === tgt || '/settings/general' === tgt;
	if ( settingsGeneric && cur.startsWith( '/settings' ) ) {
		return true;
	}

	// /engagement → any /engagement/* satisfies the engagement nav tab
	const engagementGeneric = '/engagement' === tgt;
	if ( engagementGeneric && cur.startsWith( '/engagement' ) ) {
		return true;
	}

	// /table/* is an overlay route of /statistics
	if ( cur.startsWith( '/table' ) && ( '/statistics' === tgt || tgt.startsWith( '/statistics' ) ) ) {
		return true;
	}

	if ( '' === tgt || '/' === tgt ) {
		return '/' === cur || '' === cur;
	}
	return false;
}

/**
 * Hook to coordinate advancing the tour upon detecting a user interaction signal.
 * Immediately unsubscribes / cleans up upon receiving the trigger to prevent
 * duplicate scheduled advances during the delay interval.
 */
function useAdvanceOnSignal(
	enabled: boolean,
	stepId: string | undefined,
	tourActive: boolean,
	subscribe: ( onSignal: () => void ) => ( () => void ) | void,
	delay: number,
	onAdvance: () => void,
	setInteractionComplete: ( complete: boolean ) => void
) {
	const advanceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>( null );
	const onAdvanceRef = useRef( onAdvance );
	onAdvanceRef.current = onAdvance;
	const setInteractionCompleteRef = useRef( setInteractionComplete );
	setInteractionCompleteRef.current = setInteractionComplete;

	// Cancel any pending advance timer if step changes, tour is closed, or on unmount
	useEffect( () => {
		return () => {
			if ( advanceTimeoutRef.current ) {
				clearTimeout( advanceTimeoutRef.current );
				advanceTimeoutRef.current = null;
			}
		};
	}, [ stepId, tourActive ]);

	useEffect( () => {
		if ( ! enabled ) {
			return;
		}

		let isTriggered = false;
		let cleanupFn: ( () => void ) | void;

		const handleSignal = () => {
			if ( isTriggered ) {
				return;
			}
			isTriggered = true;

			// Immediately clean up the subscriber to prevent a second trigger
			if ( 'function' === typeof cleanupFn ) {
				cleanupFn();
				cleanupFn = undefined;
			}

			setInteractionCompleteRef.current( true );

			if ( advanceTimeoutRef.current ) {
				clearTimeout( advanceTimeoutRef.current );
			}
			advanceTimeoutRef.current = setTimeout( () => {
				advanceTimeoutRef.current = null;
				onAdvanceRef.current();
			}, delay );
		};

		cleanupFn = subscribe( handleSignal );

		return () => {
			if ( 'function' === typeof cleanupFn ) {
				cleanupFn();
			}
		};
	}, [ enabled, subscribe, delay ]);
}

const FEATURE_ENTRY_STEP_IDS = new Set([
	'overview_intro',
	'prompt_insights_tab',
	'insights_graph_explore',
	'insights_data_table_filter',
	'prompt_sources_tab',
	'sources_channels_breakdown',
	'chat_assistant_tour',
	'prompt_engagement_tab',
	'engagement_reading_block',
	'prompt_reporting_tab',
	'reporting_new_report',
	'reporting_customization_branding',
	'prompt_settings_tab',
	'settings_goal_setup',
	'prompt_general_settings'
]);

const cleanUpOpenFeatureOverlays = () => {
	document.querySelectorAll<HTMLElement>( '[data-radix-popper-content-wrapper]' ).forEach( ( el ) => {
		const close = el.querySelector<HTMLElement>( 'button[aria-label="Close"]' );
		if ( close ) {
			close.click();
		} else {
			document.dispatchEvent( new KeyboardEvent( 'keydown', { key: 'Escape', bubbles: true }) );
		}
	});

	const sheet = document.querySelector<HTMLElement>( '[data-burst-sheet-overlay]' );
	if ( sheet ) {
		document.dispatchEvent( new KeyboardEvent( 'keydown', { key: 'Escape', bubbles: true }) );
	}

	try {
		if ( useWizardStore.getState().isOpen ) {
			useWizardStore.getState().closeWizard();
		}
	} catch {

		// ignore
	}
};

// fallow-ignore-next-line complexity
const TourGuide: React.FC = () => {
	const location = useLocation();
	const { isDarkTheme } = useTheme();

	const tourActive             = useTourStore( ( s ) => s.tourActive );
	const steps                  = useTourStore( ( s ) => s.steps );
	const stepIndex              = useTourStore( ( s ) => s.stepIndex );
	const setStepIndex           = useTourStore( ( s ) => s.setStepIndex );
	const completeFeature        = useTourStore( ( s ) => s.completeFeature );
	const isHotspotActive        = useTourStore( ( s ) => s.isHotspotActive );
	const setIsHotspotActive     = useTourStore( ( s ) => s.setIsHotspotActive );
	const interactionComplete    = useTourStore( ( s ) => s.interactionComplete );
	const setInteractionComplete = useTourStore( ( s ) => s.setInteractionComplete );
	const nextStep               = useTourStore( ( s ) => s.nextStep );
	const isResumeModalOpen      = useTourStore( ( s ) => s.isResumeModalOpen );
	const lastSectionId          = useTourStore( ( s ) => s.lastSectionId );
	const resumeFromSection      = useTourStore( ( s ) => s.resumeFromSection );
	const restartTour            = useTourStore( ( s ) => s.restartTour );
	const setIsResumeModalOpen   = useTourStore( ( s ) => s.setIsResumeModalOpen );
	const updateSectionProgress  = useTourStore( ( s ) => s.updateSectionProgress );
	const stopTour               = useTourStore( ( s ) => s.stopTour );
	const markTourCompleted     = useTourStore( ( s ) => s.markTourCompleted );
	const dismissTour           = useTourStore( ( s ) => s.dismissTour );

	const currentStep    = steps[ stepIndex ];
	const currentAction  = currentStep?.action as TourStepAction | undefined;
	const nextStepRoute  = steps[ stepIndex + 1 ]?.route || '';

	const isFirstStepOfSection = useMemo( () => {
		if ( ! currentStep?.id ) {
			return false;
		}
		if ( FEATURE_ENTRY_STEP_IDS.has( currentStep.id ) ) {
			return true;
		}
		const section = getSectionForStep( currentStep.id, steps );
		return Boolean( section && section.startStepId === currentStep.id );
	}, [ currentStep?.id, steps ]);

	const canSkipFeature = Boolean(
		tourActive &&
		isFirstStepOfSection &&
		stepIndex < steps.length - 1 &&
		! interactionComplete
	);

	const currentSection = useMemo( () => {
		if ( ! currentStep ) {
			return undefined;
		}
		return getSectionForStep( currentStep.id, steps );
	}, [ currentStep, steps ]);

	const currentSectionIndex = useMemo( () => {
		return TOUR_SECTIONS.findIndex( ( s ) => s.id === currentSection?.id );
	}, [ currentSection?.id ]);

	const currentSectionStart = useMemo( () => {
		if ( ! currentSection ) {
			return 0;
		}
		return getSectionContentStartIndex( currentSection.id, steps );
	}, [ currentSection, steps ]);

	const canPrevFeature = Boolean(
		tourActive &&
		( stepIndex > currentSectionStart || 0 < currentSectionIndex )
	);

	const hasResetRef = useRef( false );
	useEffect( () => {
		if ( tourActive && ! hasResetRef.current ) {
			hasResetRef.current = true;
			ensureTourInUrl();
			snapshotPreTourLocalStorage();
			resetDashboardToTourDefaults();
			invalidateAllBurstQueries();
		}
	}, [ tourActive ]);

	// Track completed feature on step change
	useEffect( () => {
		if ( tourActive && currentStep?.feature_id ) {
			completeFeature( currentStep.feature_id );
		}
	}, [ tourActive, stepIndex, currentStep?.feature_id, completeFeature ]);

	// Track and persist section progress on step change
	useEffect( () => {
		if ( tourActive && ! isResumeModalOpen && currentStep?.id ) {
			const sectionId = currentStep.section || getSectionForStep( currentStep.id, steps )?.id;
			if ( sectionId && sectionId !== lastSectionId ) {
				void updateSectionProgress( sectionId );
			}
		}
	}, [ tourActive, isResumeModalOpen, currentStep?.id, currentStep?.section, steps, lastSectionId, updateSectionProgress ]);

	const isClickTabStep          = 'click_tab' === currentAction;
	const isDateRangeStep         = 'change_date_range' === currentAction;
	const isClickElementStep      = 'click_element' === currentAction;
	const isOpenModalStep         = 'open_modal' === currentAction;
	const isHoverStep             = 'hover_element' === currentAction;
	const isChangeMetricsStep     = 'change_metrics' === currentAction;
	const isApplyFilterStep       = 'apply_filter' === currentAction;
	const isToggleColumnsStep     = 'toggle_columns' === currentAction;
	const isGenerateShareLinkStep = 'generate_share_link' === currentAction;

	const [ isDateDropdownOpen, setIsDateDropdownOpen ] = useState( false );

	// Auto-activate hotspot mode on date range step
	useEffect( () => {
		if ( tourActive && isDateRangeStep && ! isHotspotActive ) {
			setIsHotspotActive( true );
		}
	}, [ tourActive, isDateRangeStep, isHotspotActive, setIsHotspotActive ]);

	// Detect when date range popover is opened or closed by observing preset container
	useEffect( () => {
		if ( ! isDateRangeStep || ! isHotspotActive ) {
			if ( isDateDropdownOpen ) {
				setIsDateDropdownOpen( false );
			}
			return;
		}

		const checkDropdown = () => {
			const preset = document.querySelector( '[data-tour^="date-range-preset-"]' );
			const isOpen = Boolean( preset );
			setIsDateDropdownOpen( ( prev ) => ( prev !== isOpen ? isOpen : prev ) );
		};

		checkDropdown();

		const observer = new MutationObserver( checkDropdown );
		const container = document.getElementById( 'burst' ) || document.body;
		observer.observe( container, { childList: true, subtree: true });

		return () => observer.disconnect();
	}, [ isDateRangeStep, isHotspotActive, isDateDropdownOpen ]);

	const effectiveAnchor = useMemo( () => {
		if ( isDateRangeStep && isDateDropdownOpen ) {
			const allTimePreset = document.querySelector( '[data-tour="date-range-preset-all-time"]' );
			if ( allTimePreset ) {
				return '[data-tour="date-range-preset-all-time"]';
			}
		}
		return currentStep?.anchor;
	}, [ isDateRangeStep, isDateDropdownOpen, currentStep?.anchor ]);

	// Smoothly scroll target anchor into view on step change
	useEffect( () => {
		if ( ! tourActive || ! effectiveAnchor ) {
			return;
		}

		let rafId: number;
		let attempts = 0;

		const tryScroll = () => {
			const el = document.querySelector<HTMLElement>( effectiveAnchor );
			if ( el ) {
				const r = el.getBoundingClientRect();
				const isOutside = 60 > r.top || r.bottom > window.innerHeight - 60;
				if ( isOutside && 0 < r.width && 0 < r.height ) {
					el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
				}
			} else if ( 25 > attempts ) {
				attempts++;
				rafId = requestAnimationFrame( tryScroll );
			}
		};

		const timer = setTimeout( tryScroll, 60 );
		return () => {
			clearTimeout( timer );
			cancelAnimationFrame( rafId );
		};
	}, [ tourActive, effectiveAnchor, stepIndex ]);

	// ─────────────────────────────────────────────────
	// 0. Step-change cleanup: close modals / sheet overlays when moving away
	// ─────────────────────────────────────────────────
	useEffect( () => {
		if ( ! tourActive ) {
			return;
		}

		const keepSheetOpen = 'sheet' === currentStep?.keep_open;
		const keepWizardOpen = 'wizard' === currentStep?.keep_open;
		const keepChatOpen = 'chat' === currentStep?.keep_open;

		// Close SheetOverlay only when leaving sheet step groups
		if ( ! keepSheetOpen ) {
			const closeBtn = document.querySelector<HTMLElement>( '[data-tour="sheet-overlay-close"]' );
			if ( closeBtn ) {
				closeBtn.click();
			} else {
				const sheet = document.querySelector<HTMLElement>( '[data-burst-sheet-overlay]' );
				if ( sheet ) {
					document.dispatchEvent( new KeyboardEvent( 'keydown', { key: 'Escape', bubbles: true }) );
				}
			}
		}

		// Close Chat Assistant modal only when leaving chat step groups
		if ( ! keepChatOpen ) {
			const chatClose = document.querySelector<HTMLElement>( '[data-tour="chat-modal-close"]' );
			if ( chatClose ) {
				chatClose.click();
			}
		}

		// Close Report Wizard only when leaving wizard step group
		if ( ! keepWizardOpen ) {
			try {
				if ( useWizardStore.getState().isOpen ) {
					useWizardStore.getState().closeWizard();
				}
			} catch {

				// Report wizard store may not be initialized yet
			}
		}

		// Close Radix popovers that are still open ONLY if not part of current step target
		if ( ! keepSheetOpen && ! keepWizardOpen && ! keepChatOpen ) {
			document.querySelectorAll<HTMLElement>(
				'[data-radix-popper-content-wrapper]'
			).forEach( ( el ) => {
				if ( currentStep?.anchor && el.querySelector( currentStep.anchor ) ) {
					return;
				}
				const close = el.querySelector<HTMLElement>( 'button[aria-label="Close"]' );
				if ( close ) {
					close.click();
				} else {
					document.dispatchEvent( new KeyboardEvent( 'keydown', { key: 'Escape', code: 'Escape', bubbles: true }) );
				}
			});
		}

		// Clean up body scroll/pointer locks
		document.body.style.pointerEvents = '';
		document.body.removeAttribute( 'data-scroll-locked' );
	}, [ tourActive, stepIndex, currentStep?.id, currentStep?.anchor, currentStep?.keep_open ]);

	// Auto-fill recipient during Report Wizard recipients step so form validation passes smoothly
	useEffect( () => {
		if ( tourActive && 'reporting_wizard_recipients' === currentStep?.id ) {
			const recipients = useWizardStore.getState().wizard.recipients;
			if ( ! recipients || 0 === recipients.length ) {
				useWizardStore.getState().setRecipients([ 'team@example.com' ]);
			}
		}
	}, [ tourActive, currentStep?.id ]);

	// Auto-open goal details when entering any settings_goals_* step
	useEffect( () => {
		const stepId = currentStep?.id;
		if ( tourActive && 'string' === typeof stepId && stepId.startsWith( 'settings_goals_' ) && 'settings_goals_add' !== stepId ) {
			const detailsElements = document.querySelectorAll<HTMLDetailsElement>( '[data-tour="goal-item"] details, [data-tour="goal-details"]' );
			detailsElements.forEach( ( el ) => {
				el.open = true;
			});
		}
	}, [ tourActive, currentStep?.id ]);


	// ─────────────────────────────────────────────────
	// 1. click_tab: advance when the route matches the destination URL.
	// ─────────────────────────────────────────────────
	useEffect( () => {
		if ( ! tourActive || ! isClickTabStep ) {
			return;
		}

		const isSubnavStep = currentStep?.anchor?.includes( 'subnav-' );
		const targetUrl = currentStep?.target_url || ( isSubnavStep ? ( currentStep?.route || '' ) : nextStepRoute );

		if ( ! targetUrl ) {
			return;
		}
		if ( pathMatchesTarget( location.pathname, targetUrl, Boolean( isSubnavStep ) ) ) {
			const tabDelay = currentStep?.delay ?? 300;
			const t = setTimeout( () => setStepIndex( stepIndex + 1 ), tabDelay );
			return () => clearTimeout( t );
		}
	}, [ location.pathname, tourActive, isClickTabStep, nextStepRoute, currentStep, stepIndex, setStepIndex ]);

	// ─────────────────────────────────────────────────
	// 2. click_element: detect click on anchor element (with observer for async elements)
	// ─────────────────────────────────────────────────
	useAdvanceOnSignal(
		Boolean( tourActive && isClickElementStep && ! interactionComplete && currentStep?.anchor ),
		currentStep?.id,
		tourActive,
		useCallback( ( onSignal ) => {
			const anchor = currentStep?.anchor;
			if ( ! anchor ) {
				return;
			}
			const boundElements = new Set<HTMLElement>();

			const handler = () => {
				if ( 'chat_assistant_prompt_select' === currentStep?.id ) {

					// The chat modal component generates the mock answer and advances once rendered.
					return;
				}
				if ( 'reporting_wizard_format' === currentStep?.id ) {
					useWizardStore.getState().setFormat( 'story' );
					if ( ! useWizardStore.getState().wizard.name ) {
						useWizardStore.getState().setReportName( 'Weekly Traffic & Top Pages Story' );
					}
					useWizardStore.getState().nextStep();
				}
				onSignal();
			};

			const attach = () => {
				const elements = Array.from( document.querySelectorAll<HTMLElement>( anchor ) );
				elements.forEach( ( el ) => {
					if ( ! boundElements.has( el ) ) {
						boundElements.add( el );
						el.addEventListener( 'click', handler, { once: true });
					}
				});
			};

			attach();

			const container = document.getElementById( 'burst' ) || document.body;
			const observer = new MutationObserver( attach );
			observer.observe( container, { childList: true, subtree: true });

			return () => {
				observer.disconnect();
				boundElements.forEach( ( el ) => el.removeEventListener( 'click', handler ) );
			};
		}, [ currentStep?.id, currentStep?.anchor ]),
		currentStep?.delay ?? 300,
		nextStep,
		setInteractionComplete
	);

	// ─────────────────────────────────────────────────
	// 3. open_modal: detect dialog/popover appearing
	// ─────────────────────────────────────────────────
	useAdvanceOnSignal(
		Boolean( tourActive && isOpenModalStep && ! interactionComplete ),
		currentStep?.id,
		tourActive,
		useCallback( ( onSignal ) => {
			const el = currentStep?.anchor ?
				document.querySelector<HTMLElement>( currentStep.anchor ) :
				null;

			const checkModalOpen = () => {
				const dialog = document.querySelector(
					'[role="dialog"]:not([hidden]), [role="dialog"][aria-modal="true"], .burst-popover:not(.hidden), [data-popover-open="true"]'
				);
				if ( dialog ) {
					onSignal();
				}
			};

			const observer = new MutationObserver( checkModalOpen );
			observer.observe( document.body, { childList: true, subtree: false });
			const burstEl = document.getElementById( 'burst' );
			if ( burstEl ) {
				observer.observe( burstEl, { childList: true, subtree: false });
			}

			const clickHandler = () => setTimeout( checkModalOpen, 120 );
			if ( el ) {
				el.addEventListener( 'click', clickHandler );
			}

			return () => {
				observer.disconnect();
				if ( el ) {
					el.removeEventListener( 'click', clickHandler );
				}
			};
		}, [ currentStep?.anchor ]),
		currentStep?.delay ?? 1000,
		nextStep,
		setInteractionComplete
	);

	// ─────────────────────────────────────────────────
	// 4. hover_element: detect hover, and advance when user moves cursor away
	// ─────────────────────────────────────────────────
	useAdvanceOnSignal(
		Boolean( tourActive && isHoverStep && ! interactionComplete ),
		currentStep?.id,
		tourActive,
		useCallback( ( onSignal ) => {
			const el = currentStep?.anchor ?
				document.querySelector<HTMLElement>( currentStep.anchor ) :
				null;
			if ( ! el ) {
				return;
			}

			let hasSeenTooltip = false;
			const checkTooltip = () => {
				const tooltip = document.querySelector( '[role="tooltip"], .burst-tooltip, [data-radix-popper-content-wrapper], .recharts-default-tooltip' );
				if ( tooltip ) {
					hasSeenTooltip = true;
				}
			};

			const onEnter = () => {
				setTimeout( checkTooltip, 120 );
			};

			const onLeave = () => {
				checkTooltip();
				if ( hasSeenTooltip ) {
					onSignal();
				}
			};

			el.addEventListener( 'mouseenter', onEnter );
			el.addEventListener( 'mouseleave', onLeave );

			return () => {
				el.removeEventListener( 'mouseenter', onEnter );
				el.removeEventListener( 'mouseleave', onLeave );
			};
		}, [ currentStep?.anchor ]),
		currentStep?.delay ?? 600,
		nextStep,
		setInteractionComplete
	);

	// ─────────────────────────────────────────────────
	// 5. change_date_range: hotspot approach via Zustand subscription
	// ─────────────────────────────────────────────────
	useAdvanceOnSignal(
		Boolean( isHotspotActive ),
		currentStep?.id,
		tourActive,
		useCallback( ( onSignal ) => {
			let initialRange = useDate.getState().range;
			return useDate.subscribe( ( state ) => {
				if ( state.range !== initialRange ) {
					initialRange = state.range;
					onSignal();
				}
			});
		}, []),
		currentStep?.delay ?? 1800,
		useCallback( () => {
			setIsHotspotActive( false );
			setInteractionComplete( false );
			setStepIndex( stepIndex + 1 );
		}, [ stepIndex, setStepIndex, setIsHotspotActive, setInteractionComplete ]),
		setInteractionComplete
	);

	// ─────────────────────────────────────────────────
	// 6. change_metrics: detect metric selection change in useInsightsStore
	// ─────────────────────────────────────────────────
	useAdvanceOnSignal(
		Boolean( tourActive && isChangeMetricsStep && ! interactionComplete ),
		currentStep?.id,
		tourActive,
		useCallback( ( onSignal ) => {
			const initialMetrics = JSON.stringify( useInsightsStore.getState().getMetrics() );
			const initialGroupBy = useInsightsStore.getState().groupBy;

			return useInsightsStore.subscribe( ( state ) => {
				const curMetrics = JSON.stringify( state.getMetrics() );
				const curGroupBy = state.groupBy;

				if ( curMetrics !== initialMetrics || curGroupBy !== initialGroupBy ) {
					onSignal();
				}
			});
		}, []),
		currentStep?.delay ?? 1500,
		nextStep,
		setInteractionComplete
	);

	// ─────────────────────────────────────────────────
	// 7. apply_filter: detect filter addition via store or DOM chips
	// ─────────────────────────────────────────────────
	useAdvanceOnSignal(
		Boolean( tourActive && isApplyFilterStep && ! interactionComplete ),
		currentStep?.id,
		tourActive,
		useCallback( ( onSignal ) => {
			const initialCount = Object.keys( useFiltersStore.getState().savedFilters || {}).length;

			const unsub = useFiltersStore.subscribe( ( state ) => {
				const currentCount = Object.keys( state.savedFilters || {}).length;
				if ( currentCount > initialCount ) {
					onSignal();
				}
			});

			const filterContainer = document.querySelector( '[data-tour="page-filter"]' );
			let observer: MutationObserver | null = null;
			if ( filterContainer ) {
				observer = new MutationObserver( () => {
					const chips = filterContainer.querySelectorAll( '[class*="FilterChip"], [class*="filter-chip"]' );
					if ( 0 < chips.length ) {
						onSignal();
					}
				});
				observer.observe( filterContainer, { childList: true, subtree: true });
			}

			return () => {
				unsub();
				if ( observer ) {
					observer.disconnect();
				}
			};
		}, []),
		currentStep?.delay ?? 1500,
		nextStep,
		setInteractionComplete
	);

	// ─────────────────────────────────────────────────
	// 8. toggle_columns: detect column selection change in useDataTableStore
	// ─────────────────────────────────────────────────
	useAdvanceOnSignal(
		Boolean( tourActive && isToggleColumnsStep && ! interactionComplete ),
		currentStep?.id,
		tourActive,
		useCallback( ( onSignal ) => {
			const initialCols = JSON.stringify( useDataTableStore.getState().columns || {});

			return useDataTableStore.subscribe( ( state ) => {
				const currentCols = JSON.stringify( state.columns || {});
				if ( currentCols !== initialCols ) {
					onSignal();
				}
			});
		}, []),
		currentStep?.delay ?? 1500,
		nextStep,
		setInteractionComplete
	);

	// ─────────────────────────────────────────────────
	// 9. generate_share_link: detect share link generation
	// ─────────────────────────────────────────────────
	useAdvanceOnSignal(
		Boolean( tourActive && isGenerateShareLinkStep && ! interactionComplete ),
		currentStep?.id,
		tourActive,
		useCallback( ( onSignal ) => {
			let fired = false;
			const handleGenerated = () => {
				if ( ! fired ) {
					fired = true;
					onSignal();
				}
			};

			const handleClick = ( e: MouseEvent ) => {
				const target = e.target as HTMLElement | null;
				if ( target?.closest( '.burst-generate-share-link-button, [data-tour="generate-share-link-button"], .burst-share-link-copy-btn' ) ) {
					handleGenerated();
				}
			};

			document.addEventListener( 'click', handleClick, true );

			return () => {
				document.removeEventListener( 'click', handleClick, true );
			};
		}, []),
		currentStep?.delay ?? 1800,
		nextStep,
		setInteractionComplete
	);

	// Handle skipping the whole feature cleanly to the next feature section
	const handleSkipFeature = useCallback( () => {
		if ( ! currentStep ) {
			return;
		}

		// 1. Reset transient interaction state & hotspot
		setIsHotspotActive( false );
		setInteractionComplete( false );

		// 2. Clean up any open popovers, sheets, or dialogs from current feature
		cleanUpOpenFeatureOverlays();

		// 3. Find current section and determine next section
		const currentSection = getSectionForStep( currentStep.id, steps );
		const sectionIndex = TOUR_SECTIONS.findIndex( ( s ) => s.id === currentSection?.id );

		// If at or beyond the last section, complete the tour
		if ( -1 === sectionIndex || sectionIndex >= TOUR_SECTIONS.length - 1 ) {
			void markTourCompleted();
			void dismissTour();
			return;
		}

		const nextSection = TOUR_SECTIONS[ sectionIndex + 1 ];
		const targetStepIndex = getSectionStartingStepIndex( nextSection.id, steps );

		// 4. Update section progress
		void updateSectionProgress( nextSection.id );

		// 5. Navigate to the next section's route
		if ( nextSection.route && ! pathMatchesTarget( location.pathname, nextSection.route ) ) {
			window.location.hash = '#' + nextSection.route;
		}

		// 6. Jump directly to the next section's first step
		setStepIndex( targetStepIndex );
	}, [
		currentStep,
		steps,
		location.pathname,
		setStepIndex,
		setIsHotspotActive,
		setInteractionComplete,
		updateSectionProgress,
		markTourCompleted,
		dismissTour
	]);

	// Handle going back to the start of the current feature or to the previous feature
	const handlePrevFeature = useCallback( () => {
		if ( ! currentStep || 0 >= stepIndex ) {
			return;
		}

		// 1. Reset transient interaction state & hotspot
		setIsHotspotActive( false );
		setInteractionComplete( false );

		// 2. Clean up any open popovers, sheets, or dialogs from current feature
		cleanUpOpenFeatureOverlays();

		// 3. Determine target step: start of current feature if between a feature, or previous feature
		const sec = getSectionForStep( currentStep.id, steps );
		const secIdx = TOUR_SECTIONS.findIndex( ( s ) => s.id === sec?.id );
		const secStart = sec ? getSectionContentStartIndex( sec.id, steps ) : 0;

		let targetStepIndex = 0;
		let targetSection = sec;

		if ( stepIndex > secStart ) {
			targetStepIndex = secStart;
		} else if ( 0 < secIdx ) {
			const prevSec = TOUR_SECTIONS[ secIdx - 1 ];
			targetSection = prevSec;
			targetStepIndex = getSectionContentStartIndex( prevSec.id, steps );
		} else {
			return;
		}

		// 4. Update section progress
		if ( targetSection?.id ) {
			void updateSectionProgress( targetSection.id );
		}

		// 5. Navigate to the target section route if not already there
		if ( targetSection?.route && ! pathMatchesTarget( location.pathname, targetSection.route ) ) {
			window.location.hash = '#' + targetSection.route;
		}

		// 6. Update step index
		setStepIndex( targetStepIndex );
	}, [
		currentStep,
		stepIndex,
		steps,
		location.pathname,
		setStepIndex,
		setIsHotspotActive,
		setInteractionComplete,
		updateSectionProgress
	]);

	if ( isResumeModalOpen ) {
		return (
			<ResumeTourModal
				isOpen={ isResumeModalOpen }
				lastSectionId={ lastSectionId }
				onSelectResume={ ( sectionId ) => resumeFromSection( sectionId ) }
				onSelectRestart={ () => restartTour() }
				onClose={ () => {
					setIsResumeModalOpen( false );
					restorePreTourLocalStorage();
					stopTour();
					if ( 'undefined' !== typeof window ) {
						const url = new URL( window.location.href );
						const hadTourParam = url.searchParams.has( 'tour' );
						url.searchParams.delete( 'tour' );
						const targetUrl = url.pathname + ( url.search ? url.search : '' ) + ( url.hash ? url.hash : '' );
						if ( hadTourParam ) {
							window.location.href = targetUrl;
						} else {
							window.location.reload();
						}
					}
				}}
			/>
		);
	}

	if ( ! tourActive || 0 === steps.length ) {
		return null;
	}

	return (
		<>
			{/* Dedicated HUD for all steps */}
			{ currentStep && (
				<TourInteractiveHUD
					step={ currentStep }
					index={ stepIndex }
					totalSteps={ steps.length }
					canSkipFeature={ canSkipFeature }
					onSkipFeature={ handleSkipFeature }
					canPrevFeature={ canPrevFeature }
					onPrevFeature={ handlePrevFeature }
				/>
			)}

			{/* Custom overlay with cut-out spotlight */}
			{ effectiveAnchor && ! interactionComplete && (
				<TourOverlay
					anchor={ effectiveAnchor }
					spotlightPadding={ 10 }
					overlayOpacity={ isDarkTheme ? 0.5 : 0.4 }
					isDarkTheme={ isDarkTheme }
				/>
			)}

			{/* Beacon + action label badge adjacent to the spotlight */}
			{ effectiveAnchor && currentAction && ! interactionComplete && (
				<TourActionHint anchor={ effectiveAnchor } action={ currentAction } />
			)}

			{/* Date-range hotspot mode: instruction bar */}
			{ isDateRangeStep && isHotspotActive && (
				<div
					className="fixed bottom-6 left-1/2 -translate-x-1/2 burst"
					style={{ zIndex: 'calc(var(--z-overlay, 100000) + 3)' as unknown as number }}
				>
					<div
						className="flex items-center gap-3 px-5 py-3 rounded-full shadow-2xl border backdrop-blur-md"
						style={{
							backgroundColor: isDarkTheme ? '#0f172a' : '#ffffff',
							borderColor: 'var(--color-primary, #2A5B8C)',
							color: isDarkTheme ? '#f8fafc' : '#0f172a'
						}}
					>
						<span className="relative flex h-3 w-3">
							<span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
							<span className="relative inline-flex rounded-full h-3 w-3 bg-primary" />
						</span>
						<span className="text-xs sm:text-sm font-semibold">
							{ interactionComplete ?
								__( '✨ Charts updated for all time!', 'burst-statistics' ) :
								( isDateDropdownOpen ?
									__( 'Select "All time" from the presets list 👈', 'burst-statistics' ) :
									__( 'Click date range above to open the selector ↑', 'burst-statistics' ) )
							}
						</span>
					</div>
				</div>
			)}
		</>
	);
};

export default TourGuide;

