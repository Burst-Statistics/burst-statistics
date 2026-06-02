import { forwardRef } from 'react';
import ColorPickerInput from '@/components/Inputs/ColorPickerInput';
import FieldWrapper from '@/components/Fields/FieldWrapper';

/**
 * ColorPickerField component
 */
const ColorPickerField = forwardRef(
	({ field, fieldState, label, help, context, className, ...props }, ref ) => {
		const inputId = props.id || field.name;

		return (
			<FieldWrapper
				label={label}
				help={help}
				error={fieldState?.error?.message}
				context={context}
				className={className}
				inputId={inputId}
				required={props.required}
				recommended={props.recommended}
				disabled={props.disabled}
				{...props}
			>
				<ColorPickerInput
					id={inputId}
					aria-invalid={!! fieldState?.error?.message}
					ref={ref}
					{...field}
					{...props}
				/>
			</FieldWrapper>
		);
	}
);

ColorPickerField.displayName = 'ColorPickerField';

export default ColorPickerField;
