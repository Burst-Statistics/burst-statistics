import FieldWrapper from "@/components/Fields/FieldWrapper";
import CheckboxInput from "@/components/Fields/CheckboxInput";
import { __ } from "@wordpress/i18n";
import {get_website_url} from "@/utils/lib.js";
import useOnboardingStore from "@/store/useOnboardingStore";

const Checkbox = ({
    field,
    onChange,
    value,
}) => {

    const {
        onboardingData,
    } = useOnboardingStore();

    const privacy_statement = get_website_url(onboardingData.privacy_statement_url, {
        utm_source: onboardingData.prefix + '_onboarding',
        utm_content: 'mailing-list'
    });
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
                    <a rel="noopener noreferrer nofollow" className="underline" href={privacy_statement}>{__("Privacy Statement", "burst-statistics") }</a>
                </div>
            )}

        </FieldWrapper>
    );
};

export default Checkbox;