import Foundation

// MARK: - Moteur de Garantie Session Gagnante
// Philosophie : On REPART TOUJOURS GAGNANT. Même +1€ = victoire.
// Ce moteur gère les phases de session : Calibration → Attaque → Protection → Sortie
final class SessionGuaranteeEngine {

    // MARK: - Phase de session
    enum SessionPhase: String, Equatable {
        case calibration  = "CALIBRATION"    // 0-15 spins : on observe, on ne joue pas
        case hunting      = "CHASSE"         // Score favorable : on attaque
        case recovery     = "RÉCUPÉRATION"   // En perte : on récupère avec méthode
        case protecting   = "PROTECTION"     // En profit : on verrouille
        case exitZone     = "SORTIE"         // Signal de sortie optimal

        var icon: String {
            switch self {
            case .calibration: return "binoculars.fill"
            case .hunting:     return "bolt.fill"
            case .recovery:    return "arrow.counterclockwise"
            case .protecting:  return "lock.shield.fill"
            case .exitZone:    return "flag.checkered"
            }
        }

        var color: String {
            switch self {
            case .calibration: return "#9E9E9E"
            case .hunting:     return "#00E676"
            case .recovery:    return "#FF9800"
            case .protecting:  return "#FFD700"
            case .exitZone:    return "#E30613"
            }
        }

        var instruction: String {
            switch self {
            case .calibration:
                return "OBSERVE — Saisis les numéros sans miser. Accumule 15 spins."
            case .hunting:
                return "ATTAQUE — Score favorable. Joue la mise recommandée exactement."
            case .recovery:
                return "RÉCUPÈRE — Mode Fibonacci activé. Suis le plan, ne dévie pas."
            case .protecting:
                return "PROTÈGE — Tu es en profit. Réduis les mises, verrouille les gains."
            case .exitZone:
                return "SORS MAINTENANT — Prends ton profit. Le casino peut attendre demain."
            }
        }
    }

    // MARK: - Plan de session complet
    struct SessionPlan {
        let phase: SessionPhase
        let targetProfit: Double        // objectif profit session (€)
        let targetProfitPct: Double     // objectif en %
        let minimumExit: Double         // seuil minimum pour partir (€) — le "jamais en perte"
        let currentStake: Double        // mise recommandée maintenant
        let progressionSystem: WinProtectionEngine.ProgressionSystem
        let nextAction: String          // instruction précise et simple
        let urgencyLevel: UrgencyLevel
        let estimatedSpinsToTarget: Int // estimation spins pour atteindre l'objectif

        enum UrgencyLevel { case chill, play, recover, exit }
    }

    // MARK: - Calcul du plan de session
    static func buildPlan(
        spins: [SpinData],
        session: SessionStats,
        profile: StrategyProfile,
        opportunityScore: Double,
        electronicScore: ElectronicRouletteAnalyzer.ElectronicScore
    ) -> SessionPlan {

        let phase = determinePhase(spins: spins, session: session, score: opportunityScore)
        let system = WinProtectionEngine.recommendSystem(session: session, opportunityScore: opportunityScore)
        let baseUnit = session.startBankroll * profile.stakePct

        // OBJECTIF : minimum +5% pour partir gagnant (jamais en dessous)
        let targetPct = max(5.0, profile.takeProfitPct * 100 * 0.5) // 50% du take profit du profil
        let targetProfit = session.startBankroll * targetPct / 100

        // PLANCHER DE SORTIE : si on monte, on ne redescend pas sous ce seuil
        let minimumExit: Double
        if session.profitLossPct >= 10 {
            minimumExit = session.startBankroll + (session.profitLoss * 0.5) // garde 50% du gain
        } else if session.profitLossPct >= 5 {
            minimumExit = session.startBankroll + (session.profitLoss * 0.3)
        } else {
            minimumExit = session.startBankroll * 0.97 // tolère max -3% avant recovery
        }

        // Mise selon phase
        let stake: Double
        let action: String
        let urgency: SessionPlan.UrgencyLevel
        let estimatedSpins: Int

        switch phase {
        case .calibration:
            stake = 0
            action = "Saisis \(max(0, 15 - spins.count)) spins de plus sans miser"
            urgency = .chill
            estimatedSpins = max(0, 15 - spins.count)

        case .hunting:
            let baseStake = baseUnit
            let bonus: Double = opportunityScore >= 80 ? 1.5 : opportunityScore >= 70 ? 1.2 : 1.0
            stake = baseStake * bonus
            action = opportunityScore >= 80
                ? "FRAPPE ! Score \(Int(opportunityScore)) — mise maximale"
                : "Joue \(stake.formatted(.currency(code: "EUR"))) — \(profile.maxNumbers) numéros"
            urgency = .play
            let remaining = targetProfit - session.profitLoss
            let avgWin = stake * (36.0 / Double(profile.maxNumbers) - 1) * Double(profile.maxNumbers) / 37.0
            estimatedSpins = avgWin > 0 ? max(1, Int(remaining / avgWin)) : 20

        case .recovery:
            stake = WinProtectionEngine.nextStake(
                system: .fibonacci,
                baseUnit: baseUnit,
                session: session
            )
            let toRecover = -session.profitLoss
            action = "Récupère \(toRecover.formatted(.currency(code: "EUR"))) — Fibonacci niveau \(session.consecutiveLosses)"
            urgency = .recover
            estimatedSpins = WinProtectionEngine.recoveryMises(
                currentLoss: -session.profitLoss,
                baseUnit: stake,
                system: .fibonacci,
                numbers: profile.maxNumbers
            )

        case .protecting:
            stake = baseUnit * 0.5  // réduire la mise en phase protection
            action = "Mise réduite — protège \(session.profitLoss.formatted(.currency(code: "EUR"))) de gains"
            urgency = .play
            estimatedSpins = 5

        case .exitZone:
            stake = 0
            action = "ARRÊTE — Encaisse \(session.profitLoss.formatted(.currency(code: "EUR"))) — Tu as gagné !"
            urgency = .exit
            estimatedSpins = 0
        }

        return SessionPlan(
            phase: phase,
            targetProfit: targetProfit,
            targetProfitPct: targetPct,
            minimumExit: minimumExit,
            currentStake: stake,
            progressionSystem: system,
            nextAction: action,
            urgencyLevel: urgency,
            estimatedSpinsToTarget: estimatedSpins
        )
    }

