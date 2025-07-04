import React from "react";
import { useABTest, useABTestSummary } from "@/hooks/useABTest";

/**
 * Example component demonstrating how to use the A/B testing system.
 * Shows multiple tests running simultaneously with different configurations.
 */
const ABTestExample: React.FC = () => {
  // Example 1: Simple A/B test for button text
  const { variation: buttonTextVariation } = useABTest("button-text-v1", ["A", "B"]);

  // Example 2: Multi-variant test for header style
  const { variation: headerVariation } = useABTest("header-style-v2", [
    "minimal", 
    "bold", 
    "gradient"
  ]);

  // Example 3: Test with traffic allocation (only 50% of users see this test)
  const { variation: colorVariation, isInTest } = useABTest("color-scheme-v1", [
    "blue", 
    "green"
  ], {
    trafficAllocation: 50,
    defaultVariation: "blue"
  });

  // Get summary of all active tests (useful for debugging)
  const testsSummary = useABTestSummary();

  // Determine content based on variations
  const getButtonText = () => {
    switch (buttonTextVariation) {
      case "A":
        return "Get Started";
      case "B":
        return "Start Free Trial";
      default:
        return "Click Here";
    }
  };

  const getHeaderStyle = () => {
    switch (headerVariation) {
      case "minimal":
        return "text-lg font-normal text-gray-600";
      case "bold":
        return "text-2xl font-bold text-black";
      case "gradient":
        return "text-xl font-semibold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent";
      default:
        return "text-lg font-normal";
    }
  };

  const getColorClass = () => {
    if (!isInTest) return "bg-blue-500"; // Default for users not in test
    
    switch (colorVariation) {
      case "blue":
        return "bg-blue-500";
      case "green":
        return "bg-green-500";
      default:
        return "bg-blue-500";
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">A/B Testing Examples</h1>
      
      {/* Example 1: Button Text Test */}
      <div className="mb-8 p-4 border rounded-lg">
        <h2 className="text-xl font-semibold mb-3">Test 1: Button Text ({buttonTextVariation})</h2>
        <button className={`px-6 py-3 text-white rounded-lg ${getColorClass()}`}>
          {getButtonText()}
        </button>
      </div>

      {/* Example 2: Header Style Test */}
      <div className="mb-8 p-4 border rounded-lg">
        <h2 className="text-xl font-semibold mb-3">Test 2: Header Style ({headerVariation})</h2>
        <h3 className={getHeaderStyle()}>
          This header style changes based on the A/B test variation
        </h3>
      </div>

      {/* Example 3: Color Scheme Test */}
      <div className="mb-8 p-4 border rounded-lg">
        <h2 className="text-xl font-semibold mb-3">
          Test 3: Color Scheme ({colorVariation}) 
          {!isInTest && " - Not in test (fallback)"}
        </h2>
        <div className={`p-4 rounded-lg text-white ${getColorClass()}`}>
          This box color is determined by the A/B test
        </div>
      </div>

      {/* Debug Information */}
      <div className="mt-8 p-4 bg-gray-100 rounded-lg">
        <h2 className="text-xl font-semibold mb-3">Debug: All Active Tests</h2>
        <pre className="text-sm bg-white p-3 rounded border overflow-auto">
          {JSON.stringify(testsSummary, null, 2)}
        </pre>
      </div>

      {/* Usage Instructions */}
      <div className="mt-8 p-4 bg-blue-50 rounded-lg">
        <h2 className="text-xl font-semibold mb-3">How to Use</h2>
        <ul className="list-disc ml-6 space-y-2">
          <li>Each test has a unique ID (e.g., "button-text-v1")</li>
          <li>Variations are assigned randomly and persisted in localStorage</li>
          <li>Tests can have different numbers of variations</li>
          <li>Traffic allocation allows you to show tests to only a percentage of users</li>
          <li>All tests run independently and simultaneously</li>
        </ul>
        
        <div className="mt-4 p-3 bg-white rounded border">
          <h3 className="font-semibold mb-2">Example Usage:</h3>
          <code className="text-sm">
            {`const { variation } = useABTest("my-test-id", ["A", "B", "C"]);`}
          </code>
        </div>
      </div>
    </div>
  );
};

export default ABTestExample; 