import { __ } from '@wordpress/i18n';
import ButtonInput from '@/components/Inputs/ButtonInput';
import Icon from '@/utils/Icon';

interface GoalsEmptyStateProps {
	onCreate: () => void;
	canCreate: boolean;
}

/**
 * First-run state of the goals page: what a goal is and how to start.
 *
 * @param {GoalsEmptyStateProps} props           Component props.
 * @param {Function}             props.onCreate  Opens the goal wizard.
 * @param {boolean}              props.canCreate Whether a new goal can be added.
 * @return {JSX.Element} The empty state.
 */
const GoalsEmptyState = ({ onCreate, canCreate }: GoalsEmptyStateProps ): JSX.Element => {
	const examples = [
		__( 'Purchases', 'burst-statistics' ),
		__( 'Newsletter signups', 'burst-statistics' ),
		__( 'Contact form sent', 'burst-statistics' )
	];

	return (
		<div className="flex flex-col items-center gap-4 px-6 py-12 text-center">
			<Icon name="goals" size={32} />
			<p className="max-w-md text-base text-text-gray">
				{__( 'A goal counts every visitor who takes an action you care about, so you can see which pages and sources lead to it.', 'burst-statistics' )}
			</p>
			<ul className="flex flex-wrap justify-center gap-2">
				{examples.map( ( example ) => (
					<li key={example} className="rounded-full bg-gray-100 px-3 py-1 text-sm text-text-gray">
						{example}
					</li>
				) )}
			</ul>
			{canCreate && (
				<ButtonInput btnVariant="primary" onClick={onCreate} data-tour="new-goal-button">
					{__( 'Create your first goal', 'burst-statistics' )}
				</ButtonInput>
			)}
		</div>
	);
};

export default GoalsEmptyState;
