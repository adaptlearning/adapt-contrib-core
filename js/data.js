/**
 * @file Data Service - Central data store and model collection manager
 * @module core/js/data
 * @description Singleton service managing all course content models in the Adapt Learning Framework.
 * Loads JSON data files, instantiates models, provides lookup utilities, and validates data integrity.
 *
 * **Architecture:**
 * - Singleton collection extending AdaptCollection (Backbone.Collection)
 * - Contains all course content models (course, contentObjects, articles, blocks, components)
 * - Maintains fast lookup index (`_byAdaptID`) for O(1) model retrieval
 * - Coordinates data loading sequence with config and build services
 * - Validates data integrity (duplicate IDs, orphaned content, missing parents)
 *
 * **Data Loading Sequence:**
 * 1. Load build.min.js (framework version, course directory)
 * 2. Load config.json (language, settings)
 * 3. Load language_data_manifest.js (list of JSON files)
 * 4. Load all JSON files in parallel (course, contentObjects, etc.)
 * 5. Instantiate course model first (allows other models to access course config)
 * 6. Instantiate remaining models using component registry
 * 7. Validate data integrity (check IDs, tracking IDs, parent references)
 * 8. Trigger app:dataLoaded (models can setup)
 * 9. Trigger app:dataReady (framework can start)
 *
 * **Model Instantiation:**
 * - Uses components.getModelClass() to determine model type from JSON
 * - Respects _component, _type, _model properties for type resolution
 * - Falls back to LockingModel if no registered model class
 *
 * **Public Events Triggered:**
 * - `loading` - Starting to load data files
 * - `loaded` - Finished loading data files
 * - `reset` - Collection reset with new data
 * - `ready` - Data service ready for use
 * - `courseModel:dataLoading` - About to create course model
 * - `courseModel:dataLoaded` - Course model created
 * - `app:dataLoaded` - All models instantiated, can call setupModel()
 * - `app:dataReady` - All models ready, framework can start
 * - `app:languageChanged` - Language changed, data reloaded
 *
 * **Properties:**
 * - `isReady` {boolean} - Service has completed initialization
 * - `_byAdaptID` {Object} - Fast lookup index mapping _id to model
 * - `Adapt.course` {CourseModel} - Course model (set during load)
 * - `Adapt.config` {ConfigModel} - Config model (set during load)
 * - `Adapt.build` {BuildModel} - Build metadata (set during load)
 *
 * @example
 * import data from 'core/js/data';
 *
 * await data.whenReady();
 * const model = data.findById('c-05');
 * console.log(model.get('title'));
 *
 * @example
 * data.on('ready', () => {
 *   console.log('Data loaded, models ready');
 * });
 */
import Adapt from 'core/js/adapt';
import offlineStorage from 'core/js/offlineStorage';
import wait from 'core/js/wait';
import components from 'core/js/components';
import AdaptCollection from 'core/js/collections/adaptCollection';
import BuildModel from 'core/js/models/buildModel';
import ConfigModel from 'core/js/models/configModel';
import LockingModel from 'core/js/models/lockingModel';
import logging from 'core/js/logging';
import location from 'core/js/location';
import _ from 'underscore';

/**
 * @class Data
 * @classdesc Central data store managing all course content models.
 * Singleton instance exported as `data`. Do not instantiate directly.
 * @extends {AdaptCollection}
 */
class Data extends AdaptCollection {

  /**
   * Factory method for creating models from JSON data.
   * Called by Backbone.Collection when adding items to the collection.
   * Uses component registry to determine appropriate model class.
   *
   * **Type Resolution:**
   * 1. Call components.getModelClass(json) to resolve model type
   * 2. Check _component, _type, _model properties
   * 3. Look up registered model class in component registry
   * 4. Fall back to LockingModel if no registration found
   *
   * @param {Object} json - Raw JSON data for model
   * @returns {Backbone.Model} Instantiated model of appropriate type
   * @private
   */
  model(json) {
    const ModelClass = components.getModelClass(json);
    if (!ModelClass) {
      return new LockingModel(json);
    }
    return new ModelClass(json, { parse: true });
  }

