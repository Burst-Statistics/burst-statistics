import { lazy, Suspense, useEffect, useState } from 'react';
import { __ } from '@wordpress/i18n';
import Tooltip from '@/components/Common/Tooltip';
import Icon from '@/utils/Icon';
import { useChatAvailability } from '@/hooks/useChatAvailability';
import { useTourStore } from '@/store/useTourStore';

// Loaded on first open only: the modal pulls in react-markdown and its
// remark/micromark stack, which would otherwise sit in the core bundle.
const ChatAssistantModal = lazy( () => import( './ChatAssistantModal' ) );

// fallow-ignore-next-line complexity
const ChatAssistantButton = () => {
	const { abilitiesEnabled, disabledReason, isDisabled } = useChatAvailability();
	const tourActive = useTourStore( ( s ) => s.tourActive );
	const [ isOpen, setIsOpen ] = useState( false );
	const [ hasOpened, setHasOpened ] = useState( false );

	// During the tour the chat runs on mock data, so it is always available and
	// clickable, and the button must render even when Abilities are off so the
	// tour can anchor to it.
	const buttonDisabled = tourActive ? false : isDisabled;

	// Mount the (lazy) modal ahead of the tour reaching the chat step, so the
	// anchors inside it exist when the tour opens the chat.
	useEffect( () => {
		if ( tourActive ) {
			setHasOpened( true );
		}
	}, [ tourActive ]);

	if ( ! abilitiesEnabled && ! tourActive ) {
		return null;
	}

	const openChat = () => {
		if ( buttonDisabled ) {
			return;
		}
		setHasOpened( true );
		setIsOpen( true );
	};

	return (
		<>
			<Tooltip content={buttonDisabled ? disabledReason : ''}>
				<button
					data-tour="chat-assistant"
					type="button"
					onClick={openChat}
					disabled={buttonDisabled}
					className="inline-flex items-center gap-2 rounded-md border border-gray-300 px-3 py-2 text-sm text-text-gray transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60"
				>
					<Icon name="chat" size={16} color="gray" />
					<span className="max-xxs:hidden">
						{__( 'Chat', 'burst-statistics' )}
					</span>
				</button>
			</Tooltip>

			{hasOpened && (
				<Suspense fallback={null}>
					<ChatAssistantModal isOpen={isOpen} onClose={() => setIsOpen( false )} />
				</Suspense>
			)}
		</>
	);
};

export default ChatAssistantButton;
