import React from "react";
import clsx from "clsx";
import { useNonPersistedTabsStore, TabValue } from "@/store/useTabsStore";

/**
 * Props for the TabsTrigger component.
 *
 * @interface TabsTriggerProps
 */
export interface TabsTriggerProps
	extends Omit< React.ButtonHTMLAttributes< HTMLButtonElement >, "onChange" > {
	group: string;
	id: TabValue;
	activeStyle?: string;
}

/**
 * Tab trigger component.
 *
 * @param {TabsTriggerProps} props - Component props.
 * @param {string} props.group - The group identifier for the tab.
 * @param {TabValue} props.id - The id of the tab.
 * @param {string} [props.className] - Additional class names.
 * @param {string} [props.activeStyle] - Class names applied when the tab is active.
 * @param {React.ReactNode} props.children - The content of the tab trigger.
 * @param {function} [props.onClick] - Click event handler.
 * @param {object} [rest] - Additional button attributes.
 *
 * @returns {JSX.Element} The rendered tab trigger component.
 */
export function TabsTrigger( { group, id, className, activeStyle, children, onClick, ...rest }: TabsTriggerProps ) {
	const activeTab = useNonPersistedTabsStore( ( state ) => state.getActiveTab( group ) );
	const setActiveTab = useNonPersistedTabsStore( ( state ) => state.setActiveTab );
	const selected        = activeTab === id;

	/**
	 * Handle click on the tab trigger
	 *
	 * @param e - Mouse event
	 *
	 * @returns void
	 */
	const handleClick = ( e: React.MouseEvent< HTMLButtonElement > )  => {
		setActiveTab( group, id );
		onClick?.( e );
	};
	const activeClassesByVariant = {
		blue: [
			'data-[active="true"]:bg-blue-lighter',
			'data-[active="true"]:border-blue-darker',
			'data-[active="true"]:text-[#1E73BE]'
		],
		green: [
			'data-[active="true"]:bg-brand-lightest',
			'data-[active="true"]:border-brand',
			'data-[active="true"]:text-brand'
		],
	} as const;

	const activeVariant = activeStyle === 'green' ? 'green' : 'blue';

	return (
		<button
			className={ clsx(
				"text-base px-4 py-1 transition-colors rounded-sm bg-white focus:outline-none text-gray-600 hover:text-gray-900 font-medium border border-transparent",
				activeClassesByVariant[ activeVariant ],
				className
			) }
			onClick={ handleClick }
			data-active={ selected || undefined }
			{ ...rest }
		>
			{ children }
		</button>
	);
}
