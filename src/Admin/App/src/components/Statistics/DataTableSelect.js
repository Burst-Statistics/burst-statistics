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
        <h3 className="flex items-center gap-s burst-h4">{firstOption.label}</h3>
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
        <Select.Trigger className="inline-flex items-center justify-between cursor-pointer py-2 px-0 all-[unset]">
          <Select.Value placeholder="Select an option…" />
          <Select.Icon className="ml-2">
            <Icon name="chevron-down" />
          </Select.Icon>
        </Select.Trigger>
        <Select.Content
          className="bg-gray-100
          z-[99]
          border border-gray-400
          rounded
          flex flex-col flex-wrap
          gap-s
          left-0 right-0
          shadow-[hsl(206_22%_7%_/_35%)_0px_10px_38px_-10px,hsl(206_22%_7%_/_20%)_0px_10px_20px_-15px]
          [animation-duration:600ms]
          [animation-timing-function:cubic-bezier(0.16,1,0.3,1)]
          [will-change:transform,opacity]
          data-[state=open]:animate-slideDownAndFade"
          position={'popper'}
          alignOffset={-10}
        >
          <Select.Viewport>
            {options.map( ( option ) => (
              <Select.Item
                key={option.key}
                value={option.key}
                className="min-w-[min(100vw,150px)]
                cursor-pointer
                text-black
                text-md
                px-s py-xs
                rounded-[3px]
                flex items-center
                data-[disabled]:text-gray
                data-[disabled]:bg-gray-100
                data-[disabled]:cursor-not-allowed
                data-[highlighted]:text-black
                data-[highlighted]:outline-none
                data-[highlighted]:bg-brand-lightest
                data-[state=selected]:text-gray
                data-[state=selected]:outline-none"
                disabled={option.pro && ! isPro}
              >
                <Select.ItemText>
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
