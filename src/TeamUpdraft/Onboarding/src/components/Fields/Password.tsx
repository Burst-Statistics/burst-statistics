import TextInput from "./TextInput";
import FieldWrapper from "./FieldWrapper";
import {InputHTMLAttributes} from "react";
interface TextInputProps extends InputHTMLAttributes<HTMLInputElement> {
    type?: string;
}
const Password = ({
                   field,
                   onChange,
                   value,
               }) => {

    return (
        <>
            <FieldWrapper inputId={field.id} label={field.label}>
                <TextInput type="password" onChange={(e) => onChange(e.target.value)} value={value} />
            </FieldWrapper>
        </>
    )
};

export default Password;