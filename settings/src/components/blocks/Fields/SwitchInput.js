import {memo} from '@wordpress/element';
import * as Switch from '@radix-ui/react-switch';

const SwitchInput = ({
	value,
	onChange,
	required,
	disabled,
	className,
	label
}) => {
	let val = value;

	//if value is "0" or "1", convert to boolean
	//cookiebanner values can be "0" or "1", because of the way they're loaded,
	// but the switch needs a boolean
	if ( '0' === value || '1' === value ) {
		val = '1' === value;
	}

	return (
		<div className={'burst-input-group burst-switch-group'}>
			<Switch.Root
				className={'burst-switch-root ' + className}
				checked={val}
				onCheckedChange={onChange}
				disabled={disabled}
				required={required}
			>
				<Switch.Thumb className="burst-switch-thumb"/>
			</Switch.Root>
			{/*{label && <label className="burst-switch-label">{label}</label>}*/}
		</div>
	);
};

export default memo( SwitchInput );
