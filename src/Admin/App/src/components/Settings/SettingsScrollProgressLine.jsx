import { useEffect, useState, useCallback } from 'react';

const SettingsScrollProgressLine = () => {
  const [ scrollProgress, setScrollProgress ] = useState( 0 );
  const [ canScroll, setCanScroll ] = useState( false );

  // Memoize the scroll handler to prevent recreation on each render
  const onScroll = useCallback( () => {
    const scrollable = document.documentElement.scrollHeight - window.innerHeight;
    if ( 0 < scrollable ) {
      setScrollProgress( Math.round( ( window.scrollY / scrollable ) * 100 ) );
      setCanScroll( true );
    } else {
      setCanScroll( false );
    }
  }, []);

  useEffect( () => {

    // Initial check
    onScroll();

    // Event listeners
    const events = [ 'scroll', 'resize', 'load' ];
    events.forEach( ( event ) => window.addEventListener( event, onScroll ) );

    // MutationObserver to detect DOM changes (like expanding details)
    const observer = new MutationObserver( onScroll );

    observer.observe( document.body, {
      childList: true,
      subtree: true,
      attributes: false, // Reduce unnecessary callbacks
      characterData: false // Reduce unnecessary callbacks
    });

    // Cleanup
    return () => {
      events.forEach( ( event ) => window.removeEventListener( event, onScroll ) );
      observer.disconnect();
    };
  }, [ onScroll ]);

  if ( ! canScroll ) {
    return null;
  }

  return (
    <div className="h-1 w-full bg-gray-400">
      <div
        className="h-full bg-blue transition-all duration-300 ease-out"
        style={{ width: `${10 + Math.min( scrollProgress, 90 )}%` }}
      ></div>
    </div>
  );
};

SettingsScrollProgressLine.displayName = 'FormScrollProgressLine';
export default SettingsScrollProgressLine;
