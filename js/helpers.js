import logging from './logging';
import Handlebars from 'handlebars';

const helpers = {

  lowercase(text) {
    return text.toLowerCase();
  },

  capitalise(text) {
    return text.charAt(0).toUpperCase() + text.slice(1);
  },

  inc(index) {
    return index + 1;
  },

  dec(index) {
    return index - 1;
  },

  odd (index) {
    return (index + 1) % 2 === 0 ? 'even' : 'odd';
  },

  equals(value, text, block) {
    return helpers.compare.call(this, value, '==', text, block);
  },

  compare(value, operator, text, block) {
    // Comparison operators
    switch (operator) {
      case '===':
        if (value === text) return block.fn(this);
        break;
      case '=': case '==':
        // eslint-disable-next-line eqeqeq
        if (value == text) return block.fn(this);
        break;
      case '>=':
        if (value >= text) return block.fn(this);
        break;
      case '<=':
        if (value <= text) return block.fn(this);
        break;
      case '>':
        if (value > text) return block.fn(this);
        break;
      case '<':
        if (value < text) return block.fn(this);
        break;
    }
    return block.inverse(this);
  },

  math(lvalue, operator, rvalue, options) {
    // Mathematical operators
    lvalue = parseFloat(lvalue);
    rvalue = parseFloat(rvalue);
    switch (operator) {
      case '+': return lvalue + rvalue;
      case '-': return lvalue - rvalue;
      case '*': return lvalue * rvalue;
      case '/': return lvalue / rvalue;
      case '%': return lvalue % rvalue;
    }
  },

  /**
   * Equivalent to:
   *  if (conditionA || conditionB)
   * @example
   * {{#any displayTitle body instruction}}
   * <div class='component__header {{_component}}__header'></div>
   * {{/any}}
   */
  any(...args) {
    const specified = args.slice(0, -1);
    const block = args.slice(-1)[0];
    return specified.some(Boolean) ? (block.fn ? block.fn(this) : true) : (block.inverse ? block.inverse(this) : false);
  },

  /**
   * Equivalent to:
   *  if (conditionA && conditionB)
   * @example
   * {{#all displayTitle body instruction}}
   * <div class='component__header {{_component}}__header'></div>
   * {{/all}}
   */
  all(...args) {
    const specified = args.slice(0, -1);
    const block = args.slice(-1)[0];
    return specified.every(Boolean) ? (block.fn ? block.fn(this) : true) : (block.inverse ? block.inverse(this) : false);
  },

  /**
   * Equivalent to:
   *  if (!conditionA && !conditionB)
   * @example
   * {{#none displayTitle body instruction}}
   * <div class='component__header {{_component}}__header'></div>
   * {{/none}}
   */
  none(...args) {
    const specified = args.slice(0, -1);
    const block = args.slice(-1)[0];
    return !specified.some(Boolean) ? (block.fn ? block.fn(this) : true) : (block.inverse ? block.inverse(this) : false);
  },

  /**
   * Allow JSON to be a template i.e. you can use handlebars {{expressions}} within your JSON
   */
  compile(template, context) {
    if (!template) return '';
    if (template instanceof Object) template = template.toString();
    const data = (context?.data?.root ? this : context);
    return Handlebars.compile(template)(data);
  }

};

// Compatibility references
Object.assign(helpers, {

  if_value_equals() {
    logging.deprecated('if_value_equals, use equals instead.');
    return helpers.equals.apply(this, arguments);
  },

  numbers() {
    logging.deprecated('numbers, use inc instead.');
    return helpers.inc.apply(this, arguments);
  },

  lowerCase() {
    logging.deprecated('lowerCase, use lowercase instead.');
    return helpers.lowercase.apply(this, arguments);
  }

});

for (const name in helpers) {
  Handlebars.registerHelper(name, helpers[name]);
}

export default helpers;
