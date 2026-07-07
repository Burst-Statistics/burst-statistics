import { __ } from '@wordpress/i18n';
import { createInterpolateElement } from '@wordpress/element';
import { useEffect, useState } from 'react';
import useGSCData from '@/hooks/useGSCData';
import ButtonInput from '@/components/Inputs/ButtonInput';
import Modal from '@/components/Common/Modal';
import Icon from '@/utils/Icon';

/**
 * Google Search Console product mark. Inlined (no asset) following the BurstLogo
 * pattern. Native artwork is 256x228; only `size` is exposed.
 *
 * @param {Object} props      Component props.
 * @param {number} props.size Edge length in px.
 * @return {JSX.Element} The icon.
 */
const GoogleSearchConsoleIcon = ({ size = 24 }: { size?: number }) => (
	<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 228" width={ size } height={ size } aria-hidden="true" focusable="false">
		<defs>
			<radialGradient id="burst-gsc-screen" cx="21.66%" cy="28.708%" r="82.87%" fx="21.66%" fy="28.708%" gradientTransform="matrix(.59503 .59486 -.44034 .80383 .214 -.073)">
				<stop offset="0%" stopColor="#F1F2F2" />
				<stop offset="100%" stopColor="#E6E7E8" />
			</radialGradient>
		</defs>
		<path fill="#737373" d="M165.979 0H90.021L71.097 19.055v18.924h18.924V19.055h75.958v18.924h18.924V19.055z" />
		<path fill="#BFBFBF" d="M90.021 0v19.055h75.958V0z" />
		<path fill="url(#burst-gsc-screen)" d="M36.402 37.98L0 74.381v134.177c0 10.513 8.542 18.924 18.924 18.924h218.152c10.513 0 18.924-8.543 18.924-18.924V74.513L219.466 37.98z" />
		<path fill="#FFF" d="M28.517 109.076h199.097v118.538H28.517z" />
		<path fill="#E0E0E0" d="M36.402 37.979L0 74.382v34.694h256V74.513l-36.534-36.534z" />
		<path fill="#D1D1D1" d="M42.71 213.29H128v14.193H42.71z" />
		<path fill="#4285F4" d="M28.517 86.998a14.695 14.695 0 0 1 14.72-14.719h169.527a14.695 14.695 0 0 1 14.719 14.719v22.078H28.517z" />
		<path fill="#E6E6E6" d="M56.903 90.152a7.067 7.067 0 0 1-7.096 7.096a7.067 7.067 0 0 1-7.097-7.096a7.067 7.067 0 0 1 7.097-7.097a7.067 7.067 0 0 1 7.096 7.097m23.656 0a7.067 7.067 0 0 1-7.097 7.096a7.067 7.067 0 0 1-7.096-7.096a7.067 7.067 0 0 1 7.096-7.097a7.067 7.067 0 0 1 7.097 7.097" />
		<path fill="#BABABA" d="m227.483 165.191l-29.832-29.832l-9.988 30.883l-40.739-40.608l-1.183 62.686l15.113 23.655c2.234-.394-11.302 15.508-11.302 15.508h77.93z" />
		<path fill="#4D4D4D" d="M208.821 164.008c0-16.821-9.856-31.277-23.918-38.242v39.95l-18.792 10.12l-19.056-10.12v-40.082c-14.061 6.966-23.655 21.553-23.655 38.243c0 16.821 9.725 31.277 23.787 38.242v25.364h37.848v-25.364c13.93-6.834 23.786-21.42 23.786-38.11" />
		<path fill="#D1D1D1" d="M42.71 123.269h66.366v75.828H42.71z" />
	</svg>
);

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
const GoogleSearchConsoleField = () => {
	const { status, isFetching, isConnecting, isDisconnecting, error, connect, cancelConnect, disconnect } = useGSCData();
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
