'use client'
interface Props {
  onUndo:   () => void
  onReset:  () => void
  canUndo:  boolean
  latency?: number
}

export default function ControlBar({ onUndo, onReset, canUndo, latency }: Props) {
  return (
    <div className="flex flex-col gap-1.5">
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
