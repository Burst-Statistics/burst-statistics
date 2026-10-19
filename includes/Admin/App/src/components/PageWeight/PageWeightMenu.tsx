import { useState } from 'react';
import { __ } from '@wordpress/i18n';
import * as Popover from '@radix-ui/react-popover';
import * as Checkbox from '@radix-ui/react-checkbox';
import Icon from '@/utils/Icon';
import { burst_get_website_url } from '@/utils/lib';
import { usePageWeightStore } from '@/store/usePageWeightStore';

type PageWeightMenuProps = {

	/** Whether the green hosting preview applies to this site at all. */
	showGreenHosting: boolean;
};

type MenuCheckboxProps = {
	id: string;
	label: string;
	checked: boolean;
	onCheckedChange: ( checked: boolean ) => void;
};

/**
 * A single checkbox row in the Page weight options menu.
 *
 * @param {MenuCheckboxProps} props - Component props.
 * @return {JSX.Element} The checkbox row.
 */
const MenuCheckbox = ({ id, label, checked, onCheckedChange }: MenuCheckboxProps ) => (
	<label
		htmlFor={id}
		className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-sm text-text-black transition-colors hover:bg-gray-100 select-none"
	>
		<Checkbox.Root
			id={id}
			className="flex h-4 w-4 shrink-0 items-center justify-center rounded border-2 border-gray-300 bg-white transition-colors hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 cursor-pointer"
			checked={checked}
			onCheckedChange={( value ) => onCheckedChange( true === value )}
		>
			<Checkbox.Indicator>
				<Icon name="check" size={11} color="green" strokeWidth={2.5} />
			</Checkbox.Indicator>
		</Checkbox.Root>
		{label}
	</label>
);

/**
 * Options menu for the Page weight block.
 *
 * Every item here is a per-reader display choice held in localStorage,
 * including the green hosting preview: the server sends the green figures with
 * the payload, so switching to them makes no request. The preview is offered
 * only to sites that are not already verified green, where there is nothing
 * left to imagine.
 *
 * @param {PageWeightMenuProps} props - Component props.
 * @return {JSX.Element} The options menu.
 */
const PageWeightMenu = ({ showGreenHosting }: PageWeightMenuProps ) => {
	const [ isOpen, setIsOpen ] = useState( false );
	const showCo2 = usePageWeightStore( ( state ) => state.showCo2 );
	const showRating = usePageWeightStore( ( state ) => state.showRating );
	const assumeGreenHosting = usePageWeightStore( ( state ) => state.assumeGreenHosting );
	const toggleCo2 = usePageWeightStore( ( state ) => state.toggleCo2 );
	const toggleRating = usePageWeightStore( ( state ) => state.toggleRating );
	const toggleAssumeGreenHosting = usePageWeightStore( ( state ) => state.toggleAssumeGreenHosting );

	return (
		<Popover.Root open={isOpen} onOpenChange={setIsOpen}>
			<Popover.Trigger asChild>
				<button
					type="button"
					className="inline-flex items-center justify-center rounded-md p-1.5 text-gray-500 transition-colors hover:bg-gray-200 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 cursor-pointer"
					aria-label={__( 'Page weight options', 'burst-statistics' )}
					title={__( 'Page weight options', 'burst-statistics' )}
				>
					<Icon name="ellipsis" size={14} />
				</button>
			</Popover.Trigger>
			{/* No Popover.Portal: every Tailwind utility is generated scoped to
				the app root (:is(#burst-statistics,#burst-mainwp,.burst) .x), so
				content portaled to document.body renders unstyled. */}
			<Popover.Content
				align="end"
				sideOffset={4}
				className="z-dropdown w-64 rounded-lg border border-gray-200 bg-white p-1.5 shadow-lg"
			>
				<MenuCheckbox
					id="burst-page-weight-show-co2"
					label={__( 'Show CO2 estimate', 'burst-statistics' )}
					checked={showCo2}
					onCheckedChange={toggleCo2}
				/>
				<MenuCheckbox
					id="burst-page-weight-show-rating"
					label={__( 'Show carbon rating', 'burst-statistics' )}
					checked={showRating}
					onCheckedChange={toggleRating}
				/>
				{ showGreenHosting && (
					<MenuCheckbox
						id="burst-page-weight-green-hosting"
						label={__( 'Calculate with green hosting', 'burst-statistics' )}
						checked={assumeGreenHosting}
						onCheckedChange={toggleAssumeGreenHosting}
					/>
				) }
				<div className="my-1.5 border-t border-gray-200" />
				<a
					href={burst_get_website_url( '/how-we-estimate-co2-emissions/', {
						utm_source: 'page-weight-block',
						utm_medium: 'menu',
						utm_content: 'how-we-estimate'
					})}
					target="_blank"
					rel="noopener noreferrer"
					className="block rounded-md px-2 py-1.5 text-sm text-text-black transition-colors hover:bg-gray-100"
				>
					{__( 'How we estimate', 'burst-statistics' )}
				</a>
			</Popover.Content>
		</Popover.Root>
	);
};

export default PageWeightMenu;
