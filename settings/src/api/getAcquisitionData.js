import {getData} from '../utils/api';

const getAcquisitionData = async({type, startDate, endDate, range, args}) => {
  const { data } = await getData(
      type,
      startDate,
      endDate,
      range,
      args
  );

  return data;
};
export default getAcquisitionData;
