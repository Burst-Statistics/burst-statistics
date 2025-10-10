import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * Zustand store for managing A/B test variations.
 * Persists test assignments to localStorage to ensure consistent user experience.
 */
export const useABTestStore = create(
  persist(
    (set, get) => ({
      // Object to store test variations by test ID
      // Format: { testId: { variation: 'A', assignedAt: timestamp } }
      testVariations: {},

      /**
       * Get the assigned variation for a specific test.
       * @param {string} testId - Unique identifier for the test
       * @returns {string|null} - The assigned variation or null if not assigned
       */
      getTestVariation: (testId) => {
        const state = get();
        return state.testVariations[testId]?.variation || null;
      },

      /**
       * Assign a variation to a specific test.
       * @param {string} testId - Unique identifier for the test
       * @param {string} variation - The variation to assign (e.g., 'A', 'B')
       */
      setTestVariation: (testId, variation) => {
        set((state) => ({
          testVariations: {
            ...state.testVariations,
            [testId]: {
              variation,
              assignedAt: Date.now(),
            },
          },
        }));
      },

      /**
       * Randomly assign a variation from available options for a test.
       * @param {string} testId - Unique identifier for the test
       * @param {string[]} variations - Array of possible variations (e.g., ['A', 'B'])
       * @returns {string} - The randomly assigned variation
       */
      assignRandomVariation: (testId, variations) => {
        const randomIndex = Math.floor(Math.random() * variations.length);// nosemgrep
        const selectedVariation = variations[randomIndex];
        
        get().setTestVariation(testId, selectedVariation);
        return selectedVariation;
      },

      /**
       * Check if a test has an assigned variation.
       * @param {string} testId - Unique identifier for the test
       * @returns {boolean} - True if the test has an assigned variation
       */
      hasTestVariation: (testId) => {
        const state = get();
        return Boolean(state.testVariations[testId]);
      },

      /**
       * Get all test data for a specific test.
       * @param {string} testId - Unique identifier for the test
       * @returns {object|null} - Test data object or null if not found
       */
      getTestData: (testId) => {
        const state = get();
        return state.testVariations[testId] || null;
      },

      /**
       * Remove a test variation (useful for testing or cleanup).
       * @param {string} testId - Unique identifier for the test
       */
      removeTestVariation: (testId) => {
        set((state) => {
          const newTestVariations = { ...state.testVariations };
          delete newTestVariations[testId];
          return { testVariations: newTestVariations };
        });
      },

      /**
       * Clear all test variations (useful for testing or complete reset).
       */
      clearAllTests: () => {
        set({ testVariations: {} });
      },

      /**
       * Get metadata about all active tests.
       * @returns {object} - Summary of all active tests
       */
      getTestsSummary: () => {
        const state = get();
        return Object.entries(state.testVariations).reduce((summary, [testId, data]) => {
          summary[testId] = {
            variation: data.variation,
            assignedAt: data.assignedAt,
            assignedDate: new Date(data.assignedAt).toISOString(),
          };
          return summary;
        }, {});
      },
    }),
    {
      name: "burst-ab-test-storage",
      // Only persist the test variations data
      partialize: (state) => ({
        testVariations: state.testVariations,
      }),
    },
  ),
); 