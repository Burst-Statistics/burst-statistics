import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { useCallback, useRef, useState } from 'react';
import { __ } from '@wordpress/i18n';
import { doAction, getAction } from '@/utils/api';
import { toast } from '@/utils/toast';

type GSCStatus = 'connected' | 'disconnected' | 'needs-reconnect';
type GSCPropertyStatus = 'matched' | 'none' | 'pending';

interface GSCStatusResponse {
	status: GSCStatus;
	connect_failed?: boolean;
	property?: string;
	property_status?: GSCPropertyStatus;
}

interface UseGSCDataReturn {
	status: GSCStatus;
	property: string;
	propertyStatus: GSCPropertyStatus | null;
	isFetching: boolean;
	isConnecting: boolean;
	isDisconnecting: boolean;
	error: string | null;
	connect: () => void;
	cancelConnect: () => void;
	disconnect: () => void;
}

const POLL_INTERVAL = 1500;
const POLL_TIMEOUT = 5 * 60 * 1000;

/**
 * Drives the Google Search Console connect flow from the React app:
 * fetches connection state, opens the OAuth popup, polls until the server
 * reports a result, and disconnects. No tokens are ever handled client-side.
 *
 * The connecting state stays true for the whole popup round-trip and failures
 * surface through `error` (not a transient toast) so the UI can show them.
 *
 * @return {UseGSCDataReturn} Connection state and actions.
 */
const useGSCData = (): UseGSCDataReturn => {
	const queryClient = useQueryClient();
	const [ isConnecting, setIsConnecting ] = useState( false );
	const [ error, setError ] = useState<string | null>( null );
	const pollTimer = useRef<ReturnType<typeof setTimeout> | null>( null );
	const popupRef = useRef<Window | null>( null );

	const { data, isFetching } = useQuery<GSCStatusResponse>({
		queryKey: [ 'gscStatus' ],
		queryFn: () => getAction( 'get_gsc_status' ),
		placeholderData: (): GSCStatusResponse => ({
			status: ( window as any ).burst_settings?.gsc_status ?? 'disconnected' // eslint-disable-line @typescript-eslint/no-explicit-any
		}),

		// Keep polling while the server is still resolving which property matches
		// this site, so the dashboard block flips to data/notice once it settles.
		refetchInterval: ( query ) => {
			const current = query.state.data as GSCStatusResponse | undefined;
			return 'connected' === current?.status && 'pending' === current?.property_status ?
				POLL_INTERVAL :
				false;
		}
	});

	const status: GSCStatus = data?.status ?? 'disconnected';
	const property: string = data?.property ?? '';
	const propertyStatus: GSCPropertyStatus | null = data?.property_status ?? null;

	const stopPolling = useCallback( () => {
		if ( pollTimer.current ) {
			clearTimeout( pollTimer.current );
			pollTimer.current = null;
		}
	}, []);

	const cancelConnect = useCallback( () => {
		stopPolling();
		if ( popupRef.current ) {
			if ( ! popupRef.current.closed ) {
				popupRef.current.close();
			}
			popupRef.current = null;

			// Release the server-side single-flight lock so another admin isn't blocked.
			void doAction( 'gsc_cancel', {});
		}
		setIsConnecting( false );
		setError( null );
	}, [ stopPolling ]);

	const connect = useCallback( () => {
		setError( null );

		// Open the popup synchronously inside the click so the browser does not block it.
		const popup = window.open( '', 'burst_gsc_connect', 'width=600,height=720' );
		popupRef.current = popup;
		setIsConnecting( true );

		const finish = ( connected: boolean, reason: string | null = null ) => {
			stopPolling();
			popupRef.current = null;
			setIsConnecting( false );
			if ( connected ) {

				// Refetch the full status (status + property + property_status) instead
				// of writing a partial { status: 'connected' }: a partial write drops
				// property_status, which stops the resolution poll (refetchInterval) from
				// starting and leaves the dashboard block stuck on "Checking…".
				void queryClient.invalidateQueries({ queryKey: [ 'gscStatus' ] });
				toast.success( __( 'Google Search Console connected.', 'burst-statistics' ) );
				return;
			}
			void queryClient.invalidateQueries({ queryKey: [ 'gscStatus' ] });
			if ( reason ) {
				setError( reason );
			}
		};

		doAction( 'gsc_connect', {}).then( ( res: any ) => { // eslint-disable-line @typescript-eslint/no-explicit-any
			if ( 'locked' === res?.error ) {
				popup?.close();
				popupRef.current = null;
				setIsConnecting( false );
				setError( __( 'Another administrator is currently connecting. Please try again shortly.', 'burst-statistics' ) );
				return;
			}
			if ( ! res?.url || ! popup ) {
				popup?.close();
				popupRef.current = null;
				setIsConnecting( false );
				setError( __( 'Could not start the connection. Please try again.', 'burst-statistics' ) );
				return;
			}

			popup.location.href = res.url;

			const startedAt = Date.now();
			const poll = async() => {
				if ( Date.now() - startedAt > POLL_TIMEOUT ) {
					finish( false, __( 'The connection timed out. Please try again.', 'burst-statistics' ) );
					return;
				}
				const result: any = await getAction( 'get_gsc_status' ); // eslint-disable-line @typescript-eslint/no-explicit-any
				if ( 'connected' === result?.status ) {
					finish( true );
					return;
				}
				if ( result?.connect_failed ) {

					// Relay forwarded a cancel/error to the callback; stop waiting.
					finish( false, __( 'The connection was not completed. Please try again.', 'burst-statistics' ) );
					return;
				}

				// Do not read popup.closed: once the popup navigates to Google,
				// COOP severs the handle and .closed reports true while the window
				// is still open. The server poll + timeout are the only reliable
				// signals; the user can abort with Cancel.
				pollTimer.current = setTimeout( poll, POLL_INTERVAL );
			};
			pollTimer.current = setTimeout( poll, POLL_INTERVAL );
		}).catch( () => {
			popup?.close();
			popupRef.current = null;
			setIsConnecting( false );
			setError( __( 'Could not start the connection. Please try again.', 'burst-statistics' ) );
		});
	}, [ queryClient, stopPolling ]);

	const { mutate: disconnectMutate, isPending: isDisconnecting } = useMutation({
		mutationFn: async() => doAction( 'gsc_disconnect', {}),
		onSuccess: () => {
			queryClient.setQueryData([ 'gscStatus' ], { status: 'disconnected' });
			toast.success( __( 'Google Search Console disconnected.', 'burst-statistics' ) );
		}
	});

	return {
		status,
		property,
		propertyStatus,
		isFetching,
		isConnecting,
		isDisconnecting,
		error,
		connect,
		cancelConnect,
		disconnect: () => disconnectMutate()
	};
};

export default useGSCData;
export type { GSCStatus, GSCPropertyStatus, UseGSCDataReturn };
