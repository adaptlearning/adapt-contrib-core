import logging from 'core/js/logging';

/**
 * Controller for managing accessibilty logging, specifically used for
 * controlling the display of removed or deprecated API warnings.
 */
export default class Log extends Backbone.Controller {

  initialize({ a11y }) {
    this.a11y = a11y;
    this._warned = {};
  }

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
