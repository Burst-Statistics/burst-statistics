import { ReactNode } from 'react';

/**
 * Column definition for the BarDataTable.
 *
 * @template T - The row data type.
 */
export type BarColumn<T> = {

	/** Unique key identifying the column. */
	key: string;

	/** Column header label. */
	label: string;

	/** Horizontal alignment for header and cell content. */
	align?: 'left' | 'right' | 'center';

	/**
	 * Fixed width for this column in the CSS grid.
	 * Left-aligned columns default to `1fr`; right/center-aligned columns
	 * default to `${minWidth ?? 80}px`.
	 */
	width?: string;

	/** Minimum width in pixels (used when `width` is not set). */
	minWidth?: number;

	/**
	 * Custom cell renderer. Receives the row and index.
	 * If omitted, renders `row[key]` as a string.
	 *
	 * @param {T}      row   - The row data object.
	 * @param {number} index - The row index in the current dataset.
	 * @return {ReactNode} The rendered cell content.
	 */
	cell?: ( row: T, index: number ) => ReactNode;
};

/**
 * Props for the BarDataTable component.
 *
 * @template T - The row data type.
 */
export type BarDataTableProps<T extends Record<string, unknown>> = {

	/** Column definitions. */
	columns: BarColumn<T>[];

	/** The dataset to display. */
	data: T[];

	/**
	 * Derives a stable key from each row, used as the React key.
	 *
	 * @param {T} row - The row data object.
	 * @return {string | number} A unique key for the row.
	 */
	rowKey: ( row: T ) => string | number;

	/**
	 * Key of the column whose cells should display a proportional bar
	 * background. The column must hold numeric values.
	 */
	barColumnKey?: keyof T;

	/** Whether to show a skeleton loading state. */
	isLoading?: boolean;

	/** Rendered when data is empty and not loading. */
	emptyState?: ReactNode;

	/** Additional class names applied to the wrapping element. */
	className?: string;
};
