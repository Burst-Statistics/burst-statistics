import { __ } from '@wordpress/i18n';
import { useNavigate, useRouterState } from '@tanstack/react-router';
import { BlockHeading } from '@/components/Blocks/BlockHeading';
import Icon from '@/utils/Icon';
import PageWeightMenu from './PageWeightMenu';

type PageWeightHeadingProps = {

	/** Whether the block's data request is in flight. */
	isLoading: boolean;

	/** Whether the green hosting preview applies to this site at all. */
	showGreenHosting: boolean;

	/** Whether to offer the options menu at all. */
	showMenu: boolean;

	/** Whether to offer the fullscreen table: there is nothing to expand before any measurement. */
	showExpand: boolean;
};

/**
 * Title bar of the Page weight block: the expand button and the options menu.
 *
 * @param {PageWeightHeadingProps} props - Component props.
 * @return {JSX.Element} The block heading.
 */
const PageWeightHeading = ({ isLoading, showGreenHosting, showMenu, showExpand }: PageWeightHeadingProps ) => {
	const navigate = useNavigate();
	const location = useRouterState({ select: ( s ) => s.location });

	/**
	 * Navigate to the fullscreen overlay with the page_weight variant active.
	 */
	const handleExpand = () => {
		navigate({
			to: '/table/$variant',
			params: { variant: 'page_weight' },
			search: {
				from: location.pathname,
				allowed: 'page_weight',
				dataTableId: 'page-weight',
				...location.search
			}
		});
	};

	return (
		<BlockHeading
			isLoading={isLoading}
			title={<>
				{__( 'Page weight', 'burst-statistics' )}
				{/* Expand to overlay. */}
				{ showExpand && (
					<button
						type="button"
						className="inline-flex items-center justify-center rounded-md p-1.5 text-gray-500 transition-colors hover:bg-gray-200 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 cursor-pointer"
						onClick={handleExpand}
						aria-label={__( 'Expand table', 'burst-statistics' )}
						title={__( 'Expand table', 'burst-statistics' )}
					>
						<Icon name="expand" size={14} />
					</button>
				) }</>}
			controls={
				showMenu ? <PageWeightMenu showGreenHosting={showGreenHosting} /> : null
			}
		/>
	);
};

export default PageWeightHeading;
