import type { ReactNode } from 'react';
import Icon from '@/utils/Icon';

interface InsightCalloutProps {

	/** Insight text or rich content shown next to the bulb icon. */
	children: ReactNode;

	/** Optional extra classes on the wrapper. */
	className?: string;
}

/**
 * Shared callout for conclusion-first insights under charts and diagrams.
 *
 * @param props           - Component properties.
 * @param props.children  - Insight message.
 * @param props.className - Optional wrapper classes.
 * @return Styled insight callout.
 */
export const InsightCallout = ({
	children,
	className = ''
}: InsightCalloutProps ) => (
	<div
		className={`flex items-start gap-3 text-sm leading-relaxed text-text-gray ${ className }`.trim()}
	>
		<Icon
			name="bulb"
			size={20}
			color=""
			className="mt-0.5 shrink-0 text-orange-500"
		/>
		<p className="m-0">{children}</p>
	</div>
);
