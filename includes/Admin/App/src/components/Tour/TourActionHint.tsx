import React from 'react';
import ReactDOM from 'react-dom';
import { __ } from '@wordpress/i18n';
import { useAnchorRect } from '@/hooks/useAnchorRect';
import type { TourStepAction } from '@/store/useTourStore';

interface TourActionHintProps {
	anchor: string;
	action: TourStepAction;
}

function getActionLabel( anchor: string, action: TourStepAction ): { label: string; icon: string } | null {

	// Suppress action hint pill for tab navigation transitions — keep top-nav clean
	if ( anchor.includes( 'nav-tab' ) || 'click_tab' === action ) {
		return null;
	}

	if ( anchor.includes( 'sheet-overlay-close' ) ) {
		return { label: __( 'Close', 'burst-statistics' ), icon: '✖️' };
	}
	if ( anchor.includes( 'insights-metric-selector' ) || 'change_metrics' === action ) {
		return { label: __( 'Select metrics', 'burst-statistics' ), icon: '📈' };
	}
	if ( anchor.includes( 'field-privacy_level' ) ) {
		return { label: __( 'Pick privacy level', 'burst-statistics' ), icon: '🔒' };
	}
	if ( anchor.includes( 'field-plugin_update_suggestions' ) ) {
		return { label: __( 'Toggle update timing', 'burst-statistics' ), icon: '🕒' };
	}
	if ( anchor.includes( 'field-ghost_mode' ) ) {
		return { label: __( 'Toggle Ghost mode', 'burst-statistics' ), icon: '👻' };
	}
	if ( anchor.includes( 'add-goal-button' ) ) {
		return { label: __( 'Add goal', 'burst-statistics' ), icon: '🎯' };
	}
	if ( anchor.includes( 'page-filter' ) || 'apply_filter' === action ) {
		return { label: __( 'Add filter', 'burst-statistics' ), icon: '🔍' };
	}
	if ( anchor.includes( 'data-table-click-filter' ) ) {
		return { label: __( 'Click to filter', 'burst-statistics' ), icon: '🔍' };
	}
	if ( anchor.includes( 'data-table-columns' ) || 'toggle_columns' === action ) {
		return { label: __( 'Toggle columns', 'burst-statistics' ), icon: '⚙️' };
	}
	if ( anchor.includes( 'data-table-expand' ) ) {
		return { label: __( 'Expand table', 'burst-statistics' ), icon: '📑' };
	}
	if ( anchor.includes( 'share-link-button' ) || 'generate_share_link' === action ) {
		return { label: __( 'Generate share link', 'burst-statistics' ), icon: '🔗' };
	}
	if ( anchor.includes( 'community-comparison' ) ) {
		return { label: __( 'Hover me', 'burst-statistics' ), icon: '🌐' };
	}
	if ( anchor.includes( 'date-range-all-time' ) ) {
		return { label: __( 'Click "All time"', 'burst-statistics' ), icon: '📅' };
	}
	if ( anchor.includes( 'date-range' ) || 'change_date_range' === action ) {
		return { label: __( 'Open date range', 'burst-statistics' ), icon: '📅' };
	}
	if ( anchor.includes( 'chat-prompt-suggestions' ) || anchor.includes( 'chat-prompt-item' ) ) {
		return { label: __( 'Click any prompt', 'burst-statistics' ), icon: '💬' };
	}
	if ( anchor.includes( 'chat-assistant' ) ) {
		return { label: __( 'Open AI chat', 'burst-statistics' ), icon: '🤖' };
	}
	if ( anchor.includes( 'subnav-goals' ) ) {
		return { label: __( 'Click Goals', 'burst-statistics' ), icon: '🎯' };
	}
	if ( anchor.includes( 'subnav-general' ) ) {
		return { label: __( 'Click General', 'burst-statistics' ), icon: '⚙️' };
	}
	if ( anchor.includes( 'subnav-features' ) ) {
		return { label: __( 'Click Features', 'burst-statistics' ), icon: '🕒' };
	}
	if ( anchor.includes( 'subnav-advanced' ) ) {
		return { label: __( 'Click Advanced', 'burst-statistics' ), icon: '👻' };
	}
	if ( anchor.includes( 'subnav-customization' ) ) {
		return { label: __( 'Click Customization', 'burst-statistics' ), icon: '🎨' };
	}
	if ( anchor.includes( 'subnav-reports' ) ) {
		return { label: __( 'Click Reports', 'burst-statistics' ), icon: '📊' };
	}
	if ( anchor.includes( 'new-report-button' ) ) {
		return { label: __( 'Click new report', 'burst-statistics' ), icon: '➕' };
	}
	return { label: __( 'Click here', 'burst-statistics' ), icon: '👆' };
}

