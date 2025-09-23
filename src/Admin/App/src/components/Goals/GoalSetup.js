import React, {useState, useMemo} from 'react';
import Icon from '../../utils/Icon';
import Tooltip from '@/components/Common/Tooltip';
import {__} from '@wordpress/i18n';
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
  saveGoalTitle
}) => {
  const [ status, setStatus ] = useState( 'active' === goal.status );

  // Use useMemo to compute fields only when dependencies change
  // This is more efficient than using useState + useEffect
  const fields = useMemo( () => {
    if ( ! goalFields || 0 === goalFields.length ) {
      return [];
    }

    // give each field a value property
    const updatedFields = goalFields.map( ( field ) => {
      let goalField = {...field};
      goalField.value = goal[goalField.id];
      return goalField;
    });

    return updateFieldsListWithConditions( updatedFields );
  }, [ goalFields, goal ]);

  if ( ! goalFields ) {
    return null;
  }

  return (
      <div className="w-full bg-gray-100 rounded-m">
        <details className="rounded-md border border-gray-200">
          <summary className="burst-no-marker py-1.5 px-2.5 grid gap-3 items-center list-none [grid-template-columns:26px_1fr_auto_auto_auto]">
            <Icon name={
              goal.type && fields[1] && fields[1].options &&
              fields[1].options[goal.type] ?
                  fields[1].options[goal.type].icon : 'eye'
            } size={20}/>
            <span>
            <EditableTextField
                value={goal.title && 0 < goal.title.length ? goal.title : ' '}
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
                  name: goal.title && 0 < goal.title.length ? goal.title : ' ',
                  status: status ? __( 'Active', 'burst-statistics' ) : __(
                      'Inactive', 'burst-statistics' ),
                  dateCreated: ( goal && goal.date_created !== undefined &&
                      1 < goal.date_created ) ? goal.date_created : 1
                }}
                deleteGoal={() => {
                  deleteGoal( goal.id );
                }}
            />
            <Tooltip
                content={
                  status ? __( 'Click to de-activate', 'burst-statistics' ) : __(
                      'Click to activate', 'burst-statistics' )
                }
            >
            <span className="burst-click-to-filter burst-goal-toggle">
              <SwitchInput size="small" value={status} onChange={( value ) => {
                setStatus( value );
                setGoalValue( goal.id, 'status', value ? 'active' : 'inactive' );
              }
              }/>
            </span>
            </Tooltip>
            <Icon name="chevron-down" size={18}/>
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
                ) )
            }
        </details>
      </div>
  );
};
export default GoalSetup;
