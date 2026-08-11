import { promises as dns } from 'node:dns';
import { isIP } from 'node:net';
import { IngestionFailure } from './errors';

const DEFAULT_TIMEOUT_MS = 12_000;
const DEFAULT_MAX_REDIRECTS = 4;

export interface SafeFetchResult {
  finalUrl: string;
  contentType: string;
  data: Uint8Array;
}

function isPrivateIpv4(address: string): boolean {
  const octets = address.split('.').map(Number);
  if (octets.length !== 4 || octets.some((value) => !Number.isInteger(value))) {
    return true;
  }
  const [a, b] = octets;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127) ||
    a >= 224
  );
}

function isPrivateIpv6(address: string): boolean {
  const normalized = address.toLowerCase().split('%')[0];
  if (
    normalized === '::' ||
    normalized === '::1' ||
    normalized.startsWith('fc') ||
    normalized.startsWith('fd') ||
    /^fe[89ab]/.test(normalized)
  ) {
    return true;
  }

  if (normalized.startsWith('::ffff:')) {
    const mapped = normalized.substring('::ffff:'.length);
    return isIP(mapped) === 4 ? isPrivateIpv4(mapped) : true;
  }
  return false;
}

export function isPrivateNetworkAddress(address: string): boolean {
  const version = isIP(address);
  if (version === 4) return isPrivateIpv4(address);
  if (version === 6) return isPrivateIpv6(address);
  return true;
}

export async function validatePublicHttpsUrl(input: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new IngestionFailure({
      message: 'Remote source URL is malformed',
      errorCode: 'FETCH_INVALID_URL',
      userMessage: 'Enter a valid HTTPS URL.',
    });
  }

  if (url.protocol !== 'https:') {
    throw new IngestionFailure({
      message: 'Remote source URL does not use HTTPS',
      errorCode: 'FETCH_INVALID_URL',
      userMessage: 'Only HTTPS source URLs are supported.',
    });
  }
  if (url.username || url.password) {
    throw new IngestionFailure({
      message: 'Remote source URL contains credentials',
      errorCode: 'FETCH_INVALID_URL',
      userMessage: 'Source URLs cannot contain embedded credentials.',
    });
  }
  if (!url.hostname) {
    throw new IngestionFailure({
      message: 'Remote source URL has no hostname',
      errorCode: 'FETCH_INVALID_URL',
      userMessage: 'Enter a source URL with a valid hostname.',
    });
  }

  const directIpVersion = isIP(url.hostname);
  let addresses: Array<{ address: string }>;
  try {
    addresses = directIpVersion
      ? [{ address: url.hostname }]
      : await dns.lookup(url.hostname, { all: true, verbatim: true });
  } catch (error) {
    throw new IngestionFailure({
      message: 'Remote source hostname could not be resolved',
      errorCode: 'FETCH_ORIGIN_UNREACHABLE',
      userMessage: 'The website hostname could not be reached. Check the URL and retry.',
      retryable: true,
      cause: error,
    });
  }

  if (
    addresses.length === 0 ||
    addresses.some(({ address }) => isPrivateNetworkAddress(address))
  ) {
    throw new IngestionFailure({
      message: 'Remote source resolves to a private or restricted address',
      errorCode: 'FETCH_ORIGIN_BLOCKED',
      userMessage: 'This source address is not allowed for security reasons.',
    });
  }

  return url;
}

async function readBoundedBody(
  response: Response,
  maximumBytes: number,
): Promise<Uint8Array> {
  const declaredLength = Number(response.headers.get('content-length') || '0');
  if (declaredLength > maximumBytes) {
    throw new IngestionFailure({
      message: `Remote response exceeds the ${maximumBytes}-byte size limit`,
      errorCode: 'FETCH_RESPONSE_TOO_LARGE',
      userMessage: 'The remote source is too large to ingest.',
    });
  }
  if (!response.body) {
    throw new IngestionFailure({
      message: 'Remote response contained no body',
      errorCode: 'FETCH_ORIGIN_UNREACHABLE',
      userMessage: 'The remote source returned no content. Please retry shortly.',
      retryable: true,
    });
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maximumBytes) {
      await reader.cancel();
      throw new IngestionFailure({
        message: `Remote response exceeds the ${maximumBytes}-byte size limit`,
        errorCode: 'FETCH_RESPONSE_TOO_LARGE',
        userMessage: 'The remote source is too large to ingest.',
      });
    }
    chunks.push(value);
  }

  const output = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return output;
}

