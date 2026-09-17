import React, { useMemo } from 'react';
import ReactDOM from 'react-dom';
import { useAnchorRect } from '@/hooks/useAnchorRect';

interface TourOverlayProps {
	anchor: string;
	spotlightPadding?: number;
	overlayOpacity?: number;
	isDarkTheme?: boolean;
}

interface SpotRect {
	top: number;
	left: number;
	width: number;
	height: number;
}

/**
 * Full-screen overlay with a transparent "hole" cut-out exactly over the anchor element.
 * Uses 4 panels (top/bottom/left/right) to block all pointer events except on the target.
 */
const TourOverlay: React.FC<TourOverlayProps> = ({
	anchor,
	spotlightPadding = 8,
	overlayOpacity = 0.55,
	isDarkTheme = false
}) => {
	const rect = useAnchorRect( anchor );

	const spot = useMemo( (): SpotRect | null => {
		if ( ! rect || 0 >= rect.width || 0 >= rect.height ) {
			return null;
		}
		return {
			top: rect.top - spotlightPadding,
			left: rect.left - spotlightPadding,
			width: rect.width + spotlightPadding * 2,
			height: rect.height + spotlightPadding * 2
		};
	}, [ rect, spotlightPadding ]);

	const isInsideModal = useMemo( () => {
		if ( ! anchor ) {
			return false;
		}
		const el = document.querySelector( anchor );
		return Boolean(
			el?.closest( '[role="dialog"]' ) ||
			el?.closest( '.burst-modal' ) ||
			el?.closest( '[data-burst-sheet-overlay]' ) ||
			el?.closest( '#datatable-overlay' ) ||
			el?.closest( '#sheet-overlay' ) ||
			el?.closest( '#report-wizard-modal' )
		);
	}, [ anchor ]);

	const bg = isDarkTheme ? `rgba(0,0,0,${overlayOpacity || 0.5})` : `rgba(15,23,42,${overlayOpacity || 0.4})`;

	if ( ! anchor || ! spot ) {
		return null;
	}

	const accentHex = isDarkTheme ? '56,189,248' : '42,91,140';
	const accentHigh = `rgba(${accentHex},0.75)`;
	const accentMid = `rgba(${accentHex},0.25)`;
	const accentLow = `rgba(${accentHex},0.12)`;

	const overlayZIndex = ( isInsideModal ? 'calc(var(--z-modal, 100020) + 1)' : 'var(--z-overlay, 100000)' ) as unknown as number;
	const spotlightZIndex = ( isInsideModal ? 'calc(var(--z-modal, 100020) + 2)' : 'calc(var(--z-overlay, 100000) + 2)' ) as unknown as number;

	// Overlay panels block pointer events except on the cut-out spotlight hole.
	const baseStyle: React.CSSProperties = {
		position: 'fixed',
		backgroundColor: bg,
		zIndex: overlayZIndex,
		pointerEvents: 'auto',
		transition: 'top 0.18s ease-out, left 0.18s ease-out, width 0.18s ease-out, height 0.18s ease-out'
	};

	const handlePanelEvent = ( e: React.SyntheticEvent ) => {
		e.preventDefault();
		e.stopPropagation();
	};

	const vw = 'undefined' !== typeof window ? window.innerWidth : 1920;
	const vh = 'undefined' !== typeof window ? window.innerHeight : 1080;

	return ReactDOM.createPortal(
		<>
			{/* Top panel */}
			<div
				onClick={ handlePanelEvent }
				onMouseDown={ handlePanelEvent }
				onPointerDown={ handlePanelEvent }
				onPointerUp={ handlePanelEvent }
				style={{ ...baseStyle, top: 0, left: 0, width: vw, height: Math.max( 0, spot.top ) }}
			/>
			{/* Bottom panel */}
			<div
				onClick={ handlePanelEvent }
				onMouseDown={ handlePanelEvent }
				onPointerDown={ handlePanelEvent }
				onPointerUp={ handlePanelEvent }
				style={{ ...baseStyle, top: spot.top + spot.height, left: 0, width: vw, height: Math.max( 0, vh - spot.top - spot.height ) }}
			/>
			{/* Left panel */}
			<div
				onClick={ handlePanelEvent }
				onMouseDown={ handlePanelEvent }
				onPointerDown={ handlePanelEvent }
				onPointerUp={ handlePanelEvent }
				style={{ ...baseStyle, top: spot.top, left: 0, width: Math.max( 0, spot.left ), height: spot.height }}
			/>
			{/* Right panel */}
			<div
				onClick={ handlePanelEvent }
				onMouseDown={ handlePanelEvent }
				onPointerDown={ handlePanelEvent }
				onPointerUp={ handlePanelEvent }
				style={{ ...baseStyle, top: spot.top, left: spot.left + spot.width, width: Math.max( 0, vw - spot.left - spot.width ), height: spot.height }}
			/>

			{/* Spotlight ring — pointer-events:none, purely visual */}
			<div
				style={{
					position: 'fixed',
					top: spot.top,
					left: spot.left,
					width: spot.width,
					height: spot.height,
					zIndex: spotlightZIndex,
					pointerEvents: 'none',
					borderRadius: 10,
					boxShadow: `0 0 0 3px ${accentHigh}, 0 0 0 7px ${accentMid}, 0 0 28px 6px ${accentLow}`,
					animation: 'tour-spotlight-pulse 2s ease-in-out infinite',
					transition: 'top 0.18s ease-out, left 0.18s ease-out, width 0.18s ease-out, height 0.18s ease-out'
				}}
			/>

			<style>{`
				@keyframes tour-spotlight-pulse {
					0%, 100% { box-shadow: 0 0 0 3px rgba(${accentHex},0.75), 0 0 0 7px rgba(${accentHex},0.22), 0 0 28px 6px rgba(${accentHex},0.12); }
					50%       { box-shadow: 0 0 0 4px rgba(${accentHex},0.9),  0 0 0 10px rgba(${accentHex},0.15), 0 0 40px 10px rgba(${accentHex},0.08); }
				}
			`}</style>
		</>,
		document.body
	);
};

export default TourOverlay;
