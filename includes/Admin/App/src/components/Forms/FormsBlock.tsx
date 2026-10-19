import { memo, useMemo } from 'react';
import { __ } from '@wordpress/i18n';
import { Block } from '@/components/Blocks/Block';
import { BlockHeading } from '@/components/Blocks/BlockHeading';
import { BlockContent } from '@/components/Blocks/BlockContent';
import ExpandableBlockTitle from '@/components/Blocks/ExpandableBlockTitle';
import { BarDataTable } from '@/components/DataTable/BarDataTable';
import { useExpandableTopBlock } from '@/hooks/useExpandableTopBlock';
import { useFormsData } from './useFormsData';
import { getFormsColumns } from './columns';
import useLicenseData from '@/hooks/useLicenseData';
import OverlayBlock from '@/components/Upsell/OverlayBlock';
import UpsellCopy from '@/components/Upsell/UpsellCopy';
import { isTourActive } from '@/store/useTourStore';

type FormsBlockProps = {

	/** Additional CSS class names passed to the wrapping Block. */
	className?: string;
};

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
	const tourActive = isTourActive();
	const columns = useMemo( () => getFormsColumns(), []);
	const { topData, hasData, handleExpand } = useExpandableTopBlock({
		data,
		variant: 'forms'
	});

	if ( ! tourActive && ! isLicenseValid ) {
		return (
			<OverlayBlock
				className={ className }
				title={ __( 'Forms', 'burst-statistics' ) }
				blurLabel={ __( 'Form tracking is a Pro feature.', 'burst-statistics' ) }
			>
				<UpsellCopy type="forms" compact={ true } />
			</OverlayBlock>
		);
	}

	return (
		<Block className={ className } data-tour="forms-block">
			<BlockHeading
				className="border-b border-gray-200"
				isLoading={ isLoading }
				title={
					<ExpandableBlockTitle
						metricKey="forms"
						label={ __( 'Forms', 'burst-statistics' ) }
						hasData={ hasData }
						onExpand={ handleExpand }
					/>
				}
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
