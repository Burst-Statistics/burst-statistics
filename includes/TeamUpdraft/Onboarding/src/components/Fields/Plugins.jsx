import FieldWrapper from "./FieldWrapper";
import {__} from "@wordpress/i18n";
import * as Checkbox from "@radix-ui/react-checkbox";
import Icon from "@/utils/Icon";

const Plugins = ({
    field,
    onChange,
    value,
}) => {
    // Convert array of objects to Record<string, string>
    // convert value to array if not already

    // Convert incoming value to an array if not already one
    let valueValidated = value;
    if (!Array.isArray(valueValidated)) {
        valueValidated = valueValidated === '' ? [] : [valueValidated];
    }

    const selected = Array.isArray(valueValidated) ? valueValidated : [];

    /**
     * Handles a change on an individual checkbox.
     * For boolean mode, simply toggles the value.
     * Otherwise, adds or removes the selected option.
     */
    const handleCheckboxChange = (_checked, option) => {
        const newSelected = selected.includes('' + option) || selected.includes(parseInt(option))
            ? selected.filter((item) => item !== '' + option && item !== parseInt(option))
            : [...selected, option];
        onChange(newSelected);

    };

    let options = Object.values(field.options) || [];

    /**
     * Determines if an option is considered checked.
     */
    const isEnabled = (optionId) => {
        return selected.includes('' + optionId) || selected.includes(parseInt(optionId));
    };

    if (Object.keys(options).length === 0) {
        return <>{__('No options found', 'burst-statistics')}</>;
    }
    return (
        <FieldWrapper inputId={field.id} label={field.label}>
            <div className="flex flex-col space-y-2">
                {options.map((option) => {
                    const key = option.id || option.value;
                    const label = option.title || key;
                    const isInstalled = option.action === 'installed' || option.action === 'upgrade-to-pro' ;
                    return (
                    <div
                        key={key}
                        className="flex items-center"
                    >
                        <Checkbox.Root
                            className={`w-4 h-4 border border-gray-400 rounded flex-shrink-0
                                        ${isInstalled ? 'bg-gray-500 cursor-not-allowed' : 'bg-white'}`}
                            id={`${field.id}_${key}`}
                            checked={isEnabled(key)}
                            aria-label={label}
                            disabled={isInstalled}
                            onCheckedChange={(checked) => handleCheckboxChange(!!checked, key)}
                        >
                            <Checkbox.Indicator className="flex items-center justify-center">
                            <Icon
                                name="check"
                                size={14}
                                color={isInstalled ? "white" : "blue" }
                                strokeWidth={3} 
                                tooltip=""
                                onClick={() => {}}
                                className=""
                                />
                            </Checkbox.Indicator>
                        </Checkbox.Root>
                        <label className={`ml-2 flex ${isInstalled ? 'cursor-not-allowed' : ''}`} htmlFor={`${field.id}_${key}`}>
                            <div className="mr-2">{}{label}</div>
                        </label>
                        { isInstalled && <>
                                <Icon name="circle-check" color="green" size="18" strokeWidth={2.5} tooltip={__('Already installed', 'burst-statistics')}/>
                            </>}
                    </div>
                )
                }
            )}
            </div>
        </FieldWrapper>
    );
};

export default Plugins;