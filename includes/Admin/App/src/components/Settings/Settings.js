import {useEffect, useMemo} from 'react';
import ErrorBoundary from '@/components/Common/ErrorBoundary';
import useGoalsData from '@/hooks/useGoalsData';
import SettingsGroupBlock from './SettingsGroupBlock';
import SettingsFooter from './SettingsFooter';
import useSettingsData from '@/hooks/useSettingsData';
import { useForm } from 'react-hook-form';
import { useWatch } from 'react-hook-form';

/**
 * Renders the selected settings
 *
 */
const Settings = ({ currentSettingPage }) => {
  const { settings, saveSettings } = useSettingsData();
  const { saveGoals } = useGoalsData();
  const settingsId = currentSettingPage.id;

  const initialDefaultValues = useMemo(
      () => extractFormValuesPerMenuId(settings, settingsId),
      []
  );

  // Initialize useForm with default values from the fetched settings data
  const {
    handleSubmit,
    control,
    formState: { dirtyFields },
      reset
  } = useForm({
    defaultValues: initialDefaultValues,
  });

  const watchedValues = useWatch({ control });
  const filteredGroups = useMemo(() => {
    const grouped = [];
    currentSettingPage.groups.forEach((group) => {
      const groupFields = settings
          .filter((setting) => setting.menu_id === settingsId && setting.group_id === group.id)
          .filter((setting) => {
            if ( !setting.react_conditions ) {
                return true;
            }
            return Object.entries(setting.react_conditions).every(([field, allowedValues]) => {
              const value = watchedValues?.[field];
              if (!Array.isArray(allowedValues)) {
                return value === allowedValues;
              }
              if (Array.isArray(value)) {
                return allowedValues.some(allowedValue =>
                    Array.isArray(allowedValue) &&
                    value.length === allowedValue.length &&
                    value.every((val, index) => val === allowedValue[index])
                );
              }
              return allowedValues.includes(value);
            });
          });

      if (groupFields.length > 0) {
        grouped.push({ ...group, fields: groupFields });
      }
    });

    return grouped;
  }, [settings, settingsId, currentSettingPage.groups, watchedValues]);

  return (
      <form>
        <ErrorBoundary fallback={'Could not load Settings'}>
          {filteredGroups.map((group, index) => {
            const isLastGroup = index === filteredGroups.length - 1;

            return (
                <SettingsGroupBlock
                    key={group.id}
                    group={group}
                    fields={group.fields}
                    control={control}
                    isLastGroup={isLastGroup}
                />
            );
          })}

          {'license' !== settingsId && (
              <SettingsFooter
                  onSubmit={handleSubmit((formData) => {
                    const changedData = Object.keys(dirtyFields).reduce((acc, key) => {
                      acc[key] = formData[key];
                      return acc;
                    }, {});
                    saveSettings(changedData).then(() => {
                      reset(formData, {
                        keepValues: true,
                        keepDefaultValues: false  // <- Belangrijk! Update de defaultValues
                      });
                    });
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

const extractFormValuesPerMenuId = (settings, menuId) => {
  const formValues = {};
  settings.forEach(setting => {
    if (setting.menu_id === menuId) {
      const hasValue = setting.value !== undefined && setting.value !== '';
      formValues[setting.id] = hasValue ? setting.value : setting.default;
    }
  });
  return { ...formValues }; // <- force new object reference
};
