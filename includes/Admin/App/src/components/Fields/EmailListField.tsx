import { forwardRef } from 'react';
import FieldWrapper from '@/components/Fields/FieldWrapper';
import { EmailSelectInput } from '@/components/Inputs/EmailSelectInput';
import { MAX_EMAIL_RECIPIENTS } from '@/utils/emailList';

interface EmailListFieldProps {
	field: {
		name: string;
		value: string[];
		onChange: ( value: string[]) => void;
	};
	fieldState?: {
		error?: { message?: string };
	};
	label: string;
	context?: string;
	help?: string;
	disabled?: boolean;
}

/**
 * An editable list of email addresses (field type 'email_list'), the same
 * input as the report wizard recipients. The cap applies without a counter.
 * Validation rules come from Field.jsx.
 */
const EmailListField = forwardRef<HTMLInputElement, EmailListFieldProps>(
	({ field, fieldState, label, context, help, disabled = false }, ref ) => {
		const emails = Array.isArray( field.value ) ? field.value : [];

		return (
			<FieldWrapper
				inputId={field.name}
				label={label}
				context={context}
				help={help}
				error={fieldState?.error?.message}
				disabled={disabled}
			>
				<EmailSelectInput
					ref={ref}
					id={field.name}
					name={field.name}
					value={emails}
					onChange={field.onChange}
					disabled={disabled}
					maxSelections={MAX_EMAIL_RECIPIENTS}
					showCounter={false}
				/>
			</FieldWrapper>
		);
	}
);

EmailListField.displayName = 'EmailListField';

export default EmailListField;
