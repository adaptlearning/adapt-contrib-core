/**
 * @file Core logging service providing levelled console output, scoped plugin
 * loggers, and event hooks for error-reporting integrations.
 * @module core/js/logging
 */
import Adapt from 'core/js/adapt';
import LOG_LEVEL from 'core/js/enums/logLevelEnum';

/**
 * @typedef {Object} ScopedLogger
 * @property {Function} debug - Log at DEBUG level with plugin prefix
 * @property {Function} info - Log at INFO level with plugin prefix
 * @property {Function} success - Log at SUCCESS level with plugin prefix
 * @property {Function} warn - Log at WARN level with plugin prefix
 * @property {Function} error - Log at ERROR level with plugin prefix
 * @property {Function} fatal - Log at FATAL level with plugin prefix
 */

/**
 * @classdesc Singleton logging service. Wraps `console` output with log-level
 * filtering, coloured scoped output for plugins, and once-only deduplication
 * for deprecation and removal warnings.
 * @fires module:core/js/logging~log
 * @fires module:core/js/logging~log:debug
 * @fires module:core/js/logging~log:info
 * @fires module:core/js/logging~log:success
 * @fires module:core/js/logging~log:warn
 * @fires module:core/js/logging~log:error
 * @fires module:core/js/logging~log:fatal
 * @fires module:core/js/logging~log:ready
 */
class Logging extends Backbone.Controller {

  initialize() {
    this._config = {
      _isEnabled: true,
      _level: LOG_LEVEL.INFO.asLowerCase, // Default log level
      _console: true, // Log to console
      _warnFirstOnly: true, // Show only first of identical removed and deprecated warnings
      _colors: true // Enable colored console output
    };
    this._warned = {};
    this._scopedLoggers = {};
    this.listenToOnce(Adapt, 'configModel:dataLoaded', this.onLoadConfigData);
  }

  onLoadConfigData() {

    this.loadConfig();

    this.debug('Logging config loaded');

    this.trigger('log:ready');

  }

  loadConfig() {

    if (Adapt.config.has('_logging')) {
      const courseConfig = Adapt.config.get('_logging');
      // Merge course config with defaults instead of replacing
      this._config = Object.assign({}, this._config, courseConfig);
    }

    this._checkQueryStringOverride();

  }

  /**
   * Checks the page query string for a `loglevel` override and applies it
   * to the active config if a valid level is found.
   * @private
   */
  _checkQueryStringOverride() {

    const matches = window.location.search.match(/[?&]loglevel=([a-z0-9]+)/i);
    if (!matches || !matches[1]) return;

    const override = LOG_LEVEL(matches[1].toUpperCase());
    if (!override) return;

    this._config._level = override.asLowerCase;
    this.debug('Loglevel override in query string:', this._config._level);

  }

  /**
   * Logs a message at DEBUG level.
   * @param {...*} args - Values to log
   */
  debug(...args) {
    this._log(LOG_LEVEL.DEBUG, args);
  }

  /**
   * Logs a message at INFO level.
   * @param {...*} args - Values to log
   */
  info(...args) {
    this._log(LOG_LEVEL.INFO, args);
  }

  /**
   * Logs a message at SUCCESS level.
   * @param {...*} args - Values to log
   */
  success(...args) {
    this._log(LOG_LEVEL.SUCCESS, args);
  }

  /**
   * Logs a message at WARN level.
   * @param {...*} args - Values to log
   */
  warn(...args) {
    this._log(LOG_LEVEL.WARN, args);
  }

  /**
   * Logs a message at ERROR level.
   * @param {...*} args - Values to log
   */
  error(...args) {
    this._log(LOG_LEVEL.ERROR, args);
  }

  /**
   * Logs a message at FATAL level.
   * @param {...*} args - Values to log
   */
  fatal(...args) {
    this._log(LOG_LEVEL.FATAL, args);
  }

