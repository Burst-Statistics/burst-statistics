import {memo} from "@wordpress/element";
import Icon from "../../utils/Icon";
import { __ } from '@wordpress/i18n';
import * as Checkbox from '@radix-ui/react-checkbox';

interface CheckboxInputProps {
  label: string;
  value: boolean;
  id: string;
  onChange: (value: boolean) => void;
  required?: boolean;
  disabled?: boolean;
}

const CheckboxInput: React.FC<CheckboxInputProps> = ({
                                                       label,
                                                       value,
                                                       id,
                                                       onChange,
                                                       required,
                                                       disabled,
                                                     }) => {
  return (
      <div className="flex flex-col space-y-1">
        <div className="flex items-center gap-2">
            <Checkbox.Root
                className="w-4 h-4 border border-gray-400 bg-white rounded flex-shrink-0 disabled:opacity-50"
                id={id}
                checked={!!value}
                aria-label={label}
                disabled={disabled}
                onCheckedChange={(checked) => onChange(!!checked)}
            >
                <Checkbox.Indicator className="flex items-center justify-center">
                    <Icon
                      name="check"
                      size={14}
                      color="blue"
                      strokeWidth={3} 
                      tooltip=""
                      onClick={() => {}}
                      className=""
                    />
                </Checkbox.Indicator>
            </Checkbox.Root>
          <label htmlFor={id} className="font-normal text-md flex items-center gap-1">
            <span className="text-gray-500 font-semibold">{label}</span>
          </label>
        </div>
      </div>
  );
};

export default memo(CheckboxInput);