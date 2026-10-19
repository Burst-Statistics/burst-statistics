import { memo } from 'react';
import { Block } from '@/components/Blocks/Block';
import { isMeasuring, usePageWeightData } from './usePageWeightData';
import { useGreenHosting } from './useGreenHosting';
import PageWeightHeading from './PageWeightHeading';
import PageWeightBody from './PageWeightBody';

type PageWeightBlockProps = {

	/** Additional CSS class names passed to the wrapping Block. */
	className?: string;
};

/**
 * Compact dashboard block showing average page weight and its CO2 estimate.
 *
 * Shows the heaviest measured pages of the period, the emissions they add up
 * to, and the site's green hosting state. The CO2 estimate and carbon rating
 * can each be hidden from the options menu.
 *
 * @param {Object} props           - Component props.
 * @param {string} props.className - Additional CSS classes for the Block wrapper.
 * @return {JSX.Element} The page weight block.
 */
const PageWeightBlock = memo( ({ className = '' }: PageWeightBlockProps ) => {
	const { data, isLoading } = usePageWeightData();
	const greenHosting = useGreenHosting();
	const measuring = isMeasuring( data );

	return (
		<Block className={className}>
			{ /* While measuring there are no figures, so every item in the
				options menu would toggle something that is not on screen, and
				the fullscreen table would open on an empty list. */ }
			<PageWeightHeading
				isLoading={isLoading}
				showGreenHosting={! ( data?.green_hosting.status.green ?? false )}
				showMenu={! measuring}
				showExpand={! measuring}
			/>

			<PageWeightBody
				data={data}
				isLoading={isLoading}
				isChecking={greenHosting.isPending}
				onCheck={greenHosting.check}
			/>

			{ '' !== greenHosting.error && (
				<p className="px-5 pb-4 text-sm text-red">{greenHosting.error}</p>
			) }
		</Block>
	);
});

PageWeightBlock.displayName = 'PageWeightBlock';

export default PageWeightBlock;
