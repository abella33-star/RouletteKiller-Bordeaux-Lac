import Foundation

// MARK: - Moteur de Protection des Gains & Récupération
// Philosophie : on ne quitte JAMAIS le casino en perte — même +1€ = victoire
// Systèmes de progression : Oscar's Grind / Fibonacci / D'Alembert / Flat
final class WinProtectionEngine {

    // MARK: - Systèmes de progression de mise
    enum ProgressionSystem: String, CaseIterable, Codable {
        case flat        = "FLAT"           // Mise fixe — ultra-safe
        case dalembert   = "D'ALEMBERT"     // +1 après perte, -1 après gain
        case fibonacci   = "FIBONACCI"      // Séquence Fibonacci sur les pertes
        case oscarsGrind = "OSCAR'S GRIND"  // Ne monte que après gain, cycle à +1 unité

        var description: String {
            switch self {
            case .flat:        return "Mise constante — risque minimal"
            case .dalembert:   return "Très lent, très sûr — récupération douce"
            case .fibonacci:   return "Récupération accélérée — meilleur ratio risque/reward"
            case .oscarsGrind: return "Le meilleur : ne monte que si on gagne"
            }
        }

        var icon: String {
            switch self {
            case .flat:        return "minus.circle.fill"
            case .dalembert:   return "arrow.up.arrow.down.circle.fill"
            case .fibonacci:   return "function"
            case .oscarsGrind: return "crown.fill"
            }
        }

        var maxMultiplier: Double {
            switch self {
            case .flat:        return 1.0
            case .dalembert:   return 4.0
            case .fibonacci:   return 8.0
            case .oscarsGrind: return 3.0
            }
        }
    }

    // MARK: - État de progression pour Oscar's Grind
    struct OscarState: Codable {
        var unit: Double          // mise de base
        var currentBet: Double    // mise actuelle
        var cycleProfit: Double   // profit du cycle en cours
        var isComplete: Bool      // cycle terminé (+1 unité atteinte)

        init(unit: Double) {
            self.unit = unit
            self.currentBet = unit
            self.cycleProfit = 0
            self.isComplete = false
        }

        mutating func afterWin() {
            cycleProfit += currentBet
            if cycleProfit >= unit {
                // Cycle terminé — on a gagné +1 unité
                isComplete = true
                currentBet = unit
                cycleProfit = 0
            } else {
                // Augmenter la mise pour finir le cycle plus vite
                let needed = unit - cycleProfit
                currentBet = min(currentBet + unit, needed)
            }
        }

        mutating func afterLoss() {
            cycleProfit -= currentBet
            // Oscar's Grind : NE PAS augmenter la mise après perte
            // Garder la même mise ou baisser si la mise dépasse ce qu'il faut
            currentBet = unit  // Reset à l'unité de base
        }
    }

    // MARK: - Calcul de la mise selon le système
    static func nextStake(
        system: ProgressionSystem,
        baseUnit: Double,
        session: SessionStats,
        oscarState: OscarState? = nil
    ) -> Double {
        switch system {
        case .flat:
            return baseUnit

        case .dalembert:
            return dAlembertStake(base: baseUnit, session: session)

        case .fibonacci:
            return fibonacciStake(base: baseUnit, session: session)

        case .oscarsGrind:
            return oscarState?.currentBet ?? baseUnit
        }
    }

    // MARK: - D'Alembert : +1 unité après perte, -1 après gain
    private static func dAlembertStake(base: Double, session: SessionStats) -> Double {
        let level = session.consecutiveLosses
        let stake = base * Double(1 + level)
        return min(stake, base * 4.0)  // Plafond x4
    }

    // MARK: - Fibonacci : 1,1,2,3,5,8,13 unités
    private static let fibSequence = [1,1,2,3,5,8,13,21]

    private static func fibonacciStake(base: Double, session: SessionStats) -> Double {
        let level = min(session.consecutiveLosses, fibSequence.count - 1)
        return base * Double(fibSequence[level])
    }

    // MARK: - Meilleure stratégie recommandée selon l'état session
    static func recommendSystem(session: SessionStats, opportunityScore: Double) -> ProgressionSystem {
        // En récupération active → Fibonacci (plus rapide)
        if session.profitLoss < -session.startBankroll * 0.05 && opportunityScore >= 70 {
            return .fibonacci
        }
        // Session équilibrée + bon score → Oscar's Grind
        if session.consecutiveLosses == 0 && session.disciplineScore >= 70 {
            return .oscarsGrind
        }
        // Streak de pertes → D'Alembert (doux)
        if session.consecutiveLosses >= 2 {
            return .dalembert
        }
        return .flat
    }

