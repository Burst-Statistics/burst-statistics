import FieldWrapper from "@/components/Fields/FieldWrapper";
import CheckboxInput from "@/components/Fields/CheckboxInput";
import { __ } from "@wordpress/i18n";

const Checkbox = ({
    field,
    onChange,
    value,
}) => {
    return (

        <FieldWrapper label={''} inputId={field.id}>
            <CheckboxInput
                label={field.label}
                onChange={onChange}
                value={value}
                id={field.id}
            />

            {field.show_privacy_link && (
                <div className="text-right">
                    <a rel="noopener noreferrer nofollow" className="underline" href={teamupdraft_onboarding.privacy_statement_url}>{__("Privacy Statement", "burst-statistics") }</a>
                </div>
            )}

        </FieldWrapper>
    );
};

export default Checkbox;