import Foundation

// MARK: - Moteur de Money Management Avancé
// Trois modes : Safe (mise fixe) / Adaptatif / Attaque (progression après gains)
final class MoneyManagementEngine {

    // MARK: - Calcul de la mise optimale
    static func calculateStake(
        bankroll: Double,
        profile: StrategyProfile,
        mode: MoneyManagementMode,
        session: SessionStats,
        opportunityScore: Double
    ) -> Double {
        guard bankroll > 0 else { return 0 }

        let baseStake = bankroll * profile.stakePct

        switch mode {
        case .safe:
            return safeStake(base: baseStake, bankroll: bankroll)

        case .adaptive:
            return adaptiveStake(
                base: baseStake,
                session: session,
                bankroll: bankroll,
                score: opportunityScore
            )

        case .attack:
            return attackStake(
                base: baseStake,
                session: session,
                bankroll: bankroll,
                score: opportunityScore
            )
        }
    }

    // MARK: - SAFE MODE : Mise fixe constante
    private static func safeStake(base: Double, bankroll: Double) -> Double {
        // Arrondi au 0.50€ le plus proche, minimum 0.50€
        let rounded = max(0.50, (base * 2).rounded() / 2)
        return min(rounded, bankroll * 0.05)  // jamais plus de 5% de la bankroll
    }

    // MARK: - ADAPTIVE MODE : Ajustement selon performance session
    private static func adaptiveStake(
        base: Double,
        session: SessionStats,
        bankroll: Double,
        score: Double
    ) -> Double {
        var multiplier = 1.0

        // Réduction si en perte
        if session.profitLossPct < -5 {
            multiplier = 0.7
        } else if session.profitLossPct < 0 {
            multiplier = 0.85
        }

        // Augmentation si en gain + score élevé
        if session.profitLossPct > 10 && score > 75 {
            multiplier = 1.3
        } else if session.profitLossPct > 5 {
            multiplier = 1.15
        }

        // Pénalité si streak de pertes
        if session.consecutiveLosses >= 3 {
            multiplier *= 0.6
        }

        // Bonus discipline score
        if session.disciplineScore >= 80 {
            multiplier *= 1.1
        }

        let adjusted = base * multiplier
        return min(adjusted, bankroll * 0.05)
    }

    // MARK: - ATTACK MODE : Progressive uniquement après gains
    private static func attackStake(
        base: Double,
        session: SessionStats,
        bankroll: Double,
        score: Double
    ) -> Double {
        // RÈGLE CRITIQUE : jamais augmenter après perte
        if session.consecutiveLosses > 0 { return base }

        // Progression après wins consécutifs (max 3 paliers)
        var multiplier = 1.0
        switch session.consecutiveWins {
        case 0:    multiplier = 1.0
        case 1:    multiplier = 1.2
        case 2:    multiplier = 1.4
        default:   multiplier = 1.5  // plafond
        }

        // Score bonus si très haute opportunité
        if score >= 85 { multiplier *= 1.15 }

        let adjusted = base * multiplier
        return min(adjusted, bankroll * 0.08)  // max 8% en mode attaque
    }

    // MARK: - Vérification des stops
    struct StopCheck {
        let shouldStop: Bool
        let reason: StopReason?
    }

    enum StopReason: String {
        case takeProfitReached  = "🏆 OBJECTIF ATTEINT — EXCELLENT TRAVAIL !"
        case stopLossReached    = "🛑 STOP LOSS — PROTÈGE TON CAPITAL"
        case consecutiveLosses  = "⚠️ SÉRIE NOIRE — PAUSE OBLIGATOIRE"
        case disciplineAlert    = "🧠 TILT DÉTECTÉ — ARRÊT TEMPORAIRE"
        case x2Target           = "🎯 MODE X2 — OBJECTIF ATTEINT !"
        case timeLimit          = "⏰ TEMPS LIMITE ATTEINT"
    }

    static func checkStops(
        session: SessionStats,
        profile: StrategyProfile,
        isX2Mode: Bool = false
    ) -> StopCheck {
        // Take profit
        if session.profitLossPct >= profile.takeProfitPct * 100 {
            return StopCheck(shouldStop: true, reason: .takeProfitReached)
        }

        // Mode X2 : objectif +50%
        if isX2Mode && session.profitLossPct >= 50 {
            return StopCheck(shouldStop: true, reason: .x2Target)
        }

        // Stop loss
        if session.profitLossPct <= -(profile.stopLossPct * 100) {
            return StopCheck(shouldStop: true, reason: .stopLossReached)
        }

        // Pertes consécutives
        if session.consecutiveLosses >= profile.maxConsecutiveLosses {
            return StopCheck(shouldStop: true, reason: .consecutiveLosses)
        }

        // Anti-tilt (score discipline < 30)
        if session.disciplineScore < 30 {
            return StopCheck(shouldStop: true, reason: .disciplineAlert)
        }

        return StopCheck(shouldStop: false, reason: nil)
    }

    // MARK: - Backtest sur les N derniers spins
    static func backtest(
        spins: [SpinData],
        initialBankroll: Double,
        profile: StrategyProfile,
        windowSize: Int = 50
    ) -> BacktestResult {
        let window = Array(spins.suffix(windowSize))
        guard window.count >= 10 else {
            return BacktestResult(
                profile: profile,
                roi: 0, winRate: 0, maxDrawdown: 0,
                totalTrades: 0,
                finalBankroll: initialBankroll,
                initialBankroll: initialBankroll
            )
        }

        var bankroll = initialBankroll
        var peak = initialBankroll
        var lowest = initialBankroll
        var wins = 0
        var trades = 0

        // Simulation spin par spin
        for i in 10..<window.count {
            let historique = Array(window.prefix(i))
            let score = OpportunityScoreEngine.calculateScore(spins: historique)

            // Ne jouer que si le score dépasse le seuil du profil
            guard score >= profile.minOpportunityScore else { continue }

            let stake = bankroll * profile.stakePct
            guard stake > 0 else { break }

            let recommended = OpportunityScoreEngine.recommendedNumbers(
                spins: historique,
                profile: profile
            )
            let spin = window[i].number

            trades += 1

            if recommended.contains(spin) {
                // Gain : 35:1 pour un numéro, proportionnel
                let payoutMultiplier = 36.0 / Double(max(1, recommended.count))
                bankroll += stake * (payoutMultiplier - 1)
                wins += 1
            } else {
                bankroll -= stake
            }

            if bankroll > peak { peak = bankroll }
            if bankroll < lowest { lowest = bankroll }
            if bankroll <= 0 { break }
        }

        let roi = initialBankroll > 0 ? ((bankroll - initialBankroll) / initialBankroll) * 100 : 0
        let winRate = trades > 0 ? Double(wins) / Double(trades) * 100 : 0
        let maxDrawdown = peak > 0 ? ((peak - lowest) / peak) * 100 : 0

        return BacktestResult(
            profile: profile,
            roi: roi,
            winRate: winRate,
            maxDrawdown: maxDrawdown,
            totalTrades: trades,
            finalBankroll: bankroll,
            initialBankroll: initialBankroll
        )
    }
}
