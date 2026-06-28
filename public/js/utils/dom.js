/** DOM utilities to simplify HTML element manipulation and creation */
/** Shorthand for document.getElementById */
export function $(id) {
  return document.getElementById(id);
}

/** Shorthand for document.querySelector */
export function $q(selector, root = document) {
  return root.querySelector(selector);
}

/** Create a DOM element with options */
export function el(tag, options = {}) {
  const element = document.createElement(tag);

  if (options.className) element.className = options.className;
  if (options.text)      element.textContent = options.text;
  if (options.html)      element.innerHTML = options.html;

  if (options.attrs) {
    for (const [key, value] of Object.entries(options.attrs)) {
      element.setAttribute(key, value);
    }
  }

  if (options.dataset) {
    for (const [key, value] of Object.entries(options.dataset)) {
      element.dataset[key] = value;
    }
  }

  if (options.style) {
    for (const [key, value] of Object.entries(options.style)) {
      element.style[key] = value;
    }
  }

  return element;
}
