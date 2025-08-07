import React, { useState, useEffect } from 'react';
import { __ } from '@wordpress/i18n';
import TextInput from '@/components/Inputs/TextInput';
import RangeSliderInput from '@/components/Inputs/RangeSliderInput';
import Icon from '@/utils/Icon';

interface FilterConfig {
  label: string;
  icon: string;
  type: string;
  pro?: boolean;
}

interface IntFilterSetupProps {
  filterKey: string;
  config: FilterConfig;
  initialValue?: string;
  onChange: (value: string) => void;
}

type Range = [number, number];

const IntFilterSetup: React.FC<IntFilterSetupProps> = ({
                                                         filterKey,
                                                         config,
                                                         initialValue = '',
                                                         onChange
                                                       }) => {
  // Parse initial value - could be single value or range
  const parseInitialValue = (value: string): Range => {
    if (!value || value === '') return [0, 100];

    // If it's a string with range separator, parse it
    if (typeof value === 'string' && value.includes('-')) {
      const [min, max] = value.split('-').map(v => parseFloat(v.trim()));
      return [min || 0, max || 100];
    }

    // If it's a single value, create a range from 0 to that value
    const numValue = parseFloat(value) || 0;
    return [0, numValue];
  };

  const [rangeValue, setRangeValue] = useState<Range>(parseInitialValue(initialValue));
  const [min, setMin] = useState<number>(0);
  const [max, setMax] = useState<number>(100);

  useEffect(() => {
    setRangeValue(parseInitialValue(initialValue));
  }, [initialValue]);

  // Set appropriate min/max based on filter type
  useEffect(() => {
    switch (filterKey) {
      case 'bounce_rate':
      case 'conversion_rate':
        setMin(0);
        setMax(100);
        break;
      case 'time_per_session':
        setMin(0);
        setMax(3600); // 1 hour in seconds
        break;
      default:
        setMin(0);
        setMax(100);
    }
  }, [filterKey]);

  const handleRangeChange = (newRange: Range) => {
    setRangeValue(newRange);
    // Convert range to string format for parent component
    const rangeString = newRange[0] === newRange[1] ?
      newRange[0].toString() :
      `${newRange[0]}-${newRange[1]}`;
    onChange(rangeString);
  };

  const handleMinInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    const numValue = parseFloat(newValue);

    if (newValue === '' || (!isNaN(numValue) && numValue >= min && numValue <= max)) {
      const newRange: Range = [numValue || 0, rangeValue[1]];
      setRangeValue(newRange);
      handleRangeChange(newRange);
    }
  };

  const handleMaxInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    const numValue = parseFloat(newValue);

    if (newValue === '' || (!isNaN(numValue) && numValue >= min && numValue <= max)) {
      const newRange: Range = [rangeValue[0], numValue || max];
      setRangeValue(newRange);
      handleRangeChange(newRange);
    }
  };

  const handleClear = () => {
    const clearedRange: Range = [min, max];
    setRangeValue(clearedRange);
    onChange('');
  };

  const formatValue = (val: number | string): string => {
    if (val === '' || val === null || val === undefined) return '';

    const numVal = typeof val === 'string' ? parseFloat(val) : val;

    switch (filterKey) {
      case 'bounce_rate':
      case 'conversion_rate':
        return `${numVal}%`;
      case 'time_per_session':
        const minutes = Math.floor(numVal / 60);
        const seconds = numVal % 60;
        return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
      default:
        return numVal.toString();
    }
  };

  return (
    <div className="space-y-4">
      {/* Range Slider */}
      <div className="space-y-4">
        <RangeSliderInput
          min={min}
          max={max}
          value={rangeValue}
          onChange={handleRangeChange}
          formatValue={formatValue}
          label={__('Filter range', 'burst-statistics')}
          showLabels={true}
          showCurrentValue={true}
          rangeSeparator=" - "
        />

        {/* Number Inputs for Min/Max */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">
            {__('Exact range values', 'burst-statistics')}
          </label>
          <div className="flex space-x-2">
            <div className="flex-1">
              <TextInput
                type="number"
                value={rangeValue[0]}
                onChange={handleMinInputChange}
                placeholder={__('Min value...', 'burst-statistics')}
                min={min}
                max={max}
                className="w-full"
              />
              <p className="text-xs text-gray-500 mt-1">
                {__('Minimum value', 'burst-statistics')}
              </p>
            </div>
            <div className="flex-1">
              <TextInput
                type="number"
                value={rangeValue[1]}
                onChange={handleMaxInputChange}
                placeholder={__('Max value...', 'burst-statistics')}
                min={min}
                max={max}
                className="w-full"
              />
              <p className="text-xs text-gray-500 mt-1">
                {__('Maximum value', 'burst-statistics')}
              </p>
            </div>
            <button
              type="button"
              onClick={handleClear}
              className="px-3 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            >
              {__('Clear', 'burst-statistics')}
            </button>
          </div>
          <p className="text-xs text-gray-500">
            {__('Clear to remove this filter', 'burst-statistics')}
          </p>
        </div>
      </div>
    </div>
  );
};

export default IntFilterSetup; 