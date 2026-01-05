import React, { useRef, useState, useEffect, ReactNode } from 'react';
import clsx from 'clsx';
import Tooltip from '@/components/Common/Tooltip';

type OverflowTooltipProps = {
	children: ReactNode;
	className?: string;
};

export const OverflowTooltip = ({
	children,
	className
}: OverflowTooltipProps ) => {
	const ref = useRef<HTMLDivElement>( null );
	const [ isOverflowing, setIsOverflowing ] = useState( false );

	useEffect( () => {
		const el = ref.current;

		if ( ! el ) {
			return;
		}

		const check = () => {
			setIsOverflowing( el.scrollWidth > el.clientWidth );
		};

		check();

		window.addEventListener( 'resize', check );
		return () => window.removeEventListener( 'resize', check );
	}, [ children ]);

	const combinedClassName = clsx(
		'truncate w-full',
		className
	);

	const content = (
		<div ref={ ref } className={ combinedClassName }>
			{ children }
		</div>
	);

	return isOverflowing ? (
		<Tooltip content={ children }>
			{ content }
		</Tooltip>
	) : (
		content
	);
};
