import { useEffect, useState } from '@wordpress/element';
import * as ReactPopover from '@radix-ui/react-popover';
import {
  classificationOptions,
  metricOptions,
  useGeoStore
} from '@/store/useGeoStore';
import RadioInput from '@/components/Inputs/RadioInput';
import SwitchInput from '@/components/Inputs/SwitchInput';
import ButtonInput from '@/components/Inputs/ButtonInput';
import { __ } from '@wordpress/i18n';
import Icon from '@/utils/Icon';

const UnifiedMapPopover = () => {
  const [ isOpen, setIsOpen ] = useState( false );

  // Get state and actions from store
  const selectedMetric = useGeoStore( ( state ) => state.selectedMetric );
  const setSelectedMetric = useGeoStore( ( state ) => state.setSelectedMetric );
  const patternsEnabled = useGeoStore( ( state ) => state.patternsEnabled );
  const setPatternsEnabled = useGeoStore( ( state ) => state.setPatternsEnabled );
  const classificationMethod = useGeoStore(
    ( state ) => state.classificationMethod
  );
  const setClassificationMethod = useGeoStore(
    ( state ) => state.setClassificationMethod
  );
  const resetGeoToDefault = useGeoStore( ( state ) => state.resetGeoToDefault );
  const autoSelectOption = useGeoStore(
    ( state ) => state.autoSelectOption ?? true
  );
  const setAutoSelectOption = useGeoStore( ( state ) => state.setAutoSelectOption );

  // Pending state for changes before applying
  const [ pendingMetric, setPendingMetric ] = useState( selectedMetric );
  const [ pendingPatternsEnabled, setPendingPatternsEnabled ] =
    useState( patternsEnabled );
  const [ pendingClassificationMethod, setPendingClassificationMethod ] =
    useState( classificationMethod );

  // Update pending state when store values change
  useEffect( () => {
    setPendingMetric( selectedMetric );
    setPendingPatternsEnabled( patternsEnabled );
    setPendingClassificationMethod( classificationMethod );
  }, [ selectedMetric, patternsEnabled, classificationMethod ]);

  const handleApply = () => {
    setSelectedMetric( pendingMetric );
    setPatternsEnabled( pendingPatternsEnabled );
    if ( autoSelectOption ) {

      // Use recommended classification for the selected metric
      const recommended =
        metricOptions[pendingMetric]?.recommendedClassification || 'quantile';
      setClassificationMethod( recommended );
    } else {
      setClassificationMethod( pendingClassificationMethod );
    }
    setIsOpen( false );
  };

  const handleResetToDefaults = () => {

    // Reset to default values
    const defaultMetric =
      Object.keys( metricOptions ).find( ( key ) => metricOptions[key].default ) ||
      'visitors';
    setPendingMetric( defaultMetric );
    setPendingPatternsEnabled( false );
    setPendingClassificationMethod( 'quantile' );
    setAutoSelectOption( true );

    // Apply the defaults immediately
    setSelectedMetric( defaultMetric );
    setPatternsEnabled( false );
    const recommended =
      metricOptions[defaultMetric]?.recommendedClassification || 'quantile';
    setClassificationMethod( recommended );
    resetGeoToDefault();
    setIsOpen( false );
  };

  // Update classification when metric changes and auto is enabled
  useEffect( () => {
    if ( autoSelectOption && pendingMetric ) {
      const recommended =
        metricOptions[pendingMetric]?.recommendedClassification || 'quantile';
      setPendingClassificationMethod( recommended );
    }
  }, [ pendingMetric, autoSelectOption ]);

  const handleClassificationChange = ( value ) => {
    setAutoSelectOption( false );
    setPendingClassificationMethod( value );
  };

  const handleAutoToggle = ( enabled ) => {
    setAutoSelectOption( enabled );
    if ( enabled ) {
      const recommended =
        metricOptions[pendingMetric]?.recommendedClassification || 'quantile';
      setPendingClassificationMethod( recommended );
    }
  };

  const handleBack = () => {
    navigateBack();
    setIsOpen( false );
  };

  const openOrClosePopover = ( open ) => {
    if ( open ) {
      setIsOpen( true );
    } else {
      setIsOpen( false );

      // Reset pending values to current store values when closing without applying
      setPendingMetric( selectedMetric );
      setPendingPatternsEnabled( patternsEnabled );
      setPendingClassificationMethod( classificationMethod );
    }
  };

  return (
    <ReactPopover.Root open={isOpen} onOpenChange={openOrClosePopover}>
      <ReactPopover.Trigger
        className={`${isOpen ? 'bg-gray-400 shadow-lg' : 'bg-gray-300'} focus:ring-blue-500 cursor-pointer rounded-full p-3 transition-all duration-200 hover:bg-gray-400 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-offset-2`}
        onClick={() => setIsOpen( ! isOpen )}
        title={__( 'Metrics & options', 'burst-statistics' )}
      >
        <Icon name="filter" size={16} />
      </ReactPopover.Trigger>

      <ReactPopover.Portal container={document.querySelector( '.burst' )}>
        <ReactPopover.Content
          className="z-50 min-w-[320px] max-w-[400px] rounded-lg border border-gray-200 bg-white p-0 shadow-xl"
          align="end"
          sideOffset={10}
          arrowPadding={10}
        >
          <ReactPopover.Arrow className="fill-white drop-shadow-sm" />

          <div className="border-b border-gray-100 px-4 py-3">
            <h5 className="m-0 text-base font-semibold text-black">
              {__( 'Metrics & options', 'burst-statistics' )}
            </h5>
          </div>

          <div className="max-h-[80vh] overflow-y-auto px-4 py-4">
            {/* Metric Selection Section */}
            <div className="mb-6">
              <label className="mb-3 block text-sm font-medium text-gray">
                {__( 'Select metric', 'burst-statistics' )}
              </label>
              <div className="flex flex-col">
                {Object.entries( metricOptions ).map( ([ value, config ]) => (
                  <RadioInput
                    key={value}
                    id={`metric_${value}`}
                    name="metric_selection"
                    value={value}
                    label={config.label}
                    checked={pendingMetric === value}
                    onChange={setPendingMetric}
                  />
                ) )}
              </div>
            </div>

            {/* Classification Method Section */}
            <div className="mb-6">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <label className="block text-sm font-medium text-gray">
                    {__( 'Classification method', 'burst-statistics' )}
                  </label>

                  <Icon
                    color="blue"
                    name="help"
                    size={16}
                    className="rounded-full bg-blue-light"
                    tooltip={__(
                      'A classification method determines how data values are grouped into ranges or categories to color regions on a choropleth map. The recommended method is based on the selected metric. For more information for each method, see the help icon next to each method.',
                      'burst-statistics'
                    )}
                  />
                </div>

                <div className="flex items-center gap-2 rounded-full border border-gray-200 bg-gray-100 px-2 py-1">
                  <label htmlFor="auto-select" className="text-sm text-gray">
                    {__( 'Auto-select', 'burst-statistics' )}
                  </label>
                  <SwitchInput
                    id="auto-select"
                    value={autoSelectOption}
                    onChange={handleAutoToggle}
                    size="small"
                  />
                </div>
              </div>

              <div className="flex flex-col">
                {Object.entries( classificationOptions ).map(
                  ([ value, config ]) => {
                    const recommended =
                      metricOptions[pendingMetric]
                        ?.recommendedClassification === value;
                    const isSelected = autoSelectOption ?
                      recommended :
                      pendingClassificationMethod === value;
                    return (
                      <div
                        key={value}
                        className={`mb-1 flex items-center gap-2 ${autoSelectOption ? 'opacity-90' : ''}`}
                      >
                        <RadioInput
                          id={`classification_${value}`}
                          name="classification_method"
                          value={value}
                          label={config.label}
                          checked={isSelected}
                          onChange={() => handleClassificationChange( value )}
                          tooltip={config.description}
                          recommended={recommended}
                        />
                      </div>
                    );
                  }
                )}
              </div>
            </div>

            {/* Accessibility Section */}
            <div className="mb-6">
              <label className="mb-3 block text-sm font-medium text-gray">
                {__( 'Accessibility', 'burst-statistics' )}
              </label>
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="mb-1 text-sm text-black">
                    {__( 'Colorblind Patterns', 'burst-statistics' )}
                  </div>
                  <div className="text-xs text-gray">
                    {__(
                      'Add patterns for colorblind accessibility',
                      'burst-statistics'
                    )}
                  </div>
                </div>
                <SwitchInput
                  value={pendingPatternsEnabled}
                  onChange={setPendingPatternsEnabled}
                  size="default"
                />
              </div>
            </div>
          </div>

          <div className="rounded-b-lg border-t border-gray-100 bg-gray-50 px-4 py-3">
            <div className="space-y-2">
              <div className="flex gap-2">
                <ButtonInput
                  onClick={handleApply}
                  btnVariant="primary"
                  size="sm"
                  className="flex-1"
                >
                  {__( 'Apply', 'burst-statistics' )}
                </ButtonInput>
                <ButtonInput
                  onClick={handleResetToDefaults}
                  btnVariant="tertiary"
                  size="sm"
                  className="flex-1"
                >
                  {__( 'Reset to defaults', 'burst-statistics' )}
                </ButtonInput>
              </div>
            </div>
          </div>
        </ReactPopover.Content>
      </ReactPopover.Portal>
    </ReactPopover.Root>
  );
};

export default UnifiedMapPopover;
