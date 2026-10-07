/**
 * @file LockingModel - Backbone model with cooperative attribute locking
 * @module core/js/models/lockingModel
 * @description Extends Backbone.Model with a cooperative locking system that allows
 * multiple plugins to independently lock boolean attributes. An attribute stays
 * in its locked state as long as any one plugin holds a lock on it, and returns
 * to the unlocked state only when all locks are released.
 *
 * **Architecture:**
 * - Overrides `set()` to intercept locking attribute changes
 * - Tracks per-plugin lock state in `_lockedAttributesValues`
 * - Subclasses declare locking attributes by overriding `lockedAttributes()`
 *
 * **Usage:**
 * Subclasses define which attributes are lockable by overriding `lockedAttributes()`.
 * Plugins call `model.set(attrName, lockingValue, { pluginName: 'myPlugin' })` to
 * add or remove their lock. The attribute resolves to its unlocked value only
 * when no plugins hold a lock.
 */

/**
 * @class LockingModel
 * @classdesc Backbone model with cooperative boolean attribute locking. Allows
 * multiple plugins to independently lock attributes; the attribute stays in its
 * locked state until all plugins release their lock. Subclasses declare lockable
 * attributes via `lockedAttributes()`.
 * @extends {Backbone.Model}
 */
export default class LockingModel extends Backbone.Model {

  lockedAttributes() {
    return null;
    // return {
    // _name: false/true for the default locked position
    // _canScroll: false
    // _canNavigate: true,
    // _shouldNavigateFocus: true
    // };
  }

  /**
   * Overrides Backbone `set` to intercept locking attribute changes.
   * Non-locking attributes pass through to `super.set` unchanged. For locking
   * attributes, the per-plugin lock state is updated before the final value
   * is resolved and applied.
   * @override
   * @param {string|Object} key - Attribute name or hash of key/value pairs
   * @param {*} [val] - Attribute value (when key is a string)
   * @param {Object} [options] - Backbone set options
   * @param {string} [options.pluginName] - Plugin identifier required when changing a locked attribute
   * @returns {LockingModel} Returns this for chaining
   */
  set(...args) {
    if (typeof args[0] !== 'object') {
      const [name, value] = args.splice(0, 2);
      args.unshift({ [name]: value });
    }
    const options = args[1] ?? {};
    const attrValues = args[0];
    const newValues = {};
    for (const attrName in attrValues) {
      const attrVal = attrValues[attrName];
      const willChange = (this.attributes[attrName] !== attrValues[attrName]);
      if (!willChange) continue;

      const isNotLocking = (typeof attrVal !== 'boolean' || !this.isLocking(attrName));
      if (isNotLocking) {
        newValues[attrName] = attrVal;
        continue;
      }

      const defaults = _.result(this, 'defaults');
      const isDefault = (defaults[attrName] !== undefined);
      const isInitialDefault = (isDefault && !this.changed);
      const isSettingValueForSpecificPlugin = options?.pluginName;

      if (!isSettingValueForSpecificPlugin) {
        if (!isInitialDefault) {
          console.error('Must supply a pluginName to change a locked attribute');
        }
        options.pluginName = 'compatibility';
      }

      const pluginName = options.pluginName;
      const lockingValue = this._lockedAttributes[attrName];
      const isAttemptingToLock = (lockingValue === attrVal);

      if (isAttemptingToLock) {
        if (!isInitialDefault) {
          this.setLockState(attrName, true, { pluginName, skipcheck: true });
        }
        newValues[attrName] = lockingValue;
        continue;
      }

      this.setLockState(attrName, false, { pluginName, skipcheck: true });

      const totalLockValue = this.getLockCount(attrName, { skipcheck: true });
      if (totalLockValue === 0) {
        newValues[attrName] = !lockingValue;
        continue;
      }
    }

    if (!Object.keys(newValues).length) return this;

    super.set(newValues, options);

    return this;

  }

  /**
   * Registers an attribute as a locking attribute with a given default locked value.
   * Has no effect if the attribute is already registered.
   * @param {string} attrName - Attribute name to register
   * @param {boolean} defaultLockValue - The value the attribute takes when locked
   */
  setLocking(attrName, defaultLockValue) {
    if (this.isLocking(attrName)) return;
    if (!this._lockedAttributes) this._lockedAttributes = {};
    this._lockedAttributes[attrName] = defaultLockValue;
  }