export async function safeFetch(
  input: string,
  options: {
    maximumBytes: number;
    allowedContentTypes: string[];
    timeoutMs?: number;
    maximumRedirects?: number;
    fetchImpl?: typeof fetch;
    validateUrl?: typeof validatePublicHttpsUrl;
  },
): Promise<SafeFetchResult> {
  const validateUrl = options.validateUrl || validatePublicHttpsUrl;
  const fetchImpl = options.fetchImpl || fetch;
  let currentUrl = await validateUrl(input);
  const maximumRedirects = options.maximumRedirects ?? DEFAULT_MAX_REDIRECTS;

  for (let redirectCount = 0; redirectCount <= maximumRedirects; redirectCount++) {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    );

    let response: Response;
    try {
      response = await fetchImpl(currentUrl, {
        redirect: 'manual',
        signal: controller.signal,
        headers: {
          'User-Agent': 'Lumora-Ingestion/1.0',
          Accept: options.allowedContentTypes.join(', '),
        },
      });
    } catch (error: any) {
      clearTimeout(timeout);
      if (error?.name === 'AbortError') {
        throw new IngestionFailure({
          message: 'Remote source request timed out',
          errorCode: 'FETCH_TIMEOUT',
          userMessage: 'The remote source took too long to respond. Please retry shortly.',
          retryable: true,
        });
      }
      throw new IngestionFailure({
        message: `Remote source request failed: ${error?.message || 'network error'}`,
        errorCode: 'FETCH_ORIGIN_UNREACHABLE',
        userMessage: 'The remote source could not be reached. Please retry shortly.',
        retryable: true,
        cause: error,
      });
    }

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (!location) {
        clearTimeout(timeout);
        throw new IngestionFailure({
          message: 'Remote source returned a redirect without a destination',
          errorCode: 'FETCH_REDIRECT_ERROR',
          userMessage: 'The source redirected to an invalid destination.',
        });
      }
      if (redirectCount === maximumRedirects) {
        clearTimeout(timeout);
        throw new IngestionFailure({
          message: 'Remote source exceeded the redirect limit',
          errorCode: 'FETCH_REDIRECT_ERROR',
          userMessage: 'The source redirected too many times.',
        });
      }
      await response.body?.cancel();
      clearTimeout(timeout);
      currentUrl = await validateUrl(
        new URL(location, currentUrl).toString(),
      );
      continue;
    }

    if (!response.ok) {
      clearTimeout(timeout);
      throw new IngestionFailure({
        message: `Remote source returned HTTP ${response.status}`,
        errorCode:
          response.status === 401 || response.status === 403
            ? 'FETCH_ORIGIN_BLOCKED'
            : 'FETCH_ORIGIN_UNREACHABLE',
        userMessage:
          response.status === 401 || response.status === 403
            ? 'The website blocked access or requires authentication.'
            : 'The remote source returned an error. Please retry shortly.',
        retryable: response.status === 408 || response.status === 429 || response.status >= 500,
        httpStatus: response.status,
      });
    }

    const contentType = (response.headers.get('content-type') || '')
      .split(';')[0]
      .trim()
      .toLowerCase();
    if (
      !options.allowedContentTypes.some(
        (allowed) =>
          contentType === allowed || contentType.startsWith(`${allowed}+`),
      )
    ) {
      clearTimeout(timeout);
      throw new IngestionFailure({
        message: `Remote source returned unsupported Content-Type "${contentType || 'missing'}"`,
        errorCode: 'FETCH_UNSUPPORTED_CONTENT_TYPE',
        userMessage: 'The URL did not return a supported webpage or document type.',
      });
    }

    try {
      return {
        finalUrl: currentUrl.toString(),
        contentType,
        data: await readBoundedBody(response, options.maximumBytes),
      };
    } catch (error: any) {
      if (error?.name === 'AbortError') {
        throw new IngestionFailure({
          message: 'Remote source request timed out while reading the response',
          errorCode: 'FETCH_TIMEOUT',
          userMessage: 'The remote source took too long to respond. Please retry shortly.',
          retryable: true,
        });
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  throw new IngestionFailure({
    message: 'Remote source could not be fetched',
    errorCode: 'FETCH_ORIGIN_UNREACHABLE',
    userMessage: 'The remote source could not be reached. Please retry shortly.',
    retryable: true,
  });
}
