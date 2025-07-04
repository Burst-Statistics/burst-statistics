import { Controller, useWatch } from 'react-hook-form';
import TextField from '../Fields/TextField';
import HiddenField from '../Fields/HiddenField';
import ErrorBoundary from '@/components/Common/ErrorBoundary';
import { memo, useMemo } from 'react';
import { __ } from '@wordpress/i18n';
import TextAreaField from './TextAreaField';
import IpBlockField from './IpBlockField';
import SwitchField from './SwitchField';
import ButtonControlField from './ButtonControlField';
import EmailReportsField from './EmailReportsField';
import CheckboxGroupField from './CheckboxGroupField';
import GoalsSettings from '../Goals/GoalsSettings';
import LicenseField from './LicenseField';
import SelectField from './SelectField';
import NumberField from './NumberField';
import LogoEditorField from './LogoEditorField';
import RestoreArchivesField from './RestoreArchivesField';
import RadioField from './RadioField';
import { useFormContext } from 'react-hook-form';
import useLicenseStore from '@/store/useLicenseStore';

const fieldComponents = {
  text: TextField,
  number: NumberField,
  api: HiddenField,
  hidden: HiddenField,
  checkbox: SwitchField,
  textarea: TextAreaField,
  ip_blocklist: IpBlockField,
  button: ButtonControlField,
  email_reports: EmailReportsField,
  checkbox_group: CheckboxGroupField,
  goals: GoalsSettings,
  license: LicenseField,
  select: SelectField,
  logo_editor: LogoEditorField,
  restore_archives: RestoreArchivesField,
  radio: RadioField
};

const Field = memo(({ setting, control, ...props }) => {
  // const { isLicenseValid } = useLicenseStore();
  const { isLicenseValid } = useLicenseStore();
  // Special handling for goal(s) type that should not be wrapped in a controller.
  if ('goals' === setting.type) {
    return (
      <ErrorBoundary>
        <GoalsSettings />
      </ErrorBoundary>
    );
  }

  const FieldComponent = fieldComponents[setting.type];

  if (!FieldComponent) {
    return (
      <div className="w-full">
        Unknown field type: {setting.type} {setting.id}
      </div>
    );
  }

  // // Watch all condition fields at the top level
  // const watchedValues = {};
  // if (setting.react_conditions) {
  //   Object.keys(setting.react_conditions).forEach(fieldName => {
  //     watchedValues[fieldName] = useWatch({
  //       control,
  //       name: fieldName,
  //       defaultValue: props.defaultValues?.[fieldName]
  //     });
  //   });
  // }
  //
  // // Memoize the condition check result
  // const conditionsMet = useMemo(() => {
  //   if (!setting.react_conditions || 0 === Object.keys(watchedValues).length) {
  //     return true;
  //   }
  //
  //   return Object.entries(setting.react_conditions).every(([field, allowedValues]) => {
  //     const currentValue = watchedValues[field];
  //
  //     // Ensure allowedValues is an array
  //     if (!Array.isArray(allowedValues)) {
  //       return false;
  //     }
  //
  //     return allowedValues.includes(currentValue);
  //   });
  // }, [setting.react_conditions, watchedValues]);



   // Custom validation for IP blocklist field
   const getCustomValidation = () => {
    if (setting.type === 'ip_blocklist') {
      return {
        validate: {
          // Validate each line is a valid IP address
          validIps: (value) => {
            if (!value) return true; // Allow empty field
            
            const ipRegex = /^((25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
            
            // Normalize newlines (handle different OS line endings) and split
            // This handles \n, \r, or \r\n
            const lines = value.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
            
            // Filter out empty lines and trim whitespace
            const nonEmptyLines = lines.filter(line => line.trim() !== '').map(ip => ip.trim());
            
            // If there are no valid lines after filtering, return true
            if (nonEmptyLines.length === 0) return true;
            
            const invalidIps = nonEmptyLines.filter(ip => {
              const isValid = ipRegex.test(ip);
              return !isValid;
            });
            
            return invalidIps.length === 0 || 
              __('Invalid IP address format: ', 'burst-statistics') + invalidIps.join(', ');
          },
          
          // Check for duplicates
          noDuplicates: (value) => {
            if (!value) return true;
            
            // Normalize newlines (handle different OS line endings) and split
            const lines = value.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
            
            // Filter out empty lines and trim whitespace
            const nonEmptyLines = lines.filter(line => line.trim() !== '').map(ip => ip.trim());
            
            // Skip duplicate check if there are no valid lines
            if (nonEmptyLines.length === 0) return true;
            
            const uniqueIps = new Set(nonEmptyLines);
            
            if (uniqueIps.size !== nonEmptyLines.length) {
              // Find duplicates by checking which IPs appear more than once
              const ipCounts = {};
              nonEmptyLines.forEach(ip => {
                ipCounts[ip] = (ipCounts[ip] || 0) + 1;
              });
              
              const duplicates = Object.keys(ipCounts).filter(ip => ipCounts[ip] > 1);
              
              return __('Duplicate IP addresses found: ', 'burst-statistics') + 
                duplicates.join(', ');
            }
            
            return true;
          }
        }
      };
    }
    
    return setting.validation?.validate ? { validate: setting.validation.validate } : {};
  };

  const validationRules = {
    ...(setting.required && {
      required: {
        value: true,
        message:
          setting.requiredMessage ||
          __('This field is required', 'burst-statistics')
      }
    }),
    ...(setting.validation?.regex && {
      pattern: {
        // hardcoded regex, no user input used.
        value: new RegExp(setting.validation.regex),// nosemgrep
        message:
          setting.validation.message ||
          __('Invalid format', 'burst-statistics')
      }
    }),
    ...getCustomValidation(),
    ...(setting.min && { min: setting.min }),
    ...(setting.max && { max: setting.max }),
    ...(setting.minLength && { minLength: setting.minLength }),
    ...(setting.maxLength && { maxLength: setting.maxLength })
  };

  const conditionallyDisabled = useMemo(() => {
    if (setting.disabled) {
      return true;
    }
    // if has anything (true|array|object|etc) in setting.pro and is not valid license
    if (setting.pro && !isLicenseValid()) {
      return true;
    }

    return props.settingsIsUpdating;
  }, [setting.disabled, props.settingsIsUpdating]);
  // If conditions are not met, don't render the field
  // if (!conditionsMet) {
  //   return null;
  // }
  return (
    <ErrorBoundary>
      <Controller
        name={setting.id}
        control={control}
        rules={validationRules}
        defaultValue={setting.value || setting.default}
        render={({ field, fieldState }) => (
          <FieldComponent
            field={field}
            fieldState={fieldState}
            control={control}
            required={setting.required}
            label={setting.label || setting.id}
            disabled={conditionallyDisabled}
            context={setting.context}
            help={setting.help}
            options={setting.options}
            setting={setting}
            recommended={setting.recommended}
            pro={setting.pro}
            {...props}
          />
        )}
      />
    </ErrorBoundary>
  );
});

Field.displayName = 'Field';

export default Field;