  /**
   * Unregisters a locking attribute, removing all associated lock state.
   * Has no effect if the attribute is not currently registered.
   * @param {string} attrName - Attribute name to unregister
   */
  unsetLocking(attrName) {
    if (!this.isLocking(attrName)) return;
    if (!this._lockedAttributes) return;
    delete this._lockedAttributes[attrName];
    delete this._lockedAttributesValues[attrName];
    if (Object.keys(this._lockedAttributes).length === 0) {
      delete this._lockedAttributes;
      delete this._lockedAttributesValues;
    }
  }

  /**
   * Returns whether the model uses locking, or whether a specific attribute is
   * registered as a locking attribute.
   * @param {string} [attrName] - Attribute to check. If omitted, returns whether
   * the model has any locking attributes at all.
   * @returns {boolean}
   */
  isLocking(attrName) {
    const isCheckingGeneralLockingState = (attrName === undefined);
    let hasDerivedLockedAttributes = Object.prototype.hasOwnProperty.call(this, '_lockedAttributes');

    if (!hasDerivedLockedAttributes) {
      this._lockedAttributes = _.result(this, 'lockedAttributes');
      hasDerivedLockedAttributes = true;
    }

    const isUsingLockedAttributes = Boolean(this._lockedAttributes);

    if (isCheckingGeneralLockingState) {
      return isUsingLockedAttributes;
    }

    if (!isUsingLockedAttributes) return false;

    const isAttributeALockingAttribute = Object.prototype.hasOwnProperty.call(this._lockedAttributes, attrName);
    if (!isAttributeALockingAttribute) return false;

    if (!this._lockedAttributesValues) {
      this._lockedAttributesValues = {};
    }

    if (!this._lockedAttributesValues[attrName]) {
      this._lockedAttributesValues[attrName] = {};
    }

    return true;
  }

  /**
   * Returns whether a locking attribute currently has any active locks.
   * @param {string} attrName - The locking attribute to check
   * @param {Object} [options]
   * @param {boolean} [options.skipcheck] - Skip the `isLocking` guard check
   * @returns {boolean|undefined} `true` if locked, `false` if unlocked,
   * `undefined` if the attribute is not a locking attribute
   */
  isLocked(attrName, options) {
    const shouldSkipCheck = options?.skipcheck;
    if (!shouldSkipCheck) {
      const stopProcessing = !this.isLocking(attrName);
      if (stopProcessing) return;
    }

    return this.getLockCount(attrName) > 0;
  }

  /**
   * Returns the total number of active locks on a locking attribute, or the
   * lock count for a specific plugin.
   * @param {string} attrName - The locking attribute to query
   * @param {Object} [options]
   * @param {string} [options.pluginName] - Return only this plugin's lock count (0 or 1)
   * @param {boolean} [options.skipcheck] - Skip the `isLocking` guard check
   * @returns {number|undefined} Total lock count, or `undefined` if not a locking attribute
   */
  getLockCount(attrName, options) {
    const shouldSkipCheck = options?.skipcheck;
    if (!shouldSkipCheck) {
      const stopProcessing = !this.isLocking(attrName);
      if (stopProcessing) return;
    }

    const isGettingValueForSpecificPlugin = options?.pluginName;
    if (isGettingValueForSpecificPlugin) {
      return this._lockedAttributesValues[attrName][options.pluginName] ? 1 : 0;
    }

    const lockingAttributeValues = Object.values(this._lockedAttributesValues[attrName]);
    const lockingAttributeValuesSum = lockingAttributeValues.reduce((sum, value) => sum + (value ? 1 : 0), 0);

    return lockingAttributeValuesSum;
  }

  /**
   * Sets or clears a specific plugin's lock on a locking attribute.
   * @param {string} attrName - The locking attribute to modify
   * @param {boolean} value - `true` to add the lock, `false` to remove it
   * @param {Object} options
   * @param {string} options.pluginName - Plugin identifier holding or releasing the lock
   * @param {boolean} [options.skipcheck] - Skip the `isLocking` guard check
   * @returns {LockingModel} Returns this for chaining
   */
  setLockState(attrName, value, options) {
    const shouldSkipCheck = options?.skipcheck;
    if (!shouldSkipCheck) {
      const stopProcessing = !this.isLocking(attrName);
      if (stopProcessing) return this;
    }

    const isSettingValueForSpecificPlugin = options?.pluginName;
    if (!isSettingValueForSpecificPlugin) {
      console.error('Must supply a pluginName to set a locked attribute lock value');
      options.pluginName = 'compatibility';
    }

    if (value) {
      this._lockedAttributesValues[attrName][options.pluginName] = value;
    } else {
      delete this._lockedAttributesValues[attrName][options.pluginName];
    }

    return this;

  }

}
