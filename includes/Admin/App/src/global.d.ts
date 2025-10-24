// Sub-dependency @wordpress/element missing types for createInterpolateElement
import type { Element as ReactElement } from "@wordpress/element";

declare module '@wordpress/element' {
    export function createInterpolateElement(
        text: string,
        components: Record< string, ReactElement >
    ): ReactElement;
}