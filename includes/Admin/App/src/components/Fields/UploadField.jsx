import { forwardRef, useEffect, useState, useRef } from 'react';
import { __ } from '@wordpress/i18n';
import FieldWrapper from '@/components/Fields/FieldWrapper';
import Icon from '@/utils/Icon';
import { toast } from 'react-toastify';
import useSettingsData from '@/hooks/useSettingsData';
import ButtonInput from '@/components/Inputs/ButtonInput';
import { clsx } from 'clsx';

/**
 * Fields that should not be imported (sensitive or site-specific).
 */
const EXCLUDED_FIELDS = [
	'email_reports_mailinglist',
	'burst_tour_shown_once',
	'license',
	'review_notice_shown',
	'burst_update_to_city_geo_database_time',
	'filtering_by_domain',
	'goals',
	'import_settings',
	'export_settings'
];

/**
 * UploadField component.
 *
 * Handles importing settings from a JSON file by:
 * 1. Reading the JSON file on the frontend.
 * 2. Resetting all settings to their defaults.
 * 3. Applying the imported settings.
 * 4. Saving via the existing saveSettings mechanism.
 *
 * @param {Object} field      - Provided by react-hook-form's Controller.
 * @param {Object} fieldState - Contains validation state.
 * @param {string} label      - Field label.
 * @param {string} help       - Help text.
 * @param {string} context    - Contextual information.
 * @param {string} className  - Additional CSS classes.
 * @param {Object} props      - Additional props.
 * @return {JSX.Element}
 */
	const UploadField = forwardRef(
	({ field, fieldState, label, help, context, className, ...props }) => {
		const { settings, saveSettings, isSavingSettings } = useSettingsData();
		const [ file, setFile ] = useState( false );
		const [ disabled, setDisabled ] = useState( true );
		const [ importing, setImporting ] = useState( false );
		const [ importStatus, setImportStatus ] = useState( null ); // 'success' | 'error' | null.
		const [ importMessage, setImportMessage ] = useState( '' );
		const fileInputRef = useRef( null );

		useEffect( () => {
			if ( ! file ) {
				setDisabled( true );
				setImportStatus( null );
				setImportMessage( '' );
				return;
			}

			// Reset status when file changes.
			setImportStatus( null );
			setImportMessage( '' );

			// Validate file type.
			if ( 'application/json' !== file.type && ! file.name.endsWith( '.json' ) ) {
				setDisabled( true );
				setImportStatus( 'error' );
				setImportMessage( __( 'You can only upload .json files!', 'burst-statistics' ) );
				toast.error( __( 'You can only upload .json files!', 'burst-statistics' ) );
			} else {
				setDisabled( false );
			}
		}, [ file ]);

		/**
		 * Read file content using FileReader.
		 *
		 * @param {File} fileToRead - The file to read.
		 * @return {Promise<string>} The file content.
		 */
		const readFileContent = ( fileToRead ) => {
			return new Promise( ( resolve, reject ) => {
				const reader = new FileReader();
				reader.onload = ( e ) => resolve( e.target.result );
				reader.onerror = () => reject( new Error( __( 'Failed to read the file.', 'burst-statistics' ) ) );
				reader.readAsText( fileToRead );
			});
		};

		/**
		 * Parse and validate JSON content.
		 *
		 * @param {string} content - The JSON string to parse.
		 * @return {Object} Parsed data with settings.
		 * @throws {Error} If JSON is invalid or missing settings.
		 */
		const parseAndValidateJson = ( content ) => {
			let data;
			try {
				data = JSON.parse( content );
			} catch {
				throw new Error( __( 'The JSON file is malformed or invalid.', 'burst-statistics' ) );
			}

			if ( ! data || ! data.settings || 'object' !== typeof data.settings ) {
				throw new Error( __( 'The file does not contain valid settings data.', 'burst-statistics' ) );
			}

			return data;
		};

		/**
		 * Build the settings object with defaults reset and imported values applied.
		 *
		 * @param {Object} importedSettings - The settings from the imported file.
		 * @return {Object} The merged settings object ready for saving.
		 */
		const buildSettingsForSave = ( importedSettings ) => {
			if ( ! settings ) {
				throw new Error( __( 'Settings not loaded. Please refresh the page.', 'burst-statistics' ) );
			}

			const settingsToSave = {};

			// First, reset all fields to their defaults (excluding protected fields).
			settings.forEach( ( settingField ) => {
				if ( EXCLUDED_FIELDS.includes( settingField.id ) ) {
					return;
				}

				// Use the default value from the field configuration.
				settingsToSave[ settingField.id ] = settingField.default;
			});

			// Then, apply imported settings (only for fields that exist in our configuration).
			const validFieldIds = settings.map( ( s ) => s.id );
			Object.entries( importedSettings ).forEach( ([ fieldId, value ]) => {
				if ( EXCLUDED_FIELDS.includes( fieldId ) ) {
					return;
				}
				if ( ! validFieldIds.includes( fieldId ) ) {
					return;
				}
				settingsToSave[ fieldId ] = value;
			});

			return settingsToSave;
		};

		/**
		 * Handle the import process.
		 */
		const handleImport = async() => {
			if ( ! file ) {
				return;
			}

			setDisabled( true );
			setImporting( true );
			setImportStatus( null );
			setImportMessage( '' );

			try {

				// Step 1: Read the file.
				const content = await readFileContent( file );

				// Step 2: Parse and validate JSON.
				const data = parseAndValidateJson( content );

				// Step 3: Build settings with defaults + imported values.
				const settingsToSave = buildSettingsForSave( data.settings );

				// Step 4: Save settings using the existing mechanism.
				await saveSettings( settingsToSave );

				setImportStatus( 'success' );
				setImportMessage( __( 'Settings imported successfully!', 'burst-statistics' ) );

				// Clear file after successful import.
				setFile( false );
				if ( fileInputRef.current ) {
					fileInputRef.current.value = '';
				}
			} catch ( error ) {
				const errorMessage = error.message || __( 'An unexpected error occurred while importing settings.', 'burst-statistics' );
				setImportStatus( 'error' );
				setImportMessage( errorMessage );
				toast.error( errorMessage );
			} finally {
				setImporting( false );
				setDisabled( false );
			}
		};

		const inputId = props.id || field.name;

		const handleFileSelect = ( event ) => {
			const selectedFile = event.target.files[ 0 ];
			if ( selectedFile ) {
				setFile( selectedFile );
			}
		};

		const handleSelectFileClick = () => {
			fileInputRef.current?.click();
		};

		const handleClearFile = () => {
			setFile( false );
			setImportStatus( null );
			setImportMessage( '' );
			if ( fileInputRef.current ) {
				fileInputRef.current.value = '';
			}
		};

		// Combine fieldState error with import error.
		const displayError = 'error' === importStatus ? importMessage : fieldState?.error?.message;
		const isProcessing = importing || isSavingSettings;

		return (
			<FieldWrapper
				label={label}
				help={help}
				error={displayError}
				warning={'success' === importStatus ? null : undefined}
				context={context}
				className={className}
				inputId={inputId}
				required={props.required}
				recommended={props.recommended}
				disabled={props.disabled}
				{...props}
			>
				<div className="flex flex-col gap-3 w-full">
					{/* Selected file display with clear button. */}
					{file && (
						<div className={clsx(
							'flex items-center gap-2 px-3 py-2 rounded border',
							'success' === importStatus && 'bg-green-50 border-green-200',
							'error' === importStatus && 'bg-red-50 border-red-200',
							! importStatus && 'bg-gray-50 border-gray-200'
						)}>
							<Icon
								name="file"
								color={'success' === importStatus ? 'green' : 'error' === importStatus ? 'red' : 'gray'}
							/>
							<span className={clsx(
								'flex-1 text-sm font-medium',
								'success' === importStatus && 'text-green-700',
								'error' === importStatus && 'text-red-700',
								! importStatus && 'text-gray-700'
							)}>
								{file.name}
							</span>
							{! isProcessing && (
								<button
									type="button"
									onClick={handleClearFile}
									className="p-1 rounded hover:bg-gray-200 transition-colors"
									aria-label={__( 'Clear file selection', 'burst-statistics' )}
									title={__( 'Clear file selection', 'burst-statistics' )}
								>
									<Icon name="times" size={16} color="gray" />
								</button>
							)}
						</div>
					)}

					{/* File selection and import buttons grouped together. */}
					<div className="flex items-center gap-2 w-full">
						<input
							ref={fileInputRef}
							type="file"
							accept=".json,application/json"
							onChange={handleFileSelect}
							className="hidden"
							id={`${inputId}-file-input`}
							aria-label={__( 'Upload settings file (.json)', 'burst-statistics' )}
						/>
						<ButtonInput
							btnVariant="tertiary"
							onClick={handleSelectFileClick}
							disabled={props.disabled || isProcessing}
							ariaLabel={__( 'Upload settings file (.json)', 'burst-statistics' )}
						>
							<span className="flex items-center gap-2">
								<Icon name="upload" color="black" />
								{__( 'Upload settings file (.json)', 'burst-statistics' )}
							</span>
						</ButtonInput>
						<ButtonInput
							btnVariant="secondary"
							disabled={disabled || isProcessing || ! file}
							onClick={handleImport}
						>
							{isProcessing ? (
								<span className="flex items-center gap-2">
									<Icon name="loading" color="white" />
									{__( 'Importing...', 'burst-statistics' )}
								</span>
							) : (
								__( 'Import', 'burst-statistics' )
							)}
						</ButtonInput>
					</div>

				</div>
			</FieldWrapper>
		);
	}
);

UploadField.displayName = 'UploadField';

export default UploadField;
