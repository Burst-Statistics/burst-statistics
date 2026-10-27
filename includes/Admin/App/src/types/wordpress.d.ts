declare module '@wordpress/element' {
    export { createElement, Component } from 'react';
    export function render( element: React.ReactElement, container: Element | null ): void;
    export function createRoot( container: Element | null, options?: {
        hydrate?: boolean;
        onRecoverableError?: ( error: Error ) => void;
    }): {
        render( element: React.ReactElement ): void;
    };
}

declare module '@wordpress/editor' {
    export interface PluginDocumentSettingPanelProps {
        name: string;
        className?: string;
        title?: React.ReactNode;
        icon?: React.ReactNode | React.ComponentType<Record<string, unknown>>;
        children?: React.ReactNode;
    }
    export const PluginDocumentSettingPanel: React.ComponentType<PluginDocumentSettingPanelProps>;
}

declare module '@wordpress/plugins' {
    export interface PluginSettings {
        render: React.ComponentType<Record<string, unknown>>;
        icon?: React.ReactNode;
    }
    export function registerPlugin( name: string, settings: PluginSettings ): void;
    export function unregisterPlugin( name: string ): void;
}

declare module '@wordpress/data' {
    export function useSelect<T, S = ( storeName: string ) => unknown>(
        mapSelect: ( select: S, registry?: unknown ) => T,
        deps?: unknown[]
    ): T;
    export function select( storeName: string ): unknown;
    export function dispatch( storeName: string ): unknown;
    export function subscribe( listener: () => void ): () => void;
}
