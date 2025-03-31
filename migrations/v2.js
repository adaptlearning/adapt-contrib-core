import { checkContent, describe, getConfig, getCourse, mutateContent, testStopWhere, testSuccessWhere, whereContent } from 'adapt-migrations';
import _ from 'lodash';

describe('core - update to v2.0.14', async () => {
  let contentObjects, course;

  whereContent('core - where contentObjects', async (content) => {
    contentObjects = content.filter(obj => obj._type === 'page');
    course = getCourse();
    return contentObjects.length || course;
  });

  mutateContent('core - add contentObject pageBody', async (content) => {
    contentObjects.forEach(contentObject => {
      if (!_.has(contentObject, 'pageBody')) {
        _.set(contentObject, 'pageBody', '');
      }
    });
    return true;
  });

  mutateContent('core - add course description', async (content) => {
    if (!_.has(course, 'description')) {
      _.set(course, 'description', '');
    }
    return true;
  });

  checkContent('core - check contentObjects have pageBody', async (content) => {
    const isValid = contentObjects.every(contentObject => _.has(contentObject, 'pageBody'));
    if (!isValid) throw new Error('core - contentObjects do not have pageBody');
    return true;
  });

  checkContent('core - check course has description', async (content) => {
    const isValid = _.has(course, 'description');
    if (!isValid) throw new Error('core - course does not have description');
    return true;
  });

  testSuccessWhere('non/configured contentObjects and configured course', {
    content: [
      { _id: 'co-100', _type: 'page', pageBody: '' },
      { _id: 'co-200', _type: 'page' },
      { _type: 'course', description: '' }
    ]
  });

  testSuccessWhere('non/configured contentObjects and empty course', {
    content: [
      { _id: 'co-100', _type: 'page', pageBody: '' },
      { _id: 'co-200', _type: 'page' },
      { _type: 'course' }
    ]
  });

  testStopWhere('no course/contentObject', {
    content: [{ _type: 'other' }]
  });
});

describe('core - update to v2.0.16', async () => {
  let config;

  whereContent('core - where config', async (content) => {
    config = getConfig();
    return config;
  });

  mutateContent('core - add config._accessibility._isDisabledOnTouchDevices', async (content) => {
    if (_.has(config, '_accessibility._isDisabledOnTouchDevices')) return true;
    _.set(config, '_accessibility._isDisabledOnTouchDevices', false);
    return true;
  });

  checkContent('core - check config._accessibility._isDisabledOnTouchDevices', async (content) => {
    const isValid = _.has(config, '_accessibility._isDisabledOnTouchDevices');
    if (!isValid) throw new Error('core - _accessibility._isDisabledOnTouchDevices not added');
    return true;
  });

  testSuccessWhere('config with _accessibility', {
    content: [
      {
        _type: 'config',
        _accessibility: {
          _isDisabledOnTouchDevices: false
        }
      }
    ]
  });

  testSuccessWhere('empty config', {
    content: [
      { _type: 'config' }
    ]
  });

  testStopWhere('no config', {
    content: [{ _type: 'course' }]
  });
});

