import React from 'react';
import { __ } from '@wordpress/i18n';
import ButtonInput from '@/components/Inputs/ButtonInput';

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

	/** Settings route the call-to-action button links to. */
	to: string;

	/** Copy shown when the feature toggle is still off. */
	disabled: ActivationState;

	/** Copy shown when the toggle is on but the integration is not connected. */
	disconnected: ActivationState;

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
 * Activation call-to-action card: a short message and a button that routes to
 * the integration's settings tab (where its toggle and connect flow live).
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

	const copy = enabled ? config.disconnected : config.disabled;

	return (
		<div className="mx-auto flex max-w-[240px] flex-col items-stretch gap-3 text-center">
			<p className="text-sm text-text-gray">{ copy.message }</p>
			<ButtonInput
				btnVariant="primary"
				size="md"
				link={{ to: config.to }}
				className="flex w-full justify-center text-center"
			>
				{ copy.cta }
			</ButtonInput>
		</div>
	);
};

export default ActivationCopy;
