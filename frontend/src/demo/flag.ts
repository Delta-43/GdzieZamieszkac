/**
 * True in the build for GitHub Pages (npm run build:demo): the app answers from the sample data bundled with it and makes no
 * request to any server. Vite replaces the value at build time, so a normal build contains none of the demo code.
 */
export const DEMO = import.meta.env.VITE_DEMO === 'true'
// A dynamic import() of demo code must test `import.meta.env.VITE_DEMO === 'true'` itself, not this constant: the bundler drops the
// import (and the data behind it) from a normal build only when the test sits beside it.
