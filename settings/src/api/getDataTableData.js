import { getData } from '../utils/api';
import {
  formatPercentage,
  formatTime,
  getCountryName
} from '../utils/formatting';
import ClickToFilter from '../components/blocks/ClickToFilter';
import Flag from '../components/blocks/Flag';
import {safeDecodeURI} from '../utils/lib';

export const transformDataTableData = ( response, columnOptions ) => {

  // Update columns
  response.columns = response.columns.map( ( column ) => {

    //@todo fix "right" as boolean value warning
    let rightValue = 'left' !== columnOptions[column.id]?.align;
    const format = columnOptions[column.id]?.format || 'integer';
    const updatedColumn = {
      ...column,
      selector: ( row ) => row[column.id],
      right: rightValue
    };

    // add sort function if percentage or time or integer
    if ( 'percentage' === format || 'time' === format || 'integer' === format ) {
      updatedColumn.sortFunction = ( rowA, rowB ) => {
        const numA = parseFloat( rowA[column.id]);
        const numB = parseFloat( rowB[column.id]);
        return numA - numB;
      };
    }

    // Define a cell rendering function based on the format
    const formatCell = ( value, row ) => {
      switch ( format ) {
        case 'percentage':
          return formatPercentage( value );
        case 'time':
          return formatTime( value );
        case 'country':
          return (
              <ClickToFilter filter={column.id} filterValue={value}>
                <Flag country={value} countryNiceName={getCountryName( value )} />
              </ClickToFilter>
          );
        case 'url':
          return (
              <ClickToFilter filter={column.id} filterValue={value}>
                {safeDecodeURI( value )}
              </ClickToFilter>
          );
        case 'text':
          return value;
        case 'integer':
          return parseInt( value, 10 );
        default:
          return value;
      }
    };

    updatedColumn.cell = ( row ) => formatCell( row[column.id], row );

    return updatedColumn;
  });

  return response;
};

const getDataTableData = async({
  startDate,
  endDate,
  range,
  args,
  columnsOptions
}) => {
  try {
    const { data } = await getData( 'datatable', startDate, endDate, range, args );
    return transformDataTableData( data, columnsOptions );
  } catch ( error ) {
    console.error( 'Error fetching data table data:', error );
  }
};

export default getDataTableData;
