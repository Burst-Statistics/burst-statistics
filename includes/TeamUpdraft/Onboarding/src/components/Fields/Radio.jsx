// eslint-disable-next-line import/no-unresolved
import FieldWrapper from '@/components/Fields/FieldWrapper';
// eslint-disable-next-line import/no-unresolved
import Icon from '@/utils/Icon';
import { __ } from '@wordpress/i18n';
import { clsx } from 'clsx';

const METER_SEGMENTS = 3;

const Radio = ( { field, onChange, value } ) => {
	const options = field.options || {};

	return (
		<FieldWrapper label={ '' } inputId={ field.id }>
			<div className="flex flex-col gap-3">
				{ /* fallow-ignore-next-line complexity */ }
				{ Object.entries( options ).map( ( [ val, option ] ) => {
					const optionLabel =
						'string' === typeof option ? option : option.label;
					const optionIcon =
						'object' === typeof option && option.icon
							? option.icon
							: null;
					const optionReturning =
						'object' === typeof option && option.returning
							? option.returning
							: null;
					const optionDescription =
						'object' === typeof option && option.description
							? option.description
							: null;
					const optionMeter =
						'object' === typeof option && option.meter
							? option.meter
							: 0;
					const optionLevel =
						'object' === typeof option && option.level
							? option.level
							: null;
					const isChecked = value === val;

					return (
						<label
							key={ `${ field.id }-${ val }` }
							htmlFor={ `${ field.id }-${ val }` }
							className={ clsx(
								'flex items-start gap-4 rounded-xl border-2 p-4 transition-all duration-200 cursor-pointer',
								isChecked
									? 'border-primary bg-primary-50'
									: 'border-gray-200 bg-white hover:border-gray-300'
							) }
						>
							<input
								type="radio"
								id={ `${ field.id }-${ val }` }
								name={ field.id }
								value={ val }
								checked={ isChecked }
								onChange={ () => onChange( val ) }
								className="h-5 w-5 shrink-0 rounded-full border border-gray-400 text-primary focus:ring-primary focus:ring-offset-0 cursor-pointer mt-0.5"
							/>
							<div className="flex flex-1 items-start justify-between gap-4">
								<div className="flex flex-col gap-1">
									<div className="flex items-center gap-2">
										{ optionIcon && (
											<Icon
												name={ optionIcon }
												size={ 16 }
												className="text-text-gray"
											/>
										) }
										<span className="font-semibold text-text-black text-md">
											{ optionLabel }
										</span>
									</div>
									{ optionReturning && (
										<div className="flex items-center gap-1.5 mt-1">
											<Icon
												name="repeat"
												size={ 14 }
												color="gray"
												className="shrink-0"
											/>
											<span className="text-base font-medium text-text-gray">
												{ optionReturning }
											</span>
										</div>
									) }
									{ optionDescription && (
										<span className="text-sm text-text-gray mt-1">
											{ optionDescription }
										</span>
									) }
								</div>
								{ optionLevel && (
									<div className="flex flex-col items-end gap-1 shrink-0">
										<span className="text-xs text-text-gray whitespace-nowrap">
											{ __(
												'Privacy',
												'burst-statistics'
											) }
										</span>
										<div className="flex items-center gap-1">
											{ Array.from( {
												length: METER_SEGMENTS,
											} ).map( ( _, index ) => (
												<span
													key={ `${ field.id }-${ val }-meter-${ index }` }
													className={ clsx(
														'h-1.5 w-4 rounded-full',
														index < optionMeter
															? 'bg-primary'
															: 'bg-gray-200'
													) }
												/>
											) ) }
										</div>
										<span className="text-xs font-bold text-text-black whitespace-nowrap">
											{ optionLevel }
										</span>
									</div>
								) }
							</div>
						</label>
					);
				} ) }
			</div>
		</FieldWrapper>
	);
};

export default Radio;
