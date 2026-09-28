import React from 'react';
import { __ } from '@wordpress/i18n';
import ButtonInput from '@/components/Inputs/ButtonInput';
import useSettingsData from '@/hooks/useSettingsData';

interface ActivationCopyProps {

	/** Integration key, must exist in `activationConfigs`. */
	type: string;

	/**
	 * Whether the integration's feature toggle is already enabled. When true the
	 * user only needs to connect; when false the toggle still has to be enabled.
	 */
	enabled?: boolean;
}

interface ActivationState {
	message: string;
	cta: string;
}

interface ActivationConfig {

	/**
	 * Settings route the call-to-action button links to. Used when enabling
	 * needs more than a toggle (e.g. a connect flow). Ignored when `field` is set.
	 */
	to?: string;

	/**
	 * Settings field the call-to-action button switches on in place, through
	 * the regular fields/set endpoint. The gated block reads the same field,
	 * so it loads its data as soon as the save lands.
	 */
	field?: string;

	/** Copy shown when the feature toggle is still off. */
	disabled: ActivationState;

	/**
	 * Copy shown when the toggle is on but the integration is not connected.
	 * Only needed for integrations with a connect step.
	 */
	disconnected?: ActivationState;

	/**
	 * Copy shown to users without the manage capability. They cannot open the
	 * settings route, so no call-to-action button is rendered.
	 */
	viewer: string;
}

/**
 * Copy per integration for the activation prompt. Single source of truth so a
 * new gated integration only adds an entry here. Mirrors `upsellConfigs` in
 * UpsellCopy, but for "enable/connect this integration" instead of "upgrade".
 */
const activationConfigs: Record<string, ActivationConfig> = {
	search_console: {
		to: '/settings/integrations',
		disabled: {
			message: __( 'To view your Google searches, enable the Search Console integration.', 'burst-statistics' ),
			cta: __( 'Enable Search Console', 'burst-statistics' )
		},
		disconnected: {
			message: __( 'To view your Google searches, connect the Search Console integration.', 'burst-statistics' ),
			cta: __( 'Connect Search Console', 'burst-statistics' )
		},
		viewer: __( 'Ask an administrator to connect Google Search Console to see your Google searches here.', 'burst-statistics' )
	},
	outgoing_links: {
		field: 'track_external_links',
		disabled: {
			message: __( 'To see which outgoing links visitors click, enable outgoing link tracking.', 'burst-statistics' ),
			cta: __( 'Enable', 'burst-statistics' )
		},
		viewer: __( 'Ask an administrator to enable outgoing link tracking to see clicked links here.', 'burst-statistics' )
	}
};

/**
 * Whether the current user may open the settings route the call-to-action
 * links to. Viewers (view_burst_statistics only) have no settings menu, so
 * routing them there would end in the "Page not found" state.
 */
const userCanManage = (): boolean =>
	Boolean( window.burst_settings?.manage_burst_statistics );

/**
 * Picks the copy for the current state: the "connect" copy once the toggle is
 * on and the integration has a connect step, otherwise the "enable" copy.
 *
 * @param {ActivationConfig} config  - The integration's activation config.
 * @param {boolean}          enabled - Whether the feature toggle is already on.
 * @return {ActivationState} The message and call-to-action label to show.
 */
const getActivationState = ( config: ActivationConfig, enabled: boolean ): ActivationState =>
	( enabled && config.disconnected ) || config.disabled;

/**
 * Builds the call-to-action button props: an in-place save of the settings
 * field when the config has one, otherwise a link to the settings route.
 *
 * @param {ActivationConfig} config     - The integration's activation config.
 * @param {Function}         enableField - Saves the given settings field as enabled.
 * @param {boolean}          isSaving    - Whether a settings save is in progress.
 * @return {Object} Props spread onto the ButtonInput.
 */
const getButtonAction = (
	config: ActivationConfig,
	enableField: ( field: string ) => void,
	isSaving: boolean
) => {
	const { field } = config;
	if ( field ) {
		return { onClick: () => enableField( field ), disabled: isSaving };
	}

	return { link: { to: config.to ?? '/settings' } };
};

/**
 * Activation call-to-action card: a short message and a button that either
 * switches the feature's settings field on in place (`field`), or routes to
 * the integration's settings tab where its toggle and connect flow live (`to`).
 * Users without the manage capability get a message only, since they cannot
 * open that tab. Meant to be dropped inside an OverlayBlock, alongside UpsellCopy.
 *
 * @param {ActivationCopyProps} props - Component props.
 * @return {JSX.Element|null} The activation card, or null for an unknown type.
 */
const ActivationCopy: React.FC<ActivationCopyProps> = ({
	type,
	enabled = false
}) => {
	const { saveSettings, isSavingSettings } = useSettingsData();
	const config = activationConfigs[ type ];
	if ( ! config ) {
		return null;
	}

	if ( ! userCanManage() ) {
		return (
			<div className="mx-auto flex max-w-[240px] flex-col items-stretch gap-3 text-center">
				<p className="text-sm text-text-gray">{ config.viewer }</p>
			</div>
		);
	}

	const copy = getActivationState( config, enabled );
	const buttonAction = getButtonAction(
		config,
		( field ) => void saveSettings({ [ field ]: true }),
		isSavingSettings
	);

	return (
		<div className="mx-auto flex max-w-[240px] flex-col items-stretch gap-3 text-center">
			<p className="text-sm text-text-gray">{ copy.message }</p>
			<ButtonInput
				btnVariant="primary"
				size="md"
				{ ...buttonAction }
				className="flex w-full justify-center text-center"
			>
				{ copy.cta }
			</ButtonInput>
		</div>
	);
};

export default ActivationCopy;
