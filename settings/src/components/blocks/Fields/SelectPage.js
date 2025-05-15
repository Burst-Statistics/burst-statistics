import React, {useRef, useState} from '@wordpress/element';
import AsyncSelect from 'react-select/async';
import { useQuery } from '@tanstack/react-query';
import Icon from '../../../utils/Icon';
import { formatNumber } from '../../../utils/formatting';
import debounce from 'lodash/debounce';
import usePostsStore from '../../../store/usePostsStore';
import {useEffect} from 'react';

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

// Main SelectPage component
const SelectPage = ({ value, onChangeHandler, field }) => {
    const {
        fetchPosts,
        fetching
    } = usePostsStore();
  const [ search, setSearch ] = useState( '' );

  const posts = useQuery(
      [ 'defaultPosts', search ],
      () => fetchPosts( search )
  );

  // Load options function with debounce
  const loadOptions = debounce( async( input, callback ) => {
        setSearch( input );
        let data = await fetchPosts( input );
        callback( data );
  }, 500 );


  return (
      <>
        <p className={'burst-label'}>{field.label}</p>
        <AsyncSelect
            classNamePrefix="burst-select"
            onChange={( e ) => {
             onChangeHandler( e.value );
            }}
            isLoading={posts.isLoading}
            isSearchable={true}
            name="selectPage"
            cacheOptions
            defaultValue={value}
            defaultInputValue={value}
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
      </>
  );
};

export default SelectPage;
