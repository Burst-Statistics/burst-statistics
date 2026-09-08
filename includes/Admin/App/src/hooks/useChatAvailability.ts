import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { __, sprintf } from '@wordpress/i18n';
import useSettingsData from '@/hooks/useSettingsData';
import { getChatStatus } from '@/utils/api';

type ChatAvailability = {
	enabled?: boolean;
	abilities_enabled?: boolean;
	ai_client_loaded?: boolean;
	has_configured_provider?: boolean;

	/** Pre-formatted connector approval names that still need to be granted. */
	missing_approvals?: string[];
};

// fallow-ignore-next-line complexity
const boolFromSetting = ( value: unknown, fallback = true ): boolean => {
	if ( 'boolean' === typeof value ) {
		return value;
	}
	if ( 'number' === typeof value ) {
		return 1 === value;
	}
	if ( 'string' === typeof value ) {
		if ([ '1', 'true', 'yes', 'on' ].includes( value.toLowerCase() ) ) {
			return true;
		}
		if ([ '0', 'false', 'no', 'off' ].includes( value.toLowerCase() ) ) {
			return false;
		}
	}
	return fallback;
};

// fallow-ignore-next-line complexity
const parseExplicitBooleanSetting = ( value: unknown ): boolean | null => {
	if ( 'boolean' === typeof value ) {
		return value;
	}

	if ( 'number' === typeof value ) {
		if ( 1 === value ) {
			return true;
		}

		if ( 0 === value ) {
			return false;
		}

		return null;
	}

	if ( 'string' === typeof value ) {
		const normalized = value.toLowerCase();
		if ([ '1', 'true', 'yes', 'on' ].includes( normalized ) ) {
			return true;
		}

		if ([ '0', 'false', 'no', 'off' ].includes( normalized ) ) {
			return false;
		}
	}

	return null;
};

// fallow-ignore-next-line complexity
const normalizeChatStatus = ( status: unknown ): ChatAvailability => {
	if ( ! status || 'object' !== typeof status ) {
		return {};
	}

	const typed = status as Record<string, unknown>;
	const hasOwn = ( key: string ): boolean =>
		Object.prototype.hasOwnProperty.call( typed, key );

	const rawMissing = typed.missing_approvals;
	const missingApprovals = Array.isArray( rawMissing ) ?
		rawMissing.filter( ( item ): item is string => 'string' === typeof item && '' !== item ) :
		[];

	return {
		enabled: hasOwn( 'enabled' ) ?
			boolFromSetting( typed.enabled, false ) :
			undefined,
		abilities_enabled: hasOwn( 'abilities_enabled' ) ?
			boolFromSetting( typed.abilities_enabled, true ) :
			undefined,
		ai_client_loaded: hasOwn( 'ai_client_loaded' ) ?
			boolFromSetting( typed.ai_client_loaded, false ) :
			undefined,
		has_configured_provider: hasOwn( 'has_configured_provider' ) ?
			boolFromSetting( typed.has_configured_provider, false ) :
			undefined,
		missing_approvals: missingApprovals
	};
};

/**
 * Availability of the AI chat: whether the button should render at all and,
 * if it renders, whether it is disabled and why. Shared by the trigger button
 * and the lazily loaded modal so the status query is only defined once.
 */
export const useChatAvailability = () => {
	const { getValue } = useSettingsData();

	// Single source of truth for chat status: one cached REST call, deduped,
	// refetched at most once per 60s. The REST endpoint is the only source —
	// PHP does not preload via localize_script.
	const { data: chatStatus = {} as ChatAvailability } = useQuery<ChatAvailability>({
		queryKey: [ 'chat-status' ],
		queryFn: async() => normalizeChatStatus( await getChatStatus() ),
		staleTime: 60_000,
		refetchOnWindowFocus: false
	});

	const explicitAbilitiesSetting = parseExplicitBooleanSetting(
		getValue( 'enable_abilities_api' )
	);
	const abilitiesEnabled =
		null !== explicitAbilitiesSetting ?
		explicitAbilitiesSetting :
		( chatStatus.abilities_enabled ?? false );

	// fallow-ignore-next-line complexity
	const disabledReason = useMemo( () => {
		if ( ! abilitiesEnabled ) {
			return __(
				'Chat is disabled because Abilities API is switched off in Burst settings.',
				'burst-statistics'
			);
		}

		if ( false === chatStatus.ai_client_loaded ) {
			return __(
				'To enable AI chat, please install and configure the WordPress AI plugin.',
				'burst-statistics'
			);
		}

		if ( false === chatStatus.has_configured_provider ) {
			return __(
				'No AI connector is configured. Install the WordPress AI plugin and connect a provider to use chat.',
				'burst-statistics'
			);
		}

		const missingApprovals = chatStatus.missing_approvals ?? [];
		if ( 0 < missingApprovals.length ) {
			return sprintf(

				/* translators: %s is a comma-separated list of approval names (e.g. "Burst, WordPress AI, OpenAI Provider"). */
				__(
					'To enable AI chat, please go to Tools > Connector Approvals and approve the following: %s.',
					'burst-statistics'
				),
				missingApprovals.join( ', ' )
			);
		}

		if ( false === chatStatus.enabled ) {
			return __( 'Chat is currently unavailable.', 'burst-statistics' );
		}

		return '';
	}, [ abilitiesEnabled, chatStatus ]);

	return {
		abilitiesEnabled,
		disabledReason,
		isDisabled: Boolean( disabledReason )
	};
};
