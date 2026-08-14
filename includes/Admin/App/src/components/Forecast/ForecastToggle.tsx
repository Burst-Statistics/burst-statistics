import { clsx } from 'clsx';

interface ForecastToggleProps {
	active: boolean;
	label: string;
	onClick: () => void;
}

/**
 * Shared pill toggle for enabling a chart's separately fetched forecast.
 */
export function ForecastToggle({
	active,
	label,
	onClick
}: ForecastToggleProps ): JSX.Element {
	return (
		<button
			type="button"
			onClick={ onClick }
			aria-pressed={ active }
			className={ clsx(
				'text-sm px-3 py-1 rounded-md border transition-colors focus:outline-hidden',
				active ?
					'bg-green-50 text-green border-green' :
					'bg-white text-text-gray border-gray-300 hover:bg-gray-50'
			) }
		>
			{ label }
		</button>
	);
}