  initialize() {
    super.initialize();
    this.findById = this.findById.bind(this);
    this.findViewByModelId = this.findViewByModelId.bind(this);
    this.findByTrackingPosition = this.findByTrackingPosition.bind(this);
    this.on({
      add: this.onAdded,
      remove: this.onRemoved
    });
  }

  /**
   * Initializes the data loading sequence.
   * Loads build metadata, sets framework version, and loads config data.
   * Called by app.js during framework bootstrap.
   *
   * @async
   * @throws {Error} If build.min.js cannot be loaded
   * @throws {Error} If config.json cannot be loaded
   * @example
   * import data from 'core/js/data';
   * await data.init();
   */
  async init () {
    this.reset();
    this._byAdaptID = {};
    Adapt.build = new BuildModel(null, { url: `adapt/js/build.min.js?timestamp=${Date.now()}`, reset: true });
    await Adapt.build.whenReady();
    $('html').attr('data-adapt-framework-version', Adapt.build.get('package').version);
    this.loadConfigData();
  }

  /**
   * Handles model addition to collection.
   * Updates fast lookup index when model added.
   * @param {Backbone.Model} model - Model being added
   * @private
   */
  onAdded(model) {
    this._byAdaptID[model.get('_id')] = model;
  }

  /**
   * Handles model removal from collection.
   * Updates fast lookup index when model removed.
   * @param {Backbone.Model} model - Model being removed
   * @private
   */
  onRemoved(model) {
    delete this._byAdaptID[model.get('_id')];
  }

  /**
   * Loads config.json and sets up configuration change listeners.
   * Creates ConfigModel instance and listens for language/direction changes.
   * Called by init() after build metadata loads.
   * @private
   */
  loadConfigData() {
    Adapt.config = new ConfigModel(null, { url: Adapt.build.get('coursedir') + '/config.' + Adapt.build.get('jsonext') + `?timestamp=${Adapt.build.get('timestamp')}`, reset: true });
    this.listenToOnce(Adapt, 'configModel:loadCourseData', this.onLoadCourseData);
    this.listenTo(Adapt.config, {
      'change:_activeLanguage': this.onLanguageChange,
      'change:_defaultDirection': this.onDirectionChange
    });
  }

  /**
   * Handles text direction changes.
   * Updates html element classes and dir attribute when _defaultDirection changes.
   * @param {ConfigModel} model - Config model
   * @param {string} direction - New direction ('rtl' or 'ltr')
   * @private
   */
  onDirectionChange(model, direction) {
    if (direction === 'rtl') {
      $('html').removeClass('dir-ltr').addClass('dir-rtl').attr('dir', 'rtl');
    } else {
      $('html').removeClass('dir-rtl').addClass('dir-ltr').attr('dir', 'ltr');
    }
  }

  /**
   * Handles configModel:loadCourseData event to start course data loading.
   * Ensures _activeLanguage is set before loading course data.
   * If no language set, applies _defaultLanguage from config.json.
   * @private
   */
  onLoadCourseData() {
    if (!Adapt.config.get('_activeLanguage')) {
      Adapt.config.set('_activeLanguage', Adapt.config.get('_defaultLanguage'));
      return;
    }
    this.loadCourseData();
  }

  /**
   * Handles language changes and reloads course data.
   * Saves new language to offline storage and resets framework state.
   * @param {ConfigModel} model - Config model
   * @param {string} language - New language code
   * @async
   * @private
   */
  async onLanguageChange(model, language) {
    await wait.queue();
    const previousAttributes = model.previousAttributes();
    const previousLanguage = previousAttributes._activeLanguage;
    offlineStorage.set('lang', language);
    // set `_isStarted` back to `false` when changing language so that the learner's answers
    // to questions get restored in the new language when `_restoreStateOnLanguageChange: true`
    // see https://github.com/adaptlearning/adapt_framework/issues/2977
    if (Adapt.get('_isStarted')) {
      Adapt.set('_isStarted', false);
    }
    await this.loadCourseData(language, previousLanguage);
  }

  // All code that needs to run before adapt starts should go here

