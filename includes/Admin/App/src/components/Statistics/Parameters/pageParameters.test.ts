import assert from 'node:assert/strict';
import test from 'node:test';

interface MockMember {
	value: string;
	pageviews: number;
	visitors: number;
}

interface MockRow {
	value: string;
	pageviews: number;
	visitors: number;
	group?: boolean;
	members?: MockMember[];
}

const filterRowsBySearch = ( rows: MockRow[], searchQuery: string ): MockRow[] => {
	const query = searchQuery.trim().toLowerCase();
	if ( ! query ) {
		return rows;
	}
	return rows.filter( ( row ) => {
		if ( row.value.toLowerCase().includes( query ) ) {
			return true;
		}
		if ( row.group && row.members ) {
			return row.members.some( ( member ) => member.value.toLowerCase().includes( query ) );
		}
		return false;
	});
};

const sortRows = (
	rows: MockRow[],
	sortField: 'value' | 'pageviews' | 'visitors',
	sortDirection: 'asc' | 'desc'
): MockRow[] => {
	const sorted = [ ...rows ];
	sorted.sort( ( a, b ) => {
		let cmp = 0;
		if ( 'value' === sortField ) {
			cmp = a.value.localeCompare( b.value );
		} else {
			cmp = ( a[sortField] || 0 ) - ( b[sortField] || 0 );
		}
		return 'asc' === sortDirection ? cmp : -cmp;
	});
	return sorted;
};

const calculateTaggedRatio = ( tagged: number, total: number ): number => {
	if ( 0 >= total ) {
		return 0;
	}
	return Math.min( 10, Math.max( 0, Math.round( ( tagged / total ) * 10 ) ) );
};

test( 'filterRowsBySearch returns all rows on empty query', () => {
	const rows: MockRow[] = [
		{ value: 'summer_sale', pageviews: 100, visitors: 80 },
		{ value: 'winter_sale', pageviews: 50, visitors: 40 }
	];
	const filtered = filterRowsBySearch( rows, '' );
	assert.strictEqual( filtered.length, 2 );
});

test( 'filterRowsBySearch filters regular rows case-insensitively', () => {
	const rows: MockRow[] = [
		{ value: 'Summer_Sale', pageviews: 100, visitors: 80 },
		{ value: 'winter_sale', pageviews: 50, visitors: 40 }
	];
	const filtered = filterRowsBySearch( rows, 'summer' );
	assert.strictEqual( filtered.length, 1 );
	assert.strictEqual( filtered[0].value, 'Summer_Sale' );
});

test( 'filterRowsBySearch matches members inside rolled-up groups', () => {
	const rows: MockRow[] = [
		{
			value: 'burst-free-3.*',
			pageviews: 1000,
			visitors: 800,
			group: true,
			members: [
				{ value: 'burst-free-3.6.3', pageviews: 600, visitors: 500 },
				{ value: 'burst-free-3.6.2', pageviews: 400, visitors: 300 }
			]
		},
		{ value: 'burst-pro-1.0', pageviews: 200, visitors: 150 }
	];
	const filtered = filterRowsBySearch( rows, '3.6.3' );
	assert.strictEqual( filtered.length, 1 );
	assert.strictEqual( filtered[0].value, 'burst-free-3.*' );
});

test( 'sortRows sorts by pageviews desc and asc', () => {
	const rows: MockRow[] = [
		{ value: 'low', pageviews: 10, visitors: 5 },
		{ value: 'high', pageviews: 100, visitors: 50 },
		{ value: 'mid', pageviews: 50, visitors: 25 }
	];

	const desc = sortRows( rows, 'pageviews', 'desc' );
	assert.strictEqual( desc[0].value, 'high' );
	assert.strictEqual( desc[1].value, 'mid' );
	assert.strictEqual( desc[2].value, 'low' );

	const asc = sortRows( rows, 'pageviews', 'asc' );
	assert.strictEqual( asc[0].value, 'low' );
	assert.strictEqual( asc[2].value, 'high' );
});

test( 'sortRows sorts alphabetically by value', () => {
	const rows: MockRow[] = [
		{ value: 'cherry', pageviews: 10, visitors: 5 },
		{ value: 'apple', pageviews: 20, visitors: 10 },
		{ value: 'banana', pageviews: 30, visitors: 15 }
	];

	const sorted = sortRows( rows, 'value', 'asc' );
	assert.strictEqual( sorted[0].value, 'apple' );
	assert.strictEqual( sorted[1].value, 'banana' );
	assert.strictEqual( sorted[2].value, 'cherry' );
});

test( 'calculateTaggedRatio computes ratio out of 10 correctly', () => {
	assert.strictEqual( calculateTaggedRatio( 80, 100 ), 8 );
	assert.strictEqual( calculateTaggedRatio( 79, 100 ), 8 );
	assert.strictEqual( calculateTaggedRatio( 24, 100 ), 2 );
	assert.strictEqual( calculateTaggedRatio( 0, 100 ), 0 );
	assert.strictEqual( calculateTaggedRatio( 0, 0 ), 0 );
	assert.strictEqual( calculateTaggedRatio( 150, 100 ), 10 );
});

interface MockKeyRow {
	parameter: string;
	pageviews: number;
	visitors: number;
}

const sortKeyRows = (
	rows: MockKeyRow[],
	sortField: 'parameter' | 'pageviews' | 'visitors',
	sortDirection: 'asc' | 'desc'
): MockKeyRow[] => {
	const sorted = [ ...rows ];
	sorted.sort( ( a, b ) => {
		let cmp = 0;
		if ( 'parameter' === sortField ) {
			cmp = ( a.parameter || '' ).localeCompare( b.parameter || '' );
		} else {
			cmp = ( a[sortField] || 0 ) - ( b[sortField] || 0 );
		}
		return 'asc' === sortDirection ? cmp : -cmp;
	});
	return sorted;
};

test( 'sortKeyRows sorts Level 1 rows by parameter and metrics', () => {
	const rows: MockKeyRow[] = [
		{ parameter: 'utm_source', pageviews: 200, visitors: 150 },
		{ parameter: 'fbclid', pageviews: 50, visitors: 40 },
		{ parameter: 'utm_campaign', pageviews: 500, visitors: 300 }
	];

	const byParamAsc = sortKeyRows( rows, 'parameter', 'asc' );
	assert.strictEqual( byParamAsc[0].parameter, 'fbclid' );
	assert.strictEqual( byParamAsc[1].parameter, 'utm_campaign' );
	assert.strictEqual( byParamAsc[2].parameter, 'utm_source' );

	const byViewsDesc = sortKeyRows( rows, 'pageviews', 'desc' );
	assert.strictEqual( byViewsDesc[0].parameter, 'utm_campaign' );
	assert.strictEqual( byViewsDesc[1].parameter, 'utm_source' );
	assert.strictEqual( byViewsDesc[2].parameter, 'fbclid' );
});

