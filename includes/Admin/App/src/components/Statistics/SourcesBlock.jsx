import { useMemo, useState } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import { useQuery } from '@tanstack/react-query';
import { ResponsivePie } from '@nivo/pie';
import { Block } from '@/components/Blocks/Block';
import { BlockHeading } from '@/components/Blocks/BlockHeading';
import { BlockContent } from '@/components/Blocks/BlockContent';
import { BlockFooter } from '@/components/Blocks/BlockFooter';
import ButtonInput from '@/components/Inputs/ButtonInput';
import Modal from '@/components/Common/Modal';
import DataTableBlock from '@/components/Statistics/DataTableBlock';
import { useBlockConfig } from '@/hooks/useBlockConfig';
import useLicenseData from '@/hooks/useLicenseData';
import { burst_get_website_url } from '@/utils/lib';
import { formatNumber, formatPercentage } from '@/utils/formatting';
import {
	getSourcesCategoryData,
	getSourcesDrilldownData,
	getTopSourcesData
} from '@/api/getSourcesData';

const SOURCE_CATEGORY_COLORS = {
	search: 'var(--color-blue-500)',
	social: 'var(--color-yellow-500)',
	direct: 'var(--color-gray-500)',
	ai: 'var(--color-primary-500)',
	campaigns: 'var(--color-orange-500)',
	other: 'var(--color-gray-300)'
};

/**
 * Render simple category legend.
 *
 * @param {Object} props              - Component props.
 * @param {Array}  props.categories   - Source categories.
 * @param {string} props.activeId     - Selected category id.
 * @param {Function} props.onSelect   - Category click callback.
 * @return {JSX.Element} Category legend.
 */
const SourcesLegend = ({ categories, activeId, onSelect }) => {
	return (
		<div className="flex flex-col gap-1.5 px-2">
			{ categories.map( ( item ) => (
				<button
					key={ item.id }
					type="button"
					onClick={() => onSelect( item.id )}
					className={`flex w-full items-center justify-between rounded-sm px-2 py-1 text-xs transition-colors ${
						activeId === item.id ?
							'bg-gray-100 text-text-black' :
							'text-text-gray hover:bg-gray-100 hover:text-text-black'
					}`}
					aria-pressed={ activeId === item.id }
				>
					<span className="flex items-center gap-1.5">
						<span
							className="inline-block h-2.5 w-2.5 rounded-full"
							style={{ backgroundColor: SOURCE_CATEGORY_COLORS[item.id] }}
						/>
						<span>{ item.label }</span>
					</span>
					<span className="font-medium text-text-black">{ formatPercentage( item.value ) }</span>
				</button>
			) ) }
		</div>
	);
};

/**
 * Render top sources list.
 *
 * @param {Object}  props           - Component props.
 * @param {Array}   props.rows      - Top sources rows.
 * @param {boolean} props.isLoading - Loading state.
 * @return {JSX.Element} Top sources list.
 */
const TopSourcesList = ({ rows, isLoading }) => {
	return (
		<div className="border-t border-gray-200 px-6 py-4">
			<p className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-gray">
				{ __( 'Top sources', 'burst-statistics' )}
			</p>
			{ isLoading && (
				<div className="space-y-2">
					{ [ 1, 2, 3 ].map( ( row ) => (
						<div key={row} className="h-7 animate-pulse rounded bg-gray-200" />
					) ) }
				</div>
			) }
			{ ! isLoading && 0 === rows.length && (
				<p className="text-sm text-text-gray">
					{ __( 'No top source data for this period.', 'burst-statistics' )}
				</p>
			) }
			{ ! isLoading && 0 < rows.length && (
				<ul className="space-y-1.5">
					{ rows.map( ( row ) => (
						<li key={row.id} className="flex items-center justify-between text-sm">
							<span className="text-text-black">{ row.source }</span>
							<span className="text-text-gray">
								{ formatPercentage( row.percentage ) }
							</span>
						</li>
					) ) }
				</ul>
			) }
		</div>
	);
};

/**
 * Render source drill-down list for one category.
 *
 * @param {Object}   props              - Component props.
 * @param {string}   props.categoryId   - Active category id.
 * @param {string}   props.categoryName - Active category label.
 * @param {Function} props.onBack       - Back button callback.
 * @param {Array}    props.rows         - Drill-down source rows.
 * @param {boolean}  props.isLoading    - Loading state.
 * @return {JSX.Element} Drill-down list.
 */
