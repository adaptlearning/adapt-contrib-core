import { checkContent, describe, getConfig, getCourse, mutateContent, testStopWhere, testSuccessWhere, whereContent } from 'adapt-migrations';
import _ from 'lodash';

describe('core - update to v3.0.0', async () => {
  let articles, blocks, components, config, contentObjects, course;
  const newArticleAttributes = {
    instruction: '',
    _isHidden: false,
    _isVisible: true,
    _ariaLevel: 0,
    _onScreen: {
      _isEnabled: false,
      _classes: '',
      _percentInviewVertical: 50
    }
  };
  const newBlockAttributes = {
    instruction: '',
    _isHidden: false,
    _isVisible: true,
    _ariaLevel: 0,
    _onScreen: {
      _isEnabled: false,
      _classes: '',
      _percentInviewVertical: 50
    }
  };
  const newComponentAttributes = {
    _isHidden: false,
    _isVisible: true,
    _ariaLevel: 0,
    _disableAccessibilityState: false,
    _onScreen: {
      _isEnabled: false,
      _classes: '',
      _percentInviewVertical: 50
    }
  };
  const newContentObjectAttributes = {
    instruction: '',
    _isHiddenFromMenu: false,
    _isHidden: false,
    _isVisible: true,
    _ariaLevel: 0,
    _disableAccessibilityState: false,
    _onScreen: {
      _isEnabled: false,
      _classes: '',
      _percentInviewVertical: 50
    }
  };
  const completionCriteria = {
    _requireContentCompleted: true,
    _requireAssessmentCompleted: false
  };
  const redundantConfigAccessibility = [
    '_isEnabledOnTouchDevices',
    '_shouldSupportLegacyBrowsers'
  ];
  const newAriaLevels = {
    _menu: 1,
    _menuItem: 2,
    _page: 1,
    _article: 2,
    _block: 3,
    _component: 4,
    _componentItem: 5
  };
  const redundantAriaLabels = [
    'menu',
    'menuItem',
    'menuViewButton',
    'navigationBack',
    'closeResources',
    'drawerBack',
    'menuBack'
  ];

  whereContent('core - where content, course or config', async (content) => {
    articles = content.filter(obj => obj._type === 'article');
    blocks = content.filter(obj => obj._type === 'block');
    components = content.filter(obj => obj._type === 'component');
    contentObjects = content.filter(obj => ['page', 'menu'].includes(obj._type));
    course = getCourse();
    config = getConfig();

    return (
      [articles, blocks, components, contentObjects].some(arr => arr.length) ||
      course ||
      config
    );
  });

  mutateContent('core - add new article attributes', async (content) => {
    articles.forEach(article => {
      _.mergeWith(article, newArticleAttributes, (objValue, srcValue) => {
        if (objValue !== undefined) return objValue;
      });
    });
    return true;
  });

  mutateContent('core - add new block attributes', async (content) => {
    blocks.forEach(block => {
      _.mergeWith(block, newBlockAttributes, (objValue, srcValue) => {
        if (objValue !== undefined) return objValue;
      });
    });
    return true;
  });

  mutateContent('core - add new component attributes', async (content) => {
    components.forEach(component => {
      _.mergeWith(component, newComponentAttributes, (objValue, srcValue) => {
        if (objValue !== undefined) return objValue;
      });
    });
    return true;
  });

  mutateContent('core - add new contentObject attributes', async (content) => {
    contentObjects.forEach(contentObject => {
      _.mergeWith(contentObject, newContentObjectAttributes, (objValue, srcValue) => {
        if (objValue !== undefined) return objValue;
      });
    });
    return true;
  });

  mutateContent('core - add new completion criteria', async (content) => {
    if (!_.has(config, '_completionCriteria')) _.set(config, '_completionCriteria', completionCriteria);
    return true;
  });

  mutateContent('core - remove redundant config accessibility', async (content) => {
    redundantConfigAccessibility.forEach(label => {
      _.unset(config, `_accessibility.${label}`);
    });
    return true;
  });

  mutateContent('core - add new aria levels', async (content) => {
    if (!_.has(config, '_accessibility._ariaLevels')) _.set(config, '_accessibility._ariaLevels', newAriaLevels);
    return true;
  });

  mutateContent('core - remove redundant course ariaLabels', async (content) => {
    redundantAriaLabels.forEach(label => {
      _.unset(course, `_globals._ariaLabels.${label}`);
    });
    return true;
  });

  mutateContent('core - add incorrect course ariaLabels', async (content) => {
    _.set(course, '_globals._ariaLabels.incorrect', 'Incorrect');
    return true;
  });

  checkContent('core - check new article attributes', async (content) => {
    const isValid = articles.every(article =>
      Object.keys(newArticleAttributes).every(key => _.has(article, key))
    );
    if (!isValid) throw new Error('core - new article attributes not added');
    return true;
  });

  checkContent('core - check new block attributes', async (content) => {
    const isValid = blocks.every(block =>
      Object.keys(newBlockAttributes).every(key => _.has(block, key))
    );
    if (!isValid) throw new Error('core - new block attributes not added');
    return true;
  });

  checkContent('core - check new component attributes', async (content) => {
    const isValid = components.every(component =>
      Object.keys(newComponentAttributes).every(key => _.has(component, key))
    );
    if (!isValid) throw new Error('core - new component attributes not added');
    return true;
  });

  checkContent('core - check new contentObject attributes', async (content) => {
    const isValid = contentObjects.every(contentObject =>
      Object.keys(newContentObjectAttributes).every(key => _.has(contentObject, key))
    );
    if (!isValid) throw new Error('core - new contentObject attributes not added');
    return true;
  });

  checkContent('core - check new completion criteria', async (content) => {
    const isValid = _.has(config, '_completionCriteria');
    if (!isValid) throw new Error('core - new _completionCriteria not added');
    return true;
  });

  checkContent('core - check redundant config accessibility', async (content) => {
    const isValid = redundantConfigAccessibility.every(label => !_.has(config, `_accessibility.${label}`));
    if (!isValid) throw new Error('core - redundant config accessibility not removed');
    return true;
  });

  checkContent('core - check new aria levels', async (content) => {
    const isValid = _.has(config, '_accessibility._ariaLevels');
    if (!isValid) throw new Error('core - new _ariaLevels not added');
    return true;
  });

  checkContent('core - check redundant course ariaLabels', async (content) => {
    const isValid = redundantAriaLabels.every(label => !_.has(course, `_globals._ariaLabels.${label}`));
    if (!isValid) throw new Error('core - redundant course ariaLabels not removed');
    return true;
  });

  checkContent('core - check course ariaLabels incorrect', async (content) => {
    const isValid = _.has(course, '_globals._ariaLabels.incorrect');
    if (!isValid) throw new Error('core - course ariaLabels incorrect not added');
    return true;
  });

  testSuccessWhere('non/partial/configured contentObjects/articles/blocks/components', {
    content: [
      {
        _type: 'course',
        _globals: {
          _ariaLabels: {
            menu: 'menu',
            menuItem: 'menuItem',
            menuViewButton: 'menuViewButton',
            navigationBack: 'navigationBack',
            closeResources: 'closeResources',
            drawerBack: 'drawerBack',
            menuBack: 'menuBack'
          }
        }
      },
      { _type: 'config' },
      { _id: 'co-100', _type: 'page', _isHiddenFromMenu: true },
      { _id: 'co-200', _type: 'page' },
      { _id: 'co-300', _type: 'menu', _isHiddenFromMenu: true },
      { _id: 'co-400', _type: 'menu' },
      { _id: 'a-100', _type: 'article' },
      {
        _id: 'a-200',
        _type: 'article',
        instruction: '',
        _isHidden: true,
        _isVisible: false,
        _ariaLevel: 0,
        _onScreen: {
          _isEnabled: false,
          _classes: '',
          _percentInviewVertical: 50
        }
      },
      { _id: 'b-100', _type: 'block' },
      {
        _id: 'b-200',
        _type: 'block',
        instruction: '',
        _isHidden: false,
        _isVisible: true,
        _ariaLevel: 0,
        _onScreen: {
          _isEnabled: false,
          _classes: '',
          _percentInviewVertical: 50
        }
      },
      { _id: 'c-100', _type: 'component' },
      {
        _id: 'c-200',
        _type: 'component',
        _isHidden: false,
        _isVisible: true,
        _ariaLevel: 0,
        _disableAccessibilityState: false,
        _onScreen: {
          _isEnabled: false,
          _classes: '',
          _percentInviewVertical: 50
        }
      }
    ]
  });

  testSuccessWhere('no contentObjects/articles/blocks/components', {
    content: [{ _type: 'config' }, { _type: 'course' }]
  });

  testStopWhere('no content', {
    content: []
  });
});

describe('core - update to v3.1.0', async () => {
  let contentObjects;

  whereContent('core - where contentObjects', async (content) => {
    contentObjects = content.filter(obj => ['page', 'menu'].includes(obj._type));
    return contentObjects.length;
  });

  mutateContent('core - remove contentObjects._isHiddenFromMenu', async (content) => {
    contentObjects.forEach(contentObject => {
      _.unset(contentObject, '_isHiddenFromMenu');
    });
    return true;
  });

  checkContent('core - check contentObjects._isHiddenFromMenu', async (content) => {
    const isValid = contentObjects.every(contentObject => !_.has(contentObject, '_isHiddenFromMenu'));
    if (!isValid) throw new Error('core - contentObjects._isHiddenFromMenu not added');
    return true;
  });

  testSuccessWhere('non/configured contentObjects', {
    content: [
      { _type: 'course' },
      { _id: 'co-100', _type: 'page', _isHiddenFromMenu: true },
      { _id: 'co-200', _type: 'page' },
      { _id: 'co-300', _type: 'menu', _isHiddenFromMenu: true },
      { _id: 'co-400', _type: 'menu' }
    ]
  });

  testStopWhere('no contentObjects', {
    content: [{ _type: 'config' }]
  });
});
