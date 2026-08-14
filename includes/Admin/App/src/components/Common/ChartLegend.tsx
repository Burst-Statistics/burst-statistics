export interface ChartLegendItem {
	key: string;
	color: string;
	label: string;

	/** Dashed line swatch for comparison/forecast series. */
	dashed?: boolean;

	/** Square swatch for bar series instead of the round line dot. */
	square?: boolean;
}

/**
 * Legend shown in a chart block's heading controls: a round dot for line
 * series, a dashed swatch for comparison/forecast lines, and a square
 * swatch for bar series.
 *
 * @param props - Legend items to render.
 * @return The legend element.
 */
export function ChartLegend({ items }: { items: ChartLegendItem[] }): JSX.Element {
	return (
		<div className="flex items-center gap-4">
			{ items.map( ({ key, color, dashed, square, label }) => (
				<div key={ key } className="flex items-center gap-1.5">
					{ dashed ? (
						<svg
							width="10"
							height="10"
							viewBox="0 0 10 10"
							className="flex-shrink-0"
							aria-hidden="true"
						>
							<line
								x1="0"
								y1="5"
								x2="10"
								y2="5"
								stroke={ color }
								strokeWidth="2"
								strokeDasharray="3 2"
							/>
						</svg>
					) : (
						<span
							className={
								square ?
									'inline-block h-3 w-3 flex-shrink-0 rounded-sm' :
									'inline-block h-2.5 w-2.5 flex-shrink-0 rounded-full'
							}
							style={{ backgroundColor: color }}
						/>
					) }
					<span className="text-sm text-gray-500">{ label }</span>
				</div>
			) ) }
		</div>
	);
}