  /**
   * Loads course data files for the active language.
   * Orchestrates the complete data loading sequence.
   *
   * **Loading Sequence:**
   * 1. Load language_data_manifest.js (list of JSON files)
   * 2. Load all JSON files in parallel
   * 3. Instantiate course model first
   * 4. Instantiate remaining models
   * 5. Validate data integrity
   * 6. Trigger app:dataLoaded event
   * 7. Trigger app:dataReady event
   * 8. Mark service as ready
   *
   * @param {string} [newLanguage] - New language code if language changed
   * @param {string} [previousLanguage] - Previous language code if language changed
   * @async
   * @private
   */
  async loadCourseData(newLanguage, previousLanguage) {

    const language = Adapt.config.get('_activeLanguage');

    const courseFolder = Adapt.build.get('coursedir') + '/' + language + '/';

    $('html').attr('lang', language);

    await this.loadManifestFiles(courseFolder);
    await this.triggerDataLoaded();
    await this.triggerDataReady(newLanguage, previousLanguage);
    this.triggerInit();

  }

  /**
   * Loads a JSON file via AJAX.
   * Wraps jQuery.getJSON in a Promise and adds __path__ property to loaded data.
   * @param {string} path - Path to JSON file
   * @returns {Promise<Object>} Loaded JSON data with __path__ property
   * @throws {Error} If file not found (404) or network request fails
   * @throws {SyntaxError} If JSON data is malformed
   * @private
   */
  getJSON(path) {
    return new Promise((resolve, reject) => {
      $.getJSON(path, data => {
        // Add path to data in case it's necessary later
        data.__path__ = path;
        resolve(data);
      }).fail(() => {
        reject(new Error(`Unable to load ${path}`));
      });
    });
  }

  /**
   * Loads all course content JSON files for a language.
   * Reads manifest file for list of JSON files, loads them in parallel,
   * flattens data, creates models, and validates integrity.
   *
   * **Manifest Fallback:**
   * If manifest file not found, falls back to traditional file list:
   * course.json, contentObjects.json, articles.json, blocks.json, components.json
   *
   * @param {string} languagePath - Path to language folder (e.g., 'course/en/')
   * @async
   * @throws {Error} If manifest file not found and fallback files not found
   * @throws {Error} If JSON files fail to load
   * @throws {SyntaxError} If JSON data is malformed
   * @fires loading
   * @fires reset
   * @fires loaded
   * @private
   */
  async loadManifestFiles(languagePath) {
    this.trigger('loading');
    this.reset();
    this._byAdaptID = {};
    const manifestPath = languagePath + 'language_data_manifest.js';
    let manifest;
    try {
      manifest = await this.getJSON(manifestPath);
    } catch (err) {
      manifest = ['course.json', 'contentObjects.json', 'articles.json', 'blocks.json', 'components.json'];
      logging.error(`Manifest path '${manifestPath} not found. Using traditional files: ${manifest.join(', ')}`);
    }
    let allFileData;
    try {
      allFileData = await Promise.all(manifest.map(filePath => {
        return this.getJSON(`${languagePath}${filePath}?timestamp=${Adapt.build.get('timestamp')}`);
      }));
    } catch (error) {
      logging.error(error);
      return;
    }
    // Flatten all file data into a single array of model data
    const allModelData = allFileData.reduce((result, fileData) => {
      if (Array.isArray(fileData)) {
        fileData.forEach((datum, index) => {
          datum.__path__ = fileData.__path__;
          datum.__index__ = index;
        });
        result.push(...fileData);
      } else if (fileData instanceof Object) {
        result.push(fileData);
      } else {
        logging.warnOnce(`File data isn't an array or object: ${fileData.__path__}`);
      }
      return result;
    }, []);
    // Add course model first to allow other model/views to utilize its settings
    const course = allModelData.find(modelData => modelData._type === 'course');
    if (!course) {
      throw new Error('Expected a model data with "_type": "course", none found.');
    }
    Adapt.trigger('courseModel:dataLoading');
    Adapt.course = this.push(course);
    Adapt.trigger('courseModel:dataLoaded');
    // Add other models
    allModelData.forEach(modelData => {
      if (modelData._type === 'course') {
        return;
      }
      try {
        components.getModelName(modelData);
      } catch (error) {
        logging.error(`Failed to load object ${modelData.__path__}${Object.hasOwn(modelData, '__index__') ? `[${modelData.__index__}]` : ''}`);
        logging.error(error);
        return;
      }
      this.push(modelData);
    });
    this.checkData();
    this.trigger('reset');
    this.trigger('loaded');
    await wait.queue();
  }

