import apiFetch from "@wordpress/api-fetch";
import { __ } from "@wordpress/i18n";
import { toast } from "react-toastify";

const usesPlainPermalinks = () => {
  return -1 !== burst_settings.site_url.indexOf("?");
};

const glue = () => {
  return usesPlainPermalinks() ? "&" : "?";
};

/**
 * Get nonce for burst api. Add random string so requests don't get cached
 * @returns {string}
 */
const getNonce = () => {
  return (
    "nonce=" +
    burst_settings.burst_nonce +
    "&token=" +
    Math.random()
      .toString(36)
      .replace(/[^a-z]+/g, "")
      .substr(0, 5)
  );
};

const generateError = (error, path = false) => {
  let message = __("Server error", "burst-statistics");
  error = error.replace(/(<([^>]+)>)/gi, "");

  if (path) {
    const urlWithoutQueryParams = path.split("?")[0];

    const urlParts = urlWithoutQueryParams.split("/");
    const index = urlParts.indexOf("v1") + 1;
    message =
      __("Server error in", "burst-statistics") +
      " " +
      urlParts[index] +
      "/" +
      urlParts[index + 1];
  }
  message += ": " + error;

  // wrap the message in a div react component and give it an onclick to copy
  // the text to the clipboard this way the user can easily copy the error
  // message and send it to us
  const messageDiv = (
    <div
      title={__("Click to copy", "burst-statistics")}
      onClick={() => {
        navigator.clipboard.writeText(message);
        toast.success(__("Error copied to clipboard", "burst-statistics"));
      }}
    >
      {message}
    </div>
  );

  toast.error(messageDiv, {
    autoClose: 15000,
  });
};

const makeRequest = async (path, method = "GET", data = {}) => {
  let args = {
    path,
    method,
  };

  if ("POST" === method) {
    data.nonce = burst_settings.burst_nonce;
    args.data = data;
  }


  return apiFetch(args)
    .then((response) => {
      if (!response.request_success) {
        throw new Error("invalid data error");
      }
      if (response.code) {
        throw new Error(response.message);
      }
      delete response.request_success;
      return response;
    })
    .catch((error) => {
      console.log(error);

      // If REST API fails, try AJAX request
      return ajaxRequest(method, path, data).catch(() => {
        // If AJAX also fails, generate error
        generateError(error.message, args.path);
        throw error;
      });
    });
};

const ajaxRequest = async (method, path, requestData = null) => {
  const url =
    "GET" === method
      ? `${siteUrl("ajax")}&rest_action=${path.replace("?", "&")}`
      : siteUrl("ajax");

  const options = {
    method,
    headers: { "Content-Type": "application/json; charset=UTF-8" },
  };

  if ("POST" === method) {
    options.body = JSON.stringify({ path, data: requestData }, stripControls);
  }

  try {
    const response = await fetch(url, options);
    if (!response.ok) {
      generateError(false, response.statusText);
      throw new Error(response.statusText);
    }

    const responseData = await response.json();

    if (
      !responseData.data ||
      !responseData.data.hasOwnProperty("request_success")
    ) {
      throw new Error("Invalid data error");
    }

    delete responseData.data.request_success;

    // return promise with the data object
    return Promise.resolve(responseData.data);
  } catch (error) {
    return Promise.reject(new Error("AJAX request failed"));
  }
};

/**
 * All data elements with 'Control' in the name are dropped, to prevent:
 * TypeError: Converting circular structure to JSON
 * @param key
 * @param value
 * @returns {any|undefined}
 */
const stripControls = (key, value) => {
  if (!key) {
    return value;
  }
  if (key && key.includes("Control")) {
    return undefined;
  }
  if ("object" === typeof value) {
    return JSON.parse(JSON.stringify(value, stripControls));
  }
  return value;
};

/**
 * if the site is loaded over https, but the site url is not https, force to
 * use https anyway, because otherwise we get mixed content issues.
 * @returns {*}
 */
const siteUrl = (type) => {
  let url;
  if ("undefined" === typeof type) {
    url = burst_settings.site_url;
  } else {
    url = burst_settings.admin_ajax_url;
  }
  if ("https:" === window.location.protocol && -1 === url.indexOf("https://")) {
    return url.replace("http://", "https://");
  }
  return url;
};

export const setOption = (option, value) =>
  makeRequest("burst/v1/options/set" + glue() + getNonce(), "POST", {
    option: { option, value },
  });

export const getFields = () =>
  makeRequest("burst/v1/fields/get" + glue() + getNonce());
export const setFields = (data) => {
  return makeRequest("burst/v1/fields/set" + glue(), "POST", { fields: data });
};

