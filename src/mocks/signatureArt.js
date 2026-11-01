/**
 * Generates a handwriting-like SVG signature for seed data.
 * Real users upload their own image; this only fills the demo.
 */
export const makeSignatureSvg = (name, variant = 0) => {
  const last = String(name).split(' ').slice(-1)[0];
  const curves = [
    'M10 70 C 40 20, 60 90, 90 40 S 140 60, 170 30 S 230 50, 270 35',
    'M15 65 C 50 30, 70 80, 110 45 S 160 70, 200 40 S 250 45, 280 30',
  ];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="100" viewBox="0 0 300 100">
<path d="${curves[variant % curves.length]}" fill="none" stroke="#1d3fa8" stroke-width="2.2" stroke-linecap="round"/>
<text x="150" y="62" text-anchor="middle" font-family="'Brush Script MT','Segoe Script','Lucida Handwriting',cursive" font-size="44" fill="#1d3fa8" transform="rotate(-6 150 60)">${last}</text>
</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
};
