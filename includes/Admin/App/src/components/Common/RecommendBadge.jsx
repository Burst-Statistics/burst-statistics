import { __ } from '@wordpress/i18n';

/**
 * RecommendBadge Component
 * 
 * A reusable component to display a "Recommended" badge
 * 
 * @param {object} props - Component props
 * @param {string} [props.className] - Additional classes to apply to the badge (optional)
 * @returns {JSX.Element}
 */
const RecommendBadge = ({ className = '' }) => {
  return (
    <span 
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-primary bg-opacity-10 text-primary ${className}`}
    >
      {__('Recommended', 'burst-statistics')}
    </span>
  );
};

export default RecommendBadge; 