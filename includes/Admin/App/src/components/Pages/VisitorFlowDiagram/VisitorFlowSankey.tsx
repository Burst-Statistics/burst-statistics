import {
	useEffect,
	useMemo,
	useRef,
	useState
} from 'react';
import { __, sprintf } from '@wordpress/i18n';
import {
	ResponsiveSankey,
	type SankeyLinkDatum,
	type SankeyNodeDatum
} from '@nivo/sankey';
import { ChartTooltip } from '@/components/Common/ChartTooltip';
import { useTheme } from '@/hooks/useTheme';
import {
	formatNumber,
	formatPercentage,
	truncateMiddle
} from '@/utils/formatting';
import { buildSankeyData } from './buildSankeyData';
import { FlowSankeyLabel } from './FlowSankeyLabel';
import { FlowTypeIcon } from './FlowTypeIcon';
import { getFlowColors, getFlowTypeLabel } from './flowColors';
import type {
	FlowNodeType,
	VisitorFlowLink,
	VisitorFlowNode,
	VisitorFlowPayload
} from './types';

const NARROW_WIDTH = 520;
const DEFAULT_CONTAINER_WIDTH = 720;

interface VisitorFlowSankeyProps {
	payload: VisitorFlowPayload;
}

interface TooltipMetricProps {
	label: string;
	type: VisitorFlowNode['nodeType'];
	sessions: number;
	percentage: number;
}

/**
 * Renders the shared contents of node and link tooltips.
 *
 * @param props            - Tooltip metric properties.
 * @param props.label      - Flow step label.
 * @param props.type       - Flow category.
 * @param props.sessions   - Exact rounded session count.
 * @param props.percentage - Percentage of the relevant side.
 * @return Styled tooltip metric.
 */
const TooltipMetric = ({
	label,
	type,
	sessions,
	percentage
}: TooltipMetricProps ) => (
	<ChartTooltip>
		<p className="m-0 font-semibold text-text-black">{label}</p>
		<div className="mt-1 flex items-center gap-1.5 text-text-gray">
			<FlowTypeIcon type={type} size={12} />
			<span>{getFlowTypeLabel( type )}</span>
		</div>
		<p className="m-0 mt-1 text-text-black">
			{formatNumber( sessions, 0, false )}{' '}
			{__( 'sessions', 'burst-statistics' )}{' '}
			<span className="text-text-gray">
				({formatPercentage( percentage, 0 )})
			</span>
		</p>
	</ChartTooltip>
);

/**
 * Renders a tooltip for a Sankey node.
 *
 * @param props      - Nivo node tooltip properties.
 * @param props.node - Hovered node.
 * @return Visitor-flow node tooltip.
 */
const NodeTooltip = ({
	node
}: {
	node: SankeyNodeDatum<VisitorFlowNode, VisitorFlowLink>;
}) => (
	<TooltipMetric
		label={node.label}
		type={node.nodeType}
		sessions={node.sessions}
		percentage={node.percentage}
	/>
);

/**
 * Renders a tooltip for a Sankey ribbon.
 *
 * @param props      - Nivo link tooltip properties.
 * @param props.link - Hovered link.
 * @return Visitor-flow link tooltip.
 */
const LinkTooltip = ({
	link
}: {
	link: SankeyLinkDatum<VisitorFlowNode, VisitorFlowLink>;
}) => {
	const categoryNode =
		'source' === link.side ? link.source : link.target;

	return (
		<TooltipMetric
			label={`${ link.source.label } → ${ link.target.label }`}
			type={categoryNode.nodeType}
			sessions={link.value}
			percentage={link.percentage}
		/>
	);
};

/**
 * Renders the responsive Nivo visitor-flow diagram and its text alternative.
 *
 * @param props         - Component properties.
 * @param props.payload - Mock visitor-flow payload.
 * @return Responsive Sankey with ranked accessible lists.
 */
