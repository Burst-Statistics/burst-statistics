import { useMemo, useState } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import { ResponsivePie } from '@nivo/pie';
import { Block } from '@/components/Blocks/Block';
import { BlockHeading } from '@/components/Blocks/BlockHeading';
import { BlockContent } from '@/components/Blocks/BlockContent';
import ButtonInput from '@/components/Inputs/ButtonInput';
import { useBlockConfig } from '@/hooks/useBlockConfig';
import { useNavigate, useRouterState } from '@tanstack/react-router';
import useLicenseData from '@/hooks/useLicenseData';
import Icon from '@/utils/Icon';
import { ChartTooltip } from '@/components/Common/ChartTooltip';
import { burst_get_website_url } from '@/utils/lib';
import { formatNumber, formatPercentage } from '@/utils/formatting';
import {
	getSourcesDrilldownData,
	getTopSourcesData
} from '@/api/getSourcesData';
import useSourcesOverTime, { useSourcesList } from '@/hooks/useSourcesOverTime';
import { getSourceCategoryMeta } from '@/api/getDataTableData';

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
					className={`flex w-full items-center justify-between gap-2 rounded-sm px-2 py-1 text-xs transition-colors ${
						activeId === item.id ?
							'bg-gray-100 text-text-black' :
							'text-text-gray hover:bg-gray-100 hover:text-text-black'
					}`}
					aria-pressed={ activeId === item.id }
				>
					<span className="flex items-center gap-1.5">
						<span
							className="inline-block h-2.5 w-2.5 rounded-full"
							style={{ backgroundColor: getSourceCategoryMeta( item.id ).color }}
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
	const topRows = ( rows || []).slice( 0, 5 );

	return (
		<div className="px-6 py-4 flex flex-col min-h-[320px]">
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
				<div className="flex flex-col gap-2 flex-1">
					{ [ 1, 2, 3, 4 ].map( ( row ) => (
						<div key={row} className="h-9 animate-pulse rounded-md bg-gray-200" />
					) ) }
				</div>
			) }

			{ ! isLoading && 0 === topRows.length && (
				<p className="text-sm text-text-gray flex-1">
					{ __( 'No source details found for this category.', 'burst-statistics' )}
				</p>
			) }

			{ ! isLoading && 0 < topRows.length && (
				<div className="flex-1 overflow-y-auto pr-1">
					<ul className="flex flex-col gap-2">
						{ topRows.map( ( row ) => (
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
				</div>
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

	const navigate = useNavigate();
	const location = useRouterState({ select: ( s ) => s.location });

	const [ selectedCategoryId, setSelectedCategoryId ] = useState( null );

	const args = useMemo( () => ({ filters }), [ filters ]);

	const sourcesOverTimeQuery = useSourcesOverTime({
		startDate,
		endDate,
		range,
		args
	});

	const sourcesListQuery = useSourcesList({
		startDate,
		endDate,
		range,
		args
	});

	const categoriesData = useMemo( () => {
		const data = sourcesOverTimeQuery.data || {};

		const sumArray = ( arr ) => {
			if ( ! Array.isArray( arr ) ) {
				return 0;
			}
			return arr.reduce( ( sum, val ) => sum + parseInt( val || 0 ), 0 );
		};

		const SOURCE_CATEGORY_KEYS = [ 'search', 'social', 'referral', 'aiReferral', 'paid', 'email', 'direct' ];

		const categorySums = SOURCE_CATEGORY_KEYS.map( ( key ) => {
			const meta = getSourceCategoryMeta( key );
			return {
				id: key,
				label: meta.label,
				sum: sumArray( data[ key ])
			};
		});

		const total = categorySums.reduce( ( sum, cat ) => sum + cat.sum, 0 );

		return categorySums.map( ( cat ) => ({
			id: cat.id,
			label: cat.label,
			value: 0 < total ? ( cat.sum / total ) * 100 : 0
		}) );
	}, [ sourcesOverTimeQuery.data ]);

	const hasCategoryData = useMemo( () => {
		return categoriesData.some( ( item ) => 0 < item.value );
	}, [ categoriesData ]);

	const selectedCategory = categoriesData?.find(
		( item ) => item.id === selectedCategoryId
	);

	const drilldownRows = useMemo( () => {
		if ( ! selectedCategoryId || ! sourcesListQuery.data ) {
			return [];
		}
		return getSourcesDrilldownData({
			sourcesList: sourcesListQuery.data,
			category: selectedCategoryId
		});
	}, [ selectedCategoryId, sourcesListQuery.data ]);

	const topSourcesRows = useMemo( () => {
		return getTopSourcesData( sourcesListQuery.data || []);
	}, [ sourcesListQuery.data ]);

	const handleOpenRawModal = () => {
		navigate({
			to: '/table/$variant',
			params: { variant: 'referrers' },
			search: {
				from: location.pathname,
				allowed: 'referrers',
				dataTableId: 'statistics_referrers',
				...location.search
			}
		});
	};

	return (
		<>
			<Block className="row-span-2 @lg:col-span-6 @xl:col-span-3">
				<BlockHeading
					title={__( 'Traffic sources', 'burst-statistics' )}
					isReport={isReport}
					reportBlockIndex={index}
					isLoading={sourcesOverTimeQuery.isFetching}
					controls={
						<>
							<button
								type="button"
								className="inline-flex items-center justify-center rounded-md p-1.5 text-gray-500 transition-colors hover:bg-gray-200 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
								onClick={handleOpenRawModal}
								aria-label={__( 'Expand table', 'burst-statistics' )}
								title={__( 'Expand table', 'burst-statistics' )}
							>
								<Icon name="expand" size={14} />
							</button>
							<div className="ml-auto" />
						</>
					}
				/>
				<BlockContent className="px-0 py-0">
					{ ! selectedCategoryId && (
						<>
							{ ! hasCategoryData && ! sourcesOverTimeQuery.isFetching ? (
								<div className="flex h-48 flex-col items-center justify-center p-6 text-center select-none">
									<div className="mb-3 rounded-full bg-gray-100 p-3 text-gray-400 dark:bg-gray-700 dark:text-gray-300">
										<svg
											className="h-8 w-8"
											fill="none"
											viewBox="0 0 24 24"
											stroke="currentColor"
											strokeWidth={1}
										>
											<path
												strokeLinecap="round"
												strokeLinejoin="round"
												d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
											/>
										</svg>
									</div>
									<h3 className="mb-1 text-sm font-semibold text-text-black">
										{ __( 'No data to display', 'burst-statistics' ) }
									</h3>
									<p className="text-xs text-text-gray max-w-[200px]">
										{ __( 'There is no traffic source data available for this range.', 'burst-statistics' ) }
									</p>
								</div>
							) : (
								<div className="flex items-center gap-3 px-4 py-4">
									<div
										className={sourcesOverTimeQuery.isFetching ? 'animate-pulse' : undefined}
										style={{ height: 120, width: 120 }}
									>
										<ResponsivePie
											data={categoriesData}
											margin={{ top: 8, right: 8, bottom: 8, left: 8 }}
											innerRadius={0.7}
											padAngle={1.2}
											cornerRadius={3}
											activeOuterRadiusOffset={3}
											borderWidth={0}
											arcLabel={false}
											enableArcLinkLabels={false}
											colors={({ id }) => getSourceCategoryMeta( id ).color}
											tooltip={({ datum }) => (
												<ChartTooltip className="text-xs min-w-0 px-2 py-1">
													{datum.label}: {formatPercentage( datum.value )}
												</ChartTooltip>
											)}
											onClick={( datum ) => {
												setSelectedCategoryId( datum.id );
											}}
										/>
									</div>
									<div className="min-w-0 flex-1">
										<SourcesLegend
											categories={categoriesData}
											activeId={selectedCategoryId}
											onSelect={setSelectedCategoryId}
										/>
									</div>
								</div>
							) }
							<TopSourcesList
								rows={topSourcesRows}
								isLoading={sourcesListQuery.isFetching || sourcesListQuery.isLoading}
							/>
						</>
					) }

					{ selectedCategoryId && isPro && (
						<SourcesDrilldown
							categoryId={selectedCategoryId}
							categoryName={selectedCategory?.label ?? selectedCategoryId}
							onBack={() => setSelectedCategoryId( null )}
							rows={drilldownRows}
							isLoading={sourcesListQuery.isFetching}
						/>
					) }

					{ selectedCategoryId && ! isPro && (
						<SourcesUpsell
							selectedCategory={selectedCategory?.label ?? selectedCategoryId}
							onBack={() => setSelectedCategoryId( null )}
						/>
					) }
				</BlockContent>
			</Block>
		</>
	);
};

SourcesBlock.displayName = 'SourcesBlock';

export default SourcesBlock;
