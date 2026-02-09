/**
 * @file Components Registry - Central registration system for Adapt views and models
 * @module core/js/components
 * @description Singleton service managing the registration and retrieval of Backbone
 * Model and View classes for the Adapt Learning Framework. Provides type resolution
 * for dynamic component instantiation based on JSON data.
 *
 * **Architecture:**
 * - Singleton controller (exported as instance)
 * - Maintains registry mapping component names to Model/View class pairs
 * - Supports multiple naming patterns (_component, _type, _view, _model)
 * - Handles legacy view-only registrations with deprecation warnings
 * - Used by data service for model instantiation and router for view rendering
 *
 * **Registration Patterns:**
 * - Standard: `components.register('name', { model: ModelClass, view: ViewClass })`
 * - View-only (deprecated): `components.register('name', { view: ViewClass })`
 * - Multiple names: `components.register(['name1', 'name2'], { model, view })`
 * - Space-separated: `components.register('name1 name2', { model, view })`
 *
 * **Type Resolution Priority:**
 * 1. `_view` property (explicit view override)
 * 2. `_component` property (standard component type)
 * 3. `_type` property (generic type identifier)
 * 4. Falls back to last available name if no registry match
 *
 * **Framework Integration:**
 * - Data service uses `getModelClass()` to instantiate models from JSON
 * - Router uses `getViewClass()` to create views for navigation
 * - AdaptView uses `getViewClass()` to render child components
 * - Plugins register during initialization via `components.register()`
 *
 * @example
 * import components from 'core/js/components';
 *
 * components.register('hotgraphic', {
 *   model: HotGraphicModel,
 *   view: HotGraphicView
 * });
 *
 * @example
 * components.register(['article', 'page'], {
 *   view: ArticleView
 * });
 *
 * @example
 * const ViewClass = components.getViewClass({
 *   _component: 'hotgraphic'
 * });
 * const view = new ViewClass({ model });
 *
 * @example
 * const ModelClass = components.getModelClass(model);
 * const newModel = new ModelClass(json);
 */

import Backbone from 'backbone';
import logging from 'core/js/logging';

/**
 * @typedef {Object} ComponentRegistration
 * @property {Function} [model] - Backbone.Model subclass or factory function
 * @property {Function} [view] - Backbone.View subclass or factory function
 */

/**
 * @class Components
 * @classdesc Component registry controller managing Backbone Model and View class
 * registration and retrieval. Singleton instance exported as `components`.
 * @extends {Backbone.Controller}
 */
class Components extends Backbone.Controller {

  initialize() {
    this._register = {};
    this.register = this.register.bind(this);
    this.getViewName = this.getViewName.bind(this);
    this.getViewClass = this.getViewClass.bind(this);
    this.getModelName = this.getModelName.bind(this);
    this.getModelClass = this.getModelClass.bind(this);
  }

  /**
   * Registers Model and/or View classes for a component type.
   * Supports multiple registration patterns: single name, array of names, or space-separated names.
   * Automatically assigns template name to view if not specified. Validates that classes extend
   * appropriate Backbone base classes.
   *
   * **Validation:**
   * - Model must extend `Backbone.Model` or be a Function
   * - View must extend `Backbone.View` or be a Function
   * - Throws Error if validation fails
   *
   * **Auto-Configuration:**
   * - Sets `view.template = name` if template not already defined
   * - Merges with existing registration (allows separate model/view registration)
   *
   * @param {string|Array<string>} name - Component name(s) to register
   * @param {ComponentRegistration} object - Registration object containing model and/or view classes
   * @returns {Object} The registered object (for chaining)
   * @throws {Error} If model is not Backbone.Model subclass or Function
   * @throws {Error} If view is not Backbone.View subclass or Function
   * @example
   * components.register('hotgraphic', {
   *   model: HotGraphicModel,
   *   view: HotGraphicView
   * });
   *
   * @example
   * components.register(['article', 'page'], {
   *   view: ArticleView
   * });
   *
   * @example
   * components.register('block', { model: BlockModel });
   * components.register('block', { view: BlockView });
   *
   * @example
   * components.register('course menu', {
   *   model: CourseModel,
   *   view: BoxMenuView
   * });
   */
  register(name, object) {
    if (Array.isArray(name)) {
      // if an array is passed, iterate by recursive call
      name.forEach(name => this.register(name, object));
      return object;
    }

    if (name.split(' ').length > 1) {
      // if name with spaces is passed, split and pass as array
      this.register(name.split(' '), object);
      return object;
    }

    if ((!object.view && !object.model) || object instanceof Backbone.View) {
      logging.deprecated('View-only registrations are no longer supported');
      object = { view: object };
    }

    if (object.view && !object.view.template) {
      object.view.template = name;
    }

    const isModelSetAndInvalid = (object.model &&
      !(object.model.prototype instanceof Backbone.Model) &&
      !(object.model instanceof Function));
    if (isModelSetAndInvalid) {
      throw new Error('The registered model is not a Backbone.Model or Function');
    }

    const isViewSetAndInvalid = (object.view &&
      !(object.view.prototype instanceof Backbone.View) &&
      !(object.view instanceof Function));
    if (isViewSetAndInvalid) {
      throw new Error('The registered view is not a Backbone.View or Function');
    }

    this._register[name] = Object.assign({}, this._register[name], object);

    return object;
  }

