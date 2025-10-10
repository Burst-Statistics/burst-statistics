
import { useFiltersStore } from '@/store/useFiltersStore';
import { __ } from '@wordpress/i18n';

import { Block } from '@/components/Blocks/Block';
import { BlockHeading } from '@/components/Blocks/BlockHeading';
import { BlockContent } from '@/components/Blocks/BlockContent';
import { useMemo, memo } from 'react';
import GhostWorldMap from '@/components/Upsell/GhostWorldMap';
// import WorldMapHeader from '@/components/Sources/WorldMap/WorldMapHeader';
import ErrorBoundary from '../Common/ErrorBoundary';

const GhostWorldMapBlock = () => {

  return (
    <Block className="row-span-2 xl:col-span-6">
        <ErrorBoundary>
      <BlockHeading
        className='border-b border-gray-200'
        title={__( 'World View', 'burst-statistics' )}
        // controls={<WorldMapHeader />}
      />
      <BlockContent className={'px-0 py-0'}>
       <GhostWorldMap/>
      </BlockContent>
      </ErrorBoundary>
    </Block>
  );
};

// Export a memoized version of the component
export default memo( GhostWorldMapBlock );
