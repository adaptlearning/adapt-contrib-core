import Adapt from 'core/js/adapt';
import data from 'core/js/data';
import ModelEvent from 'core/js/modelEvent';
import LockingModel from 'core/js/models/lockingModel';
import logging from 'core/js/logging';

export default class AdaptModel extends LockingModel {

  toJSON() {
    // Perform shallow clone
    const json = { ...this.attributes };
    // Remove deprecated values as they are not true json
    delete json._children;
    delete json._parent;
    // Perform deep clone
    return $.extend(true, {}, json);
  }

  get(name) {
    switch (name) {
      case '_parent':
      case '_children':
        logging.deprecated('Use model.getChildren() or model.getParent() instead of model.get(\'_children\') or model.get(\'_parent\')');
    }
    return super.get(name);
  }

  defaults() {
    return {
      _canShowFeedback: true,
      _classes: '',
      _canReset: true,
      _canRequestChild: false,
      _isComplete: false,
      _isInteractionComplete: false,
      _isA11yRegionEnabled: false,
      _isA11yCompletionDescriptionEnabled: true,
      _requireCompletionOf: -1,
      _isEnabled: true,
      _isResetOnRevisit: false,
      _isAvailable: true,
      _isOptional: false,
      _isRendered: false,
      _isReady: false,
      _isVisible: true,
      _isVisited: false,
      _isLocked: false,
      _isHidden: false
    };
  }

  /**
   * Fetch an array representing the relative location of the model to the nearest _trackingId
   * @returns {Array<Number, Number>}
   */
  get trackingPosition() {
    const firstDescendant = this.getAllDescendantModels(false).concat([this])[0];
    const nearestTrackingIdModel = [firstDescendant].concat(firstDescendant.getAncestorModels()).find(model => model.has('_trackingId'));
    if (!nearestTrackingIdModel) return;
    const trackingId = nearestTrackingIdModel.get('_trackingId');
    let trackingIdDescendants = [nearestTrackingIdModel].concat(nearestTrackingIdModel.getAllDescendantModels(true));
    trackingIdDescendants = trackingIdDescendants.filter(model => !(model.isTypeGroup('component') && model.get('_isTrackable') === false));
    const indexInTrackingIdDescendants = trackingIdDescendants.findIndex(descendant => descendant === this);
    if (indexInTrackingIdDescendants >= 0) {
      // Is either the nearestTrackingIdModel (0) or one of its flattened descendants (>0)
      return [ trackingId, indexInTrackingIdDescendants ];
    }
    // Is an ancestor of the nearestTrackingIdModel
    const trackingIdAncestors = nearestTrackingIdModel.getAncestorModels();
    const ancestorDistance = trackingIdAncestors.findIndex(ancestor => ancestor === this);
    return [ trackingId, -(ancestorDistance + 1) ];
  }

  /**
   * The AAT always sets the value of `_isResetOnRevisit` to a String
   * which is fine for the 'soft' and 'hard' values - but 'false' needs
   * converting to Boolean - see #2825
   */
  parse(data) {
    if (data._isResetOnRevisit === 'false') {
      data._isResetOnRevisit = false;
    }
    return data;
  }

  trackable() {
    return [
      '_id',
      '_isComplete',
      '_isInteractionComplete',
      '_isVisited'
    ];
  }

  trackableType() {
    return [
      String,
      Boolean,
      Boolean,
      Boolean
    ];
  }

  bubblingEvents() {
    return [
      'change:_isComplete',
      'change:_isInteractionComplete',
      'change:_isActive',
      'change:_isVisited'
    ];
  }

  setupModel() {
    if (this.hasManagedChildren) {
      this.setupChildListeners();
    }
    this.init();
    _.defer(() => {
      if (this.hasManagedChildren) {
        this.checkCompletionStatus();
        this.checkInteractionCompletionStatus();
        this.checkLocking();
        this.checkVisitedStatus();
      }
      this.setupTrackables();
    });
  }

