import { __ } from '@wordpress/i18n';
import { useWizardStore } from '@/store/reports/useWizardStore';
import { useState, useEffect, useRef } from 'react';
import { useFormContext } from 'react-hook-form';
import Icon from '@/utils/Icon';
import { clsx } from 'clsx';

const DEFAULT_NAME = __( 'Untitled report', 'burst-statistics' );

export const NameInput = () => {
	const reportName = useWizardStore( ( state ) => state.wizard.name );
	const setReportName = useWizardStore( ( state ) => state.setReportName );
	const [ isEditing, setIsEditing ] = useState( false );
	const inputRef = useRef<HTMLInputElement>( null );
	const isFirstRender = useRef( true );

	const {
		register,
		setValue,
		formState: { errors }
	} = useFormContext();

	const displayName = reportName || DEFAULT_NAME;
	const isDefault = ! reportName || reportName === DEFAULT_NAME;

	useEffect( () => {
		register( 'reportName', {
			required: __( 'Report name is required', 'burst-statistics' ),
			value: reportName,
			minLength: {
				value: 3,
				message: __( 'Report name must be at least 3 characters', 'burst-statistics' )
			}
		});
	}, [ register ]); // eslint-disable-line react-hooks/exhaustive-deps

	useEffect( () => {
		if ( isFirstRender.current ) {
			isFirstRender.current = false;
			return;
		}

		setValue( 'reportName', reportName, {
			shouldValidate: !! errors.reportName
		});
	}, [ reportName, setValue ]); // eslint-disable-line react-hooks/exhaustive-deps

	useEffect( () => {
		if ( isEditing && inputRef.current ) {
			inputRef.current.focus();
			inputRef.current.select();
		}
	}, [ isEditing ]);

	const handleClick = () => {
		setIsEditing( true );
	};

	const handleBlur = () => {
		setIsEditing( false );
		if ( ! reportName.trim() ) {
			setReportName( '' );
		}
	};

	const handleKeyDown = ( e: React.KeyboardEvent<HTMLInputElement> ) => {
		if ( 'Enter' === e.key ) {
			e.preventDefault();
			setIsEditing( false );
			if ( ! reportName.trim() ) {
				setReportName( '' );
			}
		}
		if ( 'Escape' === e.key ) {
			setIsEditing( false );
		}
	};

	const handleChange = ( e: React.ChangeEvent<HTMLInputElement> ) => {
		setReportName( e.target.value );
	};

	if ( isEditing ) {
		return (
			<div className="flex flex-col min-w-[150px]">
				<input
					ref={inputRef}
					type="text"
					value={reportName}
					onChange={handleChange}
					onBlur={handleBlur}
					onKeyDown={handleKeyDown}
					className="w-full text-lg font-semibold rounded-md border border-gray-400 p-2 focus:border-primary-dark focus:outline-none focus:ring disabled:cursor-not-allowed disabled:border-gray-200 disabled:bg-gray-200"
					placeholder={__( 'Untitled report', 'burst-statistics' )}
				/>
				{errors.reportName?.message && (
					<span className="text-red text-sm mt-1">
						{errors.reportName.message as string}
					</span>
				)}
			</div>
		);
	}

	return (
		<div className="flex flex-col min-w-[150px] truncate">
			<button
				type="button"
				onClick={handleClick}
				className={clsx(
					'flex items-center gap-2 text-lg font-semibold text-left transition-colors group p-2 border border-transparent rounded-md hover:border-gray-400',
					isDefault ? 'text-gray-500 italic' : 'text-black'
				)}
			>
				<span className="truncate">{displayName}</span>
				<Icon
					name="pencil"
					size={14}
					color={isDefault ? 'gray' : 'black'}
					className="opacity-60 group-hover:opacity-100 transition-opacity"
				/>
			</button>
			{errors.reportName?.message && (
				<span className="text-red text-sm mt-1">
					{errors.reportName.message as string}
				</span>
			)}
		</div>
	);
};
