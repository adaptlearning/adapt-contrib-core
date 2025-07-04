import { checkContent, describe, getConfig, getCourse, mutateContent, testStopWhere, testSuccessWhere, whereContent } from 'adapt-migrations';
import _ from 'lodash';

describe('core - update to v5.0.0', async () => {
  let course, contentObjects;

  whereContent('core - where contentObject or course', async (content) => {
    contentObjects = content.filter((item) => ['page', 'menu'].includes(item._type));
    course = getCourse();
    return course || contentObjects.length;
  });

  mutateContent('core - add contentObject.subtitle', async (content) => {
    contentObjects.forEach((contentObject) => {
      if (_.has(contentObject, 'subtitle')) return true;
      _.set(contentObject, 'subtitle', '');
    });
    return true;
  });

  mutateContent('core - update contentObject._htmlClassName to _htmlClasses', async (content) => {
    contentObjects.forEach((contentObject) => {
      if (_.has(contentObject, '_htmlClasses')) return;
      _.set(contentObject, '_htmlClasses', contentObject._htmlClassName || '');
      _.unset(contentObject, '_htmlClassName');
    });
    return true;
  });

  mutateContent('core - add course subtitle', async (content) => {
    if (_.has(course, 'subtitle')) return true;
    _.set(course, 'subtitle', '');
    return true;
  });

  mutateContent('core - add course instruction', async (content) => {
    if (_.has(course, 'instruction')) return true;
    _.set(course, 'instruction', '');
    return true;
  });

  mutateContent('core - update contentObject._htmlClassName to _htmlClasses', async (content) => {
    if (_.has(course, '_htmlClasses')) return true;
    _.set(course, '_htmlClasses', course._htmlClassName || '');
    _.unset(course, '_htmlClassName');
    return true;
  });

  checkContent('core - check contentObject.subtitle', async (content) => {
    const isValid = contentObjects.every((contentObject) => _.has(contentObject, 'subtitle'));
    if (!isValid) throw new Error('core - contentObject.subtitle not added');
    return true;
  });

  checkContent('core - check contentObject._htmlClasses', async (content) => {
    const isValid = contentObjects.every((contentObject) => _.has(contentObject, '_htmlClasses'));
    if (!isValid) throw new Error('core - contentObject._htmlClasses not added');
    return true;
  });

  checkContent('core - check course.subtitle', async (content) => {
    const isValid = _.has(course, 'subtitle');
    if (!isValid) throw new Error('core - course.subtitle not added');
    return true;
  });

  checkContent('core - check course.instruction', async (content) => {
    const isValid = _.has(course, 'instruction');
    if (!isValid) throw new Error('core - course.instruction not added');
    return true;
  });

  checkContent('core - check course._htmlClasses', async (content) => {
    const isValid = _.has(course, '_htmlClasses');
    if (!isValid) throw new Error('core - course._htmlClasses not added');
    return true;
  });

  testSuccessWhere('empty course no contentObjects', {
    content: [
      { _type: 'course' }
    ]
  });

  testSuccessWhere('default course with non/configured contentObjects', {
    content: [
      { _type: 'course', _htmlClassName: 'htmlClassName', subtitle: 'subtitle', instruction: 'instruction' },
      { _id: 'co-100', _type: 'page', _htmlClassName: 'htmlClassName', subtitle: 'subtitle' },
      { _id: 'co-200', _type: 'page', _htmlClassName: '', subtitle: '' },
      { _id: 'co-300', _type: 'page' },
      { _id: 'co-400', _type: 'menu', _htmlClassName: 'htmlClassName', subtitle: 'subtitle' },
      { _id: 'co-500', _type: 'menu', _htmlClassName: '', subtitle: '' },
      { _id: 'co-600', _type: 'menu' }
    ]
  });

  testSuccessWhere('empty course with non/configured contentObjects', {
    content: [
      { _type: 'course', _htmlClassName: 'htmlClassName' },
      { _id: 'co-100', _type: 'page', _htmlClassName: 'htmlClassName', subtitle: 'subtitle' },
      { _id: 'co-200', _type: 'page', _htmlClassName: '', subtitle: '' },
      { _id: 'co-300', _type: 'page' },
      { _id: 'co-400', _type: 'menu', _htmlClassName: 'htmlClassName', subtitle: 'subtitle' },
      { _id: 'co-500', _type: 'menu', _htmlClassName: '', subtitle: '' },
      { _id: 'co-600', _type: 'menu' }
    ]
  });

  testStopWhere('no course or contentObjects', {
    content: [{ _type: 'config' }]
  });
});

