import React from 'react';
import { __ } from '@wordpress/i18n';
import clsx from 'clsx';
import Icon from '@/utils/Icon';
import ProBadge from '@/components/Common/ProBadge';
import NewBadge from '@/components/Common/NewBadge';
import { useFilters } from '@/hooks/useFilters';
import useLicenseData from '@/hooks/useLicenseData';
import { type FilterConfig } from '@/config/filterConfig';

interface FilterCardProps {
	filterKey: string;
	config: FilterConfig;
	isActive?: boolean;
	onClick: () => void;
	gridPosition?: {
		position: number;
		total: number;
	};
	reportBlockIndex:number;
}

const FilterCard: React.FC<FilterCardProps> = ({
	filterKey,
	config,
	isActive = false,
	onClick,
	gridPosition,
    reportBlockIndex
}) => {
	const { isLicenseValid } = useLicenseData();
	const { isFavorite, toggleFavorite } = useFilters( reportBlockIndex );
	const isDisabled = ( config.pro && ! isLicenseValid ) || config.coming_soon;
	const isFav = isFavorite( filterKey );

	const handleFavoriteClick = ( e: React.MouseEvent | React.KeyboardEvent ) => {
		e.stopPropagation();
		e.preventDefault();
		if ( ! isDisabled ) {
			toggleFavorite( filterKey );
		}
	};

	const handleCardClick = () => {
		if ( ! isDisabled ) {
			onClick();
		}
	};

	const handleCardKeyDown = ( e: React.KeyboardEvent ) => {
		if ( 'Enter' === e.key || ' ' === e.key ) {
			e.preventDefault();
			handleCardClick();
		}
	};

	const handleFavoriteKeyDown = ( e: React.KeyboardEvent ) => {
		if ( 'Enter' === e.key || ' ' === e.key ) {
			e.preventDefault();
			handleFavoriteClick( e );
		}
	};

	// Build accessible description for screen readers
	const getAccessibleDescription = (): string => {
		let description = `${config.label} filter`;

		if ( isActive ) {
			description += `, ${__( 'currently active', 'burst-statistics' )}`;
		}

		if ( config.pro ) {
			description += `, ${__( 'Pro feature', 'burst-statistics' )}`;
		}

		if ( config.coming_soon ) {
			description += `, ${__( 'coming soon', 'burst-statistics' )}`;
		}

		if ( config.new_badge ) {
			description += `, ${__( 'new', 'burst-statistics' )}`;
		}

		if ( isDisabled ) {
			description += `, ${__( 'disabled', 'burst-statistics' )}`;
		}

		return description;
	};

	return (
		<div
			className={clsx(
				'relative rounded-lg border-2 p-4 transition-all duration-200 bg-white w-full group',
				'focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-2',
				{
					'border-primary bg-primary-100': isActive,
					'border-gray-300 shadow-sm hover:border-gray-400':
						! isActive && ! isDisabled,
					'bg-gray-100 border-gray-200': isDisabled,
					'bg-gray-300 opacity-90': config.coming_soon
				}
			)}
			role={gridPosition ? 'gridcell' : undefined}
			aria-posinset={gridPosition?.position}
			aria-setsize={gridPosition?.total}
		>
			{/* Main Card Button */}
			<button
				onClick={handleCardClick}
				onKeyDown={handleCardKeyDown}
				disabled={isDisabled}
				aria-label={getAccessibleDescription()}
				aria-pressed={isActive}
				className={clsx(
					'w-full h-full absolute inset-0 rounded-lg transition-all duration-200',
					'focus:outline-hidden focus:ring-2 focus:ring-primary focus:ring-offset-2',
					{
						'cursor-not-allowed': isDisabled,
						'cursor-pointer hover:bg-opacity-5':
							! isDisabled
					}
				)}
				tabIndex={isDisabled ? -1 : 0}
			/>

			{/* Favorite Button */}
			<div className="absolute top-2 right-2 z-20 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-200">
				<button
					onClick={handleFavoriteClick}
					onKeyDown={handleFavoriteKeyDown}
					disabled={isDisabled}
					className={clsx(
						'p-1 rounded-full transition-all duration-200',
						'focus:outline-hidden focus:ring-2 focus:ring-primary focus:ring-offset-1',
						'hover:bg-gray-200 active:bg-gray-300',
						{
							'text-yellow-500': isFav,
							'text-text-gray-light hover:text-text-gray-light': ! isFav,
							'cursor-not-allowed opacity-50': isDisabled
						}
					)}
					aria-label={
						isFav ?
							__(
									'Remove %s from favorites',
									'burst-statistics'
								).replace( '%s', config.label ) :
							__(
									'Add %s to favorites',
									'burst-statistics'
								).replace( '%s', config.label )
					}
					aria-pressed={isFav}
					tabIndex={isDisabled ? -1 : 0}
				>
					<Icon
						name={isFav ? 'star-filled' : 'star-outline'}
						size={16}
						color={isFav ? 'yellow' : 'gray'}
						aria-hidden="true"
					/>
				</button>
			</div>

			{/* Active Indicator */}
			{isActive && (
				<div className="absolute top-2 left-2 z-10" aria-hidden="true">
					<div className="h-2 w-2 rounded-full bg-primary"></div>
				</div>
			)}

			{/* Card Content */}
			<div className="relative z-10 pointer-events-none flex flex-col items-center gap-3">
				{/* Icon */}
				<div
					className={clsx(
						'flex h-12 w-12 items-center justify-center rounded-lg',
						{
							'bg-gray-100': ! isActive,
							'bg-primary-100': isActive
						}
					)}
					aria-hidden="true"
				>
					<Icon
						name={config.icon}
						color={'gray'}
						size={24}
						aria-hidden="true"
					/>
				</div>

				{/* Label */}
				<div className="text-center">
					<h3 className="text-sm font-medium text-text-gray">
						{config.label}
					</h3>

					{/* Pro Badge */}
					{
						config.pro && (
							<div className="mt-2">
								<ProBadge label={__( 'Pro', 'burst-statistics' )} />
							</div>
						)
					}

					{
						config.coming_soon && (
							<div className="mt-2">
								<span className="inline-flex items-center rounded bg-blue-50 px-2 py-0.5 text-xs font-medium text-text-gray">
									{__( 'Coming soon', 'burst-statistics' )}
								</span>
							</div>
						)
					}

					{
						config.new_badge && (
							<div className="mt-2">
								<NewBadge
									version={config.new_badge.version}
									days={config.new_badge.days}
									tooltipContent={config.new_badge.tooltip}
								/>
							</div>
						)
					}
				</div>
			</div>
		</div>
	);
};

export default FilterCard;