const SourcesDrilldown = ({
	categoryId,
	categoryName,
	onBack,
	rows,
	isLoading
}) => {
	return (
		<div className="px-6 py-4">
			<div className="mb-4 flex items-center justify-between">
				<div>
					<p className="text-sm text-text-gray">
						{ __( 'Traffic sources for', 'burst-statistics' ) }{' '}
						<span className="font-semibold text-text-black">{ categoryName }</span>
					</p>
				</div>
				<ButtonInput btnVariant="tertiary" size="sm" onClick={onBack}>
					{ __( 'Back', 'burst-statistics' )}
				</ButtonInput>
			</div>

			{ isLoading && (
				<div className="space-y-2">
					{ [ 1, 2, 3, 4 ].map( ( row ) => (
						<div key={row} className="h-9 animate-pulse rounded-md bg-gray-200" />
					) ) }
				</div>
			) }

			{ ! isLoading && 0 === rows.length && (
				<p className="text-sm text-text-gray">
					{ __( 'No source details found for this category.', 'burst-statistics' )}
				</p>
			) }

			{ ! isLoading && 0 < rows.length && (
				<ul className="space-y-2">
					{ rows.map( ( row ) => (
						<li
							key={`${categoryId}-${row.source}`}
							className="flex items-center justify-between rounded-md border border-gray-200 bg-gray-100 px-3 py-2"
						>
							<p className="text-sm font-medium text-text-black">{ row.source }</p>
							<div className="text-right">
								<p className="text-sm text-text-black">{ formatNumber( row.visits ) }</p>
								<p className="text-xs text-text-gray">{ formatPercentage( row.percentage ) }</p>
							</div>
						</li>
					) ) }
				</ul>
			) }
		</div>
	);
};

/**
 * Render free-tier upsell after category click.
 *
 * @param {Object}   props                  - Component props.
 * @param {string}   props.selectedCategory - Clicked category label.
 * @param {Function} props.onBack           - Back button callback.
 * @return {JSX.Element} Upsell panel.
 */
const SourcesUpsell = ({ selectedCategory, onBack }) => {
	const pricingUrl = burst_get_website_url( 'pricing', {
		utm_source: 'plugin',
		utm_medium: 'sources-category-drilldown'
	});

	return (
		<div className="mx-6 my-4 rounded-md border border-gray-200 bg-gray-100 p-4">
			<p className="text-sm font-medium text-text-black">
				{ __( 'Want to drill down by source?', 'burst-statistics' )}
			</p>
			<p className="mt-1 text-sm text-text-gray">
				{ __(
					'Upgrade to Burst Pro to view detailed source breakdowns per traffic category.',
					'burst-statistics'
				) }
			</p>
			<p className="mt-1 text-xs text-text-gray">
				{ __( 'Clicked category:', 'burst-statistics' ) } { selectedCategory }
			</p>
			<div className="mt-3 flex items-center gap-2">
				<ButtonInput btnVariant="primary" size="sm" link={{ to: pricingUrl }}>
					{ __( 'Upgrade to Pro', 'burst-statistics' )}
				</ButtonInput>
				<ButtonInput btnVariant="tertiary" size="sm" onClick={onBack}>
					{ __( 'Back', 'burst-statistics' )}
				</ButtonInput>
			</div>
		</div>
	);
};

/**
 * Sources block with category donut and drill-down behavior.
 *
 * @param {Object} props - Block props.
 * @return {JSX.Element} Sources block.
 */
