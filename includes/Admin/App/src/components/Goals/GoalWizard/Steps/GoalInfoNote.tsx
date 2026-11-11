import type { ReactNode } from 'react';
import { clsx } from 'clsx';
import Icon from '@/utils/Icon';

interface GoalInfoNoteProps {

	// A warning stands out; an info note restates what the goal will count.
	isWarning?: boolean;
	action?: ReactNode;
	children: ReactNode;
}

/**
 * A boxed sentence under a step's inputs: what the goal will count, or a risk to know about.
 *
 * @param {GoalInfoNoteProps} props           Component props.
 * @param {boolean}           props.isWarning Whether this is a warning.
 * @param {ReactNode}         props.action    Optional action element on the right (e.g. a button).
 * @param {ReactNode}         props.children  The sentence.
 * @return {JSX.Element} The note.
 */
const GoalInfoNote = ({ isWarning = false, action, children }: GoalInfoNoteProps ): JSX.Element => (
	<div
		className={clsx(
			'flex items-center justify-between gap-3 rounded-lg border p-4 text-base text-text-black',
			isWarning ? 'border-yellow-300 bg-yellow-50' : 'border-gray-200 bg-white'
		)}
	>
		<div className="flex items-start gap-3">
			<Icon name={isWarning ? 'warning' : 'info'} size={20} color={isWarning ? 'yellow' : 'green'} className="mt-0.5 shrink-0" />
			<div className="text-sm sm:text-base">{children}</div>
		</div>
		{action && <div className="shrink-0">{action}</div>}
	</div>
);

export default GoalInfoNote;
