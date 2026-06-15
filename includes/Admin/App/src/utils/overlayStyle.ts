import type { CSSProperties } from 'react';

/**
 * Dark-mode brand-color overlay for transparent-PNG artwork.
 *
 * The artwork is a transparent PNG, so the `mix-blend-overlay` tint must be
 * masked by the artwork's own alpha — otherwise the brand color bleeds onto
 * the page background too. Shared by the report hero (HeroBlock) and the image
 * picker preview (ImagePickerField) so both stay in sync.
 *
 * @param {string} url   Artwork URL used as the alpha mask.
 * @param {string} color Brand color painted through the mask.
 * @return {CSSProperties} Inline style for the overlay element.
 */
export const darkOverlayStyle = ( url: string, color: string ): CSSProperties => ({
	backgroundColor: color,
	opacity: 1,
	maskImage: `url("${ url }")`,
	maskSize: '100% 100%',
	maskRepeat: 'no-repeat',
	WebkitMaskImage: `url("${ url }")`,
	WebkitMaskSize: '100% 100%',
	WebkitMaskRepeat: 'no-repeat'
});
