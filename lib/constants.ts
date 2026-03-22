import type { SectorKey, Color } from './types'

// ── Cylinder (physical Alfastreet wheel order) ───────────────
export const WHEEL_ORDER: number[] = [
  0,32,15,19,4,21,2,25,17,34,6,27,13,36,11,30,8,23,10,5,24,16,33,1,20,14,31,9,22,18,29,7,28,12,35,3,26
]

export const WHEEL_POS: Record<number, number> = {}
WHEEL_ORDER.forEach((n, i) => { WHEEL_POS[n] = i })

// ── Sectors ──────────────────────────────────────────────────
export const CYLINDER: Record<SectorKey, number[]> = {
  voisins:   [22,18,29,7,28,12,35,3,26,0,32,15,19,4,21,2,25],   // 17
  tiers:     [27,13,36,11,30,8,23,10,5,24,16,33],                 // 12
  orphelins: [1,20,14,31,9,17,34,6],                              //  8
}

export const SECTOR_LABELS: Record<SectorKey, string> = {
  voisins:   'Voisins du Zéro',
  tiers:     'Tiers du Cylindre',
  orphelins: 'Orphelins',
}

export const SECTOR_COLORS: Record<SectorKey, string> = {
  voisins:   '#C8A951',
  tiers:     '#4E88FF',
  orphelins: '#FF6B35',
}

// ── Smart Splits ─────────────────────────────────────────────
// Voisins: 9 jetons standard — 0/2/3 (×2), 4/7, 12/15, 18/21, 19/22,
//          25/26/28/29 carré (×2), 32/35
// Tiers: 6 jetons — 5/8, 10/11, 13/16, 23/24, 27/30, 33/36
// Orphelins: 5 jetons — 1-plein, 6/9, 14/17, 17/20, 31/34
export const SMART_SPLITS: Record<SectorKey, { splits: [number,number][]; pleins: number[] }> = {
  voisins:   { splits: [[0,3],[0,2],[4,7],[12,15],[18,21],[19,22],[25,28],[26,29],[32,35]], pleins: [] },
  tiers:     { splits: [[5,8],[10,11],[13,16],[23,24],[27,30],[33,36]], pleins: [] },
  orphelins: { splits: [[6,9],[14,17],[17,20],[31,34]],      pleins: [1] },
}

// ── Colour maps ──────────────────────────────────────────────
export const RED_NUMBERS: Set<number> = new Set([
  1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36
])
export const EVEN_NUMBERS: Set<number> = new Set([
  2,4,6,8,10,12,14,16,18,20,22,24,26,28,30,32,34,36
])

export function getColor(n: number): Color {
  if (n === 0) return 'vert'
  return RED_NUMBERS.has(n) ? 'rouge' : 'noir'
}

export function getZone(n: number): SectorKey | null {
  for (const [key, nums] of Object.entries(CYLINDER) as [SectorKey, number[]][]) {
    if (nums.includes(n)) return key
  }
  return null
}

// ── Signal thresholds ────────────────────────────────────────
export const SIGNAL_THRESHOLDS = {
  KILLER: 90,   // ≥90% → KILLER mode
  PLAY:   70,   // ≥70% → PLAY
  NOISE_GATE: 75, // below this with double noise → NOISE
} as const

// ── Bet rules ────────────────────────────────────────────────
export const BET_RULES = {
  PRUDENT_PCT:   0.01,   // 1% bankroll (score 70-89%)
  PRUDENT_MAX:   0.02,   // 2% bankroll (score 85-89%)
  SNIPER_PROFIT: 0.50,   // 50% of profit (KILLER mode, profit > 50€)
  KILLER_MIN_PROFIT: 50, // minimum profit to unlock Sniper
} as const

// ── Take-Profit ──────────────────────────────────────────────
export const TAKE_PROFIT_MULTIPLIER = 4  // 4× initialDeposit → VICTOIRE
