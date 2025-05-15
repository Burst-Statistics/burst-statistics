import {useGoalsStore} from '../../../store/useGoalsStore';
import useLicenseStore from '../../../store/useLicenseStore';
import {__} from '@wordpress/i18n';
import Icon from '../../../utils/Icon';
import GoalSetup from '../Goals/GoalSetup';
import {useEffect, useState} from '@wordpress/element';
import {burst_get_website_url} from '../../../utils/lib';
import * as Popover from '@radix-ui/react-popover';
import Pro from '../Fields/Pro';
import {useFields} from '../../../store/useFieldsStore';

const GoalsSettings = ( props ) => {
  const { goals, goalFields, predefinedGoals, addGoal, deleteGoal, updateGoal, addPredefinedGoal, setGoalValue, saveGoalTitle } = useGoalsStore();
  const {licenseStatus} = useLicenseStore();
  const [ predefinedGoalsVisible, setPredefinedGoalsVisible ] = useState( false );
    const getFieldValue = useFields( ( state ) => state.getFieldValue );
    const fieldsLoaded = useFields( ( state ) => state.fieldsLoaded );
    const [ cookieless, setCookieless ] = useState( false );

    useEffect( () => {
        if ( fieldsLoaded ) {
            setCookieless( 1 == getFieldValue( 'enable_cookieless_tracking' ) );
        }
    }, [ fieldsLoaded, getFieldValue( 'enable_cookieless_tracking' ) ]);

    const handleAddPredefinedGoal = ( goal ) => {
      addPredefinedGoal( goal.id, goal.type, cookieless );

        setPredefinedGoalsVisible( false );
    };

  let predefinedGoalsButtonClass = ! predefinedGoals || 0 === predefinedGoals.length ? 'burst-inactive' : '';
  return (
      <div className="burst-burst-settings-goals">
        <div className="burst-settings-goals__introduction">
          {__( 'Goals are a great way to track your progress and keep you motivated.', 'burst-statistics' )}
        </div>
        <div className="burst-settings-goals__list">
          { 0 < goals.length && goals.map( ( goal, index ) => {
            return (
                <GoalSetup
                    key={index}
                    goal={goal}
                    goalFields={goalFields}
                    setGoalValue={setGoalValue}
                    deleteGoal={deleteGoal}
                    onUpdate={updateGoal}
                    saveGoalTitle={saveGoalTitle}
                />
            );
          })}


          {/*@todo for free make the buttons disabled and add a counter for allowed goals*/}
          { ( 'valid' === licenseStatus || 0 === goals.length ) && (
              <div className={'burst-settings-goals__add-goal'}>
                  <button
                      className={'burst-button burst-button--secondary'}
                      onClick={addGoal}
                  >
                      {__( 'Add goal', 'burst-statistics' )}
                  </button>
                { predefinedGoals && 1 <= predefinedGoals.length &&
                    <Popover.Root open={predefinedGoalsVisible} onOpenChange={setPredefinedGoalsVisible}>
                      <Popover.Trigger asChild>
                        <button className={ predefinedGoalsButtonClass + ' burst-button burst-button--secondary'}>
                          {__( 'Add predefined goal', 'burst-statistics' )} <Pro pro={{url: 'https://burst-statistics.com/predefined-goals'}} id={'predefined-goals'}/>
                          <Icon name={predefinedGoalsVisible ? 'chevron-up' : 'chevron-down'} color={'grey'}/>
                      </button>
                      </Popover.Trigger>
                      <Popover.Portal>
                        <Popover.Content
                            className="burst-button-dropdown"
                            sideOffset={5}
                            align={'end'}
                        >
                              {  predefinedGoals.map( ( goal, index ) => {
                                  return (
                                          <div key={index} className={'hook' === goal.type && cookieless ? 'burst-button-dropdown__row burst-inactive' : 'burst-button-dropdown__row'} onClick={() => handleAddPredefinedGoal( goal ) }>
                                            <Icon name={'plus'} size={18} color="grey"/>
                                              {goal.title}
                                              {'hook' === goal.type && cookieless && <Icon name={'error'} color={'black'} tooltip={__( 'Not available in combination with cookieless tracking', 'burst-statistics' )}/>}
                                          </div>
                                      );
                                  })
                              }
                        </Popover.Content>
                      </Popover.Portal>
                    </Popover.Root>
                }
              </div>
          )}
            {! burst_settings.is_pro && (
                <div className={'burst-settings-goals__upgrade'}>
                    <Icon name={'goals'} size={24} color="grey"/>
                    <h4>{__( 'Want more goals?', 'burst-statistics' )}</h4>
                <div className="burst-divider" />
                <p>{__( 'Upgrade to Burst Pro', 'burst-statistics' )}</p>
                <a
                    href={burst_get_website_url( '/pricing/', {
                      burst_source: 'goals-setting',
                      burst_content: 'more-goals'
                    })}
                    target={'_blank'}
                    className={'burst-button burst-button--pro'} rel="noreferrer"
                >
                  {__( 'Upgrade to Pro', 'burst-statistics' )}
                </a>
              </div>
          )}

        </div>
      </div>
  );
};

export default GoalsSettings;
