import Backbone from 'backbone';

export class DOMElementModificationEventObject {

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

/**
 * Allows the capture of DOM descendant nodes on addition, removal or change.
 * This is an Adapt orientated implementation of the browser MutationObserver API
 * Reference: https://developer.mozilla.org/pt-BR/docs/Web/API/MutationObserver
 *
 * @example
 * import documentModifications, { DOMElementModifications } from 'core/js/DOMElementModifications';
 *
 * documentModifications.on('added:[data-tooltip-id]', function onToolTipTargetAdded (event) {
 *
 * })
 *
 * this.listenTo(documentModifications, 'remove:[data-tooltip-id]', function onToolTipTargetRemoved (event) {
 *
 * });
 *
 * const navModifications = new DOMElementModifications({
 *   el: document.querySelector('.nav__inner'),
 *   watchAttributes: false,
 *   watchImmediateChildrenOnly: true
 * });
 * navModifications.on('added:button removed:button', function onChildElementAddedOrRemoved (event) {
 *
 * })
 *
 * @event DOMElementModifications#added:selector Element matching selector has been added
 * @event DOMElementModifications#removed:selector Element matching selector has been removed
 * @event DOMElementModifications#changed:selector Element matching selector has been moved, added, removed or its attributes have changed
 * @event DOMElementModifications#added Element has been added
 * @event DOMElementModifications#changed Element has been removed
 * @event DOMElementModifications#removed Element has been moved, added, removed or its attributes have changed
 */
export class DOMElementModifications extends Backbone.View {

  /**
   * @param {Object} options
   * @param {Object} options.el Watch the descendants of this element
   * @param {Object} options.watchImmediateChildrenOnly Only watch the immediate children and not all descendants
   * @param {Object} options.watchAttributes Watch for attribute changes as well as descendant changes
   */
  initialize({
    el = document.body,
    watchImmediateChildrenOnly = true,
    watchAttributes = false
  } = {}) {
    this._onMutation = this._onMutation.bind(this);
    this.el = el;
    this._watch = {
      childList: true,
      subtree: !watchImmediateChildrenOnly,
      attributes: watchAttributes,
      attributeOldValue: watchAttributes
    };
  }

  /**
   *
   */
  startWatching() {
    this._calculateElementFilters();
    if (this._observer) return this;
    this._observer = new MutationObserver(this._onMutation);
    this._observer.observe(this.el, this._watch);
    return this;
  }

  static calculateEventName(eventNames) {
    const firstEvent = eventNames[0];
    const isNew = (firstEvent === 'added');
    const lastRemovedIndex = eventNames.lastIndexOf('removed');
    const lastAddedIndex = eventNames.lastIndexOf('added');
    const hasReAdded = (lastRemovedIndex !== -1 && lastAddedIndex !== -1 && lastRemovedIndex < lastAddedIndex);
    // Element was moved, not added or removed
    if (!isNew && hasReAdded) return 'changed';
    const lastEvent = eventNames[eventNames.length - 1];
    return lastEvent;
  };

