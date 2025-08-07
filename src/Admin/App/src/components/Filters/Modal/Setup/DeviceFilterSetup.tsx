import React, {useState, useEffect, useMemo} from 'react';
import { __ } from '@wordpress/i18n';
import clsx from 'clsx';
import Icon from '@/utils/Icon';
import useFiltersData from "@/hooks/useFiltersData";

interface FilterConfig {
  label: string;
  icon: string;
  type: string;
  pro?: boolean;
  options?: string;
}

interface DeviceFilterSetupProps {
  filterKey: string;
  config: FilterConfig;
  initialValue?: string;
  onChange: (value: string) => void;
}

interface DeviceOption {
  id: string;
  key: string;
  title: string;
}

const DeviceFilterSetup: React.FC<DeviceFilterSetupProps> = ({
                                                               filterKey,
                                                               config,
                                                               initialValue = '',
                                                               onChange
                                                             }) => {

  //@ts-ignore
  const { getFilterOptions } = useFiltersData();
  const [deviceOptions, setDeviceOptions] = useState<DeviceOption[]>([]);

  useEffect(() => {
    const fetchDeviceOptions = async () => {
        // Fetch device options from the filter data hook
        const options = await getFilterOptions('devices') || [];
        //@ts-ignore
        setDeviceOptions(options);
    }
    fetchDeviceOptions();
  }, []);

  // Parse initial value to get selected devices array
  const parseSelectedDevices = (value: string): string[] => {
    if (!value || value.trim() === '') return [];
    return value.split(',').map(v => v.trim().toLowerCase()).filter(Boolean);
  };

  const [selectedDevices, setSelectedDevices] = useState<string[]>(
    parseSelectedDevices(initialValue)
  );

  // Update parent when selectedDevices changes
  useEffect(() => {
    const newValue = selectedDevices.length > 0 ? selectedDevices.join(',') : '';
    onChange(newValue);
  }, [selectedDevices, onChange]);

  const handleDeviceToggle = (deviceKey: string) => {
    setSelectedDevices(prev => {
      if (prev.includes(deviceKey)) {
        // Remove device
        return prev.filter(d => d !== deviceKey);
      } else {
        // Add device
        return [...prev, deviceKey];
      }
    });
  };

  const handleDeviceKeyDown = (e: React.KeyboardEvent, deviceKey: string) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleDeviceToggle(deviceKey);
    }
  };

  const isSelected = (deviceKey: string): boolean => {
    return selectedDevices.includes(deviceKey);
  };

  const getAccessibleDescription = (device: DeviceOption): string => {
    const baseDescription = `${device.title} device filter`;
    const selectionState = isSelected(device.id)
      ? __('selected', 'burst-statistics')
      : __('not selected', 'burst-statistics');
    return `${baseDescription}, ${selectionState}`;
  };

  if ( !deviceOptions || deviceOptions.length === 0 ) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Device Options Grid */}
      <div
        className="grid grid-cols-2 md:grid-cols-4 gap-4 justify-items-center"
        role="group"
        aria-label={__('Device selection options', 'burst-statistics')}
      >
        {deviceOptions.map((device: DeviceOption) => {
          const selected = isSelected(device.id);

          return (
            <button
              key={device.id}
              onClick={() => handleDeviceToggle(device.id)}
              onKeyDown={(e) => handleDeviceKeyDown(e, device.id)}
              className={clsx(
                'relative rounded-lg border-2 p-4 transition-all duration-200 bg-white w-full group',
                'focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2',
                'hover:shadow-md',
                {
                  'border-primary bg-primary-light': selected,
                  'border-gray-300 hover:border-gray-400': !selected,
                }
              )}
              aria-label={getAccessibleDescription(device)}
              aria-pressed={selected}
              type="button"
            >
              {/* Selection Indicator */}
              {selected && (
                <div className="absolute top-2 right-2 z-10" aria-hidden="true">
                  <div className="h-2 w-2 rounded-full bg-primary"></div>
                </div>
              )}

              {/* Device Content */}
              <div className="flex flex-col items-center space-y-3">
                {/* Icon */}
                <div className={clsx(
                  'flex h-12 w-12 items-center justify-center rounded-lg transition-colors',
                  {
                    'bg-primary-light': selected,
                    'bg-gray-100 group-hover:bg-gray-200': !selected,
                  }
                )}
                     aria-hidden="true">
                  <Icon
                    name={device.key}
                    color="gray"
                    size={24}
                    aria-hidden="true"
                  />
                </div>

                {/* Label */}
                <div className="text-center">
                  <h3 className={clsx(
                    'text-sm font-medium transition-colors',
                    {
                      'text-gray-900': selected,
                      'text-gray-700': !selected,
                    }
                  )}>
                    {device.title}
                  </h3>
                </div>
              </div>

              {/* Checkbox visual indicator */}
              <div className="absolute bottom-2 left-2 z-10" aria-hidden="true">
                <div className={clsx(
                  'h-4 w-4 rounded border-2 transition-all duration-200 flex items-center justify-center',
                  {
                    'bg-primary border-primary': selected,
                    'bg-white border-gray-300 group-hover:border-gray-400': !selected,
                  }
                )}>
                  {selected && (
                    <Icon
                      name="check"
                      size={12}
                      color="white"
                      aria-hidden="true"
                    />
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default DeviceFilterSetup; 