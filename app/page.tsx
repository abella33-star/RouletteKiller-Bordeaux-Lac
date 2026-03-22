'use client'
import dynamic from 'next/dynamic'
import { useState } from 'react'
import { useRouletteState } from '@/lib/useRouletteState'
import BankrollHeader from '@/components/BankrollHeader'
import SignalCard     from '@/components/SignalCard'
import BetCard        from '@/components/BetCard'
import NumberPad      from '@/components/NumberPad'
import ControlBar     from '@/components/ControlBar'

// Heatmap loaded client-side only (SVG, no SSR)
const SectorHeatmap = dynamic(() => import('@/components/SectorHeatmap'), { ssr: false })

function fmt(n: number) {
  return n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '€'
}

// ── Settings Modal ─────────────────────────────────────────────
function SettingsModal({
  current, onApply, onClose,
}: { current: number; onApply: (v: number) => void; onClose: () => void }) {
  const [val, setVal] = useState(current.toString())
  return (
    <div className="fixed inset-0 z-50 flex items-end" style={{ paddingBottom: 'var(--sab)' }}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full bg-surface rounded-t-3xl p-6 border-t border-border">
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm font-black tracking-widest">BANKROLL</span>
          <button onClick={onClose} className="text-muted text-xl leading-none">✕</button>
        </div>
        <input
          type="number"
          value={val}
          onChange={e => setVal(e.target.value)}
          inputMode="decimal"
          className="w-full bg-card border border-border rounded-xl p-3 text-xl font-black
                     text-gold text-center mb-4 outline-none focus:border-gold/50"
        />
        <div className="grid grid-cols-5 gap-2 mb-4">
          {[50, 100, 200, 500, 1000].map(p => (
            <button key={p} onClick={() => setVal(p.toString())}
              className="bg-card border border-border rounded-lg py-2 text-xs font-black active:bg-border">
              {p}€
            </button>
          ))}
        </div>
        <button
          onClick={() => { const v = parseFloat(val); if (v > 0) onApply(v) }}
          className="w-full rounded-2xl py-4 font-black tracking-wider border
                     bg-gold/10 text-gold border-gold/40 active:scale-95 transition-transform">
          ✓ CONFIRMER
        </button>
      </div>
    </div>
  )
}

// ── Victory Overlay ────────────────────────────────────────────
function VictoryOverlay({
  bankroll, initialDeposit, wins, losses, onAcknowledge,
}: {
  bankroll: number; initialDeposit: number;
  wins: number; losses: number;
  onAcknowledge: () => void;
}) {
  const mult = initialDeposit > 0 ? (bankroll / initialDeposit).toFixed(2) : '—'
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90">
      <div className="flex flex-col items-center gap-4 p-8 text-center max-w-xs">
        <div className="text-6xl glow-gold">💰</div>
        <h1 className="text-4xl font-black tracking-[6px] text-gold">VICTOIRE</h1>
        <div className="bg-card border border-gold/30 rounded-2xl p-4 w-full text-sm space-y-2">
          {[
            ['Dépôt initial', fmt(initialDeposit)],
            ['Bankroll',      fmt(bankroll)],
            ['Profit',        '+' + fmt(bankroll - initialDeposit)],
            ['Multiplicateur','×' + mult],
            ['Ratio V/D',     losses > 0 ? (wins/losses).toFixed(2) : '∞'],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between">
              <span className="text-muted">{k}</span>
              <span className="font-black">{v}</span>
            </div>
          ))}
        </div>
        <button onClick={onAcknowledge}
          className="w-full rounded-2xl py-4 font-black border
                     bg-gold/10 text-gold border-gold/40 active:scale-95 transition-transform">
          ✓ ENCAISSER
        </button>
      </div>
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────
export default function Home() {
  const {
    state, heat, bufferSize, loaded,
    showVictory, setShowVictory,
    showSettings, setShowSettings,
    addSpin, undoSpin, resetCycle, applyBankroll,
  } = useRouletteState()

  if (!loaded) {
    return (
      <div className="h-screen flex items-center justify-center bg-black">
        <div className="text-muted text-xs tracking-widest animate-pulse">INIT…</div>
      </div>
    )
  }

  const profit = state.bankroll - state.initialDeposit
  const result = state.lastEngineResult

  return (
    <>
      {showVictory && (
        <VictoryOverlay
          bankroll={state.bankroll} initialDeposit={state.initialDeposit}
          wins={state.wins} losses={state.losses}
          onAcknowledge={() => setShowVictory(false)}
        />
      )}
      {showSettings && (
        <SettingsModal
          current={state.bankroll}
          onApply={applyBankroll}
          onClose={() => setShowSettings(false)}
        />
      )}

      {/*
        Layout — 3 zones fixes :
          ZONE 1 (haut, fixe)     : Radar heatmap
          ZONE 2 (milieu, scroll) : Bankroll + Signal table + Smart Splits
          ZONE 3 (bas, fixe)      : Grille 0-36 one-tap + contrôles
      */}
      <main
        className="h-screen flex flex-col bg-black overflow-hidden"
        style={{
          paddingTop:    'var(--sat)',
          paddingBottom: 'var(--sab)',
          paddingLeft:   'var(--sal)',
          paddingRight:  'var(--sar)',
        }}
      >

        {/* ══ ZONE 1 : RADAR HEATMAP (haut, 32dvh) ══ */}
        <div
          className="flex-shrink-0 flex items-center justify-center bg-black"
          style={{ height: '32dvh' }}
        >
          <div style={{ height: '100%', aspectRatio: '1 / 1' }}>
            <SectorHeatmap
              heat={heat}
              engineResult={result}
              lastNumber={state.spins[state.spins.length - 1]?.number ?? null}
            />
          </div>
        </div>

        {/* ══ ZONE 2 : SIGNAL TABLE + SMART SPLITS (milieu, scrollable) ══ */}
        <div className="flex-1 min-h-0 overflow-y-auto scroll-zone px-3 py-1.5 flex flex-col gap-2">

          {/* Bankroll header (tap pour changer la bankroll) */}
          <BankrollHeader
            bankroll={state.bankroll}
            initialDeposit={state.initialDeposit}
            wins={state.wins}
            losses={state.losses}
            onOpenSettings={() => setShowSettings(true)}
          />

          {/* Tableau des signaux (WAIT / PLAY / KILLER) + χ² + offset */}
          <SignalCard result={result} bufferSize={bufferSize} />

          {/* Smart Splits — répartition des jetons sur la bankroll */}
          <BetCard result={result} bankroll={state.bankroll} profit={profit} />

        </div>

        {/* ══ ZONE 3 : GRILLE 0-36 ONE-TAP + CONTRÔLES (bas, fixe) ══ */}
        <div
          className="flex-shrink-0 border-t border-border"
          style={{ padding: '6px 8px 8px' }}
        >
          <NumberPad
            onSpin={addSpin}
            recentSpins={state.spins}
            disabled={false}
          />
          <div style={{ marginTop: 6 }}>
            <ControlBar
              onUndo={undoSpin}
              onReset={resetCycle}
              canUndo={state.spins.length > 0}
              latency={result?.latency}
            />
          </div>
        </div>

      </main>
    </>
  )
}
