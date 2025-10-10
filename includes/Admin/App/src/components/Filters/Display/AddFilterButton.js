import Icon from '../../../utils/Icon';
import { __ } from '@wordpress/i18n';

/**
 * Reusable AddFilterButton component for adding new filters
 * 
 * @param {Object} props - Component props
 * @param {Function} props.onClick - Callback function when button is clicked
 * @param {string} props.className - Additional CSS classes
 * @param {string} props.label - Button label (default: 'Add filter')
 * @returns {JSX.Element} AddFilterButton component
 */
const AddFilterButton = ({ 
    onClick, 
    className = '', 
    label = __('Add filter', 'burst-statistics') 
}) => {
    const baseClasses = 'inline-flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 hover:bg-gray-200 shadow-sm rounded-md text-sm transition-all duration-200 hover:bg-gray-50 hover:[box-shadow:0_0_0_3px_rgba(0,0,0,0.05)] border-dashed cursor-pointer transition-colors';
    const combinedClasses = `${baseClasses} ${className}`.trim();

    return (
        <div 
            className={combinedClasses}
            onClick={onClick}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onClick?.(e);
                }
            }}
            aria-label={label}
        >
            <Icon name="plus" size="16" />
            <p className="font-medium">{label}</p>
        </div>
    );
};

export default AddFilterButton; 