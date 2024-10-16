/**
 * Toggle a className in the _classes attribute of any Backbone.Model
 * @param model {Backbone.Model} Model with a _classes attribute to modify
 * @param className {string} Name or names of class to add/remove to _classes attribute, space separated list
 * @param hasClass {boolean} true to add a class, false to remove
 */
export function toggleModelClass(model, className, hasClass) {
  // split the string of classes into an array of classNames
  const currentClassNames = (model.get('_classes') || '').split(' ').filter(Boolean);
  // capture all existing classes as a unique list
  const classesObject = currentClassNames.reduce((classesObject, className) => ({ ...classesObject, [className]: true }), {});
  // update the list according to arguments
  const shouldToggleExisting = (hasClass === null || hasClass === undefined);
  // allow multiple classes to be added and removed together
  className
    .split(' ')
    .filter(Boolean)
    .forEach(className => {
      // toggle class
      classesObject[className] = shouldToggleExisting
        ? !classesObject[className]
        : Boolean(hasClass);
    });
  // flatten back into a string of classes
  const outputClasses = Object
    .entries(classesObject)
    .filter(([, hasClass]) => hasClass)
    .map(([className]) => className)
    .join(' ');
  // update the model
  model.set('_classes', outputClasses);
}
