import React, { useState, useEffect, useRef, useCallback, forwardRef } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import FieldWrapper from '@/components/Fields/FieldWrapper';
import TextInput from '@/components/Inputs/TextInput';
import ButtonInput from '@/components/Inputs/ButtonInput';
import Modal from '@/components/Common/Modal';
import Icon from '@/utils/Icon';
import { doAction } from '@/utils/api';
import { consumeSlackHandoff, parseSlackHandoffToken } from '@/utils/slackHandoff';

interface SlackWebhookFieldProps {
	field: {
		name: string;
		value: string;
		onChange: ( value: string ) => void;
		onBlur?: () => void;
		ref?: React.Ref<HTMLInputElement>;
	};
	fieldState?: {
		error?: {
			message?: string;
		};
	};
	help?: string;
	context?: React.ReactNode;
	id?: string;
	disabled?: boolean;
	[key: string]: any; // eslint-disable-line @typescript-eslint/no-explicit-any
}

interface SlackConnectionStatus {
	is_connected: boolean;
	channel?: string;
	team_name?: string;
	connected_at?: number;
	relay_url?: string;
}

/**
 * Official Slack logo icon component.
 *
 * @param props Props containing size and optional className.
 */
const SlackLogo = ({ size = 18, className = '' }: { size?: number; className?: string }) => (
	<svg
		width={size}
		height={size}
		viewBox="0 0 24 24"
		fill="none"
		xmlns="http://www.w3.org/2000/svg"
		className={className}
		aria-hidden="true"
	>
		<path
			d="M6 15a2 2 0 0 1-2-2 2 2 0 0 1 2-2h2v2a2 2 0 0 1-2 2Zm1 0a2 2 0 0 1 2-2 2 2 0 0 1 2 2v5a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-5Z"
			fill="#E01E5A"
		/>
		<path
			d="M9 6a2 2 0 0 1 2-2 2 2 0 0 1 2 2v2h-2a2 2 0 0 1-2-2Zm0 1a2 2 0 0 1 2 2 2 2 0 0 1-2 2H4a2 2 0 0 1-2-2 2 2 0 0 1 2-2h5Z"
			fill="#36C5F0"
		/>
		<path
			d="M18 9a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-2v-2a2 2 0 0 1 2-2Zm-1 0a2 2 0 0 1-2 2 2 2 0 0 1-2-2V4a2 2 0 0 1 2-2 2 2 0 0 1 2 2v5Z"
			fill="#2EB67D"
		/>
		<path
			d="M15 18a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-2h2a2 2 0 0 1 2 2Zm0-1a2 2 0 0 1-2-2 2 2 0 0 1 2-2h5a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-5Z"
			fill="#ECB22E"
		/>
	</svg>
);

