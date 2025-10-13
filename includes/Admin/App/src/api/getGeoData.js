import { getData } from "../utils/api";

/**
 * Get geo analytics data
 * @param {Object} params - Request parameters
 * @param {string} params.startDate - Start date for analytics
 * @param {string} params.endDate - End date for analytics
 * @param {Object} params.args - Additional arguments
 * @param {Array} params.args.metrics - Metrics to fetch (e.g., ["pageviews", "visitors"])
 * @param {string} params.args.level - Map level (world, continent, country)
 * @param {string} params.args.id - ID of the region (null for world, continent ID, or country ID)
 * @returns {Promise<Array>} - Formatted data for map visualization
 */
const getGeoData = async ({ startDate, endDate, range, args }) => {
  try {
    const { data } = await getData("geo", startDate, endDate, range, args);

    // if args.currentView.level is 'country', then we need to remove the data with an empty state_code
    // if (args.currentView.level === 'country') {
    //   data = data.filter(item => item.state_code !== '');
    // }

    return data;
    // Process data for choropleth visualization
    // Each item should have an 'id' field that matches the feature ID in your GeoJSON
    // and a 'value' field for the metric you want to visualize
    // return data.map(item => ({
    //   id: item.region_code, // Match with your feature identifiers (e.g., ISO codes)
    //   value: item.value,
    //   // Add any additional data needed for tooltips or interactions
    //   name: item.name || '',
    //   extraData: item.extraData || {}
    // }));
  } catch (error) {
    console.error("Error fetching geo data:", error);
    return [];
  }
};

export default getGeoData;
