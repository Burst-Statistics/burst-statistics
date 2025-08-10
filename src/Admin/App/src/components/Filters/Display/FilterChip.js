import Icon from '../../../utils/Icon';
import { safeDecodeURI } from '../../../utils/lib';
import { __ } from '@wordpress/i18n';

/**
 * Reusable FilterChip component for displaying active filters
 * 
 * @param {Object} props - Component props
 * @param {Object} props.filter - Filter object with key, value, displayValue, and config
 * @param {Function} props.onRemove - Callback function when remove button is clicked
 * @param {Function} props.onClick - Callback function when chip is clicked to edit
 * @param {string} props.className - Additional CSS classes
 * @param {boolean} props.showRemoveButton - Whether to show the remove button (default: true)
 * @returns {JSX.Element} FilterChip component
 */
const FilterChip = ({ 
    filter, 
    onRemove, 
    onClick,
    className = '', 
    showRemoveButton = true
}) => {
    const baseClasses = 'inline-flex items-center gap-2 px-3 py-2 bg-gray-100 border border-gray-400 hover:bg-gray-200 shadow-md rounded-md text-sm transition-all duration-200 hover:bg-gray-50 hover:[box-shadow:0_0_0_3px_rgba(0,0,0,0.05)] cursor-pointer';
    const combinedClasses = `${baseClasses} ${className}`.trim();


    const handleChipClick = (e) => {
        // Don't trigger chip click if clicking on remove button
        if (e.target.closest('.remove-button')) {
            return;
        }
        if (onClick) {
            onClick(filter);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleChipClick(e);
        }
    };

    // prevent critical errors if filter is not valid, due to changed filter structure.
    if (!filter || !filter.config) {
        localStorage.removeItem('burst-filters-storage');
        return null; // Return null if filter is not valid
    }

    if (!filter.key) {
        return null; // Return null if filter key is not valid
    }

    return (
        <div 
            className={combinedClasses}
            onClick={handleChipClick}
            onKeyDown={handleKeyDown}
            role="button"
            tabIndex={0}
            aria-label={__('Edit %s filter', 'burst-statistics').replace('%s', filter.config.label)}
            title={__('Click to edit filter', 'burst-statistics')}
        >
            {/* Filter Icon */}
            <Icon name={filter.config.icon} size="16" />
            
            {/* Filter Label */}
            <p className="font-medium">{filter.config.label}</p>
            
            {/* Separator */}
            <span className="h-4 w-px bg-gray-400"></span>
            
            {/* Filter Value */}
            <p className="text-gray">{safeDecodeURI( filter.displayValue )}</p>
            
            {/* Remove Button */}
            {showRemoveButton && onRemove && (
                <button
                    onClick={() => onRemove(filter.key)}
                    className="remove-button rounded-full p-1 transition-colors hover:bg-gray-200"
                    aria-label={__('Remove filter', 'burst-statistics')}
                    title={__('Remove filter', 'burst-statistics')}
                >
                    <Icon name="times" color="var(--rsp-grey-500)" size="16" />
                </button>
            )}
        </div>
    );
};

export default FilterChip; 