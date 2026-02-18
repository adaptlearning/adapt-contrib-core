/**
 * @file Safari Label Click Blur Fix - Handles label-input interaction quirks in Safari
 * @module core/js/fixes/safari.label.click.blur
 * @description Utility module that fixes a Safari specific issue where template rerenders
 * on blur events prevent click events from firing when clicking label elements.
 * When enabled, intercepts label clicks and manually triggers clicks on associated input
 * elements via the label's `for` attribute. Applies to both iOS Safari and macOS Safari.
 *
 * **Problem:**
 * Safari's event sequence differs from Chrome/Firefox: it fires mousedown → blur → mouseup → focus → click.
 * When a blur triggers template rerender, the DOM mutation prevents the subsequent click event
 * from firing on the input element. This breaks form interactions and accessibility patterns.
 *
 * **Solution:**
 * Prevent default label click behavior and manually focus and click the target input element.
 * This ensures the click event fires and the input processes the interaction correctly.
 *
 * **References:**
 * - https://www.eventbrite.com/engineering/a-story-of-a-react-re-rendering-bug/
 * - https://sitr.us/2011/07/28/how-mobile-safari-emulates-mouse-events.html
 * - https://stackoverflow.com/questions/9335325/blur-event-stops-click-event-from-working
 */

import Adapt from 'core/js/adapt';
import 'core/js/templates';

Adapt.on('app:dataReady', () => {
  const config = Adapt.config.get('_fixes');
  if (config?._safariLabelClickBlur === false) return;
  applySafariLabelClickBlur();
});

/**
 * Handles click events on label elements by manually triggering the associated input click.
 * Replaces the default label-to-input click delegation with manual event handling.
 * This prevents issues where template rerenders on blur cancel the subsequent click event.
 * First focuses the input (for proper screen reader announcements in JAWS, preventing
 * unwanted scroll-to-top), then clicks it. If the label's `for` attribute doesn't reference
 * a valid input element, silently returns without error.
 * @private
 * @param {MouseEvent} event - Click event from the label element
 * @returns {void}
 * @example
 * // Called internally when user clicks a label
 * // Automatically focuses and clicks the associated input
 * const input = document.querySelector('[id="checkbox-1"]');
 * input.focus();  // Announce to screen readers
 * input.click();  // Trigger input handler
 */
function onLabelClick (event) {
  const input = document.querySelector(`[id="${event.currentTarget.getAttribute('for')}"]`);
  if (!input) return;
  event.preventDefault();
  // focus first so that JAWS doesn't jump scroll to the top
  input.focus();
  input.click();
};

/**
 * Applies the Safari label-input click fix to React component render pipeline.
 * Intercepts the React pre-render phase ('reactElement:preRender' event) to inject
 * click handlers on label elements before they're mounted to the DOM. Only adds the
 * click handler if:
 * - Element is a `<label>` tag
 * - Element has an `htmlFor` attribute (references an input)
 * - Element doesn't already have an `onClick` handler (prevents override)
 * This ensures the fix applies to all dynamically rendered labels in the course
 * without requiring manual intervention or wrapper components.
 * @private
 * @returns {void}
 */
function applySafariLabelClickBlur () {
  Adapt.on('reactElement:preRender', event => {
    const [tagName, props] = event.args;
    if (tagName !== 'label' || !Object.hasOwn(props, 'htmlFor') || Object.hasOwn(props, 'onClick')) return;
    props.onClick = onLabelClick;
  });
}
