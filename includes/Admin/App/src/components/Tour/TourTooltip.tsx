import React from 'react';
import ReactDOM from 'react-dom';
import { __ } from '@wordpress/i18n';
import Icon from '@/utils/Icon';
import { useTourStore, TourStep, TourStepAction } from '@/store/useTourStore';
import { useTheme } from '@/hooks/useTheme';


/** Actions that block Next and require the user to act */
const BLOCKING_ACTIONS = new Set<TourStepAction>([
	'click_element',
	'open_modal',
	'hover_element',
	'change_metrics',
	'apply_filter',
	'toggle_columns',
	'generate_share_link'
]);

const ACTION_INSTRUCTION: Partial<Record<TourStepAction, string>> = {
	click_element: __( 'Click the highlighted element to continue.', 'burst-statistics' ),
	open_modal: __( 'Click the highlighted button to open it.', 'burst-statistics' ),
	hover_element: __( 'Hover over the highlighted element.', 'burst-statistics' ),
	click_tab: __( 'Click the highlighted tab above to continue.', 'burst-statistics' ),
	change_date_range: __( 'Select "All time" from the date range dropdown to continue.', 'burst-statistics' ),
	change_metrics: __( 'Select any metric and click Apply to update the graph.', 'burst-statistics' ),
	apply_filter: __( 'Click + Add filter and apply a filter to continue.', 'burst-statistics' ),
	toggle_columns: __( 'Toggle any column and click Apply to customize the table.', 'burst-statistics' ),
	generate_share_link: __( 'Click "Generate shareable link" to create a live share link.', 'burst-statistics' )
};

export interface TourInteractiveHUDProps {
	step: TourStep;
	index: number;
	totalSteps: number;
	canSkipFeature?: boolean;
	onSkipFeature?: () => void;
	canPrevFeature?: boolean;
	onPrevFeature?: () => void;
}

/**
 * Primary-button label shown while the tour waits for the user to act. Uses a
 * pulsing dot (waiting for input) rather than a spinner (which reads as the app
 * being busy) so it's clear the next move is the user's.
 *
 * @return {JSX.Element} The label with a pulsing indicator.
 */
const YourTurnLabel = (): React.ReactElement => {
	return (
		<span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
			<span style={{ position: 'relative', display: 'inline-flex', width: 7, height: 7 }}>
				<span style={{ position: 'absolute', width: '100%', height: '100%', borderRadius: '50%', backgroundColor: 'currentColor', opacity: 0.5, animation: 'hud-ping 1.4s ease-in-out infinite' }} />
				<span style={{ position: 'relative', width: 7, height: 7, borderRadius: '50%', backgroundColor: 'currentColor' }} />
			</span>
			{ __( 'Your turn 👆', 'burst-statistics' ) }
		</span>
	);
};

/**
 * Formats tour text, cleanly breaking down bullet points or paragraph lines.
 */
const formatTourText = ( text?: string, textSecond?: string, textPrimary?: string ) => {
	if ( ! text ) {
		return null;
	}

	if ( text.includes( '\n' ) || text.includes( '•' ) ) {
		const rawLines = text.split( /\n|(?=•\s*)/g ).map( ( l ) => l.trim() ).filter( Boolean );
		return (
			<div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
				{ rawLines.map( ( line, idx ) => {
					const isBullet = line.startsWith( '•' );
					const cleanLine = isBullet ? line.replace( /^•\s*/, '' ) : line;
					const colonIdx = cleanLine.indexOf( ':' );

					if ( isBullet && 0 < colonIdx && 30 > colonIdx ) {
						const label = cleanLine.substring( 0, colonIdx + 1 );
						const rest = cleanLine.substring( colonIdx + 1 );
						return (
							<div key={ idx } style={{ display: 'flex', alignItems: 'flex-start', gap: 6, fontSize: 13, lineHeight: 1.5, color: textSecond }}>
								<span style={{ color: textPrimary, fontWeight: 700, marginTop: -1 }}>•</span>
								<div>
									<strong style={{ color: textPrimary, fontWeight: 600 }}>{ label }</strong>
									{ rest }
								</div>
							</div>
						);
					}

					if ( isBullet ) {
						return (
							<div key={ idx } style={{ display: 'flex', alignItems: 'flex-start', gap: 6, fontSize: 13, lineHeight: 1.5, color: textSecond }}>
								<span style={{ color: textPrimary, fontWeight: 700, marginTop: -1 }}>•</span>
								<span>{ cleanLine }</span>
							</div>
						);
					}

					return (
						<p key={ idx } style={{ margin: 0, fontSize: 13, lineHeight: 1.55, color: textSecond }}>
							{ cleanLine }
						</p>
					);
				}) }
			</div>
		);
	}

	return (
		<div style={{ fontSize: 13, lineHeight: 1.55, color: textSecond }}>
			{ text }
		</div>
	);
};

