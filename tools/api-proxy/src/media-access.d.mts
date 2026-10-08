export interface MediaScope {
  path: string;
  query: string;
  origin: string;
  expiresAt: number;
}
export function signMediaAccess(
  scope: MediaScope,
  secret: string,
): Promise<string>;
export function verifyMediaAccess(
  token: string | null,
  secret: string,
  now?: number,
): Promise<MediaScope | null>;
export function mediaAsset(pathname: string): string | null;
export function matchesMediaScope(url: URL, scope: MediaScope): boolean;
