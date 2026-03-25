// ============================================================
//  ROULETTE KILLER — TypeScript Definitions
// ============================================================

export type SignalStatus = 'WAIT' | 'PLAY' | 'KILLER' | 'NOISE'
export type Phase        = 'Prudent' | 'Sniper' | '—'
export type SectorKey    = 'voisins' | 'tiers' | 'orphelins'
export type Color        = 'rouge' | 'noir' | 'vert'

// ── Spin ────────────────────────────────────────────────────
export interface Spin {
  id:              string          // uuid
  number:          number          // 0-36
  color:           Color
  zone:            SectorKey | null
  timestamp:       number          // ms epoch
  starting_point?: number          // previous spin number (auto-derived)
}

// ── Engine output ────────────────────────────────────────────
export interface SectorData {
  Z:          number   // Z-Score
  posterior:  number   // Bayesian posterior probability
  confidence: number   // composite score 0-100
  k:          number   // observed count in window
  E:          number   // expected count in window
}

export interface ChiSquareResult {
  chi2:    number
  pValue:  number
  isNoise: boolean
}

export interface OffsetAnalysis {
  detected: boolean
  boost:    number          // 0 or 30
  center:   number | null   // wheel position offset
  count:    number
  total:    number
  detail:   string | null
}

export interface SmartSplitRecommendation {
  target:       string
  type:         string
  splits:       string[]    // e.g. ['0/3', '12/15', '26-plein']
  bet_per_split: number
  bet_value:    number
  num_bets:     number
}

// ── Color Prediction ─────────────────────────────────────────
export interface ColorPrediction {
  rougeProb:    number                           // % estimé P(rouge) pour le prochain spin
  noirProb:     number                           // % estimé P(noir)
  signal:       'ROUGE' | 'NOIR' | 'NEUTRE'     // signal dominant
  confidence:   number                           // force du signal 0-100
  streakCount:  number                           // longueur série actuelle
  streakColor:  'rouge' | 'noir' | 'vert' | null
  ewmaRouge:    number                           // EWMA rouge pondéré en %
  zScore:       number                           // Z-score déviation rouge/baseline
  conditionalP: number | null                    // P(même couleur | couleur précédente) en %
}

export interface SubArcResult {
  numbers:       number[]   // numéros consécutifs du cylindre dans l'arc chaud
  arcZ:          number     // Z-score de cet arc
  arcConfidence: number     // normalCDF(arcZ) × 100
}

export interface EngineResult {
  status:               SignalStatus
  confidence:           number
  recommendation:       SmartSplitRecommendation
  reason:               string
  potential_gain:       number
  phase:                Phase
  sectors:              Record<SectorKey, SectorData> | null
  colorTest:            ChiSquareResult | null
  parityTest:           ChiSquareResult | null
  offsetAnalysis:       OffsetAnalysis | null
  latency:              number
  dualWindowConfirmed:  boolean             // les 2 fenêtres (8 et 24 spins) désignent le même secteur
  subArc:               SubArcResult | null // arc chaud détecté (null si WAIT/NOISE)
  colorPrediction:      ColorPrediction | null  // analyse couleur rouge/noir
}

// ── App State ────────────────────────────────────────────────
export interface AppState {
  spins:             Spin[]
  bankroll:          number
  initialDeposit:    number
  startBankroll:     number
  wins:              number
  losses:            number
  totalSpins:        number
  consecutiveLoss:   number
  victoryShown:      boolean
  lastEngineResult:  EngineResult | null
  sectorStreak:      number           // nb d'analyses consécutives sur le même secteur
  lastSignalSector:  SectorKey | null // secteur dominant de la dernière analyse
  bankrollHistory:   number[]         // bankroll après chaque spin (pour sparkline)
}

// ── Chance Zone (toutes catégories) ─────────────────────────
export interface ChanceZone {
  name:        string
  category:    'simple' | 'douzaine' | 'colonne'
  observed:    number
  expected:    number          // n × p (théorique)
  probability: number          // p théorique (0–1)
  zScore:      number          // écart en σ
  pValue:      number          // p-value bilatérale
  sigmaLevel:  number          // |Z| arrondi à 1 décimale
}

// ── Monte Carlo ───────────────────────────────────────────────
export interface MonteCarloResult {
  simulations:     number
  spinsPerSession: number
  betFraction:     number   // fraction de bankroll misée par spin
  ruinProbability: number   // % sessions finissant à 0
  medianFinal:     number   // médiane finale en % de la bankroll initiale
  meanFinal:       number   // moyenne finale en %
  p5:              number   // 5e percentile en %
  p95:             number   // 95e percentile en %
  histogram:       number[] // 20 buckets de 0% à 200%, normalisés 0-1
  theoreticalEV:   number   // EV théorique en % de bankroll initiale
}

// ── IndexedDB ────────────────────────────────────────────────
export interface DBSession {
  id:           string
  startedAt:    number
  initialDeposit: number
  startBankroll: number
}
