import { __, _n } from '@wordpress/i18n'
import { useQuery } from '@tanstack/react-query'
import getLiveTraffic from '@/api/getLiveTraffic'
import { useRef, useState, useEffect, memo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Icon from '@/utils/Icon'
import { User } from 'lucide-react';
import HelpTooltip from '@/components/Common/HelpTooltip'
import { listSlideAnimation } from './OverviewBlock';

/**
 * Parse UTM source from a given URL.
 *
 * @param {string} url - The URL to parse.
 *
 * @return {string} - The UTM source or 'Direct' if not found or invalid URL.
 */
const parseUTMSource = ( url ) => {
	if ( ! url ) {
		return __( 'Direct', 'burst-statistics' );
	}

	try {
		const urlObj = new URL( url );
		return urlObj.hostname.replace( /^www\./, "" );
	} catch ( e ) {
		return __( 'Direct', 'burst-statistics' );
	}
}

/**
 * TimeAgo component that updates in real-time.
 *
 * @param {Object} props - The component props.
 * @param {number} props.timestamp - The timestamp to convert (in seconds).
 *
 * @return {React.ReactElement} TimeAgo component.
 */
const TimeAgo = memo( ( { timestamp } ) => {
	const [ timeText, setTimeText ] = useState( '' );

	useEffect( () => {
		const updateTime = () => {
			const currentTime = Date.now() / 1000; // Convert to seconds
			const timeDifference = currentTime - timestamp;
			const diff = Math.floor( timeDifference );
			
			if ( diff < 60 ) {
				setTimeText( 
					_n( 
						'%s second ago', 
						'%s seconds ago', 
						diff, 
						'burst-statistics' 
					).replace( '%s', diff ) 
				);
			} else {
				const minutes = Math.floor( diff / 60 );
				setTimeText( 
					_n( 
						'%s minute ago', 
						'%s minutes ago', 
						minutes, 
						'burst-statistics' 
					).replace( '%s', minutes ) 
				);
			}
		};

		// Update immediately
		updateTime();

		// Set up interval to update every second
		const interval = setInterval( updateTime, 1000 );

		// Cleanup interval on unmount
		return () => clearInterval( interval );
	}, [ timestamp ] );

	return <span className="text-gray font-light break-all">{ timeText }</span>;
} );

/**
 * Generate a consistent Tailwind color class based on a unique identifier.
 *
 * @param { string } uid - The unique identifier to hash.
 *
 * @return { string } - A Tailwind color class.
 */
const getColorClass = ( uid ) => {
	const colors = [
		"text-red",
		"text-blue",
		"text-orange",
		"text-yellow",
		"text-green",
	];

	const hash = Array.from( String( uid ) ).reduce(
		( acc, char ) => acc + char.charCodeAt( 0 ),
		0
	);
	return colors[ hash % colors.length ];
};

/**
 * Get human-readable color name from Tailwind color class.
 *
 * @param { string } colorClass - The Tailwind color class.
 *
 * @return { string } - Human-readable color name.
 */
const getColorName = ( colorClass ) => {
	const colorMap = {
		"text-red": __( 'Red', 'burst-statistics' ),
		"text-blue": __( 'Blue', 'burst-statistics' ),
		"text-orange": __( 'Orange', 'burst-statistics' ),
		"text-yellow": __( 'Yellow', 'burst-statistics' ),
		"text-green": __( 'Green', 'burst-statistics' ),
	};

	return colorMap[ colorClass ] || __( 'Unknown', 'burst-statistics' );
};

/**
 * Generate tooltip content for UserIcon.
 *
 * @param { string } uid - The unique identifier for the user.
 * @param { string } colorClass - The Tailwind color class.
 * @param { boolean } entry - Whether the user is entering.
 * @param { boolean } exit - Whether the user is exiting.
 * @param { boolean } live - Whether the user is live.
 * @param { boolean } checkout - Whether the user is checking out.
 *
 * @return { React.ReactElement } - Tooltip content JSX.
 */
const getTooltipContent = ( uid, colorClass, entry, exit, live, checkout ) => {
	let iconDescription = '';

	if ( checkout ) {
		iconDescription = __( 'User is checking out', 'burst-statistics' );
	} else if ( entry ) {
		iconDescription = __( 'User just entered the site', 'burst-statistics' );
	} else if ( exit ) {
		iconDescription = __( 'User just left the site', 'burst-statistics' );
	} else {
		iconDescription = __( 'User is actively browsing', 'burst-statistics' );
	}

	return (
		<div className="space-y-2 text-sm">
			<div className="font-medium text-gray-700">
				{ iconDescription }
			</div>

			<div className="space-y-1 text-gray-600">
				<div className="flex items-center gap-2">
					<span className="font-medium text-gray-700">{ __( 'User ID:', 'burst-statistics' ) }</span>
					<code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs font-mono text-gray-800">
						{ uid }
					</code>
				</div>
			</div>
		</div>
	);
};

/**
 * UserIcon component to display user icon with color based on uid.
 *
 * @param {Object} props - The component props.
 * @param {string} props.uid - The unique identifier for the user.
 * @param {boolean} props.entry - Whether the user is entering.
 * @param {boolean} props.exit - Whether the user is exiting.
 * @param {boolean} props.live - Whether the user is live.
 * @param {boolean} props.checkout - Whether the user is checking out.
 *
 * @return { React.ReactElement } UserIcon component
 */
const UserIcon = ( { uid, entry, exit, live, checkout } ) => {
	const colorClass = getColorClass( uid );

	const iconMap = {
		entryIcon: 'log-in',
		exitIcon: 'log-out',
		checkout: 'shopping-cart',
		live: 'line-squiggle'
	};

	let icon;

	if ( checkout ) {
		icon = iconMap.checkout;
	} else if ( entry ) {
		icon = iconMap.entryIcon;
	} else if ( exit ) {
		icon = iconMap.exitIcon;
	} else {
		icon = iconMap.live;
	}

	const tooltipContent = getTooltipContent( uid, colorClass, entry, exit, live, checkout );

	return (
		<HelpTooltip content={ tooltipContent } delayDuration={ 300 }>
			<div className='bg-white rounded-full p-1.5 mr-2 border border-gray-100 shadow-sm cursor-help'>
				<Icon name={ icon } className={ colorClass } color='' size={ 16 } strokeWidth={ 1.5 } />
			</div>
		</HelpTooltip>
	);
};

/**
 * LiveTrafficBlock component to display live traffic
 *
 * @return { React.ReactElement } LiveTrafficBlock component
 */
const LiveTraffic = () => {
	const intervalRef = useRef( 5000 );
	const currentUnixTime = useRef( Date.now() );
	/**
	 * Set the refetch interval and reset the timer.
	 *
	 * @param {number} value - The new interval value in milliseconds.
	 *
	 * @return {void}
	 */
	const setInterval = ( value ) => {
		intervalRef.current = value;
		currentUnixTime.current = Date.now();
	};

	const liveTrafficQuery = useQuery(
		{
			queryKey: [ 'live-traffic' ],
			queryFn: getLiveTraffic,
			refetchInterval: intervalRef.current,
			placeholderData: '-',
			onError: () => setInterval( 0 ),
			gcTime: 10000
		}
	);

	const liveTraffic = Array.isArray( liveTrafficQuery.data ) ? liveTrafficQuery.data : [];

	// Return early if loading.
	if ( liveTrafficQuery.isLoading ) {
		return (
			<div className="w-full">
				<div>{ __( 'Loading...', 'burst-statistics' ) }</div>
			</div>
		);
	}

	// Return early if no live traffic.
	if ( liveTraffic.length === 0 ) {
		return (
			<AnimatePresence mode="popLayout">
				<motion.div
					key="no-activity"
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					exit={{ opacity: 0 }}
					transition={{
						duration: 0.6,
						delay: 0.1,
						ease: [0.25, 0.1, 0.25, 1],
					}}
					className='flex items-center justify-center flex-col h-full'
				>
					<div>
						<div className='bg-white rounded-full p-1 border border-gray-100 w-fit mb-3'>
							<User height='16' width='16' color='currentColor' className='text-green' />
						</div>

						<p className='font-semibold text-gray mb-2'>{ __( 'No live visitors right now', 'burst-statistics' ) }</p>

						<p className='text-gray'>{ __( 'When someone visits your site, you’ll see them here instantly. ', 'burst-statistics' ) }</p>
					</div>
				</motion.div>
			</AnimatePresence>
		);
	}

	return (
		<div className="w-full">
			<motion.ul className="flex flex-col gap-3 tracking-wide" layout>
				<AnimatePresence mode="popLayout">
					{
						liveTraffic.map( ( traffic, index ) => {
							const uid = traffic.uid;
							let utm_source = '';
							if ( traffic.entry ) {
								utm_source = parseUTMSource( traffic?.utm_source );
							}

							// Create a unique key based on uid and timestamp for better animation tracking
							const uniqueKey = `${ uid }-${ traffic.time }`;
							return (
								<motion.li
									key={ uniqueKey }
									className="flex items-center justify-between m-0"
									variants={ listSlideAnimation( index ) }
									initial="initial"
									animate="animate"
									exit="exit"
									layout
								>
									<div className="flex items-center gap-1 flex-1 min-w-0">
										<UserIcon uid={ uid } entry={ traffic.entry } exit={ traffic.exit } live={ traffic.live } checkout={ traffic.checkout } />

										<span className="font-medium text-black break-all">
											{ traffic.page_url }
										</span>

										{
											utm_source && (
												<>
													<span className="text-gray font-light break-all">-</span>

													<span className="text-gray font-light break-all">
														{ utm_source }
													</span>
												</>
											)
										}

										<span className="text-gray font-light break-all">-</span>

										<TimeAgo timestamp={ traffic.active_time } />
									</div>
								</motion.li>
							);
						} )
					}
				</AnimatePresence>
			</motion.ul>
		</div>
	);
};

export default LiveTraffic;
