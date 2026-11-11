type ColumnOption = {

	/** Whether the column needs a valid license. */
	pro?: boolean;

	/** Whether the column labels the rows, by grouping the query on it. */
	group_by?: boolean;
};

/**
 * Get the columns a datatable can show with the current license.
 *
 * Pro columns are left out without a valid license. When that removes every
 * column the rows are grouped on, for example after a license expires on a saved
 * selection of source columns, the first free group column takes their place.
 * Without it the query has no GROUP BY and the table shows one unlabeled row.
 *
 * @param {string[]} columns        The selected columns.
 * @param {Record<string, ColumnOption>} columnsOptions The options of all columns of the table.
 * @param {boolean} isLicenseValid  Whether the license is valid.
 * @return {string[]} The columns to show.
 */
export const getLicensedColumns = (
	columns: string[],
	columnsOptions: Record<string, ColumnOption>,
	isLicenseValid: boolean
): string[] => {
	const isGroupColumn = ( column: string ): boolean => Boolean( columnsOptions[column]?.group_by );
	const licensedColumns = columns.filter( ( column ) => ! columnsOptions[column]?.pro || isLicenseValid );

	const hasLostAllGroupColumns = columns.some( isGroupColumn ) && ! licensedColumns.some( isGroupColumn );
	if ( ! hasLostAllGroupColumns ) {
		return licensedColumns;
	}

	const fallbackColumn = Object.keys( columnsOptions ).find( ( column ) => isGroupColumn( column ) && ! columnsOptions[column]?.pro );

	return fallbackColumn ? [ fallbackColumn, ...licensedColumns ] : licensedColumns;
};