  _onMutation(list) {
    const reducedChanges = list.reduce((changes, item) => {
      let addedNodes = _.toArray(item.addedNodes);
      let removedNodes = _.toArray(item.removedNodes);
      const allNodes = [
        ...addedNodes,
        ...removedNodes
      ];
      const isTextChange = allNodes.some(node => node.nodeType === Node.TEXT_NODE);
      const isChangeOnSubject = (item.target === this.el);
      const isAttributeChange = (!isChangeOnSubject && this._watch.attributes && item.type === 'attributes');
      addedNodes = addedNodes.filter(node => node.nodeType === Node.ELEMENT_NODE);
      removedNodes = removedNodes.filter(node => node.nodeType === Node.ELEMENT_NODE);
      const isAddedEvent = Boolean(addedNodes.length);
      const isRemovedEvent = Boolean(removedNodes.length);
      const isChangedEvent = Boolean(isAttributeChange || isTextChange);
      // Check for triggerable changes
      if (!isAddedEvent && !isRemovedEvent && !isChangedEvent) return changes;
      // Collect all possible nodes
      const targetNodes = isChangedEvent
        ? [ item.target ]
        : _.toArray(isAddedEvent ? addedNodes : removedNodes)
          .flatMap(node => {
            return this._watch.subtree
              // Fetch all decendant nodes
              ? [node, ...$(node).find('*').toArray()]
              // Use only immediate node
              : [node];
          });
      // Fetch initial event name
      const eventName = isAddedEvent
        ? 'added'
        : isRemovedEvent
          ? 'removed'
          : 'changed';
      targetNodes.forEach(target => {
        // Keep changes for each node
        const value = changes.get(target) ?? {
          eventNames: [],
          previousAttributes: this._watch.attributes
            ? {}
            : null
        };
        value.eventNames.push(eventName);
        // Collect changed attributes
        const shouldRecordAttribute = (isChangedEvent && item.attributeName);
        if (shouldRecordAttribute) value.previousAttributes[item.attributeName] ??= item.oldValue;
        changes.set(target, value);
      });
      return changes;
    }, new Map());
    for (const [target, { eventNames, previousAttributes }] of reducedChanges.entries()) {
      // Check if the added and removed events are a moved node, which should have a changed event
      const eventName = DOMElementModifications.calculateEventName(eventNames);
      const isNodeAdded = (eventName === 'added');
      const isNodeRemoved = (eventName === 'removed');
      // Find events to trigger, filter by and return event name selectors
      const selectorFilters = isNodeAdded
        ? this._addedFilters
        : isNodeRemoved
          ? this._removedFilters
          : this._changedFilters;
      if (!selectorFilters.length) continue;
      const selectors = selectorFilters.map(filter => filter(target)).filter(Boolean);
      if (!selectors.length) continue;
      // Capture new attribute values
      const changedAttributes = this._watch.attributes
        ? Object.keys(previousAttributes).reduce((attributes, attrName) => {
          attributes[attrName] = target.getAttribute(attrName);
          return attributes;
        }, {})
        : null;
      // Trigger events.
      // Always trigger a changed event, trigger added or removed only when specifically requested
      const EventObject = new DOMElementModificationEventObject({
        type: eventName,
        target,
        changedAttributes,
        previousAttributes
      });
      selectors.forEach(selector => {
        if (selector && selector !== true) {
          // Event attachment has specified selector
          if (eventName !== 'changed') this.trigger(`${eventName}:${selector}`, EventObject);
          this.trigger(`changed:${selector}`, EventObject);
        }
        // Event attachment has no selector
        if (eventName !== 'changed') this.trigger(`${eventName}`, EventObject);
        this.trigger('changed', EventObject);
      });
    }
  }

  stopWatching() {
    this._calculateElementFilters();
    if (!this._observer) return this;
    this._observer.disconnect();
    this._observer = null;
    return this;
  }

  _calculateElementFilters() {
    const selectorFilter = selector => {
      const eventWithNoSelector = (selector === undefined);
      if (eventWithNoSelector) return () => { return true; };
      // eslint-disable-next-line no-new-func
      return new Function('el', `return $(el).is("${selector}") && "${selector}";`);
    };
    const eventNames = Object.keys(this._events);
    const eventNameParts = eventNames.map(name => name.split(':'));
    const changedSelectors = eventNameParts.filter(parts => parts[0] === 'changed').map(parts => parts[1]);
    const addedSelectors = eventNameParts.filter(parts => parts[0] === 'added').map(parts => parts[1]);
    const removedSelectors = eventNameParts.filter(parts => parts[0] === 'removed').map(parts => parts[1]);
    this._changedFilters = changedSelectors.map(selectorFilter);
    this._addedFilters = addedSelectors.map(selectorFilter).concat(this._changedFilters);
    this._removedFilters = removedSelectors.map(selectorFilter).concat(this._changedFilters);
  }

  on(...args) {
    /** Event attachment controls the attachment of the MutationObserver */
    const rtn = super.on(...args);
    if (this.shouldListen) this.startWatching();
    return rtn;
  }

  once(...args) {
    /** Event attachment controls the attachment of the MutationObserver */
    const rtn = super.once(...args);
    if (this.shouldListen) this.startWatching();
    return rtn;
  }

  listenToOnce(...args) {
    /** Event attachment the attachment of the MutationObserver */
    const rtn = super.listenToOnce(...args);
    if (this.shouldListen) this.startWatching();
    return rtn;
  }

  off(...args) {
    /** Event removal controls the attachment of the MutationObserver */
    const rtn = super.off(...args);
    if (!this.shouldListen) this.stopWatching();
    return rtn;
  }

  stopListening(...args) {
    /** Event removal controls the attachment of the MutationObserver */
    const rtn = super.stopListening(...args);
    if (!this.shouldListen) this.stopWatching();
    return rtn;
  }

  /**
   * Returns true if any events are attached.
   * @returns {boolean}
   */
  get shouldListen() {
    return Boolean(Object.keys(this._events).length || Object.keys(this._listeners).length);
  }

}

/**
 * Return a document global instance for any added, removed or moved elements,
 * this instance does not listen to attribute changes.
 */
const documentModifications = new DOMElementModifications({
  el: document.body,
  watchImmediateChildrenOnly: false,
  watchAttributes: false
});
documentModifications.DOMElementModifications = DOMElementModifications;

export default documentModifications;