  setupTrackables() {

    // Limit state trigger calls and make state change callbacks batched-asynchronous
    const originalTrackableStateFunction = this.triggerTrackableState;
    this.triggerTrackableState = _.compose(
      () => {

        // Flag that the function is awaiting trigger
        this.triggerTrackableState.isQueued = true;

      },
      _.debounce(() => {

        // Trigger original function
        originalTrackableStateFunction.apply(this);

        // Unset waiting flag
        this.triggerTrackableState.isQueued = false;

      }, 17)
    );

    // Listen to model changes, trigger trackable state change when appropriate
    this.listenTo(this, 'change', ({ changed }) => {

      // Skip if trigger queued or adapt hasn't started yet
      if (this.triggerTrackableState.isQueued || !Adapt.attributes._isStarted) {
        return;
      }

      // Check that property is trackable
      const trackablePropertyNames = _.result(this, 'trackable', []);
      const changedPropertyNames = Object.keys(changed);
      const isTrackable = changedPropertyNames.find(item => {
        return trackablePropertyNames.includes(item);
      });

      if (isTrackable) {
        // Trigger trackable state change
        this.triggerTrackableState();
      }
    });
  }

  setupChildListeners() {
    const children = this.getChildren();
    if (!children.length) {
      return;
    }

    this.listenTo(children, {
      all: this.onAll,
      bubble: this.bubble,
      'change:_isVisited': this.checkVisitedStatus,
      'change:_isReady': this.checkReadyStatus,
      'change:_isComplete': this.onIsComplete,
      'change:_isInteractionComplete': this.checkInteractionCompletionStatus
    });
  }

  init() {}

  getTrackableState() {

    const trackable = this.resultExtend('trackable', []);
    const json = this.toJSON();

    const args = trackable;
    args.unshift(json);

    return _.pick(...args);

  }

  setTrackableState(state) {

    const trackable = this.resultExtend('trackable', []);

    const args = trackable;
    args.unshift(state);

    state = _.pick(...args);

    this.set(state);

    return this;

  }

  triggerTrackableState() {

    Adapt.trigger('state:change', this, this.getTrackableState());

  }

  /**
   * @param {string} [type] 'hard' resets _isComplete and _isInteractionComplete, 'soft' resets _isInteractionComplete only.
   * @param {boolean} [canReset] Defaults to this.get('_canReset')
   * @returns {boolean}
   */
  reset(type = 'hard', canReset = this.get('_canReset')) {
    if (!canReset) return false;
    const isHardReset = (type === 'hard' || type === true);
    const isSoftReset = (type === 'soft');
    if (!isHardReset && !isSoftReset) return false
    const resetData = {
      _isEnabled: true,
      _isInteractionComplete: false
    };
    if (isHardReset) resetData._isComplete = false;
    this.set(resetData);
    this.trigger('reset');
    return true;
  }

  /**
   * Checks if any child models which have been _isRendered are not _isReady.
   * If all rendered child models are marked ready then this model will be
   * marked _isReady: true as well.
   * @param {AdaptModel} [model]
   * @param {boolean} [value]
   * @returns {boolean}
   */
  checkReadyStatus(model, value) {
    if (value === false) {
      // Do not respond to _isReady: false as _isReady is unset throughout
      // the rendering process
      return false;
    }
    // Filter children based upon whether they are available
    // Check if any _isRendered: true children return _isReady: false
    // If not - set this model to _isReady: true
    const children = this.getAvailableChildModels();
    if (children.find(child => child.get('_isReady') === false && child.get('_isRendered'))) {
      return false;
    }

    this.set('_isReady', true);
    return true;
  }

  setReadyStatus() {
    this.set('_isReady', true);
  }

  checkVisitedStatus() {
    const children = this.getAvailableChildModels();
    const isVisited = children.some(child => child.get('_isVisited') || child.get('_isComplete') || child.get('_isInteractionComplete'));
    if (isVisited) this.set('_isVisited', true);
    return isVisited;
  }

  setVisitedStatus() {
    if (!this.get('_isReady') || !this.get('_isRendered')) return;
    this.set('_isVisited', true);
  }

  setCompletionStatus() {
    if (!this.get('_isVisible')) return;

    this.set({
      _isComplete: true,
      _isInteractionComplete: true,
      _isVisited: true
    });
  }