// fallow-ignore-next-line complexity
const SlackWebhookField = forwardRef<HTMLDivElement, SlackWebhookFieldProps>(
	({ field, fieldState, help, context, disabled = false, ...props }, ref ) => {
		const [ isTesting, setIsTesting ] = useState( false );
		const [ isConnecting, setIsConnecting ] = useState( false );
		const [ isDisconnecting, setIsDisconnecting ] = useState( false );
		const [ testResult, setTestResult ] = useState<{ success: boolean; message: string } | null>( null );
		const inputId = props.id || field.name;

		const currentValue = field.value !== undefined ? field.value : ( props.setting?.value || '' );
		const hasValue = Boolean( currentValue && 0 < currentValue.trim().length );
		const isMasked = Boolean( currentValue && currentValue.includes( '•' ) );

		const [ isHelpModalOpen, setIsHelpModalOpen ] = useState( false );
		const [ showManualInput, setShowManualInput ] = useState( Boolean( hasValue && ! isMasked ) );

		const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>( null );
		const timeoutTimerRef = useRef<ReturnType<typeof setTimeout> | null>( null );
		const messageListenerRef = useRef<( ( event: MessageEvent ) => void ) | null>( null );

		const [ connectionStatus, setConnectionStatus ] = useState<SlackConnectionStatus>({
			is_connected: isMasked || Boolean( props.setting?.slack_connected_at ),
			channel: props.setting?.slack_channel || '',
			team_name: props.setting?.slack_team || '',
			connected_at: props.setting?.slack_connected_at || 0
		});

		useEffect( () => {
			const handleOpenWebhook = () => {
				setShowManualInput( true );
				setTimeout( () => {
					document.getElementById( inputId )?.focus({ preventScroll: true });
				}, 50 );
			};
			window.addEventListener( 'burst_open_slack_webhook', handleOpenWebhook );
			return () => {
				window.removeEventListener( 'burst_open_slack_webhook', handleOpenWebhook );
			};
		}, [ inputId ]);

		const cleanupAuthListeners = useCallback( () => {
			if ( pollTimerRef.current ) {
				clearInterval( pollTimerRef.current );
				pollTimerRef.current = null;
			}
			if ( timeoutTimerRef.current ) {
				clearTimeout( timeoutTimerRef.current );
				timeoutTimerRef.current = null;
			}
			if ( messageListenerRef.current ) {
				window.removeEventListener( 'message', messageListenerRef.current );
				messageListenerRef.current = null;
			}
		}, []);

		useEffect( () => {
			return () => {
				cleanupAuthListeners();
			};
		}, [ cleanupAuthListeners ]);

		// Fetch live status on mount if masked value exists but channel metadata is missing.
		useEffect( () => {
			if ( isMasked && ! connectionStatus.channel ) {
				doAction( 'slack_status' ).then( ( res: any ) => { // eslint-disable-line @typescript-eslint/no-explicit-any
					if ( res && res.success && res.data ) {
						setConnectionStatus( res.data );
					}
				}).catch( () => {

					// Silent fail for status check.
				});
			}
		}, [ isMasked, connectionStatus.channel ]);

		const isConnected = isMasked || Boolean( connectionStatus.is_connected );

		const completeConnection = useCallback( async( signature: string, rawPayload: string ) => {
			setIsConnecting( true );
			try {
				const connectRes: any = await doAction( 'slack_connect', { // eslint-disable-line @typescript-eslint/no-explicit-any
					signature,
					raw_payload: rawPayload
				});

				if ( connectRes && connectRes.success ) {
					field.onChange( 'https://hooks.slack.com/services/••••••••/••••••••/••••••••••••••••••••••••' );
					setConnectionStatus( connectRes.data );
					setTestResult({
						success: true,
						message: connectRes.message || __( 'Connected to Slack successfully!', 'burst-statistics' )
					});
				} else {
					setTestResult({
						success: false,
						message: connectRes?.message || __( 'Failed to save Slack connection.', 'burst-statistics' )
					});
				}
			} catch ( err: any ) { // eslint-disable-line @typescript-eslint/no-explicit-any
				setTestResult({
					success: false,
					message: err?.message || __( 'Error finalizing Slack connection.', 'burst-statistics' )
				});
			} finally {
				setIsConnecting( false );
			}
		}, [ field ]);

		// Complete redirect handoff if a token was captured from the URL fragment on initial load.
		useEffect( () => {
			const handoffToken = consumeSlackHandoff();
			if ( ! handoffToken ) {
				return;
			}

			const parsed = parseSlackHandoffToken( handoffToken );
			if ( ! parsed ) {
				setTestResult({
					success: false,
					message: __( 'Invalid Slack connection token.', 'burst-statistics' )
				});
				return;
			}

			completeConnection( parsed.signature, parsed.rawPayload );
		}, [ completeConnection ]);

		// fallow-ignore-next-line complexity
		const handleConnect = async() => {
			cleanupAuthListeners();
			setIsConnecting( true );
			setTestResult( null );

			try {
				const res: any = await doAction( 'slack_get_auth_url', { flow: 'popup' }); // eslint-disable-line @typescript-eslint/no-explicit-any

				if ( ! res || ! res.success || ! res.data?.auth_url ) {
					setTestResult({
						success: false,
						message: res?.message || __( 'Could not generate Slack connection URL. Please try again.', 'burst-statistics' )
					});
					setIsConnecting( false );
					return;
				}

				const authUrl = res.data.auth_url;
				const relayUrl = res.data.relay_url;

				const width = 600;
				const height = 750;
				const left = window.screenX + ( window.outerWidth - width ) / 2;
				const top = window.screenY + ( window.outerHeight - height ) / 2;

				const popup = window.open(
					authUrl,
					'burst_slack_oauth',
					`width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no,scrollbars=yes`
				);

				// Fallback to direct redirect if popup was blocked.
				if ( ! popup || popup.closed || 'undefined' === typeof popup.closed ) {
					try {
						const redirectRes: any = await doAction( 'slack_get_auth_url', { flow: 'redirect' }); // eslint-disable-line @typescript-eslint/no-explicit-any
						if ( redirectRes?.data?.auth_url ) {
							window.location.href = redirectRes.data.auth_url;
							return;
						}
					} catch {

						// Handled below.
					}

					setTestResult({
						success: false,
						message: __( 'Popup was blocked and redirect fallback failed. Please enable popups for this site.', 'burst-statistics' )
					});
					setIsConnecting( false );
					return;
				}

				// Set overall 5-minute timeout for OAuth connection.
				timeoutTimerRef.current = setTimeout( () => {
					cleanupAuthListeners();
					setIsConnecting( false );
					setTestResult({
						success: false,
						message: __( 'Slack connection timed out. Please try again.', 'burst-statistics' )
					});
				}, 5 * 60 * 1000 );

				const messageListener = async( event: MessageEvent ) => {
					try {
						const relayOrigin = new URL( relayUrl ).origin;
						if ( event.origin !== relayOrigin ) {
							return;
						}
					} catch {
						return;
					}

					if ( 'BURST_SLACK_CONNECTED' === event.data?.type ) {
						cleanupAuthListeners();
						completeConnection(
							event.data.signature,
							JSON.stringify( event.data.payload )
						);
					} else if ( 'BURST_SLACK_ERROR' === event.data?.type ) {
						cleanupAuthListeners();
						setIsConnecting( false );
						setTestResult({
							success: false,
							message: event.data.error || __( 'Slack authorization was cancelled or failed.', 'burst-statistics' )
						});
					}
				};

				messageListenerRef.current = messageListener;
				window.addEventListener( 'message', messageListener );

				pollTimerRef.current = setInterval( () => {
					if ( popup && popup.closed ) {
						cleanupAuthListeners();
						setIsConnecting( false );
					}
				}, 1000 );
			} catch ( err: any ) { // eslint-disable-line @typescript-eslint/no-explicit-any
				cleanupAuthListeners();
				setIsConnecting( false );
				setTestResult({
					success: false,
					message: err?.message || __( 'Failed to start Slack authorization.', 'burst-statistics' )
				});
			}
		};

		const handleDisconnect = async() => {
			setIsDisconnecting( true );
			setTestResult( null );

			try {
				const res: any = await doAction( 'slack_disconnect' ); // eslint-disable-line @typescript-eslint/no-explicit-any
				if ( res && res.success ) {
					field.onChange( '' );
					setConnectionStatus({ is_connected: false });
					setShowManualInput( false );
					setTestResult({
						success: true,
						message: __( 'Slack disconnected.', 'burst-statistics' )
					});
				} else {
					setTestResult({
						success: false,
						message: res?.message || __( 'Failed to disconnect Slack.', 'burst-statistics' )
					});
				}
			} catch ( err: any ) { // eslint-disable-line @typescript-eslint/no-explicit-any
				setTestResult({
					success: false,
					message: err?.message || __( 'Network error while disconnecting Slack.', 'burst-statistics' )
				});
			} finally {
				setIsDisconnecting( false );
			}
		};

		// Without a webhook, explain how to get one instead of what it does.
		const shownContext = ! hasValue && props.setting?.context_empty ? props.setting.context_empty : context;

		// fallow-ignore-next-line complexity
		const handleSendTest = async() => {
			const webhookUrl = currentValue ? currentValue.trim() : '';

			if ( ! webhookUrl && ! isConnected ) {
				setTestResult({
					success: false,
					message: __( 'Please connect to Slack or enter a webhook URL first.', 'burst-statistics' )
				});
				return;
			}

			setIsTesting( true );
			setTestResult( null );

			try {
				const response: any = await doAction( 'slack_test', { // eslint-disable-line @typescript-eslint/no-explicit-any
					webhook_url: webhookUrl
				});

				if ( response && response.success ) {
					setTestResult({
						success: true,
						message: response.message || __( 'Test message sent successfully!', 'burst-statistics' )
					});
				} else {
					setTestResult({
						success: false,
						message: ( response && response.message ) || __( 'Failed to send test message.', 'burst-statistics' )
					});
				}
			} catch ( error: any ) { // eslint-disable-line @typescript-eslint/no-explicit-any
				setTestResult({
					success: false,
					message: error?.message || __( 'Network error while testing webhook.', 'burst-statistics' )
				});
			} finally {
				setIsTesting( false );
			}
		};

		return (
			<div ref={ref} className="w-full">
				<FieldWrapper
					inputId={inputId}
					help={help}
					error={fieldState?.error?.message}
					context={shownContext}
					label={props.label || __( 'Slack notifications', 'burst-statistics' )}
					disabled={disabled}
					className={props.className}
					{...props}
				>
					<div className="flex flex-col gap-3 mt-1">
						{/* Connected State Card */}
						{isConnected ? (
							<div className="p-4 rounded-xl border border-gray-200 bg-gray-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
								<div className="flex items-center gap-3 min-w-0">
									<div className="w-10 h-10 rounded-lg bg-white border border-gray-200 flex items-center justify-center shrink-0 shadow-2xs">
										<SlackLogo size={20} />
									</div>
									<div className="flex flex-col min-w-0">
										<div className="flex items-center gap-1.5 font-medium text-sm text-text-black">
											<span className="truncate">
												{connectionStatus.channel ? (
													sprintf(

														/* translators: 1: Slack channel name, 2: Slack workspace name */
														__( 'Connected to %1$s in %2$s', 'burst-statistics' ),
														connectionStatus.channel,
														connectionStatus.team_name || __( 'Slack', 'burst-statistics' )
													)
												) : (
													__( 'Slack webhook connected', 'burst-statistics' )
												)}
											</span>
											<span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xxs font-semibold bg-primary-50 text-primary">
												{__( 'Active', 'burst-statistics' )}
											</span>
										</div>
										<p className="text-xs text-text-gray truncate mt-0.5">
											{__( 'Notifications will be delivered to this Slack channel.', 'burst-statistics' )}
										</p>
									</div>
								</div>

								<div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
									<ButtonInput
										btnVariant="tertiary"
										size="sm"
										onClick={handleSendTest}
										disabled={disabled || isTesting}
										className="whitespace-nowrap flex items-center gap-1.5"
									>
										{isTesting ? (
											<>
												<Icon name="loading" size={13} className="animate-spin" />
												<span>{__( 'Sending…', 'burst-statistics' )}</span>
											</>
										) : (
											<span>{__( 'Send test message', 'burst-statistics' )}</span>
										)}
									</ButtonInput>
									<ButtonInput
										btnVariant="secondary"
										size="sm"
										onClick={handleDisconnect}
										disabled={disabled || isDisconnecting}
										className="whitespace-nowrap text-red hover:bg-red-50 hover:border-red"
									>
										{isDisconnecting ? (
											<span className="flex items-center gap-1.5">
												<Icon name="loading" size={13} className="animate-spin" />
												<span>{__( 'Disconnecting…', 'burst-statistics' )}</span>
											</span>
										) : (
											__( 'Disconnect', 'burst-statistics' )
										)}
									</ButtonInput>
								</div>
							</div>
						) : (

							/* Disconnected State: One-Click Connect Button Card */
							<div className="p-4 rounded-xl border border-gray-200 bg-gray-50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
								<div className="flex items-start gap-3">
									<div className="w-10 h-10 rounded-lg bg-white border border-gray-200 flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
										<SlackLogo size={22} />
									</div>
									<div className="flex flex-col">
										<h4 className="font-semibold text-sm text-text-black">
											{__( 'Connect Burst Statistics to Slack', 'burst-statistics' )}
										</h4>
										<p className="text-xs text-text-gray mt-1 leading-relaxed">
											{__(
												'Receive story reports, traffic spike/dip alerts, and tracking health notifications directly in your channel.',
												'burst-statistics'
											)}
										</p>
									</div>
								</div>

								<div className="shrink-0 self-start sm:self-center">
									<ButtonInput
										btnVariant="primary"
										size="md"
										onClick={handleConnect}
										disabled={disabled || isConnecting}
										className="whitespace-nowrap flex items-center gap-2 font-medium"
									>
										{isConnecting ? (
											<>
												<Icon name="loading" size={14} className="animate-spin" />
												<span>{__( 'Connecting…', 'burst-statistics' )}</span>
											</>
										) : (
											<>
												<SlackLogo size={16} />
												<span>{__( 'Connect to Slack', 'burst-statistics' )}</span>
											</>
										)}
									</ButtonInput>
								</div>
							</div>
						)}

						{/* Collapsible Manual Webhook Entry */}
						<div className="flex flex-col gap-2">
							<button
								type="button"
								onClick={() => setShowManualInput( ! showManualInput )}
								className="inline-flex items-center gap-1.5 text-xs text-text-gray hover:text-text-black cursor-pointer self-start focus:outline-none transition-colors"
							>
								<Icon
									name={showManualInput ? 'chevron-down' : 'chevron-right'}
									size={12}
								/>
								<span>
									{isConnected ?
										__( 'Webhook details', 'burst-statistics' ) :
										__( 'Or enter a webhook URL manually', 'burst-statistics' )}
								</span>
							</button>

							{showManualInput && (
								<div className="p-3 rounded-lg border border-gray-200 bg-white flex flex-col gap-2 mt-1">
									<div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
										<div className="relative flex-1 min-w-0">
											<TextInput
												id={inputId}
												name={field.name}
												value={currentValue}
												onChange={( e ) => {
													setTestResult( null );
													field.onChange( e.target.value );
												}}
												onBlur={field.onBlur}
												placeholder="https://hooks.slack.com/services/..."
												disabled={disabled}
												className={`w-full font-mono text-sm ${hasValue && ! disabled ? 'pr-8' : ''}`}
											/>
											{hasValue && ! disabled && (
												<button
													type="button"
													onClick={() => {
														field.onChange( '' );
														setTestResult( null );
													}}
													title={__( 'Clear webhook URL', 'burst-statistics' )}
													className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-gray hover:text-text-black p-0.5 cursor-pointer focus:outline-hidden"
												>
													<Icon name="close" size={14} />
												</button>
											)}
										</div>
										{! isConnected && (
											<ButtonInput
												btnVariant="tertiary"
												size="md"
												onClick={handleSendTest}
												disabled={disabled || isTesting || ! hasValue}
												className="whitespace-nowrap shrink-0 flex items-center justify-center"
											>
												{isTesting ? (
													<span className="flex items-center gap-1.5">
														<Icon name="loading" size={14} className="animate-spin" />
														{__( 'Sending…', 'burst-statistics' )}
													</span>
												) : (
													__( 'Send test message', 'burst-statistics' )
												)}
											</ButtonInput>
										)}
									</div>

									{/* Saved / Unsaved status indicator for manual input */}
									{isMasked && (
										<div className="flex items-center gap-1.5 text-xs text-primary font-medium mt-0.5">
											<Icon name="check" size={13} className="shrink-0" />
											<span>{__( 'Slack webhook configured and saved', 'burst-statistics' )}</span>
										</div>
									)}
									{hasValue && ! isMasked && (
										<div className="flex items-center gap-1.5 text-xs text-text-gray mt-0.5">
											<span>{__( 'Unsaved changes — click Save at the bottom to apply.', 'burst-statistics' )}</span>
										</div>
									)}

									{/* Help link */}
									<div className="flex items-center justify-between pt-1 text-xs text-text-gray border-t border-gray-100">
										<span>{__( 'Custom incoming webhook URL for advanced configurations.', 'burst-statistics' )}</span>
										<button
											type="button"
											onClick={() => setIsHelpModalOpen( true )}
											className="inline-flex items-center gap-1 text-primary hover:underline font-medium cursor-pointer shrink-0 focus:outline-none"
										>
											<Icon name="help" size={13} />
											<span>{__( 'Setup guide', 'burst-statistics' )}</span>
										</button>
									</div>
								</div>
							)}
						</div>

						{/* Test / Operation Feedback Toast */}
						{testResult && (
							<div
								className={`p-3 rounded-lg text-sm flex items-center gap-2.5 border transition-all mt-1 ${
									testResult.success ?
										'bg-primary-50 text-text-black border-primary' :
										'bg-red-50 text-text-black border-red'
								}`}
							>
								<Icon
									name={testResult.success ? 'check' : 'warning'}
									size={16}
									className={`shrink-0 ${testResult.success ? 'text-primary' : 'text-red'}`}
								/>
								<span className="leading-relaxed">{testResult.message}</span>
							</div>
						)}
					</div>
				</FieldWrapper>

				{/* Help Guide Modal */}
				<Modal
					isOpen={isHelpModalOpen}
					onClose={() => setIsHelpModalOpen( false )}
					title={__( 'Setting up a Slack incoming webhook', 'burst-statistics' )}
					subtitle={__( 'Follow these steps to generate a webhook URL manually in Slack', 'burst-statistics' )}
					content={
						<div className="flex flex-col gap-4 text-sm text-text-black py-2">
							<p className="text-text-gray leading-relaxed">
								{__(
									'Incoming webhooks allow Burst Statistics to post story reports, traffic spike/dip alerts, and tracking health notifications into your Slack channel.',
									'burst-statistics'
								)}
							</p>

							<ol className="list-decimal pl-5 space-y-3 text-text-gray leading-relaxed">
								<li>
									<span className="font-semibold text-text-black">{__( 'Create a Slack app:', 'burst-statistics' )}</span>{' '}
									{__( 'Go to', 'burst-statistics' )}{' '}
									<a
										href="https://api.slack.com/apps"
										target="_blank"
										rel="noopener noreferrer"
										className="text-primary hover:underline focus:outline-none inline-flex items-center gap-1 font-medium"
									>
										api.slack.com/apps <Icon name="external-link" size={12} />
									</a>{' '}
									{__( 'and click', 'burst-statistics' )}{' '}
									<strong className="text-text-black">{__( '"Create New App" → "From scratch"', 'burst-statistics' )}</strong>.{' '}
									{__( 'Give it a name (e.g. "Burst Statistics") and choose your workspace.', 'burst-statistics' )}
								</li>

								<li>
									<span className="font-semibold text-text-black">{__( 'Enable webhooks:', 'burst-statistics' )}</span>{' '}
									{__( 'In your app settings, click on', 'burst-statistics' )}{' '}
									<strong className="text-text-black">{__( '"Incoming Webhooks"', 'burst-statistics' )}</strong>{' '}
									{__( 'in the left menu and toggle the switch to', 'burst-statistics' )}{' '}
									<strong className="text-text-black">{__( '"On"', 'burst-statistics' )}</strong>.
								</li>

								<li>
									<span className="font-semibold text-text-black">{__( 'Add webhook to workspace:', 'burst-statistics' )}</span>{' '}
									{__( 'Click the', 'burst-statistics' )}{' '}
									<strong className="text-text-black">{__( '"Add New Webhook to Workspace"', 'burst-statistics' )}</strong>{' '}
									{__( 'button at the bottom of the page.', 'burst-statistics' )}
								</li>

								<li>
									<span className="font-semibold text-text-black">{__( 'Select channel:', 'burst-statistics' )}</span>{' '}
									{__( 'Choose the channel where you would like notifications to appear and click', 'burst-statistics' )}{' '}
									<strong className="text-text-black">{__( '"Allow"', 'burst-statistics' )}</strong>.
								</li>

								<li>
									<span className="font-semibold text-text-black">{__( 'Copy and paste:', 'burst-statistics' )}</span>{' '}
									{__( 'Copy the generated webhook URL (starts with', 'burst-statistics' )}{' '}
									<code className="bg-white text-text-black border border-border px-1.5 py-0.5 rounded text-xs font-mono">
										https://hooks.slack.com/services/...
									</code>
									{__( ') and paste it into the field above.', 'burst-statistics' )}
								</li>

								<li>
									<span className="font-semibold text-text-black">{__( 'Test and save:', 'burst-statistics' )}</span>{' '}
									{__( 'Click "Send test message" to verify delivery, then click "Save" on this settings page.', 'burst-statistics' )}
								</li>
							</ol>

							<div className="bg-yellow-50 border border-yellow-200 rounded-md p-3 text-xs text-text-black mt-2 leading-relaxed">
								<strong className="font-semibold">{__( 'Security note:', 'burst-statistics' )}</strong>{' '}
								{__(
									'Treat your webhook URL like a password. It gives permission to post messages to your channel. Burst Statistics masks this URL once saved and excludes it from diagnostic exports.',
									'burst-statistics'
								)}
							</div>
						</div>
					}
					footer={
						<div className="flex justify-end">
							<ButtonInput
								btnVariant="tertiary"
								size="sm"
								onClick={() => setIsHelpModalOpen( false )}
							>
								{__( 'Close', 'burst-statistics' )}
							</ButtonInput>
						</div>
					}
				/>
			</div>
		);
	}
);

SlackWebhookField.displayName = 'SlackWebhookField';
export default SlackWebhookField;