  /**
   * Resolves the view class name from various input types.
   * Supports string names, Backbone.Model instances, Backbone.View instances, and JSON data objects.
   * Uses priority resolution: `_view` > `_component` > `_type`.
   *
   * **Resolution Logic:**
   * - String input: Returns as-is
   * - Backbone.Model: Extracts JSON and resolves from data
   * - Backbone.View: Searches registry for matching view instance
   * - Object: Checks `_view`, `_component`, `_type` properties in order
   *
   * **Fallback Behavior:**
   * - Returns first name with registered view class
   * - If no match, returns last available property name
   * - Throws Error if no name can be derived
   *
   * @param {string|Backbone.Model|Backbone.View|Object} nameModelViewOrData - Input to resolve view name from
   * @returns {string} Resolved view class name
   * @throws {Error} If view class name cannot be derived from input
   * @example
   * const name = components.getViewName('hotgraphic');
   *
   * @example
   * const name = components.getViewName(model);
   *
   * @example
   * const name = components.getViewName({
   *   _component: 'hotgraphic'
   * });
   *
   * @example
   * const name = components.getViewName(viewInstance);
   */
  getViewName(nameModelViewOrData) {
    if (typeof nameModelViewOrData === 'string') {
      return nameModelViewOrData;
    }
    if (nameModelViewOrData instanceof Backbone.Model) {
      nameModelViewOrData = nameModelViewOrData.toJSON();
    }
    if (nameModelViewOrData instanceof Backbone.View) {
      let foundName;
      Object.entries(this._register).forEach(([key, entry]) => {
        if (!entry?.view) return;
        if (!(nameModelViewOrData instanceof entry.view)) return;
        foundName = key;
        return true;
      });
      return foundName;
    }
    if (nameModelViewOrData instanceof Object) {
      const names = [
        typeof nameModelViewOrData._view === 'string' && nameModelViewOrData._view,
        typeof nameModelViewOrData._component === 'string' && nameModelViewOrData._component,
        typeof nameModelViewOrData._type === 'string' && nameModelViewOrData._type
      ].filter(Boolean);
      if (names.length) {
        // find first fitting view name
        const name = names.find(name => this._register[name]?.view);
        return name || names.pop(); // return last available if none found
      }
    }
    throw new Error('Cannot derive view class name from input');
  }

  /**
   * Retrieves the registered View class for a component.
   * Resolves the view name using `getViewName()`, then returns the corresponding class from
   * the registry. Supports factory functions (returns result of calling function).
   *
   * **Resolution Process:**
   * 1. Resolve view name from input using `getViewName()`
   * 2. Look up registration object in registry
   * 3. If view is Function (not Backbone.View subclass), call and return result
   * 4. Otherwise return view class directly
   *
   * **Usage Context:**
   * - Router calls this to instantiate views during navigation
   * - AdaptView calls this to render child components
   * - NotifyPopupView calls this to render notification content
   *
   * @param {string|Backbone.Model|Backbone.View|Object} nameModelViewOrData - Input to resolve view class from
   * @returns {Function|undefined} View class constructor or undefined if not registered
   * @example
   * const ViewClass = components.getViewClass('hotgraphic');
   * const view = new ViewClass({ model });
   *
   * @example
   * const ViewClass = components.getViewClass(model);
   * const view = new ViewClass({ model });
   *
   * @example
   * const ViewClass = components.getViewClass({
   *   _component: 'narrative'
   * });
   */
  getViewClass(nameModelViewOrData) {
    const name = this.getViewName(nameModelViewOrData);
    const object = this._register[name];
    if (!object) {
      logging.error(`A view for '${name}' isn't registered in your project`);
      return;
    }
    const isBackboneView = (object.view?.prototype instanceof Backbone.View);
    if (!isBackboneView && object.view instanceof Function) {
      return object.view();
    }
    return object.view;
  }