  checkCompletionStatus() {
    // defer to allow other change:_isComplete handlers to fire before cascading to parent
    Adapt.checkingCompletion();
    _.defer(this.checkCompletionStatusFor.bind(this), '_isComplete');
  }

  checkInteractionCompletionStatus() {
    // defer to allow other change:_isInteractionComplete handlers to fire before cascading to parent
    Adapt.checkingCompletion();
    _.defer(this.checkCompletionStatusFor.bind(this), '_isInteractionComplete');
  }

  /**
   * Checks whether the supplied completion attribute should be set to true or false.
   * Iterates over immediate children, checking if enough/all mandatory models have been completed.
   * If all children are optional, they must all be completed - https://github.com/adaptlearning/adapt-contrib-core/issues/279
   * @param {string} [completionAttribute] Either '_isComplete' or '_isInteractionComplete'. Defaults to '_isComplete' if not supplied.
   */
  checkCompletionStatusFor(completionAttribute = '_isComplete') {
    let completed = false;
    const children = this.getAvailableChildModels();
    const requireCompletionOf = this.get('_requireCompletionOf');
    const isOptional = this.get('_isOptional');
    const isEveryChildOptional = children.every(child => child.get('_isOptional'));

    if (isOptional && isEveryChildOptional) {
      // As model is optional, its completion is only used for plp
      // wait for the children to complete before completing
      completed = children.every(child => child.get(completionAttribute));
    } else if (requireCompletionOf === -1) { // a value of -1 indicates that ALL mandatory children must be completed
      completed = children.every(child => {
        return child.get(completionAttribute) || child.get('_isOptional');
      });
    } else {
      completed = (children.filter(child => {
        return child.get(completionAttribute) && !child.get('_isOptional');
      }).length >= requireCompletionOf);
    }

    this.set(completionAttribute, completed);
    Adapt.checkedCompletion();
  }

  /**
   * Returns a string describing the type group of this model.
   * Strings should be lowercase and not plurlaized.
   * i.e. 'page', 'menu', 'contentobject', 'component', 'article', 'block'
   * Override in inheritance chain.
   * @returns {string}
   */
  getTypeGroup() {}

  /**
   * Returns true if this model is of the type group described.
   * Automatically manages pluralization typeGroup and matches lowercase only.
   * Pluralized typeGroups and uppercase characters in typeGroups are discouraged.
   * @param {string} type Type group name i.e. course, contentobject, article, block, component
   * @returns {boolean}
   */
  isTypeGroup(typeGroup) {
    const hasUpperCase = /[A-Z]+/.test(typeGroup);
    const isPluralized = typeGroup.slice(-1) === 's';
    const lowerCased = typeGroup.toLowerCase();
    const singular = isPluralized && lowerCased.slice(0, -1); // remove pluralization if ending in s
    const singularLowerCased = (singular || lowerCased).toLowerCase();
    if (isPluralized || hasUpperCase) {
      logging.deprecated(`'${typeGroup}' appears pluralized or contains uppercase characters, suggest using the singular, lowercase type group '${singularLowerCased}'.`);
    }
    const pluralizedLowerCaseTypes = [
      singularLowerCased,
      !isPluralized && `${lowerCased}s` // pluralize if not ending in s
    ].filter(Boolean);
    const typeGroups = this.getTypeGroups();
    if (_.intersection(pluralizedLowerCaseTypes, typeGroups).length) {
      return true;
    }
    return false;
  }

  /**
   * Returns an array of strings describing the model type groups.
   * All strings are lowercase and should not be pluralized.
   * i.e. ['course', 'menu', 'contentobject'], ['page', 'contentobject'], ['component']
   * @returns {[string]}
   */
  getTypeGroups() {
    if (this._typeGroups) return this._typeGroups;
    const typeGroups = [ this.get('_type') ];
    let parentClass = this;
    while ((parentClass = Object.getPrototypeOf(parentClass))) {
      if (!Object.prototype.hasOwnProperty.call(parentClass, 'getTypeGroup')) continue;
      typeGroups.push(parentClass.getTypeGroup.call(this));
    }
    return (this._typeGroups = _.uniq(typeGroups.filter(Boolean).map(s => s.toLowerCase())));
  }

