// Biola University brand tokens.
// Source: https://www.biola.edu/brand/toolkits-standards/visual-design (read 2026-10-21).
// This is the single source of truth for the web UI (served as /brand.css) and the email
// template (values are inlined). Change colors or fonts here, nowhere else.

export const color = {
  // Core colors. "Official colors ... should be utilized in brand communications whenever possible."
  red: '#CC1122',   // Biola Red, Pantone 186
  black: '#000000',
  white: '#FFFFFF',

  // Complementary primaries, in wide use in recent Biola materials.
  electricRed: '#FF342E',  // hover and active states on red controls
  electricBlue: '#78D2F7', // small accents only
  skyBlue: '#E2EFF8',      // "softens the red"; page ground and quiet panels
  gradBlue: '#1D273B',     // deep navy for a more sophisticated dark surface

  // Secondary palette, used here for text and rules so every gray carries Biola's cool cast.
  slate: '#2F3E53',  // Talbot East Slate: body copy, captions, footer text
  fountain: '#0488A4', // Fountain Blue: links inside slate text when red would shout

  // Derived neutrals (not official swatches): Sky Blue mixed toward white or slate.
  rule: '#CBD8E4',     // hairlines and dividers
  dot: '#C4D0DC',      // dot grid. Biola: light gray or white only, never color
  inkMuted: '#5B6B80', // helper text that still passes 4.5:1 on white and Sky Blue
};

export const font = {
  // Gotham is Biola's primary face. It is not a web font, so Proxima Nova / Helvetica
  // (Biola's named substitutes) follow it in the stack.
  body: "'Gotham', 'Proxima Nova', 'Helvetica Neue', Helvetica, Arial, sans-serif",
  // League Spartan is Biola's secondary face for large headlines. Bold weight only.
  display: "'League Spartan', 'Gotham', 'Proxima Nova', 'Helvetica Neue', Helvetica, Arial, sans-serif",
  displayWeight: 700,
  googleFontsHref: 'https://fonts.googleapis.com/css2?family=League+Spartan:wght@700&display=swap',
};

// One corner system for the whole product: square. Biola's materials are built on
// straight color blocks, and square corners survive every email client.
export const radius = '0px';

// Dot grid: Biola's "community" pattern. Gray on a light ground, scaled to taste.
export const dotGrid = {
  size: 18, // px between dot centers
  css: `radial-gradient(${color.dot} 1.1px, transparent 1.4px)`,
};

export const links = {
  brandGuide: 'https://www.biola.edu/brand',
  biola: 'https://www.biola.edu',
};

// CSS custom properties for the web UI. Served by the app at GET /brand.css.
export function brandCss() {
  return `/* Generated from src/brand.js. Edit that file, not this output. */
@import url('${font.googleFontsHref}');
:root {
  --biola-red: ${color.red};
  --biola-black: ${color.black};
  --biola-white: ${color.white};
  --electric-red: ${color.electricRed};
  --electric-blue: ${color.electricBlue};
  --sky-blue: ${color.skyBlue};
  --grad-blue: ${color.gradBlue};
  --slate: ${color.slate};
  --fountain: ${color.fountain};
  --rule: ${color.rule};
  --dot: ${color.dot};
  --ink-muted: ${color.inkMuted};
  --font-body: ${font.body};
  --font-display: ${font.display};
  --radius: ${radius};
  --dot-grid: ${dotGrid.css};
  --dot-grid-size: ${dotGrid.size}px ${dotGrid.size}px;
}
`;
}
