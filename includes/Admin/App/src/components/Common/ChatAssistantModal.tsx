import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { __, sprintf } from '@wordpress/i18n';
import clsx from 'clsx';
import { Close } from '@radix-ui/react-dialog';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import Modal from '@/components/Common/Modal';
import ButtonInput from '@/components/Inputs/ButtonInput';
import Tooltip from '@/components/Common/Tooltip';
import useSettingsData from '@/hooks/useSettingsData';
import Icon from '@/utils/Icon';
import {
	getChatStatus,
	getLocalStorage,
	postChatMessage,
	setLocalStorage
} from '@/utils/api';
import { formatDateAndTime } from '@/utils/formatting';

type ChatAvailability = {
	enabled?: boolean;
	abilities_enabled?: boolean;
	ai_client_loaded?: boolean;
	has_configured_provider?: boolean;

	/** Pre-formatted connector approval names that still need to be granted. */
	missing_approvals?: string[];
};

type ChatSession = {
	id: string;
	title: string;
	history: Array<Record<string, unknown>>;
	createdAt: number;
	updatedAt: number;
};

type TimelineItem = {
	id: string;
	type: 'message';
	role?: 'user' | 'assistant';
	text?: string;
};

const STORAGE_KEY = 'chat_conversations_v1';
const MAX_STORED_SESSIONS = 20;
const MAX_MESSAGES_PER_SESSION = 40;
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const DEFAULT_TITLE = __( 'New chat', 'burst-statistics' );
const LOADING_STEPS = [
	__( 'Understanding your question...', 'burst-statistics' ),
	__( 'Fetching analytics data...', 'burst-statistics' ),
	__( 'Preparing a concise answer...', 'burst-statistics' )
];

const asString = ( value: unknown ): string => {
	return 'string' === typeof value ? value : '';
};

const boolFromSetting = ( value: unknown, fallback = true ): boolean => {
	if ( 'boolean' === typeof value ) {
		return value;
	}
	if ( 'number' === typeof value ) {
		return 1 === value;
	}
	if ( 'string' === typeof value ) {
		if ([ '1', 'true', 'yes', 'on' ].includes( value.toLowerCase() ) ) {
			return true;
		}
		if ([ '0', 'false', 'no', 'off' ].includes( value.toLowerCase() ) ) {
			return false;
		}
	}
	return fallback;
};

const parseExplicitBooleanSetting = ( value: unknown ): boolean | null => {
	if ( 'boolean' === typeof value ) {
		return value;
	}

	if ( 'number' === typeof value ) {
		if ( 1 === value ) {
			return true;
		}

		if ( 0 === value ) {
			return false;
		}

		return null;
	}

	if ( 'string' === typeof value ) {
		const normalized = value.toLowerCase();
		if ([ '1', 'true', 'yes', 'on' ].includes( normalized ) ) {
			return true;
		}

		if ([ '0', 'false', 'no', 'off' ].includes( normalized ) ) {
			return false;
		}
	}

	return null;
};

const getPartChannel = ( part: Record<string, unknown> ): string => {
	const channel = part.channel;
	if ( 'string' === typeof channel ) {
		return channel;
	}
	if ( channel && 'object' === typeof channel ) {
		return asString( ( channel as { value?: unknown }).value );
	}
	return '';
};

const shortText = ( value: string, max = 80 ): string => {
	return value.length > max ? `${value.substring( 0, max ).trim()}...` : value;
};

const extractMessageText = ( message: Record<string, unknown> ): string => {
	if ( Array.isArray( message.parts ) ) {
		const textParts = message.parts
			.filter( ( part ) => part && 'object' === typeof part )
			.map( ( part ) => part as Record<string, unknown> )
			.filter( ( part ) => {
				const channel = getPartChannel( part );
				return ! channel || 'content' === channel;
			})
			.map( ( part ) => asString( part.text ) )
			.filter( ( text ) => '' !== text );

		return textParts.join( '\n\n' );
	}

	return asString( message.content );
};

