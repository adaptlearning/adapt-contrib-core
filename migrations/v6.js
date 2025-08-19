import { describe, whereContent, whereFromPlugin, mutateContent, checkContent, updatePlugin, getCourse, testSuccessWhere, testStopWhere, getConfig } from 'adapt-migrations';
import _ from 'lodash';

describe('core - update to v6.22.0', async () => {
  let course;
  const defaultNavigation = {
    _isDefaultNavigationDisabled: false,
    _navigationAlignment: 'top',
    _isBottomOnTouchDevices: false
  };

  whereFromPlugin('core - from less than v6.22.0', { name: 'adapt-contrib-core', version: '<6.22.0' });

  whereContent('core - where course', async (content) => {
    course = getCourse();
    return course;
  });

  mutateContent('core - add course._navigation', async (content) => {
    _.set(course, '_navigation', defaultNavigation);
    return true;
  });

  checkContent('core - check course._navigation', async (content) => {
    const isValid = _.get(course, '_navigation');
    if (!isValid) throw new Error('core - missing _navigation');
    return true;
  });

  updatePlugin('core - update to v6.22.0', { name: 'adapt-contrib-core', version: '6.22.0', framework: '>=5.20.2' });

  testSuccessWhere('correct version with empty course', {
    fromPlugins: [{ name: 'adapt-contrib-core', version: '6.21.0' }],
    content: [
      { _type: 'course' }
    ]
  });

  testStopWhere('incorrect version', {
    fromPlugins: [{ name: 'adapt-contrib-core', version: '6.22.0' }]
  });

  testStopWhere('no course', {
    content: [{ _type: 'config' }]
  });
});

describe('core - update to v6.24.2', async () => {
  let course;

  whereFromPlugin('core - from less than v6.24.2', { name: 'adapt-contrib-core', version: '<6.24.2' });

  whereContent('core - where course', async (content) => {
    course = getCourse();
    return course;
  });

  mutateContent('core - add course._extensions._drawer._navTooltip', async (content) => {
    if (_.get(course, '_extensions._drawer._navOrder', 0) !== 0) return true;
    _.set(course, '_extensions._drawer._navOrder', 100);
    return true;
  });

  mutateContent('core - add course._extensions._navigation', async (content) => {
    _.set(course, '_extensions._navigation', {});
    return true;
  });

  mutateContent('core - add course._extensions._navigation._skipButton._navOrder', async (content) => {
    _.set(course, '_extensions._navigation._skipButton._navOrder', -100);
    return true;
  });

  mutateContent('core - add course._extensions._navigation._backButton._navOrder', async (content) => {
    _.set(course, '_extensions._navigation._backButton._navOrder', 0);
    return true;
  });

  mutateContent('core - add course._extensions._navigation._spacers', async (content) => {
    const defaultSpacers = [ { _navOrder: 0 } ];
    _.set(course, '_extensions._navigation._spacers', defaultSpacers);
    return true;
  });

  checkContent('core - check course._extensions._drawer._navTooltip', async (content) => {
    const isInvalid = _.get(course, '_extensions._drawer._navTooltip') === 0;
    if (isInvalid) throw new Error('core - missing _extensions._drawer._navTooltip');
    return true;
  });

  checkContent('core - check course._extensions._navigation', async (content) => {
    const isValid = _.has(course, '_extensions._navigation');
    if (!isValid) throw new Error('core - missing _extensions._navigation');
    return true;
  });

  checkContent('core - check course._extensions._navigation._skipButton._navOrder', async (content) => {
    const isValid = _.has(course, '_extensions._navigation._skipButton._navOrder');
    if (!isValid) throw new Error('core - missing _extensions._navigation._skipButton._navOrder');
    return true;
  });

  checkContent('core - check course._extensions._navigation._backButton._navOrder', async (content) => {
    const isValid = _.has(course, '_extensions._navigation._backButton._navOrder');
    if (!isValid) throw new Error('core - missing _extensions._navigation._backButton._navOrder');
    return true;
  });

  checkContent('core - check course._extensions._navigation._spacers', async (content) => {
    const isValid = _.has(course, '_extensions._navigation._spacers');
    if (!isValid) throw new Error('core - missing _extensions._navigation._spacers');
    return true;
  });

  updatePlugin('core - update to v6.24.2', { name: 'adapt-contrib-core', version: '6.24.2', framework: '>=5.20.2' });

  testSuccessWhere('correct version with empty course', {
    fromPlugins: [{ name: 'adapt-contrib-core', version: '6.24.1' }],
    content: [
      { _type: 'course' }
    ]
  });

  testStopWhere('incorrect version', {
    fromPlugins: [{ name: 'adapt-contrib-core', version: '6.24.2' }]
  });

  testStopWhere('no course', {
    content: [{ _type: 'config' }]
  });
});

