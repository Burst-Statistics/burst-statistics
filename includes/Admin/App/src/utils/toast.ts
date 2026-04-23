import { create } from 'zustand';
import { type ReactNode } from 'react';

/** Supported toast variant types. */
export type ToastType = 'success' | 'error' | 'info' | 'warning' | 'default';

/** Options accepted by all toast creation calls. */
export interface ToastOptions {
	toastId?: string;
	autoClose?: number | false;
	type?: ToastType;
}

/** Props passed to custom render-function content. */
export interface ToastContentProps {
	closeToast: () => void;
	toastProps: {
		type: ToastType;
		toastId: string;
	};
}

/** Lifecycle status of a single toast. */
export type ToastStatus = 'entering' | 'active' | 'exiting' | 'removed';

/** The shape of each toast item stored in state. */
export interface ToastItem {
	id: string;
	type: ToastType;
	content: ReactNode | ( ( props: ToastContentProps ) => ReactNode );
	autoClose: number | false;
	status: ToastStatus;
}

/** Event emitted on state changes. Mirrors react-toastify's onChange payload. */
export interface ToastChangeEvent {
	id: string;
	status: 'added' | 'updated' | 'removed';
}

/** Messages object used by toast.promise(). */
export interface ToastPromiseMessages {
	pending: ReactNode;
	success: ReactNode;
	error: ReactNode;
}

interface ToastStore {
	toasts: ToastItem[];
	listeners: Array<( event: ToastChangeEvent ) => void>;
	addToast: ( item: Omit<ToastItem, 'status'> ) => void;
	removeToast: ( id: string ) => void;
	setExiting: ( id: string ) => void;
	subscribe: ( listener: ( event: ToastChangeEvent ) => void ) => () => void;
	_notify: ( event: ToastChangeEvent ) => void;
}

/** Internal Zustand store — consumed by toast components. */
export const useToastStore = create<ToastStore>( ( set, get ) => ({
	toasts: [],
	listeners: [],

	addToast: ( item ) => {
		set( ( state ) => ({
			toasts: [
				...state.toasts.filter( ( t ) => t.id !== item.id ),
				{ ...item, status: 'entering' as const }
			]
		}) );
		get()._notify({ id: item.id, status: 'added' });
	},

	removeToast: ( id ) => {
		set( ( state ) => ({
			toasts: state.toasts.filter( ( t ) => t.id !== id )
		}) );
		get()._notify({ id, status: 'removed' });
	},

	setExiting: ( id ) => {
		set( ( state ) => ({
			toasts: state.toasts.map( ( t ) =>
				t.id === id ? { ...t, status: 'exiting' as const } : t
			)
		}) );
	},

	subscribe: ( listener ) => {
		set( ( state ) => ({ listeners: [ ...state.listeners, listener ] }) );
		return () => {
			set( ( state ) => ({
				listeners: state.listeners.filter( ( l ) => l !== listener )
			}) );
		};
	},

	_notify: ( event ) => {
		get().listeners.forEach( ( l ) => l( event ) );
	}
}) );

let toastCounter = 0;

/**
 * Internal helper that creates a toast and returns its id.
 */
function createToast(
	content: ReactNode | ( ( props: ToastContentProps ) => ReactNode ),
	options: ToastOptions = {}
): string {
	const id = options.toastId ?? `toast-${ ++toastCounter }`;
	const autoClose =
		options.autoClose !== undefined ? options.autoClose : 2500;

	useToastStore.getState().addToast({
		id,
		type: options.type ?? 'default',
		content,
		autoClose
	});

	return id;
}

/**
 * Toast API — matches the react-toastify call surface used across the codebase.
 *
 * Usage:
 *   toast.success('Saved!');
 *   toast.error('Something went wrong', { autoClose: 10000 });
 *   toast.promise(myPromise, { pending: '…', success: 'Done', error: 'Oops' });
 *   const unsub = toast.onChange(event => { … }); unsub();
 */
export const toast = Object.assign(
	(
		content: ReactNode | ( ( props: ToastContentProps ) => ReactNode ),
		options: ToastOptions = {}
	) => createToast( content, options ),
	{

		/** Show a success toast. */
		success: (
			content: ReactNode,
			options: ToastOptions = {}
		): string => createToast( content, { ...options, type: 'success' }),

		/** Show an error toast. */
		error: (
			content: ReactNode,
			options: ToastOptions = {}
		): string => createToast( content, { ...options, type: 'error' }),

		/** Show an informational toast. */
		info: (
			content: ReactNode,
			options: ToastOptions = {}
		): string => createToast( content, { ...options, type: 'info' }),

		/** Show a warning toast. */
		warning: (
			content: ReactNode,
			options: ToastOptions = {}
		): string => createToast( content, { ...options, type: 'warning' }),

		/**
		 * Show a pending toast that transitions to success/error based on
		 * the outcome of the given promise.
		 */
		promise: async <T>(
			promise: Promise<T>,
			messages: ToastPromiseMessages,
			options: ToastOptions = {}
		): Promise<T> => {
			const id = createToast( messages.pending, {
				...options,
				type: 'info',
				autoClose: false
			});

			try {
				const result = await promise;
				useToastStore.getState().removeToast( id );
				createToast( messages.success, { ...options, type: 'success' });
				return result;
			} catch ( err ) {
				useToastStore.getState().removeToast( id );
				createToast( messages.error, { ...options, type: 'error' });
				throw err;
			}
		},

		/** Check whether a toast with the given id is currently active. */
		isActive: ( toastId: string ): boolean =>
			useToastStore
				.getState()
				.toasts.some(
					( t ) => t.id === toastId && 'removed' !== t.status
				),

		/**
		 * Subscribe to toast lifecycle events.
		 * Returns an unsubscribe function.
		 */
		onChange: (
			callback: ( event: ToastChangeEvent ) => void
		): ( () => void ) => useToastStore.getState().subscribe( callback )
	}
);
