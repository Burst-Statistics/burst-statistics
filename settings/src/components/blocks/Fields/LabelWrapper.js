import {__} from '@wordpress/i18n';
import Icon from '../../../utils/Icon';
import Pro from './Pro';
const LabelWrapper = ({field}) => {
    let id = field.id;
    let label = field.label;
    let tooltip = field.tooltip;
    let pro = field.pro;
    let required = field.required;
    let type = field.type;
    if ( ! label || 0 === label.length ) {
return null;
}
    return (
        <div className={'burst-label-container '}>
            <label htmlFor={id}>
                {label}
                {required && 'radio' !== type && 'document' !== type && <span className="burst-required">
                    {__( 'required', 'burst-statistics' )}
                    </span>
                }
            </label>
            {tooltip && <Icon name="help" size={14} tooltip={tooltip}/> }
            <Pro pro={pro} id={id}/>
        </div>
    );
};
export default LabelWrapper;

