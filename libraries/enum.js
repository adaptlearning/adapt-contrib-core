// 2023-08-31 BASIC ENUMERATION SUPPORT
(function() {
  function ENUM(namesArray, lookupModifierFunction) {
    if (!Array.isArray(namesArray)) throw new Error('First argument of ENUM must be an array');
    const lookupHash = {};
    // Create lookup & storage function
    const ENUMERATION = function (lookupValue) {
      if (lookupModifierFunction) lookupValue = lookupModifierFunction(lookupValue);
      lookupValue = lookupHash[lookupValue];
      return ENUMERATION[lookupValue];
    };
    Object.defineProperty(ENUMERATION, 'lookupHash', {
      enumerable: false,
      value: lookupHash
    });
    namesArray.forEach((names, i) => {
      if (!Array.isArray(names)) names = [names];
      // Make each value a power of 2 to allow for bitwise switches
      const value = Math.pow(2, i);
      const baseName = names[0];
      // Add values to lookup hash
      lookupHash[baseName] = baseName;
      lookupHash[value] = baseName;
      // Create Number object to allow for primitive comparisons, JSON stringify and sub properties
      // eslint-disable-next-line no-new-wrappers
      const entry = new Number(value);
      // Assign conversion values to entry
      entry.toString = () => entry.asString;
      entry.asString = baseName;
      entry.asLowerCase = baseName.toLowerCase();
      entry.asUpperCase = baseName.toUpperCase();
      entry.asInteger = value;
      // Reference lookup & storage function from each entry
      entry.ENUM = ENUMERATION;
      names.forEach((name, n) => {
        // Add primary name as enumerable property
        Object.defineProperty(ENUMERATION, name, {
          enumerable: (n === 0),
          value: entry
        });
        lookupHash[name] = baseName;
      });
    });
    // Freeze ENUM object
    if (Object.freeze) Object.freeze(ENUMERATION);
    return ENUMERATION;
  };
  window.ENUM = ENUM;
})();
