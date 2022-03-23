import Backbone from 'backbone';
import Adapt from 'core/js/adapt';
import logging from 'core/js/logging';

class Location extends Backbone.Controller {

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
