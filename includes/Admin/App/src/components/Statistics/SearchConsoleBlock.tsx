import { __ } from '@wordpress/i18n';
import useGSCData from '@/hooks/useGSCData';
import useSettingsData from '@/hooks/useSettingsData';
import DataTableBlock from '@/components/Statistics/DataTableBlock';
import { Block } from '@/components/Blocks/Block';
import { BlockHeading } from '@/components/Blocks/BlockHeading';
import { BlockContent } from '@/components/Blocks/BlockContent';
import OverlayBlock from '@/components/Upsell/OverlayBlock';
import ActivationCopy from '@/components/Upsell/ActivationCopy';

/**
 * Top Google Search Console queries for the auto-matched property.
 *
 * The block is always visible so the feature stays discoverable. When the
 * integration is not connected it shows an activation overlay pointing to the
 * Search Console settings tab (where the toggle and connect flow live). Once
 * connected it shows the queries table for the property matching home_url(), a
 * notice when no property matches this site's URL, or a brief checking state
 * while the match resolves.
 *
 * @return {JSX.Element} The rendered block.
 */
const SearchConsoleBlock = (): JSX.Element => {
	const { status, propertyStatus } = useGSCData();
	const { getValue } = useSettingsData();
	const enabled = !! getValue( 'enable_search_console' );

	// Connected and a matching property was found → show the queries table.
	if ( 'connected' === status && 'matched' === propertyStatus ) {
		return (
			<DataTableBlock allowedConfigs={[ 'search_console' ]} id="search_console" />
		);
	}

	// Connected, but the property match is still resolving or nothing matched.
	if ( 'connected' === status ) {
		const message = 'none' === propertyStatus ?
			__( 'No sites have been found that match the current URL (with or without www). Make sure this site is added as a property in Google Search Console under the same Google account.', 'burst-statistics' ) :
			__( 'Checking your Google Search Console properties…', 'burst-statistics' );

		return (
			<Block className='row-span-2 overflow-hidden @xl:col-span-6'>
				<BlockHeading title={ __( 'Google Searches', 'burst-statistics' ) } />

				<BlockContent className='flex-col items-center justify-center flex'>
					<p className="py-6 text-center text-sm text-text-gray-light">{ message }</p>
				</BlockContent>
			</Block>
		);
	}

	// Not connected: the toggle is off, or it is on but not yet connected /
	// needs reconnecting. Show an activation overlay that routes to settings.
	return (
		<OverlayBlock
			title={ __( 'Google Searches', 'burst-statistics' ) }
			blurLabel={ __( 'Google Search queries', 'burst-statistics' ) }
			className='row-span-2 overflow-hidden @xl:col-span-6'
		>
			<ActivationCopy type="search_console" enabled={ enabled } />
		</OverlayBlock>
	);
};

export default SearchConsoleBlock;
