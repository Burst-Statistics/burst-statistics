// hooks/useSelectorTester.js
import {
    useState,
    useCallback,
    useRef
  } from "react";
  import useDebouncedEffect from "./useDebouncedEffect";
  
  export function useSelectorTester({
    selector,
    previewUrl,
    onValidSelectorChange
  }) {
    const [matchCount, setMatchCount] = useState(0);
    const [isValid, setIsValid] = useState(true);
    const [error, setError] = useState("");
    const [isTesting, setIsTesting] = useState(false);
    const iframeRef = useRef(null);
  
    const highlight = useCallback((els) => {
      document
        .querySelectorAll(".selector-highlight")
        .forEach((el) => el.classList.remove("selector-highlight"));
      els.forEach((el) => el.classList.add("selector-highlight"));
    }, []);
  
    const runTest = useCallback(() => {
      if (!selector) {
        setMatchCount(0);
        return;
      }
      setIsTesting(true);
      setError("");
      try {
        const parentEls = Array.from(
          document.querySelectorAll(selector)
        );
        let total = parentEls.length;
  
        if (iframeRef.current) {
          const doc =
            iframeRef.current.contentDocument ||
            iframeRef.current.contentWindow.document;
          const iframeEls = Array.from(doc.querySelectorAll(selector));
          total = iframeEls.length;
          highlight(iframeEls);
        }
  
        setMatchCount(total);
        setIsValid(true);
        onValidSelectorChange(total, true);
      } catch (e) {
        setMatchCount(0);
        setIsValid(false);
        setError(e.message);
        onValidSelectorChange(0, false);
      } finally {
        setIsTesting(false);
      }
    }, [selector, highlight, onValidSelectorChange]);
  
    // debounce selector or URL changes
    useDebouncedEffect(
      () => {
        runTest();
      },
      [selector, previewUrl],
      300
    );
  
    const handleLoad = useCallback(() => {
      runTest();
    }, [runTest]);
  
    return {
      iframeRef,
      matchCount,
      isValid,
      error,
      isTesting,
      handleLoad
    };
  }
  