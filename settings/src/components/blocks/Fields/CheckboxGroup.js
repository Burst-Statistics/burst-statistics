import * as Checkbox from '@radix-ui/react-checkbox';
import { __ } from '@wordpress/i18n';
import Icon from '../../../utils/Icon';
import {useEffect, useState, memo} from '@wordpress/element';

const CheckboxGroup = ({ indeterminate, label, value, id, onChange, required, disabled, options = {} }) => {
	const [ isBoolean, setIsBoolean ] = useState( false );
	const [ loadMoreExpanded, setLoadMoreExpanded ] = useState( false );

	let valueValidated = value;
	if ( ! Array.isArray( valueValidated ) ) {
		valueValidated = '' === valueValidated ? [] : [ valueValidated ];
	}

	useEffect ( () => {
		let isBool = ( 1 === Object.keys( options ).length ) && 'true' === Object.keys( options )[0];
		setIsBoolean( isBool );
	}, []);

	if ( indeterminate ) {
		value = true;
	}

	const selected = valueValidated;
	const loadMoreCount = 10;

	// check if there are more options than the loadmore count
	let loadMoreEnabled = false;

	if ( Object.keys( options ).length > loadMoreCount ) {
		loadMoreEnabled = true;
	}

	const handleCheckboxChange = ( e, option ) => {
		if ( isBoolean ) {
			onChange( ! value );
		} else {
			const newSelected = selected.includes( '' + option ) || selected.includes( parseInt( option ) ) ?
				selected.filter( ( item ) => item !== '' + option && item !== parseInt( option ) ) :
				[ ...selected, option ];
			onChange( newSelected );
		}
	};

	const isEnabled = ( id ) => {

		// if there is only one option, we use the value as a boolean
		//selected can both be array of strings or integers.
		return isBoolean ? value : selected.includes( '' + id ) || selected.includes( parseInt( id ) );
	};

	const loadMoreHandler = () => {
		setLoadMoreExpanded( ! loadMoreExpanded );
	};
	let allDisabled = disabled && ! Array.isArray( disabled );

	if ( 0 === Object.keys( options ).length ) {
		return (
			<>{__( 'No options found', 'burst-statistics' )}</>
		);
	}

	return (
		<div className={'burst-checkbox-group'}>
			{Object.entries( options ).map( ([ key, optionLabel ], i ) => (
				<div
					key={key}
					className={`burst-checkbox-group__item${
						! loadMoreExpanded && i > loadMoreCount - 1 ? ' burst-hidden' : ''
					}`}
				>
					<Checkbox.Root
						className="burst-checkbox-group__checkbox"
						id={id + '_' + key}
						checked={isEnabled( key )}
						aria-label={label}
						disabled={allDisabled || ( Array.isArray( disabled ) && disabled.includes( key ) ) }
						required={required}
						onCheckedChange={( e ) => handleCheckboxChange( e, key )}
					>
						<Checkbox.Indicator className="burst-checkbox-group__indicator">
							<Icon name={indeterminate ? 'indeterminate' : 'check'} size={14} color={'dark-blue'} />
						</Checkbox.Indicator>
					</Checkbox.Root>
					<label className="burst-checkbox-group__label" htmlFor={id + '_' + key}>
						{optionLabel}
					</label>
				</div>
			) )}
			{! loadMoreExpanded && loadMoreEnabled && (
				<button onClick={()=>loadMoreHandler()}>
					{__( 'Show more', 'burst-statistics' )}
				</button>
			)}
			{loadMoreExpanded && loadMoreEnabled && (
				<button onClick={() => loadMoreHandler()}>
					{__( 'Show less', 'burst-statistics' )}
				</button>
			)}
		</div>
	);
};

export default memo( CheckboxGroup );
