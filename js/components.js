import Backbone from 'backbone';
import logging from 'core/js/logging';
import Adapt from 'core/js/adapt';

class Components extends Backbone.Controller {

  initialize() {
    this._register = {};
  }

  /**
   * Used to register models and views
   * @param {string|Array} name The name(s) of the model/view to be registered
   * @param {object} object Object containing properties `model` and `view` or (legacy) an object representing the view
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
   * Parses a view class name.
   * @param {string|Backbone.Model|Backbone.View|object} nameModelViewOrData The name of the view class you want to fetch e.g. `"hotgraphic"` or its model or its json data
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
   * Fetches a view class from the components. For a usage example, see either HotGraphic or Narrative
   * @param {string|Backbone.Model|Backbone.View|object} nameModelViewOrData The name of the view class you want to fetch e.g. `"hotgraphic"` or its model or its json data
   * @returns {Backbone.View} Reference to the view class
   */
  getViewClass(nameModelViewOrData) {
    const name = this.getViewName(nameModelViewOrData);
    const object = this._register[name];
    if (!object) {
      logging.warnOnce(`A view for '${name}' isn't registered in your project`);
      return;
    }
    const isBackboneView = (object.view?.prototype instanceof Backbone.View);
    if (!isBackboneView && object.view instanceof Function) {
      return object.view();
    }
    return object.view;
  }

  /**
   * Parses a model class name.
   * @param {string|Backbone.Model|object} name The name of the model you want to fetch e.g. `"hotgraphic"`, the model to process or its json data
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
   * Fetches a model class from the components. For a usage example, see either HotGraphic or Narrative
   * @param {string|Backbone.Model|object} name The name of the model you want to fetch e.g. `"hotgraphic"` or its json data
   * @returns {Backbone.Model} Reference to the view class
   */
  getModelClass(nameModelOrData) {
    const name = this.getModelName(nameModelOrData);
    const object = this._register[name];
    if (!object) {
      logging.warnOnce(`A model for '${name}' isn't registered in your project`);
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
components.register = components.register.bind(components);
components.getViewName = components.getViewName.bind(components);
components.getViewClass = components.getViewClass.bind(components);
components.getModelName = components.getModelName.bind(components);
components.getModelClass = components.getModelClass.bind(components);

Object.defineProperties(Adapt, {
  store: {
    get() {
      logging.deprecated('Adapt.store, please use core/js/components directly');
      return components._register;
    }
  },
  componentStore: {
    get() {
      logging.deprecated('Adapt.componentStore, please use core/js/components directly');
      return components._register;
    }
  },
  register: {
    get() {
      logging.deprecated('Adapt.register, please use components.register instead');
      return components.register;
    }
  },
  getViewName: {
    get() {
      logging.deprecated('Adapt.getViewName, please use components.getViewName instead');
      return components.getViewName;
    }

  },
  getViewClass: {
    get() {
      logging.deprecated('Adapt.getViewClass, please use components.getViewClass instead');
      return components.getViewClass;
    }

  },
  getModelName: {
    get() {
      logging.deprecated('Adapt.getModelName, please use components.getModelName instead');
      return components.getModelName;
    }
  },
  getModelClass: {
    get() {
      logging.deprecated('Adapt.getModelClass, please use components.getModelClass instead');
      return components.getModelClass;
    }
  }
});

export default components;
