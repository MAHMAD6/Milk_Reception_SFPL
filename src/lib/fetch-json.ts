/**
 * Fetches a JSON endpoint and returns the parsed body, throwing an Error with
 * the API's `error` message (or `fallbackError`) when the response is not ok.
 *
 * Keeping the request free of React state lets components apply results in
 * promise callbacks, so data-loading effects never set state synchronously.
 */
export async function fetchJson<T = Record<string, unknown>>(
  input: RequestInfo | URL,
  init?: RequestInit,
  fallbackError = 'Request failed.'
): Promise<T> {
  const res = await fetch(input, init);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = body && typeof body === 'object' && typeof body.error === 'string' ? body.error : '';
    throw new Error(message || fallbackError);
  }
  return body as T;
}
