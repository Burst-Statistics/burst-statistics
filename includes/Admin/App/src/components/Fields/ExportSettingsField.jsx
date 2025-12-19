import { forwardRef, useState } from 'react';
import { __ } from '@wordpress/i18n';
import { toast } from 'react-toastify';
import FieldWrapper from '@/components/Fields/FieldWrapper';
import ButtonInput from '@/components/Inputs/ButtonInput';
import Icon from '@/utils/Icon';
import useSettingsData from '@/hooks/useSettingsData';

/**
 * Fields that should not be exported (sensitive or site-specific).
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
 * ExportSettingsField component.
 *
 * Generates a JSON file from current settings and triggers download.
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
const ExportSettingsField = forwardRef(
	({ field, fieldState, label, help, context, className, setting, ...props }, ref ) => {
		const { settings } = useSettingsData();
		const [ isExporting, setIsExporting ] = useState( false );
		const inputId = props.id || field.name;

		/**
		 * Generate and download settings as JSON file.
		 */
		const handleExport = () => {
			if ( ! settings || 0 === settings.length ) {
				toast.error( __( 'No settings available to export.', 'burst-statistics' ) );
				return;
			}

			setIsExporting( true );

			try {

				// Build settings object from current values, excluding sensitive fields.
				const exportSettings = {};
				settings.forEach( ( settingField ) => {
					if ( EXCLUDED_FIELDS.includes( settingField.id ) ) {
						return;
					}

					// Only export fields that have a value set.
					if ( 'undefined' !== typeof settingField.value ) {
						exportSettings[ settingField.id ] = settingField.value;
					}
				});

				const exportData = {
					settings: exportSettings
				};

				// Generate JSON with pretty print for readability.
				const jsonContent = JSON.stringify( exportData, null, 2 );
				const blob = new Blob([ jsonContent ], { type: 'application/json' });
				const url = URL.createObjectURL( blob );

				// Create temporary link and trigger download.
				const link = document.createElement( 'a' );
				link.href = url;
				link.download = 'burst-settings.json';
				document.body.appendChild( link );
				link.click();

				// Cleanup.
				document.body.removeChild( link );
				URL.revokeObjectURL( url );

				toast.success( __( 'Settings exported successfully!', 'burst-statistics' ) );
			} catch ( error ) {
				console.error( 'Export error:', error );
				toast.error( __( 'Failed to export settings.', 'burst-statistics' ) );
			} finally {
				setIsExporting( false );
			}
		};

		return (
			<FieldWrapper
				label={label}
				help={help}
				error={fieldState?.error?.message}
				context={context}
				inputId={inputId}
				className={className}
				alignWithLabel={false}
				recommended={props.recommended}
				disabled={props.disabled}
				{...props}
			>
				<ButtonInput
					ref={ref}
					onClick={handleExport}
					disabled={props.disabled || isExporting || ! settings}
					btnVariant="tertiary"
					ariaLabel={setting?.button_text || __( 'Download settings file', 'burst-statistics' )}
				>
					<span className="flex items-center gap-2">
						<Icon name={isExporting ? 'loading' : 'download'} color="black" />
						{isExporting ?
							__( 'Exporting...', 'burst-statistics' ) :
							( setting?.button_text || __( 'Download settings file', 'burst-statistics' ) )}
					</span>
				</ButtonInput>
			</FieldWrapper>
		);
	}
);

ExportSettingsField.displayName = 'ExportSettingsField';

export default ExportSettingsField;

