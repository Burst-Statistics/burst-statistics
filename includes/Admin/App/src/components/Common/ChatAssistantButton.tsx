import { lazy, Suspense, useState } from 'react';
import { __ } from '@wordpress/i18n';
import Tooltip from '@/components/Common/Tooltip';
import Icon from '@/utils/Icon';
import { useChatAvailability } from '@/hooks/useChatAvailability';

// Loaded on first open only: the modal pulls in react-markdown and its
// remark/micromark stack, which would otherwise sit in the core bundle.
const ChatAssistantModal = lazy( () => import( './ChatAssistantModal' ) );

const ChatAssistantButton = () => {
	const { abilitiesEnabled, disabledReason, isDisabled } = useChatAvailability();
	const [ isOpen, setIsOpen ] = useState( false );
	const [ hasOpened, setHasOpened ] = useState( false );

	if ( ! abilitiesEnabled ) {
		return null;
	}

	const openChat = () => {
		if ( isDisabled ) {
			return;
		}
		setHasOpened( true );
		setIsOpen( true );
	};

	return (
		<>
			<Tooltip content={isDisabled ? disabledReason : ''}>
				<button
					type="button"
					onClick={openChat}
					disabled={isDisabled}
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
