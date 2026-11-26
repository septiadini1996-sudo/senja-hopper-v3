// Every icon in the game is drawn here with paths — no emoji, no image files —
// in one stroke style (round caps, weight proportional to size) so cargo,
// upgrades, challenges and controller glyphs all belong to the same poster.

import { PALETTE } from './config.js';

export function rr(ctx, x, y, w, h, r) {
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

function pen(ctx, size, color) {
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1.6, size * 0.075);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
}

/** Cargo icons by story kind. Box is size×size centred on (x, y). */
export function drawCargoIcon(ctx, kind, x, y, size, color = PALETTE.cream) {
  const s = size / 2;
  ctx.save();
  ctx.translate(x, y);
  pen(ctx, size, color);
  ctx.fillStyle = color;
  if (kind === 'vial') {
    rr(ctx, -s * 0.32, -s * 0.2, s * 0.64, s * 1.2, s * 0.2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-s * 0.14, -s * 0.2); ctx.lineTo(-s * 0.14, -s * 0.62); ctx.lineTo(s * 0.14, -s * 0.62); ctx.lineTo(s * 0.14, -s * 0.2); ctx.stroke();
    ctx.fillRect(-s * 0.32, -s * 0.95, s * 0.64, s * 0.3);
    ctx.beginPath(); ctx.moveTo(-s * 0.32, s * 0.25); ctx.lineTo(s * 0.32, s * 0.25); ctx.stroke();
  } else if (kind === 'dress') {
    ctx.beginPath();
    ctx.moveTo(0, -s * 0.95); ctx.lineTo(-s * 0.2, -s * 0.5); ctx.lineTo(-s * 0.12, -s * 0.05);
    ctx.lineTo(-s * 0.72, s * 0.95); ctx.lineTo(s * 0.72, s * 0.95); ctx.lineTo(s * 0.12, -s * 0.05); ctx.lineTo(s * 0.2, -s * 0.5);
    ctx.closePath(); ctx.stroke();
  } else if (kind === 'papers') {
    rr(ctx, -s * 0.62, -s * 0.8, s * 1.24, s * 1.6, s * 0.1); ctx.stroke();
    for (let i = 0; i < 3; i += 1) { ctx.beginPath(); ctx.moveTo(-s * 0.38, -s * 0.34 + i * s * 0.36); ctx.lineTo(s * 0.38, -s * 0.34 + i * s * 0.36); ctx.stroke(); }
    ctx.beginPath(); ctx.arc(s * 0.34, s * 0.5, s * 0.2, 0, Math.PI * 2); ctx.stroke();
  } else if (kind === 'turtle') {
    ctx.beginPath(); ctx.ellipse(0, s * 0.05, s * 0.62, s * 0.45, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(s * 0.78, -s * 0.18, s * 0.2, 0, Math.PI * 2); ctx.stroke();
    for (const [fx, fy] of [[-s * 0.5, -s * 0.42], [s * 0.42, -s * 0.46], [-s * 0.52, s * 0.5], [s * 0.46, s * 0.52]]) {
      ctx.beginPath(); ctx.ellipse(fx, fy, s * 0.2, s * 0.12, fx > 0 ? 0.6 : -0.6, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.beginPath(); ctx.moveTo(-s * 0.3, s * 0.05); ctx.lineTo(s * 0.3, s * 0.05); ctx.stroke();
  } else if (kind === 'bottle') {
    rr(ctx, -s * 0.3, -s * 0.05, s * 0.6, s * 1.0, s * 0.24); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-s * 0.3, -s * 0.3); ctx.quadraticCurveTo(0, -s * 0.55, s * 0.05, -s * 0.72); ctx.lineTo(s * 0.12, -s * 0.95); ctx.stroke();
    ctx.beginPath(); ctx.arc(s * 0.14, -s * 0.9, s * 0.13, 0, Math.PI * 2); ctx.fill();
  } else if (kind === 'spices') {
    ctx.beginPath(); ctx.moveTo(-s * 0.55, s * 0.85); ctx.quadraticCurveTo(-s * 0.6, -s * 0.3, 0, -s * 0.85); ctx.quadraticCurveTo(s * 0.6, -s * 0.3, s * 0.55, s * 0.85); ctx.closePath(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-s * 0.55, s * 0.3); ctx.lineTo(s * 0.55, s * 0.3); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, -s * 0.05, s * 0.13, 0, Math.PI * 2); ctx.fill();
  } else if (kind === 'fish') {
    ctx.beginPath();
    ctx.moveTo(-s * 0.85, 0); ctx.quadraticCurveTo(-s * 0.2, -s * 0.62, s * 0.45, -s * 0.1);
    ctx.lineTo(s * 0.85, -s * 0.5); ctx.lineTo(s * 0.72, 0); ctx.lineTo(s * 0.85, s * 0.5);
    ctx.lineTo(s * 0.45, s * 0.1); ctx.quadraticCurveTo(-s * 0.2, s * 0.62, -s * 0.85, 0); ctx.stroke();
    ctx.beginPath(); ctx.arc(-s * 0.5, -s * 0.08, s * 0.09, 0, Math.PI * 2); ctx.fill();
  } else if (kind === 'flowers') {
    ctx.beginPath(); ctx.moveTo(0, s * 0.95); ctx.lineTo(-s * 0.1, -s * 0.1); ctx.moveTo(0, s * 0.95); ctx.lineTo(s * 0.35, -s * 0.2); ctx.moveTo(0, s * 0.95); ctx.lineTo(-s * 0.42, -s * 0.28); ctx.stroke();
    for (const [fx, fy, r] of [[-s * 0.14, -s * 0.32, s * 0.3], [s * 0.4, -s * 0.44, s * 0.26], [-s * 0.5, -s * 0.52, s * 0.24]]) {
      for (let p = 0; p < 5; p += 1) {
        const a = (p / 5) * Math.PI * 2;
        ctx.beginPath(); ctx.ellipse(fx + Math.cos(a) * r * 0.62, fy + Math.sin(a) * r * 0.62, r * 0.42, r * 0.24, a, 0, Math.PI * 2); ctx.stroke();
      }
    }
  } else if (kind === 'mail') {
    rr(ctx, -s * 0.85, -s * 0.55, s * 1.7, s * 1.1, s * 0.1); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-s * 0.85, -s * 0.45); ctx.lineTo(0, s * 0.28); ctx.lineTo(s * 0.85, -s * 0.45); ctx.stroke();
  } else { // engine part: a gear
    ctx.beginPath(); ctx.arc(0, 0, s * 0.42, 0, Math.PI * 2); ctx.stroke();
    for (let i = 0; i < 8; i += 1) {
      const a = (i / 8) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * s * 0.42, Math.sin(a) * s * 0.42);
      ctx.lineTo(Math.cos(a) * s * 0.72, Math.sin(a) * s * 0.72);
      ctx.stroke();
    }
    ctx.beginPath(); ctx.arc(0, 0, s * 0.16, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

/** Upgrade icons: engine propeller, fuel drop, hull shield. */
export function drawUpgradeIcon(ctx, kind, x, y, size, color = PALETTE.gold) {
  const s = size / 2;
  ctx.save();
  ctx.translate(x, y);
  pen(ctx, size, color);
  ctx.fillStyle = color;
  if (kind === 'engine') {
    for (let i = 0; i < 3; i += 1) {
      const a = (i / 3) * Math.PI * 2 - Math.PI / 2;
      ctx.beginPath();
      ctx.ellipse(Math.cos(a) * s * 0.48, Math.sin(a) * s * 0.48, s * 0.42, s * 0.2, a, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.beginPath(); ctx.arc(0, 0, s * 0.2, 0, Math.PI * 2); ctx.fill();
  } else if (kind === 'tank') {
    ctx.beginPath();
    ctx.moveTo(0, -s * 0.9);
    ctx.quadraticCurveTo(s * 0.72, s * 0.05, s * 0.55, s * 0.45);
    ctx.quadraticCurveTo(s * 0.35, s * 0.9, 0, s * 0.9);
    ctx.quadraticCurveTo(-s * 0.35, s * 0.9, -s * 0.55, s * 0.45);
    ctx.quadraticCurveTo(-s * 0.72, s * 0.05, 0, -s * 0.9);
    ctx.stroke();
    ctx.beginPath(); ctx.arc(-s * 0.16, s * 0.34, s * 0.13, 0, Math.PI * 2); ctx.fill();
  } else {
    ctx.beginPath();
    ctx.moveTo(0, -s * 0.9);
    ctx.quadraticCurveTo(s * 0.75, -s * 0.62, s * 0.7, -s * 0.05);
    ctx.quadraticCurveTo(s * 0.66, s * 0.6, 0, s * 0.95);
    ctx.quadraticCurveTo(-s * 0.66, s * 0.6, -s * 0.7, -s * 0.05);
    ctx.quadraticCurveTo(-s * 0.75, -s * 0.62, 0, -s * 0.9);
    ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-s * 0.32, 0); ctx.lineTo(-s * 0.08, s * 0.26); ctx.lineTo(s * 0.38, -s * 0.3); ctx.stroke();
  }
  ctx.restore();
}

/** Challenge icons: ring, stamp, star, flame, coin, sun. */
export function drawChallengeIcon(ctx, kind, x, y, size, color = PALETTE.cream) {
  const s = size / 2;
  ctx.save();
  ctx.translate(x, y);
  pen(ctx, size, color);
  ctx.fillStyle = color;
  if (kind === 'ring') {
    ctx.beginPath(); ctx.arc(0, 0, s * 0.68, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, s * 0.42, 0, Math.PI * 2); ctx.stroke();
  } else if (kind === 'stamp') {
    ctx.beginPath(); ctx.arc(0, 0, s * 0.72, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, s * 0.5, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-s * 0.28, s * 0.05); ctx.lineTo(0, -s * 0.28); ctx.lineTo(s * 0.28, s * 0.05); ctx.lineTo(0, s * 0.3); ctx.closePath(); ctx.stroke();
  } else if (kind === 'star') {
    ctx.beginPath();
    for (let i = 0; i < 10; i += 1) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const r = i % 2 === 0 ? s * 0.85 : s * 0.38;
      const px = Math.cos(a) * r;
      const py = Math.sin(a) * r;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath(); ctx.stroke();
  } else if (kind === 'flame') {
    ctx.beginPath();
    ctx.moveTo(0, -s * 0.9);
    ctx.quadraticCurveTo(s * 0.62, -s * 0.25, s * 0.52, s * 0.3);
    ctx.quadraticCurveTo(s * 0.44, s * 0.88, 0, s * 0.88);
    ctx.quadraticCurveTo(-s * 0.44, s * 0.88, -s * 0.52, s * 0.3);
    ctx.quadraticCurveTo(-s * 0.55, -s * 0.2, -s * 0.18, -s * 0.42);
    ctx.quadraticCurveTo(-s * 0.05, -s * 0.62, 0, -s * 0.9);
    ctx.stroke();
  } else if (kind === 'coin') {
    ctx.beginPath(); ctx.arc(0, 0, s * 0.7, 0, Math.PI * 2); ctx.stroke();
    ctx.font = `900 ${size * 0.72}px Verdana, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('$', 0, s * 0.04);
  } else { // sun
    ctx.beginPath(); ctx.arc(0, 0, s * 0.4, 0, Math.PI * 2); ctx.stroke();
    for (let i = 0; i < 8; i += 1) {
      const a = (i / 8) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * s * 0.58, Math.sin(a) * s * 0.58);
      ctx.lineTo(Math.cos(a) * s * 0.88, Math.sin(a) * s * 0.88);
      ctx.stroke();
    }
  }
  ctx.restore();
}

/** Controller glyphs for the CONTROLS cards and the HUD scheme chip. */
export function drawControlIcon(ctx, kind, x, y, size, color = PALETTE.cream) {
  const s = size / 2;
  ctx.save();
  ctx.translate(x, y);
  pen(ctx, size, color);
  ctx.fillStyle = color;
  if (kind === 'keyboard') {
    rr(ctx, -s * 0.92, -s * 0.58, s * 1.84, s * 1.16, s * 0.16); ctx.stroke();
    for (let r = 0; r < 2; r += 1) {
      for (let c = 0; c < 4; c += 1) {
        ctx.fillRect(-s * 0.68 + c * s * 0.36, -s * 0.34 + r * s * 0.42, s * 0.2, s * 0.16);
      }
    }
    ctx.fillRect(-s * 0.42, s * 0.28, s * 0.84, s * 0.16);
  } else if (kind === 'joystick') {
    ctx.beginPath(); ctx.ellipse(0, s * 0.62, s * 0.78, s * 0.3, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, s * 0.55); ctx.lineTo(-s * 0.28, -s * 0.28); ctx.stroke();
    ctx.beginPath(); ctx.arc(-s * 0.34, -s * 0.42, s * 0.3, 0, Math.PI * 2); ctx.fill();
  } else if (kind === 'touch') {
    // A fingertip pressing, with two ripple rings above it.
    ctx.beginPath(); ctx.arc(0, -s * 0.42, s * 0.2, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(0, -s * 0.42, s * 0.44, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, -s * 0.42, s * 0.68, Math.PI * 1.2, Math.PI * 1.8); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-s * 0.2, s * 0.9);
    ctx.lineTo(-s * 0.2, -s * 0.1);
    ctx.quadraticCurveTo(-s * 0.2, -s * 0.34, 0, -s * 0.34);
    ctx.quadraticCurveTo(s * 0.2, -s * 0.34, s * 0.2, -s * 0.05);
    ctx.lineTo(s * 0.2, s * 0.9);
    ctx.stroke();
  } else { // gyro: a tilted phone with rotation arrows
    ctx.save();
    ctx.rotate(-0.42);
    rr(ctx, -s * 0.52, -s * 0.78, s * 1.04, s * 1.56, s * 0.18); ctx.stroke();
    ctx.fillRect(-s * 0.16, s * 0.52, s * 0.32, s * 0.12);
    ctx.restore();
    ctx.beginPath(); ctx.arc(0, 0, s * 0.98, -0.5, 0.7); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(s * 0.86, s * 0.5); ctx.lineTo(s * 0.99, s * 0.72); ctx.lineTo(s * 0.68, s * 0.74); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.arc(0, 0, s * 0.98, Math.PI - 0.7, Math.PI + 0.5); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-s * 0.86, -s * 0.5); ctx.lineTo(-s * 0.99, -s * 0.72); ctx.lineTo(-s * 0.68, -s * 0.74); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}

/** A padlock for islands the route has not reached yet. */
export function drawLock(ctx, x, y, size, color = PALETTE.muted) {
  const s = size / 2;
  ctx.save();
  ctx.translate(x, y);
  pen(ctx, size, color);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(0, -s * 0.22, s * 0.42, Math.PI, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-s * 0.42, -s * 0.22); ctx.lineTo(-s * 0.42, s * 0.05); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(s * 0.42, -s * 0.22); ctx.lineTo(s * 0.42, s * 0.05); ctx.stroke();
  rr(ctx, -s * 0.58, -s * 0.08, s * 1.16, s * 0.92, s * 0.14);
  ctx.fill();
  ctx.fillStyle = PALETTE.ink;
  ctx.beginPath(); ctx.arc(0, s * 0.3, s * 0.13, 0, Math.PI * 2); ctx.fill();
  ctx.fillRect(-s * 0.045, s * 0.3, s * 0.09, s * 0.3);
  ctx.restore();
}

/**
 * A circular postmark stamp: wavy outer ring, island name, TERKIRIM and the
 * grade. Drawn rotated like a real ink stamp on the receipt.
 */
export function drawStamp(ctx, x, y, r, islandName, grade, rotation) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  ctx.strokeStyle = PALETTE.coralDeep;
  ctx.fillStyle = PALETTE.coralDeep;
  ctx.globalAlpha = 0.88;
  ctx.lineWidth = 3;
  ctx.beginPath();
  for (let a = 0; a <= Math.PI * 2 + 0.01; a += 0.12) {
    const rad = r + Math.sin(a * 9) * r * 0.045;
    const px = Math.cos(a) * rad;
    const py = Math.sin(a) * rad;
    if (a === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.stroke();
  ctx.beginPath(); ctx.arc(0, 0, r * 0.8, 0, Math.PI * 2); ctx.lineWidth = 2; ctx.stroke();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `900 ${r * 0.34}px Verdana, sans-serif`;
  ctx.fillText(grade, 0, -r * 0.3);
  ctx.font = `700 ${r * 0.19}px Verdana, sans-serif`;
  const name = islandName.length > 12 ? islandName.split(' ').pop() : islandName;
  ctx.fillText(name, 0, r * 0.08);
  ctx.font = `700 ${r * 0.21}px Verdana, sans-serif`;
  ctx.fillText('TERKIRIM', 0, r * 0.38);
  ctx.restore();
  ctx.globalAlpha = 1;
}
