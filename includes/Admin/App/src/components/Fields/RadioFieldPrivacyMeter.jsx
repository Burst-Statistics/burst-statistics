import { __ } from '@wordpress/i18n';
import { clsx } from 'clsx';

const METER_SEGMENTS = 3;

/**
 * RadioFieldPrivacyMeter component.
 *
 * Renders the segmented privacy meter and level label shown next to a
 * RadioField option that declares a `level`.
 *
 * @param {Object} props
 * @param {string} props.inputId - Base id used to key the meter segments.
 * @param {number} props.meter   - Number of filled segments (0-METER_SEGMENTS).
 * @param {string} props.level   - Label describing the privacy level.
 * @return {JSX.Element}
 */
const RadioFieldPrivacyMeter = ({ inputId, meter, level }) => {
	return (
		<div className="flex flex-col items-end gap-1 shrink-0">
			<span className="text-xs text-text-gray whitespace-nowrap">
				{__( 'Privacy', 'burst-statistics' )}
			</span>
			<div className="flex items-center gap-1">
				{Array.from({ length: METER_SEGMENTS }).map( ( _, index ) => (
					<span
						key={`${inputId}-meter-${index}`}
						className={clsx(
							'h-1.5 w-4 rounded-full',
							index < meter ? 'bg-primary' : 'bg-gray-200'
						)}
					/>
				) )}
			</div>
			<span className="text-xs font-bold text-text-black whitespace-nowrap">
				{level}
			</span>
		</div>
	);
};

RadioFieldPrivacyMeter.displayName = 'RadioFieldPrivacyMeter';

export default RadioFieldPrivacyMeter;
