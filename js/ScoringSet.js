import Adapt from './adapt';
import Logging from './logging';
import OfflineStorage from 'core/js/offlineStorage';
import scoring, {
  filterModels,
  getScaledScoreFromMinMax,
  getSubsets,
  getSubsetsByType,
  getSubsetsByModelId,
  getSubsetById,
  getSubSetByPath
} from 'core/js/scoring';
import Backbone from 'backbone';

/**
 * The class provides an abstract that describes a set of models which can be extended with custom
 * scoring and completion behaviour.
 * Derivative class instances should act as both a root set of models (assessment-blocks) and an
 * intersected set of models (retention-question-components vs assessment-blocks).
 * Set intersections are performed by comparing overlapping hierachies, such that a model will be
 * considered in both sets when it is equal to, a descendant of or an ancestor of a model in the intersecting
 * set. An assessment-block may contain a retention-question-component, a retention-question-component
 * may be contained in an assessment-block and an assessment-block may be equal to an assessment-block.
 * The last intersected set will always provide the returned set Class pertaining to its abstraction,
 * such that retention-question-components vs assessment-blocks would always give a subset of
 * assessment-blocks whereas assessment-blocks vs retention-question-components will always
 * give a subset of retention-question-components.
 * Intersected sets will always only include models from their prospective set.
 */
export default class ScoringSet extends Backbone.Controller {

  initialize({
    _id = null,
    _type = null,
    _title = '',
    _isScoreIncluded = false,
    _isCompletionRequired = false
  } = {}, subsetParent = null) {
    this._subsetParent = subsetParent;
    this._id = _id;
    this._type = _type;
    this._title = _title;
    this._isScoreIncluded = _isScoreIncluded;
    this._isCompletionRequired = _isCompletionRequired;
    // only register root sets as subsets are dynamically created when required
    if (!this._subsetParent) this.register();
    this._setupListeners();
  }

  register() {
    scoring.register(this);
  }

  /**
   * @protected
   */
  _setupListeners() {
    if (OfflineStorage.ready) {
      this.onOfflineStorageReady();
    } else {
      this.listenTo(Adapt, {
        'offlineStorage:ready': this.onOfflineStorageReady
      });
    }
  }

  init() {
    this._wasComplete = this.isComplete;
    this._wasPassed = this.isPassed;
  }

  /**
   * Restore data from previous sessions
   */
  restore() {}

  /**
   * Executed on data changes
   * @todo A change to any set causes all of them to update. Should this be limited to changes to its own associated data?
   */
  update() {
    const isComplete = this.isComplete;
    if (isComplete && !this._wasComplete) this.onCompleted();
    const isPassed = this.isPassed;
    if (isPassed && !this._wasPassed) this.onPassed();
    this._wasComplete = isComplete;
    this._wasPassed = isPassed;
    Adapt.trigger('scoring:set:update', this);
  }

  filterModels(models) {
    return filterModels(this, models);
  }

  /**
   * @param {String} setId
   * @returns {[ScoringSet]}
   */
  getSubsetById(setId) {
    return getSubsetById(setId, this);
  }

  /**
   * @param {String} setType
   * @returns {[ScoringSet]}
   */
  getSubsetsByType(setType) {
    return getSubsetsByType(setType, this);
  }

  /**
   * @param {String} modelId
   * @returns {[ScoringSet]}
   */
  getSubsetsByModelId(modelId) {
    return getSubsetsByModelId(modelId, this);
  }

  /**
   * @param {String|[String]} path
   * @returns {[ScoringSet]}
   */
  getSubsetByPath(path) {
    return getSubSetByPath(path, this);
  }

  /**
   * Returns subsets populated by child models
   * @param {ScoringSet} set
   * @returns {[ScoringSet]}
   */
  getPopulatedSubset(subset) {
    return subset.filter(set => set.models.length > 0);
  }

  getScoreByModelId(modelId) {
    const model = this.models.find(model => model.get('_id') === modelId);
    this._getScoreByModel(model);
  }

  get subsetParent() {
    return this._subsetParent;
  }

  get id() {
    return this._id;
  }

  get type() {
    return this._type;
  }

  get title() {
    return this._title;
  }

  get isScoreIncluded() {
    return this._isScoreIncluded;
  }

  /**
   * Returns whether the set needs to be completed
   * @returns {Boolean}
   */
  get isCompletionRequired() {
    return this._isCompletionRequired;
  }

  /**
   * Returns a unique array of models, filtered for `_isAvailable` and intersecting subsets hierarchies
   * Always finish by calling `this.filterModels(models)`
   * @returns {[Backbone.Model]}
   */
  get models() {
    Logging.error(`models must be overriden for ${this.constructor.name}`);
  }

  /**
   * Returns all prospective subsets
   * @returns {[ScoringSet]}
   */
  get subsets() {
    return getSubsets(this);
  }

  /**
   * Return all subsets marked with `_isScoreIncluded`
   * @returns {[ScoringSet]}
   */
  get scoringSets() {
    return this.subsets.filter(({ isScoreIncluded }) => isScoreIncluded);
  }

  /**
   * Returns the minimum score
   * @returns {Number}
   */
  get minScore() {
    Logging.error(`minScore must be overriden for ${this.constructor.name}`);
  }

  /**
   * Returns the maxiumum score
   * @returns {Number}
   */
  get maxScore() {
    Logging.error(`maxScore must be overriden for ${this.constructor.name}`);
  }

  /**
   * Returns the score
   * @returns {Number}
   */
  get score() {
    Logging.error(`score must be overriden for ${this.constructor.name}`);
  }

  /**
   * Returns a percentage score relative to the minimum and maximum values
   * @todo If minScore < 0 the starting scaledScore will be > 0 - scaled scored between 0 - 100 or -100 - 100?
   * @returns {Number}
   */
  get scaledScore() {
    return getScaledScoreFromMinMax(this.score, this.minScore, this.maxScore);
  }

  /**
   * Returns a score as a string to include "+" operator for positive scores
   * @returns {String}
   */
   get scoreAsString() {
    const score = this.score;
    return (score > 0) ? `+${score.toString()}` : score.toString();
  }

  /**
   * Returns whether the set is completed
   * @returns {Boolean}
   */
  get isComplete() {
    Logging.error(`isComplete must be overriden for ${this.constructor.name}`);
  }

  /**
   * Returns whether the configured passmark has been achieved
   * @returns {Boolean}
   */
  get isPassed() {
    Logging.error(`isPassed must be overriden for ${this.constructor.name}`);
  }

  /**
   * Override this property to return a score for a specific model
   * @protected
   * @param {Backbone.Model} model
   * @returns {Number}
   */
  _getScoreByModel(model) {
    Logging.error(`_getScoreByModel must be overriden for ${this.constructor.name}`);
  }

  /**
   * @listens Adapt#offlineStorage:ready
   */
  onOfflineStorageReady() {
    this.restore();
  }

  /**
   * Override this function to perform set specific completion tasks
   */
   onCompleted() {}

  /**
   * Override this function to perform specific passing tasks
   */
  onPassed() {}

}