  /**
   * Searches the model's ancestors to find the first instance of the specified ancestor type
   * @param {string} [ancestorType] Valid values are 'course', 'pages', 'contentObjects', 'articles' or 'blocks'.
   * If left blank, the immediate ancestor (if there is one) is returned
   * @return {object} Reference to the model of the first ancestor of the specified type that's found - or `undefined` if none found
   */
  findAncestor(ancestorType) {
    const parent = this.getParent();
    if (!parent) return;
    if (!ancestorType || parent.isTypeGroup(ancestorType)) {
      return parent;
    }
    return parent.findAncestor(ancestorType);
  }

  /**
   * Returns all the descendant models of a specific type
   * @param {string} descendants Valid values are 'contentobject', 'page', 'menu', 'article', 'block', 'component', 'question'
   * @param {object} options an object that defines the search type and the properties/values to search on. Currently only the `where` search type (equivalent to `Backbone.Collection.where()`) is supported.
   * @param {object} options.where
   * @return {array}
   * @example
   * //find all available, non-optional components
   * this.findDescendantModels('component', { where: { _isAvailable: true, _isOptional: false }});
   */
  findDescendantModels(descendants, options) {
    const allDescendantsModels = this.getAllDescendantModels();
    const returnedDescendants = allDescendantsModels.filter(model => {
      return model.isTypeGroup(descendants);
    });

    if (!options) {
      return returnedDescendants;
    }

    if (options.where) {
      return returnedDescendants.filter(descendant => {
        for (const property in options.where) {
          const value = options.where[property];
          if (descendant.get(property) !== value) {
            return false;
          }
        }
        return true;
      });
    }
  }

  /**
   * Fetches the sub structure of a model as a flattened array
   *
   * Such that the tree:
   *  { a1: { b1: [ c1, c2 ], b2: [ c3, c4 ] }, a2: { b3: [ c5, c6 ] } }
   *
   * will become the array (parent first = false):
   *  [ c1, c2, b1, c3, c4, b2, a1, c5, c6, b3, a2 ]
   *
   * or (parent first = true):
   *  [ a1, b1, c1, c2, b2, c3, c4, a2, b3, c5, c6 ]
   *
   * This is useful when sequential operations are performed on the menu/page/article/block/component hierarchy.
   * @param {boolean} [isParentFirst]
   * @return {array}
   */
  getAllDescendantModels(isParentFirst) {

    const descendants = [];

    if (!this.hasManagedChildren) {
      return descendants;
    }

    const children = this.getChildren();

    children.models.forEach(child => {

      if (!child.hasManagedChildren) {
        descendants.push(child);
        return;
      }

      const subDescendants = child.getAllDescendantModels(isParentFirst);
      if (isParentFirst === true) {
        descendants.push(child);
      }

      descendants.push(...subDescendants);

      if (isParentFirst !== true) {
        descendants.push(child);
      }
    });

    return descendants;

  }

