import type { Vec2 } from '../domain/contracts.ts';
export const A = 34, B = 18;
export function project(p: Vec2, height = 0): { x: number; y: number } { return { x: (p.x - p.z) * A, y: (p.x + p.z) * B - height }; }
export function unproject(x: number, y: number): Vec2 { return { x: (x / A + y / B) / 2, z: (y / B - x / A) / 2 }; }
export function screenDirection(x: number, y: number): Vec2 { const p = unproject(x, y); const len = Math.hypot(p.x, p.z); return len > 0 ? { x: p.x / len, z: p.z / len } : { x: 0, z: 0 }; }