    // MARK: - Calcul du nombre de mises pour récupérer les pertes
    static func recoveryMises(
        currentLoss: Double,
        baseUnit: Double,
        system: ProgressionSystem,
        numbers: Int
    ) -> Int {
        guard currentLoss > 0 else { return 0 }
        let winPayout = (36.0 / Double(numbers)) - 1
        var bankroll = -currentLoss
        var mise = baseUnit
        var spins = 0
        var consecutiveLosses = 0

        while bankroll < 0 && spins < 200 {
            // Simuler gain/perte (gain si on tombe sur un numéro : prob = numbers/37)
            // Pour simulation : on utilise la probabilité attendue
            let willWin = spins % Int(37.0 / Double(numbers)) == 0

            if willWin {
                bankroll += mise * winPayout
                consecutiveLosses = 0
            } else {
                bankroll -= mise
                consecutiveLosses += 1
            }

            // Mise suivante selon système
            switch system {
            case .flat: break
            case .dalembert:
                mise = willWin ? max(baseUnit, mise - baseUnit) : min(baseUnit * 4, mise + baseUnit)
            case .fibonacci:
                let level = min(consecutiveLosses, fibSequence.count - 1)
                mise = baseUnit * Double(fibSequence[level])
            case .oscarsGrind:
                if willWin { mise = min(mise + baseUnit, baseUnit * 3) }
            }
            spins += 1
        }
        return spins
    }
}

// MARK: - Moteur de Protection des Profits
final class ProfitLockEngine {

    // MARK: - Niveaux de protection des profits
    struct ProfitLock {
        let activatedAt: Double     // % de profit qui déclenche la protection
        let protectedPct: Double    // % du profit à protéger
        let label: String
        let color: String
    }

    static let locks: [ProfitLock] = [
        ProfitLock(activatedAt: 5,  protectedPct: 50, label: "LOCK 50%", color: "#4CAF50"),
        ProfitLock(activatedAt: 10, protectedPct: 70, label: "LOCK 70%", color: "#FF9800"),
        ProfitLock(activatedAt: 20, protectedPct: 85, label: "LOCK 85%", color: "#E30613"),
    ]

    // MARK: - Calcul du seuil de sortie protégé
    static func protectedExitThreshold(session: SessionStats) -> Double? {
        let pct = session.profitLossPct

        for lock in locks.reversed() {
            if pct >= lock.activatedAt {
                let profit = session.currentBankroll - session.startBankroll
                let protectedAmount = profit * lock.protectedPct / 100
                return session.startBankroll + protectedAmount
            }
        }
        return nil
    }

    // MARK: - Message de protection actif
    static func activeLockMessage(session: SessionStats) -> String? {
        let pct = session.profitLossPct
        if pct >= 20 { return "🔒 LOCK 85% — Ton plancher: protège \(Int(pct * 0.85))% du gain" }
        if pct >= 10 { return "🔒 LOCK 70% — Ne redescends pas sous ce seuil" }
        if pct >= 5  { return "🔒 LOCK 50% — Premier profit verrouillé" }
        return nil
    }

    // MARK: - Signal de sortie optimale
    static func shouldExitNow(session: SessionStats, opportunityScore: Double) -> ExitSignal? {
        let pct = session.profitLossPct

        // Signal sortie si profit + score en baisse
        if pct >= 15 && opportunityScore < 45 {
            return ExitSignal(
                urgency: .high,
                message: "SORTIE OPTIMALE — +\(String(format: "%.1f", pct))% atteint, marché qui se referme",
                profit: session.profitLoss
            )
        }
        if pct >= 10 && session.consecutiveLosses >= 2 {
            return ExitSignal(
                urgency: .medium,
                message: "QUITTE MAINTENANT — +\(String(format: "%.1f", pct))% avec début de série noire",
                profit: session.profitLoss
            )
        }
        if pct >= 5 && session.disciplineScore < 50 {
            return ExitSignal(
                urgency: .medium,
                message: "SORS GAGNANT — Discipline basse, sécurise le +\(String(format: "%.1f", pct))%",
                profit: session.profitLoss
            )
        }
        return nil
    }

    struct ExitSignal {
        enum Urgency { case high, medium, low }
        let urgency: Urgency
        let message: String
        let profit: Double
    }
}
