import { UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';

function firstHeader(value: string | string[] | undefined): string | undefined {
  const v = Array.isArray(value) ? value[0] : value;
  if (typeof v !== 'string') return undefined;
  const t = v.trim();
  return t.length > 0 ? t : undefined;
}

/** User id injected by API Gateway from JWT (`sub`). */
export function readGatewayUserId(req: Request): string | undefined {
  return firstHeader(req.headers['x-user-id']);
}

export function readGatewayUserIdOrThrow(req: Request): string {
  const id = readGatewayUserId(req);
  if (!id) {
    throw new UnauthorizedException('Missing user identity (x-user-id)');
  }
  return id;
}

/** Role from gateway, compared case-insensitively (JWT may carry ADMIN). */
export function readGatewayIsAdmin(req: Request): boolean {
  const raw = firstHeader(req.headers['x-user-role']);
  return raw?.toLowerCase() === 'admin';
}