  /**
   * Creates a cached, namespaced logger for a plugin or module.
   * Every message is prefixed `[source]` in the console and coloured by level
   * when `_colors` is enabled. Repeated calls with the same `source` return
   * the same cached instance.
   * @param {string} source - Cache key and default display name (e.g. `'xAPI'`, `'spoor'`)
   * @param {string} [name] - Optional display label; only applied on first call for a given source
   * @returns {ScopedLogger} Scoped logger instance
   * @throws {Error} If source is not a non-empty string
   * @example
   * const logger = logging.scope('MyPlugin');
   * logger.success('Data loaded');
   * logger.error('Connection failed', err);
   * @example
   * const logger = logging.scope('MyPlugin', 'Feature-X');
   * logger.warn('Retrying…');
   */
  scope(source, name) {
    if (!source || typeof source !== 'string') {
      throw new Error('logging.scope() requires a source name string parameter');
    }

    const displayName = name || source;

    // Return cached scoped logger if it exists
    if (this._scopedLoggers[source]) {
      if (name && this._scopedLoggers[source]._displayName !== displayName) {
        this.warn(`logging.scope('${source}'): already cached with a different display name, ignoring '${name}'`);
      }
      return this._scopedLoggers[source];
    }

    // Create new scoped logger
    const scopedLogger = {
      _displayName: displayName,
      debug: (...args) => this._log(LOG_LEVEL.DEBUG, args, displayName),
      info: (...args) => this._log(LOG_LEVEL.INFO, args, displayName),
      success: (...args) => this._log(LOG_LEVEL.SUCCESS, args, displayName),
      warn: (...args) => this._log(LOG_LEVEL.WARN, args, displayName),
      error: (...args) => this._log(LOG_LEVEL.ERROR, args, displayName),
      fatal: (...args) => this._log(LOG_LEVEL.FATAL, args, displayName)
    };

    // Cache the scoped logger
    this._scopedLoggers[source] = scopedLogger;

    return scopedLogger;
  }

  /**
   * Logs a one-time WARN message prefixed with `REMOVED`.
   * Use when an API or feature has been removed entirely.
   * @example
   * logging.removed('myPlugin.oldMethod(), use myPlugin.newMethod() instead');
   */
  removed(...args) {
    this.warnOnce('REMOVED', ...args);
  }

  /**
   * Logs a one-time WARN message prefixed with `DEPRECATED`.
   * Use when an API or feature still works but should no longer be used.
   * @example
   * logging.deprecated('myPlugin.oldProp, use myPlugin.newProp instead');
   */
  deprecated(...args) {
    this.warnOnce('DEPRECATED', ...args);
  }

  /**
   * Logs a WARN message only the first time it is called with a given set of arguments.
   * Subsequent calls with identical arguments are silently discarded when `_warnFirstOnly` is enabled.
   */
  warnOnce(...args) {
    if (this._hasWarned(args)) {
      return;
    }
    this._log(LOG_LEVEL.WARN, args);
  }

  /**
   * Core log dispatch. Checks enabled state and level filter, then delegates
   * to console output and fires public log events.
   * @param {*} level - LOG_LEVEL enum value
   * @param {Array} data - Arguments to log
   * @param {string|null} [source] - Optional source/plugin name
   * @fires module:core/js/logging~log
   * @fires module:core/js/logging~log:debug
   * @fires module:core/js/logging~log:info
   * @fires module:core/js/logging~log:success
   * @fires module:core/js/logging~log:warn
   * @fires module:core/js/logging~log:error
   * @fires module:core/js/logging~log:fatal
   * @private
   */
  _log(level, data, source = null) {

    const isEnabled = this._config._isEnabled;
    if (!isEnabled) return;

    const configLevel = LOG_LEVEL((this._config._level ?? LOG_LEVEL.INFO.asLowerCase).toUpperCase());

    const isLogLevelAllowed = level >= configLevel;
    if (!isLogLevelAllowed) return;

    this._logToConsole(level, data, source);

    // Allow error reporting plugins to hook and report to logging systems
    this.trigger('log', level, data, source);
    this.trigger('log:' + level.asLowerCase, level, data, source);

  }

