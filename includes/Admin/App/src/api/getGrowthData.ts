import { getData } from '@/utils/api';
import {
	formatCurrency,
	formatCurrencyCompact,
	formatPercentage
} from '@/utils/formatting';
import { toFiniteNumber } from '@/utils/chartData';
import type { GrowthData } from '@/types/api-endpoints';

interface GetGrowthDataArgs {
	startDate: string;
	endDate: string;
	range: string;
	filters: Record<string, unknown>;
}

export interface GrowthItem {
	title: string;
	subtitle: string | null;
	value: string;
	exactValue: number | null;
	change: string | null;
	changeStatus: string | null;
	tooltipText: string | null;
	isForecast: boolean;
}

export interface GrowthBlockData {
	items: Record<string, GrowthItem>;
	metadata: GrowthData['metadata'];
}

type GrowthRowMap = Record<string, Record<string, unknown>>;

/**
 * Parse a nullable numeric payload field: null stays null, anything else is
 * coerced to a finite number.
 */
const toNullableNumber = ( raw: unknown ): number | null => {
	if ( null === raw || undefined === raw ) {
		return null;
	}

	return toFiniteNumber( raw );
};

/**
 * Build the signed change label and its status color from a rate.
 */
const buildChangeLabel = (
	rateChange: number | null
): { change: string | null; changeStatus: string | null } => {
	if ( null === rateChange ) {
		return { change: null, changeStatus: null };
	}

	if ( 0 <= rateChange ) {
		return {
			change: `+${ formatPercentage( rateChange ) }`,
			changeStatus: 'positive'
		};
	}

	return { change: formatPercentage( rateChange ), changeStatus: 'negative' };
};

/**
 * Shape one payload row into the ExplanationAndStatsItem-ready item.
 */
const toGrowthItem = (
	row: Record<string, unknown>,
	currency: string
): GrowthItem => {
	const value = toFiniteNumber( row.value );
	const subtitle = String( row.subtitle ?? '' );

	return {
		title: String( row.label ?? '' ),
		subtitle: '' === subtitle ? null : subtitle,
		value: formatCurrencyCompact( currency, value ),
		exactValue: value,
		...buildChangeLabel( toNullableNumber( row.rate_change ) ),
		tooltipText: formatCurrency( currency, value ),
		isForecast: Boolean( row.is_forecast )
	};
};

/**
 * Defensively read the payload's rows map.
 */
const toRowMap = ( data: { rows?: unknown } | null | undefined ): GrowthRowMap => {
	if ( data && data.rows && 'object' === typeof data.rows ) {
		return data.rows as GrowthRowMap;
	}

	return {};
};

/**
 * Defensively read the payload's forecast metadata.
 */
const toGrowthMetadata = (
	data: { metadata?: { growth_rate?: unknown; limited_data?: unknown } } | null | undefined
): GrowthBlockData['metadata'] => {
	const metadata = data && data.metadata ? data.metadata : {};

	return {
		growth_rate: toFiniteNumber( metadata.growth_rate, 0 ),
		limited_data: Boolean( metadata.limited_data )
	};
};

/**
 * Fetch the Growth block payload and shape it for ExplanationAndStatsItem.
 *
 * The block is calendar-anchored server-side: the dates are sent for the
 * standard request signature but do not influence the payload — only the
 * visitor filters do.
 */
export async function getGrowthData({
	startDate,
	endDate,
	range,
	filters
}: GetGrowthDataArgs ): Promise<GrowthBlockData> {
	const { data } = await getData( 'ecommerce/growth', startDate, endDate, range, {
		filters
	});

	const currency = 'string' === typeof data?.currency ? data.currency : 'USD';
	const items: Record<string, GrowthItem> = {};

	for ( const [ key, row ] of Object.entries( toRowMap( data ) ) ) {
		items[ key ] = toGrowthItem( row, currency );
	}

	return {
		items,
		metadata: toGrowthMetadata( data )
	};
}
