import { useState, useEffect } from 'react';
import TextInput from "./TextInput";
import FieldWrapper from "./FieldWrapper";
import { __ } from '@wordpress/i18n';

const Email = ({
                   field,
                   onChange,
                   value,
               }) => {
    const [localValue, setLocalValue] = useState(value);

    // Update local value when prop changes
    useEffect(() => {
        setLocalValue(value);
    }, [value]);

    // Debounce the onChange callback
    useEffect(() => {
        const timer = setTimeout(() => {
            if (localValue !== value) {
                onChange(localValue);
            }
        }, 300); // 300ms debounce

        return () => clearTimeout(timer);
    }, [localValue, onChange, value]);

    return (
        <>
            <FieldWrapper inputId={field.id} label={field.label}>
                <TextInput
                    placeholder={__("Enter your e-mail address", "burst-statistics")}
                    type="email"
                    field={field}
                    onChange={(e) => setLocalValue(e.target.value)}
                    value={localValue}
                />
            </FieldWrapper>
        </>
    )
};

export default Email;