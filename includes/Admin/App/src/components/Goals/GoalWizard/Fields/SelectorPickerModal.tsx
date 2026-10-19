import { useCallback, useEffect, useRef, useState } from 'react';
import { __, _n, sprintf } from '@wordpress/i18n';
import Modal from '@/components/Common/Modal';
import ButtonInput from '@/components/Inputs/ButtonInput';
import { LoadingSpinner } from '@/components/Common/LoadingSpinner';
import useIframeElementPicker from '@/hooks/useIframeElementPicker';
import { buildPreviewUrl } from '@/utils/buildPreviewUrl';
import { getBurstSetting } from '@/utils/formatting';
import GoalPageInput from './GoalPageInput';
import PickerViewToggle from './PickerViewToggle';

interface SelectorPickerModalProps {
	onClose: () => void;

	// Called with the picked element's selector, its visible text and the page it was picked on.
	onPick: ( selector: string, label: string, page: string ) => void;
	goalId: number;
	goalType: string;

	// Page the picker opens on, e.g. '/pricing/'.
	initialPage: string;
	loggedOut: boolean;
	onToggleLoggedOut: () => void;
}

/**
 * Pick an element on the live site and return its CSS selector and the page it lives on.
 *
 * The site is rendered in a same origin iframe in preview mode; the picker
 * listeners are injected into that document by useIframeElementPicker.
 *
 * @param {SelectorPickerModalProps} props Modal callbacks, the goal and the page and view to open.
 * @return {JSX.Element} The picker modal.
 */
const SelectorPickerModal = ({
	onClose,
	onPick,
	goalId,
	goalType,
	initialPage,
	loggedOut,
	onToggleLoggedOut
}: SelectorPickerModalProps ): JSX.Element => {
	const [ page, setPage ] = useState( initialPage || '/' );
	const [ isLoading, setIsLoading ] = useState( true );
	const iframeRef = useRef<HTMLIFrameElement | null>( null );

	const handlePick = useCallback(
		( selector: string, label: string ) => {
			onPick( selector, label, page );
			onClose();
		},
		[ onPick, onClose, page ]
	);

	const { attach, hoveredSelector, hoveredMatches } = useIframeElementPicker({
		onPick: handlePick,
		onEscape: onClose
	});

	const previewUrl = buildPreviewUrl(
		getBurstSetting<string>( 'home_url', '' ) + page,
		loggedOut
	);

	// A new page means a new document to wait for.
	useEffect( () => {
		setIsLoading( true );
	}, [ previewUrl ]);

	const content = (
		<div className="flex flex-col gap-4">
			<div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
				<div className="w-full sm:max-w-md">
					<GoalPageInput
						goalId={goalId}
						inputId={`goal-${goalId}-picker-page`}
						goalType={goalType}
						isDraft={false}
						page={page}
						label={__( 'Page', 'burst-statistics' )}
						onChange={( value ) => setPage( value || '/' )}
					/>
				</div>
				<PickerViewToggle loggedOut={loggedOut} onToggle={onToggleLoggedOut} />
			</div>

			<div className="relative h-[60vh] overflow-hidden rounded border border-gray-200 bg-white">
				<iframe
					key={previewUrl}
					ref={iframeRef}
					src={previewUrl}
					onLoad={() => {
						attach( iframeRef.current );
						setIsLoading( false );
					}}
					sandbox="allow-scripts allow-same-origin"
					referrerPolicy="no-referrer"
					title={__( 'Element picker', 'burst-statistics' )}
					className="h-full w-full border-none"
				/>
				{isLoading && (
					<div className="absolute inset-0 flex items-center justify-center gap-2 bg-gray-50 text-sm text-text-gray">
						<LoadingSpinner />
						{__( 'Loading your site…', 'burst-statistics' )}
					</div>
				)}
			</div>
		</div>
	);

	const footer = (
		<div className="flex w-full flex-row items-center justify-between gap-4">
			{hoveredSelector ? (
				<div className="flex min-w-0 flex-col text-left">
					<code
						className="truncate font-mono text-sm text-text-black"
						title={hoveredSelector}
					>
						{hoveredSelector}
					</code>
					<span className="text-xs text-text-gray-light">
						{sprintf(

							/* translators: 1: number of elements the selector matches, 2: page path, e.g. /pricing/. */
							_n(
								'Matches %1$d element on %2$s. Click to select.',
								'Matches %1$d elements on %2$s. Click to select.',
								hoveredMatches,
								'burst-statistics'
							),
							hoveredMatches,
							page
						)}
					</span>
				</div>
			) : (
				<span className="text-sm text-text-gray-light">
					{__( 'Hover an element to see what it selects.', 'burst-statistics' )}
				</span>
			)}
			<ButtonInput btnVariant="tertiary" onClick={onClose}>
				{__( 'Cancel', 'burst-statistics' )}
			</ButtonInput>
		</div>
	);

	return (
		<Modal
			isOpen={true}
			onClose={onClose}
			size="full"
			title={__( 'Pick an element to track', 'burst-statistics' )}
			subtitle={__( 'Choose the page where it lives, then click it. Nothing is tracked while you pick.', 'burst-statistics' )}
			content={content}
			footer={footer}
		/>
	);
};

export default SelectorPickerModal;
