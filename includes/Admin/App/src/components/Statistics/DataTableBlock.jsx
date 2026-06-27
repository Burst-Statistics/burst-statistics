import { __, _n, sprintf } from '@wordpress/i18n';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import * as Checkbox from '@radix-ui/react-checkbox';
import PopoverFilter from '../Common/PopoverFilter';
import SearchButton from '../Common/SearchButton';
import DataTableSelect from './DataTableSelect';
import { useDataTableStore } from '@/store/useDataTableStore';
import EmptyDataTable from './EmptyDataTable';
import DataTable from 'react-data-table-component';
import { useQuery } from '@tanstack/react-query';
import getDataTableData from '@/api/getDataTableData';
import { getPageParameterCounts } from '@/api/getPageParameters';
import ParameterVariationsRow from './ParameterVariationsRow';
import { Block } from '@/components/Blocks/Block';
import { BlockHeading } from '@/components/Blocks/BlockHeading';
import { BlockContent } from '@/components/Blocks/BlockContent';
import { BlockFooter } from '@/components/Blocks/BlockFooter';
import useSettingsData from '@/hooks/useSettingsData';
import useLicenseData from '@/hooks/useLicenseData';
import DownloadCsvButton from '@/components/Statistics/DownloadCsvButton';
import { COLUMN_FORMATTERS, FORMATS } from '@/api/getDataTableData';
import ClickToFilter from '@/components/Common/ClickToFilter';
import {
	getCountryName,
	getContinentName
} from '@/utils/formatting';
import { safeDecodeURI } from '@/utils/lib';
import {useBlockConfig} from '@/hooks/useBlockConfig';
import { useNavigate, useRouterState } from '@tanstack/react-router';
import Icon from '@/utils/Icon';

/**
 * Resolve a hostname from a potentially incomplete site URL.
 *
 * @param {string|undefined} siteUrl The configured site URL.
 * @return {string} A safe hostname fallback.
 */
const resolveHostname = ( siteUrl ) => {
	const fallbackHostname = window.location.hostname || 'site';

	if ( ! siteUrl || 'string' !== typeof siteUrl ) {
		return fallbackHostname;
	}

	const normalizedSiteUrl = siteUrl.trim();
	if ( ! normalizedSiteUrl ) {
		return fallbackHostname;
	}

	try {
		return new URL( normalizedSiteUrl ).hostname || fallbackHostname;
	} catch {
		const hasScheme = /^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test( normalizedSiteUrl );
		const candidateUrl = hasScheme ? normalizedSiteUrl : `https://${normalizedSiteUrl.replace( /^\/+/, '' )}`;

		try {
			return new URL( candidateUrl ).hostname || fallbackHostname;
		} catch {
			return fallbackHostname;
		}
	}
};

/**
 * DataTableBlock component for displaying a block with a datatable. This
 * component is used in the StatisticsPage.
 *
 * @param  {Object}  props                Component props.
 * @param  {Array}   props.allowedConfigs Allowed datatable configurations.
 * @param  {string}  props.id             Unique identifier for the datatable.
 * @param  {boolean} props.isEcommerce    Whether this is an eCommerce datatable.
 * @param  {Object}  props.customFilters  Custom filters to apply to the datatable.
 * @param  {number}  props.index          Index of the block in the page.
 * @param  {boolean} props.isInOverlay    When true, hides the expand button and adjusts layout for overlay mode.
 * @return {JSX.Element} The DataTableBlock component.
 */
