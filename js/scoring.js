import Adapt from './adapt';
import Data from './data';

/** @typedef {import("./ScoringSet").default} ScoringSet */

/**
 * Returns set model arrays by applying standard uniqueness, `_isAvailable` and subset intersection filters
 * @param {ScoringSet} set
 * @param {[Backbone.Models]} models
 * @returns {[Backbone.Models]}
 */
 export function filterModels(set, models) {
  if (!models) return null;
  // @todo: use Set to remove duplicates?
  //models = [...new Set(models)];
  models = _.uniq(models, model => model.get('_id'));

  if (set.subsetParent && set.subsetParent.models) {
    // Return only this set's items intersecting with or with intersecting descendants or ancestors from the parent list
    models = filterIntersectingHierarchy(models, set.subsetParent.models);
  }

  return models.filter(model => model.get('_isAvailable'));
}

/**
 * Returns the percentage position of score between minScore and maxScore
 * @param {Number} score
 * @param {Number} minScore
 * @param {Number} maxScore
 * @returns {Number}
 */
export function getScaledScoreFromMinMax(score, minScore, maxScore) {
  const range = maxScore - minScore;
  const relativeScore = score - minScore;
  return Math.round((relativeScore / range) * 100);
}

/**
 * Returns models from listA which are present in listB, are descendents of listB or have listB models as descendents
 * @param {[Backbone.Model]} listA
 * @param {[Backbone.Model]} listB
 * @returns {[Backbone.Model]}
 */
export function filterIntersectingHierarchy(listA, listB) {
  const listBModels = listB.reduce((allDescendents, model) => allDescendents.concat([model], model.getAllDescendantModels()), []);
  const listBModelsIndex = _.indexBy(listBModels, model => model.get('_id'));

  return listA.filter(model => {
    const isADescendentOfB = listBModelsIndex[model.get('_id')];
    if (isADescendentOfB) return true;
    const listAModels = [model].concat(model.getAllDescendantModels());
    const listAModelsIndex = _.indexBy(listAModels, model => model.get('_id'));
    const isBDescendentOfA = Boolean(Object.keys(listAModelsIndex).find(key => listBModelsIndex[key]));
    if (isBDescendentOfA) return true;
  });
}

/**
 * Return a boolean to indicate if any model from listA is present in listB, is a descendents of listB or has listB models as descendents
 * @param {[Backbone.Model]} listA
 * @param {[Backbone.Model]} listB
 * @returns {Boolean}
 */
export function hasIntersectingHierarchy(listA, listB) {
  const listBModels = listB.reduce((allDescendents, model) => allDescendents.concat([model], model.getAllDescendantModels()), []);
  const listBModelsIndex = _.indexBy(listBModels, model => model.get('_id'));

  return Boolean(listA.find(model => {
    const isADescendentOfB = listBModelsIndex[model.get('_id')];
    if (isADescendentOfB) return true;
    const listAModels = [model].concat(model.getAllDescendantModels());
    const listAModelsIndex = _.indexBy(listAModels, model => model.get('_id'));
    const isBDescendentOfA = Boolean(Object.keys(listAModelsIndex).find(key => listBModelsIndex[key]));
    if (isBDescendentOfA) return true;
  }));
}

/**
 * Returns a subset from the given sets, reduces from left to right, returning the class of the furthest right most set
 * This effectively makes a pipe of parent-child related sets which use each parent in turn to reduce the models in the next subset
 * @param {[ScoringSet]} sets
 * @returns {ScoringSet}
 */
export function createIntersectionSubset(sets) {
  const subsetParent = sets[0];

  return sets.slice(1).reduce((subsetParent, set) => {
    if (!set) return subsetParent;
    const Class = Object.getPrototypeOf(set).constructor;
    return new Class(set, subsetParent);
  }, subsetParent);
}

/**
 * Returns all sets or all sets without the specified excludeParent
 * @param {ScoringSet} [excludeParent]
 */
export function getRawSets(excludeParent = null) {
  return excludeParent ?
    Adapt.scoring.subsets.filter(set => !(set.id === excludeParent.id && set.type === excludeParent.type)) :
    Adapt.scoring.subsets;
}

