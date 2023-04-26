export default class DOMElementModificationEventObject {

  /**
   * This class represents the first argument of the added, removed and changed events
   *
   * @param {Object} options
   * @param {string} options.type Event type, removed, added, changed
   * @param {Element} options.target Element at which the event occured
   * @param {Object} options.changedAttributes Attribute names and values after change
   * @param {Object} options.previousAttributes Attribute names and values before change
   */
  constructor({
    type,
    target,
    changedAttributes,
    previousAttributes
  } = {}) {
    /** @type {string} Event type, removed, added, changed */
    this.type = type;
    /** @type {Element} Element at which the event occured */
    this.target = target;
    /** @type {Object} Attribute names and values after change */
    this.changedAttributes = changedAttributes;
    /** @type {Object} Attribute names and values before change */
    this.previousAttributes = previousAttributes;
  }
}
