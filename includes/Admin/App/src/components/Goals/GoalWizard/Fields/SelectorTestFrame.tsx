import type useSelectorMatches from '@/hooks/useSelectorMatches';
import { buildPreviewUrl } from '@/utils/buildPreviewUrl';

interface SelectorTestFrameProps {

	// Match state the frame feeds; useSelectorMatches reads the loaded page through iframeRef.
	matches: ReturnType<typeof useSelectorMatches>;

	// Page path to load, e.g. '/sample-page/'.
	page: string;

	// Load the page as a logged out visitor instead of as the current user.
	loggedOut: boolean;
	title: string;
}

/**
 * A hidden copy of a page in preview mode, which a selector is counted against.
 *
 * @param {SelectorTestFrameProps} props           Component props.
 * @param {Object}                 props.matches   Match state of the selector.
 * @param {string}                 props.page      The page path to load.
 * @param {boolean}                props.loggedOut Whether to load the page as a visitor.
 * @param {string}                 props.title     Frame title for assistive technology.
 * @return {JSX.Element} The hidden frame.
 */
const SelectorTestFrame = ({ matches, page, loggedOut, title }: SelectorTestFrameProps ): JSX.Element => (
	<iframe
		ref={matches.iframeRef}
		sandbox="allow-scripts allow-same-origin"
		src={buildPreviewUrl( window.burst_settings.home_url + page, loggedOut )}
		onLoad={matches.retest}
		referrerPolicy="no-referrer"
		style={{ display: 'none' }}
		title={title}
	/>
);

export default SelectorTestFrame;