  /**
   * Writes a log entry to the browser console, applying coloured CSS styling
   * for scoped loggers when `_colors` is enabled.
   * @param {*} level - LOG_LEVEL enum value
   * @param {Array} data - Arguments to log
   * @param {string|null} [source] - Optional source/plugin name
   * @private
   */
  _logToConsole(level, data, source = null) {

    const shouldLogToConsole = this._config._console;
    if (!shouldLogToConsole) return;

    const useColors = this._config._colors && source;
    const prefix = source ? `[${source}]` : level.asUpperCase + ':';

    if (useColors) {
      // Use colored output for scoped loggers - format entire message as string
      const color = this._getColorForLevel(level);
      const message = data.map(item => this._serializeArg(item)).join(' ');
      const consoleMethod = this._getConsoleMethod(level);

      console[consoleMethod](`%c${prefix} ${message}`, `background: WhiteSmoke; color: ${color}`);
    } else {
      // Standard output
      const log = [prefix];
      if (data && data.length > 0) {
        log.push(...data);
      }

      const consoleMethod = this._getConsoleMethod(level);
      if (typeof console[consoleMethod] === 'function') {
        console[consoleMethod](...log);
      } else {
        console.log(...log);
      }
    }
  }

  /**
   * Converts a single log argument to a string, safely serialising objects
   * and truncating oversized JSON to prevent console spam.
   * @param {*} item - Value to serialise
   * @returns {string} String representation of the value
   * @private
   */
  _serializeArg(item) {
    if (typeof item !== 'object' || item === null) return String(item);
    try {
      const str = JSON.stringify(item, null, 2);
      // Cap output length to prevent console spam
      return str.length > 500 ? str.substring(0, 500) + '...' : str;
    } catch {
      return '[Circular or non-serializable object]';
    }
  }

  /**
   * Returns a CSS named colour for the given log level.
   * @param {*} level - LOG_LEVEL enum value
   * @returns {string} CSS colour name
   * @private
   */
  _getColorForLevel(level) {
    const colors = {
      debug: 'RoyalBlue',
      info: 'Indigo',
      success: 'DarkGreen',
      warn: 'Chocolate',
      error: 'Crimson',
      fatal: 'DarkRed'
    };
    return colors[level.asLowerCase] || 'black';
  }

  /**
   * Returns the `console` method name appropriate for the given log level.
   * @param {*} level - LOG_LEVEL enum value
   * @returns {string} Console method name (e.g. `'warn'`, `'error'`)
   * @private
   */
  _getConsoleMethod(level) {
    const mapping = {
      [LOG_LEVEL.DEBUG.asLowerCase]: 'debug',
      [LOG_LEVEL.INFO.asLowerCase]: 'info',
      [LOG_LEVEL.SUCCESS.asLowerCase]: 'log',
      [LOG_LEVEL.WARN.asLowerCase]: 'warn',
      [LOG_LEVEL.ERROR.asLowerCase]: 'error',
      [LOG_LEVEL.FATAL.asLowerCase]: 'error'
    };
    return mapping[level.asLowerCase] || 'log';
  }

  /**
   * Checks whether an identical set of arguments has already been logged
   * via `warnOnce`. Records the hash on first call.
   * @param {Array} args - Arguments to check
   * @returns {boolean} `true` if these arguments have already been warned
   * @private
   */
  _hasWarned(args) {
    if (!this._config._warnFirstOnly) {
      return false;
    }
    const hash = args.map(String).join(':');
    if (this._warned[hash]) {
      return true;
    }
    this._warned[hash] = true;
    return false;
  }

}

const logging = new Logging();
export default logging;