  /**
   * Triggers app:dataLoaded event after all models instantiated.
   * Calls setupModel() on each model to allow initialization logic.
   * Extensions can listen to this event to setup listeners on new models.
   * @async
   * @fires app:dataLoaded
   * @private
   */
  async triggerDataLoaded() {
    // Setup the newly added models
    logging.debug('Firing app:dataLoaded');
    try {
      this.forEach(model => model.setupModel?.());
      await wait.queue();
      Adapt.trigger('app:dataLoaded');
    } catch (e) {
      logging.error('Error during app:dataLoading trigger', e);
    }
    await wait.queue();
  }

  /**
   * Triggers app:dataReady event to signal framework can start.
   * If language changed, triggers app:languageChanged first.
   * Extensions can listen to this event to perform final setup before framework starts.
   * @param {string} [newLanguage] - New language code if changed
   * @param {string} [previousLanguage] - Previous language code if changed
   * @async
   * @fires app:languageChanged
   * @fires app:dataReady
   * @private
   */
  async triggerDataReady(newLanguage, previousLanguage) {
    if (newLanguage) {
      Adapt.trigger('app:languageChanged', newLanguage, previousLanguage);
      await wait.queue();
    }
    logging.debug('Firing app:dataReady');
    try {
      Adapt.trigger('app:dataReady');
    } catch (e) {
      logging.error('Error during app:dataReady trigger', e);
    }
    await wait.queue();
  }

  /**
   * Marks data service as ready and triggers ready event.
   * Called after all data loading and setup completes.
   * @fires ready
   * @private
   */
  triggerInit() {
    this.isReady = true;
    this.trigger('ready');
  }

  /**
   * Returns a Promise that resolves when data service is ready.
   * If already ready, resolves immediately. Otherwise waits for ready event.
   * @returns {Promise<void>} Resolves when data service ready
   * @example
   * await data.whenReady();
   * console.log('Data loaded');
   *
   * @example
   * data.whenReady().then(() => {
   *   const course = Adapt.course;
   *   console.log(course.get('title'));
   * });
   */
  whenReady() {
    if (this.isReady) return Promise.resolve();
    return new Promise(resolve => {
      this.once('ready', resolve);
    });
  }

  /**
   * Checks if a content model with the given ID exists in the collection.
   * Fast O(1) lookup using internal index.
   * @param {string} id - Model ID to check (e.g., 'co-05', 'a-10', 'c-15')
   * @returns {boolean} True if model exists
   * @example
   * if (data.hasId('c-05')) {
   *   console.log('Component exists');
   * }
   */
  hasId(id) {
    return Boolean(this._byAdaptID[id]);
  }

  /**
   * Finds a content model by its _id property.
   * Fast O(1) lookup using internal index. Logs warning if not found.
   * @param {string} id - Model ID to find (e.g., 'co-05', 'a-10', 'c-15')
   * @returns {Backbone.Model|undefined} Model instance or undefined if not found
   * @example
   * const component = data.findById('c-05');
   * if (component) {
   *   console.log(component.get('title'));
   * }
   *
   * @example
   * const block = data.findById('b-10');
   * const components = block.getChildren();
   */
  findById(id) {
    const model = this._byAdaptID[id];
    if (!model) {
      logging.warn(`data.findById() unable to find id: ${id}`);
      return;
    }
    return model;
  }

