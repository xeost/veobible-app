/** Normalize page params before encoding them again for API requests.
 * ViNext page params can retain percent encoding; Next may provide decoded params.
 */
export function videoCatalogId(param: string): string {
  try {
    return decodeURIComponent(param);
  } catch {
    return param;
  }
}
