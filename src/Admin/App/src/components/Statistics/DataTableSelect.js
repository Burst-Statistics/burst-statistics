import * as Select from '@radix-ui/react-select';
import Icon from '@/utils/Icon';
import ProPopover from '../Common/ProPopover';
import useLicenseStore from '@/store/useLicenseStore';
import { memo, useCallback, useMemo } from 'react';

const DataTableSelect = ({ value, onChange, options }) => {
  const handleValueChange = useCallback( ( newValue ) => {
    onChange( newValue );
  }, [ onChange ]);

  const { isLicenseValid, isPro } = useLicenseStore();
  const isProActive = isPro && isLicenseValid();

  // Memoize expensive calculations
  const { hasProOptions, firstOption } = useMemo( () => {
    const hasProOpts = options.some( ( option ) => option.pro );
    return {
      hasProOptions: hasProOpts,
      firstOption: options[0]
    };
  }, [ options ]);

  if ( hasProOptions && ! isProActive && firstOption?.upsellPopover ) {
    return (
      <ProPopover
        title={firstOption.upsellPopover.title}
        subtitle={firstOption.upsellPopover.subtitle}
        bulletPoints={firstOption.upsellPopover.bulletPoints}
        primaryButtonUrl={firstOption.upsellPopover.primaryButtonUrl}
        secondaryButtonUrl={firstOption.upsellPopover.secondaryButtonUrl}
      >
        <h3 className={'burst-grid-title burst-h4'}>{firstOption.label}</h3>
        <Icon name="chevron-down" />
      </ProPopover>
    );
  } else {
    if ( options.length === 1 ) {
      return (
        <span className="text-lg font-semibold">{options[0].label}</span>
      );
    }
    return (
      <Select.Root value={value} onValueChange={handleValueChange}>
        <Select.Trigger className="burst-datatable__select-trigger">
          <Select.Value placeholder="Select an option…" />
          <Select.Icon className={'burst-datatable__select-trigger__icon'}>
            <Icon name="chevron-down" />
          </Select.Icon>
        </Select.Trigger>
        <Select.Content
          className="burst-datatable__select-content"
          position={'popper'}
          alignOffset={-10}
        >
          <Select.Viewport>
            {options.map( ( option ) => (
              <Select.Item
                key={option.key}
                value={option.key}
                className="burst-datatable__select-content__item"
                disabled={option.pro && ! isPro}
              >
                <Select.ItemText
                  className={'burst-datatable__select-content__label'}
                >
                  {option.label}
                </Select.ItemText>
              </Select.Item>
            ) )}
          </Select.Viewport>
        </Select.Content>
      </Select.Root>
    );
  }
};

// Export memoized component to prevent unnecessary re-renders
export default memo( DataTableSelect );
