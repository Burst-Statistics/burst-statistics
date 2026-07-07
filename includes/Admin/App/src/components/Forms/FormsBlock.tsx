import { memo, useMemo } from 'react';
import { __ } from '@wordpress/i18n';
import { useNavigate, useRouterState } from '@tanstack/react-router';
import { Block } from '@/components/Blocks/Block';
import { BlockHeading } from '@/components/Blocks/BlockHeading';
import { BlockContent } from '@/components/Blocks/BlockContent';
import Icon from '@/utils/Icon';
import { BarDataTable } from '@/components/DataTable/BarDataTable';
import { useFormsData } from './useFormsData';
import { getFormsColumns } from './columns';
import useLicenseData from '@/hooks/useLicenseData';
import UpsellOverlay from '@/components/Upsell/UpsellOverlay';
import UpsellCopy from '@/components/Upsell/UpsellCopy';
import MetricInfo from '@/components/Common/MetricInfo';

type FormsBlockProps = {

	/** Additional CSS class names passed to the wrapping Block. */
	className?: string;
};

/** Maximum rows shown in the compact block view. */
const TOP_N = 5;

/**
 * Compact dashboard block showing the top performing forms by submissions.
 *
 * Displays form title, submission count with a proportional bar, and
 * conversion rate (submissions / unique visitors). An expand button opens
 * the full table in the DataTableOverlay.
 *
 * @param {Object} props           - Component props.
 * @param {string} props.className - Additional CSS classes for the Block wrapper.
 * @return {JSX.Element} The forms block.
 */
const FormsBlock = memo( ({ className = '' }: FormsBlockProps ) => {
	const { isLicenseValid } = useLicenseData();
	const { data, isLoading } = useFormsData();

	const navigate = useNavigate();
	const location = useRouterState({ select: ( s ) => s.location });

	const columns = useMemo( () => getFormsColumns(), []);
	const topData = useMemo( () => data.slice( 0, TOP_N ), [ data ]);

	const hasData = 0 < topData.length;

	/**
	 * Navigate to the fullscreen overlay with the forms variant active.
	 */
	const handleExpand = () => {
		navigate({
			to: '/table/$variant',
			params: { variant: 'forms' },
			search: {
				from: location.pathname,
				allowed: 'forms',
				dataTableId: 'forms',
				...location.search
			}
		});
	};

	if ( ! isLicenseValid ) {
		return (
			<Block className={ `${ className } relative min-h-[320px] overflow-hidden` }>
				<BlockHeading title={ __( 'Forms', 'burst-statistics' ) } />
				<BlockContent className="px-0 py-0 overflow-y-auto">
					<div className="flex h-48 flex-col items-center justify-center p-4 text-center text-sm text-gray-400 select-none blur-[1px]">
						<p className="font-medium text-gray-500 mb-1">
							{ __( 'Form tracking is a Pro feature.', 'burst-statistics' ) }
						</p>
					</div>
					<UpsellOverlay
						className="flex items-center justify-center pt-0 mt-0 m-0 border-0 bg-transparent"
						containerClassName="pt-1 m-1 mt-4"
						cardClassName="mx-4 min-w-fit rounded-md border border-gray-300 bg-gray-100 px-6 py-6 shadow-sm"
					>
						<UpsellCopy type="forms" compact={ true } />
					</UpsellOverlay>
				</BlockContent>
			</Block>
		);
	}

	return (
		<Block className={ className }>
			<BlockHeading
				className="border-b border-gray-200"
				isLoading={ isLoading }
				title={ <>
					<MetricInfo metricKey="forms" side="bottom">
						{ __( 'Forms', 'burst-statistics' ) }
					</MetricInfo>
					{ hasData && (
						<button
							type="button"
							className="inline-flex items-center justify-center rounded-md p-1.5 text-gray-500 transition-colors hover:bg-gray-200 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
							onClick={ handleExpand }
							aria-label={ __( 'Expand table', 'burst-statistics' ) }
							title={ __( 'Expand table', 'burst-statistics' ) }
						>
							<Icon name="expand" size={ 14 } />
						</button>
					) }
				</> }
			/>
			<BlockContent className="px-0 py-0 overflow-y-auto">
				<BarDataTable
					columns={ columns }
					data={ topData }
					rowKey={ ( row ) => `${ row.formProvider }:${ row.formId }` }
					barColumnKey="submissions"
					isLoading={ isLoading }
					emptyState={ __( 'No form submissions recorded yet.', 'burst-statistics' ) }
				/>
			</BlockContent>
		</Block>
	);
});

FormsBlock.displayName = 'FormsBlock';

export default FormsBlock;
