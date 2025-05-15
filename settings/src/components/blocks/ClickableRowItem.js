import {useFiltersStore} from '../../store/useFiltersStore';
import Icon from '../../utils/Icon';

export const ClickableRowItem = ( props ) => {
  const {page, id} = props;
  const setFilters = useFiltersStore( ( state ) => state.setFilters );

  const handleClick = ( e ) => {
    let id = e.target.attributes['data-page-id'].value;
    setFilters( 'page_id', parseInt( id ) );
  };

  return (
        <div className={'burst-clickable-row-item'} data-page-id={id} onClick={handleClick}>
          {page}
          <Icon name={'filter'} color={'black'} size={12}/>
        </div>
  );
};
