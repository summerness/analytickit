/**
 * Validate the syntax of a tagName to make sure that it has a valid syntax for the query engine.
 * Many libraries use invalid property and tag names, such as Facebook that use FB: prefixed tags.
 * These make the query engines fail and must be filtered out.
 * @param {string} tagName. The element's tag name
 */
export function tagName(tagName) {
  if (
    typeof tagName === 'string' &&
    tagName.match(/^[a-zA-Z0-9-]+$/gi) !== null
  ) {
    return tagName
  }
  return false
}
/**
 * Validate the syntax of an attribute to make sure that it has a valid syntax for the query engine.
 * @param {string} attribute. The element's attribute's value
 */
export function attr(attribute) {
  if (
    typeof attribute === 'string' &&
    attribute.match(/^[0-9a-zA-Z][a-zA-Z_\-:0-9.]*$/gi) !== null
  ) {
    return attribute
  }
  return false
}

/**
 * Validate the syntax of an attribute to make sure that it has a valid syntax for the query engine.
 * @param {string} attribute. The element's attribute's value
 */
export function className(className) {
  if (
    typeof className === 'string' &&
    className.match(/^\.?[a-zA-Z_\-:0-9]*$/gi) !== null
  ) {
    return className
  }
  return false
}

// https://github.com/jquery/jquery/blob/d0ce00cdfa680f1f0c38460bc51ea14079ae8b07/src/selector/escapeSelector.js
// copied from jQuery (MIT License)
export function escapeClassName(className) {
  // CSS string/identifier serialization
  // https://drafts.csswg.org/cssom/#common-serializing-idioms
  // eslint-disable-next-line no-control-regex
  var rcssescape = /([\0-\x1f\x7f]|^-?\d)|^-$|[^\x80-\uFFFF\w-]/g

  function fcssescape(ch, asCodePoint) {
    if (asCodePoint) {
      // U+0000 NULL becomes U+FFFD REPLACEMENT CHARACTER
      if (ch === '\0') {
        return '\uFFFD'
      }

      // Control characters and (dependent upon position) numbers get escaped as code points
      return (
        ch.slice(0, -1) + '\\' + ch.charCodeAt(ch.length - 1).toString(16) + ' '
      )
    }

    // Other potentially-special ASCII characters get backslash-escaped
    return '\\' + ch
  }

  return className.replace(rcssescape, fcssescape)
}
