import React, { useState, useEffect, useCallback } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import clsx from 'clsx';
import TextInput from '@/components/Inputs/TextInput';
import { formatDuration } from '@/utils/formatting';

interface Preset {
	label: string;
	description: string;
	minSeconds: number;
	maxSeconds: number | null;
}

const PRESETS: Preset[] = [
	{
		label: __( '0–30s', 'burst-statistics' ),
		description: __( 'Short visits', 'burst-statistics' ),
		minSeconds: 0,
		maxSeconds: 30
	},
	{
		label: __( '30s–2m', 'burst-statistics' ),
		description: __( 'Quick visits', 'burst-statistics' ),
		minSeconds: 30,
		maxSeconds: 120
	},
	{
		label: __( '2m–10m', 'burst-statistics' ),
		description: __( 'Engaged', 'burst-statistics' ),
		minSeconds: 120,
		maxSeconds: 600
	},
	{
		label: __( '10m+', 'burst-statistics' ),
		description: __( 'Deep sessions', 'burst-statistics' ),
		minSeconds: 600,
		maxSeconds: null
	}
];

const DURATION_REGEX = /^\s*(\d+(?:\.\d+)?)\s*([smhSMH]?)\s*$/;

/**
 * Parse user duration to seconds. Accepts: 30s, 2m, 1h, 120.
 */
const parseDurationToSeconds = ( value: string ): number | null => {
	const trimmed = ( value || '' ).trim();
	if ( '' === trimmed ) {
		return null;
	}

	const match = trimmed.match( DURATION_REGEX );
	if ( ! match ) {
		return null;
	}

	const amount = parseFloat( match[1]);
	if ( Number.isNaN( amount ) || 0 > amount ) {
		return null;
	}

	const unit = ( match[2] || 's' ).toLowerCase();
	if ( 'm' === unit ) {
		return Math.round( amount * 60 );
	}
	if ( 'h' === unit ) {
		return Math.round( amount * 3600 );
	}

	return Math.round( amount );
};

/**
 * Parse a value string like "30-120" or "600-" into [minSeconds, maxSeconds | null]
 */
const parseValue = ( value: string ): [number | null, number | null] => {
	if ( ! value ) {
		return [ null, null ];
	}

	if ( value.includes( '-' ) ) {
		const dashIdx = value.indexOf( '-' );
		const minStr = value.slice( 0, dashIdx ).trim();
		const maxStr = value.slice( dashIdx + 1 ).trim();
		const parsedMin = parseDurationToSeconds( minStr );
		const parsedMax = '' !== maxStr ? parseDurationToSeconds( maxStr ) : null;
		const min = null !== parsedMin ? parsedMin : ( parseInt( minStr, 10 ) || null );
		const max = '' !== maxStr ?
			( null !== parsedMax ? parsedMax : ( parseInt( maxStr, 10 ) || null ) ) :
			null;
		return [ min, max ];
	}

	const parsed = parseDurationToSeconds( value );
	return [ null !== parsed ? parsed : ( parseInt( value, 10 ) || null ), null ];
};

interface TimePerSessionFilterSetupProps {
	filterKey: string;
	config: { label: string; icon: string; type: string };
	initialValue?: string;
	onChange: ( value: string ) => void;
}

