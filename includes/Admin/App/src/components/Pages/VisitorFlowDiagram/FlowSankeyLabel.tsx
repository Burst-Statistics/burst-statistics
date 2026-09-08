import type { TextProps } from '@nivo/text';
import type { SankeyNodeDatum } from '@nivo/sankey';
import { animated } from '@react-spring/web';
import { FlowTypeIcon } from './FlowTypeIcon';
import type { VisitorFlowLink, VisitorFlowNode } from './types';

const LABEL_WIDTH = 168;
const LABEL_HEIGHT = 18;

type FlowSankeyLabelProps = TextProps & {
	node: SankeyNodeDatum<VisitorFlowNode, VisitorFlowLink>;
};

/**
 * Renders a Sankey outside-label with a category icon for faster scanning.
 *
 * @param props            - Nivo label component properties.
 * @param props.node       - Sankey node carrying flow metadata.
 * @param props.children   - Truncated label text from Nivo.
 * @param props.textAnchor - Horizontal alignment relative to the node.
 * @param props.transform  - Animated SVG transform from Nivo.
 * @return Icon + text label group.
 */
export const FlowSankeyLabel = ({
	node,
	children,
	textAnchor,
	transform
}: FlowSankeyLabelProps ) => {
	const isEnd = 'end' === textAnchor;

	return (
		<animated.g
			transform={transform}
			style={{ pointerEvents: 'none' }}
		>
			<foreignObject
				x={isEnd ? -LABEL_WIDTH : 0}
				y={-LABEL_HEIGHT / 2}
				width={LABEL_WIDTH}
				height={LABEL_HEIGHT}
			>
				{/*
				 * HTML inside SVG foreignObject; xmlns omitted because React's
				 * div typings reject it and HTML documents treat this as HTML.
				 */}
				<div
					className={`flex h-full items-center gap-1 overflow-hidden text-xs font-semibold leading-none text-text-black ${
						isEnd ? 'justify-end' : 'justify-start'
					}`}
				>
					<FlowTypeIcon type={node.nodeType} size={12} />
					<span className="truncate">{children}</span>
				</div>
			</foreignObject>
		</animated.g>
	);
};
