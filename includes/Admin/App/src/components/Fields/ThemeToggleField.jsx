import { forwardRef } from 'react';
import FieldWrapper from '@/components/Fields/FieldWrapper';
import ThemeToggleButton from '@/components/Inputs/ThemeToggleButton';
import { useTheme } from '@/hooks/useTheme';

const ThemeToggleField = forwardRef(
	({ field, fieldState, label, help, context, className, ...props }, ref ) => {
		const { isHostManagedContext } = useTheme();

		if ( isHostManagedContext ) {
			return null;
		}

		const inputId = props.id || field.name;

		return (
			<FieldWrapper
				label={label}
				help={help}
				error={fieldState?.error?.message}
				context={context}
				className={className + ' flex-row'}
				inputId={inputId}
				alignWithLabel={true}
				recommended={props.recommended}
				disabled={props.disabled}
				{...props}
			>
				<span ref={ref} className="inline-flex">
					<ThemeToggleButton />
				</span>
			</FieldWrapper>
		);
	}
);

ThemeToggleField.displayName = 'ThemeToggleField';

export default ThemeToggleField;
