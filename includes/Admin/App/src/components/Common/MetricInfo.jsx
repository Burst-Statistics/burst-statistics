import { __ } from '@wordpress/i18n';
import { clsx } from 'clsx';
import HelpTooltip from '@/components/Common/HelpTooltip';
import Icon from '@/utils/Icon';
import { METRIC_DEFINITIONS } from '@/components/Common/metricDefinitions';

/**
 * Wraps a metric label so that hovering or focusing the text reveals a
 * metric-explainer tooltip sourced from the shared METRIC_DEFINITIONS config.
 *
 * The wrapped text gets a subtle dashed underline to signal it is hoverable.
 * No separate ⓘ icon is used. When no definition can be resolved the children
 * are rendered untouched, so callers can pass unknown keys safely.
 *
 * Two usage modes:
 *  1. Pass `metricKey` to look up label/definition/whyItMatters/privacyNote/url from config.
 *  2. Pass `definition` (and optionally `label`, `whyItMatters`, `privacyNote`, `url`) directly.
 *
 * @param {Object}            props                - Component props.
 * @param {string}            [props.metricKey]    - Key to look up in METRIC_DEFINITIONS.
 * @param {string}            [props.label]        - Explicit metric title (overrides config).
 * @param {string}            [props.definition]   - Explicit definition string (overrides config).
 * @param {string}            [props.whyItMatters] - Optional "why it matters" sentence.
 * @param {string}            [props.privacyNote]  - Optional privacy / methodology note.
 * @param {string}            [props.url]          - Optional documentation URL; renders a "Learn more" link.
 * @param {string}            [props.side]         - Tooltip position (default: 'top').
 * @param {string}            [props.className]    - Extra classes for the wrapping text.
 * @param {React.ReactNode}   props.children       - The label text to make hoverable.
 * @return {JSX.Element} The wrapped, hoverable label.
 */
const MetricInfo = ({
	metricKey,
	label: labelProp,
	definition: definitionProp,
	whyItMatters: whyItMattersProp,
	privacyNote: privacyNoteProp,
	url: urlProp,
	side = 'top',
	className = '',
	children
}) => {
	const def = metricKey ? METRIC_DEFINITIONS[ metricKey ] : null;

	const label = labelProp ?? def?.label ?? null;
	const definition = definitionProp ?? def?.definition ?? null;
	const whyItMatters = whyItMattersProp ?? def?.whyItMatters ?? null;
	const privacyNote = privacyNoteProp ?? def?.privacyNote ?? null;
	const url = urlProp ?? def?.url ?? null;

	// No definition available: render the label plainly.
	if ( ! definition ) {
		return <>{ children }</>;
	}

	const content = (
		<div className="flex flex-col pb-1">

			{ /* Title: the metric name anchors the card. */ }
			{ label && (
				<span className="text-sm font-semibold leading-snug text-text-black">
					{ label }
				</span>
			) }

			{ /* Definition: the primary answer, in calm body gray. */ }
			<span className="mt-1 text-sm leading-relaxed text-text-black">
				{ definition }
			</span>

			{ /* Why it matters: a hairline-divided, labeled section. */ }
			{ whyItMatters && (
				<div className="mt-3 border-t border-gray-200 pt-3.5">
					<span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-text-black">
						<Icon
							name="bulb"
							size={ 13 }
							color="yellow"
							className="shrink-0"
						/>
						{ __( 'Why it matters', 'burst-statistics' ) }
					</span>
					<p className="mt-1 text-xs leading-relaxed text-text-black">
						{ whyItMatters }
					</p>
				</div>
			) }

			{ /* Privacy: a hairline-divided, labeled trust note. */ }
			{ privacyNote && (
				<div className="mt-3 border-t border-gray-200 pt-3.5">
					<span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-text-black">
						<Icon
							name="shield-check"
							size={ 13 }
							color="green"
							className="shrink-0"
						/>
						{ __( 'Privacy', 'burst-statistics' ) }
					</span>
					<p className="mt-1 text-xs leading-relaxed text-text-black">
						{ privacyNote }
					</p>
				</div>
			) }

			{ /* More info: an optional outbound link to fuller documentation. */ }
			{ url && (
				<div className="mt-3 border-t border-gray-200 pt-3.5">
					<a
						href={ url }
						target="_blank"
						rel="noopener noreferrer"
						className="inline-flex items-center gap-1 text-xs font-semibold text-wp-blue hover:underline"
					>
						{ __( 'Learn more', 'burst-statistics' ) }
						<Icon
							name="external-link"
							size={ 12 }
							className="shrink-0"
						/>
					</a>
				</div>
			) }
		</div>
	);

	return (
		<HelpTooltip
			variant="rich"
			side={ side }
			content={ content }
			asChild
		>
			<span
				className={ clsx(
					'cursor-help underline decoration-dotted decoration-gray-400 decoration-1 underline-offset-[3px] transition-colors hover:decoration-gray-500',
					className
				) }
				tabIndex={ 0 }
				aria-label={ __( 'More information', 'burst-statistics' ) }
			>
				{ children }
			</span>
		</HelpTooltip>
	);
};

export default MetricInfo;
