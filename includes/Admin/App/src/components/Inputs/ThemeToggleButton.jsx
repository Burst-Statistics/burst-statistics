import { useTheme } from '../../hooks/useTheme';
import Icon from '../../utils/Icon';
import { __ } from '@wordpress/i18n';

export default function ThemeToggleButton() {
	const { isDarkTheme, toggleTheme } = useTheme();

	const handleToggle = () => {
		toggleTheme();
	};

	return (
		<button
			type="button"
			onClick={handleToggle}
			role="switch"
			aria-checked={isDarkTheme}
			aria-label={__( 'Toggle dark theme', 'burst-statistics' )}
			className={`relative inline-flex h-6 w-11 items-center rounded-full border transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 ${
				isDarkTheme ?
					'bg-primary border-primary' :
					'bg-gray-400 border-gray-400 dark:bg-gray-600 dark:border-gray-600'
			}`}
			title={
				isDarkTheme ?
					__( 'Switch to light mode', 'burst-statistics' ) :
					__( 'Switch to dark mode', 'burst-statistics' )
			}
		>
			<span
				className={`absolute inline-flex items-center justify-center h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 ${
					isDarkTheme ? 'translate-x-5' : 'translate-x-1'
				}`}
			>
				<Icon
					name={isDarkTheme ? 'moon' : 'sun'}
					size={12}
					className={isDarkTheme ? 'text-gray-700' : 'text-yellow-500'}
				/>
			</span>
		</button>
	);
}