describe('core - update to v6.29.0', async () => {
  let config;

  whereFromPlugin('core - from less than v6.29.0', { name: 'adapt-contrib-core', version: '<6.29.0' });

  whereContent('core - where config', async (content) => {
    config = getConfig();
    return config;
  });

  mutateContent('core - add config._completionCriteria._submitOnEveryAssessmentAttempt', async (content) => {
    _.set(config, '_completionCriteria._submitOnEveryAssessmentAttempt', false);
    return true;
  });

  checkContent('core - check config._completionCriteria._submitOnEveryAssessmentAttempt', async (content) => {
    const isValid = _.has(config, '_completionCriteria._submitOnEveryAssessmentAttempt');
    if (!isValid) throw new Error('core - missing _completionCriteria._submitOnEveryAssessmentAttempt');
    return true;
  });

  updatePlugin('core - update to v6.29.0', { name: 'adapt-contrib-core', version: '6.29.0', framework: '>=5.20.2' });

  testSuccessWhere('correct version with empty config', {
    fromPlugins: [{ name: 'adapt-contrib-core', version: '6.28.0' }],
    content: [
      { _type: 'config' }
    ]
  });

  testStopWhere('incorrect version', {
    fromPlugins: [{ name: 'adapt-contrib-core', version: '6.29.0' }]
  });

  testStopWhere('no config', {
    content: [{ _type: 'course' }]
  });
});

describe('core - update to v6.30.2', async () => {
  let config;

  whereFromPlugin('core - from less than v6.30.2', { name: 'adapt-contrib-core', version: '<6.30.2' });

  whereContent('core - where config', async (content) => {
    config = getConfig();
    return config;
  });

  mutateContent('core - add config._completionCriteria._shouldSubmitScore', async (content) => {
    _.set(config, '_completionCriteria._shouldSubmitScore', false);
    return true;
  });

  checkContent('core - check config._completionCriteria._shouldSubmitScore', async (content) => {
    const isValid = _.has(config, '_completionCriteria._shouldSubmitScore');
    if (!isValid) throw new Error('core - missing _completionCriteria._shouldSubmitScore');
    return true;
  });

  updatePlugin('core - update to v6.30.2', { name: 'adapt-contrib-core', version: '6.30.2', framework: '>=5.20.2' });

  testSuccessWhere('correct version with empty config', {
    fromPlugins: [{ name: 'adapt-contrib-core', version: '6.30.0' }],
    content: [
      { _type: 'config' }
    ]
  });

  testStopWhere('incorrect version', {
    fromPlugins: [{ name: 'adapt-contrib-core', version: '6.30.2' }]
  });

  testStopWhere('no config', {
    content: [{ _type: 'course' }]
  });
});

