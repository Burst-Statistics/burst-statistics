import {useState, useEffect} from '@wordpress/element';
import * as Checkbox from '@radix-ui/react-checkbox';
import Icon from '../../utils/Icon';
import {__} from '@wordpress/i18n';
import ProPill from './ProPill';
import Popover from './Popover';
import useLicenseStore from '../../store/useLicenseStore';

const PopoverFilter = ({
  onApply,
  id,
  options,
  selectedOptions
}) => {
  const [ isOpen, setIsOpen ] = useState( false );
  const [ pendingMetrics, setPendingMetrics ] = useState( selectedOptions );

  // Inside your PopoverFilter component
  useEffect( () => {
    setPendingMetrics( selectedOptions );
  }, [ selectedOptions ]);

  const {licenseStatus} = useLicenseStore();

  const onCheckboxChange = ( value ) => {

    // add or remove metric from array
    if ( pendingMetrics.includes( value ) ) {
      setPendingMetrics( pendingMetrics.filter( ( metric ) => metric !== value ) );
    } else {
      setPendingMetrics([ ...pendingMetrics, value ]);
    }
  };

  const resetToDefaults = () => {

    // get default metrics from options object
    const defaultMetrics = Object.keys( options ).
        filter( ( option ) => options[option].default );

    setPendingMetrics( defaultMetrics );
    setMetrics( defaultMetrics );
    setIsOpen( false );
  };

  const applyMetrics = ( metrics ) => {
    setMetrics( metrics );
    setIsOpen( false );
  };

  const setMetrics = ( metrics ) => {

    // if no metrics are selected, set warning and don't close popover
    onApply( metrics );
    setIsOpen( false );
  };
  const openOrClosePopover = ( open ) => {
    if ( open ) {
      setIsOpen( true );
    } else {
      setIsOpen( false );
      setPendingMetrics( selectedOptions );
    }
  };

  const footer = (
      <>
        <button
            onClick={() => applyMetrics( pendingMetrics )}
            className={'burst-button burst-button--primary'}>
          {__( 'Apply', 'burst-statistics' )}
        </button>
        <button
            onClick={() => resetToDefaults()}
            className={'burst-button burst-button--secondary'}>
          {__( 'Reset to defaults', 'burst-statistics' )}
        </button>
      </>
  );
  return (
      <Popover
          isOpen={isOpen}
          setIsOpen={openOrClosePopover}
          title={__( 'Select metrics', 'burst-statistics' )}
          footer={footer}
      >
        {Object.keys( options ).map( ( value ) => {
              const isProActive = burst_settings.is_pro &&
                  'valid' === licenseStatus;
              return (
                  <div
                      key={value}
                      className={'burst-checkbox-group__item'}
                  >
                    <Checkbox.Root
                        className="burst-checkbox-group__checkbox"
                        id={id + '_' + value}
                        checked={pendingMetrics.includes( value )}
                        aria-label={__( 'Change metrics', 'burst-statistics' )}
                        disabled={true === options[value].disabled || ( options[value].pro && ! isProActive )}
                        onCheckedChange={() => onCheckboxChange( value )}
                    >
                      <Checkbox.Indicator
                          className="burst-checkbox-group__indicator">
                        <Icon name={'check'} size={14} color={'green'}/>
                      </Checkbox.Indicator>
                    </Checkbox.Root>
                    <label className="burst-checkbox-group__label"
                           htmlFor={id + '_' + value}>
                      {options[value].label}
                    </label>
                    <div className={'burst-checkbox-group__item__pill'}>
                      {options[value].pro && ! isProActive && (
                          <ProPill/>
                      )}
                    </div>
                  </div>
              );
            }
        )}

      </Popover>
  );
};

export default PopoverFilter;
