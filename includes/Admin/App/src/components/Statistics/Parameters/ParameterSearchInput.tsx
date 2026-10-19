import React, { useState, useRef, useEffect, useCallback, memo } from 'react';
import { __ } from '@wordpress/i18n';
import Icon from '@/utils/Icon';

interface ParameterSearchInputProps {

	/** Active search query string. */
	value: string;

	/** Callback when search query changes. */
	onChange: ( query: string ) => void;

	/** Optional callback when the search field opens or collapses. */
	onOpenChange?: ( isOpen: boolean ) => void;

	/** Placeholder text for the input field. */
	placeholder?: string;

	/** Optional additional CSS classes. */
	className?: string;
}

/**
 * Expandable in-place search input for expandable datatable sub-rows.
 *
 * Starts as a compact search icon button. Clicking expands the input field
 * in place with auto-focus. Pressing Escape or clearing the input collapses
 * the field back into the icon button.
 *
 * @param {ParameterSearchInputProps} props Component props.
 * @return {JSX.Element} Search input element.
 */
const ParameterSearchInput: React.FC<ParameterSearchInputProps> = ({
	value,
	onChange,
	onOpenChange,
	placeholder = __( 'Search...', 'burst-statistics' ),
	className = ''
}) => {
	const [ isOpen, setIsOpen ] = useState<boolean>( Boolean( value ) );
	const inputRef = useRef<HTMLInputElement | null>( null );

	const setOpenState = useCallback(
		( nextOpen: boolean ) => {
			setIsOpen( nextOpen );
			onOpenChange?.( nextOpen );
		},
		[ onOpenChange ]
	);

	const handleOpen = useCallback( () => {
		setOpenState( true );
	}, [ setOpenState ]);

	const handleClose = useCallback( () => {
		onChange( '' );
		setOpenState( false );
	}, [ onChange, setOpenState ]);

	const handleKeyDown = useCallback(
		( event: React.KeyboardEvent<HTMLInputElement> ) => {
			if ( 'Escape' === event.key ) {
				event.preventDefault();
				handleClose();
			}
		},
		[ handleClose ]
	);

	useEffect( () => {
		if ( isOpen && inputRef.current ) {
			inputRef.current.focus();
		}
	}, [ isOpen ]);

	if ( ! isOpen ) {
		return (
			<button
				type="button"
				onClick={handleOpen}
				className={`flex h-8 w-8 items-center justify-center rounded-md border border-gray-200 bg-white text-gray-400 shadow-2xs transition-colors hover:bg-gray-50 hover:text-text-black cursor-pointer ${className}`}
				aria-label={__( 'Open search', 'burst-statistics' )}
				title={__( 'Search', 'burst-statistics' )}
			>
				<Icon name="search" size={14} color="gray" />
			</button>
		);
	}

	return (
		<div
			className={`relative flex items-center transition-all duration-200 ${className}`}
		>
			<span className="pointer-events-none absolute left-2.5 text-gray-400">
				<Icon name="search" size={13} color="gray" />
			</span>
			<input
				ref={inputRef}
				type="text"
				role="searchbox"
				value={value}
				onChange={( event ) => onChange( event.target.value )}
				onKeyDown={handleKeyDown}
				placeholder={placeholder}
				className="w-48 sm:w-64 rounded-md border border-green bg-white py-1.5 pl-8 pr-8 text-xs text-text-black placeholder:text-text-gray-light ring-1 ring-green focus:outline-hidden shadow-2xs"
				aria-label={placeholder}
			/>
			<button
				type="button"
				onClick={handleClose}
				className="absolute right-2 flex items-center justify-center rounded p-0.5 text-gray-400 hover:text-text-black cursor-pointer"
				aria-label={__( 'Clear and close search', 'burst-statistics' )}
			>
				<Icon name="times" size={12} color="gray" />
			</button>
		</div>
	);
};

export default memo( ParameterSearchInput );