    // MARK: - Détermination de la phase
    private static func determinePhase(
        spins: [SpinData],
        session: SessionStats,
        score: Double
    ) -> SessionPhase {

        // Phase 0 : Calibration (15 premiers spins)
        if spins.count < 15 { return .calibration }

        // Phase sortie : profit atteint ou signal optimal
        if let exitSignal = ProfitLockEngine.shouldExitNow(session: session, opportunityScore: score),
           exitSignal.urgency == .high {
            return .exitZone
        }
        let exitThreshold = session.startBankroll > 0 ? 20.0 : 15.0
        if session.profitLossPct >= exitThreshold {
            return .exitZone
        }

        // Phase protection : en profit suffisant
        if session.profitLossPct >= 10 { return .protecting }

        // Phase récupération : en perte
        if session.profitLoss < -session.startBankroll * 0.03 {
            return .recovery
        }

        // Phase chasse : score favorable
        return .hunting
    }

    // MARK: - Score "QUITTER GAGNANT" (0-100)
    // 100 = Signal de sortie parfait, 0 = reste et attaque encore
    static func exitScore(session: SessionStats, opportunityScore: Double, spins: [SpinData]) -> Double {
        var score = 0.0

        // Profit actuel (plus de profit = plus forte incitation à partir)
        if session.profitLossPct >= 20     { score += 40 }
        else if session.profitLossPct >= 15 { score += 30 }
        else if session.profitLossPct >= 10 { score += 20 }
        else if session.profitLossPct >= 5  { score += 10 }

        // Score d'opportunité en baisse (marché se ferme)
        if opportunityScore < 40           { score += 30 }
        else if opportunityScore < 55      { score += 15 }

        // Début de série négative
        if session.consecutiveLosses >= 2  { score += 20 }

        // Durée session trop longue
        let minutes = session.sessionDuration / 60
        if minutes >= 90                   { score += 30 }
        else if minutes >= 60              { score += 15 }

        // Discipline qui baisse
        if session.disciplineScore < 50    { score += 15 }

        return min(100, score)
    }

    // MARK: - Recommandation numéros selon phase + moteur électronique
    static func optimalNumbers(
        spins: [SpinData],
        phase: SessionPhase,
        profile: StrategyProfile,
        electronicScore: ElectronicRouletteAnalyzer.ElectronicScore
    ) -> [Int] {
        switch phase {
        case .calibration:
            return []

        case .hunting:
            // Priorité : numéros électroniques exploitables + cold hunt
            var nums = electronicScore.exploitableNumbers
            let cold = OpportunityScoreEngine.coldHuntNumbers(spins: spins, count: 3)
            nums.append(contentsOf: cold)
            return Array(Set(nums)).prefix(profile.maxNumbers).sorted()

        case .recovery:
            // En récupération : secteurs couplés (plus larges = plus de chances)
            return OpportunityScoreEngine.coupledSectorNumbers(spins: spins, count: 12)

        case .protecting:
            // Protection : moins de numéros, ceux avec le plus de signal
            return electronicScore.exploitableNumbers.prefix(5).sorted()

        case .exitZone:
            return []
        }
    }
}

