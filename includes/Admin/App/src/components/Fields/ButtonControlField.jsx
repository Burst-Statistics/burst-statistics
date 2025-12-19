import { forwardRef } from 'react';
import ButtonControlInput from '@/components/Inputs/ButtonControlInput';
import FieldWrapper from '@/components/Fields/FieldWrapper';

/**
 * ButtonControlField component
 *
 * @param {Object} field      - Provided by react-hook-form's Controller.
 * @param {Object} fieldState - Contains validation state.
 * @param {string} label      - Field label.
 * @param {string} help       - Help text for the field.
 * @param {string} context    - Contextual information for the field.
 * @param {string} className  - Additional Tailwind CSS classes.
 * @param {Object} props      - Additional props from react-hook-form's Controller.
 * @param {Object} setting    - The setting object.
 * @return {JSX.Element}
 */
const ButtonControlField = forwardRef(
	(
		{
			field,
			fieldState,
			label,
			help,
			context,
			className,
			setting,
			...props
		},
		ref
	) => {
		const inputId = props.id || field.name;

		return (
			<FieldWrapper
				label={label}
				help={help}
				error={fieldState?.error?.message}
				context={context}
				inputId={inputId}
				className={className}
				alignWithLabel={true}
				recommended={props.recommended}
				disabled={props.disabled}
				{...props}
			>
				<ButtonControlInput
					{...field}
					id={inputId}
					aria-invalid={!! fieldState?.error?.message}
					ref={ref}
					buttonText={setting.button_text ?? ''}
					action={setting.action ?? ''}
					url={setting.url ?? ''}
					warnTitle={setting.warnTitle ?? ''}
					warnContent={setting.warnContent ?? ''}
					warnType={setting.warnType ?? ''}
					{...props}
				/>
			</FieldWrapper>
		);
	}
);

ButtonControlField.displayName = 'ButtonControlField';

export default ButtonControlField;
