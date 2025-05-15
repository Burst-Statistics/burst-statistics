import { memo } from '@wordpress/element';
import Icon from '../../../utils/Icon';
import ProPopover from '../ProPopover';
import ProPill from '../ProPill';

const Option = ({ option, isSelected, isDisabled, onChange }) => {
  let className = 'burst-acquisition-switch__option';
  if ( isSelected ) {
    className += ' burst-acquisition-switch__option--selected';
  }
  if ( isDisabled ) {
    className += ' burst-acquisition-switch__option--pro';
  }

  const handleClick = () => {
    if ( ! isDisabled ) {
      onChange( option.value );
    }
  };

  if ( isDisabled ) {
    return (
        <ProPopover key={option.value} className={className} onClick={handleClick}>
          <Icon name={isSelected ? 'bullet' : 'circle'} size={13} color={isSelected ? 'blue' : 'grey'} />
          <span>{option.label}</span>
          <ProPill />
        </ProPopover>
    );
  }

  return (
      <button key={option.value} className={className} onClick={handleClick}>
        <Icon name={isSelected ? 'bullet' : 'circle'} size={13} color={'dark-blue'} />
        <span>{option.label}</span>
      </button>
  );
};

const SwitchText = ({ value = 'referrers', onChange, options }) => {
  return (
      <div className="burst-acquisition-switch">
        {options.map( ( option ) => (
            <Option
                key={option.value}
                option={option}
                isSelected={value === option.value}
                isDisabled={option.pro && ! burst_settings.is_pro}
                onChange={onChange}
            />
        ) )}
      </div>
  );
};

export default memo( SwitchText );
