import { create, StateCreator } from "zustand";
import { persist } from "zustand/middleware";

/**
 * Type representing the value of a tab.
 */
export type TabValue = string;

/**
 * Interface for the tab state.
 *
 * @interface TabsState
 */
interface TabsState {
	groups: Record< string, TabValue >;
	setActiveTab: ( group: string, value: TabValue ) => void;
	getActiveTab: ( group: TabValue ) => TabValue | undefined;
}

/**
 * Creates a Zustand store for managing tab state.
 * @param persisted - Whether to persist the state in localStorage.
 *
 * @returns A Zustand store with tab state management.
 */
export const createTabsStore = ( persisted = true ) => {
	const stateCreator: StateCreator< TabsState > = ( set, get ) => (
		{
			groups: {},

			/**
			 * Set the active tab for a specific group.
			 *
			 * @param { string }   group - The group identifier.
			 * @param { TabValue } id - The value of the tab to set as active.
			 *
			 * @returns void
			 */
			setActiveTab: ( group: string, id: TabValue ) =>
				set(
					( state ) => {
						return {
							groups: { ...state.groups, [ group ]: id },
						};
					}
				),

			/**
			 * Get the active tab for a specific group.
			 *
			 * @param { string } group - The group identifier.
			 *
			 * @returns { TabValue | undefined } The value of the active tab, or undefined if not set.
			 */
			getActiveTab: ( group: string): TabValue | undefined => get().groups[ group ],
		}
	);
	if ( persisted ) {
		return create< TabsState >()(
			persist(
				stateCreator,
				{
					name: "burst-tabs-storage", // key in localStorage
				}
			)
		);
	}

	return create< TabsState >(
		stateCreator
	);
};

/**
 * Persisted tabs store instance.
 */
export const usePersistedTabsStore = createTabsStore();

/**
 * Non-persisted tabs store instance.
 */
export const useNonPersistedTabsStore = createTabsStore( false );
