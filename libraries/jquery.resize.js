'use strict';
// jquery.resize 2024-09-03
(function() {
  // skip if library is already handling resize events
  if ($.event.special.resize) return;
  // skip if old library has been loaded
  if ($.fn.off.elementResizeOriginalOff) return;
  // handler id generation
  let idIndex = 0;
  function makeId(element, data) {
    // make a unique event id from the element's expando property and the event handler guid
    element[$.expando] = element[$.expando] || ++idIndex;
    return data.guid + "-" + element[$.expando];
  }
  function getUniqueMeasurementId(element) {
    // create a easily comparible string for specific height/width pairs
    const height = element.clientHeight;
    const width = element.clientWidth;
    return `${height},${width}`
  }
  const registered = []
  // jQuery element + event handler attachment / removal
  $.event.special.resize = {
    noBubble: true,
    add: function (data) {
      // allow window resize to be handled by browser
      if (this === window) return;
      // add item to observe
      const item = {
        id: makeId(this, data),
        element: this,
        uniqueMeasurementId: getUniqueMeasurementId(this),
        observer: new window.ResizeObserver(() => {
          const uniqueMeasurementId = getUniqueMeasurementId(item.element);
          const hasMeasureChanged = (
            !item.uniqueMeasurementId ||
            item.uniqueMeasurementId !== uniqueMeasurementId
          );
          if (!hasMeasureChanged) return;
          item.uniqueMeasurementId = uniqueMeasurementId;
          $(this).trigger('resize');
        })
      }
      registered.push(item);
      item.observer.observe(this)
    },
    remove: function(data) {
      // allow window resize to be handled by browser
      if (this === window) return;
      // remove and disconnect matching item
      const findId = makeId(this, data);
      // run in reverse to prevent index shifts
      for (let i = registered.length - 1, l = -1; i > l; i--) {
        const item = registered[i]
        if (item.id !== findId) continue;
        registered.splice(i, 1);
        item.observer.disconnect()
      }
    }
  };
})();