const DataTableBlock = ( /** @type {BlockComponentProps} */ props ) => {
	// isInOverlay is overlay-specific and not part of useBlockConfig.
	const isInOverlay = props.isInOverlay ?? false;

	const {
		allowedConfigs = [],
		id,
		isEcommerce,
		startDate,
		endDate,
		range,
		filters,
		allowBlockFilters,
		isReport,
		index
	} = useBlockConfig( props );

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
				source_category: {
					label: __( 'Source category', 'burst-statistics' ),
					default: false,
					format: 'source_category',
					pro: true,
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

			// Country-level location tracking is free; region/city detail and
			// ecommerce metrics remain Pro (locked per-column below).
			pro: false,
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
					pro: true,
					align: 'left',
					group_by: true
				},
				city: {
					label: __( 'City', 'burst-statistics' ),
					format: 'text',
					pro: true,
					align: 'left',
					group_by: true
				},
				continent: {
					label: __( 'Continent', 'burst-statistics' ),
					format: 'continent',
					pro: true,
					align: 'left',
					group_by: true
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

				// TODO: Enable when product page view tracking is implemented.
				// product_views: {
				// 	label: __( 'Views', 'burst-statistics' ),
				// 	pro: true,
				// 	align: 'right'
				// },
				adds_to_cart: {
					label: __( 'Adds to cart', 'burst-statistics' ),
					pro: true,
					align: 'right'
				},

				// TODO: Enable when product page view tracking is implemented.
				// cart_to_view_rate: {
				// 	label: __( 'Cart-to-view rate', 'burst-statistics' ),
				// 	pro: true,
				// 	format: 'percentage',
				// 	align: 'right'
				// },
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

				// TODO: Enable when product page view tracking is implemented.
				// purchase_to_view_rate: {
				// 	label: __( 'Purchase-to-view rate', 'burst-statistics' ),
				// 	pro: true,
				// 	format: 'percentage',
				// 	align: 'right'
				// }
			}
		},
		subscription_products: {
			label: __( 'Plan performance', 'burst-statistics' ),
			pro: true,
			searchable: true,
			defaultColumns: [ 'plan', 'active_subscribers' ],
			columnsOptions: {
				plan: {
					label: __( 'Plan', 'burst-statistics' ),
					default: true,
					format: 'text',
					align: 'left',
					group_by: true
				},
				active_subscribers: {
					label: __( 'Active subs', 'burst-statistics' ),
					pro: true,
					align: 'right'
				},
				canceled_subscribers: {
					label: __( 'Canceled subs', 'burst-statistics' ),
					pro: true,
					align: 'right'
				},
			trialling_subscribers: {
				label: __( 'Trialling subs', 'burst-statistics' ),
				pro: true,
				align: 'right'
			},
			monthly_recurring_revenue: {
				label: __( 'MRR', 'burst-statistics' ),
				pro: true,
				format: 'currency',
				align: 'right'
			},
			product_churn_value: {
				label: __( 'Product churn value', 'burst-statistics' ),
				pro: true,
				format: 'percentage',
				align: 'right'
			}
		}
	},
		search_terms: {
			label: __( 'Website searches', 'burst-statistics' ),
			searchable: true,
			defaultColumns: [ 'term', 'volume', 'results' ],
			columnsOptions: {
				term: {
					label: __( 'Search term', 'burst-statistics' ),
					default: true,
					format: 'string',
					align: 'left',
					group_by: true
				},
				volume: {
					label: __( 'Volume', 'burst-statistics' ),
					format: 'integer',
					align: 'right'
				},
				results: {
					label: __( 'Results', 'burst-statistics' ),
					format: 'search_results',
					align: 'right'
				}
			}
		},
		reading_engagement: {
			label: __( 'Reading engagement', 'burst-statistics' ),
			searchable: true,
			defaultColumns: [ 'page_url', 'avg_time_on_page' ],
			columnsOptions: {
				page_url: {
					label: __( 'Page', 'burst-statistics' ),
					default: true,
					format: 'url',
					align: 'left',
					group_by: true
				},
				avg_time_on_page: {
					label: __( 'Avg. time on page', 'burst-statistics' ),
					format: 'time',
					align: 'right'
				}
			}
		},
		outgoing_links: {
			label: __( 'Outgoing links', 'burst-statistics' ),
			searchable: true,
			pro: true,
			defaultColumns: [ 'url', 'clicks' ],
			columnsOptions: {
				url: {
					label: __( 'URL', 'burst-statistics' ),
					default: true,
					format: 'external_link',
					align: 'left',
					group_by: true
				},
				clicks: {
					label: __( 'Clicks', 'burst-statistics' ),
					category: 'traffic',
					align: 'right'
				},
				previous_clicks: {
					label: __( 'Prev. clicks', 'burst-statistics' ),
					category: 'traffic',
					pro: true,
					align: 'right'
				},
				previous_clicks_yoy: {
					label: __( 'Prev. clicks YoY', 'burst-statistics' ),
					category: 'traffic',
					pro: true,
					align: 'right'
				}
			}
		},
		forms: {
			label: __( 'Forms', 'burst-statistics' ),
			searchable: true,
			pro: true,
			defaultColumns: [ 'form_title', 'submissions', 'conversion_rate' ],
			columnsOptions: {
				form_title: {
					label: __( 'Form', 'burst-statistics' ),
					default: true,
					format: 'form_title',
					align: 'left',
					group_by: true
				},
				form_provider_label: {
					label: __( 'Provider', 'burst-statistics' ),
					default: false,
					format: 'string',
					align: 'left',
					group_by: true
				},
				submissions: {
					label: __( 'Submissions', 'burst-statistics' ),
					category: 'traffic',
					align: 'right'
				},
				pageviews: {
					label: __( 'Visitors', 'burst-statistics' ),
					category: 'traffic',
					align: 'right'
				},
				conversion_rate: {
					label: __( 'Conversion rate', 'burst-statistics' ),
					category: 'engagement',
					format: 'percentage',
					align: 'right'
				},
				previous_submissions: {
					label: __( 'Prev. submissions', 'burst-statistics' ),
					category: 'traffic',
					pro: true,
					align: 'right'
				},
				previous_pageviews: {
					label: __( 'Prev. visitors', 'burst-statistics' ),
					category: 'traffic',
					pro: true,
					align: 'right'
				},
				previous_conversion_rate: {
					label: __( 'Prev. conv. rate', 'burst-statistics' ),
					category: 'engagement',
					format: 'percentage',
					pro: true,
					align: 'right'
				}
			}
		}
	};

	// Use the DataTable store.
	const {
		getSelectedConfig,
		setSelectedConfig: setSelectedConfigStore,
		getColumns: getColumnsStore,
		setColumns: setColumnsStore,
		getSortConfig,
		setSortConfig,
		getParameterVariations,
		setParameterVariations,
		getRowsPerPage,
		setRowsPerPage: setRowsPerPageStore
	} = useDataTableStore();

	const { isPro } = useLicenseData();

	const [ selectedConfig, setSelectedConfigState ] = useState( () => getSelectedConfig( id, defaultConfig ) );

	// Per-block toggle that controls whether parameter variations are shown
	// as expandable rows under each page row. Only meaningful for the pages
	// config and only available to Pro users.
	const [ paramVariationsToggle, setParamVariationsToggle ] = useState( () =>
		getParameterVariations( id )
	);

	const paramVariationsEnabled =
		isPro && 'pages' === selectedConfig && paramVariationsToggle;

	const handleParamVariationsToggle = useCallback(
		( value ) => {
			setParamVariationsToggle( value );
			setParameterVariations( id, value );
		},
		[ id, setParameterVariations ]
	);

	const configDetails = useMemo( () => config[selectedConfig], [ selectedConfig ]); // eslint-disable-line react-hooks/exhaustive-deps

	const columnsOptions = useMemo( () => configDetails?.columnsOptions || {}, [ configDetails ]);

	const defaultColumns = useMemo( () => configDetails?.defaultColumns || [], [ configDetails ]);

	const [ columns, setColumnsState ] = useState( () => {
		const initialColumns = getColumnsStore( selectedConfig, defaultColumns );
		const availableColumns = Object.keys( columnsOptions );

		return initialColumns.filter( ( column ) =>
			availableColumns.includes( column )
		);
	});

	// Sort state: initialize from localStorage
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

	const [ filterText, setFilterText ] = useState( '' );

	const ROWS_PER_PAGE_OPTIONS = [ 10, 25, 50, 100, 200 ];
	const [ currentPage, setCurrentPage ] = useState( 1 );
	const [ rowsPerPage, setRowsPerPageState ] = useState( () => {
		if ( isInOverlay ) {
			return getRowsPerPage( id, 100 );
		}
		return 10;
	});

	const setRowsPerPage = useCallback(
		( value ) => {
			setRowsPerPageState( value );
			if ( isInOverlay ) {
				setRowsPerPageStore( id, value );
			}
		},
		[ id, isInOverlay, setRowsPerPageStore ]
	);

	// Only add select options that are allowed, only allow key and label.
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

	const args = useMemo( () => {
		const queryArgs = {
			filters,
			metrics: Object.keys( columnsOptions ).filter( ( column ) =>
				columns.includes( column )
			),
			id: id,
			group_by: []
		};

		// Add group by based on the columnOptions.
		columns.forEach( ( column ) => {
			if ( columnsOptions[column]?.group_by ) {
				queryArgs.group_by.push( column );
			}
		});

		return queryArgs;
	}, [ filters, columnsOptions, columns, id ]);

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

	// Fired in parallel with the main pages query when parameter variations are
	// enabled. Keeps the main pages query untouched and lightweight.
	const parameterCountsQuery = useQuery({
		queryKey: [ 'page-parameter-counts', startDate, endDate ],
		queryFn: () =>
			getPageParameterCounts({
				startDate,
				endDate,
				range
			}),
		enabled: paramVariationsEnabled && !! startDate && !! endDate,
		staleTime: 1000 * 60 * 5
	});

	const parameterCounts = useMemo(
		() => parameterCountsQuery.data || {},
		[ parameterCountsQuery.data ]
	);

	const data = query.data || {};
	const tableData = useMemo( () => data.data || [], [ data.data ]);
	const columnsData = data.columns;

	/**
	 * To enable searching on formatted values, we need to get the formatted value.
	 *
	 * @param value - the original value from the data
	 * @param format - the format of the column, used to determine which formatter to use
	 * @param columnId - the column id, used for some specific formatters that need it (e.g. url)
	 *
	 * @returns {*|string|string} - the formatted value to be used for searching, or the original value as a string if no formatter is found
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

	// Add a useMemo to sort columnsData based on columnsOptions order.
	const sortedColumnsData = useMemo( () => {

		// Check if columnsData and columnsOptions are valid.
		if ( ! columnsData || ! columnsOptions ) {
			return [];
		}

		// Create an array from columnsOptions keys to define the order.
		const order = Object.keys( columnsOptions );

		// Sort columnsData based on the order of columns in columnsOptions.
		return columnsData.sort( ( a, b ) => {
			const orderA = order.indexOf( a.selector );
			const orderB = order.indexOf( b.selector );

			return orderA - orderB;
		});
	}, [ columnsData, columnsOptions ]);


	// Memoize the filtered data to avoid recalculations.
	const filteredData = useMemo( () => {
		let filtered = [];
		if ( configDetails?.searchable && Array.isArray( tableData ) ) {
			if ( '' === filterText.trim() ) {
				filtered = tableData;
			} else {
				const searchTerm = filterText.toLowerCase();

				// Get searchable columns (those with group_by: true).
				const searchableColumns = Object.keys( columnsOptions ).filter(
					( column ) => columnsOptions[column]?.group_by
				);

				filtered = tableData.filter( ( item ) => {

					// Search through all searchable columns.
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
		// Safety check: ensure sortedColumnsData exists and has items.
		if ( ! sortedColumnsData || ! Array.isArray( sortedColumnsData ) || 0 === sortedColumnsData.length ) {
			return filtered;
		}

		filtered = [ ...filtered ].sort( ( a, b ) => {
			let actualSortField = sortField;

			// If sortField is not in sortedColumnsData, use the second column as default.
			if ( ! actualSortField && 1 < sortedColumnsData.length ) {
				actualSortField = sortedColumnsData[1].id;
			}

			const aValue = a[actualSortField];
			const bValue = b[actualSortField];

			// Handle null/undefined values.
			if ( null === aValue || aValue === undefined ) {
				return 1;
			}

			if ( null === bValue || bValue === undefined ) {
				return -1;
			}

			// Check if both values are numeric (including numeric strings).
			const aNum = Number( aValue );
			const bNum = Number( bValue );
			const aIsNumeric = ! isNaN( aNum ) && '' !== aValue && null !== aValue;
			const bIsNumeric = ! isNaN( bNum ) && '' !== bValue && null !== bValue;

			// If both are numeric, do numeric comparison
			if ( aIsNumeric && bIsNumeric ) {
				return 'asc' === sortDirection ? aNum - bNum : bNum - aNum;
			}

			// String comparison for non-numeric values.
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

	// Inject the parameter variation count for each row so we can drive the
	// expandable-row indicator and the badge from a single source. Only runs
	// when the parameter variations toggle is enabled (paid Pro feature).
	const enrichedFilteredData = useMemo( () => {
		if ( ! paramVariationsEnabled ) {
			return filteredData;
		}
		return filteredData.map( ( row ) => ({
			...row,
			parameter_count: parameterCounts[row.page_url] || 0
		}) );
	}, [ filteredData, paramVariationsEnabled, parameterCounts ]);

	// Replace the page_url column's cell renderer to inject a "n variations"
	// badge between the URL text and the hover action icons. Uses ClickToFilter
	// directly so the badge renders inside the component's layout via afterChildren.
	const enhancedColumnsData = useMemo( () => {
		if ( ! paramVariationsEnabled ) {
			return sortedColumnsData;
		}
		return sortedColumnsData.map( ( col ) => {
			if ( 'page_url' !== col.id ) {
				return col;
			}
			return {
				...col,
				cell: ( row ) => {
					const value = row[col.id];
					const count = Number( row?.parameter_count ?? 0 );
					const badge = 0 < count ? (
						<span className="shrink-0 rounded-full border border-blue-100 bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
							{sprintf(

								// translators: %d is the number of parameter variations recorded for this page.
								_n( '%d parameter', '%d parameters', count, 'burst-statistics' ),
								count
							)}
						</span>
					) : null;

					return (
						<ClickToFilter
							filter="page_url"
							filterValue={value}
							row={row}
							afterChildren={badge}
						>
							{safeDecodeURI( value )}
						</ClickToFilter>
					);
				}
			};
		});
	}, [ sortedColumnsData, paramVariationsEnabled ]);

	// Reset to page 1 when the dataset changes.
	useEffect( () => {
		setCurrentPage( 1 );
	}, [ enrichedFilteredData.length, selectedConfig, filterText ]);

	const totalRows = enrichedFilteredData.length;
	const rowsPerPageLimit = 'all' === rowsPerPage ? totalRows : Number( rowsPerPage );
	const totalPages = Math.max( 1, Math.ceil( totalRows / rowsPerPageLimit ) );

	// Paginate the enriched data so the parameter-variations badge and the
	// expandable rows still work correctly inside the current page slice.
	const paginatedData = useMemo( () => {
		const start = ( currentPage - 1 ) * rowsPerPageLimit;
		return enrichedFilteredData.slice( start, start + rowsPerPageLimit );
	}, [ enrichedFilteredData, currentPage, rowsPerPageLimit ]);

	const isLoading = query.isLoading || query.isFetching;
	const error = query.error;
	const noData = 0 === enrichedFilteredData.length;

	// sortedColumns the first column should have overflow true.
	if ( 0 < enhancedColumnsData.length ) {
		enhancedColumnsData[0] = {
			...enhancedColumnsData[0],
			allowOverflow: true,
			wrap: false,
			grow: 2
		};
	}

	// Memoize DataTable props to prevent unnecessary re-renders.
	const dataTableProps = useMemo(

		() => {
			const sortColumnIndex = enhancedColumnsData.findIndex( col =>
				col.id === sortField
			);

			// findIndex returns -1 if not found, default to 2, otherwise use 1-based index
			const sortFieldId = -1 !== sortColumnIndex ? sortColumnIndex + 1 : 2;

			const baseProps = {
				className: 'burst-data-table',
				columns: enhancedColumnsData,
				data: paginatedData,
				sortServer: true,
				defaultSortFieldId: sortFieldId,
				defaultSortAsc: 'asc' === sortDirection,
				onSort: handleSort,
				pagination: false,
				noDataComponent: (
					<EmptyDataTable
						noData={noData}
						data={[]}
						isLoading={isLoading}
						error={error}
						isInOverlay={isInOverlay}
					/>
				),

				progressPending: isLoading,
				progressComponent: (
					<EmptyDataTable
						noData={noData}
						data={[]}
						isLoading={isLoading}
						error={error}
						isInOverlay={isInOverlay}
					/>
				)
			};

			if ( paramVariationsEnabled ) {
				baseProps.expandableRows = true;
				baseProps.expandableRowDisabled = ( row ) =>
					! row || 0 >= Number( row.parameter_count ?? 0 );
				baseProps.expandableRowsComponent = ParameterVariationsRow;
				baseProps.expandableRowsComponentProps = {
					startDate,
					endDate,
					range
				};
			}

			return baseProps;
		},
		[
			enhancedColumnsData,
			paginatedData,
			sortField,
			sortDirection,
			handleSort,
			noData,
			isLoading,
			error,
			paramVariationsEnabled,
			startDate,
			endDate,
			range,
			isInOverlay
		]
	);

	const navigate = useNavigate();
	const location = useRouterState({ select: ( s ) => s.location });

	/**
	 * Open this datatable in the fullscreen overlay.
	 * Passes the current route as the return destination, along with the
	 * current variant, allowed configs, block id, and date/filter context.
	 */
	const handleExpand = useCallback( () => {
		navigate({
			to: '/table/$variant',
			params: { variant: selectedConfig },
			search: {
				from: location.pathname,
				allowed: allowedConfigs.join( ',' ),
				dataTableId: id,
				...location.search
			}
		});
	}, [ navigate, location, selectedConfig, allowedConfigs, id ]);

	// Render function for the extra section inside PopoverFilter. Receives the
	// pending value and setter from PopoverFilter so the toggle state only
	// applies when the user clicks "Apply", consistent with the column checkboxes.
	const renderVariationsToggle =
		isPro && 'pages' === selectedConfig ?
			( pendingValue, setPendingValue ) => (
				<label className="flex cursor-pointer items-start gap-2.5 py-1">
					<Checkbox.Root
						className="focus:ring-blue-500 mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border-2 border-gray-300 bg-white transition-colors hover:border-gray-400 focus:outline-hidden focus:ring-2 focus:ring-offset-2"
						id={`burst-param-variations-${id}`}
						checked={pendingValue}
						aria-label={__(
							'Show parameters',
							'burst-statistics'
						)}
						onCheckedChange={( checked ) =>
							setPendingValue( true === checked )
						}
					>
						<Checkbox.Indicator>
							<Icon
								name="check"
								size={14}
								color="green"
								strokeWidth={2}
							/>
						</Checkbox.Indicator>
					</Checkbox.Root>
					<span className="flex flex-col gap-0.5">
						<span className="text-sm font-medium text-text-black">
							{__( 'Show parameters', 'burst-statistics' )}
						</span>
						<span className="text-xs text-text-gray">
							{__(
								'Expand a page row to see all parameter variations that were recorded for this page.',
								'burst-statistics'
							)}
						</span>
					</span>
				</label>
			) : null;

	// Early return if config details are not available.
	if ( ! configDetails ) {
		return null;
	}

	const siteUrl = window.burst_settings?.site_url;
	const safeDomain = resolveHostname( siteUrl )
		.replace( /\./g, '-' )
		.replace( /[^a-zA-Z0-9-]/g, '' );

	const fileName = `${safeDomain}-${selectedConfig}-${startDate}-${endDate}`;

	return (
		<Block className={ isInOverlay ? 'flex-1 min-h-0 group/root' : 'row-span-2 overflow-hidden @xl:col-span-6 group/root' }>
			<BlockHeading
				className="border-b border-gray-200"
				isReport={isReport}
				reportBlockIndex={index}
				isLoading={isLoading}
				title={
					<DataTableSelect
						value={selectedConfig}
						onChange={setSelectedConfig}
						options={selectOptions}
						disabled={[]}
					/>
				}
				controls={
					allowBlockFilters ? (
						<>
							{ ! isInOverlay && ! isReport && (
								<button
									type="button"
									className="inline-flex items-center justify-center rounded-md p-1.5 text-gray-500 transition-colors hover:bg-gray-200 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
									onClick={ handleExpand }
									aria-label={ __( 'Expand table', 'burst-statistics' ) }
									title={ __( 'Expand table', 'burst-statistics' ) }
								>
									<Icon name="expand" size={ 14 } />
								</button>
							) }

							{configDetails?.searchable && (
								<SearchButton
									value={filterText}
									onChange={setFilterText}
									className="ml-auto"
								/>
							)}

							<DownloadCsvButton
								data={enrichedFilteredData}
								filename={fileName}
							/>

							<PopoverFilter
								selectedOptions={columns}
								options={columnsOptions}
								defaultOptions={defaultColumns}
								onApply={setColumns}
								extraSection={renderVariationsToggle}
								extraSectionValue={paramVariationsToggle}
								onExtraSectionChange={handleParamVariationsToggle}
							/>
						</>
					) : undefined
				}
			/>
			<BlockContent className="px-0 py-0 overflow-y-auto min-h-0">
				<DataTable {...dataTableProps} />
			</BlockContent>
			{ 0 < totalRows && (
				<BlockFooter className={`border-t border-gray-200 gap-4 ${ ! isInOverlay ? 'justify-center' : '' }`}>
					{ isInOverlay && (
						<div className="flex items-center gap-2 text-sm text-gray-600">
							<span>{ __( 'Rows per page:', 'burst-statistics' ) }</span>
							<select
								className="rounded border border-gray-300 bg-white px-2 py-1 pr-6 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
								value={ rowsPerPage }
								onChange={ ( e ) => {
									const val = e.target.value;
									const value = 'all' === val ? 'all' : Number( val );
									setRowsPerPage( value );
									setCurrentPage( 1 );
								} }
							>
								{ ROWS_PER_PAGE_OPTIONS.map( ( option ) => (
									<option key={ option } value={ option }>
										{ option }
									</option>
								) ) }
								<option value="all">
									{ __( 'All', 'burst-statistics' ) }
								</option>
							</select>
						</div>
					) }

					<div className="flex items-center gap-1">
						<span className="mr-2 text-sm text-gray-600">
							{ `${ ( currentPage - 1 ) * rowsPerPageLimit + 1 }-${ Math.min( currentPage * rowsPerPageLimit, totalRows ) } ${ __( 'of', 'burst-statistics' ) } ${ totalRows }` }
						</span>
						<button
							type="button"
							className="inline-flex items-center justify-center rounded p-1 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-gray-500"
							onClick={ () => setCurrentPage( 1 ) }
							disabled={ 1 === currentPage }
							aria-label={ __( 'First page', 'burst-statistics' ) }
						>
							<Icon name="chevrons-left" size={ 22 } />
						</button>
						<button
							type="button"
							className="inline-flex items-center justify-center rounded p-1 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-gray-500"
							onClick={ () => setCurrentPage( ( p ) => Math.max( 1, p - 1 ) ) }
							disabled={ 1 === currentPage }
							aria-label={ __( 'Previous page', 'burst-statistics' ) }
						>
							<Icon name="chevron-left" size={ 22 } />
						</button>
						<button
							type="button"
							className="inline-flex items-center justify-center rounded p-1 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-gray-500"
							onClick={ () => setCurrentPage( ( p ) => Math.min( totalPages, p + 1 ) ) }
							disabled={ currentPage === totalPages }
							aria-label={ __( 'Next page', 'burst-statistics' ) }
						>
							<Icon name="chevron-right" size={ 22 } />
						</button>
						<button
							type="button"
							className="inline-flex items-center justify-center rounded p-1 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-gray-500"
							onClick={ () => setCurrentPage( totalPages ) }
							disabled={ currentPage === totalPages }
							aria-label={ __( 'Last page', 'burst-statistics' ) }
						>
							<Icon name="chevrons-right" size={ 22 } />
						</button>
					</div>
				</BlockFooter>
			) }
		</Block>
	);
};

// Export a memoized version of the component to prevent unnecessary re-renders
export default memo( DataTableBlock ) ;
