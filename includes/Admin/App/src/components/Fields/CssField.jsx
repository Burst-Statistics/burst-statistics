import { css } from '@codemirror/lang-css';
import CodeEditorInput from '@/components/Inputs/CodeEditorInput';
import FieldWrapper from '@/components/Fields/FieldWrapper';

/**
 * CssField component. Renders a CSS code editor wired to react-hook-form.
 */
const CssField =
	({ field, fieldState, label, help, context, className, ...props }) => {
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
				<CodeEditorInput
					id={inputId}
					value={field.value || ''}
					onChange={( value ) => field.onChange( value )}
					extensions={[ css() ]}
					disabled={props.disabled}
					aria-invalid={!! fieldState?.error?.message}
				/>
			</FieldWrapper>
		);
	};

CssField.displayName = 'CssField';
export default CssField;
