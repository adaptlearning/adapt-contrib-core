/**
 * Ordered log levels used to determine whether a log call should be printed.
 * Levels are compared ordinally — a configured level of `WARN` will suppress
 * `DEBUG`, `INFO`, and `SUCCESS` output.
 * @file
 * @module core/js/enums/logLevelEnum
 * @enum {number}
 */
const LOG_LEVEL = ENUM([
  'DEBUG',
  'INFO',
  'SUCCESS',
  'WARN',
  'ERROR',
  'FATAL'
]);

export default LOG_LEVEL;
