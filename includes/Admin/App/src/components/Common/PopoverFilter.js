import { useEffect, useState, useMemo } from 'react';
import * as Checkbox from '@radix-ui/react-checkbox';
import RadioInput from '../Inputs/RadioInput';
import ButtonInput from '../Inputs/ButtonInput';
import Icon from '../../utils/Icon';
import { __ } from '@wordpress/i18n';
import ProBadge from './ProBadge';
import Popover from './Popover';
import useLicenseData from '@/hooks/useLicenseData';

const PopoverFilter = ({
	onApply,
	id,
	options,
	selectedOptions,
	defaultOptions = [],
	selectionMode = 'multiple'
}) => {
	const [ isOpen, setIsOpen ] = useState( false );
	const [ pendingMetrics, setPendingMetrics ] = useState( selectedOptions );

	// Memoize the categorization logic - only recalculates when options change
	const { categories, uncategorized } = useMemo( () => {
		const cats = {};
		const uncat = [];

		Object.keys( options ).forEach( ( value ) => {
			const category = options[value].category;
			if ( category ) {
				if ( ! cats[category]) {
					cats[category] = [];
				}
				cats[category].push( value );
			} else {
				uncat.push( value );
			}
		});

		return {
			categories: cats,
			uncategorized: uncat
		};
	}, [ options ]);

	// Inside your PopoverFilter component.
	useEffect( () => {
		setPendingMetrics( selectedOptions );
	}, [ selectedOptions ]);

	const { isLicenseValid } = useLicenseData();
	const onCheckboxChange = ( value ) => {
		if ( 'single' === selectionMode ) {

			// For single selection, replace the current selection.
			setPendingMetrics([ value ]);
		} else {

			// For multiple selection, add or remove metric from array.
			if ( pendingMetrics.includes( value ) ) {
				setPendingMetrics(
					pendingMetrics.filter( ( metric ) => metric !== value )
				);
			} else {
				setPendingMetrics([ ...pendingMetrics, value ]);
			}
		}
	};

	const resetToDefaults = () => {

		// Use defaultOptions prop if provided, otherwise fall back to options with default: true.
		let defaultMetrics = 0 < defaultOptions.length ?
			defaultOptions :
			Object.keys( options ).filter( ( option ) => options[option].default );

		// Filter to only include metrics that exist in options.
		defaultMetrics = defaultMetrics.filter( ( metric ) => Object.keys( options ).includes( metric ) );

		if ( 'single' === selectionMode ) {

			// For single selection, use the first default metric.
			const defaultMetric =
				0 < defaultMetrics.length ?
					defaultMetrics[0] :
					Object.keys( options )[0];
			setPendingMetrics([ defaultMetric ]);
			setMetrics([ defaultMetric ]);
		} else {

			// For multiple selection, use all defaults.
			setPendingMetrics( defaultMetrics );
			setMetrics( defaultMetrics );
		}
		setIsOpen( false );
	};

	const applyMetrics = ( metrics ) => {
		setMetrics( metrics );
		setIsOpen( false );
	};

	const setMetrics = ( metrics ) => {

		// if no metrics are selected, set warning and don't close popover
		if ( 'single' === selectionMode && ( ! metrics || 0 === metrics.length ) ) {

			// For single selection, ensure at least one metric is selected
			const firstOption = Object.keys( options )[0];
			if ( firstOption ) {
				onApply([ firstOption ]);
			}
		} else {
			onApply( metrics );
		}
		setIsOpen( false );
	};
	const openOrClosePopover = ( open ) => {
		if ( open ) {
			setIsOpen( true );
		} else {
			setIsOpen( false );
			setPendingMetrics( selectedOptions );
		}
	};

	const footer = (
		<>
			<ButtonInput
				onClick={() => applyMetrics( pendingMetrics )}
				btnVariant="primary"
				size="sm"
				className="flex-1"
			>
				{__( 'Apply', 'burst-statistics' )}
			</ButtonInput>
			<ButtonInput
				onClick={() => resetToDefaults()}
				btnVariant="tertiary"
				size="sm"
				className="flex-1"
			>
				{__( 'Reset to defaults', 'burst-statistics' )}
			</ButtonInput>
		</>
	);
	return (
		<Popover
			isOpen={isOpen}
			setIsOpen={openOrClosePopover}
			title={
				'single' === selectionMode ?
					__( 'Select metric', 'burst-statistics' ) :
					__( 'Select metrics', 'burst-statistics' )
			}
			footer={footer}
		>
			{'single' === selectionMode ? (

				// Radio button mode for single selection
				<div className="flex flex-col gap-2">
					{Object.keys( options ).map( ( value ) => {
						return (
							<RadioInput
								key={value}
								id={id + '_' + value}
								name={id + '_radio_group'}
								value={value}
								label={options[value].label}
								checked={pendingMetrics[0] === value}
								disabled={
									true === options[value].disabled ||
									( options[value].pro && ! isLicenseValid )
								}
								onChange={( selectedValue ) =>
									setPendingMetrics([ selectedValue ])
								}
							>
								{options[value].pro && ! isLicenseValid && (
									<ProBadge label={'Pro'} />
								)}
							</RadioInput>
						);
					})}
				</div>
			) : (

				// Checkbox mode for multiple selection - grouped by category.
				( () => {

					// Define category order and labels.
					const categoryOrder = [ 'traffic', 'engagement', 'conversions' ];
					const categoryLabels = {
						traffic: __( 'Traffic', 'burst-statistics' ),
						engagement: __( 'Engagement', 'burst-statistics' ),
						conversions: __( 'Conversions', 'burst-statistics' )
					};

					// Render function for a single option.
					const renderOption = ( value ) => (
						<div
							key={value}
							className="flex items-center gap-2.5 py-1"
						>
							<Checkbox.Root
								className="focus:ring-blue-500 flex h-4 w-4 items-center justify-center rounded border-2 border-gray-300 bg-white transition-colors hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-offset-2"
								id={id + '_' + value}
								checked={pendingMetrics.includes( value )}
								aria-label={__(
									'Change metrics',
									'burst-statistics'
								)}
								disabled={
									true === options[value].disabled ||
									( options[value].pro && ! isLicenseValid )
								}
								onCheckedChange={() => onCheckboxChange( value )}
							>
								<Checkbox.Indicator>
									<Icon
										name={'check'}
										size={14}
										color={'green'}
										strokeWidth={2}
									/>
								</Checkbox.Indicator>
							</Checkbox.Root>
							<label
								className="flex-1 cursor-pointer text-sm text-gray"
								htmlFor={id + '_' + value}
							>
								{options[value].label}
							</label>
							<div className="flex-shrink-0">
								{options[value].pro && ! isLicenseValid && (
									<ProBadge label={'Pro'} />
								)}
							</div>
						</div>
					);

					// Check if we have any categories.
					const hasCategories = 0 < Object.keys( categories ).length;

					if ( ! hasCategories ) {

						// No categories, render flat list.
						return Object.keys( options ).map( renderOption );
					}

					// Render with category groups.
					return (
						<div className="flex flex-col gap-3">
							{/* Render uncategorized options first (like group_by columns). */}
							{0 < uncategorized.length && (
								<div className="flex flex-col">
									{uncategorized.map( renderOption )}
								</div>
							)}

							{/* Render categorized options. */}
							{categoryOrder.map( ( category ) => {
								if ( ! categories[category] || 0 === categories[category].length ) {
									return null;
								}
								return (
									<div key={category} className="flex flex-col">
										<div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 mt-2 first:mt-0">
											{categoryLabels[category] || category}
										</div>
										{categories[category].map( renderOption )}
									</div>
								);
							})}
						</div>
					);
				})()
			)}
		</Popover>
	);
};

export default PopoverFilter;
