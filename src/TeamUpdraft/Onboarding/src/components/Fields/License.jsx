import TextInput from "./TextInput";
import FieldWrapper from "./FieldWrapper";
import { __ } from "@wordpress/i18n";
const License = ({
    field,
    onChange,
    value,
}) => {
    return (
        <>
            <FieldWrapper
                inputId={field.id}
                label={field.label}
            >
            <TextInput
                id={field.id}
                type="password"
                placeholder={__("Enter your license key here", "team-updraft")}
                value={value}
                onChange={(e) => onChange(e.target.value)}
            />
            </FieldWrapper>
        </>
    );
};

export default License;