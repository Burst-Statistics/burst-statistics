import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

export interface CollapsibleSectionProps {
	title: string;
	children: React.ReactNode;
	initialOpen?: boolean;
}

/**
 * Reusable collapsible disclosure row for sub-sections.
 *
 * @param props             - Component properties.
 * @param props.title       - Section title.
 * @param props.children    - Section content.
 * @param props.initialOpen - Whether open by default (defaults to false).
 * @return Collapsible section element.
 */
export const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({
	title,
	children,
	initialOpen = false
}) => {
	const [ isOpen, setIsOpen ] = useState( initialOpen );

	return (
		<div className="border-t border-gray-200 py-2.5">
			<button
				type="button"
				onClick={ () => setIsOpen( ( prev ) => ! prev ) }
				className="flex w-full items-center justify-between text-left text-xs font-semibold text-text-black hover:text-gray-700"
			>
				<span>{ title }</span>
				{ isOpen ? (
					<ChevronUp size={ 16 } className="text-gray-400" />
				) : (
					<ChevronDown size={ 16 } className="text-gray-400" />
				) }
			</button>

			{ isOpen && (
				<div className="mt-2.5 text-xs text-text-gray">
					{ children }
				</div>
			) }
		</div>
	);
};
