import { memo } from 'react';
import Block from '../Blocks/Block';
import BlockHeading from '../Blocks/BlockHeading';
import BlockContent from '../Blocks/BlockContent';
import ErrorBoundary from '@/components/Common/ErrorBoundary';
import Field from '@/components/Fields/Field';
import Overlay from '@/components/Common/Overlay';
import ButtonInput from '@/components/Inputs/ButtonInput';
import { __ } from '@wordpress/i18n';
import useLicenseStore from '@/store/useLicenseStore';

const SettingsGroupBlock = memo(
  ({ group, fields, control, isLastGroup }) => {
    const className = isLastGroup ? 'rounded-b-none' : 'mb-5';

    // filter fields by group id
    const selectedFields = fields.filter(
      ( field ) => field.group_id === group.id
    );
    const { isLicenseValid } = useLicenseStore();

    return (
      <Block key={group.id} className={className}>
        {group.pro && !isLicenseValid && (
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
            {selectedFields.map( ( field, i ) => (
              <ErrorBoundary key={i} fallback={'Could not load field'}>
                <Field
                  key={i}
                  index={i}
                  setting={field}
                  control={control}

                  // fields={selectedFields}
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
