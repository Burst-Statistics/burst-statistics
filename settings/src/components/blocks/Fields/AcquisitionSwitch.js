import {memo} from '@wordpress/element';
import Icon from '../../../utils/Icon';
import {__} from '@wordpress/i18n';
import ProPopover from '../ProPopover';
import ProPill from '../ProPill';

const AcquisitionSwitch = ({
  value = 'referrers',
  onChange
}) => {

  // options array with icon and label
  const options = [
    {
      value: 'referrers',
      label: __( 'Referrers', 'burst-statistics' ),
      icon: 'referrers',
      pro: false
    },
    {
      value: 'countries',
      label: __( 'Countries', 'burst-statistics' ),
      icon: 'world',
      pro: true
    }
  ];

  return (
      <div
          className="burst-acquisition-switch"
      >
        {options.map( ( option ) => {
          let selected = value === option.value;
          let disabled = option.pro && ! burst_settings.is_pro;
          let className = 'burst-acquisition-switch__option';
          if ( selected ) {
            className += ' burst-acquisition-switch__option--selected';
          }
          if ( disabled ) {
            className += ' burst-acquisition-switch__option--pro';
            return (
                <ProPopover
                    key={option.value}
                    className={className}
                    onClick={() => {
                      if ( ! disabled ) {
                        onChange( option.value );
                      }
                    }}
                >
                  <Icon name={option.icon} size={13}/>
                  <span>{option.label}</span>
                  <ProPill />
                </ProPopover>
            );
          }

          return (
              <button
                  key={option.value}
                  className={className}
                  onClick={() => {
                    if ( ! disabled ) {
                      onChange( option.value );
                    }
                  }}
              >
                <Icon name={option.icon} size={13}/>
                <span>{option.label}</span>
              </button>
          );
        })}
      </div>

  );
};

export default memo( AcquisitionSwitch );
