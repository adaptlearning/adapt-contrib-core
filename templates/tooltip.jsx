import React from 'react';
import { classes, compile } from 'core/js/reactHelpers';

export default function Tooltip(props) {
  const {
    text,
    disabledText,
    isDisabled,
    ariaHidden
  } = props;

  return (
    <React.Fragment>
      <div
        className={classes([
          'tooltip__arrow'
        ])}
        aria-hidden='true'
      />
      <div
        className={classes([
          'tooltip__body'
        ])}
        aria-hidden={ariaHidden}
      >
        <div
          className='tooltip__body-inner'
          dangerouslySetInnerHTML={{ __html: compile((isDisabled ? disabledText : text) || '', props) }}
        />
      </div>
    </React.Fragment>
  );
}
