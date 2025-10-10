import React, {useState} from 'react';
import { useQuery } from '@tanstack/react-query';
import Icon from '../../utils/Icon';
import { formatNumber } from '../../utils/formatting';
import debounce from 'lodash/debounce';
import usePostsStore from '../../store/usePostsStore';
import {useEffect} from 'react';

import { forwardRef } from 'react';
import AsyncSelectInput from '@/components/Inputs/AsyncSelectInput';
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
    const inputId = props.id || field?.name;
;
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
      recommended={props.recommended}
      disabled={props.disabled}
      {...props}
    >
        <AsyncSelectInput
            onChange={( e ) => {
              props.onChange( e.value );
            }}
            isLoading={posts.isLoading}
            name="selectPage"
            value={field?.value}
            defaultInputValue={field?.value}
            defaultOptions={posts.data || []}
            loadOptions={loadOptions}
            components={{ Option: OptionLayout }}
        />
        </FieldWrapper>
  );
});

export default SelectPageField;


// Option layout component
const OptionLayout = ({ innerProps, innerRef, data }) => {
  const r = data;
  return (
      <article 
        ref={innerRef} 
        {...innerProps} 
        className="flex items-center justify-between p-2 hover:bg-gray-100 cursor-pointer transition-colors duration-200"
      >
        <div className="flex items-center">
          <h6 className="text-sm font-medium text-black">{r.label}</h6>
          {'Untitled' !== r.post_title && (
            <>
              <span className="mx-2 text-gray-500"> - </span>
              <p className="text-sm text-gray-600">{r.post_title}</p>
            </>
          )}
        </div>
        {0 < r.pageviews && (
          <div className="flex items-center gap-1 text-xs text-gray-500">
            <Icon name={'eye'} size={12}/>
            <span>{formatNumber(r.pageviews)}</span>
          </div>
        )}
      </article>
  );
};