describe('core - update to v5.3.0', async () => {
  let config;

  whereContent('core - where config', async (content) => {
    config = getConfig();
    return config;
  });

  mutateContent('core - add config._logging._warnFirstOnly', async (content) => {
    if (_.has(config, '_logging._warnFirstOnly')) return true;
    _.set(config, '_logging._warnFirstOnly', true);
    return true;
  });

  checkContent('core - check config._logging._warnFirstOnly', async (content) => {
    const isValid = _.has(config, '_logging._warnFirstOnly');
    if (!isValid) throw new Error('core - _logging._warnFirstOnly not added');
    return true;
  });

  testSuccessWhere('empty config', {
    content: [
      { _type: 'config' }
    ]
  });

  testSuccessWhere('default config._logging._warnFirstOnly', {
    content: [
      { _type: 'config', _logging: { _warnFirstOnly: true } }
    ]
  });

  testStopWhere('no config', {
    content: [{ _type: 'course' }]
  });
});

describe('core - update to v5.4.0', async () => {
  let components, config, requireCompletionOfModels;

  whereContent('core - where config', async (content) => {
    config = getConfig();
    return config;
  });

  mutateContent('core - add config._accessibility._fixes._imgLazyLoad', async (content) => {
    if (_.has(config, '_accessibility._fixes._imgLazyLoad')) return true;
    _.set(config, '_accessibility._fixes._imgLazyLoad', true);
    return true;
  });

  mutateContent('core - add _requireCompletionOf to models', async (content) => {
    const models = ['article', 'block', 'page', 'menu', 'course'];
    requireCompletionOfModels = content.filter((item) => models.includes(item._type));
    requireCompletionOfModels.forEach((item) => {
      if (!_.has(item, '_requireCompletionOf')) _.set(item, '_requireCompletionOf', -1);
    });
    return true;
  });

  mutateContent('core - add _isResetOnRevisit to component', async (content) => {
    components = content.filter((item) => item._type === 'component');
    components.forEach((item) => {
      if (!_.has(item, '_isResetOnRevisit')) _.set(item, '_isResetOnRevisit', 'false');
    });
    return true;
  });

  checkContent('core - check config._accessibility._fixes._imgLazyLoad', async (content) => {
    const isValid = _.has(config, '_accessibility._fixes._imgLazyLoad');
    if (!isValid) throw new Error('core - _accessibility._fixes._imgLazyLoad not added');
    return true;
  });

  checkContent('core - check requireCompletionOfModels', async (content) => {
    const isValid = requireCompletionOfModels.every((item) => _.has(item, '_requireCompletionOf'));
    if (!isValid) throw new Error('core - _requireCompletionOf not added');
    return true;
  });

  checkContent('core - check _isResetOnRevisit on components', async (content) => {
    const isValid = components.every((item) => _.has(item, '_isResetOnRevisit'));
    if (!isValid) throw new Error('core - _isResetOnRevisit not added');
    return true;
  });

  testSuccessWhere('empty config with content', {
    content: [
      { _type: 'config' },
      { _id: 'c-100', _type: 'component' },
      { _id: 'c-105', _type: 'component', _isResetOnRevisit: 'false' },
      { _id: 'b-100', _type: 'block' },
      { _id: 'a-100', _type: 'article' },
      { _id: 'co-100', _type: 'page' },
      { _id: 'co-200', _type: 'menu' }

    ]
  });

  testSuccessWhere('default config._accessibility._fixes._imgLazyLoad', {
    content: [
      { _type: 'config', _accessibility: { _fixes: { _imgLazyLoad: true } } }
    ]
  });

  testStopWhere('no config', {
    content: [{ _type: 'course' }]
  });
});

describe('core - update to v5.6.0', async () => {
  let config;

  whereContent('core - where config', async (content) => {
    config = getConfig();
    return config;
  });

  mutateContent('core - add config._accessibility._ariaLevels._menuGroup', async (content) => {
    if (_.has(config, '_accessibility._ariaLevels._menuGroup')) return true;
    _.set(config, '_accessibility._ariaLevels._menuGroup', 2);
    return true;
  });

  checkContent('core - check config._accessibility._ariaLevels._menuGroup', async (content) => {
    const isValid = _.has(config, '_accessibility._ariaLevels._menuGroup');
    if (!isValid) throw new Error('core - _accessibility._ariaLevels._menuGroup not added');
    return true;
  });

  testSuccessWhere('empty config', {
    content: [
      { _type: 'config' }
    ]
  });

  testSuccessWhere('default config._accessibility._ariaLevels._menuGroup', {
    content: [
      { _type: 'config', _accessibility: { _ariaLevels: { _menuGroup: 2 } } }
    ]
  });

  testStopWhere('no config', {
    content: [{ _type: 'course' }]
  });
});

