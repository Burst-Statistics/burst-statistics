import React, { useMemo, useState } from 'react';
import Icon from '../../utils/Icon';
import Tooltip from '@/components/Common/Tooltip';
import { __ } from '@wordpress/i18n';
import GoalField from './GoalField';
import EditableTextField from '@/components/Fields/EditableTextField';
import DeleteGoalModal from './DeleteGoalModal';
import { updateFieldsListWithConditions } from '@/hooks/useGoalsData';
import SwitchInput from '@/components/Inputs/SwitchInput';

const GoalSetup = ({
	goal,
	goalFields,
	setGoalValue,
	deleteGoal,
	saveGoalTitle,
	toggleGoalStatus,
	isLimitReached
}) => {
	const [ isToggling, setIsToggling ] = useState( false );

	const isActive = 'active' === goal.status;
	const isToggleDisabled = isLimitReached && ! isActive;

	// Use useMemo to compute fields only when dependencies change
	const fields = useMemo( () => {
		if ( ! goalFields || 0 === goalFields.length ) {
			return [];
		}

		// give each field a value property
		const updatedFields = goalFields.map( ( field ) => {
			const goalField = { ...field };
			goalField.value = goal[goalField.id];
			return goalField;
		});

		return updateFieldsListWithConditions( updatedFields );
	}, [ goalFields, goal ]);

	if ( ! goalFields ) {
		return null;
	}

	const handleToggle = async( value ) => {
		setIsToggling( true );
		try {
			await toggleGoalStatus( goal.id, value ? 'active' : 'inactive' );
		} finally {
			setIsToggling( false );
		}
	};

	return (
		<div className="w-full bg-gray-100 rounded-m">
			<details className="rounded-md border border-gray-200">
				<summary className="burst-no-marker py-1.5 px-2.5 grid gap-1.5 items-center list-none grid-cols-[26px_1fr_auto_auto_auto] @md:gap-3">
					<Icon
						name={
							goal.type &&
							fields[1] &&
							fields[1].options &&
							fields[1].options[goal.type] ?
								fields[1].options[goal.type].icon :
								'eye'
						}
						size={20}
					/>
					<span>
						<EditableTextField
							value={
								goal.title && 0 < goal.title.length ?
									goal.title :
									' '
							}
							id={goal.id}
							defaultValue={__( 'New goal', 'burst-statistics' )}
							onChange={( value ) => {
								setGoalValue( goal.id, 'title', value );
								saveGoalTitle( goal.id, value );
							}}
						/>
					</span>
					<DeleteGoalModal
						goal={{
							name:
								goal.title && 0 < goal.title.length ?
									goal.title :
									' ',
							status: isActive ?
								__( 'Active', 'burst-statistics' ) :
								__( 'Inactive', 'burst-statistics' ),
							dateCreated:
								goal &&
								goal.date_created !== undefined &&
								1 < goal.date_created ?
									goal.date_created :
									1
						}}
						deleteGoal={() => {
							deleteGoal( goal.id );
						}}
					/>
					<Tooltip
						content={
							isActive ?
								__( 'Click to de-activate', 'burst-statistics' ) :
								__( 'Click to activate', 'burst-statistics' )
						}
					>
						<span className="relative burst-click-to-filter burst-goal-toggle">
							{isToggling && (
								<span
									className="absolute inset-0 flex items-center justify-center z-10"
									aria-label={__( 'Saving…', 'burst-statistics' )}
								>
									<svg
										className="animate-spin"
										width="16"
										height="16"
										viewBox="0 0 16 16"
										fill="none"
										xmlns="http://www.w3.org/2000/svg"
									>
										<circle
											cx="8"
											cy="8"
											r="6"
											stroke="currentColor"
											strokeWidth="2"
											strokeOpacity="0.25"
										/>
										<path
											d="M14 8a6 6 0 0 0-6-6"
											stroke="currentColor"
											strokeWidth="2"
											strokeLinecap="round"
										/>
									</svg>
								</span>
							)}
							<span className={isToggling ? 'opacity-0 pointer-events-none' : ''}>
								<SwitchInput
									size="small"
									value={isActive}
									disabled={isToggleDisabled || isToggling}
									onChange={handleToggle}
								/>
							</span>
						</span>
					</Tooltip>
					<Icon name="chevron-down" size={18} />
				</summary>
				{0 < fields.length &&
					fields.map( ( field, i ) => (
						<GoalField
							key={i}
							field={field}
							goal={goal}
							value={field.value}
							setGoalValue={setGoalValue}
						/>
					) )}
			</details>
		</div>
	);
};
export default GoalSetup;