describe('core - update to v2.0.17', async () => {
  let course, config;
  const logging = {
    _isEnabled: true,
    _level: 'info',
    _console: true
  };

  whereContent('core - where course/config', async (content) => {
    course = getCourse();
    config = getConfig();
    return course || config;
  });

  mutateContent('core - add logging to config', async (content) => {
    _.set(config, '_logging', logging);
    return true;
  });

  mutateContent('core - add config._accessibility._isSkipNavigationEnabled', async (content) => {
    if (_.has(config, '_accessibility._isSkipNavigationEnabled')) return true;
    _.set(config, '_accessibility._isSkipNavigationEnabled', true);
    return true;
  });

  mutateContent('core - add course._globals._accessibility.skipNavigationText', async (content) => {
    if (_.has(course, '_globals._accessibility.skipNavigationText')) return true;
    _.set(course, '_globals._accessibility.skipNavigationText', 'Skip navigation');
    return true;
  });

  mutateContent('core - add course._globals._accessibility._ariaLabels.skipNavigation', async (content) => {
    if (_.has(course, '_globals._accessibility._ariaLabels.skipNavigation')) return true;
    _.set(course, '_globals._accessibility._ariaLabels.skipNavigation', 'Skip navigation');
    return true;
  });

  checkContent('core - check config._logging', async (content) => {
    const isValid = _.has(config, '_logging');
    if (!isValid) throw new Error('core - _logging not added');
    return true;
  });

  checkContent('core - check config._accessibility._isSkipNavigationEnabled', async (content) => {
    const isValid = _.has(config, '_accessibility._isSkipNavigationEnabled');
    if (!isValid) throw new Error('core - _accessibility._isSkipNavigationEnabled not added');
    return true;
  });

  checkContent('core - check course._globals._accessibility.skipNavigationText', async (content) => {
    const isValid = _.has(course, '_globals._accessibility.skipNavigationText');
    if (!isValid) throw new Error('core - _globals._accessibility.skipNavigationText not added');
    return true;
  });

  checkContent('core - check course._globals._accessibility._ariaLabels.skipNavigation', async (content) => {
    const isValid = _.has(course, '_globals._accessibility._ariaLabels.skipNavigation');
    if (!isValid) throw new Error('core - _globals._accessibility._ariaLabels.skipNavigation not added');
    return true;
  });

  testSuccessWhere('defaults course/config', {
    content: [
      {
        _type: 'course',
        _globals: {
          _accessibility: {
            _ariaLabels: {
              skipNavigation: 'Skip navigation'
            },
            skipNavigationText: 'Skip navigation'
          }
        }
      },
      {
        _type: 'config',
        _accessibility: {
          _isSkipNavigationEnabled: true
        },
        _logging: logging
      }
    ]
  });

  testSuccessWhere('empty course/config', {
    content: [
      { _type: 'course' },
      { _type: 'config' }
    ]
  });

  testStopWhere('no course/config', {
    content: [{ _type: 'other' }]
  });
});

describe('core - update to v2.0.18', async () => {
  let course;

  whereContent('core - where course', async (content) => {
    course = getCourse();
    return course;
  });

  mutateContent('core - update _globals._accessibility._accessibilityToggleTextOn', async (content) => {
    const originalValue = _.get(course, '_globals._accessibility._accessibilityToggleTextOn');
    _.set(course, '_globals._accessibility.accessibilityToggleTextOn', originalValue || 'Turn accessibility on?');
    _.unset(course, '_globals._accessibility._accessibilityToggleTextOn');
    return true;
  });

  mutateContent('core - update _globals._accessibility._accessibilityToggleTextOff', async (content) => {
    const originalValue = _.get(course, '_globals._accessibility._accessibilityToggleTextOff');
    _.set(course, '_globals._accessibility.accessibilityToggleTextOff', originalValue || 'Turn accessibility off?');
    _.unset(course, '_globals._accessibility._accessibilityToggleTextOff');
    return true;
  });

  checkContent('core - check _globals._accessibility.accessibilityToggleTextOn', async (content) => {
    const isValid = _.has(course, '_globals._accessibility.accessibilityToggleTextOn');
    if (!isValid) throw new Error('core - _globals._accessibility.accessibilityToggleTextOn not added');
    return true;
  });

  checkContent('core - check _globals._accessibility.accessibilityToggleTextOff', async (content) => {
    const isValid = _.has(course, '_globals._accessibility.accessibilityToggleTextOff');
    if (!isValid) throw new Error('core - _globals._accessibility.accessibilityToggleTextOff not added');
    return true;
  });

  testSuccessWhere('course with globals', {
    content: [
      {
        _type: 'course',
        _globals: {
          _accessibility: {
            _accessibilityToggleTextOn: 'Turn accessibility on?',
            _accessibilityToggleTextOff: 'Turn accessibility off?'
          }
        }
      }
    ]
  });

  testSuccessWhere('course with no globals', {
    content: [
      { _type: 'course' }
    ]
  });

  testStopWhere('no contentObjects', {
    content: [{ _type: 'config' }]
  });
});

