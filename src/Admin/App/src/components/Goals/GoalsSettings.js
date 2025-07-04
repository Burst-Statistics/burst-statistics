import useGoalsData from '@/hooks/useGoalsData';
import useLicenseStore from '../../store/useLicenseStore';
import { __ } from '@wordpress/i18n';
import Icon from '../../utils/Icon';
import GoalSetup from './GoalSetup';
import { useState } from 'react';
import { burst_get_website_url } from '../../utils/lib';
import * as Popover from '@radix-ui/react-popover';
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
  const { isLicenseValid } = useLicenseStore();
  const [ predefinedGoalsVisible, setPredefinedGoalsVisible ] = useState( false );
  const { getValue } = useSettingsData();
  const cookieless = getValue( 'enable_cookieless_tracking' );

  const handleAddPredefinedGoal = ( goal ) => {
    addPredefinedGoal( goal.id, goal.type, cookieless );

    setPredefinedGoalsVisible( false );
  };

  const getGoalTypeNice = ( type ) => {
    switch ( type ) {
      case 'hook':
        return 'Hook';
      case 'clicks':
        return __( 'Click', 'burst-statistics' );
      case 'views':
        return __( 'View', 'burst-statistics' );
      default:
        return type;
    }
  };

  let predefinedGoalsButtonClass =
    ! predefinedGoals || 0 === predefinedGoals.length ? 'burst-inactive' : '';
  return (
    <div className="box-border w-full p-6">
      <p className="text-base">
        {__(
          'Goals are a great way to track your progress and keep you motivated.',
          'burst-statistics'
        )}
        {! isLicenseValid() &&
          ' ' +
            __(
              'While free users can create one goal, Burst Pro lets you set unlimited goals to plan, measure, and achieve more.',
              'burst-statistics'
            )}
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

        {( isLicenseValid() || 0 === goals.length ) && (
          <div className={'flex items-center gap-2'}>
            <button
              className={'burst-button burst-button--secondary'}
              type={'button'}
              onClick={addGoal}
            >
              {__( 'Add goal', 'burst-statistics' )}
            </button>
            {predefinedGoals && (
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
                      predefinedGoalsVisible ? 'chevron-up' : 'chevron-down'
                    }
                    color={'gray'}
                  />
                </Popover.Trigger>

                <Popover.Content
                  sideOffset={5}
                  align={'end'}
                  className="z-50 flex flex-col gap-2 rounded-lg border border-gray-400 bg-white p-2"
                >
                  {predefinedGoals.map( ( goal, index ) => {
                    return (
                      <div
                        key={index}
                        className={
                          'hook' === goal.type && cookieless ?
                            'pointer-events-none relative z-50 flex cursor-not-allowed flex-row gap-1 rounded-lg border border-gray-400 bg-gray-100 p-2 opacity-50' :
                            'relative z-50 flex cursor-pointer flex-row gap-1 rounded-lg border border-gray-400 bg-gray-100 p-2'
                        }
                        onClick={() => handleAddPredefinedGoal( goal )}
                      >
                        <Icon name={'plus'} size={18} color="gray" />
                        {goal.title + ' (' + getGoalTypeNice( goal.type ) + ')'}
                        {'hook' === goal.type &&
                          ( cookieless ? (
                            <Icon
                              name={'error'}
                              color={'black'}
                              tooltip={__(
                                'Not available in combination with cookieless tracking',
                                'burst-statistics'
                              )}
                            />
                          ) : null )}
                      </div>
                    );
                  })}
                  {__(
                    'Plug-in you\'re looking for not listed?',
                    'burst-statistics'
                  ) + ' '}
                  <a
                    className="underline"
                    href={burst_get_website_url( '/request-goal-integration/', {
                      burst_source: 'goals-integration-request'
                    })}
                  >
                    {__( 'Request it here!', 'burst-statistics' )}
                  </a>
                </Popover.Content>
              </Popover.Root>
            )}
            <div className="ml-auto text-right">
              <p
                className={'rounded-lg bg-gray-300 p-1 px-3 text-sm text-gray'}
              >
                {isLicenseValid() ? (
                  <> {goals.length} / &#8734; </>
                ) : (
                  <>{goals.length} / 1</>
                )}
              </p>
            </div>
          </div>
        )}
        {! isLicenseValid() && (
          <div className={'burst-settings-goals__upgrade'}>
            <Icon name={'goals'} size={24} color="gray" />
            <h4>{__( 'Want more goals?', 'burst-statistics' )}</h4>
            <div className="burst-divider" />
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
