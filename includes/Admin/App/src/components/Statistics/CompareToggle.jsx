import { __ } from '@wordpress/i18n';
import { useCompareStore, COMPARE_MODES } from '@/store/useCompareStore';

/**
 * CompareToggle renders a segmented control that lets the user choose between
 * "Previous period" and "Year over year" as the active comparison mode.
 * The selection is persisted via useCompareStore.
 *
 * @return {JSX.Element} The segmented control element.
 */
const CompareToggle = () => {
	const compareMode = useCompareStore( ( state ) => state.compareMode );
	const setCompareMode = useCompareStore( ( state ) => state.setCompareMode );

	const options = [
		{
			value: COMPARE_MODES.PREVIOUS_PERIOD,
			label: __( 'Previous period', 'burst-statistics' )
		},
		{
			value: COMPARE_MODES.YEAR_OVER_YEAR,
			label: __( 'Year over year', 'burst-statistics' )
		}
	];

	return (
		<div className='flex flex-col justify-start py-2 px-4'>
			<h3 className='font-medium text-md pt-4 pb-1'>{__( 'Compare mode', 'burst-statistics' )}</h3>
			<p className='text-sm text-text-gray pb-2'>{__( 'Some blocks show a comparison of data. Select how these blocks compare the data.', 'burst-statistics' )}</p>
			<div className="grid grid-cols-1 lg:grid-cols-2 gap-0.5 border border-gray-300 rounded-md bg-gray-200 p-0.5 shadow-sm">
				{options.map( ( option ) => {
					const isActive = compareMode === option.value;
					return (
						<button
							key={option.value}
							type="button"
							onClick={() => setCompareMode( option.value )}
							className={[
								'text-base px-4 py-1 transition-colors rounded-sm focus:outline-hidden font-medium ',
								isActive ?
									'bg-green-50 text-green border-green border' :
									'bg-white text-text-gray hover:bg-gray-50 border border-transparent'
							].join( ' ' )}
							aria-pressed={isActive}
						>
							{option.label}
						</button>
					);
				})}
			</div>
		</div>
	);
};

export default CompareToggle;
