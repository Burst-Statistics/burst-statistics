import { __ } from '@wordpress/i18n';
import { Block } from '@/components/Blocks/Block';
import { BlockContent } from '@/components/Blocks/BlockContent';
import { BlockHeading } from '@/components/Blocks/BlockHeading';
import ActivationCopy from '@/components/Upsell/ActivationCopy';
import OverlayBlock from '@/components/Upsell/OverlayBlock';

interface SearchQueriesAccessStateProps {
	className: string;
}

/**
 * Search Console connection and Pro activation overlay.
 */
export const SearchQueriesOverlay = ({
	isEnabled,
	className
}: SearchQueriesAccessStateProps & { isEnabled: boolean }) => (
	<OverlayBlock
		title={ __( 'Search queries', 'burst-statistics' ) }
		blurLabel={ __( 'Search queries', 'burst-statistics' ) }
		className={ className }
	>
		<ActivationCopy type="search_console" enabled={ isEnabled } />
	</OverlayBlock>
);

/**
 * Property matching state shown after Search Console connects.
 */
export const SearchQueriesPropertyState = ({
	propertyStatus,
	className
}: SearchQueriesAccessStateProps & { propertyStatus: string | null }) => {
	const message = 'none' === propertyStatus ?
		__( 'No Search Console property matches this site URL.', 'burst-statistics' ) :
		__( 'Checking your Google Search Console properties…', 'burst-statistics' );

	return (
		<Block className={ className }>
			<BlockHeading title={ __( 'Search queries', 'burst-statistics' ) } />
			<BlockContent className="flex min-h-64 items-center justify-center">
				<p className="m-0 text-center text-sm text-text-gray-light">
					{ message }
				</p>
			</BlockContent>
		</Block>
	);
};