/**
 * Returns all root set or the intersection sets from subsetParent
 * @param {ScoringSet} subsetParent
 * @returns {[ScoringSet]}
 */
export function getSubsets(subsetParent = undefined) {
  let sets = getRawSets(subsetParent);

  if (subsetParent) {
    // Create intersection sets between the found sets and the subsetParent
    sets = sets.map(set => createIntersectionSubset([subsetParent, set]));
  }

  return sets;
}

/**
 * Returns all root set of type or the intersection sets from subsetParent of type
 * @param {String} type
 * @param {ScoringSet} [subsetParent]
 * @returns {[ScoringSet]}
 */
export function getSubsetsByType(type, subsetParent = undefined) {
  let sets = getRawSets(subsetParent).filter(set => type === set.type);

  if (subsetParent) {
    // Create intersection sets between the found sets and the subsetParent
    sets = sets.map(set => createIntersectionSubset([subsetParent, set]));
  }

  return sets;
}

/**
 * Returns all root sets or the intersection sets from subsetParent which also intersect the given model
 * @param {String} id
 * @param {ScoringSet} [subsetParent]
 * @returns {[ScoringSet]}
 */
export function getSubsetsByModelId(id, subsetParent = undefined) {
  // @todo: elsewhere data is used to find models
  const models = [Adapt.findById(id)];
  let sets = getRawSets(subsetParent).filter(set => hasIntersectingHierarchy(set.models, models));

  if (subsetParent) {
    // Create intersection sets between the found sets and the subsetParent
    sets = sets.map(set => createIntersectionSubset([subsetParent, set]));
  }

  return sets;
}

/**
 * Returns the root set by id or the intersection from the subsetParent by id
 * @param {String} id
 * @param {ScoringSet} [subsetParent]
 * @returns {ScoringSet}
 */
export function getSubsetById(id, subsetParent = undefined) {
  const sets = getRawSets(subsetParent);
  let set = sets.find(set => id === set.id);

  if (subsetParent) {
    // Create an intersection set between the found set and the subsetParent
    set = createIntersectionSubset([subsetParent, set]);
  }

  return set;
}

/**
 * Create intersection subset from an id path
 * @param {[String]|String} path
 * @param {ScoringSet} [subsetParent]
 * @returns {ScoringSet}
 */
export function getSubSetByPath(path, subsetParent = undefined) {
  if (typeof path === 'string') {
    // Allow 'id.id.id' style lookup
    path = path.split('.');
  }

  // Fetch all of the sets named in the path in order
  const sets = path.map(id => getSubsetById(id));

  if (subsetParent) {
    // Add subsetParent as the starting set
    sets.unshift(subsetParent);
  }

  // Create an intersection set from all found sets in order
  return createIntersectionSubset(sets);
}

Handlebars.registerHelper('score', context => {
  if (!context) throw Error('No context for score helper.');
  const data = context.data.root;
  const modelId = data._id;
  const model = Data.findById(modelId);
  const score = model.score;
  return score;
});

Handlebars.registerHelper('set-score', (setId, context) => {
  if (!context) throw Error('No context for set-score helper.');
  const data = context.data.root;
  const modelId = data._id;
  const score = null;
  const set = getSubsetById(setId);
  //const score = set.models.find
  //const sets = getSubsetsByModelId(modelId);
  //sets.find(set => set.id === setId)
  return score;
});

/**
 * API for creating completion and scoring model sets
 */
class Scoring extends Backbone.Controller {

  initialize() {
    /**
     * All registered sets
     * @type {ScoringSet}
     */
    this._rawSets = [];

    this.listenTo(Adapt, {
      'adapt:start': this.onAdaptStart
    });
  }

  /**
   * @todo Any data change causes all sets to update. Should this be limited to changes to each sets intersecting data?
   * @todo Limit to components only - Assessments use blocks so wouldn't work?
   * @todo Exclude `_isOptional` models - wouldn't factor in role selector changes etc.?
   */
  _setupListeners() {
    const debouncedUpdate = _.debounce(this.update, 100);

    this.listenTo(Data, {
      'change:_isAvailable': debouncedUpdate,
      //'bubble:change:_isInteractionComplete': debouncedUpdate
      'change:_isInteractionComplete': debouncedUpdate
    });
  }

