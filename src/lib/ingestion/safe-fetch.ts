import { promises as dns } from 'node:dns';
import { isIP } from 'node:net';

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
    throw new Error('URL is malformed');
  }

  if (url.protocol !== 'https:') {
    throw new Error('Only HTTPS URLs are allowed');
  }
  if (url.username || url.password) {
    throw new Error('URLs containing credentials are not allowed');
  }
  if (!url.hostname) {
    throw new Error('URL hostname is required');
  }

  const directIpVersion = isIP(url.hostname);
  const addresses = directIpVersion
    ? [{ address: url.hostname }]
    : await dns.lookup(url.hostname, { all: true, verbatim: true });

  if (
    addresses.length === 0 ||
    addresses.some(({ address }) => isPrivateNetworkAddress(address))
  ) {
    throw new Error('URL resolves to a private or restricted network address');
  }

  return url;
}

async function readBoundedBody(
  response: Response,
  maximumBytes: number,
): Promise<Uint8Array> {
  const declaredLength = Number(response.headers.get('content-length') || '0');
  if (declaredLength > maximumBytes) {
    throw new Error(`Remote response exceeds the ${maximumBytes}-byte size limit`);
  }
  if (!response.body) {
    throw new Error('Remote response contained no body');
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
      throw new Error(`Remote response exceeds the ${maximumBytes}-byte size limit`);
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
  },
): Promise<SafeFetchResult> {
  let currentUrl = await validatePublicHttpsUrl(input);
  const maximumRedirects = options.maximumRedirects ?? DEFAULT_MAX_REDIRECTS;

  for (let redirectCount = 0; redirectCount <= maximumRedirects; redirectCount++) {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    );

    let response: Response;
    try {
      response = await fetch(currentUrl, {
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
        throw new Error('Remote source request timed out');
      }
      throw new Error(`Remote source request failed: ${error?.message || 'network error'}`);
    }

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (!location) {
        clearTimeout(timeout);
        throw new Error('Remote source returned a redirect without a destination');
      }
      if (redirectCount === maximumRedirects) {
        clearTimeout(timeout);
        throw new Error('Remote source exceeded the redirect limit');
      }
      await response.body?.cancel();
      clearTimeout(timeout);
      currentUrl = await validatePublicHttpsUrl(
        new URL(location, currentUrl).toString(),
      );
      continue;
    }

    if (!response.ok) {
      clearTimeout(timeout);
      throw new Error(`Remote source returned HTTP ${response.status}`);
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
      throw new Error(
        `Remote source returned unsupported Content-Type "${contentType || 'missing'}"`,
      );
    }

    try {
      return {
        finalUrl: currentUrl.toString(),
        contentType,
        data: await readBoundedBody(response, options.maximumBytes),
      };
    } catch (error: any) {
      if (error?.name === 'AbortError') {
        throw new Error('Remote source request timed out');
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  throw new Error('Remote source could not be fetched');
}