const sanitizeHistoryForStorage = (
	history: Array<Record<string, unknown>>
): Array<Record<string, unknown>> => {
	const sanitized: Array<Record<string, unknown>> = [];

	history.forEach( ( rawMessage ) => {
		const rawRole = asString( rawMessage.role );
		const role =
			'user' === rawRole ?
				'user' :
				'assistant' === rawRole || 'model' === rawRole ?
					'assistant' :
					'';
		const text = extractMessageText( rawMessage ).trim();

		if ( '' === role || '' === text ) {
			return;
		}

		const nextMessage = { role, content: text };
		const previousMessage = sanitized[sanitized.length - 1];

		if (
			previousMessage &&
			'assistant' === role &&
			'assistant' === previousMessage.role
		) {
			sanitized[sanitized.length - 1] = nextMessage;
			return;
		}

		sanitized.push( nextMessage );
	});

	return sanitized.slice( -MAX_MESSAGES_PER_SESSION );
};

const applySessionStorageLimits = (
	sessionList: ChatSession[]
): ChatSession[] => {
	const minUpdatedAt = Date.now() - SESSION_TTL_MS;

	const sanitized = sessionList
		.filter( ( session ) => session.updatedAt >= minUpdatedAt )
		.map( ( session ) => ({
			...session,
			history: sanitizeHistoryForStorage( session.history )
		}) )
		.sort( ( a, b ) => b.updatedAt - a.updatedAt )
		.slice( 0, MAX_STORED_SESSIONS );

	return sanitized;
};
const randomSlug = (): string => {

	// Prefer crypto.randomUUID when available (secure contexts only).
	if ( 'undefined' !== typeof crypto && 'function' === typeof crypto.randomUUID ) {
		return crypto.randomUUID().replace( /-/g, '' ).slice( 0, 8 );
	}

	// Fallback: 4 random bytes as hex (works in any context that has Web Crypto).
	const bytes = new Uint8Array( 4 );
	crypto.getRandomValues( bytes );
	return Array.from( bytes, ( b ) => b.toString( 16 ).padStart( 2, '0' ) ).join( '' );
};

const createSession = (): ChatSession => {
	const ts = Date.now();
	return {
		id: `${ts}-${randomSlug()}`,
		title: DEFAULT_TITLE,
		history: [],
		createdAt: ts,
		updatedAt: ts
	};
};

const isSessionBlank = ( session: ChatSession ): boolean => {
	return 0 === sanitizeHistoryForStorage( session.history ).length;
};

const normalizeChatStatus = ( status: unknown ): ChatAvailability => {
	if ( ! status || 'object' !== typeof status ) {
		return {};
	}

	const typed = status as Record<string, unknown>;
	const hasOwn = ( key: string ): boolean =>
		Object.prototype.hasOwnProperty.call( typed, key );

	const rawMissing = typed.missing_approvals;
	const missingApprovals = Array.isArray( rawMissing ) ?
		rawMissing.map( ( item ) => asString( item ) ).filter( ( item ) => '' !== item ) :
		[];

	return {
		enabled: hasOwn( 'enabled' ) ?
			boolFromSetting( typed.enabled, false ) :
			undefined,
		abilities_enabled: hasOwn( 'abilities_enabled' ) ?
			boolFromSetting( typed.abilities_enabled, true ) :
			undefined,
		ai_client_loaded: hasOwn( 'ai_client_loaded' ) ?
			boolFromSetting( typed.ai_client_loaded, false ) :
			undefined,
		has_configured_provider: hasOwn( 'has_configured_provider' ) ?
			boolFromSetting( typed.has_configured_provider, false ) :
			undefined,
		missing_approvals: missingApprovals
	};
};

const buildTimeline = (
	history: Array<Record<string, unknown>>
): TimelineItem[] => {
	const output: TimelineItem[] = [];

	history.forEach( ( message, messageIndex ) => {
		const rawRole = asString( message.role );
		const role: 'user' | 'assistant' =
			'user' === rawRole ?
				'user' :
				'assistant' === rawRole || 'model' === rawRole ?
					'assistant' :
					'assistant';
		const text = extractMessageText( message );

		if ( text ) {
			output.push({
				id: `message-${messageIndex}`,
				type: 'message',
				role,
				text
			});
		}
	});

	return output;
};

