import { checkContent, describe, getConfig, getCourse, mutateContent, testStopWhere, testSuccessWhere, whereContent } from 'adapt-migrations';
import _ from 'lodash';

describe('core - update to v4.0.0', async () => {
  let course, config;
  const scrollContainer = {
    _isEnabled: false,
    _limitToSelector: ''
  };
  const redundantAriaLabels = [
    'navigation',
    'menuLoaded',
    'menu',
    'page',
    'pageLoaded',
    'pageEnd',
    'navigationBack',
    'accessibilityToggleButton',
    'feedbackPopUp',
    'menuBack',
    'menuIndicatorHeading'
  ];
  const newAriaLabels = {
    answeredIncorrectly: 'You answered incorrectly',
    answeredCorrectly: 'You answered correctly',
    selectedAnswer: 'selected',
    unselectedAnswer: 'not selected'
  };

  whereContent('core - where course', async (content) => {
    course = getCourse();
    config = getConfig();
    return course || config;
  });

  mutateContent('core - add course._scrollingContainer', async (content) => {
    if (!_.has(course, '_scrollingContainer')) _.set(course, '_scrollingContainer', scrollContainer);
    return true;
  });

  mutateContent('core - remove course._globals._accessibility.accessibilityToggleTextOn/Off', async (content) => {
    _.unset(course, '_globals._accessibility.accessibilityToggleTextOn');
    _.unset(course, '_globals._accessibility.accessibilityToggleTextOff');
    return true;
  });

  mutateContent('core - remove course._globals._accessibility._accessibilityInstructions', async (content) => {
    _.unset(course, '_globals._accessibility._accessibilityInstructions');
    return true;
  });

  mutateContent('core - remove redundant course._globals._accessibility._ariaLabels', async (content) => {
    redundantAriaLabels.forEach(label => {
      _.unset(course, `_globals._accessibility._ariaLabels.${label}`);
    });
    return true;
  });

  mutateContent('core - add new course._globals._accessibility._ariaLabels', async (content) => {
    _.merge(course._globals._accessibility._ariaLabels, newAriaLabels);
    return true;
  });

  checkContent('core - check course._scrollingContainer', async (content) => {
    const isValid = _.has(course, '_scrollingContainer');
    if (!isValid) throw new Error('core - course._scrollingContainer not added');
    return true;
  });

  checkContent('core - check course._globals._accessibility.accessibilityToggleTextOn/Off', async (content) => {
    const isValid =
      !_.has(course, '_globals._accessibility.accessibilityToggleTextOn') &&
      !_.has(course, '_globals._accessibility.accessibilityToggleTextOff');
    if (!isValid) throw new Error('core - course._globals._accessibility.accessibilityToggleTextOn/Off not removed');
    return true;
  });

  checkContent('core - check course._globals._accessibility._accessibilityInstructions', async (content) => {
    const isValid = !_.has(course, '_globals._accessibility._accessibilityInstructions');
    if (!isValid) throw new Error('core - course._globals._accessibility._accessibilityInstructions not removed');
    return true;
  });

  checkContent('core - check redundant course._globals._accessibility._ariaLabels', async (content) => {
    const isValid = redundantAriaLabels.every(label => !_.has(course, `_globals._accessibility._ariaLabels.${label}`));
    if (!isValid) throw new Error('core - course._globals._accessibility._ariaLabels not removed');
    return true;
  });

  checkContent('core - check new course._globals._accessibility._ariaLabels', async (content) => {
    const isValid = newAriaLabels.every((value, key) => _.get(course, `_globals._accessibility._ariaLabels.${key}`) === value);
    if (!isValid) throw new Error('core - course._globals._accessibility._ariaLabels not added');
    return true;
  });

  testSuccessWhere('empty course/config', {
    content: [
      { _type: 'course' },
      { _type: 'config' }
    ]
  });

  testStopWhere('no course', {
    content: [{ _type: 'config' }]
  });
});

describe('core - update to v4.2.0', async () => {
  let course;

  whereContent('core - where course', async (content) => {
    course = getCourse();
    return course;
  });

  mutateContent('core - add course._shareWithUsers', async (content) => {
    if (!_.has(course, '_shareWithUsers')) _.set(course, '_shareWithUsers', []);
    return true;
  });

  checkContent('core - check course._shareWithUsers', async (content) => {
    const isValid = _.has(course, '_shareWithUsers');
    if (!isValid) throw new Error('core - course._shareWithUsers not added');
    return true;
  });

  testSuccessWhere('empty course', {
    content: [
      { _type: 'course' }
    ]
  });

  testSuccessWhere('with course._shareWithUsers', {
    content: [
      { _type: 'course', _shareWithUsers: [] }
    ]
  });

  testStopWhere('no course', {
    content: [{ _type: 'config' }]
  });
});

describe('core - update to v4.3.0', async () => {
  let config;

  whereContent('core - where config', async (content) => {
    config = getConfig();
    return config;
  });

  mutateContent('core - add config._accessibility._ariaLevels._notify', async (content) => {
    if (!_.has(config, '_accessibility._ariaLevels._notify')) _.set(config, '_accessibility._ariaLevels._notify', 1);
    return true;
  });

  checkContent('core - check config._accessibility._ariaLevels._notify', async (content) => {
    const isValid = _.has(config, '_accessibility._ariaLevels._notify');
    if (!isValid) throw new Error('core - config._accessibility._ariaLevels._notify not added');
    return true;
  });

  testSuccessWhere('empty config', {
    content: [
      { _type: 'config' }
    ]
  });

  testSuccessWhere('with config._accessibility._ariaLevels', {
    content: [
      { _type: 'config', _accessibility: { _ariaLevels: {} } }
    ]
  });

  testStopWhere('no config', {
    content: [{ _type: 'course' }]
  });
});

describe('core - update to v4.4.0', async () => {
  let config;

  whereContent('core - where config', async (content) => {
    config = getConfig();
    return config;
  });

  mutateContent('core - add config._accessibility._options', async (content) => {
    if (!_.has(config, '_accessibility._options')) _.set(config, '_accessibility._options', {});
    return true;
  });

  checkContent('core - check config._accessibility._options', async (content) => {
    const isValid = _.has(config, '_accessibility._options');
    if (!isValid) throw new Error('core - config._accessibility._options not added');
    return true;
  });

  testSuccessWhere('empty config', {
    content: [
      { _type: 'config' }
    ]
  });

  testSuccessWhere('with config._accessibility', {
    content: [
      { _type: 'config', _accessibility: {} }
    ]
  });

  testStopWhere('no config', {
    content: [{ _type: 'course' }]
  });
});
