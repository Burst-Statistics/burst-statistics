import { __ } from '@wordpress/i18n';
import useGSCData, { type GSCPropertyStatus } from '@/hooks/useGSCData';
import useSettingsData from '@/hooks/useSettingsData';
import DataTableBlock from '@/components/Statistics/DataTableBlock';
import { Block } from '@/components/Blocks/Block';
import { BlockHeading } from '@/components/Blocks/BlockHeading';
import { BlockContent } from '@/components/Blocks/BlockContent';
import OverlayBlock from '@/components/Upsell/OverlayBlock';
import ActivationCopy from '@/components/Upsell/ActivationCopy';

interface ConnectedSearchConsoleBlockProps {
	propertyStatus: GSCPropertyStatus | null;
}

const ConnectedSearchConsoleBlock = ({ propertyStatus }: ConnectedSearchConsoleBlockProps ): JSX.Element => {
	if ( 'matched' === propertyStatus || 'paused' === propertyStatus ) {
		return (
			<DataTableBlock allowedConfigs={[ 'search_console' ]} id="search_console" />
		);
	}

	const message = 'none' === propertyStatus ?
		__( 'No Search Console property contains this site. Add a URL-prefix property in Search Console, then Burst will retry automatically.', 'burst-statistics' ) :
		__( 'Checking your Google Search Console properties…', 'burst-statistics' );

	return (
		<Block className='row-span-2 overflow-hidden @xl:col-span-6'>
			<BlockHeading title={ __( 'Google Searches', 'burst-statistics' ) } />

			<BlockContent className='flex-col items-center justify-center flex'>
				<p className="py-6 text-center text-sm text-text-gray-light">{ message }</p>
			</BlockContent>
		</Block>
	);
};

/**
 * Top Google Search Console queries for the auto-matched property.
 *
 * The block is always visible so the feature stays discoverable. When the
 * integration is not connected it shows an activation overlay pointing to the
 * Search Console settings tab (where the toggle and connect flow live). Once
 * connected it shows the queries table for the property containing home_url(), a
 * notice when no property matches this site's URL, or a brief checking state
 * while the match resolves.
 *
 * @return {JSX.Element} The rendered block.
 */
const SearchConsoleBlock = (): JSX.Element => {
	const { status, propertyStatus } = useGSCData();
	const { getValue } = useSettingsData();
	const enabled = !! getValue( 'enable_search_console' );

	if ( 'connected' === status ) {
		return <ConnectedSearchConsoleBlock propertyStatus={ propertyStatus } />;
	}

	// Not connected: the toggle is off, or it is on but not yet connected /
	// needs reconnecting. Show an activation overlay that routes to settings.
	return (
		<OverlayBlock
			title={ __( 'Google searches', 'burst-statistics' ) }
			blurLabel={ __( 'Google searches', 'burst-statistics' ) }
			className='row-span-2 overflow-hidden @xl:col-span-6'
		>
			<ActivationCopy type="search_console" enabled={ enabled } />
		</OverlayBlock>
	);
};

export default SearchConsoleBlock;