  /**
   * Finds a rendered view by its model's _id property.
   * Walks the view tree from current location to find the target view.
   * Only returns views that are children of the current location (Adapt.parentView).
   *
   * **Navigation Context:**
   * - Only finds views within current location's view tree
   * - Will not find views on different pages/menus
   * - Returns undefined if view not rendered or not in current location
   *
   * @param {string} id - Model ID to find view for (e.g., 'c-05', 'b-10')
   * @returns {Backbone.View|undefined} View instance or undefined if not found
   * @example
   * const view = data.findViewByModelId('c-05');
   * if (view) {
   *   view.$el.addClass('highlight');
   * }
   *
   * @example
   * const blockView = data.findViewByModelId('b-10');
   * const componentViews = blockView.getChildViews();
   */
  findViewByModelId(id) {
    const model = this.findById(id);
    if (!model || !Adapt.parentView) return;
    const idPathToView = [id];
    const currentLocationId = location._currentId;
    const currentLocationModel = model.getAncestorModels().find(model => {
      const modelId = model.get('_id');
      if (modelId === currentLocationId) return true;
      idPathToView.unshift(modelId);
      return false;
    });

    if (!currentLocationModel) {
      return logging.warn(`data.findViewByModelId() unable to find view for model id: ${id}`);
    }

    const foundView = idPathToView.reduce((view, currentId) => {
      if (!view) return null;
      const childViews = view.getChildViews();
      return childViews?.find(view => view.model.get('_id') === currentId);
    }, Adapt.parentView);

    return foundView;
  }

  /**
   * Finds a content model by its tracking position.
   * Tracking positions are [trackingId, relativeIndex] arrays where:
   * - Positive index: descendant of tracking ID model
   * - Negative index: ancestor of tracking ID model
   * - Zero index: tracking ID model itself
   *
   * **Tracking Position Format:**
   * - `[123, 0]` - Model with _trackingId=123
   * - `[123, 1]` - First trackable descendant of tracking ID 123
   * - `[123, -1]` - Immediate parent of tracking ID 123
   * - `[123, -2]` - Grandparent of tracking ID 123
   *
   * @param {Array<number>} trackingPosition - [trackingId, relativeIndex] array
   * @returns {Backbone.Model|undefined} Model at tracking position or undefined
   * @example
   * const model = data.findByTrackingPosition([123, 0]);
   * console.log(model.get('_trackingId'));
   *
   * @example
   * const firstDescendant = data.findByTrackingPosition([123, 1]);
   * const parent = data.findByTrackingPosition([123, -1]);
   */
  findByTrackingPosition(trackingPosition) {
    const [ trackingId, indexInTrackingIdDescendants ] = trackingPosition;
    const trackingIdModel = this.find(model => model.get('_trackingId') === trackingId);
    if (!trackingIdModel) {
      logging.warn(`data.findByTrackingPosition() unable to find trackingPosition: ${trackingPosition}`);
      return;
    }
    if (indexInTrackingIdDescendants >= 0) {
      // Model is either the trackingId model or a descendant
      let trackingIdDescendants = [trackingIdModel].concat(trackingIdModel.getAllDescendantModels(true));
      trackingIdDescendants = trackingIdDescendants.filter(model => !(model.isTypeGroup('component') && model.get('_isTrackable') === false));
      return trackingIdDescendants[indexInTrackingIdDescendants];
    }
    // Model is an ancestor of the trackingId model
    const trackingIdAncestors = trackingIdModel.getAncestorModels();
    const ancestorDistance = Math.abs(indexInTrackingIdDescendants) - 1;
    return trackingIdAncestors[ancestorDistance];
  }

  /**
   * Logs error when view fails to become ready and forces descendants to ready state.
   * Called by router when view rendering times out.
   * Forces _isReady=true on all not-ready descendants to allow framework to continue.
   * @param {Backbone.View} view - View that failed to become ready
   * @private
   */
  logReadyError(view) {
    const notReadyDescendants = view.model.getAllDescendantModels(true).filter(model => !model.get('_isReady'));
    logging.error(`View ${notReadyDescendants.map(model => `${model.get('_id')} (${model.get('_component') ?? model.get('_type')})`).join(', ')} failed to become ready, forcing ready status.`);
    notReadyDescendants.reverse().forEach(model => model.set('_isReady', true));
  }

  /**
   * Validates data integrity after loading all models.
   * Runs multiple validation checks and throws errors if problems found.
   * Called automatically after manifest files load.
   * @private
   */
  checkData() {
    this.checkIds();
    this.checkTrackingIds();
  }

