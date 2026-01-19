import {create} from 'zustand';
import {persist} from 'zustand/middleware';

interface SortConfig {
    fieldId: number | string;
    direction: 'asc' | 'desc';
}

interface DataTableState {
    selectedConfigs: Record<string, string>;
    columns: Record<string, string[]>;

    sortConfigs: Record<string, SortConfig>;

    getSelectedConfig: ( id: string, defaultValue: string ) => string;
    setSelectedConfig: ( id: string, value: string ) => void;
    getColumns: ( configKey: string, defaultColumns: string[]) => string[];
    setColumns: ( configKey: string, columns: string[]) => void;

    getSortConfig: ( configKey: string, defaultSort?: SortConfig ) => SortConfig | undefined;
    setSortConfig: ( configKey: string, sortConfig: SortConfig ) => void;
    clearSortConfig: ( configKey: string ) => void;
}

export const useDataTableStore = create<DataTableState>()(
    persist(
        ( set, get ) => ({
            selectedConfigs: {},
            columns: {},
            sortConfigs: {},

            getSelectedConfig: ( id: string, defaultValue: string ) => {
                return get().selectedConfigs[id] || defaultValue;
            },

            setSelectedConfig: ( id: string, value: string ) => {
                set( ( state ) => ({
                    selectedConfigs: {
                        ...state.selectedConfigs,
                        [id]: value
                    }
                }) );
            },

            getColumns: ( configKey: string, defaultColumns: string[]) => {
                return get().columns[configKey] || defaultColumns;
            },

            setColumns: ( configKey: string, columns: string[]) => {
                set( ( state ) => ({
                    columns: {
                        ...state.columns,
                        [configKey]: columns
                    }
                }) );
            },

            getSortConfig: ( configKey: string, defaultSort?: SortConfig ) => {
                return get().sortConfigs[configKey] || defaultSort;
            },

            setSortConfig: ( configKey: string, sortConfig: SortConfig ) => {
                set( ( state ) => ({
                    sortConfigs: {
                        ...state.sortConfigs,
                        [configKey]: sortConfig
                    }
                }) );
            },

            clearSortConfig: ( configKey: string ) => {
                set( ( state ) => {
					// eslint-disable-next-line @typescript-eslint/no-unused-vars
                    const {[configKey]: _, ...rest} = state.sortConfigs;
                    return {sortConfigs: rest};
                });
            }
        }),
        {
            name: 'burst-datatable-storage',
            partialize: ( state ) => ({
                selectedConfigs: state.selectedConfigs,
                columns: state.columns,
                sortConfigs: state.sortConfigs
            })
        }
    )
);
