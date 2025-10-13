import type { FC } from '@wordpress/element';
import type {SettingField, Step} from "../../types";
import {memo} from "@wordpress/element";
import Premium from "./Premium";
import Fields from "../Fields/Fields";
const ModalContent: FC<{
    step: Step,
    settings: SettingField[],
    onFieldChange: (fieldId: string, value: string | boolean) => void
}> = memo(({ step, settings, onFieldChange }: {
    step: Step,
    settings: SettingField[],
    onFieldChange: (fieldId: string, value: string | boolean) => void
}) => (
    <div className="space-y-2 max-w-[70ch] mx-auto flex flex-col gap-2">
        <p className="text-gray-600 text-lg leading-relaxed font-light text-center">
            {step.subtitle}
        </p>
        <Premium bullets={step.bullets || []} stepId={step.id} />
        <Fields
            fields={step.fields || []}
            onChange={onFieldChange}
        />
    </div>
));
export default ModalContent;