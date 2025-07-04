import {memo, useMemo} from 'react';
import { Block } from '@/components/Blocks/Block';
import { BlockHeading } from '@/components/Blocks/BlockHeading';
import { BlockContent } from '@/components/Blocks/BlockContent';
import ErrorBoundary from '@/components/Common/ErrorBoundary';
import Field from '@/components/Fields/Field';
import Overlay from '@/components/Common/Overlay';
import ButtonInput from '@/components/Inputs/ButtonInput';
import { __ } from '@wordpress/i18n';
import useLicenseStore from '@/store/useLicenseStore';

const SettingsGroupBlock = memo(
  ({ group, fields, control, isLastGroup }) => {
      const { isLicenseValid } = useLicenseStore();

      const className = isLastGroup ? 'rounded-b-none' : 'mb-5';


    if ( fields.length === 0 ) {
      return null; // No fields to display
    }

    return (
      <Block key={group.id} className={className}>
        {group.pro && !isLicenseValid() && (
          <Overlay className='backdrop-blur-sm'>
            <div className='flex flex-col gap-4'>
              <h4>{__( 'Unlock Advanced Features with Burst Pro', 'burst-statistics' )}</h4>
              <p>
                {__( 'This setting is exclusive to Pro users.', 'burst-statistics' )} 
              {group.pro && group.pro.text && (' ' + group.pro.text)}
              </p>
              {group.pro.url && <ButtonInput to={group.pro.url} btnVariant='primary' btnSize='small'>
                {__( 'Upgrade to Pro', 'burst-statistics' )}
              </ButtonInput>}
            </div>
            </Overlay>
        )}
        <BlockHeading title={group.title} className="burst-settings-group-block" />
        <BlockContent className="p-0 pb-4">
          {group.description && <h3 className="mb-5 text-sm">{group.description}</h3>}
          <div className="flex flex-wrap">
            {fields.map( ( field, i ) => (
              <ErrorBoundary key={i} fallback={'Could not load field'}>
                <Field
                  key={i}
                  index={i}
                  setting={field}
                  control={control}
                />
              </ErrorBoundary>
            ) )}
          </div>
        </BlockContent>
      </Block>
    );
  }
);

SettingsGroupBlock.displayName = 'SettingsGroupBlock';

export default SettingsGroupBlock;
