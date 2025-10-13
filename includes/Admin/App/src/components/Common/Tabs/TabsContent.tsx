import React from "react";
import { useNonPersistedTabsStore, TabValue } from "@/store/useTabsStore";

/**
 * Props for the TabsContent component.
 *
 * @interface TabsContentProps
 */
export interface TabsContentProps extends React.HTMLAttributes< HTMLDivElement > {
	group: string;
	id: TabValue;
	storeHook?: typeof useNonPersistedTabsStore;
}

/**
 * Tab content component.
 *
 * @param {TabsContentProps} props - Component props.
 * @param {string} props.group - The group identifier for the tab.
 * @param {TabValue} props.id - The value of the tab.
 * @param {string} [props.className] - Additional class names.
 * @param {React.ReactNode} props.children - The content of the tab.
 * @param {function} [props.storeHook] - Custom store hook for managing tab state.
 * @param {object} [rest] - Additional div attributes.
 *
 * @returns {JSX.Element | null} The rendered tab content component or null if not active.
 */
export function TabsContent( { className = '', group, id, children, storeHook = useNonPersistedTabsStore, ...rest }: TabsContentProps ) {
	const { getActiveTab } = storeHook();
	const selected = getActiveTab( group ) === id;

	if ( ! selected ) {
		return null;
	}

	return (
		<div className={ "burst-scroll px-6 max-m:px-2.5 py-8 h-[305px] overflow-y-auto rounded-none " + className } { ...rest }>
			{ children }
		</div>
	);
}
