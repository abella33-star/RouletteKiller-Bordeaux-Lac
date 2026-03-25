'use client'
interface Props {
  onUndo:       () => void
  onReset:      () => void
  onExport:     () => void
  onShowStats:  () => void
  canUndo:      boolean
  latency?:     number
}

export default function ControlBar({ onUndo, onReset, onExport, onShowStats, canUndo, latency }: Props) {
  return (
    <div className="flex flex-col gap-2">
      {/* Row 1 : actions principales */}
      <div className="grid grid-cols-2 gap-2">
        <button
          className={`btn-giant btn-undo ${!canUndo ? 'opacity-40 cursor-not-allowed' : ''}`}
          onClick={canUndo ? onUndo : undefined}
          disabled={!canUndo}
          aria-label="Annuler le dernier spin"
        >
          <span className="text-xl">↩</span>
          <span>UNDO</span>
        </button>

        <button
          className="btn-giant btn-reset"
          onClick={onReset}
          aria-label="Réinitialiser le cycle"
        >
          <span className="text-xl">↺</span>
          <span>RESET CYCLE</span>
        </button>
      </div>

      {/* Row 2 : outils */}
      <div className="grid grid-cols-2 gap-2">
        <button
          className="btn-giant"
          style={{ background: '#0d1f0d', border: '1px solid #1a4a1a', color: '#4caf50' }}
          onClick={onExport}
          aria-label="Exporter les données"
        >
          <span className="text-lg">📤</span>
          <span style={{ fontSize: 10 }}>EXPORT JSON</span>
        </button>

        <button
          className="btn-giant"
          style={{ background: '#0d0d1f', border: '1px solid #1a1a4a', color: '#7986cb' }}
          onClick={onShowStats}
          aria-label="Voir les statistiques"
        >
          <span className="text-lg">📊</span>
          <span style={{ fontSize: 10 }}>STATS</span>
        </button>
      </div>

      {/* Latency badge */}
      {latency !== undefined && (
        <div className="flex justify-center">
          <span className={`text-[9px] font-mono px-2 py-0.5 rounded-md bg-card border border-border ${
            latency < 20 ? 'text-neon' : latency < 50 ? 'text-orange' : 'text-crimson'
          }`}>
            ⚡ {latency}ms
          </span>
        </div>
      )}
    </div>
  )
}
