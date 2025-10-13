import React from "react";
import * as Select from "@radix-ui/react-select";
import {clsx} from "clsx";
import Icon from "../../utils/Icon";

interface SelectOption {
    value: string;
    label: string;
}

type OptionsType = SelectOption[] | Record<string, string>;

interface SelectInputProps {
    value: string;
    onChange: (value: string) => void;
    options?: OptionsType;
}

/**
 * Converts options object or array to array of SelectOption
 */
const normalizeOptions = (options: OptionsType = []): SelectOption[] => {
    if (Array.isArray(options)) {
        return options;
    }
    
    return Object.entries(options).map(([value, label]) => ({
        value,
        label: String(label)
    }));
};

/**
 * Styled select input component
 * @param props - Props for the select component
 * @returns {JSX.Element} The rendered select component
 */
const SelectInput = React.forwardRef<HTMLButtonElement, SelectInputProps>(
    ({value, onChange, options = []}, ref) => {
        const normalizedOptions = normalizeOptions(options);
        
        return (
            <Select.Root value={value} onValueChange={(value) => onChange(value)}>
                <Select.Trigger
                    ref={ref}
                    className="inline-flex items-center justify-center gap-1 rounded bg-white text-base leading-none outline outline-gray-400 px-2 py-2 hover:bg-gray-100 focus:shadow-[0_0_0_2px]"
                >
                    <Select.Value placeholder="Select an option…"/>
                    <Select.Icon className="text-base">
                        <Icon 
                            name="chevron-down" 
                            color="black" 
                            size={16}
                            tooltip=""
                            onClick={() => {}}
                            className=""
                        />
                    </Select.Icon>
                </Select.Trigger>

                <Select.Content
                    className="bg-gray-100 text-black border border-gray-400 rounded-md shadow-lg ring-1 ring-black/5 overflow-hidden z-10 shadow-gray-400/50"
                    position="item-aligned"
                    // side="bottom"
                    // align="end"
                    // sideOffset={5}
                >
                    <Select.ScrollUpButton
                        className="">
                        <Icon 
                            name="chevron-up" 
                            color="black" 
                            size={16}
                            tooltip=""
                            onClick={() => {}}
                            className=""
                        />
                    </Select.ScrollUpButton>
                    <Select.Viewport className="">
                        {normalizedOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                                {option.label}
                            </SelectItem>
                        ))}
                    </Select.Viewport>
                    <Select.ScrollDownButton
                        className="text-base">
                        <Icon 
                            name="chevron-down" 
                            color="white" 
                            size={16}
                            tooltip=""
                            onClick={() => {}}
                            className=""
                        />
                    </Select.ScrollDownButton>
                </Select.Content>
            </Select.Root>
        );
    },
);

export default SelectInput;

interface SelectItemProps
    extends React.ComponentPropsWithoutRef<typeof Select.Item> {
    children: React.ReactNode;
    className?: string;
}

/**
 * Styled select item component
 * @param props - Props for the select item component
 * @returns {JSX.Element} The rendered select item component
 */
const SelectItem = React.forwardRef<HTMLDivElement, SelectItemProps>(
    ({children, className, ...props}, ref) => {
        return (
            <Select.Item
                ref={ref}
                className={clsx(
                    "cursor-default px-2 py-2 text-base select-none flex items-center gap-1 flex-row overflow-hidden",
                    "hover:bg-gray-300 hover:text-black",
                    "focus:bg-gray-300",
                    "transition-all duration-200",
                    className,
                )}
                {...props}
            >
                <div className="w-4 flex items-center">
                <Select.ItemIndicator>
                    <Icon 
                        name="check" 
                        color="black" 
                        size={16}
                        tooltip=""
                        onClick={() => {}}
                        className=""
                    />
                </Select.ItemIndicator>
                </div>
                <Select.ItemText>{children}</Select.ItemText>
                <div className="w-4 flex items-center"></div>
                
            </Select.Item>
        );
    },
);
