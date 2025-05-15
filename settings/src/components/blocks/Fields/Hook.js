import { __ } from '@wordpress/i18n';
import {useState, useEffect} from '@wordpress/element';
import TextInput from './TextInput';
import {useGoalsStore} from '../../../store/useGoalsStore';

const Hook = ({ field, goal, label, help, value, onChangeHandler }) => {
    const { setGoalValue } = useGoalsStore();
    const handleTextInputChange = ( value ) => {
        setGoalValue( goal.id, 'hook', value );
    };

    return (
        <>
            <TextInput value={value} onChangeHandler={( value ) => handleTextInputChange( value ) } field={field} label={__( 'What is the hook name?', 'burst-statistics' ) } />
        </>
    );
};

export default Hook;
