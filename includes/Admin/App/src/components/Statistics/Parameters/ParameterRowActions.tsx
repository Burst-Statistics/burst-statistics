import React, { useCallback, memo } from 'react';
import { __ } from '@wordpress/i18n';
import Icon from '@/utils/Icon';
import ParameterKebabMenu from './ParameterKebabMenu';

interface ParameterRowActionsProps {

	/** Parameter or filter key (e.g. 'utm_campaign', 'referrer'). */
	paramKey: string;

	/** Parameter or filter value (e.g. 'summer', 'google.com'). */
	paramValue: string;

	/** Parent page URL for link construction. */
	pageUrl?: string;

	/** Callback to filter on this value. */
	onFilter?: ( key: string, value: string ) => void;

	/** Callback to exclude this value. */
	onExclude?: ( key: string, value: string ) => void;

	/** Optional additional CSS classes. */
	className?: string;
}

/**
 * Hover action group containing the "Filter on this" button and kebab actions.
 *
 * @param {ParameterRowActionsProps} props Component props.
 * @return {JSX.Element} Actions group element.
 */
const ParameterRowActions: React.FC<ParameterRowActionsProps> = ({
	paramKey,
	paramValue,
	pageUrl = '',
	onFilter,
	onExclude,
	className = ''
}) => {
	const handleFilterClick = useCallback(
		( event: React.MouseEvent ) => {
			event.stopPropagation();
			onFilter?.( paramKey, paramValue );
		},
		[ onFilter, paramKey, paramValue ]
	);

	return (
		<div className={`flex items-center gap-1.5 shrink-0 opacity-0 transition-opacity group-hover:opacity-100 ${className}`}>
			<button
				type="button"
				onClick={handleFilterClick}
				className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-green px-2.5 py-1 text-xs font-medium text-white shadow-2xs transition-colors hover:bg-green/90 focus:outline-hidden whitespace-nowrap cursor-pointer"
			>
				<Icon name="filter" size={11} color="white" />
				<span className="whitespace-nowrap">{__( 'Filter on this', 'burst-statistics' )}</span>
			</button>
			<ParameterKebabMenu
				paramKey={paramKey}
				paramValue={paramValue}
				pageUrl={pageUrl}
				onFilter={onFilter}
				onExclude={onExclude}
			/>
		</div>
	);
};

export default memo( ParameterRowActions );
