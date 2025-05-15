import { useMemo } from 'react';
import ErrorBoundary from '@/components/Common/ErrorBoundary';
import useGoalsData from '@/hooks/useGoalsData';
import SettingsGroupBlock from './SettingsGroupBlock';
import SettingsFooter from './SettingsFooter';
import useSettingsData from '@/hooks/useSettingsData';
import { useForm } from 'react-hook-form';

/**
 * Renders the selected settings
 *
 */
const Settings = ({ currentSettingPage }) => {
  const { settings, saveSettings } = useSettingsData();
  const { saveGoals } = useGoalsData();
  const settingsId = currentSettingPage.id;

  const currentFormDefaultValues = useMemo(
    () => extractFormValuesPerMenuId( settings, settingsId ),
    [ settings, settingsId ]
  );

  const currentFormValues = useMemo(
    () => extractFormValuesPerMenuId( settings, settingsId, 'value' ),
    [ settings, settingsId ]
  );

  const lastGroup = useMemo(
    () =>
      currentSettingPage?.groups?.[currentSettingPage?.groups?.length - 1] ||
      null,
    [ currentSettingPage?.groups ]
  );

  // Initialize useForm with default values from the fetched settings data
  const {
    handleSubmit,
    control,
    formState: { dirtyFields }
  } = useForm({
    defaultValues: currentFormDefaultValues,
    values: currentFormValues
  });

  const filterCurrentFormFields = ( settings, settingsId, currentFormValues ) => {

    // do conditional checks
    let filterSettings = settings.filter( ( setting ) => setting.menu_id === settingsId );

    filterSettings.forEach( ( setting ) => {
      if ( setting.react_conditions ) {

        // Check if all conditions are met
        const conditionsMet = Object.entries( setting.react_conditions ).every( ([ field, allowedValues ]) => {
          const currentValue = currentFormValues[field];
          return allowedValues.includes( currentValue );
        });

        // If conditions are not met, disable the field
        if ( ! conditionsMet ) {
          setting.visible = true;
        }
      }
    });

    return filterSettings;
  };

  const currentFormFields = filterCurrentFormFields( settings, settingsId, currentFormValues );

  // based on current values we need to conditionally disable or enable other fields

  return (
    <form>
      <ErrorBoundary fallback={'Could not load Settings'}>
        {currentSettingPage.groups?.map( ( group ) => {
          const isLastGroup = lastGroup.id === group.id;
          const currentGroupFields = currentFormFields.filter(
            ( field ) => field.group_id === group.id
          );
          return (
            <SettingsGroupBlock
              key={group.id}
              group={group}
              fields={currentGroupFields}
              control={control}
              isLastGroup={isLastGroup}
            />
          );
        })}
        {/* Don't display the footer when we are on the license SettingsPage */}
        {'license' !== settingsId && (
        <SettingsFooter
          onSubmit={handleSubmit( ( formData ) => {
            // Only send changed fields
            const changedData = Object.keys(dirtyFields).reduce((acc, key) => {
              acc[key] = formData[key];
              return acc;
            }, {});
            
            saveSettings(changedData);
            saveGoals();
          })}
          control={control}
        />
        )}
      </ErrorBoundary>
    </form>
  );
};
export default Settings;

const extractFormValuesPerMenuId = ( settings, menuId, key = 'default' ) => {

  // Extract default values from settings data where menu_id ===  settingsId
  const formValues = {};
  settings.forEach( ( setting ) => {
    if ( setting.menu_id === menuId ) {
      formValues[setting.id] = setting[key];
    }
  });

  return formValues;
};
