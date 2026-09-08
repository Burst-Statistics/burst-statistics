import React, { useEffect, useRef } from 'react';
import { __ } from '@wordpress/i18n';
import { formatDate } from '@/utils/formatting';
import type { RevisionMarker } from '@/api/getPageRevisionsData';

interface PageRevisionsListProps {
	revisions: RevisionMarker[];
	selectedRevisionId: number | null;
	onRevisionSelect: ( id: number | null ) => void;
}

/**
 * Format a revision's timestamp or date string to a localised human-readable label.
 *
 * @param {Pick<RevisionMarker, 'timestamp' | 'date'>} revision - Revision object with timestamp and/or date.
 * @return {string} Localised formatted date string.
 */
export function formatRevisionDate( revision: Pick<RevisionMarker, 'timestamp' | 'date'> ): string {
	const input = revision.timestamp || revision.date;
	return input ? formatDate( input ) : '';
}

/**
 * Confidence label map for display.
 */
const CONFIDENCE_LABELS: Record<RevisionMarker['confidence'], string> = {
	high: __( 'High confidence', 'burst-statistics' ),
	moderate: __( 'Moderate confidence', 'burst-statistics' ),
	low: __( 'Low confidence', 'burst-statistics' )
};

/**
 * Single revision list item.
 */
const RevisionItem = React.forwardRef<
	HTMLButtonElement,
	{
		revision: RevisionMarker;
		isSelected: boolean;
		onClick: () => void;
	}

// fallow-ignore-next-line complexity
>( ({ revision, isSelected, onClick }, ref ) => {
	const isPositive = 0 < revision.changePercent;
	const isSignificant = 0.5 <= Math.abs( revision.changePercent );

	const dotColor = isSelected ? 'rgb(34, 197, 94)' : 'var(--color-gray-300)';
	const changeColor = ! isSignificant ?
		'text-text-gray' :
		isPositive ?
			'text-green-600' :
			'text-red-500';

	const changeDisplay =
		! isSignificant ?
			`${ 0 < revision.changePercent ? '+' : '' }${ revision.changePercent }%` :
			`${ isPositive ? '+' : '' }${ revision.changePercent }%`;

	return (
		<button
			ref={ref}
			type="button"
			className={`flex w-full items-start justify-between gap-4 rounded-md px-3 py-3 text-left transition-colors hover:bg-gray-50 ${
				isSelected ? 'bg-green-50 hover:bg-green-50' : ''
			}`}
			onClick={onClick}
		>
			{/* Left: dot + date + description + meta */}
			<div className="flex items-start gap-3 min-w-0">
				<span
					className="mt-1 inline-block flex-shrink-0 w-2.5 h-2.5 rounded-full border-2"
					style={{
						backgroundColor: isSelected ? dotColor : 'transparent',
						borderColor: dotColor
					}}
				/>
				<div className="min-w-0">
					<p className="m-0 text-sm font-semibold text-text-black">
						{formatRevisionDate( revision )}
					</p>
					<p className="m-0 text-sm text-text-gray">
						{revision.description}
					</p>
					<p className="m-0 text-xs text-text-gray mt-0.5">
						{revision.author}
						{' · '}
						{( revision.visitorsAfter ?? 0 ).toLocaleString()}
						{' '}
						{__( 'visitors after', 'burst-statistics' )}
					</p>
				</div>
			</div>

			{/* Right: change % + score range + confidence */}
			<div className="flex-shrink-0 text-right">
				<p className={`m-0 text-sm font-semibold ${ changeColor }`}>
					{changeDisplay}
				</p>
				<p className="m-0 text-xs text-text-gray">
					{`${ revision.scoreBefore ?? 0 }/100 → ${ revision.scoreAfter ?? 0 }/100`}
				</p>
				<p className="m-0 text-xs text-text-gray">
					{CONFIDENCE_LABELS[ revision.confidence ] ?? CONFIDENCE_LABELS.low}
				</p>
			</div>
		</button>
	);
});

RevisionItem.displayName = 'RevisionItem';

/**
 * PageRevisionsList renders the ranked list of revisions below the graph.
 * All items render inside a scrollable container with theme scrollbar styling.
 * Automatically scrolls selected items into view.
 *
 * @param {PageRevisionsListProps} props - Component props.
 * @return {JSX.Element | null} The revision list.
 */
const scrollToSelectedItem = ( container: HTMLDivElement | null, item: HTMLButtonElement | null ) => {
	if ( ! container || ! item ) {
		return;
	}
	const itemRelativeTop = item.getBoundingClientRect().top - container.getBoundingClientRect().top + container.scrollTop;
	container.scrollTo({
		top: Math.max( 0, itemRelativeTop - 8 ),
		behavior: 'smooth'
	});
};

const PageRevisionsList: React.FC<PageRevisionsListProps> = ({
	revisions,
	selectedRevisionId,
	onRevisionSelect
}) => {
	const itemRefs = useRef<Record<number, HTMLButtonElement | null>>({});
	const containerRef = useRef<HTMLDivElement>( null );
	const isFirstRender = useRef( true );

	// Scroll selected revision into container view without scrolling main window
	useEffect( () => {
		if ( isFirstRender.current ) {
			isFirstRender.current = false;
			return;
		}

		if ( null !== selectedRevisionId ) {
			scrollToSelectedItem( containerRef.current, itemRefs.current[ selectedRevisionId ]);
		}
	}, [ selectedRevisionId ]);

	if ( ! revisions.length ) {
		return null;
	}

	return (
		<div ref={containerRef} className="max-h-64 overflow-y-auto pr-1 flex flex-col">
			{revisions.map( ( revision ) => (
				<RevisionItem
					key={revision.id}
					ref={( el ) => {
						itemRefs.current[ revision.id ] = el;
					}}
					revision={revision}
					isSelected={revision.id === selectedRevisionId}
					onClick={() =>
						onRevisionSelect(
							revision.id === selectedRevisionId ? null : revision.id
						)
					}
				/>
			) )}
		</div>
	);
};

export default PageRevisionsList;

