import Foundation

// MARK: - Analyseur Chi-Square pour détection de variance
// Détecte les anomalies statistiques à court terme (sur-représentation / déséquilibres)
final class ChiSquareAnalyzer {

    // MARK: - Calcul du Chi-Square sur N derniers spins
    /// Retourne la valeur χ² (plus élevée = plus d'anomalies = plus d'opportunités)
    static func chiSquareValue(spins: [SpinData], windowSize: Int = 37) -> Double {
        let window = Array(spins.suffix(windowSize))
        guard window.count >= 10 else { return 0.0 }

        let n = Double(window.count)
        let totalNumbers = 37.0  // 0 à 36 roulette européenne
        let expectedPerNumber = n / totalNumbers

        // Comptage des occurrences
        var observed = [Int: Int]()
        for spin in window {
            observed[spin.number, default: 0] += 1
        }

        // Calcul χ² = Σ((O - E)² / E)
        var chiSquare = 0.0
        for num in 0...36 {
            let o = Double(observed[num] ?? 0)
            let e = expectedPerNumber
            chiSquare += pow(o - e, 2) / e
        }

        return chiSquare
    }

    // MARK: - Score d'anomalie normalisé (0-100)
    /// Convertit le χ² en score d'opportunité 0-100
    static func calculateAnomalyScore(spins: [SpinData]) -> Double {
        let chi = chiSquareValue(spins: spins)

        // Pour 36 degrés de liberté :
        // χ² < 25  → distribution quasi-uniforme (score bas)
        // χ² 25-50 → déséquilibre modéré
        // χ² 50-80 → forte anomalie
        // χ² > 80  → anomalie extrême

        let normalized: Double
        switch chi {
        case ..<25:    normalized = (chi / 25.0) * 30.0      // 0-30
        case 25..<50:  normalized = 30.0 + ((chi - 25) / 25.0) * 30.0  // 30-60
        case 50..<80:  normalized = 60.0 + ((chi - 50) / 30.0) * 30.0  // 60-90
        default:       normalized = 90.0 + min(10, (chi - 80) / 20.0 * 10.0) // 90-100
        }

        return min(100.0, max(0.0, normalized))
    }

    // MARK: - Détection des numéros sur-représentés (Hot)
    static func hotNumbers(spins: [SpinData], windowSize: Int = 37) -> [Int] {
        let window = Array(spins.suffix(windowSize))
        guard !window.isEmpty else { return [] }

        let n = Double(window.count)
        let expected = n / 37.0
        let threshold = expected * 2.0  // 2x la fréquence attendue

        var counts = [Int: Int]()
        for spin in window { counts[spin.number, default: 0] += 1 }

        return counts.filter { Double($0.value) >= threshold }
                     .sorted { $0.value > $1.value }
                     .map { $0.key }
    }

    // MARK: - Détection des numéros sous-représentés (Cold)
    static func coldNumbers(spins: [SpinData], windowSize: Int = 37) -> [Int] {
        let window = Array(spins.suffix(windowSize))
        guard !window.isEmpty else { return [] }

        var counts = [Int: Int]()
        for spin in window { counts[spin.number, default: 0] += 1 }

        // Numéros absents ou très peu sortis
        let allNumbers = Array(0...36)
        return allNumbers.filter { (counts[$0] ?? 0) == 0 }
                        .prefix(10)
                        .sorted()
    }

    // MARK: - Secteurs surreprésentés sur la roue
    struct SectorHeatmap {
        let number: Int
        let frequency: Double      // fréquence observée
        let expectedFrequency: Double
        let isHot: Bool
        let isCold: Bool
        let deviation: Double      // % de déviation par rapport à l'attendu
    }

    static func generateHeatmap(spins: [SpinData], windowSize: Int = 37) -> [SectorHeatmap] {
        let window = Array(spins.suffix(windowSize))
        let n = Double(window.count)
        guard n > 0 else { return [] }

        let expected = n / 37.0
        var counts = [Int: Int]()
        for spin in window { counts[spin.number, default: 0] += 1 }

        return (0...36).map { num in
            let obs = Double(counts[num] ?? 0)
            let deviation = expected > 0 ? ((obs - expected) / expected) * 100 : 0
            return SectorHeatmap(
                number: num,
                frequency: obs / n,
                expectedFrequency: expected / n,
                isHot: deviation > 50,
                isCold: deviation < -50,
                deviation: deviation
            )
        }.sorted { abs($0.deviation) > abs($1.deviation) }
    }

    // MARK: - Variance globale de session
    static func sessionVarianceScore(spins: [SpinData]) -> Double {
        guard spins.count >= 37 else {
            return chiSquareValue(spins: spins)
        }

        // Moyenne glissante sur les 3 dernières fenêtres de 37 spins
        let w1 = chiSquareValue(spins: Array(spins.suffix(37)))
        let w2 = spins.count >= 74 ? chiSquareValue(spins: Array(spins.suffix(74).prefix(37))) : w1
        let w3 = spins.count >= 111 ? chiSquareValue(spins: Array(spins.suffix(111).prefix(37))) : w1

        return (w1 * 0.5 + w2 * 0.3 + w3 * 0.2)
    }
}
