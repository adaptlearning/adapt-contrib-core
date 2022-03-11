import Adapt from 'core/js/adapt';
import React from 'react';
import { html, classes, prefixClasses } from 'core/js/reactHelpers';

/**
 * Size switching content image
 * @param {Object} props
 * @param {Array} props.classNamePrefixes
 * @param {Array} [props.attributionClassNamePrefixes]
 */
export default function Image(props) {
  const hasMediumSetting = (Object.prototype.hasOwnProperty.call(props, '_medium') || Object.prototype.hasOwnProperty.call(props, 'medium'));
  const screenSize = hasMediumSetting
    ? Adapt.device.screenSize
    : (Adapt.device.screenSize === 'large' ? 'large' : 'small');
  const src = (
    props[`_${screenSize}`] ||
    props[`${screenSize}`] ||
    props._src ||
    props.src
  );
  const hasSource = Boolean(src);
  if (!hasSource) return null;
  const attributionClassNamePrefixes = (props.attributionClassNamePrefixes || props.classNamePrefixes);
  return (
    <div
      id={props.id}
      className={classes([
        prefixClasses(props.classNamePrefixes, ['__image-container']),
        props.classes,
        props.attribution && 'has-attribution'
      ])}
    >

      <img
        className={prefixClasses(props.classNamePrefixes, ['__image'])}
        src={src}
        aria-label={Adapt.a11y.normalize(props.alt)}
        aria-hidden={!props.alt}
        loading='eager'
        aria-describedby={props.longdescription ? props.longDescriptionId : undefined}
      />

      {props.attribution &&
      <div className={prefixClasses(attributionClassNamePrefixes, ['__attribution'])}>
        <div className={prefixClasses(attributionClassNamePrefixes, ['__attribution-inner'])}>
          {html(props.attribution)}
        </div>
      </div>
      }

    </div>
  );
}
