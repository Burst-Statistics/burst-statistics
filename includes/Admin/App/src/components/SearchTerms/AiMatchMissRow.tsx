import { formatTimes } from '@/utils/formatting';

type AiMatchMissRowProps = {
	label: string;
	description: string;
	count: number;
};

/**
 * Grey row in the AI match popover for searches that showed no suggested page.
 *
 * @param {AiMatchMissRowProps} props Component props.
 * @return {JSX.Element|null} The row, or null when the count is zero.
 */
const AiMatchMissRow = ({ label, description, count }: AiMatchMissRowProps ) => {
	if ( 0 === count ) {
		return null;
	}

	return (
		<tr className="text-text-gray">
			<td className="px-5 py-2 align-top">
				<span className="block">{label}</span>
				<span className="block text-xs">{description}</span>
			</td>
			<td className="px-2 py-2 text-right align-top tabular-nums">{formatTimes( count )}</td>
			<td className="pl-2 pr-5 py-2 text-right align-top">–</td>
		</tr>
	);
};

export default AiMatchMissRow;
