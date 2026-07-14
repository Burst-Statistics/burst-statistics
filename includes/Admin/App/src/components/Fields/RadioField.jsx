import FieldWrapper from '@/components/Fields/FieldWrapper';
import RadioFieldOption from '@/components/Fields/RadioFieldOption';
import { buildControllerFieldProps } from '@/components/Fields/fieldHelpers';

/**
 * Resolves the `context` prop into the text/node to render next to the label.
 *
 * `context` may be a plain string/node, or an object carrying a `text` field.
 *
 * @param {string|Object} context - Raw context prop.
 * @return {React.ReactNode} Text/node to render, or a falsy value.
 */
const resolveContextText = ( context ) => {
	if ( 'object' !== typeof context || ! context ) {
		return context;
	}
	return context.text;
};

/**
 * RadioField component.
 *
 * Renders a group of selectable option cards (with optional icon, returning
 * text, description, and privacy meter) within a FieldWrapper.
 *
 * @param {Object} field              - Provided by react-hook-form's Controller.
 * @param {Object} fieldState         - Contains validation state.
 * @param {string} label              - Field label.
 * @param {string} help               - Help text for the field.
 * @param {string|Object} context     - Contextual information for the field.
 * @param {string} [className]       - Additional Tailwind CSS classes.
 * @param {boolean} [recommended]     - Whether the field is marked as recommended.
 * @param {boolean} [disabled]        - Whether the field is disabled.
 * @return {JSX.Element}
 */
const RadioField = (
	{
		field,
		fieldState,
		label,
		help,
		context,
		className,
		recommended,
		disabled,
		...props
	}
) => {
	const { inputId, error } = buildControllerFieldProps({ field, fieldState, props, label, help, context, className });
	const options = props.options || {};
	const contextText = resolveContextText( context );

	return (
		<FieldWrapper
			label=""
			help={help}
			error={error}
			className={className}
			inputId={inputId}
			required={props.required}
			recommended={recommended}
			disabled={disabled}
			{...props}
		>
			<div className="flex flex-col gap-4">
				<div className="flex items-center justify-between gap-4">
					<span className="text-md font-medium text-text-black">
						{label}
					</span>
					{contextText && (
						<span className="text-sm text-text-gray text-right">
							{contextText}
						</span>
					)}
				</div>

				<div className="flex flex-col gap-3">
					{Object.entries( options ).map( ([ value, option ]) => (
						<RadioFieldOption
							key={`${inputId}-${value}`}
							inputId={inputId}
							value={value}
							field={field}
							option={option}
							disabled={disabled}
						/>
					) )}
				</div>
			</div>
		</FieldWrapper>
	);
};

RadioField.displayName = 'RadioField';

export default RadioField;
