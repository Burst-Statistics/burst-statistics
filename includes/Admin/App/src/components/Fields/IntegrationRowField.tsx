import { forwardRef, useState } from 'react';
import { useWatch } from 'react-hook-form';
import type { Control } from 'react-hook-form';
import { __, sprintf } from '@wordpress/i18n';
import { clsx } from 'clsx';
import SwitchInput from '@/components/Inputs/SwitchInput';
import Icon from '@/utils/Icon';

interface IntegrationMeta {
	slug: string;
	label: string;
	icon_url: string;
	status: string;
	requires: string | null;
	requires_label: string | null;

	/** Server-side flag: whether the parent integration is currently enabled. */
	parent_enabled: boolean;
}

interface IntegrationRowFieldProps {
	field: {
		name: string;
		value: boolean | number | string;
		onChange: ( value: boolean ) => void;
	};
	fieldState: {
		error?: { message?: string };
	};
	setting: {
		meta?: IntegrationMeta;
		[key: string]: unknown;
	};

	/** Form control passed down by Field.jsx; the settings form has no FormProvider. */
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	control: Control<any>;
	disabled?: boolean;
}

/**
 * A single integration row: plugin icon, label + status line, and a
 * right-aligned enable/disable toggle.
 *
 * When a required parent integration is turned off, this row's toggle is forced
 * off and non-interactive until the parent is re-enabled.
 */
const IntegrationRowField = forwardRef<HTMLButtonElement, IntegrationRowFieldProps>(
	({ field, disabled, setting, control }, ref ) => {
	const meta: IntegrationMeta = ( setting?.meta as IntegrationMeta | undefined ) ?? {
		slug: '',
		label: '',
		icon_url: '',
		status: '',
		requires: null,
		requires_label: null,
		parent_enabled: true
	};

		const [ iconError, setIconError ] = useState( false );

		// Watch the parent integration's live form value to cascade disable.
		// When parentValue is undefined the parent Controller has not registered yet;
		// fall back to the server-computed parent_enabled flag so the initial render
		// already reflects the correct disabled state.
		const parentFieldName = meta.requires ? `enable_integration_${ meta.requires }` : null;
		const parentValue = useWatch({ control, name: parentFieldName ?? '__none__' });
		const parentDisabled = null !== parentFieldName && (
			undefined === parentValue ? ! meta.parent_enabled : ! parentValue
		);

		const isEnabled = ! parentDisabled && Boolean( field.value ) && ! disabled;

		// Translators: %s is the name of the required integration (e.g. "WooCommerce").
		const statusText = (): string => {
			if ( parentDisabled && meta.requires_label ) {
				return sprintf( __( 'Requires the %s integration', 'burst-statistics' ), meta.requires_label );
			}

			if ( ! isEnabled ) {
				return __( 'Disabled — Burst won\'t track events for this plugin', 'burst-statistics' );
			}
			return meta.status;
		};

		const handleToggle = ( checked: boolean ) => {
			if ( parentDisabled || disabled ) {
				return;
			}
			field.onChange( checked );
		};

		return (
			<div
				className={ clsx(
					'w-full px-6 py-4',
					meta.requires && 'pl-12'
				) }
			>
				<div className="flex items-center gap-3">
					{/* Plugin icon with wp.org fallback. */ }
					<div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-md border border-gray-200 bg-gray-50">
						{ ! iconError && meta.icon_url ? (
							<img
								src={ meta.icon_url }
								alt={ meta.label }
								className={ clsx( 'h-full w-full object-cover', ! isEnabled && 'grayscale' ) }
								onError={ () => setIconError( true ) }
							/>
						) : (
							<Icon
								name="plug"
								size={ 18 }
								className={ clsx( ! isEnabled && 'text-text-gray' ) }
							/>
						) }
					</div>

					{/* Label + status line. */ }
					<div className="flex flex-1 flex-col">
						<span className={ clsx( 'text-sm font-medium', ! isEnabled ? 'text-text-gray' : 'text-text-black' ) }>
							{ meta.label }
						</span>
						<span className="text-xs text-text-gray">
							{ statusText() }
						</span>
					</div>

					{/* Enable / disable toggle. */ }
					<SwitchInput
						ref={ ref }
						id={ field.name }
						value={ isEnabled }
						onChange={ handleToggle }
						disabled={ parentDisabled || disabled }
					/>
				</div>
			</div>
		);
	}
);

IntegrationRowField.displayName = 'IntegrationRowField';

export default IntegrationRowField;
