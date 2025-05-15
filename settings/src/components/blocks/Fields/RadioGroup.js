import * as RadioGroupRadix from '@radix-ui/react-radio-group';
import {memo} from '@wordpress/element';

const RadioGroup = ({ label, id, value, onChange, required, defaultValue, disabled, options = {} }) => {
	return (
		<RadioGroupRadix.Root
			disabled={disabled && ! Array.isArray( disabled )}
			className="burst-input-group burst-radio-group"
			value={value}
			aria-label={label}
			onValueChange={onChange}
			required={required}
			default={defaultValue}
		>
			{Object.entries( options ).map( ([ key, optionLabel ]) => (
				<div key={key} className={'burst-radio-group__item'}>
					<RadioGroupRadix.Item
						disabled={Array.isArray( disabled ) && disabled.includes( key ) }
						value={key}
						id={id + '_' + key}>
						<RadioGroupRadix.Indicator className={'burst-radio-group__indicator'} />
					</RadioGroupRadix.Item>
					<label className="burst-radio-label" htmlFor={id + '_' + key}>
						{optionLabel}
					</label>
				</div>
			) )}
		</RadioGroupRadix.Root>
	);
};

export default memo( RadioGroup );