describe('core - update to v6.33.0', async () => {
  let course;

  whereFromPlugin('core - from less than v6.33.0', { name: 'adapt-contrib-core', version: '<6.33.0' });

  whereContent('core - where course', async (content) => {
    course = getCourse();
    return course;
  });

  mutateContent('core - add course._extensions._drawer._navTooltip', async (content) => {
    const _navTooltip = {
      _enabled: true,
      _text: '{{ariaLabel}}'
    };
    _.set(course, '_extensions._drawer._navTooltip', _navTooltip);
    return true;
  });

  mutateContent('core - add course._extensions._navigation._backNavTooltip', async (content) => {
    const _backNavTooltip = {
      _enabled: true,
      _text: '{{ariaLabel}}'
    };
    _.set(course, '_extensions._navigation._backNavTooltip', _backNavTooltip);
    return true;
  });

  mutateContent('core - add course._tooltips', async (content) => {
    _.set(course, '_tooltips', true);
    return true;
  });

  checkContent('core - check course._extensions._drawer._navTooltip', async (content) => {
    const isValid = _.has(course, '_extensions._drawer._navTooltip');
    if (!isValid) throw new Error('core - missing _extensions._drawer._navTooltip');
    return true;
  });

  checkContent('core - check course._extensions._navigation._backNavTooltip', async (content) => {
    const isValid = _.has(course, '_extensions._navigation._backNavTooltip');
    if (!isValid) throw new Error('core - missing _extensions._navigation._backNavTooltip');
    return true;
  });

  checkContent('core - check course._tooltips', async (content) => {
    const isValid = _.has(course, '_tooltips');
    if (!isValid) throw new Error('core - missing _tooltips');
    return true;
  });

  updatePlugin('core - update to v6.33.0', { name: 'adapt-contrib-core', version: '6.33.0', framework: '>=5.20.2' });

  testSuccessWhere('correct version with empty course', {
    fromPlugins: [{ name: 'adapt-contrib-core', version: '6.32.0' }],
    content: [
      { _type: 'course' }
    ]
  });

  testStopWhere('incorrect version', {
    fromPlugins: [{ name: 'adapt-contrib-core', version: '6.33.0' }]
  });

  testStopWhere('no course', {
    content: [{ _type: 'config' }]
  });
});

describe('core - update to v6.34.0', async () => {
  let course;

  whereFromPlugin('core - from less than v6.34.0', { name: 'adapt-contrib-core', version: '<6.34.0' });

  whereContent('core - where course', async (content) => {
    course = getCourse();
    return course;
  });

  mutateContent('core - add course._navigation._showLabelAtWidth', async (content) => {
    _.set(course, '_navigation._showLabelAtWidth', false);
    return true;
  });

  mutateContent('core - add course._navigation._showLabel', async (content) => {
    _.set(course, '_navigation._showLabel', 'medium');
    return true;
  });

  mutateContent('core - add course._navigation._labelPosition', async (content) => {
    _.set(course, '_navigation._labelPosition', 'auto');
    return true;
  });

  checkContent('core - check course._navigation._showLabel', async (content) => {
    const isValid = _.has(course, '_navigation._showLabel');
    if (!isValid) throw new Error('core - missing _navigation._showLabel');
    return true;
  });

  checkContent('core - check course._navigation._showLabelAtWidth', async (content) => {
    const isValid = _.has(course, '_navigation._showLabelAtWidth');
    if (!isValid) throw new Error('core - missing _navigation._showLabelAtWidth');
    return true;
  });

  checkContent('core - check course._navigation._labelPosition', async (content) => {
    const isValid = _.has(course, '_navigation._labelPosition');
    if (!isValid) throw new Error('core - missing _navigation._labelPosition');
    return true;
  });

  updatePlugin('core - update to v6.34.0', { name: 'adapt-contrib-core', version: '6.34.0', framework: '>=5.20.2' });

  testSuccessWhere('correct version with empty course', {
    fromPlugins: [{ name: 'adapt-contrib-core', version: '6.33.0' }],
    content: [
      { _type: 'course' }
    ]
  });

  testStopWhere('incorrect version', {
    fromPlugins: [{ name: 'adapt-contrib-core', version: '6.34.0' }]
  });

  testStopWhere('no course', {
    content: [{ _type: 'config' }]
  });
});

