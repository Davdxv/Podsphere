import DOMPurify from 'isomorphic-dompurify';
import he from 'he';

const SANITIZE_OPTIONS_NO_HTML = {
  USE_PROFILES: { html: false },
};
const SANITIZE_OPTIONS_ALLOWED_HTML = {
  ALLOWED_TAGS: ['b', 'i', 'em', 'u', 'strong', 'a', 'p'],
  ALLOWED_ATTR: ['href'],
};

const REGEX_ONLY_WORD_CHARS = /^\w+$/;
const REGEX_ANY_TRAILING_SLASHES = /\/+$/;

/**
 * TODO: expand string sanitization; revise default options above.
 * @param str
 * @param allowHtml
 * @param sanitizeOptions
 *   See: {@link https://github.com/cure53/DOMPurify/blob/main/README.md#can-i-configure-dompurify}
 * @returns The sanitized trimmed string, or an empty string if `str` is not a string
 */
export function sanitizeString(str : string, allowHtml = false, sanitizeOptions = {}) : string {
  if (!str || typeof str !== 'string') return '';
  if (str.match(REGEX_ONLY_WORD_CHARS)) return str;

  const defaultOptions = allowHtml ? SANITIZE_OPTIONS_ALLOWED_HTML : SANITIZE_OPTIONS_NO_HTML;
  const sanitized = DOMPurify.sanitize(str, { ...defaultOptions, ...sanitizeOptions }).trim();
  return allowHtml ? sanitized : he.decode(sanitized);
}

/**
 * TODO:
 *   - employ proper URI sanitization
 *     - do: allow any future TLD's, like '.crypto'
 *     - don't: allow any protocols unknown to HTTP GET, like 'rss3://';
 *              these can be handled in f.i. sanitizeWeb3Uri()
 * @param uri
 * @param throwOnError
 * @returns The sanitized `uri` if valid, else if `!throwOnError`: an empty string
 * @throws {Error} If `throwOnError = true` and `uri` is an invalid URI
 */
export function sanitizeUri(uri: string, throwOnError = false) : string {
  const sanitizedUri = sanitizeString(uri, false);

  if (throwOnError && !isValidUrl(sanitizedUri)) {
    throw new Error(`${uri} is not a valid link.`);
  }

  return sanitizedUri.replace(REGEX_ANY_TRAILING_SLASHES, '');
}

export function isValidUrl(uri: string) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const url = new URL(uri);
  }
  catch (_ex) {
    return false;
  }
  return true;
}
