import { useABTestStore } from "@/store/useABTestStore.js";
import { useMemo } from "react";

interface ABTestOptions {
  defaultVariation?: string;
  trafficAllocation?: number;
}

interface ABTestResult {
  variation: string;
  isNewAssignment: boolean;
  testData: { variation: string; assignedAt: number } | null;
  isInTest: boolean;
  reassign: () => string;
}

interface ABTestControlResult {
  getVariation: () => string | null;
  setVariation: (variation: string) => void;
  assignRandom: (variations: string[]) => string;
  hasVariation: () => boolean;
  getTestData: () => { variation: string; assignedAt: number } | null;
  removeTest: () => void;
}

/**
 * Custom hook for A/B testing that automatically assigns and persists test variations.
 * 
 * @param testId - Unique identifier for the test (e.g., 'upsell-copy-v1', 'header-cta')
 * @param variations - Array of possible variations (e.g., ['A', 'B'] or ['control', 'variant1', 'variant2'])
 * @param options - Optional configuration
 * 
 * @returns Object containing the assigned variation and test metadata
 */
export const useABTest = (
  testId: string, 
  variations: string[] = ['A', 'B'], 
  options: ABTestOptions = {}
): ABTestResult => {
  const {
    defaultVariation = variations[0],
    trafficAllocation = 100,
  } = options;

  const {
    getTestVariation,
    setTestVariation,
    assignRandomVariation,
    hasTestVariation,
    getTestData,
    removeTestVariation,
  } = useABTestStore();

  // Validate inputs
  if (!testId || typeof testId !== 'string') {
    throw new Error('useABTest: testId must be a non-empty string');
  }

  if (!Array.isArray(variations) || variations.length === 0) {
    throw new Error('useABTest: variations must be a non-empty array');
  }

  if (trafficAllocation < 0 || trafficAllocation > 100) {
    throw new Error('useABTest: trafficAllocation must be between 0 and 100');
  }

  // Memoize the assignment logic to prevent unnecessary re-assignments
  const testResult = useMemo(() => {
    // Check if user should be included in the test based on traffic allocation
    const shouldIncludeInTest = trafficAllocation === 100 || 
      (Math.random() * 100) < trafficAllocation; // nosemgrep

    if (!shouldIncludeInTest) {
      return {
        variation: defaultVariation,
        isNewAssignment: false,
        testData: null,
        isInTest: false,
      };
    }

    // Check if variation already exists
    const existingVariation = getTestVariation(testId);
    
    if (existingVariation) {
      // Verify the existing variation is still valid
      if (variations.includes(existingVariation)) {
        return {
          variation: existingVariation,
          isNewAssignment: false,
          testData: getTestData(testId),
          isInTest: true,
        };
      } else {
        // Existing variation is no longer valid, reassign
        console.warn(`useABTest: Existing variation "${existingVariation}" for test "${testId}" is not in current variations list. Reassigning.`);
        removeTestVariation(testId);
      }
    }

    // Assign new variation
    const newVariation = assignRandomVariation(testId, variations);
    
    return {
      variation: newVariation,
      isNewAssignment: true,
      testData: getTestData(testId),
      isInTest: true,
    };
  }, [testId, variations, defaultVariation, trafficAllocation, getTestVariation, getTestData, removeTestVariation, assignRandomVariation]); // Dependencies that should trigger reassignment

  // Function to force reassignment (useful for testing/debugging)
  const reassign = (): string => {
    removeTestVariation(testId);
    return assignRandomVariation(testId, variations);
  };

  return {
    variation: testResult.variation,
    isNewAssignment: testResult.isNewAssignment,
    testData: testResult.testData,
    isInTest: testResult.isInTest,
    reassign,
  };
};

/**
 * Hook for manually controlling A/B test variations.
 * Useful when you need more control over test assignment logic.
 * 
 * @param testId - Unique identifier for the test
 * @returns Object with manual control functions
 */
export const useABTestControl = (testId: string): ABTestControlResult => {
  const {
    getTestVariation,
    setTestVariation,
    assignRandomVariation,
    hasTestVariation,
    getTestData,
    removeTestVariation,
  } = useABTestStore();

  return {
    getVariation: () => getTestVariation(testId),
    setVariation: (variation: string) => setTestVariation(testId, variation),
    assignRandom: (variations: string[]) => assignRandomVariation(testId, variations),
    hasVariation: () => hasTestVariation(testId),
    getTestData: () => getTestData(testId),
    removeTest: () => removeTestVariation(testId),
  };
};

/**
 * Hook to get summary of all active A/B tests.
 * Useful for debugging and analytics.
 * 
 * @returns Summary of all active tests
 */
export const useABTestSummary = (): Record<string, {
  variation: string;
  assignedAt: number;
  assignedDate: string;
}> => {
  const { getTestsSummary } = useABTestStore();
  return getTestsSummary();
}; 