  /**
   * Returns a relative model from the Adapt hierarchy
   *
   * Such that in the tree:
   *  { a1: { b1: [ c1, c2 ], b2: [ c3, c4 ] }, a2: { b3: [ c5, c6 ] } }
   *
   *  c1.findRelativeModel('@block+1') = b2;
   *  c1.findRelativeModel('@component+4') = c5;
   *  c1.findRelativeModel('@article+1 @component=-1') = c6;
   *
   * @see Adapt.parseRelativeString for a description of relativeStrings
   * @param {string} relativeString
   * @param {object} options Search configuration settings
   * @param {boolean} options.limitParentId Constrain to a parent
   * @param {function} options.filter Model filter
   * @param {boolean} options.loop Allow offsets and insets to loop around to the beginning
   * @return {array}
   */
  findRelativeModel(relativeString, options = {}) {
    if (!relativeString) return this;

    let relativeDescriptorObjects = Adapt.parseRelativeString(relativeString);
    if (!Array.isArray(relativeDescriptorObjects)) relativeDescriptorObjects = [relativeDescriptorObjects];

    const find = ({ type, offset, inset }) => {
      const isInset = (inset !== null);
      const isOffset = (offset !== null);
      const rootModel = options.limitParentId
        ? data.findById(options.limitParentId)
        : isInset
          ? this // For insets, the default parent constraint is this model
          : Adapt.course; // For offsets, the default parent constraint is the course

      const increment = isOffset
        ? offset
        : inset;

      const searchBackwards = (increment < 0);
      let moveBy = Math.abs(increment);
      let movementCount = 0;

      const hasDescendantsOfType = Boolean(this.findDescendantModels(type).length);
      if (isInset && !hasDescendantsOfType) return undefined;
      if (isOffset && hasDescendantsOfType) {
        // Move by one less as first found is considered next.
        // Should find descendants on either side but not inside.
        moveBy--;
      }
      if (isInset && searchBackwards) {
        // Move by one less as -1 should act like the last, -2 second from last
        moveBy--;
      }

      const searchDescendants = searchBackwards
        // Parents first [p1,a1,b1,c1,c2,a2,b2,c3,c4,p2,a3,b3,c6,c7,a4,b4,c8,c9]
        // Reverse so that we don't need a forward and a backward iterating loop
        // Reversed [c9,c8,b4,a4,c7,c6,b3,a3,p2,c4,c3,b2,a2,c2,c1,b1,a1,p1]
        ? [rootModel, ...rootModel.getAllDescendantModels(true)].reverse()
        // Children first [c1,c2,b1,a1,c3,c4,b2,a2,p1,c6,c7,b3,a3,c8,c9,b4,a4,p2]
        : [...rootModel.getAllDescendantModels(false), rootModel];

      const modelId = this.get('_id');
      // Find the index of this model in the searchDescendants array
      const searchFromIndex = isInset
        ? 0 // On inset, this model will always be the first model in searchDescendants
        : searchDescendants.findIndex(searchDescendant => (searchDescendant.get('_id') === modelId));

      const hasFilterFunction = (typeof options.filter === 'function');

      // Normalize the moveBy position to allow for overflow looping
      if (options.loop) {
        const totalOfType = searchDescendants.reduce((count, model) => {
          if (!model.isTypeGroup(type)) return count;
          return ++count;
        }, 0);
        // Take the remainder of moveBy after removing whole units of the type count
        moveBy = moveBy % totalOfType;
        // Double up the searchDescendant entries to allow for overflow looping
        searchDescendants.push(...searchDescendants.slice(0));
      }

      for (let i = searchFromIndex, l = searchDescendants.length; i < l; i++) {
        const descendant = searchDescendants[i];
        if (!descendant.isTypeGroup(type)) continue;
        const isSelf = (i === searchFromIndex);
        // https://github.com/adaptlearning/adapt_framework/issues/3031
        if (!isSelf && hasFilterFunction && !options.filter(descendant)) continue;
        if (movementCount > moveBy) {
          // There is no descendant which matches this relativeString
          // Probably looking for a descendant +/-0
          break;
        }
        if (movementCount === moveBy) {
          return descendant;
        }
        movementCount++;
      }
    };

    // Join the remaining descriptors together to pass to the next model
    const nextDescriptor = relativeDescriptorObjects
      .slice(1)
      .reduce((output, { type, offset, inset }) => {
        const isInset = (inset !== null);
        const isOffset = (offset !== null);
        if (isOffset) return `${output}@${type}${offset < 0 ? offset : `+${offset}`}`;
        if (isInset) return `${output}@${type}=${inset}`;
        return `${output}@${type}`;
      }, '');

    const foundModel = find(relativeDescriptorObjects[0]);
    if (nextDescriptor) {
      // Perform the lookup of the next descriptor on the found model
      // Defer to that model as it may have overridden the findRelativeModel function
      return foundModel?.findRelativeModel(nextDescriptor);
    }
    return foundModel;
  }

  get hasManagedChildren() {
    return true;
  }

