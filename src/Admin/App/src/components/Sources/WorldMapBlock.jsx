
import { useFiltersStore } from '@/store/useFiltersStore';
import { __ } from '@wordpress/i18n';

import { Block } from '@/components/Blocks/Block';
import { BlockHeading } from '@/components/Blocks/BlockHeading';
import { BlockContent } from '@/components/Blocks/BlockContent';
import { useMemo, memo } from 'react';
import WorldMap from '@/components/Sources/WorldMap/WorldMap';
import WorldMapHeader from '@/components/Sources/WorldMap/WorldMapHeader';
import ErrorBoundary from '../Common/ErrorBoundary';

const WorldMapBlock = () => {

  return (
    <Block className="row-span-2 xl:col-span-6">
        <ErrorBoundary>
      <BlockHeading
        className='border-b border-gray-300'
        title={__( 'World View', 'burst-statistics' )}
        controls={<WorldMapHeader />}
      />
      <BlockContent className="px-0 py-0">
       <WorldMap/>
      </BlockContent>
      </ErrorBoundary>
    </Block>
  );
};

// Export a memoized version of the component
export default memo( WorldMapBlock );
