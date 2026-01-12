import FilterChip from './FilterChip';
import useShareableLinkStore from '@/store/useShareableLinkStore';

/**
 * Reusable FilterChipList component for displaying a list of filter chips
 *
 * @param {Object}   props                  - Component props
 * @param {Array}    props.filters          - Array of filter objects
 * @param {Function} props.onRemove         - Callback function when a filter is removed
 * @param {Function} props.onClick          - Callback function when a filter chip is clicked to edit
 * @param {string}   props.className        - Additional CSS classes for the container
 * @param {boolean}  props.showRemoveButton - Whether to show remove buttons on chips
 * @param {string}   props.emptyMessage     - Message to show when no filters are active
 * @return {JSX.Element} FilterChipList component
 */
const FilterChipList = ({
	filters = [],
	onRemove,
	onClick,
	className = 'flex flex-wrap gap-2',
	showRemoveButton = true,
	emptyMessage = null
}) => {
	const userCanFilter = useShareableLinkStore( ( state ) => state.userCanFilter );

	if ( ( ! Array.isArray( filters ) || 0 === filters.length ) && ! emptyMessage ) {

		// If filters is not an array or is empty, return null
		return null;
	}

	// If no filters but there's an empty message, show it
	if ( 0 === filters.length && emptyMessage ) {
		return <div className="text-gray-500 text-sm">{emptyMessage}</div>;
	}

	return (
		<div className={className}>
			{filters.map( ( filter ) => (
				<FilterChip
					disabled={ ! userCanFilter }
					key={filter.key}
					filter={filter}
					onRemove={onRemove}
					onClick={onClick}
					showRemoveButton={showRemoveButton}
				/>
			) )}
		</div>
	);
};

export default FilterChipList;
