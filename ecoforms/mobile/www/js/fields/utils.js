/**
 * @file
 * Utility functions for form fields.
 */

/**
 * Sanitizes a string to be used as a valid HTML ID attribute.
 * Removes non-alphanumeric characters (except hyphens and underscores)
 * and ensures it starts with a letter. If it doesn't, a prefix is added.
 *
 * @param {string} id The string to sanitize.
 * @returns {string} The sanitized ID.
 */
export function sanitizeId(id) {
  if (typeof id !== 'string' || id.trim() === '') {
    return `id-${Math.random().toString(36).substr(2, 9)}`; // Fallback for invalid input
  }
  // Replace non-alphanumeric characters (excluding hyphens and underscores) with an empty string
  let sanitized = id.replace(/[^a-zA-Z0-9_-]/g, '');
  // Ensure it starts with an alphabet character if it doesn't already
  if (!/^[a-zA-Z]/.test(sanitized)) {
    sanitized = `id-${sanitized}`;
  }
  return sanitized;
}
