import React, { forwardRef, useState, useEffect, useRef, useCallback } from "react";
import debounce from "lodash/debounce";
import TextInput from "@/components/Inputs/TextInput";
import FieldWrapper from "@/components/Fields/FieldWrapper";
import { __, _n, sprintf } from "@wordpress/i18n";
import { addQueryArgs } from "@wordpress/url";
import useWordPressData from '@/hooks/useWordPressData';
import Icon from'@/utils/Icon';
import HelpTooltip from '@/components/Common/HelpTooltip';
const DEBOUNCE_DELAY = 300;

const SelectorField = forwardRef(
  (
    {
      field,
      label,
      help,
      context: originalContext,
      className,
      goal,
      onChange,
      ...props
    },
    ref
  ) => {
    const inputId = props.id || field.name;
    // Use our custom hook to get all site data from cache
    const { siteInfo, isLoading: siteInfoLoading } = useWordPressData();
    const [previewDisplayLoggedOut, setPreviewDisplayLoggedOut] = useState(true);
    
    // Access specific fields as needed when data is available
    const siteUrl = siteInfo?.url;

    const baseUrl = goal.page_or_website === 'page' 
      ? siteUrl + goal.specific_page
      : siteUrl;
    const previewURL = addQueryArgs(baseUrl, { burst_preview: '1', burst_force_logged_out: previewDisplayLoggedOut ? '1' : '0' });
    const displayPreviewURL = addQueryArgs(baseUrl, {});
    

    // Core state
    const [inputValue, setInputValue] = useState(field.value || "");
    const [error, setError] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [previewData, setPreviewData] = useState({
      count: null,
      previews: [],
      currentIndex: 0
    });
    const [warning, setWarning] = useState("");
    
    // Refs
    const hiddenIframeRef = useRef(null);
    const previewRef = useRef(null);
    
    // Validate selector syntax
    const validateSyntax = useCallback((selector) => {
      if (!selector) return "";
      try {
        document.querySelectorAll(selector);
        return "";
      } catch (e) {
        return `Invalid selector: ${e.message}`;
      }
    }, []);

    // Test the selector against the target document
    const runTest = useCallback(
      (selector) => {
        if (!selector) {
          setPreviewData({ count: null, previews: [], currentIndex: 0 });
          return;
        }

        // Check syntax first
        const syntaxError = validateSyntax(selector);
        if (syntaxError) {
          setError(syntaxError);
          setPreviewData({ count: null, previews: [], currentIndex: 0 });
          return;
        }

        const iframe = hiddenIframeRef.current;
        if (!iframe) return;

        try {
          const doc = iframe.contentDocument || iframe.contentWindow.document;
          const nodes = Array.from(doc.querySelectorAll(selector));
          const count = nodes.length;

          if (count === 0) {
            setPreviewData({ count: 0, previews: [], currentIndex: 0 });
            setWarning("");
          } else {
            // Build preview documents
            const headHTML = 
              "<head>" +
              Array.from(doc.head.children)
                .map((el) => el.outerHTML)
                .join("") +
              "</head>";

            const previews = nodes.map((node) => {
              const style = getComputedStyle(node);
              
              // center the node in the body
              const bodyHTML = `<body style="display: flex; justify-content: center; align-items: center; height: 100vh;">${node.outerHTML}</body>`;
              return `<!DOCTYPE html>
<html>
  ${headHTML}
  ${bodyHTML}
</html>`;
            });

            setPreviewData({
              count,
              previews,
              currentIndex: 0
            });
            setError("");
            
            // Check visibility of the first preview item (currentIndex: 0)
            if (nodes.length > 0) {
              const style = getComputedStyle(nodes[0]);
              if (style.display === "none" || style.visibility === "hidden") {
                setWarning(
                  __("Warning: The current element is hidden via CSS.", "burst-statistics")
                );
              } else {
                setWarning("");
              }
            }
          }
        } catch (e) {
          setError(`Error testing selector: ${e.message}`);
          setPreviewData({ count: null, previews: [], currentIndex: 0 });
        }
      },
      [validateSyntax]
    );

    // Debounced test function
    const debouncedTest = useCallback(
      debounce((selector) => {
        runTest(selector);
        setIsLoading(false);
      }, DEBOUNCE_DELAY),
      [runTest]
    );

    // Run test when input value changes
    useEffect(() => {
      setIsLoading(true);
      debouncedTest(inputValue);
      
      return () => debouncedTest.cancel();
    }, [inputValue, debouncedTest]);

    // Set up keyboard navigation for preview panel
    useEffect(() => {
      const handleKeyDown = (e) => {
        if (!previewData.previews.length) return;
        
        if (e.key === "ArrowRight") {
          navigatePreview("next");
        } else if (e.key === "ArrowLeft") {
          navigatePreview("prev");
        }
      };

      document.addEventListener("keydown", handleKeyDown);
      return () => document.removeEventListener("keydown", handleKeyDown);
    }, [previewData.previews.length]);

    // Handle input change
    const handleInputChange = (e) => {
      const selector = e.target.value;
      setInputValue(selector);
      onChange(selector);
      
      // Immediate syntax validation feedback
      const syntaxError = validateSyntax(selector);
      setError(syntaxError);
    };

    // Navigate between previews
    const navigatePreview = (direction) => {
      setPreviewData(prev => {
        const { previews, currentIndex } = prev;
        if (!previews.length) return prev;
        
        const newIndex = direction === "next"
          ? (currentIndex + 1) % previews.length
          : (currentIndex - 1 + previews.length) % previews.length;
        
        // Update preview data with new index
        const updatedData = { ...prev, currentIndex: newIndex };
        
        // Check visibility of the current element in original document
        const iframe = hiddenIframeRef.current;
        if (iframe) {
          try {
            const doc = iframe.contentDocument || iframe.contentWindow.document;
            const nodes = Array.from(doc.querySelectorAll(inputValue));
            if (nodes[newIndex]) {
              const style = getComputedStyle(nodes[newIndex]);
              if (style.display === "none" || style.visibility === "hidden") {
                setWarning(
                  __("Warning: this element might be hidden via CSS.", "burst-statistics")
                );
              } else {
                setWarning("");
              }
            }
          } catch (e) {
            // Ignore any errors accessing iframe content
          }
        }
        
        return updatedData;
      });
    };

// Build context message
const computedContext = error
  ? originalContext
  : previewData.count != null
    ? sprintf(
        /* translators: 
           1: number of elements found
           2: the URL of the preview
           3: logged in/out status */
        _n(
          "Found %1$d element on %2$s %3$s",
          "Found %1$d elements on %2$s %3$s",
          previewData.count,
          "burst-statistics"
        ),
        previewData.count,
        displayPreviewURL,
        previewDisplayLoggedOut ? __("(Logged out)", "burst-statistics") : __("(Logged in)", "burst-statistics")
      )
    : originalContext;

    const helpText = (
      <>
        <h4 className="text-base font-bold mb-2">
          { __( 'Selector Examples:', 'burst-statistics' ) }
        </h4>
        <ul>
          <li>
            <code>.class-name</code> –
            { ' ' }
            { __( 'Selects all elements with class "class-name".', 'burst-statistics' ) }
          </li>
          <li>
            <code>#element-id</code> –
            { ' ' }
            { __( 'Selects the element with ID "element-id".', 'burst-statistics' ) }
          </li>
          <li>
            <code>button</code> –
            { ' ' }
            { __( 'Selects all <button> elements.', 'burst-statistics' ) }
          </li>
          <li>
            <code>a[href^="https"]</code> –
            { ' ' }
            { __( 'Selects links whose href starts with "https".', 'burst-statistics' ) }
          </li>
          <li>
            <code>.nav-item:not(.active)</code> –
            { ' ' }
            { __( 'Selects .nav-item elements that do not have the "active" class.', 'burst-statistics' ) }
          </li>
        </ul>
      </>
    );

    return (
      <FieldWrapper
        label={label}
        help={helpText}
        error={error}
        warning={warning}
        className={className}
        inputId={inputId}
        required={props.required}
      >
        {/* Input field with loading indicator */}
        <div className="relative">
          <TextInput
            id={inputId}
            type="text"
            ref={ref}
            value={inputValue}
            {...field}
            {...props}
            aria-invalid={!!error}
            aria-describedby={error ? `${inputId}-error` : undefined}
            onChange={handleInputChange}
            className="w-full"
          />

          {/* Loading indicator */}
          {isLoading && (
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
              <svg
                className="animate-spin h-4 w-4 text-gray-600"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                  fill="none"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                />
              </svg>
            </div>
          )}
        </div>

        {/* Preview section */}
        
          <div 
            className="mt-4 border rounded overflow-hidden" 
            ref={previewRef}
            tabIndex={0}
            aria-label={__("Preview panel, use arrow keys to navigate", "burst-statistics")}
          >
            {/* Preview navigation header */}
            <div className="bg-gray-100 p-2 grid grid-cols-3 items-center justify-between border-b">
              <div className="font-medium text-sm">
                {computedContext}
              </div>
              
              
              {previewData.previews.length > 1 && (
                <div className="col-start-2 flex items-center justify-center">
                <div 
                  role="group" 
                  aria-label={__("Step through matches", "burst-statistics")}
                  className="flex items-center justify-center rounded overflow-hidden shadow-sm"
                >
                  <button
                    type="button"
                    onClick={() => navigatePreview("prev")}
                    className="bg-white text-gray-600 hover:bg-gray-100 px-3 py-1 border-r"
                    aria-label={__("Previous match", "burst-statistics")}
                  >
                    ←
                  </button>
                  <span className="px-2 py-1 bg-white text-sm">
                    {previewData.currentIndex + 1}/{previewData.previews.length}
                  </span>
                  <button
                    type="button"
                    onClick={() => navigatePreview("next")}
                    className="bg-white text-gray-600 hover:bg-gray-100 px-3 py-1 border-l"
                    aria-label={__("Next match", "burst-statistics")}
                  >
                    →
                  </button>
                </div>
                </div>
              )}
              {/* always last column in case there are no previews */}
              <div className="flex items-center justify-end col-start-3 gap-2">
                {/* Logged out mode */}
                <HelpTooltip content={previewDisplayLoggedOut ? __("Set logged in mode", "burst-statistics") : __("Set logged out mode", "burst-statistics")}>
                <button
                  type="button"
                  onClick={() => setPreviewDisplayLoggedOut(!previewDisplayLoggedOut)}
                  className="bg-white text-gray-600 hover:bg-gray-100 border-gray-400 px-2 py-2 border rounded-md"
                >
                  {previewDisplayLoggedOut ? <Icon name="log-out" /> : <Icon name="log-in" />}
                </button>
                </HelpTooltip>
              </div>
            </div>
            
            {/* Preview iframe */}
            {previewData.previews.length > 0 && !error && (
            <iframe
              srcDoc={previewData.previews[previewData.currentIndex]}
              sandbox="allow-scripts allow-same-origin"
              title={`${inputId}-preview`}
              className={`w-full h-48 border-none`}
              aria-live="polite"
            />
            )}
          </div>
        

        {/* Screen reader info */}
        {previewData.previews.length > 0 && (
          <span className="sr-only" aria-live="polite">
            {__("%s elements match your selector. Use arrow keys to cycle through matches.", "burst-statistics").replace("%s", previewData.count)}
          </span>
        )}

        {/* Hidden iframe to query the target URL */}
        {previewURL && (
          <iframe
            ref={hiddenIframeRef}
            sandbox="allow-scripts allow-same-origin"
            src={previewURL}
            onLoad={() => runTest(inputValue)}
            referrerPolicy="no-referrer"
            style={{ display: "none" }}
            title={`${inputId}-hidden-tester`}
          />
        )}
      </FieldWrapper>
    );
  }
);

SelectorField.displayName = "SelectorField";
export default SelectorField;
