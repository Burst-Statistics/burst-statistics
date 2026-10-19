import React, { memo } from 'react';
import Icon from '@/utils/Icon';

export type SortDirection = 'asc' | 'desc';

/**
 * Computes next sort direction when toggling a column.
 *
 * @param {string}        currentField Currently active sort field.
 * @param {SortDirection} currentDir   Currently active sort direction.
 * @param {string}        newField     Field being sorted.
 * @param {string}        textField    Field that defaults to 'asc' instead of 'desc'.
 * @return {SortDirection} Next sort direction.
 */
export const getNextSortDirection = (
	currentField: string,
	currentDir: SortDirection,
	newField: string,
	textField: string
): SortDirection => {
	if ( currentField === newField ) {
		return 'asc' === currentDir ? 'desc' : 'asc';
	}
	return newField === textField ? 'asc' : 'desc';
};

/**
 * Compares two row values based on whether the column is text or numeric.
 *
 * @param {unknown} a      First value.
 * @param {unknown} b      Second value.
 * @param {boolean} isText Whether the column is text.
 * @return {number} Sort comparison integer.
 */
// fallow-ignore-next-line complexity
const compareRowValues = (
	a: unknown,
	b: unknown,
	isText: boolean
): number => {
	if ( isText ) {
		return String( a ?? '' ).localeCompare( String( b ?? '' ) );
	}
	return ( Number( a ) || 0 ) - ( Number( b ) || 0 );
};

/**
 * Generic sorter for sub-table rows with a text field and numeric metric fields.
 *
 * @param {T[]}           rows          Rows to sort.
 * @param {string}        sortField     Field to sort by.
 * @param {SortDirection} sortDirection Direction.
 * @param {string}        textField     Name of string column.
 * @return {T[]} Sorted rows copy.
 */
export function sortSubTableRows<T>(
	rows: T[],
	sortField: string,
	sortDirection: SortDirection,
	textField: string
): T[] {
	const sorted = [ ...rows ];
	const isAsc = 'asc' === sortDirection;
	const isText = sortField === textField;

	// fallow-ignore-next-line complexity
	sorted.sort( ( a, b ) => {
		const aVal = ( a as Record<string, unknown> )?.[sortField];
		const bVal = ( b as Record<string, unknown> )?.[sortField];
		const cmp = compareRowValues( aVal, bVal, isText );
		return isAsc ? cmp : -cmp;
	});
	return sorted;
}

interface ParameterSortHeaderProps {

	/** Identifier for this column's sort field. */
	field: string;

	/** Label to display in the column header. */
	label: string;

	/** Current active sort field. */
	activeSortField: string;

	/** Current active sort direction. */
	sortDirection: SortDirection;

	/** Callback invoked when the header is clicked. */
	onSort: ( field: string ) => void;

	/** Content alignment for the header cell. */
	align?: 'left' | 'right';

	/** Optional additional CSS classes. */
	className?: string;
}

/**
 * Reusable sortable column header for expandable sub-row tables.
 *
 * Renders an accessible sort button with a directional chevron caret
 * when this column is active.
 *
 * @param {ParameterSortHeaderProps} props Component props.
 * @return {JSX.Element} Table header element.
 */
const ParameterSortHeader: React.FC<ParameterSortHeaderProps> = ({
	field,
	label,
	activeSortField,
	sortDirection,
	onSort,
	align = 'left',
	className = ''
}) => {
	const isActive = activeSortField === field;
	const isRight = 'right' === align;

	return (
		<th
			scope="col"
			onClick={() => onSort( field )}
			className={`cursor-pointer py-2.5 uppercase tracking-wider select-none hover:text-text-black ${
				isRight ? 'px-3 text-right' : 'pl-4 pr-3 text-left'
			} ${className}`}
		>
			<div
				className={`flex items-center gap-1 ${
					isRight ? 'justify-end' : 'justify-start'
				}`}
			>
				<span>{label}</span>
				{isActive && (
					<Icon
						name={'asc' === sortDirection ? 'chevron-up' : 'chevron-down'}
						size={12}
						color="gray"
					/>
				)}
			</div>
		</th>
	);
};

export default memo( ParameterSortHeader );
