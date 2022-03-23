import Backbone from 'backbone';
import Adapt from 'core/js/adapt';
import logging from 'core/js/logging';

class Location extends Backbone.Controller {

  initialize() {
    /**
     * _id of previous contentobject
     * @type {string}
     */
    this._previousId = null;
    /**
     * _type of previous contentobject
     * @type {string}
     */
    this._previousContentType = null;
    /**
     * Model of previous contentobject
     * @type {Backbone.Model}
     */
    this._previousModel = null;
    /**
     * _htmlClasses of previous contentobject
     * @type {string}
     */
    this._previousClasses = null;
    /**
     * Alias for _previousContentType
     * @type {string}
     */
    this._lastVisitedType = null;
    /**
     * _id of last menu
     * @type {string}
     * */
    this._lastVisitedMenu = null;
    /**
     * _id of last page
     * @type {string}
     * */
    this._lastVisitedPage = null;
    /**
     * _id of current contentobject
     * @type {string}
     */
    this._currentId = null;
    /**
     * Model of current contentobject
     * @type {Backbone.Model}
     */
    this._currentModel = null;
    /**
     * Current url querystring
     * @type {string}
     */
    this._currentLocation = null;
    /**
     * Current contentobject type
     * @type {string}
     */
    this._contentType = null;
  }

}

const location = new Location();

Object.defineProperties(Adapt, {
  location: {
    get() {
      logging.deprecated('Adapt.location, please use core/js/location directly');
      return location;
    }
  }
});

export default location;
