import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { __, sprintf } from '@wordpress/i18n';
import clsx from 'clsx';
import { Close } from '@radix-ui/react-dialog';
import * as Select from '@radix-ui/react-select';
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
	getAvailableModels,
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

type AiModel = {
	id: string;
	label: string;
	provider: string;
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
const MODEL_STORAGE_KEY = 'chat_selected_model';
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
	const [ isSidebarOpen, setIsSidebarOpen ] = useState( true );
	const [ editingTitleId, setEditingTitleId ] = useState<string | null>( null );
	const [ editingTitleValue, setEditingTitleValue ] = useState( '' );

	const queryClient = useQueryClient();

	// Fetch available AI models (once per session).
	const { data: modelsData } = useQuery<{ models: AiModel[]; default?: AiModel | null }>({
		queryKey: [ 'chat-models' ],
		queryFn: async() => {
			const result = await getAvailableModels() as { models?: AiModel[]; default?: AiModel | null };
			return {
				models: Array.isArray( result?.models ) ? result.models : [],
				default: result?.default ?? null
			};
		},
		staleTime: 5 * 60_000,
		refetchOnWindowFocus: false
	});

	const availableModels = useMemo( () => modelsData?.models ?? [], [ modelsData?.models ]);
	const defaultModel: AiModel | null = modelsData?.default ?? null;
	const defaultModelLabel = defaultModel ? defaultModel.label : '';

	const groupedModels = useMemo( () => {
		return availableModels.reduce<Record<string, AiModel[]>>( ( acc, m ) => {
			acc[ m.provider ] = acc[ m.provider ] || [];
			acc[ m.provider ].push( m );
			return acc;
		}, {});
	}, [ availableModels ]);

	const [ selectedModel, setSelectedModel ] = useState<string>(
		() => asString( getLocalStorage( MODEL_STORAGE_KEY, '' ) )
	);

	const suggestions = useMemo( () => [
		{
			text: __( 'How many pageviews did we get today?', 'burst-statistics' ),
			icon: 'pageviews'
		},
		{
			text: __( 'What are the top traffic sources?', 'burst-statistics' ),
			icon: 'referrers'
		},
		{
			text: __( 'Are there any active visitors on my site right now?', 'burst-statistics' ),
			icon: 'visitors'
		},
		{
			text: __( 'Which pages are the most popular this month?', 'burst-statistics' ),
			icon: 'file'
		}
	], []);

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
	const textareaRef = useRef<HTMLTextAreaElement | null>( null );
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

	const renameSession = ( sessionId: string, newTitle: string ) => {
		const trimmed = newTitle.trim();
		if ( ! trimmed ) {
			return;
		}
		setSessions( ( prev ) =>
			prev.map( ( s ) => ( s.id === sessionId ? { ...s, title: trimmed } : s ) )
		);
	};


	const sendMessageDirect = async( messageText: string ) => {
		if ( isSending || isDisabled ) {
			return;
		}

		const userMessage = messageText.trim();
		if ( ! userMessage ) {
			return;
		}

		const session = ensureActiveSession();
		const baseHistory = sanitizeHistoryForStorage( session.history );
		setRequestError( '' );
		setPendingMessage( userMessage );
		setPrompt( '' );
		if ( textareaRef.current ) {
			textareaRef.current.style.height = 'auto';
		}
		setIsSending( true );

		try {
			const response = await postChatMessage( userMessage, baseHistory, selectedModel );
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
			if ( userMessage === prompt.trim() ) {
				setPrompt( userMessage );
			}
		} finally {
			setPendingMessage( '' );
			setIsSending( false );
		}
	};

	const sendMessage = async() => {
		await sendMessageDirect( prompt );
	};

	const modalContent = (
		<div className="flex h-[68vh] min-h-[520px] overflow-hidden rounded-lg bg-white @max-md:h-auto @max-md:min-h-0 @max-md:max-h-none @max-md:flex-col">
			{/* Collapsible sidebar */}
			<div
				className={clsx(
					'flex shrink-0 flex-col border-r border-gray-200 bg-white transition-all duration-200 ease-in-out',
					isSidebarOpen ? 'w-48' : 'w-11',
					'@max-md:w-full @max-md:border-r-0 @max-md:border-b',
					isSidebarOpen ? '@max-md:max-h-44' : '@max-md:max-h-11'
				)}
			>
				<div
					className={clsx(
						'h-[48px] flex shrink-0 items-center border-b border-gray-200 px-1.5',
						isSidebarOpen ? 'justify-between' : 'justify-center'
					)}
				>
					{isSidebarOpen && (
						<button
							type="button"
							onClick={createNewChat}
							className="flex flex-1 items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium text-text-gray transition-all duration-150 ease-in-out hover:bg-gray-100 hover:text-text-black hover:shadow-sm"
						>
							<Icon name="plus" size={13} color="gray" />
							{__( 'New chat', 'burst-statistics' )}
						</button>
					)}
					<button
						type="button"
						onClick={() => setIsSidebarOpen( ( v ) => ! v )}
						className="rounded-md p-1.5 text-text-gray transition-all duration-150 ease-in-out hover:bg-gray-100 hover:text-text-black hover:shadow-sm"
						title={
							isSidebarOpen ?
								__( 'Collapse sidebar', 'burst-statistics' ) :
								__( 'Expand sidebar', 'burst-statistics' )
						}
					>
						<Icon
							name={isSidebarOpen ? 'chevron-left' : 'chevron-right'}
							size={14}
							color="gray"
						/>
					</button>
				</div>

				{isSidebarOpen && (
					<div className="min-h-0 flex-1 space-y-px overflow-y-auto px-1.5 py-1.5">
						{sessions.map( ( session ) => (
							<div
								key={session.id}
								className={clsx(
									'group flex items-center gap-0.5 rounded-lg px-1.5 py-1.5 transition-colors duration-150 ease-in-out',
									session.id === activeSessionId ?
										'bg-gray-100 ring-1 ring-gray-200' :
										'hover:bg-gray-100'
								)}
							>
								<button
									type="button"
									onClick={() => {
										setActiveSessionId( session.id );
										setRequestError( '' );
									}}
									className="min-w-0 flex-1 text-left"
								>
									<div className="truncate text-sm font-medium leading-snug text-text-black">
										{session.title}
									</div>
									<div className="mt-0.5 truncate text-xs text-gray-500">
										{formatDateAndTime( session.updatedAt )}
									</div>
								</button>

								<button
									type="button"
									onClick={() => openDeleteChatConfirm( session.id )}
									className="shrink-0 rounded p-1 text-gray-400 opacity-0 transition-all duration-150 ease-in-out hover:bg-red-50 hover:text-red-500 group-hover:opacity-100"
								>
									<Icon name="trash" size={12} color="gray" />
								</button>
							</div>
						) )}
					</div>
				)}

				{! isSidebarOpen && (
					<div className="flex h-[48px] items-center justify-center">
						<Tooltip content={__( 'New chat', 'burst-statistics' )}>
							<button
								type="button"
								onClick={createNewChat}
								className="rounded-md p-1.5 text-text-gray transition-all duration-150 ease-in-out hover:bg-gray-100 hover:text-text-black hover:shadow-sm"
							>
								<Icon name="plus" size={14} color="gray" />
							</button>
						</Tooltip>
					</div>
				)}
			</div>

			{/* Main chat area */}
			<div className="flex min-w-0 flex-1 flex-col overflow-hidden bg-white">
				{/* Header with editable title */}
				<div className="flex h-[48px] shrink-0 items-center border-b border-gray-200 px-3.5">
					{editingTitleId === activeSession?.id ? (
						<input
							type="text"
							value={editingTitleValue}
							autoFocus
							onChange={( e ) => setEditingTitleValue( e.target.value )}
							onBlur={() => {
								if ( activeSession ) {
									renameSession( activeSession.id, editingTitleValue );
								}
								setEditingTitleId( null );
							}}
							onKeyDown={( e ) => {
								if ( 'Enter' === e.key ) {
									if ( activeSession ) {
										renameSession( activeSession.id, editingTitleValue );
									}
									setEditingTitleId( null );
								} else if ( 'Escape' === e.key ) {
									setEditingTitleId( null );
								}
							}}
							className="min-w-0 flex-1 rounded-md border border-primary/30 bg-white px-2.5 py-1 text-sm font-semibold text-text-black focus:outline-none focus:ring-2 focus:ring-primary/20"
						/>
					) : (
						<button
							type="button"
							onClick={() => {
								if ( activeSession ) {
									setEditingTitleId( activeSession.id );
									setEditingTitleValue( activeSession.title );
								}
							}}
							className="group flex min-w-0 items-center gap-1.5 rounded-md px-1.5 py-1 text-left transition-all duration-150 ease-in-out hover:bg-gray-100"
						>
							<span className="truncate text-sm font-semibold text-gray-700">
								{activeSession?.title || DEFAULT_TITLE}
							</span>
							<Icon
								name="pencil"
								size={11}
								color="gray"
								className="shrink-0 opacity-0 transition-opacity duration-150 group-hover:opacity-100"
							/>
						</button>
					)}
				</div>

				<div
					ref={messagesContainerRef}
					className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-3.5 py-4"
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
						<div className="flex flex-col py-2">
							<div className="rounded-xl border border-dashed border-gray-300 bg-gray-50/50 p-5 text-center">
								<h3 className="text-sm font-semibold text-text-black mb-1">
									{__( 'Welcome to Burst AI Assistant!', 'burst-statistics' )}
								</h3>
								<p className="text-xs text-text-gray max-w-md mx-auto">
									{__(
										'Ask anything about your analytics. The assistant can run Burst abilities automatically when needed.',
										'burst-statistics'
									)}
								</p>
							</div>

							<div className="grid grid-cols-2 gap-3 mt-4 @max-sm:grid-cols-1">
								{suggestions.map( ( suggestion, index ) => (
									<button
										key={index}
										type="button"
										onClick={() => void sendMessageDirect( suggestion.text )}
										className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white p-3 text-left text-xs font-semibold text-text-black shadow-sm transition-all duration-150 ease-in-out hover:border-primary/45 hover:bg-gray-50 hover:shadow-md cursor-pointer group"
									>
										<div className="flex items-center gap-3">
											<div className="rounded-lg bg-gray-50 p-1.5 text-text-gray transition-colors group-hover:bg-primary/5 group-hover:text-primary">
												<Icon name={suggestion.icon} size={15} />
											</div>
											<span className="leading-tight">{suggestion.text}</span>
										</div>
										<div className="text-gray-300 transition-colors group-hover:text-primary flex-shrink-0">
											<Icon name="chevron-right" size={13} />
										</div>
									</button>
								) )}
							</div>
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
					className="shrink-0 border-t border-gray-200 p-3.5"
				>
					<div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition-[border-color,box-shadow] duration-150 focus-within:border-primary/40 focus-within:shadow-[0_0_0_3px_color-mix(in_srgb,var(--color-primary,#6c47ff)_10%,transparent)]">
						<textarea
							ref={textareaRef}
							value={prompt}
							onChange={( event ) => {
								setPrompt( event.target.value );
								const el = event.target;
								el.style.height = 'auto';
								el.style.height = `${el.scrollHeight}px`;
							}}
							onKeyDown={( event ) => {
								if ( 'Enter' === event.key && ! event.shiftKey ) {
									event.preventDefault();
									void sendMessage();
								}
							}}
							rows={1}
							placeholder={__(
								'Ask about your analytics...',
								'burst-statistics'
							)}
							style={{ minHeight: '48px', maxHeight: '160px' }}
							className="w-full resize-none overflow-y-auto bg-transparent px-3.5 pt-3 pb-2 text-sm text-text-black placeholder-gray-400 focus:outline-none"
						/>
						<div className="flex items-center gap-3 border-t border-gray-100 bg-gray-50 px-3 py-2.5">
							<div className="flex min-w-0 items-center gap-2">
								{2 <= availableModels.length && (
									<div className="relative flex-shrink-0">
										<Select.Root
											value={selectedModel || '__default__'}
											onValueChange={( val ) => {
												const finalVal = '__default__' === val ? '' : val;
												setSelectedModel( finalVal );
												setLocalStorage( MODEL_STORAGE_KEY, finalVal );
											}}
										>
											<Select.Trigger
												id="burst-chat-model-select"
												className="inline-flex h-9 w-[190px] items-center justify-between gap-1.5 rounded-full border border-gray-200 bg-white px-3.5 text-xs font-semibold text-gray-600 shadow-sm transition-all duration-150 ease-in-out hover:border-gray-300 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
											>
												<span className="truncate pr-1">
													<Select.Value>
														{selectedModel ? (
															availableModels.find( ( m ) => m.id === selectedModel )?.label || selectedModel
														) : (
															defaultModelLabel ? `${__( 'Default model', 'burst-statistics' )} (${defaultModelLabel})` : __( 'Default model', 'burst-statistics' )
														)}
													</Select.Value>
												</span>
												<Select.Icon className="flex-shrink-0">
													<Icon
														name="chevron-down"
														size={11}
														color="gray"
														className="text-gray-400"
													/>
												</Select.Icon>
											</Select.Trigger>

											<Select.Portal container={document.getElementById( 'modal-root' )}>
												<Select.Content
													className="bg-white text-text-black border border-gray-200 rounded-lg shadow-lg z-99999 max-h-[300px] overflow-y-auto min-w-[200px]"
													position="popper"
													sideOffset={5}
												>
													<Select.Viewport className="p-1">
														<Select.Item
															value="__default__"
															className="relative flex items-center h-8 px-8 text-xs font-semibold text-gray-700 select-none rounded hover:bg-gray-100 focus:bg-gray-100 outline-none cursor-pointer"
														>
															<span className="absolute left-2 flex items-center justify-center">
																<Select.ItemIndicator>
																	<Icon name="check" size={13} color="primary" />
																</Select.ItemIndicator>
															</span>
															<Select.ItemText>
																{defaultModelLabel ? `${__( 'Default model', 'burst-statistics' )} (${defaultModelLabel})` : __( 'Default model', 'burst-statistics' )}
															</Select.ItemText>
														</Select.Item>

														<Select.Separator className="h-px bg-gray-100 my-1" />

														{Object.entries( groupedModels ).map( ([ provider, models ]) => (
															<Select.Group key={provider}>
																<Select.Label className="px-3 py-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-wider select-none">
																	{provider}
																</Select.Label>
																{models.map( ( m ) => (
																	<Select.Item
																		key={m.id}
																		value={m.id}
																		className="relative flex items-center h-8 px-8 text-xs font-semibold text-gray-700 select-none rounded hover:bg-gray-100 focus:bg-gray-100 outline-none cursor-pointer"
																	>
																		<span className="absolute left-2 flex items-center justify-center">
																			<Select.ItemIndicator>
																				<Icon name="check" size={13} color="primary" />
																			</Select.ItemIndicator>
																		</span>
																		<Select.ItemText>{m.label}</Select.ItemText>
																	</Select.Item>
																) )}
															</Select.Group>
														) )}
													</Select.Viewport>
												</Select.Content>
											</Select.Portal>
										</Select.Root>
									</div>
								)}
							</div>
							<button
								type="submit"
								disabled={isSending || ! prompt.trim() || isDisabled}
								className="ml-auto inline-flex h-9 w-11 flex-shrink-0 items-center justify-center rounded-full bg-primary px-3.5 text-xs font-medium !text-text-white [&_*]:!text-text-white shadow-sm transition-all duration-150 ease-in-out hover:bg-primary/90 hover:shadow disabled:cursor-not-allowed disabled:opacity-40"
							>
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
