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

    // Per-block-instance toggle for showing parameter variations under page rows.
    // Keyed by the DataTableBlock `id` prop so each block instance can be toggled independently.
    parameterVariations: Record<string, boolean>;

    rowsPerPage: Record<string, number | string>;

    getSelectedConfig: ( id: string, defaultValue: string ) => string;
    setSelectedConfig: ( id: string, value: string ) => void;
    getColumns: ( configKey: string, defaultColumns: string[]) => string[];
    setColumns: ( configKey: string, columns: string[]) => void;

    getSortConfig: ( configKey: string, defaultSort?: SortConfig ) => SortConfig | undefined;
    setSortConfig: ( configKey: string, sortConfig: SortConfig ) => void;
    clearSortConfig: ( configKey: string ) => void;

    getParameterVariations: ( id: string ) => boolean;
    setParameterVariations: ( id: string, value: boolean ) => void;

    getRowsPerPage: ( id: string, defaultValue: number | string ) => number | string;
    setRowsPerPage: ( id: string, value: number | string ) => void;
}

export const useDataTableStore = create<DataTableState>()(
    persist(
        ( set, get ) => ({
            selectedConfigs: {},
            columns: {},
            sortConfigs: {},
            parameterVariations: {},
            rowsPerPage: {},

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
            },

            getParameterVariations: ( id: string ) => {
                return !! get().parameterVariations[id];
            },

            setParameterVariations: ( id: string, value: boolean ) => {
                set( ( state ) => ({
                    parameterVariations: {
                        ...state.parameterVariations,
                        [id]: value
                    }
                }) );
            },

            getRowsPerPage: ( id: string, defaultValue: number | string ) => {
                return get().rowsPerPage[id] || defaultValue;
            },

            setRowsPerPage: ( id: string, value: number | string ) => {
                set( ( state ) => ({
                    rowsPerPage: {
                        ...state.rowsPerPage,
                        [id]: value
                    }
                }) );
            }
        }),
        {
            name: 'burst-datatable-storage',
            partialize: ( state ) => ({
                selectedConfigs: state.selectedConfigs,
                columns: state.columns,
                sortConfigs: state.sortConfigs,
                parameterVariations: state.parameterVariations,
                rowsPerPage: state.rowsPerPage
            })
        }
    )
);
