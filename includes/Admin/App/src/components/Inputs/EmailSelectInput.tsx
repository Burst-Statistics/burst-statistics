import React, {
	useState,
	ChangeEvent,
	KeyboardEvent,
	forwardRef,
	ForwardedRef
} from 'react';
import { __ } from '@wordpress/i18n';

interface EmailSelectInputProps {
	value: string[];
	onChange: ( emails: string[]) => void;
	name?: string;
	disabled?: boolean;
	placeholder?: string;
	maxSelections?: number;
	showRemoveButton?: boolean;
}

export const EmailSelectInput = forwardRef<HTMLInputElement, EmailSelectInputProps>(
	function EmailSelectInput(
		props: EmailSelectInputProps,
		ref: ForwardedRef<HTMLInputElement>
	) {
		const {
			value,
			onChange,
			name,
			disabled = false,
			placeholder = __( 'Add email...', 'burst-statistics' ),
			maxSelections = 10,
			showRemoveButton = true
		} = props;

		const [ inputValue, setInputValue ] = useState<string>( '' );

		const handleAddEmail = ( raw: string ): void => {
			const email = raw.trim();

			if ( ! email ) {
				return;
			}

			onChange([ ...value, email ]);
			setInputValue( '' );
		};

		const handleKeyDown = ( event: KeyboardEvent<HTMLInputElement> ): void => {
			if ( 'Enter' === event.key ) {
				event.preventDefault();
				handleAddEmail( inputValue );
			}

			if (
				'Backspace' === event.key &&
				0 === inputValue.length &&
				0 < value.length
			) {
				event.preventDefault();
				onChange( value.slice( 0, -1 ) );
			}
		};

		const handleChange = ( event: ChangeEvent<HTMLInputElement> ): void => {
			setInputValue( event.target.value );
		};

		const handleRemove = ( email: string ): void => {
			onChange( value.filter( ( e ) => e !== email ) );
		};

		const handleBlur = (): void => {
			if ( inputValue.trim() ) {
				handleAddEmail( inputValue );
			}
		};

		const containerClass =
			'flex min-h-[2.5rem] w-full rounded-md border border-gray-400 bg-white ' +
			'focus-within:border-primary-dark focus-within:ring disabled:cursor-not-allowed ' +
			'disabled:border-gray-200 disabled:bg-gray-200';

		const innerClass =
			'flex flex-1 flex-wrap items-center gap-1 p-1';

		const tagClass =
			'flex items-center gap-1 rounded bg-primary-light px-2 py-1 text-base text-primary-dark';

		const inputClass =
			'flex-1 min-w-[120px] bg-transparent p-1 text-base outline-none disabled:cursor-not-allowed';

		return (
			<div className={containerClass}>
				<div className={innerClass}>
					{value.map( ( email, index ) => (
						<span key={`${email}-${index}`} className={tagClass}>
							{email}
							{showRemoveButton && (
								<button
									type="button"
									onClick={() => handleRemove( email )}
									className="ml-1 rounded-full hover:bg-primary hover:text-white"
								>
									✕
								</button>
							)}
						</span>
					) )}

					{( ! maxSelections || value.length < maxSelections ) && (
						<input
							ref={ref}
							name={name}
							value={inputValue}
							disabled={disabled}
							placeholder={0 === value.length ? placeholder : ''}
							onChange={handleChange}
							onKeyDown={handleKeyDown}
							onBlur={handleBlur}
							className={inputClass}
						/>
					)}
				</div>

				{maxSelections && (
					<div className="flex items-center border-l border-gray-300">
						<span className="px-2 text-xs text-gray-500 border-r border-gray-200">
							{value.length}/{maxSelections}
						</span>
					</div>
				)}
			</div>
		);
	}
);

EmailSelectInput.displayName = 'EmailSelectInput';
