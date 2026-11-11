import { clsx } from 'clsx';

/**
 * Classes of a link in the goals list. Its text lines up with the block heading; the hover and selected fill reach 12px past it.
 * The selected link gets a light green fill, its text colour stays the same.
 */
export const goalsNavLinkClassName = clsx(
	'-mx-2 block rounded-md px-3 py-2 text-base text-text-black',
	'hover:bg-gray-100 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary',
	'[&.active]:bg-green-50'
);
