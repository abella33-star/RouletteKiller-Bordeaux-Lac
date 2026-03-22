import Foundation

// MARK: - Profil stratégique utilisateur
enum StrategyProfile: String, CaseIterable, Codable {
    case defense    = "DÉFENSE"
    case equilibre  = "ÉQUILIBRE"
    case attaque    = "ATTAQUE"

    var icon: String {
        switch self {
        case .defense:   return "shield.fill"
        case .equilibre: return "scalemass.fill"
        case .attaque:   return "bolt.fill"
        }
    }

    var color: String {
        switch self {
        case .defense:   return "#4CAF50"   // vert
        case .equilibre: return "#FF9800"   // orange
        case .attaque:   return "#E30613"   // rouge sang
        }
    }

    /// Pourcentage de la bankroll misé par tour
    var stakePct: Double {
        switch self {
        case .defense:   return 0.005   // 0.5%
        case .equilibre: return 0.010   // 1.0%
        case .attaque:   return 0.015   // 1.5%
        }
    }

    /// Take profit (gain % avant arrêt)
    var takeProfitPct: Double {
        switch self {
        case .defense:   return 0.10    // +10%
        case .equilibre: return 0.15    // +15%
        case .attaque:   return 0.20    // +20%
        }
    }

    /// Stop loss (perte % avant arrêt)
    var stopLossPct: Double {
        switch self {
        case .defense:   return 0.05    // -5%
        case .equilibre: return 0.10    // -10%
        case .attaque:   return 0.15    // -15%
        }
    }

    /// Nombre max de numéros joués
    var maxNumbers: Int {
        switch self {
        case .defense:   return 24
        case .equilibre: return 15
        case .attaque:   return 3
        }
    }

    /// Pertes consécutives avant arrêt forcé
    var maxConsecutiveLosses: Int {
        switch self {
        case .defense:   return 5
        case .equilibre: return 4
        case .attaque:   return 3
        }
    }

    /// Score minimum requis pour autoriser le jeu
    var minOpportunityScore: Double {
        switch self {
        case .defense:   return 55.0
        case .equilibre: return 65.0
        case .attaque:   return 75.0
        }
    }

    /// Description de la stratégie
    var description: String {
        switch self {
        case .defense:
            return "Secteurs couplés — 24 numéros — Risque minimal — Idéal débutant"
        case .equilibre:
            return "Mix couplés + Cold Hunt — 15 numéros — Risque modéré — Standard"
        case .attaque:
            return "Cold Hunt seul — 3 numéros — Risque élevé — Experts uniquement"
        }
    }

    /// Seuil de variance Chi-Square pour activer ce profil
    var chiSquareThreshold: Double {
        switch self {
        case .defense:   return 60.0
        case .equilibre: return 70.0
        case .attaque:   return 80.0
        }
    }
}

// MARK: - Mode Money Management
enum MoneyManagementMode: String, CaseIterable, Codable {
    case safe      = "SAFE"
    case adaptive  = "ADAPTATIF"
    case attack    = "ATTAQUE MAX"

    var description: String {
        switch self {
        case .safe:     return "Mise fixe constante"
        case .adaptive: return "Ajustement selon performance"
        case .attack:   return "Progression après gains uniquement"
        }
    }

    var icon: String {
        switch self {
        case .safe:     return "lock.shield.fill"
        case .adaptive: return "chart.line.uptrend.xyaxis"
        case .attack:   return "flame.fill"
        }
    }
}

// MARK: - Décision de jeu
struct BettingDecision: Identifiable {
    let id = UUID()
    let shouldPlay: Bool
    let opportunityScore: Double
    let recommendedNumbers: [Int]
    let recommendedStake: Double
    let rationale: String
    let profile: StrategyProfile
    let estimatedProbability: Double
    let potentialGain: Double
    let riskLevel: RiskLevel
}

enum RiskLevel: String {
    case low    = "FAIBLE"
    case medium = "MODÉRÉ"
    case high   = "ÉLEVÉ"

    var icon: String {
        switch self {
        case .low:    return "checkmark.shield.fill"
        case .medium: return "exclamationmark.triangle.fill"
        case .high:   return "xmark.octagon.fill"
        }
    }
}