describe('core - update to v6.36.0', async () => {
  let config;
  const screenSize = {
    small: 0,
    medium: 720,
    large: 960,
    xlarge: 1280
  };

  whereFromPlugin('core - from less than v6.36.0', { name: 'adapt-contrib-core', version: '<6.36.0' });

  whereContent('core - where config', async (content) => {
    config = getConfig();
    return config;
  });

  mutateContent('core - amend config.screenSize small', async (content) => {
    _.set(config, 'screenSize', screenSize);
    return true;
  });

  checkContent('core - check config.screenSize', async (content) => {
    const isValid = _.has(config, 'screenSize');
    if (!isValid) throw new Error('core - missing screenSize');
    return true;
  });

  updatePlugin('core - update to v6.36.0', { name: 'adapt-contrib-core', version: '6.36.0', framework: '>=5.20.2' });

  testSuccessWhere('correct version with empty config', {
    fromPlugins: [{ name: 'adapt-contrib-core', version: '6.35.0' }],
    content: [
      { _type: 'config' }
    ]
  });

  testStopWhere('incorrect version', {
    fromPlugins: [{ name: 'adapt-contrib-core', version: '6.36.0' }]
  });

  testStopWhere('no config', {
    content: [{ _type: 'course' }]
  });
});

describe('core - update to v6.41.3', async () => {
  let configuredModels;

  whereFromPlugin('core - from less than v6.41.3', { name: 'adapt-contrib-core', version: '<6.41.3' });

  whereContent('core - where configuredModels', async (content) => {
    const acceptedTypes = ['article', 'page', 'menu', 'block', 'component', 'course'];
    configuredModels = content.filter(obj => acceptedTypes.includes(obj._type));
    return configuredModels;
  });

  mutateContent('core - remove _disableAccessibilityState attribute', async (content) => {
    configuredModels.forEach(model => {
      _.unset(model, '_disableAccessibilityState');
    });
    return true;
  });

  mutateContent('core - add _isA11yCompletionDescriptionEnabled attribute', async (content) => {
    configuredModels.forEach(model => {
      _.set(model, '_isA11yCompletionDescriptionEnabled', true);
    });
    return true;
  });

  checkContent('core - check _disableAccessibilityState removed', async (content) => {
    const isValid = configuredModels.every(model => !_.has(model, '_disableAccessibilityState'));
    if (!isValid) throw new Error('core - _disableAccessibilityState not removed');
    return true;
  });

  checkContent('core - check _isA11yCompletionDescriptionEnabled added', async (content) => {
    const isValid = configuredModels.every(model => _.has(model, '_isA11yCompletionDescriptionEnabled'));
    if (!isValid) throw new Error('core - _isA11yCompletionDescriptionEnabled missing');
    return true;
  });

  updatePlugin('core - update to v6.41.3', { name: 'adapt-contrib-core', version: '6.41.3', framework: '>=5.20.2' });

  testSuccessWhere('correct version with empty course', {
    fromPlugins: [{ name: 'adapt-contrib-core', version: '6.41.2' }],
    content: [
      { _type: 'course' },
      { _type: 'article', _disableAccessibilityState: false },
      { _type: 'page' },
      { _type: 'menu' },
      { _type: 'block' },
      { _type: 'component' }
    ]
  });

  testStopWhere('incorrect version', {
    fromPlugins: [{ name: 'adapt-contrib-core', version: '6.41.3' }]
  });

  testStopWhere('no course', {
    content: [{ _type: 'config' }]
  });
});