describe('core - update to v5.8.0', async () => {
  let config;

  whereContent('core - where config', async (content) => {
    config = getConfig();
    return config;
  });

  mutateContent('core - add config._accessibility._isTextProcessorEnabled', async (content) => {
    _.unset(config, '_accessibility._isTextProcessorEnabled');
    return true;
  });

  checkContent('core - check config._accessibility._isTextProcessorEnabled', async (content) => {
    const isInvalid = _.has(config, '_accessibility._isTextProcessorEnabled');
    if (isInvalid) throw new Error('core - _accessibility._isTextProcessorEnabled not removed');
    return true;
  });

  testSuccessWhere('empty config', {
    content: [
      { _type: 'config' }
    ]
  });

  testSuccessWhere('default config._accessibility._isTextProcessorEnabled', {
    content: [
      { _type: 'config', _accessibility: { _isTextProcessorEnabled: true } }
    ]
  });

  testStopWhere('no config', {
    content: [{ _type: 'course' }]
  });
});

describe('core - update to v5.12.0', async () => {
  const newHideCorrectAnswer = 'Show your answer';
  const newHideCorrectAnswerAria = 'Show your answer';
  const newShowCorrectAnswer = 'Show correct answer';
  const originalHideCorrectAnswer = 'My answer';
  const originalHideCorrectAnswerAria = 'Hide correct answer';
  const originalShowCorrectAnswer = 'Correct answer';
  let course;

  whereContent('core - where course', async (content) => {
    course = getCourse();
    return course;
  });

  mutateContent('core - add course._buttons._showCorrectAnswer.buttonText', async (content) => {
    if (_.has(course, '_buttons._showCorrectAnswer.buttonText') &&
        _.get(course, '_buttons._showCorrectAnswer.buttonText') !== originalShowCorrectAnswer) {
      return true;
    };
    _.set(course, '_buttons._showCorrectAnswer.buttonText', newShowCorrectAnswer);
    return true;
  });

  mutateContent('core - add course._buttons._hideCorrectAnswer.buttonText', async (content) => {
    if (_.has(course, '_buttons._hideCorrectAnswer.buttonText') &&
        _.get(course, '_buttons._hideCorrectAnswer.buttonText') !== originalHideCorrectAnswer) {
      return true;
    };
    _.set(course, '_buttons._hideCorrectAnswer.buttonText', newHideCorrectAnswer);
    return true;
  });

  mutateContent('core - add course._buttons._hideCorrectAnswer.ariaLabel', async (content) => {
    if (_.has(course, '_buttons._hideCorrectAnswer.ariaLabel') &&
        _.get(course, '_buttons._hideCorrectAnswer.ariaLabel') !== originalHideCorrectAnswerAria) {
      return true;
    };
    _.set(course, '_buttons._hideCorrectAnswer.ariaLabel', newHideCorrectAnswerAria);
    return true;
  });

  checkContent('core - check course._buttons._showCorrectAnswer.buttonText', async (content) => {
    const isValid = _.get(course, '_buttons._showCorrectAnswer.buttonText') !== originalShowCorrectAnswer;
    if (!isValid) throw new Error('core - _buttons._showCorrectAnswer.buttonText not modified');
    return true;
  });

  checkContent('core - check course._buttons._hideCorrectAnswer.buttonText', async (content) => {
    const isValid = _.get(course, '_buttons._hideCorrectAnswer.buttonText') !== originalHideCorrectAnswer;
    if (!isValid) throw new Error('core - _buttons._hideCorrectAnswer.buttonText not modified');
    return true;
  });

  checkContent('core - check course._buttons._hideCorrectAnswer.ariaLabel', async (content) => {
    const isValid = _.get(course, '_buttons._hideCorrectAnswer.ariaLabel') !== originalHideCorrectAnswerAria;
    if (!isValid) throw new Error('core - _buttons._hideCorrectAnswer.ariaLabel not modified');
    return true;
  });

  testSuccessWhere('empty course', {
    content: [
      { _type: 'course' }
    ]
  });

  testSuccessWhere('default course._buttons', {
    content: [
      { _type: 'course', _buttons: { _showCorrectAnswer: { buttonText: originalShowCorrectAnswer }, _hideCorrectAnswer: { buttonText: originalHideCorrectAnswer, ariaLabel: originalHideCorrectAnswerAria } } }
    ]
  });

  testSuccessWhere('custom course._buttons', {
    content: [
      { _type: 'course', _buttons: { _showCorrectAnswer: { buttonText: 'custom text' }, _hideCorrectAnswer: { buttonText: 'custom text', ariaLabel: 'custom text' } } }
    ]
  });

  testStopWhere('no course', {
    content: [{ _type: 'config' }]
  });
});
