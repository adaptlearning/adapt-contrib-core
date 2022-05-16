import Adapt from 'core/js/adapt';
import device from 'core/js/device';
import React, { useRef } from 'react';
import { prefixClasses, compile } from 'core/js/reactHelpers';

/**
 * Content header for displayTitle, body, instruction text, etc.
 * instruction and mobileInstruction will switch automatically
 * @param {Object} props
 * @param {string} [props.displayTitle]
 * @param {string} [props.body]
 * @param {string} [props.instruction]
 * @param {string} [props.mobileInstruction]
 * @param {string} [props._type]
 * @param {string} [props._component]
 * @param {string} [props._disableAccessibilityState]
 */
export default function Header(props) {
  // Create references to un-controlled view containers
  const jsxHeading = useRef(null);
  const {
    _id,
    displayTitle,
    body,
    instruction,
    mobileInstruction,
    _type,
    _component,
    _disableAccessibilityState,
    _isA11yComponentDescriptionEnabled,
    classNamePrefixes = [
      _type && _type.toLowerCase(),
      _component && _component.toLowerCase()
    ].filter(Boolean)
  } = props;
  const sizedInstruction = (mobileInstruction && device.screenSize !== 'large') ?
    mobileInstruction :
    instruction;
  const _globals = Adapt.course.get('_globals');
  const ariaRegion = _globals?._components?.[`_${_component}`]?.ariaRegion;
  const isSet = (displayTitle || body || sizedInstruction);
  if (!isSet && _isA11yComponentDescriptionEnabled && ariaRegion) {
    // If no title, displaytitle, body or instruction is specified
    // Output only the component description
    return (
      <div className="aria-label" dangerouslySetInnerHTML={{ __html: compile(ariaRegion) }}>
      </div>
    );
  }
  if (!isSet) return null;
  return (
    <div id={`${_id}-header`} className={prefixClasses(classNamePrefixes, ['__header'])}>
      <div className={prefixClasses(classNamePrefixes, ['__header-inner'])}>
        {displayTitle &&
        <div className={prefixClasses(classNamePrefixes, ['__title'])}>

          {!_disableAccessibilityState &&
          <div className="js-heading" ref={jsxHeading}></div>
          }

          <div className={prefixClasses(classNamePrefixes, ['__title-inner'])} aria-hidden={!_disableAccessibilityState} dangerouslySetInnerHTML={{ __html: compile(displayTitle, props) }} >
          </div>

        </div>
        }

        {_isA11yComponentDescriptionEnabled && ariaRegion &&
        <div className="aria-label" dangerouslySetInnerHTML={{ __html: compile(ariaRegion, props) }}>
        </div>
        }

        {body &&
        <div className={prefixClasses(classNamePrefixes, ['__body'])}>
          <div className={prefixClasses(classNamePrefixes, ['__body-inner'])} dangerouslySetInnerHTML={{ __html: compile(body, props) }}>
          </div>
        </div>
        }

        {sizedInstruction &&
        <div className={prefixClasses(classNamePrefixes, ['__instruction'])}>
          <div className={prefixClasses(classNamePrefixes, ['__instruction-inner'])} dangerouslySetInnerHTML={{ __html: compile(sizedInstruction, props) }}>
          </div>
        </div>
        }

      </div>
    </div>
  );
}
