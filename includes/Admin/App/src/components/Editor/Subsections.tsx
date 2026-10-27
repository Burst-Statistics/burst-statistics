import React from 'react';
import { __ } from '@wordpress/i18n';
import { CollapsibleSection } from './CollapsibleSection';
import { OutgoingLinkItem } from './OutgoingLinkItem';
import type { VisitorFlowData, VisitorFlowFlowNode } from '@/api/getVisitorFlowData';
import type { OutgoingLinkRow } from '@/components/OutgoingLinks/useOutgoingLinksData';
import { FlowTypeIcon } from '@/components/Pages/VisitorFlowDiagram/FlowTypeIcon';
import Icon from '@/utils/Icon';
import { formatNumber } from '@/utils/formatting';
import { safeHref } from '@/utils/safeHref';

export interface SubsectionsProps {
	isPro: boolean;
	visitorFlowData?: VisitorFlowData;
	outgoingLinks?: OutgoingLinkRow[];
	devicesData?: Record<string, { title: string; value: string; count?: number }>;
	isLoadingFlow?: boolean;
	isLoadingLinks?: boolean;
	isLoadingDevices?: boolean;
}

const DEVICE_ICONS: Record<string, string> = {
	desktop: 'desktop',
	tablet: 'tablet',
	mobile: 'mobile',
	other: 'other'
};

interface FlowNodeListProps {
	items: VisitorFlowFlowNode[];
	emptyMessage: string;
}

// fallow-ignore-next-line complexity
const FlowNodeList: React.FC<FlowNodeListProps> = ({ items, emptyMessage }) => {
	if ( 0 === items.length ) {
		return <p className="text-text-gray">{ emptyMessage }</p>;
	}

	return (
		<div className="flex flex-col gap-1.5">
			{ items.map( ( item, idx ) => {
				const href = safeHref( item.url );

				return (
					<div
						key={ `${ item.name }-${ idx }` }
						className="flex items-center justify-between text-xs py-0.5"
					>
						<div className="flex items-center gap-1.5 min-w-0 max-w-[200px]">
							<FlowTypeIcon type={ item.type } size={ 12 } />
							{ href ? (
								<a
									href={ href }
									target="_blank"
									rel="noopener noreferrer"
									className="truncate text-text-black hover:text-green-600 transition-colors inline-flex items-center gap-1 group"
									title={ item.url }
								>
									<span className="truncate group-hover:underline underline-offset-2">
										{ item.name }
									</span>
									<Icon
										name="external-link"
										size={ 10 }
										className="shrink-0 text-gray-400 group-hover:text-green-600 transition-colors"
									/>
								</a>
							) : (
								<span className="truncate text-text-black" title={ item.name }>
									{ item.name }
								</span>
							) }
						</div>
						<span className="font-medium text-text-black shrink-0 ml-2">
							{ formatNumber( item.count ) }
						</span>
					</div>
				);
			}) }
		</div>
	);
};

const LoadingSkeleton: React.FC = () => (
	<div className="flex flex-col gap-1.5 animate-pulse">
		<div className="h-3 w-full rounded bg-gray-100" />
		<div className="h-3 w-4/5 rounded bg-gray-100" />
	</div>
);

/**
 * Renders the collapsed sub-sections:
 * - Where visitors come from (Pro)
 * - Where they go next (Pro)
 * - Outgoing links (Pro)
 * - Devices (Free & Pro)
 *
 * @param props - Component properties.
 * @return Container element rendering sub-sections.
 */
// fallow-ignore-next-line complexity
export const Subsections: React.FC<SubsectionsProps> = ({
	isPro,
	visitorFlowData,
	outgoingLinks = [],
	devicesData,
	isLoadingFlow = false,
	isLoadingLinks = false,
	isLoadingDevices = false
}) => {
	const entries = visitorFlowData?.entries?.slice( 0, 5 ) ?? [];
	const exits = visitorFlowData?.exits?.slice( 0, 5 ) ?? [];
	const links = outgoingLinks.slice( 0, 5 );

	return (
		<div className="flex flex-col">
			{ isPro && (
				<>
					{ /* Where visitors come from */ }
					<CollapsibleSection title={ __( 'Where visitors come from', 'burst-statistics' ) }>
						{ isLoadingFlow ? (
							<LoadingSkeleton />
						) : (
							<FlowNodeList
								items={ entries }
								emptyMessage={ __( 'No entry sources recorded.', 'burst-statistics' ) }
							/>
						) }
					</CollapsibleSection>

					{ /* Where they go next */ }
					<CollapsibleSection title={ __( 'Where they go next', 'burst-statistics' ) }>
						{ isLoadingFlow ? (
							<LoadingSkeleton />
						) : (
							<FlowNodeList
								items={ exits }
								emptyMessage={ __( 'No next pages recorded.', 'burst-statistics' ) }
							/>
						) }
					</CollapsibleSection>

					{ /* Outgoing links */ }
					<CollapsibleSection title={ __( 'Outgoing links', 'burst-statistics' ) }>
						{ isLoadingLinks ? (
							<LoadingSkeleton />
						) : 0 === links.length ? (
							<p className="text-text-gray">
								{ __( 'No outgoing links clicked.', 'burst-statistics' ) }
							</p>
						) : (
							<div className="flex flex-col gap-1.5">
								{ links.map( ( item, idx ) => (
									<OutgoingLinkItem key={ `${ item.url }-${ idx }` } item={ item } />
								) ) }
							</div>
						) }
					</CollapsibleSection>
				</>
			) }

			{ /* Devices (Free & Pro) */ }
			<CollapsibleSection title={ __( 'Devices', 'burst-statistics' ) }>
				{ isLoadingDevices ? (
					<LoadingSkeleton />
				) : ! devicesData || 0 === Object.keys( devicesData ).length ? (
					<p className="text-text-gray">
						{ __( 'No device data recorded.', 'burst-statistics' ) }
					</p>
				) : (
					<div className="flex flex-col gap-1.5">
						{ Object.entries( devicesData ).map( ([ key, item ]) => (
							<div key={ key } className="flex items-center justify-between text-xs py-0.5">
								<div className="flex items-center gap-1.5 min-w-0">
									<Icon
										name={ DEVICE_ICONS[ key ] || 'desktop' }
										size={ 13 }
										className="shrink-0 text-gray-400"
									/>
									<span className="truncate text-text-black">{ item.title }</span>
								</div>
								<span className="font-medium text-text-black shrink-0 ml-2">{ item.value }</span>
							</div>
						) ) }
					</div>
				) }
			</CollapsibleSection>
		</div>
	);
};
