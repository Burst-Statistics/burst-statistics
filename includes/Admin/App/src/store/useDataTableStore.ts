import {create} from 'zustand';
import {persist} from 'zustand/middleware';
import {resolveTableColumns} from '@/utils/resolveTableColumns';

/**
 * The column option fields the column resolver reads.
 */
interface ColumnOption {
    addWhenAvailable?: boolean;
}

interface SortConfig {
    fieldId: number | string;
    direction: 'asc' | 'desc';
}

interface DataTableState {
    selectedConfigs: Record<string, string>;
    columns: Record<string, string[]>;

    // The columns that existed when each selection was saved, so a column that
    // appears later can be told apart from one the user switched off.
    knownColumns: Record<string, string[]>;

    sortConfigs: Record<string, SortConfig>;

    // Per-block-instance toggle for showing parameter variations under page rows.
    // Keyed by the DataTableBlock `id` prop so each block instance can be toggled independently.
    parameterVariations: Record<string, boolean>;

    rowsPerPage: Record<string, number | string>;

    getSelectedConfig: ( id: string, defaultValue: string ) => string;
    setSelectedConfig: ( id: string, value: string ) => void;
    getColumns: ( configKey: string, defaultColumns: string[], columnsOptions: Record<string, ColumnOption> ) => string[];
    setColumns: ( configKey: string, columns: string[], availableColumns: string[]) => void;

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
            knownColumns: {},
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

            getColumns: ( configKey: string, defaultColumns: string[], columnsOptions: Record<string, ColumnOption> ) => {
                return resolveTableColumns({
                    saved: get().columns[configKey],
                    known: get().knownColumns[configKey],
                    defaults: defaultColumns,
                    available: Object.keys( columnsOptions ),
                    addWhenAvailable: Object.keys( columnsOptions ).filter( ( column ) => columnsOptions[column]?.addWhenAvailable )
                });
            },

            setColumns: ( configKey: string, columns: string[], availableColumns: string[]) => {
                set( ( state ) => ({
                    columns: {
                        ...state.columns,
                        [configKey]: columns
                    },
                    knownColumns: {
                        ...state.knownColumns,
                        [configKey]: availableColumns
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
                knownColumns: state.knownColumns,
                sortConfigs: state.sortConfigs,
                parameterVariations: state.parameterVariations,
                rowsPerPage: state.rowsPerPage
            })
        }
    )
);
