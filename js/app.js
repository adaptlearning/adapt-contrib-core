/**
 * @file Application entry point for the Adapt Learning Framework.
 * @module core/js/app
 * @description Imports the core modules for their side effects, renders the loading
 * template, then initialises the data module and calls `Adapt.init()` once it is ready.
 */
import Adapt from 'core/js/adapt';
import 'core/js/wait';
import 'core/js/deprecated.js';
import 'core/js/components';
import 'core/js/location';
import 'core/js/templates';
import 'core/js/fixes';
import data from 'core/js/data';
import 'core/js/offlineStorage';
import logging from 'core/js/logging';
import 'core/js/tracking';
import 'core/js/device';
import 'core/js/drawer';
import 'core/js/notify';
import 'core/js/router';
import 'core/js/models/lockingModel';
import 'core/js/mpabc';
import 'core/js/helpers';
import 'core/js/scrolling';
import 'core/js/scrollPosition';
import 'core/js/headings';
import 'core/js/navigation';
import 'core/js/startController';
import 'core/js/DOMElementModifications';
import 'core/js/tooltips';
import 'core/js/shadow';
import 'plugins';

$('body').append(Handlebars.templates.loading());

data.on('ready', () => {
  logging.debug('Calling Adapt.init');
  Adapt.init();
  Adapt.off('adaptCollection:dataLoaded courseModel:dataLoaded');
}).init();
