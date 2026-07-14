import React, { forwardRef } from 'react';
import FieldWrapper from '@/components/Fields/FieldWrapper';

export const buildControllerFieldProps = ({
	field,
	fieldState,
	props,
	label,
	help,
	context,
	className,
	alignWithLabel = false
}) => {
	const inputId = props.id || field.name;
	const error = fieldState?.error?.message;

	return {
		inputId,
		error,
		wrapperProps: {
			label,
			help,
			error,
			context,
			className,
			inputId,
			required: props.required,
			recommended: props.recommended,
			disabled: props.disabled,
			alignWithLabel,
			props,
			...props
		}
	};
};

const renderControllerField = ({
	field,
	fieldState,
	props,
	label,
	help,
	context,
	className,
	alignWithLabel = false,
	InputComponent,
	inputProps = {}
}) => {
	const { wrapperProps } = buildControllerFieldProps({
		field,
		fieldState,
		props,
		label,
		help,
		context,
		className,
		alignWithLabel
	});

	return renderWrappedField({
		wrapperProps,
		InputComponent,
		inputProps
	});
};

export const renderWrappedField = ({ wrapperProps, InputComponent, inputProps }) => {
	return (
		<FieldWrapper {...wrapperProps}>
			<InputComponent {...inputProps} />
		</FieldWrapper>
	);
};

export const createFieldComponent = ( InputComponent, options = {}) => {
	const { alignWithLabel = false, extraClassName = '', customizeInputProps = null } = options;
	const FieldComponent = forwardRef(

		// fallow-ignore-next-line complexity
		({ field, fieldState, label, help, context, className, ...props }, ref ) => {
			let inputProps = {
				...field,
				id: props.id || field.name,
				'aria-invalid': !! fieldState?.error?.message,
				ref,
				...props
			};
			if ( customizeInputProps ) {
				inputProps = customizeInputProps( inputProps, { field, fieldState, label, help, context, className, props });
			}
			return renderControllerField({
				field,
				fieldState,
				props,
				label,
				help,
				context,
				className: extraClassName ? `${className || ''} ${extraClassName}`.trim() : className,
				alignWithLabel,
				InputComponent,
				inputProps
			});
		}
	);
	FieldComponent.displayName = 'FieldComponent';
	return FieldComponent;
};
