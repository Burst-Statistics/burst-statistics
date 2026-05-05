import { memo } from 'react';
import Icon from '@/utils/Icon';

type LoadingSpinnerProps = {
	className?: string;
};

/**
 * A small inline spinner used to indicate a loading state.
 *
 * @param {Object} props           - Component props.
 * @param {string} props.className - Additional CSS classes.
 * @return {JSX.Element} The LoadingSpinner component.
 */
export const LoadingSpinner = memo( ({ className = '' }: LoadingSpinnerProps ) => {
	return (
		<Icon name="loading" className={className} color="gray" />
	);
});

LoadingSpinner.displayName = 'LoadingSpinner';