  /**
   * Validates content model ID integrity.
   * Checks for duplicate IDs, orphaned content, missing parents, and empty containers.
   * Throws Error with code 10011 if validation fails.
   *
   * **Validation Checks:**
   * - Duplicate _id values (same ID used multiple times)
   * - Orphaned content (no _parentId or parent doesn't exist)
   * - Missing parent IDs (referenced parent doesn't exist in data)
   * - Empty containers (non-component with no children)
   *
   * @throws {Error} If validation fails (error.number = 10011)
   * @private
   */
  checkIds() {
    const items = this.toJSON();
    // Index and group
    const idIndex = _.indexBy(items, '_id');
    const idGroups = _.groupBy(items, '_id');
    const parentIdGroups = _.groupBy(items, '_parentId');
    // Setup error collection arrays
    let orphanedIds = {};
    let emptyIds = {};
    let duplicateIds = {};
    let missingIds = {};
    items.forEach((o) => {
      const isCourseType = (o._type === 'course');
      const isComponentType = (o._type === 'component');
      if (idGroups[o._id].length > 1) {
        duplicateIds[o._id] = true; // Id has more than one item
      }
      if (!isComponentType && !parentIdGroups[o._id]) {
        emptyIds[o._id] = true; // Course has no children
      }
      if (!isCourseType && (!o._parentId || !idIndex[o._parentId])) {
        orphanedIds[o._id] = true; // Item has no defined parent id or the parent id doesn't exist
      }
      if (!isCourseType && o._parentId && !idIndex[o._parentId]) {
        missingIds[o._parentId] = true; // Referenced parent item does not exist
      }
    });
    orphanedIds = Object.keys(orphanedIds);
    emptyIds = Object.keys(emptyIds);
    duplicateIds = Object.keys(duplicateIds);
    missingIds = Object.keys(missingIds);
    // Output for each type of error
    const hasErrored = orphanedIds.length || emptyIds.length || duplicateIds.length || missingIds.length;
    if (orphanedIds.length) {
      logging.error(`Orphaned _ids: ${orphanedIds.join(', ')}`);
    }
    if (missingIds.length) {
      logging.error(`Missing _ids: ${missingIds.join(', ')}`);
    }
    if (emptyIds.length) {
      logging.error(`Empty _ids: ${emptyIds.join(', ')}`);
    }
    if (duplicateIds.length) {
      logging.error(`Duplicate _ids: ${duplicateIds.join(', ')}`);
    }
    // If any error has occured, stop processing.
    if (hasErrored) {
      const err = new Error('Oops, looks like you have some json errors.');
      err.number = 10011;
      throw err;
    }
  }

  /**
   * Validates tracking ID integrity.
   * Checks for missing and duplicate _trackingId values on trackable content.
   * Throws Error with code 10011 if validation fails.
   *
   * **Validation Checks:**
   * - Missing _trackingId on trackable content (determined by trackingIdType)
   * - Duplicate _trackingId values (same tracking ID used multiple times)
   *
   * **Tracking ID Type:**
   * Configured in build.min.js as trackingIdType (default: 'block')
   * Typically blocks are tracked, but can be configured for other types.
   *
   * @throws {Error} If validation fails (error.number = 10011)
   * @private
   */
  checkTrackingIds() {
    const items = this.toJSON();
    const trackingIdType = Adapt.build.get('trackingIdType') || 'block';
    const trackingIdCounts = _.groupBy(items.filter(item => item._type === trackingIdType), '_trackingId');
    const missingTrackingIds = items.filter(item => item._type === trackingIdType && item._trackingId === undefined).map(item => item._id);
    if (missingTrackingIds.length) {
      logging.error(`Missing _trackingIds: ${missingTrackingIds.join(', ')}`);
    }
    const duplicateTrackingIds = Object.entries(trackingIdCounts)
      .filter(([id, group]) => group.length > 1)
      .map(([id, group]) => `${id}:[${group.map(item => item._id).join(', ')}]`);
    if (duplicateTrackingIds.length) {
      logging.error(`Duplicate _trackingIds: ${duplicateTrackingIds.join(', ')}`);
    }
    const hasErrored = missingTrackingIds.length || duplicateTrackingIds.length;
    // If any error has occured, stop processing.
    if (hasErrored) {
      const err = new Error('Oops, looks like you have some json errors with trackingIds.');
      err.number = 10011;
      throw err;
    }
  }

}

const data = new Data();
export default data;
