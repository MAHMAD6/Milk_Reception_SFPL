/**
 * Outbound SMS delivery through a generic HTTPS JSON gateway.
 *
 * Configure with:
 *   SMS_PROVIDER_URL    HTTPS endpoint that accepts POST {to, message, sender}
 *   SMS_PROVIDER_TOKEN  Bearer token for that endpoint (optional)
 *   SMS_SENDER_ID       Sender name / short code passed through as `sender` (optional)
 *
 * Most Pakistani SMS aggregators and Twilio-style relays can be fronted by this shape.
 */

export interface SmsSendResult {
  providerMessageId: string | null;
}

export function isSmsProviderConfigured(): boolean {
  return Boolean(process.env.SMS_PROVIDER_URL?.trim());
}

export async function sendSms(to: string, message: string): Promise<SmsSendResult> {
  const url = process.env.SMS_PROVIDER_URL?.trim();
  if (!url) throw new Error('SMS provider is not configured.');

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = process.env.SMS_PROVIDER_TOKEN?.trim();
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ to, message, sender: process.env.SMS_SENDER_ID?.trim() || undefined }),
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    throw new Error(`SMS provider responded with HTTP ${response.status}.`);
  }

  const body = (await response.json().catch(() => null)) as Record<string, unknown> | null;
  const id = body?.messageId ?? body?.message_id ?? body?.id ?? body?.sid ?? null;
  return { providerMessageId: id == null ? null : String(id).slice(0, 255) };
}
