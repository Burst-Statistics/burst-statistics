import type { ReactNode } from 'react';
import { __ } from '@wordpress/i18n';

interface GoalReviewRowProps {
	label: string;
	children: ReactNode;

	// Goes back to the step where this was chosen.
	onEdit: () => void;
}

/**
 * One line of the review: a setting, what was chosen, and a link back to change it.
 *
 * @param {GoalReviewRowProps} props          Component props.
 * @param {string}             props.label    The setting.
 * @param {ReactNode}          props.children What was chosen.
 * @param {Function}           props.onEdit   Goes back to change it.
 * @return {JSX.Element} The row.
 */
const GoalReviewRow = ({ label, children, onEdit }: GoalReviewRowProps ): JSX.Element => (
	<div className="flex items-center gap-4 px-5 py-4">
		<span className="w-1/4 shrink-0 text-sm text-text-gray">{label}</span>
		<span className="min-w-0 flex-1 break-words text-base text-text-black">{children}</span>
		<button type="button" onClick={onEdit} className="shrink-0 text-sm text-green underline hover:no-underline">
			{__( 'Edit', 'burst-statistics' )}
		</button>
	</div>
);

export default GoalReviewRow;