// fallow-ignore-next-line complexity
export const VisitorFlowSankey = ({
	payload
}: VisitorFlowSankeyProps ) => {
	const { isDarkTheme } = useTheme();
	const flowColors = getFlowColors();
	const labelColor = 'var(--color-text-black)';

	const containerRef = useRef<HTMLDivElement>( null );
	const [ containerWidth, setContainerWidth ] = useState(
		DEFAULT_CONTAINER_WIDTH
	);
	const isNarrow = containerWidth < NARROW_WIDTH;
	const sankeyData = useMemo(
		() => buildSankeyData( payload, isNarrow ? 3 : 4 ),
		[ payload, isNarrow ]
	);
	const labelLength = isNarrow ? 14 : 16;
	const horizontalMargin = isNarrow ? 128 : 144;
	const ariaLabel = sprintf(

		/* translators: %s: selected page path. */
		__(
			'Visitor flow showing the immediate steps before and after %s.',
			'burst-statistics'
		),
		payload.pagePath
	);

	useEffect( () => {
		const container = containerRef.current;
		if ( ! container ) {
			return;
		}

		const observer = new ResizeObserver( ( entries ) => {
			const width = entries[0]?.contentRect.width;
			if ( width ) {
				setContainerWidth( width );
			}
		});

		observer.observe( container );
		return () => observer.disconnect();
	}, []);

	return (
		<div ref={containerRef} className="w-full overflow-x-auto md:overflow-x-visible overflow-y-visible pb-1">
			<div
				className="h-[360px] w-full min-w-[640px] md:min-w-full"
				role="img"
				aria-label={ariaLabel}
			>
				<ResponsiveSankey<VisitorFlowNode, VisitorFlowLink>
					data={{
						nodes: sankeyData.nodes,
						links: sankeyData.links
					}}
					layout="horizontal"
					align="justify"
					sort="input"
					margin={{
						top: 16,
						right: horizontalMargin,
						bottom: 16,
						left: horizontalMargin
					}}
					// eslint-disable-next-line @typescript-eslint/no-explicit-any
					colors={( node: any ) => flowColors[ node.nodeType as FlowNodeType ] || flowColors.other}
					nodeThickness={14}
					nodeSpacing={12}
					nodeBorderRadius={2}
					nodeBorderWidth={0}
					nodeOpacity={1}
					nodeHoverOpacity={1}
					nodeHoverOthersOpacity={0.35}
					linkOpacity={isDarkTheme ? 0.5 : 0.4}
					linkHoverOpacity={isDarkTheme ? 0.85 : 0.75}
					linkHoverOthersOpacity={0.12}
					enableLinkGradient={true}
					// eslint-disable-next-line @typescript-eslint/no-explicit-any
					label={( node: any ) =>
						truncateMiddle(
							node.displayLabel,
							labelLength
						)
					}
					labelPosition="outside"
					labelPadding={10}
					labelTextColor={labelColor}
					labelComponent={FlowSankeyLabel}
					valueFormat={( value: number ) => formatNumber( value, 0, false )}
					nodeTooltip={NodeTooltip}
					linkTooltip={LinkTooltip}
					animate={false}
					theme={{
						labels: {
							text: {
								fontSize: 12,
								fontWeight: 600,
								fill: labelColor
							}
						}
					}}
				/>
			</div>

			<section className="sr-only" aria-label={ariaLabel}>
				<h3>{__( 'Where visitors came from', 'burst-statistics' )}</h3>
				<ol>
					{sankeyData.sources.map( ( source ) => (
						<li key={source.id}>
							{source.label}, {getFlowTypeLabel( source.type )},{' '}
							{formatNumber( source.sessions, 0, false )}{' '}
							{__( 'sessions', 'burst-statistics' )},{' '}
							{formatPercentage( source.percentage, 0 )}
						</li>
					) )}
				</ol>
				<h3>{__( 'Where visitors went next', 'burst-statistics' )}</h3>
				<ol>
					{sankeyData.destinations.map( ( destination ) => (
						<li key={destination.id}>
							{destination.label},{' '}
							{getFlowTypeLabel( destination.type )},{' '}
							{formatNumber( destination.sessions, 0, false )}{' '}
							{__( 'sessions', 'burst-statistics' )},{' '}
							{formatPercentage( destination.percentage, 0 )}
						</li>
					) )}
				</ol>
			</section>
		</div>
	);
};
