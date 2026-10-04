// Colours for the canvas of the map. A canvas cannot use CSS variables, so the theme's colours are read from them and handed over as numbers.
// Colour maths lives in the theme folder, where writing a colour is allowed.

export type Rgb = [number, number, number]

/** The colour of a theme variable (for example --color-map-ramp3) as red, green and blue, 0 to 255. Reads the live value, so it follows the theme. */
export function themeRgb(variable: string): Rgb {
  const value = getComputedStyle(document.documentElement).getPropertyValue(variable).trim().replace('#', '')
  const full = value.length === 3 ? [...value].map((char) => char + char).join('') : value
  return [parseInt(full.slice(0, 2), 16) || 0, parseInt(full.slice(2, 4), 16) || 0, parseInt(full.slice(4, 6), 16) || 0]
}

/** A canvas colour from three numbers. */
export function cssRgb(red: number, green: number, blue: number): string {
  return `rgb(${Math.round(red)},${Math.round(green)},${Math.round(blue)})`
}