  /**
   * Resolves the model class name from various input types.
   * Supports string names, Backbone.Model instances, and JSON data objects.
   * Uses priority resolution: `_model` > `_component` > `_type`.
   *
   * **Resolution Logic:**
   * - String input: Returns as-is
   * - Backbone.Model: Extracts JSON and resolves from data
   * - Object: Checks `_model`, `_component`, `_type` properties in order
   *
   * **Special Cases:**
   * - View-only question components: Returns 'question' model with deprecation warning
   * - Allows plugins to register view without model by using framework question model
   *
   * **Fallback Behavior:**
   * - Returns first name with registered model class
   * - If no match, returns last available property name
   * - Throws Error if no name can be derived
   *
   * @param {string|Backbone.Model|Object} nameModelOrData - Input to resolve model name from
   * @returns {string} Resolved model class name
   * @throws {Error} If model class name cannot be derived from input
   * @example
   * const name = components.getModelName('hotgraphic');
   *
   * @example
   * const name = components.getModelName(model);
   *
   * @example
   * const name = components.getModelName({
   *   _component: 'mcq'
   * });
   */
  getModelName(nameModelOrData) {
    if (typeof nameModelOrData === 'string') {
      return nameModelOrData;
    }
    if (nameModelOrData instanceof Backbone.Model) {
      nameModelOrData = nameModelOrData.toJSON();
    }
    if (nameModelOrData instanceof Object) {
      const name = nameModelOrData._component;
      const entry = this._register[name];
      const isViewOnlyQuestion = entry && !entry.model && entry.view?._isQuestionType;
      if (isViewOnlyQuestion) {
        // Use question model by default
        logging.deprecated(`Assuming a question model for a view-only question: ${name}`);
        return 'question';
      }
      const names = [
        typeof nameModelOrData._model === 'string' && nameModelOrData._model,
        typeof nameModelOrData._component === 'string' && nameModelOrData._component,
        typeof nameModelOrData._type === 'string' && nameModelOrData._type
      ].filter(Boolean);
      if (names.length) {
        // find first fitting model name
        const name = names.find(name => this._register[name]?.model);
        return name || names.pop(); // return last available if none found
      }
    }
    throw new Error('Cannot derive model class name from input');
  }

  /**
   * Retrieves the registered Model class for a component.
   * Resolves the model name using `getModelName()`, then returns the corresponding class from
   * the registry. Supports factory functions (returns result of calling function).
   *
   * **Resolution Process:**
   * 1. Resolve model name from input using `getModelName()`
   * 2. Look up registration object in registry
   * 3. If model is Function (not Backbone.Model subclass), call and return result
   * 4. Otherwise return model class directly
   *
   * **Usage Context:**
   * - Data service calls this during collection instantiation from JSON
   * - Router calls this when creating runtime models (menu tracking)
   * - Trickle extension uses this to instantiate button models
   *
   * @param {string|Backbone.Model|Object} nameModelOrData - Input to resolve model class from
   * @returns {Function|undefined} Model class constructor or undefined if not registered
   * @example
   * const ModelClass = components.getModelClass('hotgraphic');
   * const model = new ModelClass(json);
   *
   * @example
   * const ModelClass = components.getModelClass({
   *   _component: 'mcq'
   * });
   * const model = new ModelClass(data, { parse: true });
   *
   * @example
   * const ModelClass = components.getModelClass({ _type: 'page' });
   * const page = new ModelClass({ _id: 'p-10' });
   */
  getModelClass(nameModelOrData) {
    const name = this.getModelName(nameModelOrData);
    const object = this._register[name];
    if (!object) {
      logging.error(`A model for '${name}' isn't registered in your project`);
      return;
    }
    const isBackboneModel = (object.model?.prototype instanceof Backbone.Model);
    if (!isBackboneModel && object.model instanceof Function) {
      return object.model();
    }
    return object.model;
  }

}

const components = new Components();
export default components;
