import React, { useState, useEffect } from 'react';
import { __ } from '@wordpress/i18n';
import RadioButtonsInput from '@/components/Inputs/RadioButtonsInput';
import Icon from '@/utils/Icon';

interface FilterConfig {
  label: string;
  icon: string;
  type: string;
  pro?: boolean;
}

interface BooleanFilterSetupProps {
  filterKey: string;
  config: FilterConfig;
  initialValue?: string;
  onChange: (value: string) => void;
}

interface RadioOption {
  type: string;
  icon: string;
  label: string;
  description?: string;
}

interface RadioOptions {
  [key: string]: RadioOption;
}

const BooleanFilterSetup: React.FC<BooleanFilterSetupProps> = ({
                                                                 filterKey,
                                                                 config,
                                                                 initialValue = '',
                                                                 onChange
                                                               }) => {
  const [value, setValue] = useState<string>(initialValue);

  useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);

  const handleChange = (newValue: string) => {
    setValue(newValue);
    onChange(newValue);
  };

  // Get filter-specific options based on the filter key
  const getFilterOptions = (): RadioOptions => {
    if (filterKey === 'bounces') {
      return {
        '': {
          type: '',
          icon: 'user',
          label: __('All visitors (default)', 'burst-statistics'),
        },
        'include': {
          type: 'include',
          icon: 'bounce',
          label: __('Bounced visitors', 'burst-statistics'),
        },
        'exclude': {
          type: 'exclude',
          icon: 'user-check',
          label: __('Active visitors', 'burst-statistics'),
        }
      };
    } else if (filterKey === 'new_visitor') {
      return {
        '': {
          type: '',
          icon: 'user',
          label: __('All visitors (default)', 'burst-statistics'),
        },
        'include': {
          type: 'include',
          icon: 'user-plus',
          label: __('New visitors', 'burst-statistics'),
        },
        'exclude': {
          type: 'exclude',
          icon: 'user-check',
          label: __('Returning visitors', 'burst-statistics'),
        }
      };
    }

    // Fallback for any other boolean filters
    return {
      '': {
        type: '',
        icon: 'user',
        label: __('All visitors (default)', 'burst-statistics'),
        description: __('Show all visitors without filtering', 'burst-statistics'),
      },
      'include': {
        type: 'include',
        icon: 'check',
        label: __('Include', 'burst-statistics'),
        description: __('Include visitors matching this criteria', 'burst-statistics'),
      },
      'exclude': {
        type: 'exclude',
        icon: 'times',
        label: __('Exclude', 'burst-statistics'),
        description: __('Exclude visitors matching this criteria', 'burst-statistics'),
      }
    };
  };

  const radioOptions = getFilterOptions();

  return (
    <div className="space-y-6">

      {/* Radio Options */}
      <div className="space-y-3">
        <label className="block text-sm font-medium text-gray-700">
          {__('Filter option', 'burst-statistics')}
        </label>
        <RadioButtonsInput
          inputId={`${filterKey}-boolean`}
          options={radioOptions}
          value={value}
          onChange={handleChange}
          columns={1}
        />
      </div>
    </div>
  );
};

export default BooleanFilterSetup; 