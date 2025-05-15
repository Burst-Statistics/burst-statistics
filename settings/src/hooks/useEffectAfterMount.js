import { useEffect, useRef } from '@wordpress/element';

export function useEffectAfterMount( effect, dependencies ) {
  const isFirstRender = useRef( true );

  useEffect( () => {
    if ( isFirstRender.current ) {
      isFirstRender.current = false;
      return;
    }

    const cleanup = effect();
    return cleanup;
  }, dependencies );
}
