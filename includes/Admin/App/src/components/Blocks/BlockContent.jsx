import React, { memo } from 'react';
import clsx from 'clsx';

const resolvePaddingClasses = ( className = '' ) => {
	const hasP  = /\bp-\S+/.test( className );
	const hasPx = /\bpx-\S+/.test( className );
	const hasPy = /\bpy-\S+/.test( className );
	const hasPt = /\bpt-\S+/.test( className );
	const hasPr = /\bpr-\S+/.test( className );
	const hasPb = /\bpb-\S+/.test( className );
	const hasPl = /\bpl-\S+/.test( className );

	const classes = [];

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
 * Block Content Component
 *
 * @param {Object}          props
 * @param {React.ReactNode} props.children
 * @param {string}          [props.className]
 *
 * @return {JSX.Element}
 */
export const BlockContent = memo( ({ children, className = '' }) => {
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
