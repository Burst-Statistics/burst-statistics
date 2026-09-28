import { memo } from 'react';
import { __ } from '@wordpress/i18n';
import Icon from '@/utils/Icon';

type ExpandTableButtonProps = {

	/** Opens the full table, usually by navigating to the DataTableOverlay route. */
	onClick: () => void;
};

/**
 * Icon button in a block heading that opens the block's full table.
 * Shared by the compact dashboard table blocks so they look and behave the same.
 *
 * @param {Object}   props         - Component props.
 * @param {Function} props.onClick - Click handler that opens the full table.
 * @return {JSX.Element} The expand button.
 */
export const ExpandTableButton = memo( ({ onClick }: ExpandTableButtonProps ) => (
	<button
		type="button"
		className="inline-flex cursor-pointer items-center justify-center rounded-md p-1.5 text-gray-500 transition-colors hover:bg-gray-200 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
		onClick={ onClick }
		aria-label={ __( 'Expand table', 'burst-statistics' ) }
		title={ __( 'Expand table', 'burst-statistics' ) }
	>
		<Icon name="expand" size={ 14 } />
	</button>
) );

ExpandTableButton.displayName = 'ExpandTableButton';