const SourcesBlock = ( props ) => {
	const { startDate, endDate, range, filters, isReport, index } = useBlockConfig( props );
	const { isPro } = useLicenseData();

	const [ selectedCategoryId, setSelectedCategoryId ] = useState( null );
	const [ isRawModalOpen, setIsRawModalOpen ] = useState( false );

	const args = useMemo( () => ({ filters }), [ filters ]);

	const categoriesQuery = useQuery({
		queryKey: [ 'sources-categories', startDate, endDate, range, args ],
		queryFn: () => getSourcesCategoryData({ startDate, endDate, range, args }),
		placeholderData: [
			{ id: 'search', label: 'Search', value: 0 },
			{ id: 'social', label: 'Social', value: 0 },
			{ id: 'direct', label: 'Direct', value: 0 },
			{ id: 'ai', label: 'AI', value: 0 },
			{ id: 'campaigns', label: 'Campaigns', value: 0 },
			{ id: 'other', label: 'Other', value: 0 }
		]
	});

	const selectedCategory = categoriesQuery.data?.find(
		( item ) => item.id === selectedCategoryId
	);

	const drilldownQuery = useQuery({
		queryKey: [ 'sources-drilldown', selectedCategoryId, startDate, endDate, range, args ],
		queryFn: () =>
			getSourcesDrilldownData({
				startDate,
				endDate,
				range,
				args,
				category: selectedCategoryId
			}),
		enabled: !! selectedCategoryId && isPro,
		placeholderData: []
	});
	const topSourcesQuery = useQuery({
		queryKey: [ 'sources-top', startDate, endDate, range, args ],
		queryFn: () => getTopSourcesData({ startDate, endDate, range, args }),
		enabled: categoriesQuery.isSuccess,
		placeholderData: []
	});

	const handleOpenRawModal = () => {
		setIsRawModalOpen( true );
	};

	const handleCloseRawModal = () => {
		setIsRawModalOpen( false );
	};

	return (
		<>
			<Block className="row-span-1 lg:col-span-6 xl:col-span-3">
				<BlockHeading
					title={__( 'Traffic sources', 'burst-statistics' )}
					isReport={isReport}
					reportBlockIndex={index}
					isLoading={categoriesQuery.isFetching}
				/>
				<BlockContent className="px-0 py-0">
					{ ! selectedCategoryId && (
						<>
							<div className="flex items-center gap-3 px-4 py-4">
								<div
									className={categoriesQuery.isFetching ? 'animate-pulse' : undefined}
									style={{ height: 120, width: 120 }}
								>
									<ResponsivePie
										data={categoriesQuery.data ?? []}
										margin={{ top: 8, right: 8, bottom: 8, left: 8 }}
										innerRadius={0.7}
										padAngle={1.2}
										cornerRadius={3}
										activeOuterRadiusOffset={3}
										borderWidth={0}
										arcLabel={false}
										enableArcLinkLabels={false}
										colors={({ id }) => SOURCE_CATEGORY_COLORS[id] ?? 'var(--color-gray-400)'}
										tooltip={({ datum }) => (
											<div className="rounded border border-gray-200 bg-white px-2 py-1 text-xs text-text-black shadow-sm">
												{datum.label}: {formatPercentage( datum.value )}
											</div>
										)}
										onClick={( datum ) => {
											setSelectedCategoryId( datum.id );
										}}
									/>
								</div>
								<div className="min-w-0 flex-1">
									<SourcesLegend
										categories={categoriesQuery.data ?? []}
										activeId={selectedCategoryId}
										onSelect={setSelectedCategoryId}
									/>
								</div>
							</div>
							<TopSourcesList
								rows={topSourcesQuery.data ?? []}
								isLoading={topSourcesQuery.isFetching}
							/>
						</>
					) }

					{ selectedCategoryId && isPro && (
						<SourcesDrilldown
							categoryId={selectedCategoryId}
							categoryName={selectedCategory?.label ?? selectedCategoryId}
							onBack={() => setSelectedCategoryId( null )}
							rows={drilldownQuery.data ?? []}
							isLoading={drilldownQuery.isFetching}
						/>
					) }

					{ selectedCategoryId && ! isPro && (
						<SourcesUpsell
							selectedCategory={selectedCategory?.label ?? selectedCategoryId}
							onBack={() => setSelectedCategoryId( null )}
						/>
					) }
				</BlockContent>
				<BlockFooter className="pt-1">
					<button
						type="button"
						onClick={handleOpenRawModal}
						className="w-full text-center text-xs text-text-gray underline decoration-gray-400 underline-offset-2 transition-colors hover:text-text-black"
					>
						{__( 'View raw referrer data', 'burst-statistics' )}
					</button>
				</BlockFooter>
			</Block>

			<Modal
				title={__( 'Raw referrer data', 'burst-statistics' )}
				subtitle={__(
					'Diagnostic data showing uncategorized raw referrer strings.',
					'burst-statistics'
				)}
				isOpen={isRawModalOpen}
				onClose={handleCloseRawModal}
				size="full"
				content={
					<div className="space-y-4">
						<p className="text-sm text-text-gray">
							{ __(
								'These values are raw referral strings for troubleshooting and validation.',
								'burst-statistics'
							) }
						</p>

						<div className="rounded-md border border-gray-200 bg-white p-2">
							<DataTableBlock
								allowedConfigs={[ 'referrers' ]}
								id="statistics-referrers-modal"
							/>
						</div>
					</div>
				}
			/>
		</>
	);
};

SourcesBlock.displayName = 'SourcesBlock';

export default SourcesBlock;
