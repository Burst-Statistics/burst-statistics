import {useState, useCallback, useEffect, useMemo, createInterpolateElement} from '@wordpress/element';
import {__, _n, sprintf} from '@wordpress/i18n';
import { AnimatePresence, motion } from 'framer-motion';
import { useLocation } from '@tanstack/react-router';
import { doAction } from '@/utils/api';
import { toast } from 'react-toastify';
import useLicenseData from '@/hooks/useLicenseData';
import useDateRange from '@/hooks/useDateRange';
import { useFilters } from '@/hooks/useFilters';
import { AddFilterButton } from '../Filters/Display';
import Modal from './Modal';
import SelectInput from '@/components/Inputs/SelectInput';
import ButtonInput from '@/components/Inputs/ButtonInput';
import Icon from '@/utils/Icon';
import Tooltip from './Tooltip';
import { FILTER_CONFIG } from '@/config/filterConfig';
import { formatDateShort } from '@/utils/formatting';
import useShareableLinkStore from '@/store/useShareableLinkStore';

/**
 * Expiration options for the share link.
 */
const EXPIRATION_OPTIONS = [
	{ value: '24h', label: __( '24 hours', 'burst-statistics' ) },
	{ value: '7d', label: __( '7 days', 'burst-statistics' ) },
	{ value: '30d', label: __( '30 days', 'burst-statistics' ) },
	{ value: 'never', label: __( 'Never', 'burst-statistics' ) }
];

/**
 * Default permissions for share links.
 */
const DEFAULT_PERMISSIONS = {
	can_change_date: false,
	can_filter: false
};

/**
 * Permission labels for display.
 */
const PERMISSION_LABELS = {
	can_change_date: __( 'Change date range', 'burst-statistics' ),
	can_filter: __( 'Change filters', 'burst-statistics' )
};

/**
 * Get shareable tabs from menu configuration.
 *
 * @return {Array} Array of shareable tabs with id and title.
 */
const getShareableTabs = () => {
	const menu = Array.isArray( burst_settings.menu ) ?
		burst_settings.menu :
		Object.values( burst_settings.menu || {});

	return menu
		.filter( ( item ) => item.shareable )
		.map( ( item ) => ({
			id: item.id,
			title: item.title
		}) );
};

/**
 * Get current tab ID from pathname.
 *
 * @param {string} pathname - The current pathname.
 * @return {string} The current tab ID.
 */
