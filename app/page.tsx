'use client'
import dynamic from 'next/dynamic'
import { useState } from 'react'
import { useRouletteState } from '@/lib/useRouletteState'
import NumberPad  from '@/components/NumberPad'
import ControlBar from '@/components/ControlBar'

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
      <div className="relative w-full bg-[#0A0A0A] rounded-t-3xl p-6 border-t border-[#1E1E1E]">
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm font-black tracking-widest text-white">BANKROLL</span>
          <button onClick={onClose} className="text-[#555] text-xl leading-none">✕</button>
        </div>
        <input
          type="number"
          value={val}
          onChange={e => setVal(e.target.value)}
          inputMode="decimal"
          className="w-full bg-[#111] border border-[#1E1E1E] rounded-xl p-3 text-xl font-black
                     text-[#FFD700] text-center mb-4 outline-none"
        />
        <div className="grid grid-cols-5 gap-2 mb-4">
          {[50, 100, 200, 500, 1000].map(p => (
            <button key={p} onClick={() => setVal(p.toString())}
              className="bg-[#111] border border-[#1E1E1E] rounded-lg py-2 text-xs font-black
                         text-white active:bg-[#222]">
              {p}€
            </button>
          ))}
        </div>
        <button
          onClick={() => { const v = parseFloat(val); if (v > 0) onApply(v) }}
          className="w-full rounded-2xl py-4 font-black tracking-wider border
                     bg-[#FFD700]/10 text-[#FFD700] border-[#FFD700]/40 active:scale-95 transition-transform">
          ✓ CONFIRMER
        </button>
      </div>
    </div>
  )
}

// ── Victory Overlay ────────────────────────────────────────────
function VictoryOverlay({
  bankroll, initialDeposit, wins, losses, onAcknowledge,
}: { bankroll: number; initialDeposit: number; wins: number; losses: number; onAcknowledge: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90">
      <div className="flex flex-col items-center gap-4 p-8 text-center max-w-xs">
        <div className="text-6xl">💰</div>
        <h1 className="text-4xl font-black tracking-[6px] text-[#FFD700]">VICTOIRE</h1>
        <div className="bg-[#111] border border-[#FFD700]/30 rounded-2xl p-4 w-full text-sm space-y-2">
          {[
            ['Dépôt', fmt(initialDeposit)],
            ['Bankroll', fmt(bankroll)],
            ['Profit', '+' + fmt(bankroll - initialDeposit)],
            ['V/D', losses > 0 ? (wins/losses).toFixed(2) : '∞'],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between">
              <span className="text-[#555]">{k}</span>
              <span className="font-black text-white">{v}</span>
            </div>
          ))}
        </div>
        <button onClick={onAcknowledge}
          className="w-full rounded-2xl py-4 font-black border bg-[#FFD700]/10 text-[#FFD700]
                     border-[#FFD700]/40 active:scale-95 transition-transform">
          ✓ ENCAISSER
        </button>
      </div>
    </div>
  )
}

// ── Compact Status Bar ─────────────────────────────────────────
function StatusBar({
  state, result, bufferSize, onOpenSettings,
}: {
  state: { bankroll: number; initialDeposit: number; wins: number; losses: number };
  result: import('@/lib/types').EngineResult | null;
  bufferSize: number;
  onOpenSettings: () => void;
}) {
  const status = result?.status ?? 'WAIT'
  const conf   = result?.confidence ?? 0
  const profit = state.bankroll - state.initialDeposit

  const pillStyle: Record<string, string> = {
    WAIT:   'bg-[#111] text-[#555] border-[#1E1E1E]',
    PLAY:   'bg-[#00E676]/10 text-[#00E676] border-[#00E676]/40',
    KILLER: 'bg-[#FFD700]/10 text-[#FFD700] border-[#FFD700]/40',
    NOISE:  'bg-[#FF1744]/10 text-[#FF1744] border-[#FF1744]/40',
  }
  const confColor: Record<string, string> = {
    WAIT: '#555', PLAY: '#00E676', KILLER: '#FFD700', NOISE: '#FF1744',
  }

  return (
    <div className="border-t border-[#1E1E1E] px-3 py-2 flex flex-col gap-1.5">
      {/* Row 1: bankroll | signal | confidence | settings */}
      <div className="flex items-center gap-2">
        <button onClick={onOpenSettings} className="flex flex-col active:opacity-70">
          <span className="text-[8px] text-[#555] tracking-widest font-black">BANKROLL</span>
          <span className="text-lg font-black text-[#FFD700] leading-tight tabular-nums">
            {fmt(state.bankroll)}
          </span>
        </button>

        <span className={`px-2.5 py-0.5 rounded-full border text-[10px] font-black tracking-widest ${pillStyle[status]}`}>
          {status === 'KILLER' ? '⚡ KILLER' : status}
        </span>

        <span className="text-sm font-black tabular-nums" style={{ color: confColor[status] }}>
          {conf > 0 ? `${conf}%` : '—'}
        </span>

        <span className="flex-1" />

        <span className="text-[9px] text-[#555] tabular-nums">
          {state.wins}V/{state.losses}D · buf {bufferSize}/36
        </span>

        <span className={`text-xs font-black tabular-nums ${profit >= 0 ? 'text-[#00E676]' : 'text-[#FF1744]'}`}>
          {profit >= 0 ? '+' : ''}{fmt(profit)}
        </span>
      </div>

      {/* Row 2: bet instructions when active */}
      {result && (status === 'PLAY' || status === 'KILLER') && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[9px] text-[#555]">MISE</span>
          <span className="text-sm font-black" style={{ color: confColor[status] }}>
            {fmt(result.recommendation.bet_value)}
          </span>
          <span className="text-[9px] text-[#555]">→</span>
          <span className="text-xs font-black text-white">{result.recommendation.target}</span>
          {result.recommendation.splits.slice(0, 4).map(s => (
            <span key={s}
              className="text-[9px] font-black px-1.5 py-0.5 rounded border border-[#1E1E1E] bg-[#111] text-[#FFD700]">
              {s}
            </span>
          ))}
        </div>
      )}
      {result && status === 'NOISE' && (
        <div className="text-[10px] text-[#FF1744] font-black tracking-wider">
          🚫 BRUIT — NE PAS JOUER
        </div>
      )}
      {(!result || status === 'WAIT') && (
        <div className="text-[10px] text-[#555] tracking-widest">
          ATTENTE DU SIGNAL…
        </div>
      )}
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
        <div className="text-[#555] text-xs tracking-widest animate-pulse">
          INIT…
        </div>
      </div>
    )
  }

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
        <SettingsModal current={state.bankroll} onApply={applyBankroll} onClose={() => setShowSettings(false)} />
      )}

      <main
        className="h-screen flex flex-col bg-black"
        style={{
          paddingTop:    'var(--sat)',
          paddingBottom: 'var(--sab)',
          paddingLeft:   'var(--sal)',
          paddingRight:  'var(--sar)',
        }}
      >
        {/* ── ZONE 1: Heatmap radar ── */}
        <div
          className="flex-shrink-0 flex items-center justify-center bg-black"
          style={{ height: '38dvh' }}
        >
          <div style={{ height: '100%', aspectRatio: '1/1' }}>
            <SectorHeatmap
              heat={heat}
              engineResult={result}
              lastNumber={state.spins[state.spins.length - 1]?.number ?? null}
            />
          </div>
        </div>

        {/* ── ZONE 2: Compact status ── */}
        <StatusBar
          state={state}
          result={result}
          bufferSize={bufferSize}
          onOpenSettings={() => setShowSettings(true)}
        />

        {/* ── ZONE 3: Number pad (fills remaining space) ── */}
        <div className="flex-1 min-h-0 px-2 pt-1 pb-1 flex flex-col gap-1">
          <NumberPad
            onSpin={addSpin}
            recentSpins={state.spins}
            disabled={false}
          />
          <ControlBar
            onUndo={undoSpin}
            onReset={resetCycle}
            canUndo={state.spins.length > 0}
            latency={result?.latency}
          />
        </div>
      </main>
    </>
  )
}
