import { useRef, useEffect } from 'react';

interface ShadowContainerProps {
	html: string;
	className?: string;
}

const ShadowContainer = ({ html, className = '' }: ShadowContainerProps ) => {
	const containerRef = useRef<HTMLDivElement>( null );

	useEffect( () => {
		if ( ! containerRef.current ) {
			return;
		}
		let shadow = containerRef.current.shadowRoot;
		if ( ! shadow ) {
			shadow = containerRef.current.attachShadow({ mode: 'open' });
		}
		shadow.innerHTML = html;
	}, [ html ]);

	return <div ref={ containerRef } className={ className } />;
};

export default ShadowContainer;
