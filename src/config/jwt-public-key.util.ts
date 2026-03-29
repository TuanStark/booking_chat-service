import { readFileSync } from 'fs';
import { join } from 'path';
import type { ConfigService } from '@nestjs/config';

/**
 * RS256 access tokens from auth-service — same key material as API gateway.
 * Prefer JWT_PUBLIC_KEY (PEM); optional JWT_PUBLIC_KEY_PATH or keys/public.pem.
 */
export function resolveJwtPublicKeyPem(config: ConfigService): string {
  const inline = config.get<string>('JWT_PUBLIC_KEY');
  if (inline?.trim()) {
    return inline.includes('BEGIN') && !inline.includes('\n')
      ? inline.replace(/\\n/g, '\n')
      : inline;
  }
  const path =
    config.get<string>('JWT_PUBLIC_KEY_PATH') || join(process.cwd(), 'keys', 'public.pem');
  try {
    return readFileSync(path, 'utf8');
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(
      `JWT public key not found for WebSocket auth: set JWT_PUBLIC_KEY or JWT_PUBLIC_KEY_PATH (${path}). ${msg}`,
    );
  }
}
