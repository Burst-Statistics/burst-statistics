import React, { forwardRef, useEffect, useState } from "react";
import * as Slider from "@radix-ui/react-slider";
import { __ } from "@wordpress/i18n";

interface RangeSliderInputProps {
  min?: number;
  max?: number;
  step?: number;
  value?: [number, number];
  onChange?: (value: [number, number]) => void;
  formatValue?: (value: number) => string;
  className?: string;
  disabled?: boolean;
  label?: string;
  showLabels?: boolean;
  showCurrentValue?: boolean;
  allowSingleValue?: boolean;
  rangeSeparator?: string;
}

/**
 * Range slider input component using Radix Slider.
 * @param props - Props for the range slider component
 * @returns {JSX.Element} The rendered range slider element
 */
const RangeSliderInput = forwardRef<HTMLDivElement, RangeSliderInputProps>(
  ({
    min = 0,
    max = 100,
    step = 1,
    value = [min, max],
    onChange,
    formatValue = (val) => val.toString(),
    className = "",
    disabled = false,
    label,
    showLabels = true,
    showCurrentValue = true,
    allowSingleValue = false,
    rangeSeparator = " - ",
    ...props
  }, ref) => {
    const [localValue, setLocalValue] = useState<[number, number]>(value);

    useEffect(() => {
      setLocalValue(value);
    }, [value]);

    const handleValueChange = (newValue: number[]) => {
      const rangeValue: [number, number] = allowSingleValue && newValue.length === 1 
        ? [newValue[0], newValue[0]] 
        : [newValue[0], newValue[1]];
      
      setLocalValue(rangeValue);
      onChange?.(rangeValue);
    };

    const getCurrentValueText = () => {
      if (allowSingleValue && localValue[0] === localValue[1]) {
        return formatValue(localValue[0]);
      }
      return `${formatValue(localValue[0])}${rangeSeparator}${formatValue(localValue[1])}`;
    };

    const getSliderValue = () => {
      return allowSingleValue && localValue[0] === localValue[1] 
        ? [localValue[0]] 
        : localValue;
    };

    return (
      <div ref={ref} className={`space-y-3 ${className}`} {...props}>
        {label && (
          <label className="block text-sm font-medium text-gray-700">
            {label}
          </label>
        )}
        
        <div className="space-y-2">
          <Slider.Root
            className="relative flex items-center select-none touch-none w-full h-5"
            value={getSliderValue()}
            onValueChange={handleValueChange}
            min={min}
            max={max}
            step={step}
            disabled={disabled}
          >
            <Slider.Track className="bg-gray-200 relative grow rounded-full h-2">
              <Slider.Range className="absolute bg-primary rounded-full h-full" />
            </Slider.Track>
            
            <Slider.Thumb 
              className="block w-5 h-5 bg-white border-2 border-primary rounded-full shadow-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label={__('Minimum value', 'burst-statistics')}
            />
            
            {(!allowSingleValue || localValue[0] !== localValue[1]) && (
              <Slider.Thumb 
                className="block w-5 h-5 bg-white border-2 border-primary rounded-full shadow-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label={__('Maximum value', 'burst-statistics')}
              />
            )}
          </Slider.Root>

          {showLabels && (
            <div className="flex justify-between text-xs text-gray-500">
              <span>{formatValue(min)}</span>
              {showCurrentValue && (
                <span className="font-medium text-primary">
                  {getCurrentValueText()}
                </span>
              )}
              <span>{formatValue(max)}</span>
            </div>
          )}
        </div>
      </div>
    );
  }
);

RangeSliderInput.displayName = "RangeSliderInput";

export default RangeSliderInput; 