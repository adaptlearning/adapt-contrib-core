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

class Data extends AdaptCollection {

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

  async init () {
    this.reset();
    this._byAdaptID = {};
    Adapt.build = new BuildModel(null, { url: 'adapt/js/build.min.js', reset: true });
    await Adapt.build.whenReady();
    $('html').attr('data-adapt-framework-version', Adapt.build.get('package').version);
    this.loadConfigData();
  }

  onAdded(model) {
    this._byAdaptID[model.get('_id')] = model;
  }

  onRemoved(model) {
    delete this._byAdaptID[model.get('_id')];
  }

  loadConfigData() {
    Adapt.config = new ConfigModel(null, { url: Adapt.build.get('coursedir') + '/config.' + Adapt.build.get('jsonext'), reset: true });
    this.listenToOnce(Adapt, 'configModel:loadCourseData', this.onLoadCourseData);
    this.listenTo(Adapt.config, {
      'change:_activeLanguage': this.onLanguageChange,
      'change:_defaultDirection': this.onDirectionChange
    });
  }

  onDirectionChange(model, direction) {
    if (direction === 'rtl') {
      $('html').removeClass('dir-ltr').addClass('dir-rtl').attr('dir', 'rtl');
    } else {
      $('html').removeClass('dir-rtl').addClass('dir-ltr').attr('dir', 'ltr');
    }
  }

  /**
   * Before we actually go to load the course data, we first need to check to see if a language has been set
   * If it has we can go ahead and start loading; if it hasn't, apply the defaultLanguage from config.json
   */
  onLoadCourseData() {
    if (!Adapt.config.get('_activeLanguage')) {
      Adapt.config.set('_activeLanguage', Adapt.config.get('_defaultLanguage'));
      return;
    }
    this.loadCourseData();
  }

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
    this.loadCourseData(language, previousLanguage);
  }

  async loadCourseData(newLanguage, previousLanguage) {

    // All code that needs to run before adapt starts should go here
    const language = Adapt.config.get('_activeLanguage');

    const courseFolder = Adapt.build.get('coursedir') + '/' + language + '/';

    $('html').attr('lang', language);

    await this.loadManifestFiles(courseFolder);
    await this.triggerDataLoaded();
    await this.triggerDataReady(newLanguage, previousLanguage);
    this.triggerInit();

  }

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
        return this.getJSON(`${languagePath}${filePath}`);
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

  async triggerDataLoaded() {
    logging.debug('Firing app:dataLoaded');
    try {
      // Setup the newly added models
      this.forEach(model => model.setupModel?.());
      Adapt.trigger('app:dataLoaded');
    } catch (e) {
      logging.error('Error during app:dataLoading trigger', e);
    }
    await wait.queue();
  }

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

  triggerInit() {
    this.isReady = true;
    this.trigger('ready');
  }

  whenReady() {
    if (this.isReady) return Promise.resolve();
    return new Promise(resolve => {
      this.once('ready', resolve);
    });
  }

  /**
   * Checks if a model _id exists
   * @param {string} id The id of the item e.g. "co-05"
   * @returns {boolean}
   */
  hasId(id) {
    return Boolean(this._byAdaptID[id]);
  }

  /**
   * Looks up a model by its `_id` property
   * @param {string} id The id of the item e.g. "co-05"
   * @return {Backbone.Model}
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
   * Looks up a view by its model `_id` property
   * @param {string} id The id of the item e.g. "co-05"
   * @return {Backbone.View}
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
   * Returns the model represented by the trackingPosition.
   * @param {Array<Number, Number>} trackingPosition Represents the relative location of a model to a _trackingId
   * @returns {Backbone.Model}
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

  logReadyError(view) {
    const notReadyDescendants = view.model.getAllDescendantModels(true).filter(model => !model.get('_isReady'));
    logging.error(`View ${notReadyDescendants.map(model => `${model.get('_id')} (${model.get('_component') ?? model.get('_type')})`).join(', ')} failed to become ready, forcing ready status.`);
    notReadyDescendants.reverse().forEach(model => model.set('_isReady', true));
  }

  checkData() {
    this.checkIds();
    this.checkTrackingIds();
  }

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
