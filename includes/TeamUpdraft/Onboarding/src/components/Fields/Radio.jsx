// eslint-disable-next-line import/no-unresolved
import FieldWrapper from '@/components/Fields/FieldWrapper';
// eslint-disable-next-line import/no-unresolved
import Icon from '@/utils/Icon';

const Radio = ( { field, onChange, value } ) => {
	const options = field.options || {};

	const renderBadge = ( badgeFormat, badgeLevel, badgeColor ) => {
		if ( ! badgeFormat ) {
			return null;
		}

		if ( ! badgeLevel ) {
			return (
				<span className="text-sm text-text-gray">{ badgeFormat }</span>
			);
		}

		let colorClass = 'text-text-gray font-semibold';
		if ( 'blue' === badgeColor ) {
			colorClass = 'text-blue-500 font-semibold';
		} else if ( 'green' === badgeColor ) {
			colorClass = 'text-green-500 font-semibold';
		}

		const parts = badgeFormat.split( '%s' );
		return (
			<span className="text-sm text-text-gray">
				{ parts[ 0 ] }
				<span className={ colorClass }>{ badgeLevel }</span>
				{ parts[ 1 ] }
			</span>
		);
	};

	return (
		<FieldWrapper label={ '' } inputId={ field.id }>
			<div className="flex flex-col gap-4">
				{ Object.entries( options ).map( ( [ val, option ] ) => {
					const optionLabel =
						'string' === typeof option ? option : option.label;
					const optionContext =
						'object' === typeof option && option.context
							? option.context
							: null;
					const optionIcon =
						'object' === typeof option && option.icon
							? option.icon
							: null;
					const optionBadge =
						'object' === typeof option && option.badge
							? option.badge
							: null;
					const optionBadgeLevel =
						'object' === typeof option && option.badge_level
							? option.badge_level
							: null;
					const optionBadgeColor =
						'object' === typeof option && option.badge_color
							? option.badge_color
							: null;
					const isChecked = value === val;

					return (
						<label
							key={ `${ field.id }-${ val }` }
							htmlFor={ `${ field.id }-${ val }` }
							className={ `flex items-center justify-between gap-4 rounded-xl border p-4 transition-all duration-200 cursor-pointer ${
								isChecked
									? 'border-blue-500 bg-blue-50/10'
									: 'border-gray-200 bg-white hover:border-gray-300'
							}` }
						>
							<div className="flex items-start gap-3">
								<input
									type="radio"
									id={ `${ field.id }-${ val }` }
									name={ field.id }
									value={ val }
									checked={ isChecked }
									onChange={ () => onChange( val ) }
									className="h-5 w-5 rounded-full border border-gray-400 focus:ring-primary focus:ring-offset-0 cursor-pointer mt-0.5"
								/>
								<div className="flex flex-col">
									<div className="flex items-center gap-2">
										{ optionIcon && (
											<Icon
												name={ optionIcon }
												size={ 16 }
												className="text-text-gray"
											/>
										) }
										<span className="font-semibold text-text-black text-base">
											{ optionLabel }
										</span>
									</div>
									{ optionContext && (
										<span className="text-sm text-text-gray mt-1">
											{ optionContext }
										</span>
									) }
								</div>
							</div>
							{ optionBadge && (
								<div className="flex items-center">
									{ renderBadge(
										optionBadge,
										optionBadgeLevel,
										optionBadgeColor
									) }
								</div>
							) }
						</label>
					);
				} ) }
			</div>
		</FieldWrapper>
	);
};

export default Radio;
