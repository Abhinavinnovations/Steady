/** Only the managed preview host needs HTTP upgraded before native download.
 * Keep local Metro HTTP and bundled file/asset URIs unchanged.
 */
export function fontDownloadUri(uri: string): string {
  const url = new URL(uri);
  if (url.protocol === "http:" && url.hostname.endsWith(".runable.site")) {
    url.protocol = "https:";
    return url.toString();
  }
  return uri;
}

export type FontFingerprint = { size: number; md5: string };

/** MD5 is the Metro asset content fingerprint, not a security signature. */
export function fontFileMatches(
  actual: { exists: boolean; size: number; md5: string | null },
  expected: FontFingerprint,
): boolean {
  return actual.exists && actual.size === expected.size && actual.md5 === expected.md5;
}