const ChatAssistantModal = () => {
	const { getValue } = useSettingsData();
	const [ isOpen, setIsOpen ] = useState( false );
	const [ sessions, setSessions ] = useState<ChatSession[]>([]);
	const [ activeSessionId, setActiveSessionId ] = useState( '' );
	const [ prompt, setPrompt ] = useState( '' );
	const [ deleteSessionId, setDeleteSessionId ] = useState<string | null>( null );
	const [ pendingMessage, setPendingMessage ] = useState( '' );
	const [ isSending, setIsSending ] = useState( false );
	const [ loadingStep, setLoadingStep ] = useState( 0 );
	const [ requestError, setRequestError ] = useState( '' );

	const queryClient = useQueryClient();

	// Single source of truth for chat status: one cached REST call, deduped,
	// refetched at most once per 60s. Replaces three useEffect-driven manual
	// refresh calls plus a chatStatus → abilitiesEnabled feedback loop.
	// The REST endpoint is the only source — PHP does not preload via localize_script.
	const { data: chatStatus = {} as ChatAvailability } = useQuery<ChatAvailability>({
		queryKey: [ 'chat-status' ],
		queryFn: async() => normalizeChatStatus( await getChatStatus() ),
		staleTime: 60_000,
		refetchOnWindowFocus: false
	});

	const messagesContainerRef = useRef<HTMLDivElement | null>( null );
	const scrollRef = useRef<HTMLDivElement | null>( null );
	const explicitAbilitiesSetting = parseExplicitBooleanSetting(
		getValue( 'enable_abilities_api' )
	);
	const abilitiesEnabled =
		null !== explicitAbilitiesSetting ?
		explicitAbilitiesSetting :
		( chatStatus.abilities_enabled ?? false );

	const scrollToBottom = ( behavior: ScrollBehavior = 'smooth' ) => {
		if ( messagesContainerRef.current ) {
			messagesContainerRef.current.scrollTo({
				top: messagesContainerRef.current.scrollHeight,
				behavior
			});
			return;
		}

		scrollRef.current?.scrollIntoView({ behavior });
	};

	useEffect( () => {
		const stored = getLocalStorage( STORAGE_KEY, []);
		if ( Array.isArray( stored ) && 0 < stored.length ) {
			const sanitizedSessions = applySessionStorageLimits(
				stored as ChatSession[]
			);

			if ( 0 < sanitizedSessions.length ) {
				setSessions( sanitizedSessions );
				setActiveSessionId( asString( sanitizedSessions[0].id ) );
			} else {
				const firstSession = createSession();
				setSessions([ firstSession ]);
				setActiveSessionId( firstSession.id );
			}
		} else {
			const firstSession = createSession();
			setSessions([ firstSession ]);
			setActiveSessionId( firstSession.id );
		}
	}, []);

	useEffect( () => {
		if ( ! sessions.length ) {
			return;
		}
		setLocalStorage( STORAGE_KEY, applySessionStorageLimits( sessions ) );
	}, [ sessions ]);

	// Mark chat-status as potentially stale when the modal opens. React Query
	// will only actually refetch when the staleTime (60s) has elapsed, so
	// rapidly opening and closing the modal does not generate extra requests.
	useEffect( () => {
		if ( isOpen ) {
			void queryClient.invalidateQueries({ queryKey: [ 'chat-status' ] });
		}
	}, [ isOpen, queryClient ]);

	useEffect( () => {
		if ( ! sessions.length ) {
			return;
		}

		const hasActiveSession = sessions.some(
			( session ) => session.id === activeSessionId
		);
		if ( ! hasActiveSession ) {
			setActiveSessionId( sessions[0].id );
		}
	}, [ sessions, activeSessionId ]);

	const activeSession = useMemo( () => {
		return sessions.find( ( session ) => session.id === activeSessionId ) || null;
	}, [ sessions, activeSessionId ]);

	const timeline = useMemo( () => {
		return buildTimeline( activeSession?.history || []);
	}, [ activeSession ]);

	const sessionPendingDelete = useMemo( () => {
		if ( ! deleteSessionId ) {
			return null;
		}

		return sessions.find( ( session ) => session.id === deleteSessionId ) || null;
	}, [ sessions, deleteSessionId ]);

	const visibleTimeline = timeline;

	useEffect( () => {
		if ( ! isOpen ) {
			return;
		}

		scrollToBottom( 'smooth' );
	}, [ visibleTimeline, isSending, pendingMessage, isOpen ]);

	useEffect( () => {
		if ( ! isOpen ) {
			return;
		}

		const frameId = window.requestAnimationFrame( () => {
			scrollToBottom( 'auto' );
		});

		return () => {
			window.cancelAnimationFrame( frameId );
		};
	}, [ isOpen, activeSessionId ]);

	useEffect( () => {
		if ( ! isSending ) {
			setLoadingStep( 0 );
			return;
		}

		const intervalId = window.setInterval( () => {
			setLoadingStep( ( prev ) => Math.min( prev + 1, LOADING_STEPS.length - 1 ) );
		}, 1400 );

		return () => {
			window.clearInterval( intervalId );
		};
	}, [ isSending ]);

	const disabledReason = useMemo( () => {
		if ( ! abilitiesEnabled ) {
			return __(
				'Chat is disabled because Abilities API is switched off in Burst settings.',
				'burst-statistics'
			);
		}

		if ( false === chatStatus.ai_client_loaded ) {
			return __(
				'To enable AI chat, please install and configure the WordPress AI plugin.',
				'burst-statistics'
			);
		}

		if ( false === chatStatus.has_configured_provider ) {
			return __(
				'No AI connector is configured. Install the WordPress AI plugin and connect a provider to use chat.',
				'burst-statistics'
			);
		}

		const missingApprovals = chatStatus.missing_approvals ?? [];
		if ( 0 < missingApprovals.length ) {
			return sprintf(

				/* translators: %s is a comma-separated list of approval names (e.g. "Burst, WordPress AI, OpenAI Provider"). */
				__(
					'To enable AI chat, please go to Tools > Connector Approvals and approve the following: %s.',
					'burst-statistics'
				),
				missingApprovals.join( ', ' )
			);
		}

		if ( false === chatStatus.enabled ) {
			return __( 'Chat is currently unavailable.', 'burst-statistics' );
		}

		return '';
	}, [ abilitiesEnabled, chatStatus ]);

	const isDisabled = Boolean( disabledReason );

	if ( ! abilitiesEnabled ) {
		return null;
	}

	const ensureActiveSession = (): ChatSession => {
		if ( activeSession ) {
			return activeSession;
		}

		const fallback = createSession();
		setSessions([ fallback ]);
		setActiveSessionId( fallback.id );
		return fallback;
	};

	const createNewChat = () => {
		const reusableSession = sessions.find( isSessionBlank );

		if ( reusableSession ) {
			setActiveSessionId( reusableSession.id );
			setRequestError( '' );
			setPrompt( '' );
			return;
		}

		const session = createSession();
		setSessions( ( prev ) => applySessionStorageLimits([ session, ...prev ]) );
		setActiveSessionId( session.id );
		setRequestError( '' );
		setPrompt( '' );
	};

	const deleteChat = ( sessionId: string ) => {
		setSessions( ( prev ) => {
			const next = prev.filter( ( item ) => item.id !== sessionId );

			if ( ! next.length ) {
				const fallback = createSession();
				setActiveSessionId( fallback.id );
				return [ fallback ];
			}

			if ( activeSessionId === sessionId ) {
				setActiveSessionId( next[0].id );
			}

			return applySessionStorageLimits( next );
		});
	};

	const openDeleteChatConfirm = ( sessionId: string ) => {
		setDeleteSessionId( sessionId );
	};

	const closeDeleteChatConfirm = () => {
		setDeleteSessionId( null );
	};

	const confirmDeleteChat = () => {
		if ( ! deleteSessionId ) {
			return;
		}

		deleteChat( deleteSessionId );
		closeDeleteChatConfirm();
	};

	const sendMessage = async() => {
		if ( isSending || isDisabled ) {
			return;
		}

		const userMessage = prompt.trim();
		if ( ! userMessage ) {
			return;
		}

		const session = ensureActiveSession();
		const baseHistory = sanitizeHistoryForStorage( session.history );
		setRequestError( '' );
		setPendingMessage( userMessage );
		setPrompt( '' );
		setIsSending( true );

		try {
			const response = await postChatMessage( userMessage, baseHistory );
			const nextHistory = Array.isArray( response?.history ) ?
				sanitizeHistoryForStorage(
						response.history as Array<Record<string, unknown>>
					) :
				session.history;
			const title =
				DEFAULT_TITLE === session.title ?
					shortText( userMessage ) :
					session.title;
			const updatedAt = Date.now();

			setSessions( ( prev ) => {
				const next = prev.map( ( item ) => {
					if ( item.id !== session.id ) {
						return item;
					}

					return {
						...item,
						title,
						history: nextHistory as Array<Record<string, unknown>>,
						updatedAt
					};
				});

				return applySessionStorageLimits( next );
			});
		} catch ( error ) {
			const message =
				error instanceof Error && error.message ?
					error.message :
					__(
							'Could not send the message. Please try again.',
							'burst-statistics'
						);
			setRequestError( message );
			setPrompt( userMessage );
		} finally {
			setPendingMessage( '' );
			setIsSending( false );
		}
	};

	const modalContent = (
		<div className="flex h-[68vh] min-h-[520px] gap-4 overflow-hidden @max-md:h-auto @max-md:min-h-0 @max-md:max-h-none @max-md:flex-col">
			<div className="flex w-72 shrink-0 flex-col rounded-lg border border-gray-300 bg-white p-3 @max-md:w-full @max-md:max-h-44">
				<div className="mb-3 flex items-center justify-between gap-2">
					<h3 className="text-sm font-semibold text-text-black">
						{__( 'Chats', 'burst-statistics' )}
					</h3>
					<button
						type="button"
						onClick={createNewChat}
						className="inline-flex items-center gap-1 rounded-md border border-gray-300 px-2 py-1 text-xs font-medium text-text-gray hover:bg-gray-100"
					>
						<Icon name="plus" size={14} color="gray" />
						{__( 'New', 'burst-statistics' )}
					</button>
				</div>

				<div className="min-h-0 flex-1 space-y-1 overflow-y-auto pr-1">
					{sessions.map( ( session ) => (
						<div
							key={session.id}
							className={clsx(
								'flex items-start gap-1 rounded-md border px-1 py-1',
								session.id === activeSessionId ?
									'border-primary/20 bg-primary/10' :
									'border-transparent hover:bg-gray-100'
							)}
						>
							<button
								type="button"
								onClick={() => {
									setActiveSessionId( session.id );
									setRequestError( '' );
								}}
								className="min-w-0 flex-1 rounded px-2 py-1.5 text-left"
							>
								<div className="truncate text-sm font-medium text-text-black">
									{session.title}
								</div>
								<div className="mt-1 truncate text-xs text-gray-500">
									{formatDateAndTime( session.updatedAt )}
								</div>
							</button>

							<Tooltip content={__( 'Delete chat', 'burst-statistics' )}>
								<button
									type="button"
									onClick={() => openDeleteChatConfirm( session.id )}
									className="mt-1 rounded p-1.5 text-gray-500 hover:bg-red-50 hover:text-red-600"
								>
									<Icon name="trash" size={14} color="gray" />
								</button>
							</Tooltip>
						</div>
					) )}
				</div>
			</div>

			<div className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-gray-300 bg-white">
				<div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
					<div className="flex items-center gap-2 text-sm font-semibold text-text-black">
						<Icon name="chat" size={16} color="gray" />
						{activeSession?.title || DEFAULT_TITLE}
					</div>
				</div>

				<div
					ref={messagesContainerRef}
					className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-4"
				>
					{visibleTimeline.map( ( item ) => {
						if ( 'message' === item.type ) {
							const isUser = 'user' === item.role;
							const markdownTextClass = isUser ?
								'!text-text-white' :
								'text-inherit';
							return (
								<div
									key={item.id}
									className={clsx(
										'flex',
										isUser ? 'justify-end' : 'justify-start'
									)}
								>
									<div
										className={clsx(
											'max-w-[85%] rounded-xl px-3.5 py-2.5 text-sm leading-6 break-words',
											isUser ?
												'bg-primary !text-text-white [&_*]:!text-text-white' :
												'bg-white text-text-black border border-gray-300 shadow-sm'
										)}
									>
										<ReactMarkdown
											remarkPlugins={[ remarkGfm ]}
											components={{
												p: ({ children }) => (
													<p
														className={clsx(
															'mt-0 mb-2 last:mb-0 text-inherit',
															markdownTextClass
														)}
													>
														{children}
													</p>
												),
												h1: ({ children }) => (
													<h1
														className={clsx(
															'mt-4 mb-2 text-[1.125rem] font-bold text-inherit',
															markdownTextClass
														)}
													>
														{children}
													</h1>
												),
												h2: ({ children }) => (
													<h2
														className={clsx(
															'mt-4 mb-2 text-[1rem] font-semibold text-inherit',
															markdownTextClass
														)}
													>
														{children}
													</h2>
												),
												h3: ({ children }) => (
													<h3
														className={clsx(
															'mt-3 mb-1 text-[0.9375rem] leading-snug font-semibold text-inherit',
															markdownTextClass
														)}
													>
														{children}
													</h3>
												),
												h4: ({ children }) => (
													<h4
														className={clsx(
															'mt-3 mb-1 text-[0.875rem] font-semibold text-inherit',
															markdownTextClass
														)}
													>
														{children}
													</h4>
												),
												ul: ({ children }) => (
													<ul
														className={clsx(
															'my-2 list-disc pl-5 text-inherit',
															markdownTextClass
														)}
													>
														{children}
													</ul>
												),
												ol: ({ children }) => (
													<ol
														className={clsx(
															'my-2 list-decimal pl-5 text-inherit',
															markdownTextClass
														)}
													>
														{children}
													</ol>
												),
												li: ({ children }) => (
													<li
														className={clsx(
															'my-0.5 text-inherit',
															markdownTextClass
														)}
													>
														{children}
													</li>
												),
												strong: ({ children }) => (
													<strong
														className={clsx(
															'font-semibold text-inherit',
															markdownTextClass
														)}
													>
														{children}
													</strong>
												),
												blockquote: ({ children }) => (
													<blockquote
														className={clsx(
															'my-2 border-l-2 border-gray-300 pl-3 italic text-inherit',
															markdownTextClass
														)}
													>
														{children}
													</blockquote>
												),
												pre: ({ children }) => (
													<pre className="my-2 overflow-x-auto rounded-md bg-gray-900/95 p-3 text-xs text-white">
														{children}
													</pre>
												),
												code: ({ className, children }) => {
													const isBlockCode =
														'string' === typeof className &&
														0 < className.length;

													if ( ! isBlockCode ) {
														return (
															<code className="rounded bg-gray-200/70 px-1 py-0.5 font-mono text-[0.8125rem] text-text-black">
																{children}
															</code>
														);
													}

													return (
														<code
															className={
																className ||
																'font-mono text-[0.8125rem] text-white'
															}
														>
															{children}
														</code>
													);
												},
												a: ({ href, children }) => (
													<a
														href={href}
														target="_blank"
														rel="noopener noreferrer"
														className={clsx(
															'underline decoration-current underline-offset-2 hover:opacity-80',
															markdownTextClass
														)}
													>
														{children}
													</a>
												),
												table: ({ children }) => (
													<div className="my-2 overflow-x-auto">
														<table className="w-full min-w-[22rem] border-collapse text-left text-xs text-inherit">
															{children}
														</table>
													</div>
												),
												thead: ({ children }) => (
													<thead className="border-b border-gray-300/80">
														{children}
													</thead>
												),
												tbody: ({ children }) => <tbody>{children}</tbody>,
												tr: ({ children }) => (
													<tr className="border-b border-gray-200/70 last:border-b-0">
														{children}
													</tr>
												),
												th: ({ children }) => (
													<th className="px-2 py-1.5 font-semibold text-inherit">
														{children}
													</th>
												),
												td: ({ children }) => (
													<td className="px-2 py-1.5 align-top text-inherit">
														{children}
													</td>
												)
											}}
										>
											{item.text || ''}
										</ReactMarkdown>
									</div>
								</div>
							);
						}

						return null;
					})}

					{pendingMessage && (
						<div className="flex justify-end">
							<div className="max-w-[85%] rounded-xl bg-primary px-3 py-2 text-sm text-text-white whitespace-pre-wrap">
								{pendingMessage}
							</div>
						</div>
					)}

					{isSending && (
						<div className="flex justify-start">
							<div className="w-full max-w-[85%] rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900">
								{LOADING_STEPS.map( ( step, index ) => {
									const isCompleted = index < loadingStep;
									const isActive = index === loadingStep;

									return (
										<div
											key={`loading-step-${index}`}
											className={clsx(
												'mb-1 flex items-center gap-2 text-xs last:mb-0',
												isCompleted || isActive ?
													'text-blue-900' :
													'text-blue-600/70'
											)}
										>
											<Icon
												name={isCompleted ? 'check' : 'loading'}
												size={12}
												color="blue"
												className={
													! isActive && ! isCompleted ? 'opacity-60' : ''
												}
											/>
											<span>{step}</span>
										</div>
									);
								})}
							</div>
						</div>
					)}

					{! timeline.length && ! isSending && ! pendingMessage && (
						<div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-5 text-sm text-text-gray">
							{__(
								'Ask anything about your analytics. The assistant can run Burst abilities automatically when needed.',
								'burst-statistics'
							)}
						</div>
					)}

					{requestError && (
						<div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
							{requestError}
						</div>
					)}

					<div ref={scrollRef} />
				</div>

				<form
					onSubmit={( event ) => {
						event.preventDefault();
						void sendMessage();
					}}
					className="border-t border-gray-200 p-3"
				>
					<div className="flex items-end gap-2">
						<textarea
							value={prompt}
							onChange={( event ) => setPrompt( event.target.value )}
							rows={2}
							placeholder={__( 'Type your message...', 'burst-statistics' )}
							className="min-h-[48px] flex-1 resize-y rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm focus:outline-hidden focus:ring-2 focus:ring-primary/30"
						/>
						<button
							type="submit"
							disabled={isSending || ! prompt.trim() || isDisabled}
							className="inline-flex h-[48px] min-w-24 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold !text-text-white [&_*]:!text-text-white shadow-sm transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-gray-300"
						>
							{__( 'Send', 'burst-statistics' )}
							{isSending ? (
								<Icon
									name="loading"
									size={14}
									color="text-white"
									className="!text-text-white"
								/>
							) : (
								<Icon
									name="move-right"
									size={14}
									color="text-white"
									className="!text-text-white"
								/>
							)}
						</button>
					</div>
				</form>
			</div>
		</div>
	);

	const deleteConfirmContent = (
		<div className="space-y-3">
			<p className="mb-3 text-sm text-text-black">
				{__(
					'Are you sure you want to delete this chat? This action cannot be undone.',
					'burst-statistics'
				)}
			</p>
			{sessionPendingDelete && (
				<div className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-text-gray">
					<strong className="text-text-black">
						{__( 'Chat', 'burst-statistics' )}:
					</strong>{' '}
					{sessionPendingDelete.title}
				</div>
			)}
		</div>
	);

	const deleteConfirmFooter = (
		<>
			<Close asChild aria-label="Close">
				<ButtonInput btnVariant="tertiary" onClick={closeDeleteChatConfirm}>
					{__( 'Cancel', 'burst-statistics' )}
				</ButtonInput>
			</Close>
			<ButtonInput btnVariant="danger" onClick={confirmDeleteChat}>
				{__( 'Delete chat', 'burst-statistics' )}
			</ButtonInput>
		</>
	);

	return (
		<>
			<Tooltip content={isDisabled ? disabledReason : ''}>
				<button
					type="button"
					onClick={() => {
						if ( ! isDisabled ) {
							setIsOpen( true );
						}
					}}
					disabled={isDisabled}
					className="inline-flex items-center gap-2 rounded-md border border-gray-300 px-3 py-2 text-sm text-text-gray transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60"
				>
					<Icon name="chat" size={16} color="gray" />
					<span className="max-xxs:hidden">
						{__( 'Chat', 'burst-statistics' )}
					</span>
				</button>
			</Tooltip>

			<Modal
				isOpen={isOpen}
				onClose={() => setIsOpen( false )}
				title={__( 'Burst AI chat', 'burst-statistics' )}
				subtitle={__(
					'Ask questions and revisit past chats.',
					'burst-statistics'
				)}
				content={modalContent}
			/>

			<Modal
				isOpen={Boolean( deleteSessionId )}
				onClose={closeDeleteChatConfirm}
				title={__( 'Delete chat', 'burst-statistics' )}
				content={deleteConfirmContent}
				footer={deleteConfirmFooter}
			/>
		</>
	);
};

export default ChatAssistantModal;
