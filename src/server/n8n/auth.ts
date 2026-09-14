// Web Crypto works in both Pages Functions and Node 20+; no Node-only dependency
// or environment access belongs in this shared module.
export async function validN8nKey(provided: string | null | undefined, expected: string | undefined): Promise<boolean> {
  if (!expected || !provided || provided.length > 512 || expected.length > 512) return false;
  const bytes = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', bytes.encode(expected), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
  const signature = await crypto.subtle.sign('HMAC', key, bytes.encode(expected));
  // Native HMAC verification avoids an early-exit string comparison.
  return crypto.subtle.verify('HMAC', key, signature, bytes.encode(provided));
}
