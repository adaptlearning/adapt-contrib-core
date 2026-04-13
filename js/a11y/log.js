/**
 * @file Log - Accessibility logging controller for removed and deprecated API warnings
 * @module core/js/a11y/log
 * @description Provides methods to log warnings about removed or deprecated API
 * features with configurable behavior including filtering duplicate warnings
 * and enabling/disabling warnings globally.
*/

import logging from 'core/js/logging';

/**
 * @class Log
 * @classdesc Manages logging of accessibility related warnings for removed and deprecated API features.
 * @extends Backbone.Controller
 */
export default class Log extends Backbone.Controller {

  initialize({ a11y }) {
    this.a11y = a11y;
    this._warned = {};
  }

  /**
   * Checks if a warning has already been issued for the given arguments.
   * Uses a hash of the arguments to track whether a warning has been shown before.
   * Only tracks warnings if the `_warnFirstOnly` configuration option is enabled.
   * @private
   * @param {Array} args - Arguments to create a hash from for tracking
   * @returns {boolean} True if warning has already been shown (and _warnFirstOnly is enabled),
   *                    false otherwise
   */
  _hasWarned(args) {
    const config = this.a11y.config;
    if (!config._options._warnFirstOnly) {
      return false;
    }
    const hash = args.map(String).join(':');
    if (this._warned[hash]) {
      return true;
    }
    this._warned[hash] = true;
    return false;
  }

  _canWarn() {
    const config = this.a11y.config;
    return Boolean(config._options._warn);
  }

  /**
   * Logs a warning about a removed API feature.
   * Checks if warnings are enabled and if this specific warning has already been
   * logged. If conditions are met, delegates to the logging module to output
   * the removed API warning.
   * @param {...*} args - Arguments to pass to the logging.removed method.
   *                      First argument is typically the API name or description.
   * @returns {Log|undefined} Returns 'this' for method chaining if warning is logged,
   *                          undefined if warnings are disabled or already shown
   */
  removed(...args) {
    if (!this._canWarn) {
      return;
    }
    args = ['A11Y'].concat(args);
    if (this._hasWarned(args)) {
      return;
    }
    logging.removed(...args);
    return this;
  }

  /**
   * Logs a warning about a deprecated API feature.
   * Checks if warnings are enabled and if this specific warning has already been
   * logged. If conditions are met, delegates to the logging module to output
   * the deprecated API warning.
   * @param {...*} args - Arguments to pass to the logging.deprecated method.
   *                      First argument is typically the deprecated API name or description.
   * @returns {Log|undefined} Returns 'this' for method chaining if warning is logged,
   *                          undefined if warnings are disabled or already shown
   */
  deprecated(...args) {
    if (!this._canWarn) {
      return;
    }
    args = ['A11Y'].concat(args);
    if (this._hasWarned(args)) {
      return;
    }
    logging.deprecated(...args);
    return this;
  }

}
