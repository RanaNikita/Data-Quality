// /**
//  * Backend Server Constants
//  * Centralized constants for HTTP status codes, error messages, and configuration
//  */
 
// // HTTP Status Codes
// const HTTP_STATUS = {
//   BAD_REQUEST: 400,
//   UNAUTHORIZED: 401,
//   NOT_FOUND: 404,
//   SERVICE_UNAVAILABLE: 503
// };
 
// // Error Message Constants
// const ERROR_MESSAGES = {
//   ERROR_PREFIX: 'PAWS right there! We have hit a snag :(',
//   HTTP_ERROR_STATUS: 'HTTP Code:',
 
//   // Tips for specific errors
//   TIPS: {
//     BAD_REQUEST: '💡 Tip: Check your SNOWFLAKE_DATABASE and SNOWFLAKE_SCHEMA in the backend .env file. Make sure they exist and you have access to them.',
//     UNAUTHORIZED: '💡 Tip: Check your SNOWFLAKE_PAT (Personal Access Token) in the backend .env file. Make sure it\'s valid and not expired.',
//     NOT_FOUND: '💡 Tip: Check your SNOWFLAKE_DATABASE and SNOWFLAKE_SCHEMA in the backend .env file. Make sure they exist and you have access to them.',
//     NOT_FOUND_AGENT: (agentName) => `💡 Tip: The agent "${agentName}" may not exist, or check your SNOWFLAKE_DATABASE and SNOWFLAKE_SCHEMA in the backend .env file.`,
//     SERVICE_UNAVAILABLE: '💡 Tip: Check your SNOWFLAKE_HOST in the backend .env file. Make sure it\'s correct and accessible (format: account.snowflakecomputing.com)',
//     INVALID_AGENT_NAME: 'Invalid agent name format',
//     MESSAGES_REQUIRED: 'Messages array is required'
//   }
// };
 
// // Configuration
// const CONFIG = {
//   MAX_AGENT_NAME_LENGTH: 100,
//   RATE_LIMIT_WINDOW_MS: 15 * 60 * 1000, // 15 minutes
//   RATE_LIMIT_MAX_REQUESTS: 100,
//   DEFAULT_PORT: 3001
// };
 
// module.exports = {
//   HTTP_STATUS,
//   ERROR_MESSAGES,
//   CONFIG
// };
 
 
 


/**
 * Backend Server Constants
 * Centralized constants for HTTP status codes, error messages, and configuration
 * Also includes allow-list for permitted agents.
 */

// HTTP Status Codes
const HTTP_STATUS = {
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  NOT_FOUND: 404,
  SERVICE_UNAVAILABLE: 503,
};

// Error Message Constants
const ERROR_MESSAGES = {
  ERROR_PREFIX: 'PAWS right there! We have hit a snag :(',
  HTTP_ERROR_STATUS: 'HTTP Code:',
  // Tips for specific errors
  TIPS: {
    BAD_REQUEST:
      '💡 Tip: Check your SNOWFLAKE_DATABASE and SNOWFLAKE_SCHEMA in the backend .env file. Make sure they exist and you have access to them.',
    UNAUTHORIZED:
      "💡 Tip: Check your SNOWFLAKE_PAT (Personal Access Token) in the backend .env file. Make sure it's valid and not expired.",
    NOT_FOUND:
      '💡 Tip: Check your SNOWFLAKE_DATABASE and SNOWFLAKE_SCHEMA in the backend .env file. Make sure they exist and you have access to them.',
    NOT_FOUND_AGENT: (agentName) =>
      `💡 Tip: The agent "${agentName}" may not exist, or check your SNOWFLAKE_DATABASE and SNOWFLAKE_SCHEMA in the backend .env file.`,
    SERVICE_UNAVAILABLE:
      "💡 Tip: Check your SNOWFLAKE_HOST in the backend .env file. Make sure it's correct and accessible (format: account.snowflakecomputing.com)",
    INVALID_AGENT_NAME: 'Invalid agent name format',
    MESSAGES_REQUIRED: 'Messages array is required',
  },
};

// Configuration
const CONFIG = {
  MAX_AGENT_NAME_LENGTH: 100,
  RATE_LIMIT_WINDOW_MS: 15 * 60 * 1000, // 15 minutes
  RATE_LIMIT_MAX_REQUESTS: 100,
  DEFAULT_PORT: 3001,
};

/**
 * Agents Allow-List
 * Only agents inside this list will be returned/usable by the backend.
 * NOTE: Snowflake agent names are case-sensitive.
 *
 * Optional env override:
 *   AGENT_ALLOW_LIST=DATA_QUALITY,DATA_QUALITY_AUTO
 */
const AGENT_ALLOW_LIST =
  process.env.AGENT_ALLOW_LIST
    ? process.env.AGENT_ALLOW_LIST.split(',').map((s) => s.trim()).filter(Boolean)
    : ['DATA_QUALITY', 'DATA_QUALITY_AUTO'];

module.exports = {
  HTTP_STATUS,
  ERROR_MESSAGES,
  CONFIG,
  AGENT_ALLOW_LIST,
};
