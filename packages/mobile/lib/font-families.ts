/** Keep the browser's original font names; native aliases are private to one JS launch.
 * Expo's loaded-font cache can survive a reload. A fresh namespace ensures that
 * loadAsync reaches the native typeface registration instead of trusting that cache.
 * No font file, weight, glyph, device preference or saved app data is changed.
 */
export function fontFamilies(platform: string, launch: string) {
  const name = (face: string) => platform === "web" ? face : `Steady_${face}_${launch}`;
  return {
    sans: name("DMSansRegular"),
    medium: name("DMSansMedium"),
    semibold: name("DMSansSemiBold"),
    bold: name("DMSansBold"),
    display: name("LibreCaslonDisplay"),
  };
}
