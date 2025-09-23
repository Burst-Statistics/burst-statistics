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

   // Custom validation for IP blocklist field
  // IPv4 + IPv6 validation + duplicate detection
  const getCustomValidation = () => {
    if (setting.type === 'ip_blocklist') {
      // Strict IPv4
      const ipv4Regex =
          /^((25[0-5]|2[0-4]\d|1?\d{1,2})\.){3}(25[0-5]|2[0-4]\d|1?\d{1,2})$/;

      // IPv6 (full, compressed, leading ::, trailing ::, and IPv4-mapped)
      // Note: This is intentionally broad but practical for UI validation.
      const ipv6Regex =
          /^((?:[0-9A-Fa-f]{1,4}:){7}[0-9A-Fa-f]{1,4}|(?:[0-9A-Fa-f]{1,4}:){1,7}:|:(?::[0-9A-Fa-f]{1,4}){1,7}|(?:[0-9A-Fa-f]{1,4}:){1,6}:[0-9A-Fa-f]{1,4}|(?:[0-9A-Fa-f]{1,4}:){1,5}(?::[0-9A-Fa-f]{1,4}){1,2}|(?:[0-9A-Fa-f]{1,4}:){1,4}(?::[0-9A-Fa-f]{1,4}){1,3}|(?:[0-9A-Fa-f]{1,4}:){1,3}(?::[0-9A-Fa-f]{1,4}){1,4}|(?:[0-9A-Fa-f]{1,4}:){1,2}(?::[0-9A-Fa-f]{1,4}){1,5}|[0-9A-Fa-f]{1,4}:(?:(?::[0-9A-Fa-f]{1,4}){1,6})|::(?:ffff(?::0{1,4})?:)?(?:(25[0-5]|2[0-4]\d|1?\d{1,2})\.){3}(25[0-5]|2[0-4]\d|1?\d{1,2}))$/;

      // Helper: is valid IP (v4 or v6)
      const isValidIp = (ip) => ipv4Regex.test(ip) || ipv6Regex.test(ip);

      // Helper: normalize list input to clean lines
      const toLines = (value) =>
          value
              .replace(/\r\n/g, '\n')
              .replace(/\r/g, '\n')
              .split('\n')
              .map((s) => s.trim())
              .filter((s) => s !== '');

      // Helper: key for duplicate detection (case-insensitive for IPv6)
      const dupKey = (ip) => ip.toLowerCase();

      return {
        validate: {
          // Validate each line is IPv4 or IPv6
          validIps: (value) => {
            if (!value) return true;

            const lines = toLines(value);

            if (lines.length === 0) return true;

            const invalid = lines.filter((ip) => !isValidIp(ip));

            // Return true or an error string (react-hook-form compatible)
            return (
                invalid.length === 0 ||
                __('Invalid IP address format: ', 'burst-statistics') +
                invalid.join(', ')
            );
          },

          // Check duplicates (case-insensitive to avoid IPv6 casing dupes)
          noDuplicates: (value) => {
            if (!value) return true;

            const lines = toLines(value);
            if (lines.length === 0) return true;

            /** @type {Record<string, number>} */
            const counts = {};
            lines.forEach((ip) => {
              const key = dupKey(ip);
              counts[key] = (counts[key] || 0) + 1;
            });

            const dups = Object.entries(counts)
                .filter(([, n]) => n > 1)
                .map(([k]) => k);

            return (
                dups.length === 0 ||
                __('Duplicate IP addresses found: ', 'burst-statistics') +
                dups.join(', ')
            );
          },
        },
      };
    }

    // Fallback to existing validation if present
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
    if ( setting.pro && !isLicenseValid() ) {
      return true;
    }

    return props.settingsIsUpdating;
  }, [setting.disabled, props.settingsIsUpdating]);

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
