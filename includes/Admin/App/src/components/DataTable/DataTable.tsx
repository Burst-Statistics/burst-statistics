import ReactDataTable, { type TableProps } from 'react-data-table-component';
import { StyleSheetManager } from 'styled-components';
import isPropValid from '@emotion/is-prop-valid';

// react-data-table-component passes layout props such as `right` and `grow`
// to its styled-components, which would otherwise forward them to the DOM and
// trigger warnings in styled-components v6.
const DATA_TABLE_PROPS = [
	'right',
	'grow',
	'wrap',
	'allowOverflow',
	'button',
	'center',
	'compact',
	'hide',
	'ignoreRowClick',
	'maxWidth',
	'minWidth',
	'omit',
	'reorder',
	'sortable',
	'width'
];

const shouldForwardProp = ( prop: string ): boolean => {
	if ( DATA_TABLE_PROPS.includes( prop ) ) {
		return false;
	}

	return isPropValid( prop );
};

/**
 * react-data-table-component wrapped in the StyleSheetManager it needs.
 * Keeping the manager here, instead of at the app root, keeps
 * styled-components out of the core bundle for routes without tables.
 */
function DataTable<T>( props: TableProps<T> ) {
	return (
		<StyleSheetManager shouldForwardProp={shouldForwardProp}>
			<ReactDataTable {...props} />
		</StyleSheetManager>
	);
}

export default DataTable;
