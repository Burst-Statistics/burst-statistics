import * as Select from '@radix-ui/react-select';
import Icon from '../../utils/Icon';
import ProPill from './ProPill';
import ProPopover from './ProPopover';
import {__} from '@wordpress/i18n';
import useLicenseStore from '../../store/useLicenseStore';

// import './styles.css'; // Ensure your styles.css has the required styles

const DataTableSelect = ({ value, onChange, options }) => {
  const handleValueChange = ( value ) => {
    onChange( value );
  };
  const {licenseStatus} = useLicenseStore();
  const isProActive = burst_settings.is_pro && 'valid' === licenseStatus;

  // hasProOptions
  const hasProOptions = options.some( ( option ) => option.pro );
  const firstOption = options[0];

  if ( hasProOptions && ! isProActive ) {
    return (
        <ProPopover
            title={firstOption.upsellPopover.title}
            subtitle={firstOption.upsellPopover.subtitle}
            bulletPoints={firstOption.upsellPopover.bulletPoints}
            primaryButtonUrl={firstOption.upsellPopover.primaryButtonUrl}
            secondaryButtonUrl={firstOption.upsellPopover.secondaryButtonUrl}
        >
          <h3 className={'burst-grid-title burst-h4'}>{firstOption.label}</h3>
          <Icon name="chevron-down"/>
        </ProPopover>
    );
  } else {
    return (
        <Select.Root value={value} onValueChange={handleValueChange}>
          <Select.Trigger className="burst-datatable__select-trigger">
            <Select.Value placeholder="Select an option…"/>
            <Select.Icon className={'burst-datatable__select-trigger__icon'}>
              <Icon name="chevron-down"/>
            </Select.Icon>
          </Select.Trigger>
          <Select.Content className="burst-datatable__select-content"
                          position={'popper'} alignOffset={-10}>
            <Select.Viewport>
              {options.map( ( option ) => (
                  <Select.Item key={option.key} value={option.key}
                               className="burst-datatable__select-content__item"
                               disabled={option.pro && ! burst_settings.is_pro}>
                    <Select.ItemText
                        className={'burst-datatable__select-content__label'}>{option.label}</Select.ItemText>
                  </Select.Item>
              ) )}
            </Select.Viewport>
          </Select.Content>
        </Select.Root>
    );
  }
};

export default DataTableSelect;
