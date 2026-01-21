import { __ } from '@wordpress/i18n';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import PopoverFilter from '../Common/PopoverFilter';
import SearchButton from '../Common/SearchButton';
import DataTableSelect from './DataTableSelect';
import { useDataTableStore } from '@/store/useDataTableStore';
import EmptyDataTable from './EmptyDataTable';
import DataTable from 'react-data-table-component';
import { useDate } from '@/store/useDateStore';
import { useFilters } from '@/hooks/useFilters';
import { useQuery } from '@tanstack/react-query';
import getDataTableData from '@/api/getDataTableData';
import { Block } from '@/components/Blocks/Block';
import { BlockHeading } from '@/components/Blocks/BlockHeading';
import { BlockContent } from '@/components/Blocks/BlockContent';
import useSettingsData from '@/hooks/useSettingsData';
import DownloadCsvButton from '@/components/Statistics/DownloadCsvButton';
import { COLUMN_FORMATTERS, FORMATS } from '@/api/getDataTableData';
import {
	getCountryName,
	getContinentName
} from '@/utils/formatting';

/**
 * DataTableBlock component for displaying a block with a datatable. This
 * component is used in the StatisticsPage.
 *
 * @param  {Object}  props                Component props.
 * @param  {Array}   props.allowedConfigs Allowed datatable configurations.
 * @param  {string}  props.id             Unique identifier for the datatable.
 * @param  {boolean} props.isEcommerce    Whether this is an eCommerce datatable.
 * @return {JSX.Element} The DataTableBlock component.
 */
