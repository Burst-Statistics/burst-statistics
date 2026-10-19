<?php
/**
 * AI referrer rules.
 *
 * @package Burst
 */

namespace Burst\Admin\Statistics;

defined( 'ABSPATH' ) || die();

/**
 * Single source of truth for what counts as traffic from an AI assistant:
 * the referrer hosts and the UTM values assistants append to outbound links.
 *
 * Used by the Pro source classifier (dashboard channel) and by the shared
 * telemetry collector, so free and Pro report the same definition.
 */
class Ai_Referrer_Rules {

	/**
	 * Referrer hosts of AI assistants and answer engines. Bare hosts also
	 * match their subdomains.
	 */
	public const HOSTS = [
		// Established AI assistants.
		'chat.openai.com',
		'chatgpt.com',
		'perplexity.ai',
		'claude.ai',
		'gemini.google.com',
		'copilot.microsoft.com',
		'bard.google.com',
		// Search-AI hybrids.
		'you.com',
		'phind.com',
		'kagi.com',
		// AI chat / answer engines.
		'poe.com',
		'character.ai',
		'grok.com',
		'mistral.ai',
		'huggingface.co',
		'cohere.com',
		'pi.ai',
		'inflection.ai',
	];

	/**
	 * `utm_source` values assistants append to links. ChatGPT appends
	 * `utm_source=chatgpt.com` to every outbound link it renders.
	 */
	public const UTM_SOURCES = [ 'chatgpt', 'chatgpt.com', 'openai', 'perplexity', 'claude', 'gemini', 'copilot' ];

	/**
	 * `utm_medium` values that mark a link as coming from an AI assistant.
	 */
	public const UTM_MEDIUMS = [ 'ai', 'ai-chat', 'chatbot' ];

	/**
	 * SQL condition matching a referrer host column against the AI hosts.
	 *
	 * @param string $referrer_column Fully qualified referrer host column, e.g. `sessions.referrer`.
	 */
	public static function host_condition_sql( string $referrer_column ): string {
		return Referrer_Host_Sql::build_host_match_sql(
			Referrer_Host_Sql::normalized_host_expression( $referrer_column ),
			self::HOSTS
		);
	}

	/**
	 * SQL condition matching campaign source/medium columns against the AI UTM values.
	 *
	 * @param string $source_column Fully qualified `source` column, e.g. `campaigns.source`.
	 * @param string $medium_column Fully qualified `medium` column, e.g. `campaigns.medium`.
	 */
	public static function utm_condition_sql( string $source_column, string $medium_column ): string {
		$sources = array_map( static fn( string $s ): string => esc_sql( $s ), self::UTM_SOURCES );
		$mediums = array_map( static fn( string $m ): string => esc_sql( $m ), self::UTM_MEDIUMS );

		$conditions = [
			"{$source_column} IN ('" . implode( "', '", $sources ) . "')",
			"{$medium_column} IN ('" . implode( "', '", $mediums ) . "')",
		];

		// Assistants also append their own host as the source
		// (utm_source=perplexity.ai, utm_source=claude.ai), which an exact match
		// against UTM_SOURCES misses. The Pro classifier matches the source
		// against the host list for exactly this reason, so telemetry has to as
		// well — otherwise a visit with such a source and no referrer counts as AI
		// on the dashboard but not in telemetry, and the reported share is low.
		$source_hosts = Referrer_Host_Sql::build_host_match_sql(
			Referrer_Host_Sql::normalized_host_expression( $source_column ),
			self::HOSTS
		);
		if ( '' !== $source_hosts ) {
			$conditions[] = $source_hosts;
		}

		return '(' . implode( ' OR ', $conditions ) . ')';
	}
}
