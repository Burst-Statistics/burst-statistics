import React from 'react';
import { __ } from '@wordpress/i18n';

/**
 * Step through the elements a selector matches.
 *
 * @param {Object}   props        Component props.
 * @param {number}   props.index  The match currently shown.
 * @param {number}   props.total  How many elements match.
 * @param {Function} props.onStep Move by the given number of matches.
 * @return {JSX.Element} The stepper.
 */
const MatchStepper = ({ index, total, onStep }) => (
	<div
		role="group"
		aria-label={__( 'Step through matches', 'burst-statistics' )}
		className="flex shrink-0 items-center overflow-hidden rounded border border-gray-400"
	>
		<button
			type="button"
			onClick={() => onStep( -1 )}
			className="bg-gray-100 px-2 py-1 text-text-gray hover:bg-gray-200"
			aria-label={__( 'Previous match', 'burst-statistics' )}
		>
			←
		</button>
		<span className="px-2 py-1 text-sm text-text-gray">
			{index + 1}/{total}
		</span>
		<button
			type="button"
			onClick={() => onStep( 1 )}
			className="bg-gray-100 px-2 py-1 text-text-gray hover:bg-gray-200"
			aria-label={__( 'Next match', 'burst-statistics' )}
		>
			→
		</button>
	</div>
);

export default MatchStepper;
