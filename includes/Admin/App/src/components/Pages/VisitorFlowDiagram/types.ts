/**
 * Categories describing the immediate step before the selected page.
 */
export type FlowSourceType =
	| 'campaign'
	| 'referrer'
	| 'search'
	| 'direct'
	| 'internal';

/**
 * Categories describing the immediate step after the selected page.
 */
export type FlowDestinationType = 'internal' | 'converting' | 'exit';

/**
 * Visual categories carried by Sankey nodes.
 */
export type FlowNodeType =
	| FlowSourceType
	| FlowDestinationType
	| 'page'
	| 'other';

/**
 * One immediate preceding-step row.
 */
export interface FlowSourceRow {
	id: string;
	label: string;
	type: FlowSourceType;
	sessions: number;
}

/**
 * One immediate next-step row.
 */
export interface FlowDestinationRow {
	id: string;
	label: string;
	type: FlowDestinationType;
	sessions: number;
}

/**
 * Normalised payload consumed by the visitor-flow Sankey block.
 */
export interface VisitorFlowPayload {
	pagePath: string;
	totalSessions: number;
	sequencedSessions: number;
	sources: FlowSourceRow[];
	destinations: FlowDestinationRow[];
}

/**
 * A ranked item used by tooltips and the accessible text alternative.
 */
export interface RankedFlowItem {
	id: string;
	label: string;
	type: FlowNodeType;
	sessions: number;
	percentage: number;
}

/**
 * Custom node data consumed by Nivo Sankey.
 */
export interface VisitorFlowNode {
	id: string;
	label: string;
	displayLabel: string;
	nodeType: FlowNodeType;
	sessions: number;
	percentage: number;
	side: 'source' | 'page' | 'destination';
}

/**
 * Custom link data consumed by Nivo Sankey.
 */
export interface VisitorFlowLink {
	source: string;
	target: string;
	value: number;
	percentage: number;
	side: 'source' | 'destination';
}

/**
 * Derived Sankey and summary data ready for presentation.
 */
export interface VisitorFlowSankeyData {
	nodes: VisitorFlowNode[];
	links: VisitorFlowLink[];
	sources: RankedFlowItem[];
	destinations: RankedFlowItem[];
	insight: RankedFlowItem | null;
	coveragePercentage: number;
}
