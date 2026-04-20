import * as Popover from '@radix-ui/react-popover';
import { __ } from '@wordpress/i18n';
import { useState } from 'react';
import { useTheme } from '@/hooks/useTheme';
import Icon from '@/utils/Icon';

type ThemeOption = 'light' | 'system' | 'dark';

const themeOptions: Array<{ value: ThemeOption; label: string; title: string; icon: 'sun' | 'desktop' | 'moon' }> = [
	{
		value: 'light',
		label: __( 'Light', 'burst-statistics' ),
		title: __( 'Light theme', 'burst-statistics' ),
		icon: 'sun'
	},
	{
		value: 'system',
		label: __( 'System', 'burst-statistics' ),
		title: __( 'Follow your device appearance setting and switch automatically between light and dark.', 'burst-statistics' ),
		icon: 'desktop'
	},
	{
		value: 'dark',
		label: __( 'Dark', 'burst-statistics' ),
		title: __( 'Dark theme', 'burst-statistics' ),
		icon: 'moon'
	}
];

const HeaderThemeMenu = () => {
	const [ isOpen, setIsOpen ] = useState( false );
	const { themePreference, setThemePreference, isHostManagedContext } = useTheme();

	if ( isHostManagedContext ) {
		return null;
	}

	return (
		<Popover.Root open={isOpen} onOpenChange={setIsOpen}>
			<Popover.Trigger asChild>
				<button
					className="focus:ring-blue-500 rounded-md p-2.5 transition-all duration-200 hover:bg-gray-100 focus:outline-hidden focus:ring-2 focus:ring-offset-2"
					aria-label={__( 'Open theme menu', 'burst-statistics' )}
					title={__( 'Theme settings', 'burst-statistics' )}
					type="button"
				>
					<Icon name="preferences" />
				</button>
			</Popover.Trigger>
			<Popover.Content
				className="z-200 min-w-[280px] rounded-lg border border-gray-200 bg-white p-4 shadow-xl"
				align="end"
				sideOffset={8}
			>
				<div className="flex items-center justify-between gap-4">
					<span className="text-sm font-medium text-text-black">
						{__( 'Theme', 'burst-statistics' )}
					</span>

					<div className="grid w-32 grid-cols-3 rounded-full bg-gray-200 p-0.5">
						{themeOptions.map( ( option ) => {
							const isActive = themePreference === option.value;
							return (
								<button
									key={option.value}
									type="button"
									className={`flex h-8 items-center justify-center rounded-full transition-colors ${
										isActive ?
											'bg-white text-text-black shadow-sm' :
											'text-text-gray hover:text-text-black'
									}`}
									onClick={() => setThemePreference( option.value )}
									aria-label={option.label}
									title={option.title}
									aria-pressed={isActive}
								>
									<Icon name={option.icon} size={14} />
								</button>
							);
						})}
					</div>
				</div>
			</Popover.Content>
		</Popover.Root>
	);
};

export default HeaderThemeMenu;
