function overrideFullscreenRequest(name) {
  const original = HTMLElement.prototype[name];
  if (!original) return;
  HTMLElement.prototype[name] = function(...args) {
    const event = new CustomEvent('preRequestFullscreen', { bubbles: true });
    this.dispatchEvent(event);
    original.call(this, ...args);
  };
}

[
  'requestFullscreen',
  'webkitRequestFullscreen',
  'webkitRequestFullScreen',
  'mozRequestFullScreen'
].forEach(overrideFullscreenRequest);

function onPreRequestFullscreen(event) {
  try {
    const target = event.target;
    const parent = target?.parentElement;
    if (!parent) return;
    parent.dataset.preFullscreenHeight = parent.style.height;
    parent.style.height = `${target.clientHeight}px`;
  } catch (e) {}
}

document.addEventListener('preRequestFullscreen', onPreRequestFullscreen);

function onFullscreenChange(event) {
  if (document.fullscreenElement) return;
  try {
    const target = event.target;
    const parent = target?.parentElement;
    if (!parent) return;
    parent.style.height = parent.dataset.preFullscreenHeight ?? '';
    delete parent.dataset.preFullscreenHeight;
  } catch (e) {}
}

[
  'fullscreenchange',
  'webkitfullscreenchange',
  'mozfullscreenchange'
].forEach(name => document.addEventListener(name, onFullscreenChange));
