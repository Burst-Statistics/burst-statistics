declare module '@wordpress/element' {
    export { createElement, Component } from 'react';
    export function render(element: React.ReactElement, container: Element | null): void;
    export function createRoot(container: Element | null, options?: {
        hydrate?: boolean;
        onRecoverableError?: (error: Error) => void;
    }): {
        render(element: React.ReactElement): void;
    };
} 