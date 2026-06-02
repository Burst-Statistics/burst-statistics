import { memo, useMemo } from 'react';
import { __ } from '@wordpress/i18n';
import clsx from 'clsx';
import type { BarDataTableProps } from './types';

/**
 * Derives a CSS grid track size for a column.
 *
 * Left-aligned columns grow to fill available space (`1fr`).
 * Right- and center-aligned columns use their explicit width or a sensible
 * pixel default derived from `minWidth`.
 *
 * @param {Object} col - The column definition.
 * @return {string} A CSS grid track value.
 */
function colTrack( col: { align?: string; width?: string; minWidth?: number }): string {
	if ( col.width ) {
		return col.width;
	}

	if ( ! col.align || 'left' === col.align ) {
		return '1fr';
	}

	return `${ col.minWidth ?? 80 }px`;
}

/**
 * Generic, minimalist data table with a full-row proportional background bar.
 *
 * The bar spans the entire row width and is drawn behind all cell content,
 * giving readers an instant visual sense of scale without obscuring any text.
 * Because CSS `position: absolute` cannot reliably escape a `<td>`, this
 * component uses a div-grid layout with ARIA table roles for accessibility.
 *
 * Header and body rows share a single parent CSS grid via `subgrid`, so
 * columns are always perfectly aligned regardless of content width.
 *
 * @template T - The row data type.
 * @param  {BarDataTableProps<T>} props - Component props.
 * @return {JSX.Element} The rendered table.
 */
function BarDataTableInner<T extends Record<string, unknown>>({
	columns,
	data,
	rowKey,
	barColumnKey,
	isLoading = false,
	emptyState,
	className
}: BarDataTableProps<T> ) {
	const gridTemplate = useMemo(
		() => columns.map( colTrack ).join( ' ' ),
		[ columns ]
	);

	const barMax = useMemo( () => {
		if ( ! barColumnKey || 0 === data.length ) {
			return 0;
		}

		return Math.max(
			...data.map( ( row ) => {
				const v = row[ barColumnKey ];
				return 'number' === typeof v ? v : 0;
			})
		);
	}, [ data, barColumnKey ]);

	const showSkeleton = isLoading && 0 === data.length;

	return (
		<div
			role="table"
			className={clsx( 'grid w-full overflow-x-auto text-sm', className )}
			style={{ gridTemplateColumns: gridTemplate }}
		>
			{/* Header row. */}
			<div role="rowgroup" className="contents">
				<div
					role="row"
					className="col-[1/-1] grid grid-cols-subgrid border-b border-gray-200"
				>
					{ columns.map( ( col ) => (
						<div
							key={ col.key }
							role="columnheader"
							className={clsx(
								'px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-text-gray select-none',
								'left' === col.align && 'text-left',
								'right' === col.align && 'text-right',
								'center' === col.align && 'text-center',
								! col.align && 'text-left'
							)}
						>
							{ col.label }
						</div>
					) ) }
				</div>
			</div>

			{/* Body rows. */}
			<div role="rowgroup" className="contents">
				{ showSkeleton &&
					Array.from({ length: 5 }).map( ( _, i ) => (
						<div
							key={ i }
							role="row"
							className="col-[1/-1] grid grid-cols-subgrid border-b border-gray-200"
						>
							{ columns.map( ( col ) => (
								<div key={ col.key } role="cell" className="px-3 py-2.5">
									<span className="inline-block h-3.5 w-3/4 animate-pulse rounded bg-gray-200" />
								</div>
							) ) }
						</div>
					) ) }

				{ ! showSkeleton && 0 === data.length && (
					<div role="row" className="col-[1/-1]">
						<div
							role="cell"
							className="px-3 py-10 text-center text-text-gray"
						>
							{ emptyState ?? __( 'No data available.', 'burst-statistics' ) }
						</div>
					</div>
				) }

				{ ! showSkeleton &&
					data.map( ( row, index ) => {
						const barValue = barColumnKey ?
							( row[ barColumnKey ] as number ) :
							0;
						const barPct =
							0 < barMax && barColumnKey ?
								( barValue / barMax ) * 100 :
								0;

						return (
							<div
								key={ rowKey( row ) }
								role="row"
								className="relative col-[1/-1] grid grid-cols-subgrid border-b border-gray-200 last:border-0 transition-colors hover:bg-gray-50/60"
							>
								{/* Full-row background bar — rendered behind all cells. */}
								{ barColumnKey && 0 < barPct && (
									<div
										aria-hidden="true"
										className="pointer-events-none absolute inset-y-0 left-0 bg-primary-100 rounded-sm transition-[width] duration-300"
										style={{ width: `${ barPct }%` }}
									/>
								) }

								{ columns.map( ( col ) => {
									const rawValue = row[ col.key as keyof T ];

									return (
										<div
											key={ col.key }
											role="cell"
											className={clsx(
												'relative z-10 px-3 py-2.5 text-sm text-text-black',
												'left' === col.align && 'text-left',
												'right' === col.align && 'text-right',
												'center' === col.align && 'text-center',
												! col.align && 'text-left'
											)}
										>
											{ col.cell ? (
												col.cell( row, index )
											) : (
												String( rawValue ?? '' )
											) }
										</div>
									);
								}) }
							</div>
						);
					}) }
			</div>
		</div>
	);
}

/**
 * Memoized export of the generic BarDataTable.
 * Cast is required because memo loses the generic type parameter.
 */
export const BarDataTable = memo( BarDataTableInner ) as typeof BarDataTableInner;

export default BarDataTable;
