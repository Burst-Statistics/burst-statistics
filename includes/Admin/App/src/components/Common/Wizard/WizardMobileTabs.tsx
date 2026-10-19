import { clsx } from 'clsx';

interface WizardMobileTab<T extends string> {
	id: T;
	label: string;
}

interface WizardMobileTabsProps<T extends string> {
	tabs: WizardMobileTab<T>[];
	activeTab: T;
	onChange: ( tab: T ) => void;
}

/**
 * Below lg a wizard shows one column at a time; these tabs switch between the form and its side panel.
 *
 * @param {WizardMobileTabsProps} props           Component props.
 * @param {Array}                 props.tabs      The tabs, in order.
 * @param {string}                props.activeTab Id of the visible tab.
 * @param {Function}              props.onChange  Called with the id of the tab to show.
 * @return {JSX.Element} The tab bar.
 */
const WizardMobileTabs = <T extends string>({ tabs, activeTab, onChange }: WizardMobileTabsProps<T> ): JSX.Element => (
	<div className="lg:hidden flex justify-center py-2 px-4 bg-gray-200 border-b border-gray-300 gap-2 shrink-0">
		{tabs.map( ( tab ) => (
			<button
				key={tab.id}
				type="button"
				onClick={() => onChange( tab.id )}
				className={clsx(
					'px-4 py-1 rounded-full text-xs font-semibold transition-colors cursor-pointer',
					tab.id === activeTab ? 'bg-blue text-white shadow-xs' : 'bg-gray-100 text-text-gray-light hover:text-text-gray'
				)}
			>
				{tab.label}
			</button>
		) )}
	</div>
);

export default WizardMobileTabs;
