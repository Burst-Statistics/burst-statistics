import License from './License';
import Checkbox from './Checkbox';
import TrackingTest from './TrackingTest';
import Email from './Email';
import Password from './Password';
import Plugins from './Plugins';
import { ErrorBoundary } from '../ErrorBoundary';
import useOnboardingStore from "@/store/useOnboardingStore";

/**
 * Fields component that renders different field types based on the field configuration
 * @param {Object} props Component props
 * @param {Array} props.fields Array of field configurations
 * @param {Function} props.onChange Callback function when field values change
 * @returns {JSX.Element|null} The rendered fields or null if no fields
 */
const Fields = ({ fields, onChange }) => {
    const {
        getValue,
        setValue,
        isEdited,
    } = useOnboardingStore();
    if (!fields) return null;

    const fieldComponents = {
        license: License,
        checkbox: Checkbox,
        tracking_test: TrackingTest,
        email: Email,
        plugins: Plugins,
        password: Password,
    };

    //the settings contain the values.
    return (
        <ErrorBoundary>
            {fields.map((field) => {
                let value = getValue(field.id);
                const isEditedField = isEdited(field.id);
                if ( !isEditedField && ( value === '' || value === undefined || value === false ) && field.default ) {
                    setValue(field.id, field.default);
                    value = field.default;
                }
                const Component = fieldComponents[field.type] || null;
                return Component
                    ? <Component key={field.id} field={field} onChange={(value) => onChange(field.id, value)} value={value} />
                    : null;
            })}
        </ErrorBoundary>
    );
};

export default Fields; 