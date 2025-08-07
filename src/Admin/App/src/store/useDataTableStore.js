import { create } from "zustand";
import { persist } from "zustand/middleware";

export const useDataTableStore = create(
  persist(
    (set, get) => ({
      // Selected configuration for each table instance
      selectedConfigs: {},
      setSelectedConfig: (id, config) => {
        set((state) => ({
          selectedConfigs: {
            ...state.selectedConfigs,
            [id]: config
          }
        }));
      },
      getSelectedConfig: (id, defaultConfig) => {
        const state = get();
        return state.selectedConfigs[id] || defaultConfig;
      },

      // Column configurations for each table type
      columnConfigs: {},
      setColumns: (configType, columns) => {
        set((state) => ({
          columnConfigs: {
            ...state.columnConfigs,
            [configType]: columns
          }
        }));
      },
      getColumns: (configType, defaultColumns) => {
        const state = get();
        return state.columnConfigs[configType] || defaultColumns;
      },

      // Search filter text for each table instance (optional persistence)
      filterTexts: {},
      setFilterText: (id, text) => {
        set((state) => ({
          filterTexts: {
            ...state.filterTexts,
            [id]: text
          }
        }));
      },
      getFilterText: (id) => {
        const state = get();
        return state.filterTexts[id] || '';
      },

      // Clear all data for a specific table instance
      clearTableData: (id) => {
        set((state) => {
          const newSelectedConfigs = { ...state.selectedConfigs };
          const newFilterTexts = { ...state.filterTexts };
          
          delete newSelectedConfigs[id];
          delete newFilterTexts[id];
          
          return {
            selectedConfigs: newSelectedConfigs,
            filterTexts: newFilterTexts
          };
        });
      },

      // Reset all data
      resetAll: () => {
        set({
          selectedConfigs: {},
          columnConfigs: {},
          filterTexts: {}
        });
      }
    }),
    {
      name: "burst-datatable-storage",
      version: 1.1,
      partialize: (state) => ({
        selectedConfigs: state.selectedConfigs,
        columnConfigs: state.columnConfigs,
        // Optionally persist filter texts (you might not want to persist search terms)
        // filterTexts: state.filterTexts,
      }),
    },
  ),
); 