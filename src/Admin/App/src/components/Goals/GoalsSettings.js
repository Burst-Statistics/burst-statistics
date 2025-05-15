import useGoalsData from '@/hooks/useGoalsData';
import useLicenseStore from '../../store/useLicenseStore';
import {__} from '@wordpress/i18n';
import Icon from '../../utils/Icon';
import GoalSetup from './GoalSetup';
import {useState} from 'react';
import {burst_get_website_url} from '../../utils/lib';
import * as Popover from '@radix-ui/react-popover';
import Pro from '@/components/Common/Pro';
import useSettingsData from '@/hooks/useSettingsData';

const GoalsSettings = () => {
  const {
    goals,
    goalFields,
    predefinedGoals,
    addGoal,
    deleteGoal,
    updateGoal,
    addPredefinedGoal,
    setGoalValue,
    saveGoalTitle
  } = useGoalsData();
  const {isLicenseValid} = useLicenseStore();
  const [ predefinedGoalsVisible, setPredefinedGoalsVisible ] = useState( false );
  const {getValue} = useSettingsData();
  const cookieless = getValue( 'enable_cookieless_tracking' );

  console.log(isLicenseValid);

  const handleAddPredefinedGoal = ( goal ) => {
    addPredefinedGoal( goal.id, goal.type, cookieless );

    setPredefinedGoalsVisible( false );
  };

  let predefinedGoalsButtonClass =
      ! predefinedGoals || 0 === predefinedGoals.length ? 'burst-inactive' : '';
  return (
      <div className="w-full p-6 box-border">
        <p className="text-base">
          {__(
              'Goals are a great way to track your progress and keep you motivated.',
              'burst-statistics'
          )}
          {!isLicenseValid && ' ' +
              __( 'While free users can create one goal, Burst Pro lets you set unlimited goals to plan, measure, and achieve more.',
                  'burst-statistics' )}
        </p>
        <div className="burst-settings-goals__list">
          {0 < goals.length &&
              goals.map( ( goal, index ) => {
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


          {( isLicenseValid || 0 === goals.length ) && (
              <div className={'flex gap-2 items-center'}>
                <button
                    className={'burst-button burst-button--secondary'}
                    type={'button'}
                    onClick={addGoal}
                >
                  {__( 'Add goal', 'burst-statistics' )}
                </button>
                {predefinedGoals && 1 <= predefinedGoals.length && (
                    <Popover.Root
                        open={predefinedGoalsVisible}
                        onOpenChange={() => {
                          setPredefinedGoalsVisible( ! predefinedGoalsVisible );
                        }}
                    >
                      <Popover.Trigger 
                            type={'button'}
                            className={
                                predefinedGoalsButtonClass +
                                ' burst-button burst-button--secondary'
                            }
                            onClick={() => {
                              setPredefinedGoalsVisible( ! predefinedGoalsVisible );
                            }}
                        >
                          {__( 'Add predefined goal', 'burst-statistics' )}{' '}

                          <Icon
                              name={
                                predefinedGoalsVisible ?
                                    'chevron-up' :
                                    'chevron-down'
                              }
                              color={'gray'}
                          />
                      </Popover.Trigger>
                      
                      <Popover.Content
                          sideOffset={5}
                          align={'end'}
                          className="z-50 flex flex-col gap-2 bg-white rounded-lg p-2 border border-gray-400"
                      >
                        {predefinedGoals.map( ( goal, index ) => {
                          return (
                              <div 
                                  key={index}
                                  className={
                                    'hook' === goal.type && cookieless                                          ?
                                        'flex gap-1 flex-row p-2 bg-gray-100 rounded-lg border border-gray-400 z-50 relative cursor-not-allowed pointer-events-none opacity-50'                                          :
                                        'flex gap-1 flex-row p-2 bg-gray-100 rounded-lg border border-gray-400 z-50 relative cursor-pointer'
                                  }
                                  onClick={() => handleAddPredefinedGoal(
                                      goal )}
                              >
                                <Icon name={'plus'} size={18} color="gray"/>
                                {goal.title}
                                {'hook' === goal.type && (
                                    cookieless ? (
                                        <Icon
                                            name={'error'}
                                            color={'black'}
                                            tooltip={__(
                                                'Not available in combination with cookieless tracking',
                                                'burst-statistics'
                                            )}
                                        />
                                    ) : null
                                )}
                              </div>
                          );
                        })}
                      </Popover.Content>
                    </Popover.Root>
                )}
                <div className="ml-auto text-right">
                  <p className={'bg-gray-300 p-1 rounded-lg px-3 text-sm text-gray-500'}>
                  {isLicenseValid ? (
                      <> {goals.length} / &#8734; </>
                  ) : (
                      <>{goals.length} / 1</>
                  )}
                  </p>
                </div>
              </div>
          )}
          {! burst_settings.is_pro && (
              <div className={'burst-settings-goals__upgrade'}>
                <Icon name={'goals'} size={24} color="gray"/>
                <h4>{__( 'Want more goals?', 'burst-statistics' )}</h4>
                <div className="burst-divider"/>
                <p>{__( 'Upgrade to Burst Pro', 'burst-statistics' )}</p>
                <a
                    href={burst_get_website_url( '/pricing/', {
                      burst_source: 'goals-setting',
                      burst_content: 'more-goals'
                    })}
                    target={'_blank'}
                    className={'burst-button burst-button--pro'}
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
