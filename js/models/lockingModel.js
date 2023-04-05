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
      if (isInitialDefault) {
        this._lockedAttributes[attrName] = !defaults[attrName];
      }

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
        this.setLockState(attrName, true, { pluginName, skipcheck: true });
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

    if (!Object.keys(newValues)) return this;

    super.set(newValues, options);

    return this;

  }

  setLocking(attrName, defaultLockValue) {
    if (this.isLocking(attrName)) return;
    if (!this._lockedAttributes) this._lockedAttributes = {};
    this._lockedAttributes[attrName] = defaultLockValue;
  }

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

  isLocked(attrName, options) {
    const shouldSkipCheck = options?.skipcheck;
    if (!shouldSkipCheck) {
      const stopProcessing = !this.isLocking(attrName);
      if (stopProcessing) return;
    }

    return this.getLockCount(attrName) > 0;
  }

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
