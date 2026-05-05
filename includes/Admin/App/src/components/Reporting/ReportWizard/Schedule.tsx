import {__} from '@wordpress/i18n';
import React, {useMemo} from 'react';
import SelectInput from '@/components/Inputs/SelectInput';
import {useWizardStore} from '@/store/reports/useWizardStore';
import {useReportConfigStore} from '@/store/reports/useReportConfigStore';
import {DayOfWeekType, FrequencyType, WeekOfMonthType} from '@/store/reports/types';
import RadioButtonsInput, {RadioOption} from '@/components/Inputs/RadioButtonsInput';
import FieldWrapper from '@/components/Fields/FieldWrapper';
import {DateRangePicker} from '@/components/Inputs/DateRangePicker';

export const Schedule = () => {
    const scheduled = useWizardStore( ( state ) => state.wizard.scheduled );
    const setScheduled = useWizardStore( ( state ) => state.setScheduled );

    const frequency = useWizardStore( ( state ) => state.wizard.frequency );
    const setFrequency = useWizardStore( ( state ) => state.setFrequency );

    const dayOfWeek = useWizardStore( ( state ) => state.wizard.dayOfWeek );
    const setDayOfWeek = useWizardStore( ( state ) => state.setDayOfWeek );

    const weekOfMonth = useWizardStore( ( state ) => state.wizard.weekOfMonth );
    const setWeekOfMonth = useWizardStore( ( state ) => state.setWeekOfMonth );

    const sendTime = useWizardStore( ( state ) => state.wizard.sendTime );
    const setSendTime = useWizardStore( ( state ) => state.setSendTime );

    const reportDateRange = useWizardStore( ( state ) => state.wizard.reportDateRange );
    const setDateRange = useWizardStore( ( state ) => state.setDateRange );
    const getParsedDateRangeValue = useWizardStore( ( state ) => state.getParsedDateRangeValue );

    const frequencyOptions = useReportConfigStore( ( state ) => state.frequencyOptions );
    const dayOptions = useReportConfigStore( ( state ) => state.dayOptions );

    const getTimeOptions = useReportConfigStore( ( state ) => state.getTimeOptions );
    const getMonthlyWeekdayOptions = useReportConfigStore(
        ( state ) => state.getMonthlyWeekdayOptions
    );

    const timeOptions = getTimeOptions();

    // Need to convert number values to string for SelectInput component.
    const monthlyOptions = getMonthlyWeekdayOptions().map( ( option ) => ({
        value: '' + option.value,
        label: option.label
    }) );


    const options: Record<string, RadioOption> = {};

    options.yes = {
        type: 'yes',
        label: __( 'Yes', 'burst-statistics' )
    };

    options.no = {
        type: 'no',
        label: __( 'No', 'burst-statistics' )
    };

    const parsedDateRangeValue = useMemo( () => {
        return getParsedDateRangeValue( reportDateRange as string );
    }, [ reportDateRange, getParsedDateRangeValue ]);

    return (
        <>
            <FieldWrapper
                label={__( 'Create a recurring scheduled report?', 'burst-statistics' )}
                inputId="report-scheduled"
                context={''}
            >

                <RadioButtonsInput value={scheduled ? 'yes' : 'no'} inputId="report-schedule" options={options}
                                   onChange={( value ) => setScheduled( 'yes' === value )}/>
            </FieldWrapper>

            {! scheduled && (
                <FieldWrapper
                    label={__( 'What date range do you want to report on?', 'burst-statistics' )}
                    inputId="report-date-range"
                    context={''}
                >
                    <DateRangePicker
                        value={parsedDateRangeValue}
                        align="start"
                        onChange={( range, startDate, endDate ) => {

                            // For custom ranges, encode as 'custom:startDate:endDate'.
                            const rangeValue = 'custom' === range ?
                                `custom:${startDate}:${endDate}` :
                                range;
                            setDateRange( rangeValue, -1 );
                        }}
                    />
                </FieldWrapper>
            )}

            {scheduled && (
                <FieldWrapper
                    label={__( 'Frequency', 'burst-statistics' )}
                    inputId="report-schedule"
                    context={''}
                >
                    <div className="flex flex-wrap items-center gap-3 text-sm">
						<span className="text-base font-semibold">
							{__( 'Deliver', 'burst-statistics' )}
						</span>

                        <SelectInput
                            value={frequency}
                            onChange={( value ) => {
                                if ( 'daily' === value ) {
                                    setDayOfWeek( undefined );
                                    setWeekOfMonth( undefined );
                                } else if ( 'weekly' === value ) {
                                    setWeekOfMonth( undefined );
                                    setDayOfWeek( 'monday' );
                                } else if ( 'monthly' === value ) {
                                    setWeekOfMonth( 1 );
                                    setDayOfWeek( 'monday' );
                                }

                                setFrequency( value as FrequencyType );
                            }}
                            options={frequencyOptions}
                        />

                        {
                            ( 'monthly' === frequency || 'weekly' === frequency ) && (
                                <span className="text-base font-semibold">
									{__( 'on every', 'burst-statistics' )}
								</span>
                            )
                        }

                        {
                            'monthly' === frequency && (
                                <SelectInput
                                    value={'' + weekOfMonth!}
                                    onChange={( value ) =>
                                        setWeekOfMonth( parseInt( value ) as WeekOfMonthType )
                                    }
                                    options={monthlyOptions}
                                />
                            )
                        }

                        {
                            'daily' !== frequency && (
                                <SelectInput
                                    value={dayOfWeek!}
                                    onChange={( value ) =>
                                        setDayOfWeek( value as DayOfWeekType )
                                    }
                                    options={dayOptions}
                                />
                            )
                        }

                        <span className="text-base font-semibold">
							{__( 'at', 'burst-statistics' )}
						</span>

                        <SelectInput
                            value={sendTime}
                            onChange={( value ) => setSendTime( value )}
                            options={timeOptions}
                        />
                    </div>

                </FieldWrapper>
            )}
        </>
    );
};

export default Schedule;
