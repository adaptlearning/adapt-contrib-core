/**
 * @file Application Bootstrap - Entry point for Adapt Learning Framework
 * @module core/js/app
 * @description Bootstrap file that orchestrates the Adapt Framework initialization sequence.
 * This module loads all core services, initializes the data layer, and starts the framework.
 *
 * **Initialization Sequence:**
 * 1. Import all core services and utilities (wait, device, router, drawer, etc.)
 * 2. Import and register all plugins
 * 3. Display loading screen to user
 * 4. Initialize data service (loads config.json and course data)
 * 5. Wait for data ready event
 * 6. Initialize Adapt framework (triggers adapt:initialize)
 * 7. Start Backbone history and routing
 *
 * **Architecture:**
 * - Side-effect imports initialize singletons (drawer, notify, router, etc.)
 * - Data service coordinates async loading of JSON manifests
 * - Adapt.init() triggers framework startup after data is ready
 * - Loading screen remains visible until first route renders
 *
 * **Service Registration:**
 * The import order matters for some services:
 * - `wait` must load early (provides async coordination primitives)
 * - `data` must initialize before Adapt.init() is called
 * - `router` must load before navigation can begin
 * - `startController` must load to handle _start configuration
 * - `plugins` must load last to ensure core is ready
 *
 * **Public Events:**
 * This module doesn't trigger events directly but orchestrates the sequence:
 * - `data:ready` - Data service finished loading (triggers Adapt.init)
 * - `adapt:preInitialize` - Adapt about to initialize (from Adapt.init)
 * - `adapt:start` - Framework starting (from Adapt.init)
 * - `adapt:initialize` - Framework ready (from Adapt.init)
 *
 * @example
 * import 'core/js/app';
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
