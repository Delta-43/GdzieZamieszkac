import { colors, fonts, scale } from './tokens'

function kebab(name: string): string {
  return name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)
}

/** The tokens as CSS custom properties: --color-*, --font-* and the scale names as they are. */
export function themeCss(): string {
  const declarations = [
    ...Object.entries(colors).map(([name, value]) => `--color-${kebab(name)}: ${value};`),
    ...Object.entries(fonts).map(([name, value]) => `--font-${name}: ${value};`),
    ...Object.entries(scale).map(([name, value]) => `--${name}: ${value};`),
  ]
  return [
    `:root { color-scheme: light; ${declarations.join(' ')} }`,
    // The user asked for less motion: every transition becomes instant.
    '@media (prefers-reduced-motion: reduce) { :root { --duration-fast: 0ms; --duration-base: 0ms; --duration-menu: 0ms; } }',
  ].join('\n')
}

/**
 * Installs the theme through the CSS object model (a constructed stylesheet), not through a style attribute
 * or an inline <style> element, so a strict content security policy does not block it.
 */
export function applyTheme(): void {
  const sheet = new CSSStyleSheet()
  sheet.replaceSync(themeCss())
  document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet]
}
