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

export interface EngineResult {
  status:         SignalStatus
  confidence:     number
  recommendation: SmartSplitRecommendation
  reason:         string
  potential_gain: number
  phase:          Phase
  sectors:        Record<SectorKey, SectorData> | null
  colorTest:      ChiSquareResult | null
  parityTest:     ChiSquareResult | null
  offsetAnalysis: OffsetAnalysis | null
  latency:        number
}

// ── App State ────────────────────────────────────────────────
export interface AppState {
  spins:            Spin[]
  bankroll:         number
  initialDeposit:   number
  startBankroll:    number
  wins:             number
  losses:           number
  totalSpins:       number
  consecutiveLoss:  number
  victoryShown:     boolean
  lastEngineResult: EngineResult | null
}

// ── IndexedDB ────────────────────────────────────────────────
export interface DBSession {
  id:           string
  startedAt:    number
  initialDeposit: number
  startBankroll: number
}