const getCurrentTabId = ( pathname ) => {

	// Remove leading slash and get first segment.
	const segments = pathname.replace( /^\//, '' ).split( '/' );
	return segments[0] || 'dashboard';
};

/**
 * Get tab title by ID.
 *
 * @param {string} tabId - The tab ID.
 * @return {string} The tab title.
 */
const getTabTitle = ( tabId ) => {
	const menu = Array.isArray( burst_settings.menu ) ?
		burst_settings.menu :
		Object.values( burst_settings.menu || {});

	const item = menu.find( ( m ) => m.id === tabId );
	return item?.title || tabId;
};

/**
 * Copy text to clipboard with fallback for older browsers.
 *
 * @param {string} text - The text to copy.
 * @return {Promise<void>}
 */
const copyToClipboard = async( text ) => {
	try {
		if ( navigator.clipboard && navigator.clipboard.writeText ) {
			await navigator.clipboard.writeText( text );
			return;
		}
	} catch ( err ) {
		console.warn( 'Clipboard API failed, trying fallback', err );
	}

	// Fallback for older browsers or non-HTTPS.
	const textArea = document.createElement( 'textarea' );
	textArea.value = text;
	textArea.style.position = 'fixed';
	textArea.style.left = '-999999px';
	document.body.appendChild( textArea );
	textArea.select();
	textArea.focus();
	document.execCommand( 'copy' );
	document.body.removeChild( textArea );

};

/**
 * Format expiration date for display.
 *
 * @param {number} expires - Unix timestamp of expiration (0 = never).
 * @return {string} Formatted expiration string.
 */
const formatExpiration = ( expires ) => {
	if ( 0 === expires ) {
		return __( 'Never expires', 'burst-statistics' );
	}

	const now = Date.now() / 1000;
	const diff = expires - now;

	if ( 0 > diff ) {
		return __( 'Expired', 'burst-statistics' );
	}

	const days = Math.floor( diff / 86400 );
	const hours = Math.floor( ( diff % 86400 ) / 3600 );

	if ( 0 < days ) {
		return 1 === days ?
			__( 'Expires in 1 day', 'burst-statistics' ) :

			// translators: %d is the number of days.
			__( `Expires in ${days} days`, 'burst-statistics' );
	}

	if ( 0 < hours ) {
		return 1 === hours ?
			__( 'Expires in 1 hour', 'burst-statistics' ) :

			// translators: %d is the number of hours.
			__( `Expires in ${hours} hours`, 'burst-statistics' );
	}

	return __( 'Expires soon', 'burst-statistics' );
};

/**
 * Get enabled permission labels for display.
 *
 * @param {Object} perms - The permissions object.
 * @return {Array} Array of enabled permission labels.
 */
const getEnabledPermissions = ( perms ) => {
	if ( ! perms ) {
		return [];
	}
	return Object.entries( perms )
		.filter( ([ , enabled ]) => enabled )
		.map( ([ key ]) => PERMISSION_LABELS[key])
		.filter( Boolean );
};

/**
 * Link configuration summary component.
 * Shows what will be shared in a clear, read-only format.
 *
 * @param {Object} props           - Component props.
 * @param {string} props.currentTab - Current tab ID.
 * @param {string} props.startDate - Start date.
 * @param {string} props.endDate   - End date.
 * @param {Object} props.filters   - Active filters object.
 * @return {JSX.Element}
 */
const LinkConfigurationSummary = ({ currentTab, startDate, endDate, filters }) => {
	const activeFilters = useMemo( () => {
		return Object.entries( filters || {})
			.filter( ([ , value ]) => value && '' !== value )
			.map( ([ key, value ]) => ({
				key,
				label: FILTER_CONFIG[key]?.label || key,
				value
			}) );
	}, [ filters ]);

	const hasDateRange = startDate && endDate;
	const hasFilters = 0 < activeFilters.length;

	return (
		<div className="space-y-2">
			<h4 className="text-md font-medium text-black">
				{__( 'What you\'re sharing:', 'burst-statistics' )}
			</h4>

			<dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
				{/* Initial tab - always shown. */}
				<dt className="font-base text-gray">
					{__( 'Initial tab:', 'burst-statistics' )}
				</dt>
				<dd className="font-medium text-black">
					{getTabTitle( currentTab )}
				</dd>

				{/* Date range. */}
				{hasDateRange && (
					<>
						<dt className="font-base text-gray">
							{__( 'Date range:', 'burst-statistics' )}
						</dt>
						<dd className="font-medium text-black">
							{formatDateShort( startDate )} – {formatDateShort( endDate )}
						</dd>
					</>
				)}

				{/* Filters - combined with 'and'. */}
				{hasFilters && (
					<>
						<dt className="font-base text-gray">
							{sprintf(
								_n( 'Filter:', 'Filters:', activeFilters.length, 'burst-statistics' )
							)}
						</dt>
						<dd className="font-medium text-black">
							{activeFilters.map( ( filter, index ) => {
								if ( 0 === index ) {

									// first filter: "Page is Homepage"
									return (
										<span key={filter.key}>
                        {createInterpolateElement(
							sprintf(

								/* translators: 1: filter label, 2: filter value */
								__( '%1$s is %2$s', 'burst-statistics' ),
								'<strong>' + filter.label + '</strong>',
								'<em>' + filter.value + '</em>'
							),
							{
								strong: <span className="font-medium text-black" />,
								em: <span className="font-light text-gray" />
							}
						)}
                    </span>
									);
								}

								// next filters: "and Page is Contact"
								return (
									<span key={filter.key}>
                    {createInterpolateElement(
						sprintf(

							/* translators: 1: filter label, 2: filter value */
							__( ' and %1$s is %2$s', 'burst-statistics' ),
							'<strong>' + filter.label + '</strong>',
							'<em>' + filter.value + '</em>'
						),
						{
							strong: <span className="font-medium text-black" />,
							em: <span className="font-light text-gray" />
						}
					)}
                </span>
								);
							})}
						</dd>
					</>
				)}
			</dl>
		</div>
	);
};

/**
 * Advanced options collapsible component.
 *
 * @param {Object}   props                    - Component props.
 * @param {boolean}  props.isOpen             - Whether the section is open.
 * @param {Function} props.onToggle           - Toggle handler.
 * @param {Object}   props.permissions        - Current permissions state.
 * @param {Function} props.onPermissionToggle - Permission toggle handler.
 * @param {Array}    props.sharedTabs         - Currently selected tabs.
 * @param {Function} props.onTabToggle        - Tab toggle handler.
 * @param {Array}    props.shareableTabs      - Available shareable tabs.
 * @param {string}   props.currentTab         - Current tab ID.
 * @return {JSX.Element}
 */
const AdvancedOptions = ({
	isOpen,
	onToggle,
	permissions,
	onPermissionToggle,
	sharedTabs,
	onTabToggle,
	shareableTabs,
	currentTab
}) => {
	return (
		<div className="border-t border-gray-200 -mx-4 px-4 pt-3">
			{/* Header / Toggle. */}
			<button
				type="button"
				onClick={onToggle}
				className="flex w-full items-center gap-2 text-left text-sm font-medium text-gray-600 hover:text-gray-800 transition-colors"
			>
				<Icon
					name="chevron-right"
					size={14}
					className={`text-gray-700 transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`}
				/>
				<span>{__( 'Advanced options', 'burst-statistics' )}</span>
			</button>

			{/* Content. */}
			<AnimatePresence>
				{isOpen && (
					<motion.div
						initial={{ height: 0, opacity: 0 }}
						animate={{ height: 'auto', opacity: 1 }}
						exit={{ height: 0, opacity: 0 }}
						transition={{ duration: 0.2 }}
						className="overflow-hidden"
					>
						<div className="space-y-4 pt-4">
							{/* Permissions. */}
							<div className="space-y-2">
								<span className="text-sm text-gray-600">
									{__( 'Allow viewer to:', 'burst-statistics' )}
								</span>
								<div className="flex flex-wrap gap-x-6 gap-y-2">
									{Object.entries( PERMISSION_LABELS ).map( ([ key, label ]) => (
										<label
											key={key}
											className="flex items-center gap-2 cursor-pointer text-sm"
										>
											<input
												type="checkbox"
												checked={permissions[key] || false}
												onChange={() => onPermissionToggle( key )}
												className="rounded border-gray-400 text-wp-blue focus:ring-wp-blue cursor-pointer"
											/>
											<span className="text-gray">{label}</span>
										</label>
									) )}
								</div>
							</div>

							{/* Shareable tabs. */}
							{1 < shareableTabs.length && (
								<div className="space-y-2">
									<span className="text-sm text-gray-600">
										{__( 'Allow access to these tabs:', 'burst-statistics' )}
									</span>
									<div className="flex flex-wrap gap-x-6 gap-y-2">
										{shareableTabs.map( ( tab ) => {
											const isCurrentTab = tab.id === currentTab;
											const isChecked = sharedTabs.includes( tab.id );

											return (
												<label
													key={tab.id}
													className={`flex items-center gap-2 text-sm ${isCurrentTab ? 'cursor-default' : 'cursor-pointer'
														}`}
												>
													<input
														type="checkbox"
														checked={isChecked}
														onChange={() => onTabToggle( tab.id )}
														disabled={isCurrentTab}
														className="rounded border-gray-400 text-wp-blue focus:ring-wp-blue cursor-pointer disabled:cursor-default disabled:opacity-60"
													/>
													<span className={isCurrentTab ? 'text-gray-500' : 'text-gray'}>
														{tab.title}
														{isCurrentTab && (
															<span className="ml-1 text-xs text-gray-400">
																({__( 'current view', 'burst-statistics' )})
															</span>
														)}
													</span>
												</label>
											);
										})}
									</div>
								</div>
							)}
						</div>
					</motion.div>
				)}
			</AnimatePresence>
		</div>
	);
};

/**
 * Single share link item component (compact version for collapsed list).
 *
 * @param {Object}   props            - Component props.
 * @param {Object}   props.link       - The share link data.
 * @param {string}   props.copiedId   - ID of currently copied link.
 * @param {Function} props.onCopy     - Copy handler.
 * @param {Function} props.onRevoke   - Revoke handler.
 * @param {boolean}  props.isRevoking - Whether revoke is in progress.
 * @return {JSX.Element}
 */
const ShareLinkItem = ({ link, copiedId, onCopy, onRevoke, isRevoking }) => {
	const isCopied = copiedId === link.token;

	// Get shared tabs display.
	const sharedTabsDisplay = useMemo( () => {
		if ( ! link.shared_tabs || 0 === link.shared_tabs.length ) {
			return [];
		}
		return link.shared_tabs.map( ( tabId ) => getTabTitle( tabId ) );
	}, [ link.shared_tabs ]);

	// Get initial state display.
	const dateRangeDisplay = useMemo( () => {
		const initialState = link?.initial_state;
		if ( ! initialState?.date_range?.start || ! initialState?.date_range?.end ) {
			return null;
		}
		return `${formatDateShort( initialState.date_range.start )} – ${formatDateShort( initialState.date_range.end )}`;
	}, [ link ]);

	// Get filters display.
	const filtersDisplay = useMemo( () => {
		const initialState = link?.initial_state;
		if ( ! initialState?.filters ) {
			return [];
		}
		return Object.entries( initialState.filters )
			.filter( ([ , value ]) => value && '' !== value )
			.map( ([ key, value ]) => ({
				key,
				label: FILTER_CONFIG[key]?.label || key,
				value
			}) );
	}, [ link ]);

	// Get enabled permissions.
	const enabledPermissions = useMemo(
		() => getEnabledPermissions( link.permissions ),
		[ link.permissions ]
	);

	return (
		<motion.div
			initial={{ opacity: 0, y: -10 }}
			animate={{ opacity: 1, y: 0 }}
			exit={{ opacity: 0, y: -10 }}
			className={`rounded-md border p-3 ${isCopied ? 'border-green bg-green-50' : 'border-gray-200 bg-white'} transition-colors duration-200`}
		>
			{/* Tags row. */}
			<div className="flex gap-2 mb-2 flex-col">
				<div className="flex flex-row gap-1.5">
					{/* use Intl.ListFormat to format the shared tabs */}
					<span className="text-base font-medium text-gray-700">
						{new Intl.ListFormat( undefined, { style: 'long' }).format( sharedTabsDisplay )}
					</span>
							{/* Date range. */}
							{dateRangeDisplay && (
						<span className="inline-flex items-center gap-1 text-xs font-light text-gray-800">
							<Icon name="calendar" size={10} />
							{dateRangeDisplay}
						</span>
					)}

					<span className="ml-auto text-xs text-gray-600">
						{formatExpiration( link.expires )}
					</span>
				</div>

				<div className="flex gap-1.5">
					{/* URL display. */}
					<input
						type="text"
						readOnly
						title={link.url}
						value={link.url}
						onClick={( e ) => e.target.select()}
						className="max-w-full truncate text-sm text-gray-800 font-mono w-full bg-gray-50 px-2 py-1.5 rounded border border-gray-300 cursor-text focus:border-wp-blue focus:ring-1 focus:ring-wp-blue/20"
					/>

					<Tooltip content={isCopied ? __( 'Copied!', 'burst-statistics' ) : __( 'Copy link', 'burst-statistics' )}>
						<button
							onClick={() => onCopy( link )}
							className="rounded p-1 text-gray-400 transition-colors hover:bg-gray-200 hover:text-gray-600"
						>
							{isCopied ? (
								<Icon name="check" size={14} color="green" />
							) : (
								<Icon name="copy" size={14} />
							)}
						</button>
					</Tooltip>

					<Tooltip content={__( 'Revoke', 'burst-statistics' )}>
						<button
							onClick={() => onRevoke( link.token )}
							disabled={isRevoking}
							className="rounded p-1 text-gray-400 transition-colors hover:bg-red-50 hover:text-red disabled:opacity-50"
						>
							<Icon name="times" size={14} />
						</button>
					</Tooltip>
				</div>


				{0 < filtersDisplay.length || 0 < enabledPermissions.length && (
					<div className="flex flex-wrap items-center gap-1.5">

					{/* Filters. */}
					{filtersDisplay.map( ( filter ) => (
						<Tooltip
							key={filter.key}
							content={`${filter.label}: ${filter.value}`}
						>
							<span className="inline-flex items-center gap-1 rounded bg-gray-100 border border-gray-300 px-1.5 py-0.5 text-xs font-light text-gray-800">
								<Icon name="filter" size={10} />
								{filter.label}
							</span>
						</Tooltip>
					) )}

					{/* Permissions. */}
					{enabledPermissions.map( ( label ) => (
						<span
							key={label}
							className="inline-flex items-center gap-1 rounded bg-gray-100 border border-gray-300 px-1.5 py-0.5 text-xs font-light text-gray-800"
						>
							<Icon name="check" size={10} />
							{label}
						</span>
					) )}
				</div>
				)}
			</div>
		</motion.div>
	);
};

/**
 * Active links collapsible section.
 *
 * @param {Object}   props           - Component props.
 * @param {boolean}  props.isOpen    - Whether the section is open.
 * @param {Function} props.onToggle  - Toggle handler.
 * @param {Array}    props.links     - Array of share links.
 * @param {boolean}  props.isLoading - Whether links are loading.
 * @param {string}   props.copiedId  - ID of currently copied link.
 * @param {Function} props.onCopy    - Copy handler.
 * @param {Function} props.onRevoke  - Revoke handler.
 * @param {boolean}  props.isRevoking - Whether revoke is in progress.
 * @return {JSX.Element|null}
 */
const ActiveLinksSection = ({
	isOpen,
	onToggle,
	links,
	isLoading,
	copiedId,
	onCopy,
	onRevoke,
	isRevoking
}) => {
	const linkCount = links.length;

	// Don't render if no links and not loading.
	if ( ! isLoading && 0 === linkCount ) {
		return null;
	}

	return (
		<div className="border-t border-gray-200 pt-4 mt-4">
			{/* Header / Toggle. */}
			<button
				type="button"
				onClick={onToggle}
				className="flex w-full items-center gap-2 text-left text-sm font-medium text-gray-600 hover:text-gray-800 transition-colors"
			>
				<Icon
					name="chevron-right"
					size={14}
					className={`text-gray-600 transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`}
				/>
				<span>
					{__( 'Active shared links', 'burst-statistics' )}
					{! isLoading && 0 < linkCount && (
						<span className="ml-1.5 text-gray-500">({linkCount})</span>
					)}
				</span>
			</button>

			{/* Content. */}
			<AnimatePresence>
				{isOpen && (
					<motion.div
						initial={{ height: 0, opacity: 0 }}
						animate={{ height: 'auto', opacity: 1 }}
						exit={{ height: 0, opacity: 0 }}
						transition={{ duration: 0.2 }}
						className="overflow-hidden"
					>
						<div className="pt-3 space-y-2">
							{isLoading ? (
								<p className="text-sm text-gray-500 py-2">
									{__( 'Loading…', 'burst-statistics' )}
								</p>
							) : (
								<AnimatePresence>
									{links.map( ( link ) => (
										<ShareLinkItem
											key={link.token}
											link={link}
											copiedId={copiedId}
											onCopy={onCopy}
											onRevoke={onRevoke}
											isRevoking={isRevoking}
										/>
									) )}
								</AnimatePresence>
							)}
						</div>
					</motion.div>
				)}
			</AnimatePresence>
		</div>
	);
};

/**
 * ShareButton component handles generating and copying shareable links.
 * Opens a modal with link management and generation.
 *
 * @return {JSX.Element|null} ShareButton component or null if viewer or license invalid.
 */
export const ShareButton = () => {
	const { isLicenseValidFor } = useLicenseData();
	const location = useLocation();
	const { startDate, endDate } = useDateRange();
	const { filters } = useFilters();

	// Get current tab from location.
	const currentTab = useMemo(
		() => getCurrentTabId( location.pathname ),
		[ location.pathname ]
	);

	// Get shareable tabs from menu config.
	const shareableTabs = useMemo( () => getShareableTabs(), []);

	// Modal state.
	const [ isModalOpen, setIsModalOpen ] = useState( false );
	const [ expiration, setExpiration ] = useState( '7d' );
	const [ permissions, setPermissions ] = useState( DEFAULT_PERMISSIONS );
	const [ advancedOpen, setAdvancedOpen ] = useState( false );
	const [ activeLinksOpen, setActiveLinksOpen ] = useState( false );

	// Shared tabs state - defaults to current tab.
	const [ sharedTabs, setSharedTabs ] = useState([]);

	// Initialize shared tabs when modal opens.
	useEffect( () => {
		if ( isModalOpen ) {

			// Default to current tab if it's shareable, otherwise first shareable tab.
			const shareableIds = shareableTabs.map( ( t ) => t.id );
			if ( shareableIds.includes( currentTab ) ) {
				setSharedTabs([ currentTab ]);
			} else if ( 0 < shareableIds.length ) {
				setSharedTabs([ shareableIds[0] ]);
			}
		}
	}, [ isModalOpen, currentTab, shareableTabs ]);

	// Share links state.
	const [ shareLinks, setShareLinks ] = useState([]);
	const [ isLoading, setIsLoading ] = useState( false );
	const [ isGenerating, setIsGenerating ] = useState( false );
	const [ isRevoking, setIsRevoking ] = useState( false );
	const [ copiedId, setCopiedId ] = useState( null );
	const isShareableLinkViewer = useShareableLinkStore( ( state ) => state.isShareableLinkViewer );

	/**
	 * Toggle a permission value.
	 *
	 * @param {string} key - The permission key to toggle.
	 */
	const togglePermission = useCallback( ( key ) => {
		setPermissions( ( prev ) => ({
			...prev,
			[key]: ! prev[key]
		}) );
	}, []);

	/**
	 * Toggle a tab in shared tabs.
	 *
	 * @param {string} tabId - The tab ID to toggle.
	 */
	const toggleTab = useCallback( ( tabId ) => {

		// Don't allow removing current tab.
		if ( tabId === currentTab ) {
			return;
		}

		setSharedTabs( ( prev ) => {
			if ( prev.includes( tabId ) ) {
				return prev.filter( ( id ) => id !== tabId );
			}
			return [ ...prev, tabId ];
		});
	}, [ currentTab ]);

	/**
	 * Fetch existing share links.
	 */
	const fetchShareLinks = useCallback( async() => {
		setIsLoading( true );
		try {
			const response = await doAction( 'get_share_links' );
			setShareLinks( response.share_links || []);
		} catch ( error ) {
			console.error( 'Failed to fetch share links:', error );
		} finally {
			setIsLoading( false );
		}
	}, []);

	/**
	 * Fetch links when modal opens.
	 */
	useEffect( () => {
		if ( isModalOpen ) {
			fetchShareLinks();
		}
	}, [ isModalOpen, fetchShareLinks ]);

	/**
	 * Handle modal close.
	 */
	const handleClose = useCallback( () => {
		setIsModalOpen( false );
		setCopiedId( null );
		setAdvancedOpen( false );
		setActiveLinksOpen( false );
		setPermissions( DEFAULT_PERMISSIONS );
	}, []);


	/**
	 * Handle generating a new share link.
	 */
	const handleGenerate = useCallback( async() => {
		setIsGenerating( true );

		try {

			// Capture the full current URL including hash fragment.
			// This preserves the route and all query parameters in the hash.
			// Example: http://localhost:8888/wp-admin/admin.php?page=burst#/statistics?range=custom&startDate=2025-11-10
			const fullUrl = window.location.href;

			// Convert admin URL to burst-dashboard format while preserving hash.
			// Replace wp-admin/admin.php?page=burst with burst-dashboard.
			// The hash fragment (#...) is automatically preserved.
			const viewUrl = fullUrl.replace( /wp-admin\/admin\.php\?page=burst/, 'burst-dashboard' );

			// Build initial state from current values.
			const initialState = {
				date_range: {
					start: startDate || '',
					end: endDate || ''
				},
				filters: {}
			};

			// Add active filters to initial state.
			if ( filters ) {
				Object.entries( filters ).forEach( ([ key, value ]) => {
					if ( value && '' !== value ) {
						initialState.filters[key] = value;
					}
				});
			}

			// Request token with new structure.
			const response = await doAction( 'get_share_token', {
				expiration,
				view_url: viewUrl,
				permissions,
				shared_tabs: sharedTabs,
				initial_state: initialState
			});

			if ( ! response.share_token || ! response.share_url ) {
				toast.error(
					__( 'Failed to generate share link', 'burst-statistics' )
				);
				return;
			}

			// Use the share URL from the API response.
			const shareUrl = response.share_url;

			// Copy to clipboard.
			await copyToClipboard( shareUrl );

			// Refresh the links list and expand it.
			await fetchShareLinks();
			setActiveLinksOpen( true );

			// Set the newly created link as copied.
			setCopiedId( response.share_token );
			toast.success( __( 'Link created and copied to clipboard!', 'burst-statistics' ) );

			// Reset copied state after 3 seconds.
			setTimeout( () => setCopiedId( null ), 3000 );
		} catch ( error ) {
			console.error( 'Failed to generate share link:', error );
			toast.error( __( 'Failed to generate share link', 'burst-statistics' ) );
		} finally {
			setIsGenerating( false );
		}
	}, [ expiration, permissions, sharedTabs, startDate, endDate, filters, fetchShareLinks ]);

	/**
	 * Handle copying an existing link.
	 *
	 * @param {Object} link - The link to copy.
	 */
	const handleCopyLink = useCallback( async( link ) => {
		try {
			await copyToClipboard( link.url );
			setCopiedId( link.token );
			toast.success( __( 'Link copied!', 'burst-statistics' ) );

			// Reset copied state after 2 seconds.
			setTimeout( () => setCopiedId( null ), 2000 );
		} catch ( error ) {
			console.error( 'Failed to copy link:', error );
			toast.error( __( 'Failed to copy link', 'burst-statistics' ) );
		}
	}, []);

	/**
	 * Handle revoking a share link.
	 *
	 * @param {string} token - The token to revoke.
	 */
	const handleRevoke = useCallback( async( token ) => {
		setIsRevoking( true );

		try {
			const response = await doAction( 'revoke_share_link', { token });

			if ( response.success ) {
				setShareLinks( response.share_links || []);
				toast.success( __( 'Link revoked', 'burst-statistics' ) );
			}
		} catch ( error ) {
			console.error( 'Failed to revoke link:', error );
			toast.error( __( 'Failed to revoke link', 'burst-statistics' ) );
		} finally {
			setIsRevoking( false );
		}
	}, []);

	// Don't render for viewers.
	if ( isShareableLinkViewer ) {
		return null;
	}

	// Don't render if license doesn't support sharing.
	if ( ! isLicenseValidFor( 'share-link' ) ) {
		return null;
	}

	return (
		<>
			<AddFilterButton
				label=""
				icon="referrer"
				onClick={() => setIsModalOpen( true )}
			/>

			<Modal
				isOpen={isModalOpen}
				onClose={handleClose}
				title={__( 'Share dashboard', 'burst-statistics' )}
				content={
					<div className="space-y-4">
						{/* Description. */}
						<p className="text-gray text-sm">
							{__( 'Generate a private, shareable link to a live view of this dashboard.', 'burst-statistics' )}
						</p>

						{/* Create new link section. */}
						<div className="rounded-lg border border-gray-200 bg-white p-4 space-y-4">
							{/* Link configuration summary. */}
							<LinkConfigurationSummary
								currentTab={currentTab}
								startDate={startDate}
								endDate={endDate}
								filters={filters}
							/>

							{/* Expiration. */}
							<div className="flex items-center gap-3">
								<span className="text-base font-medium text-gray-800">
									{__( 'Link expires in:', 'burst-statistics' )}
								</span>
								<SelectInput
									value={expiration}
									onChange={setExpiration}
									options={EXPIRATION_OPTIONS}
								/>
							</div>

							{/* Advanced Options. */}
							<AdvancedOptions
								isOpen={advancedOpen}
								onToggle={() => setAdvancedOpen( ( prev ) => ! prev )}
								permissions={permissions}
								onPermissionToggle={togglePermission}
								sharedTabs={sharedTabs}
								onTabToggle={toggleTab}
								shareableTabs={shareableTabs}
								currentTab={currentTab}
							/>

							{/* Generate Button. */}
							<ButtonInput
								onClick={handleGenerate}
								disabled={isGenerating}
								btnVariant="primary"
								className="w-full justify-center"
							>
								{isGenerating ?
									__( 'Generating…', 'burst-statistics' ) :
									__( 'Generate shareable link', 'burst-statistics' )}
							</ButtonInput>
						</div>

						{/* Active shared links section (collapsed by default). */}
						<ActiveLinksSection
							isOpen={activeLinksOpen}
							onToggle={() => setActiveLinksOpen( ( prev ) => ! prev )}
							links={shareLinks}
							isLoading={isLoading}
							copiedId={copiedId}
							onCopy={handleCopyLink}
							onRevoke={handleRevoke}
							isRevoking={isRevoking}
						/>
					</div>
				}
			/>
		</>
	);
};