  getChildren() {
    if (this._childrenCollection) {
      return this._childrenCollection;
    }

    let childrenCollection;

    if (!this.hasManagedChildren) {
      childrenCollection = new Backbone.Collection();
    } else {
      const id = this.get('_id');
      // Look up child by _parentId from data
      const children = data.filter(model => model.get('_parentId') === id);
      childrenCollection = new Backbone.Collection(children);
    }

    if (this.get('_type') === 'block' &&
      childrenCollection.length === 2 &&
      childrenCollection.models[0].get('_layout') !== 'left') {
      // Components may have a 'left' or 'right' _layout,
      // so ensure they appear in the correct order
      // Re-order component models to correct it
      childrenCollection.comparator = '_layout';
      childrenCollection.sort();
    }

    this.setChildren(childrenCollection);
    return this._childrenCollection;
  }

  setChildren(children) {
    this._childrenCollection = children;
    // Setup deprecated reference
    this.set('_children', children);
  }

  getAvailableChildModels() {
    return this.getChildren().where({
      _isAvailable: true
    });
  }

  getParent() {
    if (this._parentModel) {
      return this._parentModel;
    }
    const parentId = this.get('_parentId');
    if (!parentId) return;
    // Look up parent by id from data
    const parent = data.findById(parentId);
    if (!parent) {
      logging.warn('adaptModel.getParent(): parent is empty');
      return;
    }

    this.setParent(parent);
    return this._parentModel;
  }

  setParent(parent) {
    this._parentModel = parent;
    this.set('_parentId', this._parentModel.get('_id'));
    // Set up deprecated reference
    this.set('_parent', this._parentModel);
  }

  getAncestorModels(shouldIncludeChild) {
    const parents = [];
    let context = this;

    if (shouldIncludeChild) parents.push(context);

    while (context.has('_parentId')) {
      context = context.getParent();
      parents.push(context);
    }

    return parents.length ? parents : null;
  }

  getSiblings(passSiblingsAndIncludeSelf) {
    const id = this.get('_id');
    const parentId = this.get('_parentId');
    let siblings;
    if (!passSiblingsAndIncludeSelf) {
      // returns a collection of siblings excluding self
      if (this._hasSiblingsAndSelf === false) {
        return this.get('_siblings');
      }
      siblings = data.filter(model => {
        return model.get('_parentId') === parentId &&
          model.get('_id') !== id;
      });

      this._hasSiblingsAndSelf = false;

    } else {
      // returns a collection of siblings including self
      if (this._hasSiblingsAndSelf) {
        return this.get('_siblings');
      }

      siblings = data.filter(model => {
        return model.get('_parentId') === parentId;
      });
      this._hasSiblingsAndSelf = true;
    }

    const siblingsCollection = new Backbone.Collection(siblings);
    this.set('_siblings', siblingsCollection);
    return siblingsCollection;
  }

  /**
   * @param  {string} key
   * @param  {any} value
   * @param  {Object} options
   */
  setOnChildren(...args) {

    this.set(...args);

    if (!this.hasManagedChildren) return;

    const children = this.getChildren();
    children.models.forEach(child => child.setOnChildren(...args));

  }

  /**
   * @deprecated since v3.2.3 - please use `model.set('_isOptional', value)` instead
   */
  setOptional(value) {
    logging.deprecated('Use model.set(\'_isOptional\', value) as setOptional() may be removed in the future');
    this.set({ _isOptional: value });
  }

  checkLocking() {
    const lockType = this.get('_lockType');

    if (!lockType) return;

    switch (lockType) {
      case 'sequential':
        this.setSequentialLocking();
        break;
      case 'unlockFirst':
        this.setUnlockFirstLocking();
        break;
      case 'lockLast':
        this.setLockLastLocking();
        break;
      case 'custom':
        this.setCustomLocking();
        break;
      default:
        logging.warn(`AdaptModel.checkLocking: unknown _lockType '${lockType}' found on ${this.get('_id')}`);
    }
  }

  setSequentialLocking() {
    const children = this.getAvailableChildModels();
    // Start from second child
    children.slice(1).forEach((child, index) => {
      const previousChild = children[index];
      // If previous was locked, all subsequent will be locked.
      const isLockedByPreviousChild = previousChild.get('_isLocked') ||
        (
          !previousChild.get('_isComplete') &&
          !previousChild.get('_isOptional')
        );
      child.set('_isLocked', isLockedByPreviousChild);
    }, false);
  }

