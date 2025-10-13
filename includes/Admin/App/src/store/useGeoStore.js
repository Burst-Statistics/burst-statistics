import { create } from "zustand";
import { persist } from "zustand/middleware";
import { __ } from "@wordpress/i18n";

const initialDefaultView = {
  level: "world",
  id: null,
  parentId: null,
  title: "World View",
};

// Default projection values
const DEFAULT_PROJECTION = {
  scale: 144,
  translation: [0.5, 0.5],
  rotation: [0, 0, 0],
};

export const metricOptions = {
  visitors: {
    label: __("Visitors", "burst-statistics"),
    recommendedClassification: "natural-breaks",
    default: true,
    colorScheme: "greens",
    isPercentage: false,
    showPercentageOfTotal: true,
    precision: 0,
    suffix: "",
  },
  sessions: {
    label: __("Sessions", "burst-statistics"),
    recommendedClassification: "natural-breaks",
    colorScheme: "greens",
    isPercentage: false,
    showPercentageOfTotal: true,
    precision: 0,
    suffix: "",
  },
  bounce_rate: {
    label: __("Bounce Rate", "burst-statistics"),
    recommendedClassification: "equal-interval",
    colorScheme: "blueRedDiverging",
    isPercentage: true,
    showPercentageOfTotal: false,
    precision: 1,
    suffix: "%",
  },
  avg_session_duration: {
    label: __("Avg. Session Duration", "burst-statistics"),
    recommendedClassification: "standard-deviation",
    colorScheme: "blueRedDiverging",
    isPercentage: false,
    isTime: true,
    showPercentageOfTotal: false,
    precision: 0,
    suffix: "s",
  },
  conversion_rate: {
    label: __("Conversion Rate", "burst-statistics"),
    recommendedClassification: "natural-breaks",
    colorScheme: "greens",
    isPercentage: true,
    showPercentageOfTotal: false,
    precision: 2,
    suffix: "%",
  },
};

export const classificationOptions = {
  "natural-breaks": {
    label: __("Natural Breaks (Jenks)", "burst-statistics"),
    description: __(
      "Finds patterns in the data to create categories with minimal variation within groups. Works well for all metrics, especially Pageviews and Conversion Rate.",
      "burst-statistics",
    ),
  },

  "equal-interval": {
    label: __("Equal Interval", "burst-statistics"),
    description: __(
      "Splits the data range into equal-sized intervals. Ideal for percentage-based metrics like Bounce Rate or Conversion Rate.",
      "burst-statistics",
    ),
  },
  "standard-deviation": {
    label: __("Standard Deviation", "burst-statistics"),
    description: __(
      "Groups data based on how far values deviate from the average. Highlights outliers in metrics like Bounce Rate or Avg. Session Duration.",
      "burst-statistics",
    ),
  },
  quantile: {
    label: __("Quantile", "burst-statistics"),
    description: __(
      "Divides data into equal-sized groups, ensuring each category has the same number of regions. Best for evenly distributed metrics like Pageviews or Visitors.",
      "burst-statistics",
    ),
  },
};

export const useGeoStore = create(
  persist(
    (set, get) => ({
      selectedMetric: "visitors",
      setSelectedMetric: (metric) => set({ selectedMetric: metric }),

      // Map visualization settings
      patternsEnabled: false,
      setPatternsEnabled: (enabled) => set({ patternsEnabled: enabled }),

      classificationMethod: "quantile",
      setClassificationMethod: (method) =>
        set({ classificationMethod: method }),

      // Zoom target state for map transitions
      zoomTarget: null,
      setZoomTarget: (target) => set({ zoomTarget: target }),

      defaultView: initialDefaultView,
      currentView: initialDefaultView,
      currentViewHasIncompleteData: false,
      setCurrentViewHasIncompleteData: (hasIncompleteData) => {
        set({ currentViewHasIncompleteData: hasIncompleteData });
      },
      currentViewMissingData: null,
      setCurrentViewMissingData: (missingData) => {
        set({ currentViewMissingData: missingData });
      },

      history: [initialDefaultView],

      projection: { ...DEFAULT_PROJECTION },
      longitude: 0,
      navigateToView: (nextViewConfig) => {
        set((state) => ({
          currentView: nextViewConfig,
          history: [...state.history, nextViewConfig],
        }));
        // After navigating, we can clear the zoom target to prevent re-zooming on re-renders
        setTimeout(() => set({ zoomTarget: null }), 750);
      },
      navigateBack: () => {
        set((state) => {
          if (state.history.length > 1) {
            const newHistory = state.history.slice(0, -1);
            const newCurrentView = newHistory[newHistory.length - 1];

            // Set zoom target to reset when going back
            const shouldResetProjection = newCurrentView.level === "world";

            return {
              history: newHistory,
              currentView: newCurrentView,
              zoomTarget: shouldResetProjection ? "reset" : null,
              ...(shouldResetProjection && {
                projection: { ...DEFAULT_PROJECTION },
              }),
            };
          }
          return {};
        });
        // After navigating back, clear the zoom target
        setTimeout(() => set({ zoomTarget: null }), 750);
      },
      resetGeoToDefault: () => {
        const defaultV = get().defaultView;
        set({
          currentView: defaultV,
          history: [defaultV],
          projection: { ...DEFAULT_PROJECTION },
          zoomTarget: "reset",
        });
        setTimeout(() => set({ zoomTarget: null }), 750);
      },
      setProjection: (projectionValues) => {
        set((state) => ({
          projection: {
            ...state.projection,
            ...projectionValues,
          },
        }));
      },

      // Auto-select option value and setter
      autoSelectOption: null,
      setAutoSelectOption: (option) => set({ autoSelectOption: option }),

      // Incomplete data notice dismissal
      incompleteDataNoticeDismissedAt: null,
      isIncompleteDataNoticeDismissed: false,
      dismissIncompleteDataNotice: () => {
        const now = Date.now();
        set({ 
          incompleteDataNoticeDismissedAt: now,
          isIncompleteDataNoticeDismissed: true
        });
      },
      // Helper function to check if the dismissal has expired
      checkDismissalExpiry: () => {
        const state = get();
        const dismissedAt = state.incompleteDataNoticeDismissedAt;
        if (!dismissedAt) {
          return set({ isIncompleteDataNoticeDismissed: false });
        }
        // Check if dismissed more than 30 days ago
        const thirtyDaysInMs = 30 * 24 * 60 * 60 * 1000;
        const isStillDismissed = Date.now() - dismissedAt < thirtyDaysInMs;
        set({ isIncompleteDataNoticeDismissed: isStillDismissed });
      },
    }),
    {
      name: "burst-geo-storage",
      partialize: (state) => ({
        selectedMetric: state.selectedMetric,
        currentView: state.currentView,
        history: state.history,
        patternsEnabled: state.patternsEnabled,
        classificationMethod: state.classificationMethod,
        autoSelectOption: state.autoSelectOption,
        incompleteDataNoticeDismissedAt: state.incompleteDataNoticeDismissedAt,
        isIncompleteDataNoticeDismissed: state.isIncompleteDataNoticeDismissed,
      }),
    },
  ),
);
