type ResolveTableColumnsArgs = {

	/** The columns the user saved for this table, if any. */
	saved?: string[];

	/** The columns that existed when that selection was saved, if recorded. */
	known?: string[];

	/** The table's default columns. */
	defaults: string[];

	/** The columns that exist now. */
	available: string[];

	/**
	 * Columns that only exist under a condition (e.g. a plugin being active) and
	 * should be added to a selection saved before they could be chosen.
	 */
	addWhenAvailable?: string[];
};

/**
 * Resolve the visible columns of a datatable from the saved selection.
 *
 * A default column that did not exist when the selection was saved is added, so a
 * column that appears later (e.g. the AI match column once SmartMatch is active)
 * shows up without the user having to find it. A column the user switched off
 * while it existed stays off. Selections saved before the existing columns were
 * recorded treat every column as known, except the `addWhenAvailable` ones.
 *
 * @param {ResolveTableColumnsArgs} args The saved selection, defaults and available columns.
 * @return {string[]} The columns to show, limited to the available ones.
 */
export const resolveTableColumns = ({
	saved,
	known,
	defaults,
	available,
	addWhenAvailable = []
}: ResolveTableColumnsArgs ): string[] => {
	const isAvailable = ( column: string ): boolean => available.includes( column );

	if ( ! saved ) {
		return defaults.filter( isAvailable );
	}

	const knownColumns = known ?? [ ...saved, ...available.filter( ( column ) => ! addWhenAvailable.includes( column ) ) ];
	const added = defaults.filter( ( column ) => isAvailable( column ) && ! knownColumns.includes( column ) && ! saved.includes( column ) );

	return [ ...saved, ...added ].filter( isAvailable );
};
