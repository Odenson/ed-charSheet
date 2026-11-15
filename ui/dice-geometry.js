// ui/dice-geometry.js — pure geometry for the shared roll-button die icon
// (pip face, five pips). DOM- and lit-free so it is unit-testable; the lit
// template that draws it lives in ui/dice-icon.js.
// Drawn on a 16-unit grid and rendered at 16px (1 unit = 1 device pixel at 1x),
// so edges land on pixel boundaries and the die looks identical wherever the
// button's own box falls on a fractional pixel.
export const DIE_VIEWBOX = 16;
export const DIE_FRAME = { x: 2.75, y: 2.75, size: 10.5, rx: 3, stroke: 1.5 };
export const DIE_PIP_R = 1.1;
export const DIE_PIPS = [
  [5.5, 5.5], [10.5, 5.5],
  [8, 8],
  [5.5, 10.5], [10.5, 10.5],
];