describe('core - update to v6.42.0', async () => {
  let configuredModels;

  whereFromPlugin('core - from less than v6.42.0', { name: 'adapt-contrib-core', version: '<6.42.0' });

  whereContent('core - where configuredModels', async (content) => {
    configuredModels = content.filter(obj => _.has(obj, '_ariaLevel'));
    return configuredModels;
  });

  mutateContent('core - remove _ariaLevel overrides', async (content) => {
    configuredModels.forEach(model => {
      _.unset(model, '_ariaLevel');
    });
    return true;
  });

  checkContent('core - check _ariaLevel removed', async (content) => {
    const isInvalid = configuredModels.every(model => !_.has(model, '_ariaLevel'));
    if (!isInvalid) throw new Error('core - _ariaLevel not removed');
    return true;
  });

  updatePlugin('core - update to v6.42.0', { name: 'adapt-contrib-core', version: '6.42.0', framework: '>=5.20.2' });

  testSuccessWhere('correct version with empty course', {
    fromPlugins: [{ name: 'adapt-contrib-core', version: '6.41.0' }],
    content: [
      { _type: 'course' },
      { _type: 'article', _ariaLevel: 2 },
      { _type: 'page', _ariaLevel: 2 },
      { _type: 'menu', _ariaLevel: 2 },
      { _type: 'block', _ariaLevel: 2 }
    ]
  });

  testStopWhere('incorrect version', {
    fromPlugins: [{ name: 'adapt-contrib-core', version: '6.42.0' }]
  });

  testStopWhere('no course', {
    content: [{ _type: 'config' }]
  });
});

describe('core - update to v6.45.0', async () => {
  let course;

  whereFromPlugin('core - from less than v6.45.0', { name: 'adapt-contrib-core', version: '<6.45.0' });

  whereContent('core - where course', async (content) => {
    course = getCourse();
    return course;
  });

  mutateContent('core - add course._globals._accessibility.altFeedbackTitle', async (content) => {
    _.set(course, '_globals._accessibility.altFeedbackTitle', 'Feedback');
    return true;
  });

  checkContent('core - check course._globals._accessibility.altFeedbackTitle', async (content) => {
    const isValid = _.has(course, '_globals._accessibility.altFeedbackTitle');
    if (!isValid) throw new Error('core - missing _globals._accessibility.altFeedbackTitle');
    return true;
  });

  updatePlugin('core - update to v6.45.0', { name: 'adapt-contrib-core', version: '6.45.0', framework: '>=5.20.2' });

  testSuccessWhere('correct version with empty course', {
    fromPlugins: [{ name: 'adapt-contrib-core', version: '6.44.0' }],
    content: [
      { _type: 'course' }
    ]
  });

  testStopWhere('incorrect version', {
    fromPlugins: [{ name: 'adapt-contrib-core', version: '6.45.0' }]
  });

  testStopWhere('no course', {
    content: [{ _type: 'config' }]
  });
});

describe('core - update to v6.45.7', async () => {
  let config;

  whereFromPlugin('core - from less than v6.45.7', { name: 'adapt-contrib-core', version: '<6.45.7' });

  whereContent('core - where config', async (content) => {
    config = getConfig();
    return config;
  });

  mutateContent('core - add config._drawer._iconClass', async (content) => {
    _.set(config, '_drawer._iconClass', 'icon-list');
    return true;
  });

  checkContent('core - check config._drawer._iconClass', async (content) => {
    const isValid = _.has(config, '_drawer._iconClass');
    if (!isValid) throw new Error('core - missing _drawer._iconClass');
    return true;
  });

  updatePlugin('core - update to v6.45.7', { name: 'adapt-contrib-core', version: '6.45.7', framework: '>=5.20.2' });

  testSuccessWhere('correct version with empty config', {
    fromPlugins: [{ name: 'adapt-contrib-core', version: '6.45.6' }],
    content: [
      { _type: 'config' }
    ]
  });

  testStopWhere('incorrect version', {
    fromPlugins: [{ name: 'adapt-contrib-core', version: '6.45.7' }]
  });

  testStopWhere('no config', {
    content: [{ _type: 'course' }]
  });
});