  init() {
    this.subsets.forEach(set => set.init());
  }

  /**
   * Force all registered sets to recalculate their states
   * @todo Add a different event if the score was changed rather than recalculated?
   * @fires Adapt#scoring:update
   * @property {Scoring}
   */
  update() {
    this.subsets.forEach(set => set.update());
    Adapt.trigger('scoring:update', this);
  }

  /**
   * Register a configured root scoring set
   * This is usual performed automatically upon ScoringSet instantiation
   * @param {ScoringSet} newSet
   */
  register(newSet) {
    const hasDuplicatedId = Boolean(this._rawSets.find(set => set.id === newSet.id));
    if (hasDuplicatedId) throw new Error(`Cannot register two sets with the same id: ${newSet.id}`);
    this._rawSets.push(newSet);
    Adapt.trigger(`${newSet.type}:register`, newSet);
  }

  /**
   * Return all root sets marked with `_isCompletionRequired`
   * @returns {[ScoringSet]}
   */
  get completionSets() {
    return this._rawSets.filter(({ isCompletionRequired }) => isCompletionRequired);
  }

  /**
   * Return all root sets marked with `_isScoreIncluded`
   * @returns {[ScoringSet]}
   */
  get scoringSets() {
    return this._rawSets.filter(({ isScoreIncluded }) => isScoreIncluded);
  }

  /**
   * Returns all unique subset models
   * @todo Use `new Set` to create unique models?
   * @returns {[Backbone.Model]}
   */
  get models() {
    const models = this.subsets.reduce((models, set) => models.concat(set.models), []);
    return _.uniq(models, model => model.get('_id'));
  }

  /**
   * Returns all registered root sets
   * @returns {[ScoringSet]}
   */
  get subsets() {
    return this._rawSets;
  }

  /**
   * Returns all registered root sets of type
   * @param {String} type
   * @returns {[ScoringSet]}
   */
  getSubsetsByType(type) {
    return getSubsetsByType(type);
  }

  /**
   * Returns all registered root sets intersecting the given model id
   * @param {String} id
   * @returns {[ScoringSet]}
   */
  getSubsetsByModelId(id) {
    return getSubsetsByModelId(id);
  }

  /**
   * Returns a registered root sets by id
   * @param {String} id
   * @returns {ScoringSet}
   */
  getSubsetById(id) {
    return getSubsetById(id);
  }

  /**
   * Returns a root set or intersection set by path
   * @param {String|[String]} path
   * @returns {ScoringSet}
   */
  getSubsetByPath(path) {
    return getSubSetByPath(path);
  }

  /**
   * Returns the sum of all `_isScoreIncluded` root models `minScore` values
   * @returns {Number}
   */
  get minScore() {
    return this.scoringSets.reduce((minScore, set) => minScore + set.minScore, 0);
  }

  /**
   * Returns the sum of all `_isScoreIncluded` root models `maxScore` values
   * @returns {Number}
   */
  get maxScore() {
    return this.scoringSets.reduce((maxScore, set) => maxScore + set.maxScore, 0);
  }

  /**
   * Returns the sum of all `_isScoreIncluded` root models score values
   * @returns {Number}
   */
  get score() {
    return this.scoringSets.reduce((score, set) => score + set.score, 0);
  }

  /**
   * Returns the percentage position of score between `minScore` and `maxScore`
   * @returns {Number}
   */
  get scaledScore() {
    return getScaledScoreFromMinMax(this.score, this.minScore, this.maxScore);
  }

  /**
   * Returns a boolean indication if all root sets marked with `_isCompletionRequired` are completed
   * @returns {Boolean}
   */
   get isComplete() {
    return !this.completionSets.find(set => !set.isComplete);
  }

  onAdaptStart() {
    // delay any listeners until all data has been restored
    this._setupListeners();
    this.init();
    this.update();
  }

}

export default (Adapt.scoring = new Scoring());
