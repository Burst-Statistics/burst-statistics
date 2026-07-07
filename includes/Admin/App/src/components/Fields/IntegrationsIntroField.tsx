import { forwardRef } from 'react';
import { __ } from '@wordpress/i18n';
import { burst_get_website_url } from '@/utils/lib';

interface IntroMeta {
	has_integrations: boolean;
}

interface IntegrationsIntroFieldProps {
	field: {
		name: string;
		value: unknown;
		onChange: ( value: unknown ) => void;
	};
	fieldState: {
		error?: { message?: string };
	};
	setting: {
		meta?: IntroMeta;
		[key: string]: unknown;
	};
}

/**
 * Intro panel for the Integrations settings tab.
 *
 * Shows a short intro line and, when no integrations are detected, an empty-state
 * message with a discovery link. When integrations are present, shows only the intro
 * line and a subtle "View all supported integrations" link.
 */
const IntegrationsIntroField = forwardRef<HTMLDivElement, IntegrationsIntroFieldProps>(
	({ setting }) => {
		const hasIntegrations = setting?.meta?.has_integrations ?? false;
		const integrationsUrl = burst_get_website_url( 'integrations/' );

		if ( ! hasIntegrations ) {
			return (
				<div className="w-full px-6 py-4">
					<p className="mb-1 text-sm text-text-gray">
						{ __(
							'No compatible plugins detected. Burst integrates with WooCommerce, Contact Form 7, Elementor, and more.',
							'burst-statistics'
						) }
					</p>
					<a
						href={ integrationsUrl }
						target="_blank"
						rel="noopener noreferrer"
						className="text-sm text-wp-blue hover:underline"
					>
						{ __( 'View all supported integrations', 'burst-statistics' ) }
					</a>
				</div>
			);
		}

		return (
			<div className="w-full px-6 py-4">
				<p className="text-sm text-text-gray">
					{ __(
						'Burst automatically detects compatible plugins and tracks relevant events. Disable an integration if you don\'t want Burst to interact with it.',
						'burst-statistics'
					) }
				</p>
				<a
					href={ integrationsUrl }
					target="_blank"
					rel="noopener noreferrer"
					className="mt-2 inline-block text-sm text-wp-blue hover:underline"
				>
					{ __( 'View all supported integrations', 'burst-statistics' ) }
				</a>
			</div>
		);
	}
);

IntegrationsIntroField.displayName = 'IntegrationsIntroField';

export default IntegrationsIntroField;
