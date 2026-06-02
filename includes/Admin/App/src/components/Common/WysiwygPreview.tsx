import ShadowContainer from '@/components/Common/ShadowContainer';

interface WysiwygPreviewProps {
	html: string;
	isDark?: boolean;
	className?: string;
}

const WysiwygPreview = ({ html, isDark = false, className = '' }: WysiwygPreviewProps ) => (
	<ShadowContainer
		html={ html }
		className={ [ className, isDark ? 'burst-dark-mode' : '' ].filter( Boolean ).join( ' ' ) }
	/>
);

export default WysiwygPreview;