  setUnlockFirstLocking() {
    const children = this.getAvailableChildModels();
    const firstChild = children.shift();
    const isLockedByFirstChild = (!firstChild.get('_isComplete') && !firstChild.get('_isOptional'));
    children.forEach(child => child.set('_isLocked', isLockedByFirstChild));
  }

  setLockLastLocking() {
    const children = this.getAvailableChildModels();
    const lastChild = children.pop();
    const isLockedByChildren = children.some(child => (!child.get('_isComplete') && !child.get('_isOptional')));
    lastChild.set('_isLocked', isLockedByChildren);
  }

  setCustomLocking() {
    const children = this.getAvailableChildModels();
    children.forEach(child => child.set('_isLocked', this.shouldLock(child)));
  }

  shouldLock(child) {
    const lockedBy = child.get('_lockedBy');
    if (!lockedBy) return false;
    return lockedBy.some(id => {
      try {
        const anotherModel = data.findById(id);
        return anotherModel.get('_isAvailable') &&
          (
            anotherModel.get('_isLocked') ||
            (
              !anotherModel.get('_isComplete') &&
              !anotherModel.get('_isOptional')
            )
          );
      } catch (e) {
        logging.warn(`AdaptModel.shouldLock: unknown _lockedBy ID '${id}' found on ${child.get('_id')}`);
        return false;
      }
    });
  }

  onIsComplete() {
    this.checkCompletionStatus();

    this.checkLocking();
  }

  /**
   * Used before a model is rendered to determine if it should be reset to its
   * default values.
   */
  checkIfResetOnRevisit() {
    const isResetOnRevisit = this.get('_isResetOnRevisit');
    this.reset(isResetOnRevisit);
  }

  /**
   * Clones this model and all managed children returning a new branch.
   * Assign new unique ids to each cloned model.
   * @param {Function} [modifier] A callback function for each child to allow for custom modifications
   * @returns {AdaptModel}
   */
  deepClone(modifier = null) {
    // Fetch the class
    const ModelClass = this.constructor;
    // Clone the model
    const clonedModel = new ModelClass(this.toJSON());
    // Run the custom modifier on the clone
    if (modifier) {
      modifier(clonedModel, this);
    }
    let clonedId = clonedModel.get('_id');
    const hasId = Boolean(clonedId);
    const shouldAssignUniqueId = (this.get('_id') === clonedId);
    if (hasId && shouldAssignUniqueId) {
      // Create a unique id if none was set by the modifier
      const cid = _.uniqueId(ModelClass.prototype.cidPrefix || 'c');
      clonedId = `${clonedId}_${cid}`;
      clonedModel.set('_id', clonedId);
    }
    // Add the cloned model to data for data.findById resolution
    if (hasId) {
      data.add(clonedModel);
    }
    // Clone any children
    if (this.hasManagedChildren) {
      this.getChildren().each(child => {
        if (!child.deepClone) {
          throw new Error('Cannot deepClone child.');
        }
        child.deepClone((clone, child) => {
          if (hasId) {
            // Set the cloned child parent id
            clone.set('_parentId', clonedId);
          }
          if (modifier) {
            // Run the custom modifier function on the cloned child
            modifier(clone, child);
          }
        });
      });
    }
    // Add the cloned model to its parent for model.findDescendants resolution
    clonedModel.getParent().getChildren().add(clonedModel);
    // Setup the cloned model after setting the id, the parent and adding any children
    clonedModel.setupModel();
    return clonedModel;
  }

  /**
   * Internal event handler for all module events. Triggers event bubbling
   * through the module hierarchy when the event is included in
   * `this.bubblingEvents`.
   * @param {string} type Event name / type
   * @param {Backbone.Model} model Origin backbone model
   * @param {*} value New property value
   */
  onAll(type, model, value) {
    if (!_.result(this, 'bubblingEvents').includes(type)) return;
    const event = new ModelEvent(type, model, value);
    this.bubble(event);
  }

  /**
   * Internal event handler for bubbling events.
   * @param {ModelEvent} event
   */
  bubble(event) {
    if (!event.canBubble) return;
    event.addPath(this);
    this.trigger(`bubble:${event.type} bubble`, event);
  }

}
