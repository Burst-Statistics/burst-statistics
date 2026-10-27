import React from 'react';
import { __ } from '@wordpress/i18n';
import { ChevronDown } from 'lucide-react';

export interface PeriodOption {
	value: string;
	label: string;
}

export interface PeriodSelectProps {
	value: string;
	onChange: ( value: string ) => void;
	options?: PeriodOption[];
}

const PERIOD_OPTIONS: PeriodOption[] = [
	{ value: 'last-7-days', label: __( 'Last 7 days', 'burst-statistics' ) },
	{ value: 'last-30-days', label: __( 'Last 30 days', 'burst-statistics' ) },
	{ value: 'last-90-days', label: __( 'Last 90 days', 'burst-statistics' ) },
	{ value: 'today', label: __( 'Today', 'burst-statistics' ) },
	{ value: 'yesterday', label: __( 'Yesterday', 'burst-statistics' ) },
	{ value: 'last-month', label: __( 'Last month', 'burst-statistics' ) },
	{ value: 'this-year', label: __( 'This year', 'burst-statistics' ) }
];

/**
 * Dropdown selector for choosing the statistics date period in the editor sidebar.
 *
 * @param props          - Component properties.
 * @param props.value    - Currently selected period range key.
 * @param props.onChange - Selection change callback.
 * @param props.options  - Optional custom options list.
 * @return Styled period select element matching mockup.
 */
export const PeriodSelect: React.FC<PeriodSelectProps> = ({
	value,
	onChange,
	options = PERIOD_OPTIONS
}) => (
	<div className="mb-3">
		<label
			htmlFor="burst-editor-period-select"
			className="mb-1 block text-[10px] font-semibold tracking-wider text-text-gray uppercase"
		>
			{ __( 'Period', 'burst-statistics' ) }
		</label>
		<div className="relative">
			<select
				id="burst-editor-period-select"
				value={ value }
				onChange={ ( e ) => onChange( e.target.value ) }
				className="w-full appearance-none rounded-md border border-gray-200 bg-white px-2.5 py-1.5 pr-8 text-xs font-normal text-text-black shadow-2xs focus:border-green-600 focus:outline-none focus:ring-1 focus:ring-green-600 cursor-pointer"
			>
				{ options.map( ( opt ) => (
					<option key={ opt.value } value={ opt.value }>
						{ opt.label }
					</option>
				) ) }
			</select>
			<ChevronDown
				size={ 14 }
				className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400"
				aria-hidden="true"
			/>
		</div>
	</div>
);