const DataTableBlock = ({
							allowedConfigs = [ 'pages', 'referrers' ],
							id,
							isEcommerce = false
						}) => {
	const { startDate, endDate, range } = useDate( ( state ) => state );
	const { filters } = useFilters();
	const defaultConfig = allowedConfigs[0];
	const { getValue } = useSettingsData();
	const filterByDomain = getValue( 'filtering_by_domain' );

	// Check if eCommerce features should be loaded.
	const shouldLoadEcommerce = window.burst_settings?.shouldLoadEcommerce || false;

	const config = {
		pages: {
			label: __( 'Pages', 'burst-statistics' ),
			searchable: true,
			defaultColumns: [ 'page_url', 'pageviews', 'visitors', 'bounce_rate' ],
			columnsOptions: {
				...( filterByDomain && {
					host: {
						label: __( 'Domain', 'burst-statistics' ),
						default: false,
						format: 'url',
						align: 'left',
						group_by: false
					}
				}),
				page_url: {
					label: __( 'Page', 'burst-statistics' ),
					default: true,
					format: 'url',
					align: 'left',
					group_by: true
				},
				pageviews: {
					label: __( 'Pageviews', 'burst-statistics' ),
					category: 'traffic',
					align: 'right'
				},
				visitors: {
					label: __( 'Visitors', 'burst-statistics' ),
					category: 'traffic',
					pro: false,
					align: 'right'
				},
				sessions: {
					label: __( 'Sessions', 'burst-statistics' ),
					category: 'traffic',
					pro: true,
					align: 'right'
				},
				bounce_rate: {
					label: __( 'Bounce rate', 'burst-statistics' ),
					category: 'engagement',
					format: 'percentage',
					pro: false,
					align: 'right'
				},
				avg_time_on_page: {
					label: __( 'Avg. time on page', 'burst-statistics' ),
					category: 'engagement',
					pro: true,
					format: 'time',
					align: 'right'
				},
				entrances: {
					label: __( 'Entrances', 'burst-statistics' ),
					category: 'engagement',
					pro: true,
					align: 'right'
				},
				exit_rate: {
					label: __( 'Exit rate', 'burst-statistics' ),
					category: 'engagement',
					pro: true,
					format: 'percentage',
					align: 'right'
				},
				conversions: {
					label: __( 'Goal completions', 'burst-statistics' ),
					category: 'conversions',
					pro: true,
					align: 'right'
				},
				conversion_rate: {
					label: __( 'Goal conv. rate', 'burst-statistics' ),
					category: 'conversions',
					format: 'percentage',
					pro: true,
					align: 'right'
				},
				...( shouldLoadEcommerce && {
					sales: {
						label: __( 'Sales', 'burst-statistics' ),
						category: 'conversions',
						pro: true,
						format: 'integer',
						align: 'right'
					},
					revenue: {
						label: __( 'Revenue', 'burst-statistics' ),
						category: 'conversions',
						pro: true,
						format: 'currency',
						align: 'right'
					},
					sales_conversion_rate: {
						label: __( 'Sales conv. rate', 'burst-statistics' ),
						category: 'conversions',
						pro: true,
						format: 'percentage',
						align: 'right'
					},
					page_value: {
						label: __( 'Page value', 'burst-statistics' ),
						category: 'conversions',
						pro: true,
						format: 'currency',
						align: 'right'
					}
				})
			}
		},
		referrers: {
			label: __( 'Referrers', 'burst-statistics' ),
			searchable: true,
			defaultColumns: [
				'referrer', 'visitors', 'bounce_rate', ...( shouldLoadEcommerce ? [ 'sales', 'revenue' ] : [ 'conversions' ]) ],
			columnsOptions: {
				referrer: {
					label: __( 'Referrer', 'burst-statistics' ),
					default: true,
					format: 'referrer',
					align: 'left',
					group_by: true
				},
				visitors: {
					label: __( 'Visitors', 'burst-statistics' ),
					category: 'traffic',
					pro: true,
					align: 'right'
				},
				sessions: {
					label: __( 'Sessions', 'burst-statistics' ),
					category: 'traffic',
					pro: true,
					align: 'right'
				},
				bounce_rate: {
					label: __( 'Bounce rate', 'burst-statistics' ),
					category: 'engagement',
					format: 'percentage',
					pro: true,
					align: 'right'
				},
				conversions: {
					label: __( 'Goal completions', 'burst-statistics' ),
					category: 'conversions',
					pro: true,
					align: 'right'
				},
				...( shouldLoadEcommerce && {
					sales: {
						label: __( 'Sales', 'burst-statistics' ),
						category: 'conversions',
						pro: true,
						format: 'integer',
						align: 'right'
					},
					revenue: {
						label: __( 'Revenue', 'burst-statistics' ),
						category: 'conversions',
						pro: true,
						format: 'currency',
						align: 'right'
					},
					page_value: {
						label: __( 'Page value', 'burst-statistics' ),
						category: 'conversions',
						pro: true,
						format: 'currency',
						align: 'right'
					}
				})
			}
		},
		countries: {
			label: __( 'Locations', 'burst-statistics' ),
			pro: true,
			searchable: true,
			defaultColumns: [
				'country_code',
				'visitors',
				...( shouldLoadEcommerce ? [ 'revenue', 'sales_conversion_rate' ] : [])
			],
			columnsOptions: {
				country_code: {
					label: __( 'Country', 'burst-statistics' ),
					default: true,
					format: 'country',
					align: 'left',
					group_by: true
				},
				state: {
					label: __( 'State', 'burst-statistics' ),
					format: 'text',
					align: 'left',
					group_by: true
				},
				city: {
					label: __( 'City', 'burst-statistics' ),
					format: 'text',
					align: 'left',
					group_by: true
				},
				continent: {
					label: __( 'Continent', 'burst-statistics' ),
					format: 'continent',
					align: 'left',
					group_by: true
				},
				visitors: {
					label: __( 'Visitors', 'burst-statistics' ),
					category: 'traffic',
					pro: true,
					align: 'right'
				},
				sessions: {
					label: __( 'Sessions', 'burst-statistics' ),
					category: 'traffic',
					pro: true,
					align: 'right'
				},
				bounce_rate: {
					label: __( 'Bounce rate', 'burst-statistics' ),
					category: 'engagement',
					format: 'percentage',
					pro: true,
					align: 'right'
				},
				conversions: {
					label: __( 'Goal completions', 'burst-statistics' ),
					category: 'conversions',
					pro: true,
					align: 'right'
				},
				...( shouldLoadEcommerce && {
					sales: {
						label: __( 'Sales', 'burst-statistics' ),
						category: 'conversions',
						pro: true,
						format: 'integer',
						align: 'right'
					},
					revenue: {
						label: __( 'Revenue', 'burst-statistics' ),
						category: 'conversions',
						pro: true,
						format: 'currency',
						align: 'right'
					},
					sales_conversion_rate: {
						label: __( 'Sales conv. rate', 'burst-statistics' ),
						category: 'conversions',
						pro: true,
						format: 'percentage',
						align: 'right'
					},
					avg_order_value: {
						label: __( 'Avg. order value', 'burst-statistics' ),
						category: 'conversions',
						pro: true,
						format: 'currency',
						align: 'right'
					}
				})
			}
		},
		campaigns: {
			label: __( 'Campaigns', 'burst-statistics' ),
			pro: true,
			searchable: true,
			defaultColumns: [
				'campaign',
				'visitors',
				...( shouldLoadEcommerce ? [ 'sales', 'revenue' ] : [ 'conversions' ])
			],
			columnsOptions: {
				campaign: {
					label: __( 'Campaign', 'burst-statistics' ),
					default: true,
					format: 'text',
					align: 'left',
					group_by: true
				},
				source: {
					label: __( 'Source', 'burst-statistics' ),
					format: 'text',
					align: 'left',
					group_by: true
				},
				medium: {
					label: __( 'Medium', 'burst-statistics' ),
					format: 'text',
					align: 'left',
					group_by: true
				},
				term: {
					label: __( 'Term', 'burst-statistics' ),
					format: 'text',
					align: 'left',
					group_by: true
				},
				content: {
					label: __( 'Content', 'burst-statistics' ),
					format: 'text',
					align: 'left',
					group_by: true
				},
				visitors: {
					label: __( 'Visitors', 'burst-statistics' ),
					category: 'traffic',
					pro: true,
					align: 'right'
				},
				bounce_rate: {
					label: __( 'Bounce rate', 'burst-statistics' ),
					category: 'engagement',
					format: 'percentage',
					pro: true,
					align: 'right'
				},
				conversions: {
					label: __( 'Goal completions', 'burst-statistics' ),
					category: 'conversions',
					pro: true,
					align: 'right'
				},
				conversion_rate: {
					label: __( 'Goal conv. rate', 'burst-statistics' ),
					category: 'conversions',
					format: 'percentage',
					pro: true,
					align: 'right'
				},
				...( shouldLoadEcommerce && {
					sales: {
						label: __( 'Sales', 'burst-statistics' ),
						category: 'conversions',
						pro: true,
						format: 'integer',
						align: 'right'
					},
					revenue: {
						label: __( 'Revenue', 'burst-statistics' ),
						category: 'conversions',
						pro: true,
						format: 'currency',
						align: 'right'
					},
					sales_conversion_rate: {
						label: __( 'Sales conv. rate', 'burst-statistics' ),
						category: 'conversions',
						pro: true,
						format: 'percentage',
						align: 'right'
					},
					page_value: {
						label: __( 'Page value', 'burst-statistics' ),
						category: 'conversions',
						pro: true,
						format: 'currency',
						align: 'right'
					}
				})
			}
		},
		parameters: {
			label: __( 'Parameters', 'burst-statistics' ),
			searchable: true,
			pro: true,
			defaultColumns: [ 'parameter', 'visitors' ],
			columnsOptions: {
				parameter: {
					label: __( 'Parameter', 'burst-statistics' ),
					default: true,
					format: 'text',
					align: 'left',
					group_by: true
				},
				parameters: {
					label: __( 'Parameters', 'burst-statistics' ),
					format: 'text',
					align: 'left',
					group_by: true
				},
				visitors: {
					label: __( 'Visitors', 'burst-statistics' ),
					category: 'traffic',
					pro: true,
					align: 'right'
				},
				bounce_rate: {
					label: __( 'Bounce rate', 'burst-statistics' ),
					category: 'engagement',
					format: 'percentage',
					pro: true,
					align: 'right'
				},
				conversions: {
					label: __( 'Goal completions', 'burst-statistics' ),
					category: 'conversions',
					pro: true,
					align: 'right'
				},
				...( shouldLoadEcommerce && {
					sales: {
						label: __( 'Sales', 'burst-statistics' ),
						category: 'conversions',
						pro: true,
						format: 'integer',
						align: 'right'
					},
					revenue: {
						label: __( 'Revenue', 'burst-statistics' ),
						category: 'conversions',
						pro: true,
						format: 'currency',
						align: 'right'
					},
					sales_conversion_rate: {
						label: __( 'Sales conv. rate', 'burst-statistics' ),
						category: 'conversions',
						pro: true,
						format: 'percentage',
						align: 'right'
					}
				})
			}
		},
		ghost: {
			label: __( 'Dummy', 'burst-statistics' ),
			searchable: true,
			defaultColumns: [ 'pageviews' ],
			columnsOptions: {
				pageviews: {
					label: __( 'Pageviews', 'burst-statistics' ),
					align: 'right'
				},
				visitors: {
					label: __( 'Visitors', 'burst-statistics' ),
					pro: true,
					align: 'right'
				},
				sessions: {
					label: __( 'Sessions', 'burst-statistics' ),
					pro: true,
					align: 'right'
				}
			}
		},
		products: {
			label: __( 'Products', 'burst-statistics' ),
			pro: true,
			searchable: true,
			defaultColumns: [ 'product', 'sales', 'revenue' ],
			columnsOptions: {
				product: {
					label: __( 'Product', 'burst-statistics' ),
					default: true,
					format: 'text',
					align: 'left',
					group_by: true
				},
				adds_to_cart: {
					label: __( 'Adds to cart', 'burst-statistics' ),
					pro: true,
					align: 'right'
				},
				sales: {
					label: __( 'Sales', 'burst-statistics' ),
					pro: true,
					align: 'right'
				},
				revenue: {
					label: __( 'Revenue', 'burst-statistics' ),
					pro: true,
					format: 'currency',
					align: 'right'
				}
			}
		}
	};

	// Use the DataTable store
	const {
		getSelectedConfig,
		setSelectedConfig: setSelectedConfigStore,
		getColumns: getColumnsStore,
		setColumns: setColumnsStore,
		getSortConfig,
		setSortConfig
	} = useDataTableStore();

	const [ selectedConfig, setSelectedConfigState ] = useState( () =>
		getSelectedConfig( id, defaultConfig )
	);

	const configDetails = useMemo(
		() => config[selectedConfig],
		[ selectedConfig ] // eslint-disable-line react-hooks/exhaustive-deps
	);
	const columnsOptions = useMemo(
		() => configDetails?.columnsOptions || {},
		[ configDetails ]
	);
	const defaultColumns = useMemo(
		() => configDetails?.defaultColumns || [],
		[ configDetails ]
	);

	const [ columns, setColumnsState ] = useState( () => {
		const initialColumns = getColumnsStore( selectedConfig, defaultColumns );
		const availableColumns = Object.keys( columnsOptions );
		return initialColumns.filter( ( column ) =>
			availableColumns.includes( column )
		);
	});

	// Sort state: initialise from localStorage
	const [ sortField, setSortFieldState ] = useState( () => {
		const saved = getSortConfig( selectedConfig );
		return saved?.fieldId ?? 2;
	});

	const [ sortDirection, setSortDirectionState ] = useState( () => {
		const saved = getSortConfig( selectedConfig );
		return saved?.direction ?? 'desc';
	});

	const setColumns = useCallback(
		( value ) => {
			const orderedColumns = value.filter( ( key ) =>
				Object.keys( columnsOptions ).includes( key )
			);
			if ( JSON.stringify( orderedColumns ) !== JSON.stringify( columns ) ) {
				setColumnsState( orderedColumns );
				setColumnsStore( selectedConfig, orderedColumns );
			}
		},
		[ selectedConfig, columns, columnsOptions, setColumnsStore ]
	);

	const setSelectedConfig = useCallback(
		async( value ) => {
			setSelectedConfigState( value );
			setSelectedConfigStore( id, value );
		},
		[ id, setSelectedConfigStore ]
	);

	useEffect( () => {
		const newColumns = getColumnsStore(
			selectedConfig,
			config[selectedConfig]?.defaultColumns || []
		);
		setColumns( newColumns );

		const savedSort = getSortConfig( selectedConfig );
		if ( savedSort ) {
			setSortFieldState( savedSort.fieldId );
			setSortDirectionState( savedSort.direction );
		} else {
			setSortFieldState( 2 );
			setSortDirectionState( 'desc' );
		}
	}, [ selectedConfig, setColumns, getColumnsStore, getSortConfig ]); // eslint-disable-line react-hooks/exhaustive-deps


	const handleSort = useCallback(
		( column, sortDirection ) => {
			const fieldId = column.id || column.selector;
			const direction = sortDirection.toLowerCase();

			setSortFieldState( fieldId );
			setSortDirectionState( direction );
			setSortConfig( selectedConfig, {
				fieldId,
				direction
			});
		},
		[ selectedConfig, setSortConfig ]
	);

	// search
	const [ filterText, setFilterText ] = useState( '' );

	// only add select options that are allowed, only allow key and label
	const selectOptions = useMemo( () => {
		return Object.keys( config )
			.filter( ( key ) => allowedConfigs.includes( key ) )
			.map( ( key ) => ({
				key,
				label: config[key].label,
				pro: !! config[key].pro,
				upsellPopover: config[key].upsellPopover || null
			}) );
	}, [ allowedConfigs ]); // eslint-disable-line react-hooks/exhaustive-deps

	// query
	const args = useMemo( () => {
		const queryArgs = {
			filters,
			metrics: Object.keys( columnsOptions ).filter( ( column ) =>
				columns.includes( column )
			),
			group_by: []
		};

		// add group by based on the columnOptions
		columns.forEach( ( column ) => {
			if ( columnsOptions[column]?.group_by ) {
				queryArgs.group_by.push( column );
			}
		});

		return queryArgs;
	}, [ filters, columnsOptions, columns ]);

	const query = useQuery({
		queryKey: [ selectedConfig, startDate, endDate, args ],
		queryFn: () =>
			getDataTableData({
				type: isEcommerce ? 'ecommerce-datatable' : 'datatable',
				startDate,
				endDate,
				range,
				args,
				columnsOptions
			}),
		enabled: !! selectedConfig // The query will run only if selectedConfig is truthy
	});

	const data = query.data || {};
	const tableData = useMemo( () => data.data || [], [ data.data ]);
	const columnsData = data.columns;

	/**
	 * To enable searching on formatted values, we need to get the formatted value.
	 * @param value
	 * @param format
	 * @param columnId
	 * @returns {*|string|string}
	 */
	const getSearchableValue = ( value, format, columnId ) => {
		if ( null === value || value === undefined ) {
			return '';
		}

		const formatter = COLUMN_FORMATTERS[format];
		if ( ! formatter ) {
			return value.toString();
		}

		const formatted = formatter( value, columnId );
		if ( null === formatted || formatted === undefined ) {
			return '';
		}

		if ( 'object' === typeof formatted ) {
			if ( format === FORMATS.COUNTRY ) {
				return getCountryName( value ) || value;
			}
			if ( format === FORMATS.CONTINENT ) {
				return getContinentName( value ) || value;
			}
			return value.toString();
		}

		return formatted.toString();
	};

	// Add a useMemo to sort columnsData based on columnsOptions order
	const sortedColumnsData = useMemo( () => {

		// Check if columnsData and columnsOptions are valid
		if ( ! columnsData || ! columnsOptions ) {
			return [];
		}

		// Create an array from columnsOptions keys to define the order
		const order = Object.keys( columnsOptions );

		// Sort columnsData based on the order of columns in columnsOptions
		return columnsData.sort( ( a, b ) => {
			const orderA = order.indexOf( a.selector );
			const orderB = order.indexOf( b.selector );

			return orderA - orderB;
		});
	}, [ columnsData, columnsOptions ]);


	// Memoize the filtered data to avoid recalculations
	const filteredData = useMemo( () => {
		let filtered = [];
		if ( configDetails?.searchable && Array.isArray( tableData ) ) {
			if ( '' === filterText.trim() ) {
				filtered = tableData;
			} else {
				const searchTerm = filterText.toLowerCase();

				// Get searchable columns (those with group_by: true)
				const searchableColumns = Object.keys( columnsOptions ).filter(
					( column ) => columnsOptions[column]?.group_by
				);

				filtered = tableData.filter( ( item ) => {

					// Search through all searchable columns
					return searchableColumns.some( ( column ) => {
						const value = item[column];
						if ( null === value || value === undefined ) {
							return false;
						}
						const format = columnsOptions[column]?.format;
						const searchValue = getSearchableValue( value, format, column );
						return searchValue.toLowerCase().includes( searchTerm );
					});
				});
			}
		} else {
			filtered = tableData;
		}

		// Sort the filtered data.
		// Safety check: ensure sortedColumnsData exists and has items
		if ( ! sortedColumnsData || ! Array.isArray( sortedColumnsData ) || 0 === sortedColumnsData.length ) {
			return filtered;
		}

		filtered = [ ...filtered ].sort( ( a, b ) => {
			let actualSortField = sortField;

			//if sortField is not in sortedColumnsData, use the second column as default
			if ( ! actualSortField && 1 < sortedColumnsData.length ) {
				actualSortField = sortedColumnsData[1].id;
			}

			const aValue = a[actualSortField];
			const bValue = b[actualSortField];

			// Handle null/undefined values
			if ( null === aValue || aValue === undefined ) {
return 1;
}
			if ( null === bValue || bValue === undefined ) {
return -1;
}

			// Check if both values are numeric (including numeric strings)
			const aNum = Number( aValue );
			const bNum = Number( bValue );
			const aIsNumeric = ! isNaN( aNum ) && '' !== aValue && null !== aValue;
			const bIsNumeric = ! isNaN( bNum ) && '' !== bValue && null !== bValue;

			// If both are numeric, do numeric comparison
			if ( aIsNumeric && bIsNumeric ) {
				return 'asc' === sortDirection ? aNum - bNum : bNum - aNum;
			}

			// String comparison for non-numeric values
			const aStr = String( aValue ).toLowerCase();
			const bStr = String( bValue ).toLowerCase();

			if ( 'asc' === sortDirection ) {
				return aStr.localeCompare( bStr );
			} else {
				return bStr.localeCompare( aStr );
			}
		});

		return Array.isArray( filtered ) ? filtered : [];
	}, [ sortField, sortDirection, tableData, filterText, configDetails?.searchable, columnsOptions, sortedColumnsData ]);

	const isLoading = query.isLoading || query.isFetching;
	const error = query.error;
	const noData = 0 === filteredData.length;

	// sortedColumns the first column should have overflow true.
	if ( 0 < sortedColumnsData.length ) {
		sortedColumnsData[0] = {
			...sortedColumnsData[0],
			allowOverflow: true,
			wrap: false,
			grow: 2
		};
	}

	// Memoize DataTable props to prevent unnecessary re-renders
	const dataTableProps = useMemo(

		() => {

			const sortColumnIndex = sortedColumnsData.findIndex( col =>
				col.id === sortField
			);

			// findIndex returns -1 if not found, default to 2, otherwise use 1-based index
			const sortFieldId = -1 !== sortColumnIndex ? sortColumnIndex + 1 : 2;

			return {
			columns: sortedColumnsData,
			data: filteredData,
			sortServer: true,
			defaultSortFieldId: sortFieldId,
			defaultSortAsc: 'asc' === sortDirection,
			onSort: handleSort,
			pagination: true,
			paginationRowsPerPageOptions: [ 10, 25, 50, 100, 200 ],
			paginationPerPage: 10,
			paginationComponentOptions: {
				rowsPerPageText: '',
				rangeSeparatorText: __( 'of', 'burst-statistics' ),
				noRowsPerPage: false,
				selectAllRowsItem: true,
				selectAllRowsItemText: __( 'All', 'burst-statistics' )
			},
			noDataComponent: (
				<EmptyDataTable
					noData={noData}
					data={[]}
					isLoading={isLoading}
					error={error}
				/>
			),

			// Additional optimization
			progressPending: isLoading,
			progressComponent: (
				<EmptyDataTable
					noData={noData}
					data={[]}
					isLoading={isLoading}
					error={error}
				/>
			)
		};
},
		[ sortedColumnsData, filteredData, sortField, sortDirection, handleSort, noData, isLoading, error ]
	);

	// Early return if config details are not available
	if ( ! configDetails ) {
		return null;
	}

	const siteUrl = window.burst_admin?.site_url || window.location.origin;

	const safeDomain = new URL( siteUrl ).hostname
		.replace( /\./g, '-' )
		.replace( /[^a-zA-Z0-9-]/g, '' );

	const fileName = `${safeDomain}-${selectedConfig}-${startDate}-${endDate}`;


	return (
		<Block className="row-span-2 overflow-hidden xl:col-span-6 group/root">
			<BlockHeading
				className="border-b border-gray-200"
				title={
					<DataTableSelect
						value={selectedConfig}
						onChange={setSelectedConfig}
						options={selectOptions}
						disabled={[]}
					/>
				}
				controls={
					<>
						{configDetails?.searchable && (
							<SearchButton
								value={filterText}
								onChange={setFilterText}
								className="ml-auto"
							/>
						)}

						<DownloadCsvButton
							data={filteredData}
							filename={fileName}
						/>

						<PopoverFilter
							selectedOptions={columns}
							options={columnsOptions}
							defaultOptions={defaultColumns}
							onApply={setColumns}
						/>
					</>
				}
			/>
			<BlockContent className="px-0 py-0">
				<DataTable {...dataTableProps} />
			</BlockContent>
		</Block>
	);
};

// Export a memoized version of the component to prevent unnecessary re-renders
export default memo( DataTableBlock );
