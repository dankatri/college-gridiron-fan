export const WEBAUTHN_RP_NAME = 'College Fantasy Football';

export function getWebAuthnRPID(request: Request): string {
  return process.env.WEBAUTHN_RP_ID || new URL(request.url).hostname;
}

export function getWebAuthnOrigin(request: Request): string {
  return process.env.WEBAUTHN_ORIGIN || new URL(request.url).origin;
}
