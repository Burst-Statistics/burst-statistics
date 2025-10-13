import TextInput from "./TextInput";
import FieldWrapper from "./FieldWrapper";
import { __ } from '@wordpress/i18n';

const Email = ({
    field,
    onChange,
    value,
}) => {

    return (
        <>
            <FieldWrapper inputId={field.id} label={field.label}>
                <TextInput placeholder={__("Enter your e-mail address", "burst-statistics")} type="email" field={field} onChange={(e) => onChange(e.target.value)} value={value} />
            </FieldWrapper>
        </>
    )
};

export default Email;