// fallow-ignore-next-line complexity
export const TourInteractiveHUD: React.FC<TourInteractiveHUDProps> = ({
	step,
	index,
	totalSteps,
	canSkipFeature,
	onSkipFeature,
	canPrevFeature = 0 < index,
	onPrevFeature
}) => {
	const nextStep            = useTourStore( ( s ) => s.nextStep );
	const prevStep            = useTourStore( ( s ) => s.prevStep );
	const dismissTour         = useTourStore( ( s ) => s.dismissTour );
	const setIsHotspotActive  = useTourStore( ( s ) => s.setIsHotspotActive );
	const interactionComplete = useTourStore( ( s ) => s.interactionComplete );
	const { isDarkTheme }     = useTheme();

	const isPro            = Boolean( step.pro );
	const action           = step.action as TourStepAction | undefined;
	const isDateRange      = 'change_date_range' === action;
	const isTabTransition  = 'click_tab' === action;
	const isBlockingAction = Boolean( action && BLOCKING_ACTIONS.has( action ) );
	const isInteractive    = Boolean( action );
	const isLastStep       = index >= totalSteps - 1;
	const actionDone       = ( ! isBlockingAction && ! isTabTransition && ! isDateRange ) || interactionComplete;

	const progress = Math.round( ( ( index + 1 ) / totalSteps ) * 100 );

	const bg          = isDarkTheme ? 'rgba(15,23,42,0.97)' : 'rgba(255,255,255,0.98)';
	const textPrimary = isDarkTheme ? '#f1f5f9' : '#0f172a';
	const textSecond  = isDarkTheme ? '#94a3b8' : '#64748b';
	const border      = isDarkTheme ? 'rgba(51,65,85,0.7)' : 'rgba(226,232,240,0.9)';
	const accentBg     = isDarkTheme ? 'rgba(56,189,248,0.12)' : 'rgba(42,91,140,0.08)';
	const accentText   = isDarkTheme ? 'var(--color-primary, #38bdf8)' : 'var(--color-primary, #2A5B8C)';
	const accentBorder = isDarkTheme ? 'rgba(56,189,248,0.28)' : 'rgba(42,91,140,0.2)';
	const primaryBg    = isDarkTheme ? 'var(--color-primary, #38bdf8)' : 'var(--color-primary, #2A5B8C)';

	const handleNext = ( event: React.MouseEvent<HTMLButtonElement> ) => {
		event.preventDefault();
		event.stopPropagation();
		if ( isDateRange ) {
			setIsHotspotActive( true );
			return;
		}
		if ( isTabTransition ) {
			return;
		}
		nextStep();
	};

	const handlePrev = ( event: React.MouseEvent<HTMLButtonElement> ) => {
		event.preventDefault();
		event.stopPropagation();
		if ( onPrevFeature ) {
			onPrevFeature();
		} else {
			prevStep();
		}
	};

	const handleSkipFeature = ( event: React.MouseEvent<HTMLButtonElement> ) => {
		event.preventDefault();
		event.stopPropagation();
		onSkipFeature?.();
	};

	let primaryLabel: React.ReactNode;
	let primaryDisabled = false;

	if ( isLastStep && actionDone ) {
		primaryLabel = __( 'Finish 🎉', 'burst-statistics' );
	} else if ( isTabTransition && ! interactionComplete ) {
		primaryLabel = <YourTurnLabel />;
		primaryDisabled = true;
	} else if ( isDateRange ) {
		primaryLabel = __( 'Try it 📅', 'burst-statistics' );
	} else if ( isBlockingAction && ! interactionComplete ) {
		primaryLabel = <YourTurnLabel />;
		primaryDisabled = true;
	} else {
		primaryLabel = __( 'Next →', 'burst-statistics' );
	}

	return ReactDOM.createPortal(
		<div
			className="burst"
			style={{
				position: 'fixed',
				bottom: 24,
				left: 24,
				width: 'min(360px, calc(100vw - 32px))',
				zIndex: 'calc(var(--z-modal, 100020) + 10)' as unknown as number,
				backgroundColor: bg,
				border: `1px solid ${border}`,
				borderRadius: 14,
				boxShadow: isDarkTheme ?
					'0 24px 48px -12px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.06)' :
					'0 16px 40px -8px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.05)',
				backdropFilter: 'blur(14px)',
				padding: '16px 18px',
				animation: 'hud-slidein 0.3s cubic-bezier(0.34,1.56,0.64,1)',
				boxSizing: 'border-box'
			}}
		>
			<div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
				{/* Header */}
				<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingBottom: 10, marginBottom: 10, borderBottom: `1px solid ${border}` }}>
					<div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
						<span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 9px', borderRadius: 999, fontSize: 11, fontWeight: 700, backgroundColor: accentBg, color: accentText, border: `1px solid ${accentBorder}` }}>
							{ index + 1 } / { totalSteps }
						</span>
						{ isPro && (
							<span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 700, backgroundColor: isDarkTheme ? 'rgba(245,158,11,0.18)' : '#fef3c7', color: isDarkTheme ? '#fbbf24' : '#b45309', border: isDarkTheme ? '1px solid rgba(245,158,11,0.3)' : '1px solid #fde68a' }}>
								<Icon name="sparkles" size={10} color="primary" />
								{ __( 'PRO', 'burst-statistics' ) }
							</span>
						)}
						{ isInteractive && (
							<span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 700, backgroundColor: accentBg, color: accentText, border: `1px solid ${accentBorder}` }}>
								<span style={{ position: 'relative', display: 'inline-flex', width: 7, height: 7 }}>
									<span style={{ position: 'absolute', width: '100%', height: '100%', borderRadius: '50%', backgroundColor: accentText, opacity: 0.5, animation: 'hud-ping 1.4s ease-in-out infinite' }} />
									<span style={{ position: 'relative', width: 7, height: 7, borderRadius: '50%', backgroundColor: accentText }} />
								</span>
								{ __( 'Interactive', 'burst-statistics' ) }
							</span>
						)}
					</div>

					<div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
						<button
							type="button"
							onClick={ () => dismissTour() }
							style={{ fontSize: 11, color: textSecond, textDecoration: 'underline', textUnderlineOffset: 3, background: 'none', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap', padding: 0 }}
						>
							{ __( 'Skip tour', 'burst-statistics' ) }
						</button>
					</div>
				</div>

				{/* Progress bar */}
				<div style={{ height: 3, borderRadius: 999, overflow: 'hidden', backgroundColor: isDarkTheme ? '#1e293b' : '#f1f5f9', marginBottom: 12 }}>
					<div style={{ height: '100%', borderRadius: 999, width: `${progress}%`, backgroundColor: accentText, transition: 'width 0.45s ease' }} />
				</div>

				{/* Title + content */}
				<div style={{ marginBottom: 12 }}>
					{ step.title && (
						<h3 style={{ margin: '0 0 5px', fontSize: 15, fontWeight: 700, lineHeight: 1.3, color: textPrimary }}>
							{ step.title }
						</h3>
					)}
					{ formatTourText( step.text, textSecond, textPrimary ) }
				</div>

				{/* Action instruction banner */}
				{ action && ACTION_INSTRUCTION[ action ] && (
					<div
						style={{
							display: 'flex',
							alignItems: 'center',
							justifyContent: 'space-between',
							gap: 8,
							padding: '7px 11px',
							borderRadius: 8,
							marginBottom: 12,
							fontSize: 12,
							fontWeight: 600,
							backgroundColor: interactionComplete ?
								( isDarkTheme ? 'rgba(34,197,94,0.13)' : 'rgba(22,163,74,0.07)' ) :
								accentBg,
							color: interactionComplete ?
								( isDarkTheme ? '#4ade80' : '#16a34a' ) :
								accentText,
							border: `1px solid ${interactionComplete ?
								( isDarkTheme ? 'rgba(74,222,128,0.3)' : 'rgba(22,163,74,0.2)' ) :
								accentBorder}`
						}}
					>
						<span>
							{ interactionComplete ?
								'✅ ' + __( 'Done! Moving to next step…', 'burst-statistics' ) :
								ACTION_INSTRUCTION[ action ]
							}
						</span>
					</div>
				)}

				{/* Footer */}
				<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6, paddingTop: 10, borderTop: `1px solid ${border}` }}>
					<button
						type="button"
						onClick={ handlePrev }
						disabled={ ! canPrevFeature }
						title={ __( 'Previous feature', 'burst-statistics' ) }
						aria-label={ __( 'Previous feature', 'burst-statistics' ) }
						style={{
							display: 'inline-flex',
							alignItems: 'center',
							justifyContent: 'center',
							width: 28,
							height: 28,
							padding: 0,
							borderRadius: 7,
							border: isDarkTheme ? '1px solid rgba(148,163,184,0.3)' : `1px solid ${border}`,
							backgroundColor: isDarkTheme ? 'rgba(51,65,85,0.8)' : 'rgba(241,245,249,0.9)',
							color: isDarkTheme ? '#f1f5f9' : '#334155',
							cursor: ! canPrevFeature ? 'not-allowed' : 'pointer',
							opacity: ! canPrevFeature ? 0.35 : 1,
							transition: 'all 0.2s ease'
						}}
					>
						<Icon name="chevron-left" size={ 14 } style={{ color: isDarkTheme ? '#f1f5f9' : '#334155' }} />
					</button>

					{ canSkipFeature && (
						<button
							type="button"
							onClick={ handleSkipFeature }
							title={ __( 'Skip feature', 'burst-statistics' ) }
							aria-label={ __( 'Skip feature', 'burst-statistics' ) }
							style={{
								display: 'inline-flex',
								alignItems: 'center',
								justifyContent: 'center',
								width: 28,
								height: 28,
								padding: 0,
								borderRadius: 7,
								border: isDarkTheme ? '1px solid rgba(148,163,184,0.3)' : `1px solid ${border}`,
								backgroundColor: isDarkTheme ? 'rgba(51,65,85,0.8)' : 'rgba(241,245,249,0.9)',
								color: isDarkTheme ? '#f1f5f9' : '#334155',
								cursor: 'pointer',
								transition: 'all 0.2s ease'
							}}
						>
							<Icon name="chevron-right" size={ 14 } style={{ color: isDarkTheme ? '#f1f5f9' : '#334155' }} />
						</button>
					) }

					<button
						type="button"
						onClick={ handleNext }
						disabled={ primaryDisabled }
						style={{
							display: 'inline-flex',
							alignItems: 'center',
							justifyContent: 'center',
							padding: '6px 16px',
							borderRadius: 7,
							fontSize: 12,
							fontWeight: 700,
							border: 'none',

							// When primaryDisabled is set it means "waiting for the
							// user's action" — keep it in the accent colour so it reads
							// as a live prompt, not a greyed-out/blocked control.
							cursor: primaryDisabled ? 'default' : 'pointer',
							backgroundColor: primaryBg,
							color: '#ffffff',
							opacity: primaryDisabled ? 0.9 : 1,
							transition: 'background-color 0.2s, opacity 0.2s'
						}}
					>
						{ primaryLabel }
					</button>
				</div>
			</div>
			<style>{`
				@keyframes hud-slidein {
					from { opacity: 0; transform: translateY(18px) scale(0.97); }
					to   { opacity: 1; transform: translateY(0)    scale(1);    }
				}
				@keyframes hud-ping {
					0%, 100% { transform: scale(1);   opacity: 0.5; }
					50%      { transform: scale(1.8); opacity: 0;   }
				}
			`}</style>
		</div>,
		document.body
	);
};
