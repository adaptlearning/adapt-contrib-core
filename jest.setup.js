// to test the plugin in isolation we need to set up some required globals
// see https://jestjs.io/docs/configuration#setupfiles-array

global._ = require('underscore');

global.Handlebars = {
  registerHelper: () => {}
}

global.Backbone = {
  Controller: () => {}
}