const TimePerSessionFilterSetup: React.FC<TimePerSessionFilterSetupProps> = ({
	initialValue = '',
	onChange
}) => {
	const [ minInput, setMinInput ] = useState<string>( '' );
	const [ maxInput, setMaxInput ] = useState<string>( '' );
	const [ minSeconds, setMinSeconds ] = useState<number | null>( null );
	const [ maxSeconds, setMaxSeconds ] = useState<number | null>( null );
	const [ selectedPreset, setSelectedPreset ] = useState<number | null>( null );
	const [ minError, setMinError ] = useState<string>( '' );
	const [ maxError, setMaxError ] = useState<string>( '' );
	const [ rangeError, setRangeError ] = useState<string>( '' );

	// Parse initial value on mount and when initialValue changes.
	useEffect( () => {
		const [ min, max ] = parseValue( initialValue );
		setMinSeconds( min );
		setMaxSeconds( max );
		setMinInput( null === min ? '' : formatDuration( min ) );
		setMaxInput( null === max ? '' : formatDuration( max ) );
		setMinError( '' );
		setMaxError( '' );
		setRangeError( '' );

		// Detect matching preset.
		const idx = PRESETS.findIndex(
			( p ) => p.minSeconds === min && p.maxSeconds === max
		);
		setSelectedPreset( 0 <= idx ? idx : null );
	}, [ initialValue ]);

	const emitChange = useCallback(
		( min: number | null, max: number | null ) => {

			// Clear filter when range covers everything (0 to null).
			if ( null === min && null === max ) {
				onChange( '' );
				return;
			}

			// Lower bound is required for this filter; do not commit partial values.
			if ( null === min ) {
				return;
			}

			const maxStr = null !== max ? String( max ) : '';
			onChange( `${min}-${maxStr}` );
		},
		[ onChange ]
	);

	const validateAndApply = useCallback(
		( nextMinInput: string, nextMaxInput: string ) => {
			const trimmedMin = nextMinInput.trim();
			const trimmedMax = nextMaxInput.trim();

			const parsedMin = '' === trimmedMin ? null : parseDurationToSeconds( trimmedMin );
			const parsedMax = '' === trimmedMax ? null : parseDurationToSeconds( trimmedMax );

			if ( '' === trimmedMin ) {
				setMinError( __( 'Minimum duration is required.', 'burst-statistics' ) );
			} else if ( null === parsedMin ) {
				setMinError( __( 'Use a value like 30s, 2m, 1h, or 120.', 'burst-statistics' ) );
			} else {
				setMinError( '' );
			}

			if ( '' !== trimmedMax && null === parsedMax ) {
				setMaxError( __( 'Use a value like 30s, 2m, 1h, or 120.', 'burst-statistics' ) );
			} else {
				setMaxError( '' );
			}

			if ( null === parsedMin || ( '' !== trimmedMax && null === parsedMax ) ) {
				setRangeError( '' );
				return;
			}

			if ( null !== parsedMax && parsedMin > parsedMax ) {
				setRangeError( __( 'Minimum duration cannot be greater than maximum duration.', 'burst-statistics' ) );
				return;
			}

			setRangeError( '' );
			setMinSeconds( parsedMin );
			setMaxSeconds( parsedMax );

			return {
				min: parsedMin,
				max: parsedMax
			};
		},
		[]
	);

	const commitCurrentInputs = useCallback( () => {
		const parsed = validateAndApply( minInput, maxInput );
		if ( ! parsed ) {
			return;
		}
		emitChange( parsed.min, parsed.max );
	}, [ emitChange, maxInput, minInput, validateAndApply ]);

	const handlePresetClick = ( index: number ) => {
		const preset = PRESETS[ index ];
		setSelectedPreset( index );
		setMinSeconds( preset.minSeconds );
		setMaxSeconds( preset.maxSeconds );
		setMinInput( formatDuration( preset.minSeconds ) );
		setMaxInput( null === preset.maxSeconds ? '' : formatDuration( preset.maxSeconds ) );
		setMinError( '' );
		setMaxError( '' );
		setRangeError( '' );
		emitChange( preset.minSeconds, preset.maxSeconds );
	};

	const handleMinChange = ( e: React.ChangeEvent<HTMLInputElement> ) => {
		const raw = e.target.value;
		setMinInput( raw );
		setSelectedPreset( null );
		validateAndApply( raw, maxInput );
	};

	const handleMaxChange = ( e: React.ChangeEvent<HTMLInputElement> ) => {
		const raw = e.target.value;
		setMaxInput( raw );
		setSelectedPreset( null );
		validateAndApply( minInput, raw );
	};

	const isOpenEnded = null === maxSeconds;

	const summaryText = (): string => {
		if ( minError || maxError || rangeError ) {
			return '';
		}

		if ( null === minSeconds ) {
			return '';
		}

		if ( isOpenEnded ) {
			return sprintf(
				__( 'Showing sessions longer than %s.', 'burst-statistics' ),
				formatDuration( minSeconds )
			);
		}

		return sprintf(
			__( 'Showing sessions between %s and %s.', 'burst-statistics' ),
			formatDuration( minSeconds ),
			formatDuration( maxSeconds as number )
		);
	};

	return (
		<div className="space-y-5">
			{/* Preset pills */}
			<div>
				<label className="block text-sm font-medium text-gray-700 mb-2">
					{__( 'Quick select', 'burst-statistics' )}
				</label>

				<div className="flex flex-wrap gap-2">
					{
						PRESETS.map( ( preset, index ) => (
							<button
								key={index}
								type="button"
								onClick={() => handlePresetClick( index )}
								aria-pressed={selectedPreset === index}
								className={clsx(
								'inline-flex flex-col items-center px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 border',
									'focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1',
									selectedPreset === index ?
										'bg-primary border-primary text-white shadow-sm' :
										'bg-white border-gray-300 text-gray-700 hover:border-primary hover:bg-primary-light'
								)}
							>
								<span className="font-semibold leading-tight">{preset.label}</span>

								<span
									className={clsx( 'text-xs leading-tight', {
										'text-white opacity-80': selectedPreset === index,
										'text-gray-500': selectedPreset !== index
									})}
								>
									{preset.description}
								</span>
							</button>
						) )
					}
				</div>
			</div>

			{/* Custom range */}
			<div>
				<div className="mb-2">
					<label className="text-sm font-medium text-gray-700">
						{__( 'Custom range', 'burst-statistics' )}
					</label>

					<p className="text-xs text-gray-500 mt-1">
						{__( 'Use values like 30s, 2m, 10m, 1h.', 'burst-statistics' )}
					</p>
				</div>

				<div className="flex items-start gap-3">
					{/* Min input */}
					<div className="flex-1">
						<label className="block text-xs text-gray-500 mb-1">
							{__( 'Minimum', 'burst-statistics' )}
						</label>

						<TextInput
							type="text"
							value={minInput}
							onChange={handleMinChange}
							onBlur={commitCurrentInputs}
							placeholder="0s"
							className="w-full"
						/>
						{
							minError && (
								<p className="mt-1 text-xs text-red">{minError}</p>
							)
						}
					</div>

					<span className="mt-7 text-gray-400 select-none">–</span>

					{/* Max input */}
					<div className="flex-1">
						<label className="block text-xs text-gray-500 mb-1">
							{
								isOpenEnded ?
									__( 'No upper limit', 'burst-statistics' ) :
									__( 'Maximum', 'burst-statistics' )}
						</label>

						<TextInput
							type="text"
							value={maxInput}
							onChange={handleMaxChange}
							onBlur={commitCurrentInputs}
							placeholder={__( 'No limit', 'burst-statistics' )}
							className="w-full"
						/>
						{
							maxError && (
								<p className="mt-1 text-xs text-red">{maxError}</p>
							)
						}
					</div>
				</div>

				{
					rangeError && (
						<p className="mt-2 text-xs text-red-600">{rangeError}</p>
					)
				}

				{
					summaryText() && (
						<p className="mt-2 text-xs text-gray-500">
							{summaryText()}
						</p>
					)
				}

				{
					! summaryText() && (
						<p className="mt-2 text-xs text-gray-500">
							{__( 'Leave maximum empty for no upper limit.', 'burst-statistics' )}
						</p>
					)
				}
			</div>
		</div>
	);
};

export default TimePerSessionFilterSetup;

