import { memo, ReactNode } from 'react';
import clsx from 'clsx';

type BlockContentProps = {
	children: ReactNode;
	className?: string;
};

/**
 * Resolves padding classes based on existing className to avoid conflicts.
 *
 * @param {string} className - The existing className string.
 * @return {string} The resolved padding classes.
 */
const resolvePaddingClasses = ( className = '' ): string => {
	const hasP  = /\bp-\S+/.test( className );
	const hasPx = /\bpx-\S+/.test( className );
	const hasPy = /\bpy-\S+/.test( className );
	const hasPt = /\bpt-\S+/.test( className );
	const hasPr = /\bpr-\S+/.test( className );
	const hasPb = /\bpb-\S+/.test( className );
	const hasPl = /\bpl-\S+/.test( className );

	const classes: string[] = [];

	// Horizontal padding
	if ( ! hasP && ! hasPx ) {
		classes.push( 'px-2.5', 'md:px-6' );
	}

	// Vertical padding
	if ( ! hasP && ! hasPy ) {
		classes.push( 'py-6' );
	}

	// Fine-grained fallbacks (only if axis not fully overridden)
	if ( ! hasP && ! hasPx && ! hasPl ) {
		classes.push( 'pl-2.5', 'md:pl-6' );
	}

	if ( ! hasP && ! hasPx && ! hasPr ) {
		classes.push( 'pr-2.5', 'md:pr-6' );
	}

	if ( ! hasP && ! hasPy && ! hasPt ) {
		classes.push( 'pt-6' );
	}

	if ( ! hasP && ! hasPy && ! hasPb ) {
		classes.push( 'pb-6' );
	}

	return classes.join( ' ' );
};


/**
 * Block Content Component.
 *
 * @param {Object} props - Component props.
 * @param {React.ReactNode} props.children - The content to render.
 * @param {string} props.className - Additional CSS classes.
 * @return {JSX.Element} The block content component.
 */
export const BlockContent = memo( ({ children, className = '' }: BlockContentProps ) => {
	return (
		<div
			className={clsx(
				'flex-grow',
				resolvePaddingClasses( className ),
				className
			)}
		>
			{ children }
		</div>
	);
});

BlockContent.displayName = 'BlockContent';