/**
 * Renders ONE pulsing beacon dot adjacent to the spotlight element with a small
 * contextual label. Kept minimal so it does not compete with the instruction panel.
 *
 * Placement: beacon is positioned at the top-right corner so it never obscures the
 * text or icon inside the target button.
 */
const TourActionHint: React.FC<TourActionHintProps> = ({ anchor, action }) => {
	const rect = useAnchorRect( anchor );

	if ( ! rect ) {
		return null;
	}

	const actionInfo = getActionLabel( anchor, action );
	if ( ! actionInfo ) {
		return null;
	}

	const color = 'var(--color-primary, #2A5B8C)';
	const { label, icon } = actionInfo;

	const isInsideModal = Boolean(
		document.querySelector( anchor )?.closest( '[role="dialog"], .burst-modal, [data-burst-sheet-overlay], #datatable-overlay, #sheet-overlay, #report-wizard-modal' )
	);
	const hintZIndex = isInsideModal ? 'calc(var(--z-modal, 100020) + 5)' : 'calc(var(--z-overlay, 100000) + 5)';

	/* Beacon position — top-right edge so button text remains legible */
	const beaconX = rect.right - Math.min( 8, rect.width / 4 );
	const beaconY = rect.top + Math.min( 8, rect.height / 4 );

	/* Label badge — to the right if room, otherwise left */
	const spaceRight = window.innerWidth - beaconX;
	const showRight = 130 <= spaceRight;
	const badgeLeft = showRight ? beaconX + 22 : beaconX - 22;
	const badgeTranslate = showRight ? '0' : '-100%';

	return ReactDOM.createPortal(
		<>
			{/* Pulsing beacon dot */}
			<div
				style={{
					position: 'fixed',
					top: beaconY,
					left: beaconX,
					width: 20,
					height: 20,
					transform: 'translate(-50%, -50%)',
					zIndex: hintZIndex as unknown as number,
					pointerEvents: 'none',
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'center'
				}}
			>
				{/* Outer ripple */}
				<span
					style={{
						position: 'absolute',
						width: '100%',
						height: '100%',
						borderRadius: '50%',
						backgroundColor: color,
						opacity: 0.4,
						animation: 'beacon-ripple 1.6s ease-out infinite'
					}}
				/>
				{/* Inner dot */}
				<span
					style={{
						position: 'relative',
						width: 10,
						height: 10,
						borderRadius: '50%',
						backgroundColor: color,
						border: '2px solid #ffffff',
						boxShadow: `0 0 6px ${color}88`
					}}
				/>
			</div>

			{/* Contextual label badge — adjacent to beacon, NOT overlapping spotlight */}
			<div
				style={{
					position: 'fixed',
					top: beaconY,
					left: badgeLeft,
					transform: `translateY(-50%) translateX(${badgeTranslate})`,
					zIndex: hintZIndex as unknown as number,
					pointerEvents: 'none',
					display: 'flex',
					alignItems: 'center',
					gap: 5,
					padding: '3px 9px 3px 7px',
					borderRadius: 999,
					fontSize: 11,
					fontWeight: 700,
					backgroundColor: color,
					color: '#ffffff',
					whiteSpace: 'nowrap',
					boxShadow: '0 2px 10px rgba(0,0,0,0.3)',
					animation: 'badge-float 2s ease-in-out infinite'
				}}
			>
				<span>{icon}</span>
				{label}
			</div>

			<style>{`
				@keyframes beacon-ripple {
					0%   { transform: scale(0.5); opacity: 0.6; }
					70%  { transform: scale(2.2); opacity: 0; }
					100% { transform: scale(2.5); opacity: 0; }
				}
				@keyframes badge-float {
					0%, 100% { transform: translateY(-50%) translateX(${badgeTranslate}) translateY(0px); }
					50%       { transform: translateY(-50%) translateX(${badgeTranslate}) translateY(-3px); }
				}
			`}</style>
		</>,
		document.body
	);
};

export default TourActionHint;