export const setGoals = (data) => {
  return makeRequest("burst/v1/goals/set" + glue() + getNonce(), "POST", data);
};

export const getGoals = () =>
  makeRequest("burst/v1/goals/get" + glue() + getNonce());
export const deleteGoal = (id) =>
  makeRequest("burst/v1/goals/delete" + glue() + getNonce(), "POST", {
    id: id,
  });
export const addGoal = () =>
  makeRequest("burst/v1/goals/add" + glue() + getNonce(), "POST", {});
export const addPredefinedGoal = (id) =>
  makeRequest("burst/v1/goals/add_predefined" + glue() + getNonce(), "POST", {
    id: id,
  });

export const getBlock = (block) =>
  makeRequest("burst/v1/block/" + block + glue() + getNonce());
export const doAction = (action, data = {}) =>
  makeRequest(`burst/v1/do_action/${action}`, "POST", {
    action_data: data,
  }).then((response) => {
    return response.hasOwnProperty("data") ? response.data : [];
  });

/**
 * Serialize value for URL parameters, handling arrays and objects
 * @param {*} value - Value to serialize
 * @returns {string} Serialized value
 */
const serializeValue = (value) => {
  if (Array.isArray(value)) {
    // For arrays, add [] to the key and keep values separate
    return value;
  }
  if (typeof value === "object" && value !== null) {
    return JSON.stringify(value);
  }
  return value;
};

/**
 * Build query string from object of parameters
 * @param {Object} params
 * @returns {string}
 */
const buildQueryString = (params) => {
  return Object.keys(params)
    .filter((key) => params[key] !== undefined && params[key] !== null)
    .map((key) => {
      const value = serializeValue(params[key]);
      if (Array.isArray(value)) {
        // Handle arrays by using the PHP array syntax: metrics[]=value1&metrics[]=value2
        return value
          .map((v) => `${encodeURIComponent(key)}[]=${encodeURIComponent(v)}`)
          .join("&");
      }
      return `${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
    })
    .join("&");
};

/**
 * Get data from the REST API
 * @param {string} type - The data type to fetch
 * @param {string} startDate - Start date for the query
 * @param {string} endDate - End date for the query
 * @param {string} range - Date range
 * @param {Object} args - Additional query parameters
 * @returns {Promise}
 */
export const getData = async (type, startDate, endDate, range, args = {}) => {
  // Extract filters and metrics from args if they exist
  const { filters, metrics, group_by } = args;

  // Combine all query parameters
  const queryParams = {
    date_start: startDate,
    date_end: endDate,
    date_range: range,
    nonce: burst_settings.burst_nonce,
    goal_id: args.goal_id,
    token: Math.random()
      .toString(36)
      .replace(/[^a-z]+/g, "")
      .substr(0, 5),
    ...(filters && { filters }), // type is object
    ...(metrics && { metrics }), // type is array
    ...(group_by && { group_by }), // type is array
  };

  const queryString = buildQueryString(queryParams);
  const path = `burst/v1/data/${type}${glue()}${queryString}`;

  return await makeRequest(path, "GET");
};

export const getMenu = () =>
  makeRequest("burst/v1/menu/" + glue() + getNonce());
export const getPosts = (search) =>
  makeRequest(`burst/v1/posts/${glue()}${getNonce()}&search=${search}`).then(
    (response) => {
      return response.hasOwnProperty("posts") ? response.posts : [];
    },
  );

/**
 * Retrieves a value from local storage with a 'burst_' prefix and parses it as
 * JSON. If the key is not found, returns the provided default value.
 *
 * @param {string} key - The key to retrieve from local storage, without the
 *     'burst_' prefix.
 * @param {*} defaultValue - The value to return if the key is not found in
 *     local storage.
 * @returns {*} - The parsed JSON value from local storage or the default
 *     value.
 */
export const getLocalStorage = (key, defaultValue) => {
  if ("undefined" !== typeof Storage) {
    const storedValue = localStorage.getItem("burst_" + key);
    if (storedValue && 0 < storedValue.length) {
      return JSON.parse(storedValue);
    }
  }
  return defaultValue;
};

/**
 * Stringifies a value as JSON and stores it in local storage with a 'burst_'
 * prefix.
 *
 * @param {string} key - The key to store in local storage, without the
 *     'burst_' prefix.
 * @param {*} value - The value to stringify as JSON and store in local
 *     storage.
 */
export const setLocalStorage = (key, value) => {
  if ("undefined" !== typeof Storage) {
    localStorage.setItem("burst_" + key, JSON.stringify(value));
  }
};
