import Icon from '@/utils/Icon';
import { FLOW_COLORS, getFlowIcon } from './flowColors';
import type { FlowNodeType } from './types';

interface FlowTypeIconProps {

	/** Flow category that determines the icon glyph. */
	type: FlowNodeType;

	/** Icon size in pixels. */
	size?: number;

	/** Optional extra classes on the icon. */
	className?: string;
}

/**
 * Renders the category icon for a visitor-flow node type in its token color.
 *
 * @param props           - Component properties.
 * @param props.type      - Flow category.
 * @param props.size      - Icon size in pixels.
 * @param props.className - Optional extra classes.
 * @return Colored category icon.
 */
export const FlowTypeIcon = ({
	type,
	size = 12,
	className = ''
}: FlowTypeIconProps ) => {
	const color = FLOW_COLORS[type] || FLOW_COLORS.other;

	return (
		<Icon
			name={getFlowIcon( type )}
			size={size}
			strokeWidth={2}
			color=""
			className={`shrink-0 ${ className }`.trim()}
			style={{ color }}
		/>
	);
};
