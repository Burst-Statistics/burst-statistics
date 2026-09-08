import { __, sprintf } from '@wordpress/i18n';
import { createInterpolateElement } from '@wordpress/element';
import { useEffect, useState } from 'react';
import useGSCData from '@/hooks/useGSCData';
import ButtonInput from '@/components/Inputs/ButtonInput';
import { GoogleSearchConsoleIcon } from '@/components/Common/GoogleSearchConsoleIcon';
import Modal from '@/components/Common/Modal';
import Icon from '@/utils/Icon';
import { formatUnixToDateTime } from '@/utils/formatting';

/**
 * Settings field that connects / disconnects Google Search Console.
 *
 * Renders the three connection states (connected, disconnected,
 * needs-reconnect). Connecting happens inside a modal so the loading and error
 * states stay visible for the whole popup round-trip. Token handling lives
 * entirely on the server; this only reflects state.
 *
 * @return {JSX.Element} The rendered field.
 */

// fallow-ignore-next-line complexity -- Manages OAuth connect/disconnect UI states with status-conditional rendering; branching is inherent to multi-step authorization flow.
const GoogleSearchConsoleField = () => {
	const { status, propertyStatus, siteUrl, retryAt, isFetching, isConnecting, isDisconnecting, error, connect, cancelConnect, disconnect } = useGSCData();
	const [ connectOpen, setConnectOpen ] = useState( false );
	const [ disconnectOpen, setDisconnectOpen ] = useState( false );

	const isConnected = 'connected' === status;
	const needsReconnect = 'needs-reconnect' === status;

	// Close the connect modal once the connection lands.
	useEffect( () => {
		if ( connectOpen && isConnected ) {
			setConnectOpen( false );
		}
	}, [ connectOpen, isConnected ]);

	const closeConnect = () => {
		cancelConnect();
		setConnectOpen( false );
	};

	return (
		<div className="w-full p-6">
			<div className="flex items-center justify-between gap-4">
				<div className="flex items-center gap-3">
					<GoogleSearchConsoleIcon size={ 24 } />
					<div>
						<p className="font-semibold text-text-black">
							{ __( 'Google Search Console', 'burst-statistics' ) }
						</p>
						<p className="text-sm text-text-gray">
							{ isConnected && __( 'Connected', 'burst-statistics' ) }
							{ needsReconnect && __( 'Reconnection required', 'burst-statistics' ) }
							{ 'disconnected' === status && __( 'Not connected', 'burst-statistics' ) }
						</p>
					</div>
				</div>

				<div className="flex items-center gap-2">
					{ isFetching && <Icon name="loading" size={ 20 } /> }
					{ ! isConnected && (
						<ButtonInput btnVariant="primary" onClick={ () => setConnectOpen( true ) }>
							{ needsReconnect ? __( 'Reconnect', 'burst-statistics' ) : __( 'Connect', 'burst-statistics' ) }
						</ButtonInput>
					) }
					{ isConnected && (
						<ButtonInput
							btnVariant="tertiary"
							onClick={ () => setDisconnectOpen( true ) }
							disabled={ isDisconnecting }
						>
							{ __( 'Disconnect', 'burst-statistics' ) }
						</ButtonInput>
					) }
				</div>
			</div>

			<p className="mt-4 text-sm text-text-gray">
				{ createInterpolateElement(
					__( 'Burst shows your Search Console data using read-only access. Your authorization is stored only on this site and the data is fetched directly from Google – nothing is stored on Burst’s servers. <a>Read our Search Console privacy policy</a>.', 'burst-statistics' ),
					{
						a: (
							<a
								href="https://burst-statistics.com/legal/search-console-integration-privacy-policy/"
								target="_blank"
								rel="noopener noreferrer"
								className="text-primary hover:underline"
							/>
						)
					}
				) }
			</p>

			{ isConnected && 'none' === propertyStatus && (
				<p className="mt-4 text-sm text-red">
					{ sprintf(

						/* translators: %s is the site URL that needs a Search Console property. */
						__( 'No matching property found — add a URL-prefix property for %s in Search Console.', 'burst-statistics' ),
						siteUrl
					) }
				</p>
			) }

			{ isConnected && 'paused' === propertyStatus && (
				<p className="mt-4 text-sm text-text-gray">
					{ sprintf(

						/* translators: %s is the time when Search Console property resolution will retry. */
						__( 'Search Console access was temporarily denied. Stored data is retained and syncing will retry after %s.', 'burst-statistics' ),
						formatUnixToDateTime( retryAt )
					) }
				</p>
			) }

			<Modal
				title={ __( 'Connect Google Search Console', 'burst-statistics' ) }
				content={
					<div className="flex flex-col gap-4">
						<p className="text-text-gray">
							{ __( 'Burst will open a Google window where you can grant read-only access to your Search Console data. Keep this tab open while you authorize.', 'burst-statistics' ) }
						</p>
						{ isConnecting && (
							<div className="flex items-center gap-2 text-text-gray">
								<Icon name="loading" size={ 20 } />
								<span>{ __( 'Waiting for authorization in the Google window…', 'burst-statistics' ) }</span>
							</div>
						) }
						{ error && ! isConnecting && (
							<p className="text-sm text-red">{ error }</p>
						) }
					</div>
				}
				isOpen={ connectOpen }
				onClose={ closeConnect }
				footer={
					<>
						<ButtonInput btnVariant="tertiary" onClick={ closeConnect }>
							{ __( 'Cancel', 'burst-statistics' ) }
						</ButtonInput>
						<ButtonInput btnVariant="primary" onClick={ connect } disabled={ isConnecting }>
							<span className="inline-flex items-center gap-2">
								{ __( 'Connect with Google', 'burst-statistics' ) }
							</span>
						</ButtonInput>
					</>
				}
			/>

			<Modal
				title={ __( 'Disconnect Google Search Console?', 'burst-statistics' ) }
				content={
					<p>
						{ __( 'This revokes Burst’s access to your Search Console data. You can reconnect at any time.', 'burst-statistics' ) }
					</p>
				}
				isOpen={ disconnectOpen }
				onClose={ () => setDisconnectOpen( false ) }
				footer={
					<>
						<ButtonInput btnVariant="tertiary" onClick={ () => setDisconnectOpen( false ) }>
							{ __( 'Cancel', 'burst-statistics' ) }
						</ButtonInput>
						<ButtonInput
							btnVariant="primary"
							onClick={ () => {
								disconnect();
								setDisconnectOpen( false );
							} }
							disabled={ isDisconnecting }
						>
							{ __( 'Disconnect', 'burst-statistics' ) }
						</ButtonInput>
					</>
				}
			/>
		</div>
	);
};

export default GoogleSearchConsoleField;