describe('core - update to v6.46.6', async () => {
  let course;

  whereFromPlugin('core - from less than v6.46.6', { name: 'adapt-contrib-core', version: '<6.46.6' });

  whereContent('core - where course', async (content) => {
    course = getCourse();
    return course;
  });

  mutateContent('core - add course._globals._accessibility._ariaLabels.required', async (content) => {
    _.set(course, '_globals._accessibility._ariaLabels.required', 'Required');
    return true;
  });

  mutateContent('core - add course._globals._accessibility._ariaLabels.optional', async (content) => {
    _.set(course, '_globals._accessibility._ariaLabels.optional', 'Optional');
    return true;
  });

  checkContent('core - check course._globals._accessibility._ariaLabels.required', async (content) => {
    const isValid = _.has(course, '_globals._accessibility._ariaLabels.required');
    if (!isValid) throw new Error('core - missing _globals._accessibility._ariaLabels.required');
    return true;
  });

  checkContent('core - check course._globals._accessibility._ariaLabels.optional', async (content) => {
    const isValid = _.has(course, '_globals._accessibility._ariaLabels.optional');
    if (!isValid) throw new Error('core - missing _globals._accessibility._ariaLabels.optional');
    return true;
  });

  updatePlugin('core - update to v6.46.6', { name: 'adapt-contrib-core', version: '6.46.6', framework: '>=5.20.2' });

  testSuccessWhere('correct version with empty course', {
    fromPlugins: [{ name: 'adapt-contrib-core', version: '6.46.5' }],
    content: [
      { _type: 'course' }
    ]
  });

  testStopWhere('incorrect version', {
    fromPlugins: [{ name: 'adapt-contrib-core', version: '6.46.6' }]
  });

  testStopWhere('no course', {
    content: [{ _type: 'config' }]
  });
});

describe('core - update to v6.60.3', async () => {
  let config;

  whereFromPlugin('core - from less than v6.60.3', { name: 'adapt-contrib-core', version: '<6.60.3' });

  whereContent('core - where config', async (content) => {
    config = getConfig();
    return config;
  });

  mutateContent('core - add config._notify', async (content) => {
    _.set(config, '_notify', {});
    return true;
  });

  checkContent('core - check config._notify', async (content) => {
    const isValid = _.has(config, '_notify');
    if (!isValid) throw new Error('core - missing _notify');
    return true;
  });

  updatePlugin('core - update to v6.60.3', { name: 'adapt-contrib-core', version: '6.60.3', framework: '>=5.20.2' });

  testSuccessWhere('correct version with empty config', {
    fromPlugins: [{ name: 'adapt-contrib-core', version: '6.60.2' }],
    content: [
      { _type: 'config' }
    ]
  });

  testStopWhere('incorrect version', {
    fromPlugins: [{ name: 'adapt-contrib-core', version: '6.60.3' }]
  });

  testStopWhere('no config', {
    content: [{ _type: 'course' }]
  });
});

describe('core - @@CURRENT_VERSION to @@RELEASE_VERSION', async () => {
  let contentModels;

  whereFromPlugin('core - from @@CURRENT_VERSION', { name: 'adapt-contrib-core', version: '<@@RELEASE_VERSION' });

  whereContent('core - where content models', async (content) => {
    const acceptedTypes = ['article', 'page', 'menu', 'block', 'component'];
    contentModels = content.filter(obj => acceptedTypes.includes(obj._type));
    return contentModels.length;
  });

  mutateContent('core - add _ariaLevel attribute', async (content) => {
    contentModels.forEach(model => {
      _.set(model, '_ariaLevel', 0);
    });
    return true;
  });

  checkContent('core - check _ariaLevel added', async (content) => {
    const isValid = contentModels.every(model => _.has(model, '_ariaLevel') && model._ariaLevel === 0);
    if (!isValid) throw new Error('core - _ariaLevel not added to all content models');
    return true;
  });

  updatePlugin('core - update to @@RELEASE_VERSION', { name: 'adapt-contrib-core', version: '@@RELEASE_VERSION', framework: '>=5.20.2' });

  testSuccessWhere('correct version with content models', {
    fromPlugins: [{ name: 'adapt-contrib-core', version: '@@CURRENT_VERSION' }],
    content: [
      { _type: 'course' },
      { _type: 'article' },
      { _type: 'page' },
      { _type: 'menu' },
      { _type: 'block' },
      { _type: 'component', _component: 'text' }
    ]
  });

  testStopWhere('incorrect version', {
    fromPlugins: [{ name: 'adapt-contrib-core', version: '@@RELEASE_VERSION' }]
  });

  testStopWhere('no content models', {
    content: [{ _type: 'config' }]
  });
});
