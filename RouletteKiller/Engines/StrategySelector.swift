import Foundation

// MARK: - Sélecteur Automatique de Stratégie
// Choisit le meilleur profil selon : variance Chi-Square, discipline, historique session
final class StrategySelector {

    struct Recommendation {
        let profile: StrategyProfile
        let confidence: Double      // 0-100
        let reasoning: String
        let autoSelected: Bool
    }

    // MARK: - Sélection automatique du meilleur profil
    static func autoSelect(
        spins: [SpinData],
        session: SessionStats,
        currentProfile: StrategyProfile
    ) -> Recommendation {
        guard spins.count >= 10 else {
            return Recommendation(
                profile: .defense,
                confidence: 50,
                reasoning: "Pas assez de données — profil DÉFENSE par sécurité",
                autoSelected: true
            )
        }

        let chiSquare = ChiSquareAnalyzer.chiSquareValue(spins: spins)
        let opportunityScore = OpportunityScoreEngine.calculateScore(spins: spins)
        let discipline = session.disciplineScore

        // Règle 1 : Discipline insuffisante → toujours DÉFENSE
        if discipline < 40 {
            return Recommendation(
                profile: .defense,
                confidence: 95,
                reasoning: "Score discipline bas (\(Int(discipline))) — DÉFENSE obligatoire",
                autoSelected: true
            )
        }

        // Règle 2 : Score trop bas → ne pas jouer
        if opportunityScore < 40 {
            return Recommendation(
                profile: currentProfile,
                confidence: 0,
                reasoning: "Score opportunité trop bas (\(Int(opportunityScore))) — N'ATTENDEZ PAS",
                autoSelected: false
            )
        }

        // Règle 3 : Sélection selon Chi-Square + score combiné
        let combinedScore = (chiSquare * 0.4) + (opportunityScore * 0.6)

        switch combinedScore {
        case ..<50:
            return Recommendation(
                profile: .defense,
                confidence: 75,
                reasoning: "Variance modérée (χ²=\(String(format: "%.1f", chiSquare))) — DÉFENSE recommandé",
                autoSelected: true
            )
        case 50..<70:
            let profile: StrategyProfile = discipline >= 70 ? .equilibre : .defense
            return Recommendation(
                profile: profile,
                confidence: 80,
                reasoning: "Bonne variance (χ²=\(String(format: "%.1f", chiSquare))) — ÉQUILIBRE optimal",
                autoSelected: true
            )
        default:
            let profile: StrategyProfile = discipline >= 80 && session.consecutiveLosses == 0 ? .attaque : .equilibre
            return Recommendation(
                profile: profile,
                confidence: 85,
                reasoning: "Forte anomalie (χ²=\(String(format: "%.1f", chiSquare))) — \(discipline >= 80 ? "ATTAQUE" : "ÉQUILIBRE") recommandé",
                autoSelected: true
            )
        }
    }

    // MARK: - Décision complète de jeu
    static func makeDecision(
        spins: [SpinData],
        session: SessionStats,
        profile: StrategyProfile,
        moneyMode: MoneyManagementMode,
        bankroll: Double
    ) -> BettingDecision {
        let score = OpportunityScoreEngine.calculateScore(spins: spins)
        let recommended = OpportunityScoreEngine.recommendedNumbers(spins: spins, profile: profile)
        let stake = MoneyManagementEngine.calculateStake(
            bankroll: bankroll,
            profile: profile,
            mode: moneyMode,
            session: session,
            opportunityScore: score
        )

        // Vérification des stops
        let stopCheck = MoneyManagementEngine.checkStops(session: session, profile: profile)
        if stopCheck.shouldStop {
            return BettingDecision(
                shouldPlay: false,
                opportunityScore: score,
                recommendedNumbers: [],
                recommendedStake: 0,
                rationale: stopCheck.reason?.rawValue ?? "ARRÊT REQUIS",
                profile: profile,
                estimatedProbability: 0,
                potentialGain: 0,
                riskLevel: .high
            )
        }

        let shouldPlay = score >= profile.minOpportunityScore && !recommended.isEmpty
        let probability = Double(recommended.count) / 37.0 * 100
        let potentialGain = stake * (36.0 / Double(max(1, recommended.count)) - 1)

        let riskLevel: RiskLevel
        switch profile {
        case .defense:   riskLevel = .low
        case .equilibre: riskLevel = .medium
        case .attaque:   riskLevel = .high
        }

        let rationale = shouldPlay
            ? OpportunityScoreEngine.marketPhrase(score: score)
            : "Score \(Int(score)) < seuil \(Int(profile.minOpportunityScore)) — ATTENDS"

        return BettingDecision(
            shouldPlay: shouldPlay,
            opportunityScore: score,
            recommendedNumbers: shouldPlay ? recommended : [],
            recommendedStake: shouldPlay ? stake : 0,
            rationale: rationale,
            profile: profile,
            estimatedProbability: shouldPlay ? probability : 0,
            potentialGain: shouldPlay ? potentialGain : 0,
            riskLevel: riskLevel
        )
    }
}
