import FilterChip from './FilterChip';

/**
 * Reusable FilterChipList component for displaying a list of filter chips
 * 
 * @param {Object} props - Component props
 * @param {Array} props.filters - Array of filter objects
 * @param {Function} props.onRemove - Callback function when a filter is removed
 * @param {Function} props.onClick - Callback function when a filter chip is clicked to edit
 * @param {string} props.className - Additional CSS classes for the container
 * @param {boolean} props.showRemoveButton - Whether to show remove buttons on chips
 * @param {string} props.emptyMessage - Message to show when no filters are active
 * @returns {JSX.Element} FilterChipList component
 */
const FilterChipList = ({ 
    filters = [], 
    onRemove, 
    onClick,
    className = 'flex flex-wrap gap-2', 
    showRemoveButton = true,
    emptyMessage = null
}) => {

    if ( (!Array.isArray(filters) || filters.length === 0) && !emptyMessage ) {
        // If filters is not an array or is empty, return null
        return null;
    }

    // If no filters but there's an empty message, show it
    if (filters.length === 0 && emptyMessage) {
        return <div className="text-gray-500 text-sm">{emptyMessage}</div>;
    }

    return (
        <div className={className}>
            {filters.map((filter) => (
                <FilterChip
                    key={filter.key}
                    filter={filter}
                    onRemove={onRemove}
                    onClick={onClick}
                    showRemoveButton={showRemoveButton}
                />
            ))}
        </div>
    );
};

export default FilterChipList; 