describe('core - update to v2.1.0', async () => {
  let config;

  whereContent('core - where config', async (content) => {
    config = getConfig();
    return config;
  });

  mutateContent('core - update _accessibility._isEnabledOnTouchDevices', async (content) => {
    const originalValue = _.get(config, '_accessibility._isDisabledOnTouchDevices');
    _.set(config, '_accessibility._isEnabledOnTouchDevices', originalValue || false);
    _.unset(config, '_accessibility._isDisabledOnTouchDevices');
    return true;
  });

  checkContent('core - check _accessibility._isEnabledOnTouchDevices', async (content) => {
    const isValid = _.has(config, '_accessibility._isEnabledOnTouchDevices');
    if (!isValid) throw new Error('core - _accessibility._isEnabledOnTouchDevices not added');
    return true;
  });

  testSuccessWhere('config with _accessibility', {
    content: [
      {
        _type: 'config',
        _accessibility: {
          _isDisabledOnTouchDevices: false
        }
      }
    ]
  });

  testSuccessWhere('empty config', {
    content: [
      { _type: 'config' }
    ]
  });

  testStopWhere('no contentObjects', {
    content: [{ _type: 'course' }]
  });
});

describe('core - update to v2.2.0', async () => {
  let articles, blocks, components, contentObjects, config;

  // Convert strings to boolean or return default value
  function stringToBoolean(str, defaultValue) {
    if (typeof str !== 'string') return defaultValue;
    return str.toLowerCase() === 'true';
  }

  whereContent('core - where content', async (content) => {
    articles = content.filter(obj => obj._type === 'article');
    blocks = content.filter(obj => obj._type === 'block');
    components = content.filter(obj => obj._type === 'component');
    contentObjects = content.filter(obj => obj._type === 'page');
    config = getConfig();
    return articles.length || blocks.length || components.length || contentObjects.length || config;
  });

  mutateContent('core - update article _isOptional/_isAvailable to boolean', async (content) => {
    articles.forEach(article => {
      article._isOptional = stringToBoolean(article._isOptional, false);
      article._isAvailable = stringToBoolean(article._isAvailable, true);
    });
    return true;
  });

  mutateContent('core - update blocks _isOptional/_isAvailable to boolean', async (content) => {
    blocks.forEach(block => {
      block._isOptional = stringToBoolean(block._isOptional, false);
      block._isAvailable = stringToBoolean(block._isAvailable, true);
    });
    return true;
  });

  mutateContent('core - update components _isOptional/_isAvailable to boolean', async (content) => {
    components.forEach(component => {
      component._isOptional = stringToBoolean(component._isOptional, false);
      component._isAvailable = stringToBoolean(component._isAvailable, true);
    });
    return true;
  });

  mutateContent('core - update contentObjects _isOptional/_isAvailable to boolean', async (content) => {
    contentObjects.forEach(contentObject => {
      contentObject._isOptional = stringToBoolean(contentObject._isOptional, false);
      contentObject._isAvailable = stringToBoolean(contentObject._isAvailable, true);
    });
    return true;
  });

  mutateContent('core - update config._accessibility._isEnabled to boolean', async (content) => {
    _.set(config, '_accessibility._isEnabled', stringToBoolean(config?._accessibility?._isEnabled, false));
    return true;
  });

  mutateContent('core - update config._accessibility._isEnabledOnTouchDevices to boolean', async (content) => {
    _.set(config, '_accessibility._isEnabledOnTouchDevices', stringToBoolean(config?._accessibility?._isEnabledOnTouchDevices, false));
    return true;
  });

  mutateContent('core - update config._accessibility._shouldSupportLegacyBrowsers to boolean', async (content) => {
    _.set(config, '_accessibility._shouldSupportLegacyBrowsers', stringToBoolean(config?._accessibility?._shouldSupportLegacyBrowsers, false));
    return true;
  });

  mutateContent('core - update config._accessibility._isTextProcessorEnabled to boolean', async (content) => {
    _.set(config, '_accessibility._isTextProcessorEnabled', stringToBoolean(config?._accessibility?._isTextProcessorEnabled, false));
    return true;
  });

  mutateContent('core - update config._accessibility._isSkipNavigationEnabled to boolean', async (content) => {
    _.set(config, '_accessibility._isSkipNavigationEnabled', stringToBoolean(config?._accessibility?._isSkipNavigationEnabled, true));
    return true;
  });

  mutateContent('core - update config._generateSourcemap to boolean', async (content) => {
    _.set(config, '_generateSourcemap', stringToBoolean(config?._generateSourcemap, false));
    return true;
  });

  mutateContent('core - update config._forceRouteLocking to boolean', async (content) => {
    _.set(config, '_forceRouteLocking', stringToBoolean(config?._forceRouteLocking, true));
    return true;
  });

  mutateContent('core - update config._logging._isEnabled to boolean', async (content) => {
    _.set(config, '_logging._isEnabled', stringToBoolean(config?._logging?._isEnabled, true));
    return true;
  });

  mutateContent('core - update config._logging._console to boolean', async (content) => {
    _.set(config, '_logging._console', stringToBoolean(config?._logging?._console, true));
    return true;
  });

  checkContent('core - check articles _isOptional/_isAvailable have been updated', async (content) => {
    const isValid = articles.every(article =>
      typeof article._isOptional === 'boolean' && typeof article._isAvailable === 'boolean'
    );
    if (!isValid) throw new Error('core - article._isOptional or article._isAvailable is not a boolean');
    return true;
  });

  checkContent('core - check blocks _isOptional/_isAvailable have been updated', async (content) => {
    const isValid = blocks.every(block =>
      typeof block._isOptional === 'boolean' && typeof block._isAvailable === 'boolean'
    );
    if (!isValid) throw new Error('core - block._isOptional or block._isAvailable is not a boolean');
    return true;
  });

  checkContent('core - check components _isOptional/_isAvailable have been updated', async (content) => {
    const isValid = components.every(component =>
      typeof component._isOptional === 'boolean' && typeof component._isAvailable === 'boolean'
    );
    if (!isValid) throw new Error('core - component._isOptional or component._isAvailable is not a boolean');
    return true;
  });

  checkContent('core - check contentObjects _isOptional/_isAvailable have been updated', async (content) => {
    const isValid = contentObjects.every(contentObject =>
      typeof contentObject._isOptional === 'boolean' && typeof contentObject._isAvailable === 'boolean'
    );
    if (!isValid) throw new Error('core - contentObject._isOptional or contentObject._isAvailable is not a boolean');
    return true;
  });

  checkContent('core - check config._isEnabled has been updated', async (content) => {
    const isValid = typeof config._accessibility._isEnabled === 'boolean';
    if (!isValid) throw new Error('core - config._isEnabled is not a boolean');
    return true;
  });

  checkContent('core - check config._accessibility._isEnabledOnTouchDevices has been updated', async (content) => {
    const isValid = typeof config._accessibility._isEnabledOnTouchDevices === 'boolean';
    if (!isValid) throw new Error('core - config._accessibility._isEnabledOnTouchDevices is not a boolean');
    return true;
  });

  checkContent('core - check config._accessibility._shouldSupportLegacyBrowsers has been updated', async (content) => {
    const isValid = typeof config._accessibility._shouldSupportLegacyBrowsers === 'boolean';
    if (!isValid) throw new Error('core - config._accessibility._shouldSupportLegacyBrowsers is not a boolean');
    return true;
  });

  checkContent('core - check config._accessibility._isTextProcessorEnabled has been updated', async (content) => {
    const isValid = typeof config._accessibility._isTextProcessorEnabled === 'boolean';
    if (!isValid) throw new Error('core - config._accessibility._isTextProcessorEnabled is not a boolean');
    return true;
  });

  checkContent('core - check config._accessibility._isSkipNavigationEnabled has been updated', async (content) => {
    const isValid = typeof config._accessibility._isSkipNavigationEnabled === 'boolean';
    if (!isValid) throw new Error('core - config._accessibility._isSkipNavigationEnabled is not a boolean');
    return true;
  });

  checkContent('core - check config._generateSourcemap has been updated', async (content) => {
    const isValid = typeof config._generateSourcemap === 'boolean';
    if (!isValid) throw new Error('core - config._generateSourcemap is not a boolean');
    return true;
  });

  checkContent('core - check config._forceRouteLocking has been updated', async (content) => {
    const isValid = typeof config._forceRouteLocking === 'boolean';
    if (!isValid) throw new Error('core - config._forceRouteLocking is not a boolean');
    return true;
  });

  checkContent('core - check config._logging._isEnabled has been updated', async (content) => {
    const isValid = typeof config._logging._isEnabled === 'boolean';
    if (!isValid) throw new Error('core - config._logging._isEnabled is not a boolean');
    return true;
  });

  checkContent('core - check config._logging._console has been updated', async (content) => {
    const isValid = typeof config._logging._console === 'boolean';
    if (!isValid) throw new Error('core - config._logging._console is not a boolean');
    return true;
  });

  testSuccessWhere('non/configured config/contentObjects/articles/blocks/components', {
    content: [
      { _type: 'course' },
      {
        _type: 'config',
        _accessibility: {
          _isEnabled: 'true',
          _isEnabledOnTouchDevices: 'true',
          _shouldSupportLegacyBrowsers: 'true',
          _isTextProcessorEnabled: 'true',
          _isSkipNavigationEnabled: 'true'
        },
        _generateSourcemap: 'true',
        _forceRouteLocking: 'true',
        _logging: {
          _isEnabled: 'true',
          _console: 'true'
        }
      },
      { _id: 'co-100', _type: 'page', _isOptional: 'true', _isAvailable: 'false' },
      { _id: 'co-200', _type: 'page' },
      { _id: 'a-100', _type: 'article', _isOptional: 'true', _isAvailable: 'false' },
      { _id: 'a-200', _type: 'article' },
      { _id: 'b-100', _type: 'block', _isOptional: 'true', _isAvailable: 'false' },
      { _id: 'b-200', _type: 'block' },
      { _id: 'c-100', _type: 'component', _isOptional: 'true', _isAvailable: 'false' },
      { _id: 'c-200', _type: 'component' }
    ]
  });

  testSuccessWhere('non/configured contentObjects/articles/blocks/components and empty config', {
    content: [
      { _type: 'course' },
      { _type: 'config' },
      { _id: 'co-100', _type: 'page', _isOptional: 'true', _isAvailable: 'false' },
      { _id: 'co-200', _type: 'page' },
      { _id: 'a-100', _type: 'article', _isOptional: 'true', _isAvailable: 'false' },
      { _id: 'a-200', _type: 'article' },
      { _id: 'b-100', _type: 'block', _isOptional: 'true', _isAvailable: 'false' },
      { _id: 'b-200', _type: 'block' },
      { _id: 'c-100', _type: 'component', _isOptional: 'true', _isAvailable: 'false' },
      { _id: 'c-200', _type: 'component' }
    ]
  });

  testStopWhere('no contentObjects', {
    content: [{ _type: 'course' }]
  });
});
