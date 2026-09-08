/**
 * Utility functions for object validation and manipulation.
 */

export const isValidObject = <T = Record<string, unknown>>( obj: unknown ): obj is T =>
	Boolean( obj && 'object' === typeof obj && ! Array.isArray( obj ) && 0 < Object.keys( obj ).length );
