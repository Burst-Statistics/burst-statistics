import { create, StateCreator } from 'zustand';
import { persist } from 'zustand/middleware';

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
	groups: Record<string, TabValue>;
	setActiveTab: ( group: string, value: TabValue ) => void;
	getActiveTab: ( group: TabValue, defaultValue?: TabValue ) => TabValue | undefined;
}

/**
 * Creates a Zustand store for managing tab state.
 * @param persisted - Whether to persist the state in localStorage.
 *
 * @return A Zustand store with tab state management.
 */
export const createTabsStore = ( persisted = true ) => {
	const stateCreator: StateCreator<TabsState> = ( set, get ) => ({
		groups: {},

		/**
		 * Set the active tab for a specific group.
		 *
		 * @param { string }   group - The group identifier.
		 * @param { TabValue } id    - The value of the tab to set as active.
		 *
		 * @return void
		 */
		setActiveTab: ( group: string, id: TabValue ) =>
			set( ( state ) => {
				return {
					groups: { ...state.groups, [group]: id }
				};
			}),

		/**
		 * Get the active tab for a specific group.
		 * If no tab is set and a default value is provided, it will be set automatically.
		 *
		 * @param { string }        group        - The group identifier.
		 * @param { TabValue }     [defaultValue] - Optional default value to set if no tab is active.
		 *
		 * @return { TabValue | undefined } The value of the active tab, or undefined if not set.
		 */
		getActiveTab: ( group: string, defaultValue?: TabValue ): TabValue | undefined => {
			const current = get().groups[group];
			if ( undefined === current && defaultValue ) {
				set( ( state ) => ({
					groups: { ...state.groups, [group]: defaultValue }
				}) );
				return defaultValue;
			}
			return current;
		}
	});
	if ( persisted ) {
		return create<TabsState>()(
			persist( stateCreator, {
				name: 'burst-tabs-storage' // key in localStorage
			})
		);
	}

	return create<TabsState>( stateCreator );
};

/**
 * Persisted tabs store instance.
 */
export const usePersistedTabsStore = createTabsStore();

/**
 * Non-persisted tabs store instance.
 */
export const useNonPersistedTabsStore = createTabsStore( false );
