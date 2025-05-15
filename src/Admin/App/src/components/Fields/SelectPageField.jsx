import React, {useState} from 'react';
import AsyncSelect from 'react-select/async';
import { useQuery } from '@tanstack/react-query';
import Icon from '../../utils/Icon';
import { formatNumber } from '../../utils/formatting';
import debounce from 'lodash/debounce';
import usePostsStore from '../../store/usePostsStore';
import {useEffect} from 'react';

import { forwardRef } from 'react';
import SelectInput from '@/components/Inputs/SelectInput';
import FieldWrapper from '@/components/Fields/FieldWrapper';

/**
 * SelectField component
 *
 * @param {object} field - Provided by react-hook-form's Controller.
 * @param {object} fieldState - Contains validation state.
 * @param {string} label - Field label.
 * @param {string} help - Help text for the field.
 * @param {string} context - Contextual information for the field.
 * @param {string} className - Additional Tailwind CSS classes.
 * @param {object} props - Additional props (including options array).
 * @returns {JSX.Element}
 */
const SelectPageField = forwardRef(
  ({ field, fieldState, label, help, context, className, ...props }, ref ) => {
    const inputId = props.id || field.name;

    const {
        fetchPosts
    } = usePostsStore();
  const [ search, setSearch ] = useState( '' );

  const posts = useQuery({
      queryKey: [ 'defaultPosts', search ],
      queryFn: () => fetchPosts( search )
  });

  // Load options function with debounce
  const loadOptions = debounce( async( input, callback ) => {
        setSearch( input );
        let data = await fetchPosts( input );
        callback( data );
  }, 500 );


  return (
    <FieldWrapper
      label={label}
      help={help}
      error={fieldState?.error?.message}
      context={context}
      className={className}
      inputId={inputId}
      required={props.required}
    >
        <AsyncSelect
            classNamePrefix="burst-select"
            onChange={( e ) => {
              props.onChange( e.value );
            }}
            isLoading={posts.isLoading}
            isSearchable={true}
            name="selectPage"
            cacheOptions
            defaultValue={field.value}
            defaultInputValue={field.value}
            defaultOptions={posts.data || []}
            loadOptions={loadOptions}
            components={{ Option: OptionLayout }}
            theme={( theme ) => ({
              ...theme,
              borderRadius: 'var(--rsp-border-radius-input)',
              colors: {
                ...theme.colors,
                text: 'orangered',
                primary25: 'var(--rsp-green-faded)',
                primary: 'var(--rsp-green)'
              }
            })}
            createOptionPosition={'none'}
            styles={{
              control: ( baseStyles, state ) => ({
                ...baseStyles,
                borderColor: state.isFocused ?
                    'var(--rsp-green)' :
                    'var(--rsp-input-border-color)'
              })
            }}
        />
        </FieldWrapper>
  );
});

export default SelectPageField;


// Option layout component
const OptionLayout = ({ innerProps, innerRef, data }) => {
  const r = data;
  return (
      <article ref={innerRef} {...innerProps} className={'burst-select__custom-option'}>
        <div>
          <h6 className={'burst-select__title'}>{r.label}</h6>
          {'Untitled' !== r.post_title && <><span> - </span><p className={'burst-select__subtitle'}>{r.post_title}</p></>}
        </div>
        {0 < r.pageviews && <div className={'burst-select__pageview-count'}>
          <Icon name={'eye'} size={12}/>
          <span>{ formatNumber( r.pageviews ) }</span>
        </div>}
      </article>
  );
};
