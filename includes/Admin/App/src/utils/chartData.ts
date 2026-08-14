/**
 * Shared normalization helpers for ecommerce chart API payloads.
 */

export interface ChartEnvelope {
	interval: string;
	spans_multiple_years: boolean;
	mode: 'revenue' | 'sales';
	currency: string | null;
}

/**
 * Coerce unknown input to a finite number, falling back for NaN/Infinity.
 */
export const toFiniteNumber = ( value: unknown, fallback: number = 0 ): number => {
	const number = Number( value );

	return Number.isFinite( number ) ? number : fallback;
};

/**
 * Normalize the envelope fields every ecommerce chart endpoint shares
 * (interval, year-span flag, mode, currency), so a malformed or missing
 * response degrades to a safe empty payload instead of crashing a chart.
 *
 * @param data         - Raw endpoint response data.
 * @param fallbackMode - Mode used when the response carries none.
 * @return The normalized envelope, ready to spread into a chart payload.
 */
// fallow-ignore-next-line complexity -- Each branch is one field guard; splitting per-field helpers would obscure the envelope shape.
export const normalizeChartEnvelope = ( data: unknown, fallbackMode: 'revenue' | 'sales' ): ChartEnvelope => {
	const source: Record<string, unknown> =
		data && 'object' === typeof data ? ( data as Record<string, unknown> ) : {};
	const mode = 'sales' === source.mode || 'revenue' === source.mode ? source.mode : fallbackMode;

	return {
		interval: 'string' === typeof source.interval ? source.interval : 'day',
		spans_multiple_years: Boolean( source.spans_multiple_years ),
		mode,
		currency: 'string' === typeof source.currency ? source.currency : null
	};
};
