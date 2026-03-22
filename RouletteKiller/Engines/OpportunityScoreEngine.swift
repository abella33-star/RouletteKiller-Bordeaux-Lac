import Foundation

// MARK: - Moteur de Score d'Opportunité (Market State Score 0-100)
// Combinaison : Momentum (40%) + Clustering (30%) + Anomalies Chi-Square (30%)
final class OpportunityScoreEngine {

    // MARK: - Score principal
    /// Calcule le score global de 0 à 100
    static func calculateScore(spins: [SpinData]) -> Double {
        guard spins.count >= 10 else { return 0.0 }

        let momentum   = calculateMomentumScore(spins: spins)    // 0-100
        let clustering = calculateClusteringScore(spins: spins)  // 0-100
        let anomaly    = ChiSquareAnalyzer.calculateAnomalyScore(spins: spins) // 0-100

        // Pondération optimisée
        let weighted = (momentum * 0.40) + (clustering * 0.30) + (anomaly * 0.30)
        return min(100, max(0, weighted))
    }

    // MARK: - MODULE A : MOMENTUM (répétition numéros / zones)
    static func calculateMomentumScore(spins: [SpinData]) -> Double {
        let recent = Array(spins.suffix(15))
        guard recent.count >= 5 else { return 0.0 }

        var score = 0.0

        // A1 – Répétition de numéros (dernier 10)
        let last10 = Array(recent.suffix(10))
        let numberCounts = Dictionary(grouping: last10, by: { $0.number }).mapValues { $0.count }
        let hotNumbers = numberCounts.filter { $0.value >= 2 }
        let repetitionScore = min(50.0, Double(hotNumbers.count) * 10.0)
        score += repetitionScore

        // A2 – Répétition de zones
        let last8 = Array(recent.suffix(8))
        let zoneCounts = Dictionary(grouping: last8, by: { $0.zone }).mapValues { $0.count }
        let dominantZone = zoneCounts.max(by: { $0.value < $1.value })
        if let dominant = dominantZone, dominant.value >= 4 {
            score += 30.0
        } else if let dominant = dominantZone, dominant.value >= 3 {
            score += 15.0
        }

        // A3 – Alternance couleur (rupture de pattern)
        let colorPattern = last8.map { $0.color }
        let colorChanges = zip(colorPattern, colorPattern.dropFirst()).filter { $0 != $1 }.count
        if colorChanges <= 2 { score += 20.0 }  // peu d'alternance = tendance forte

        return min(100.0, score)
    }

    // MARK: - MODULE B : CLUSTERING (proximité physique sur roue)
    static func calculateClusteringScore(spins: [SpinData]) -> Double {
        let recent = Array(spins.suffix(20))
        guard recent.count >= 5 else { return 0.0 }

        let numbers = recent.map { $0.number }.filter { $0 != 0 }
        guard !numbers.isEmpty else { return 0.0 }

        var clusterScore = 0.0
        var clusterCount = 0

        // Trouver les paires proches sur la roue (distance ≤ 5)
        for i in 0..<numbers.count {
            for j in (i+1)..<numbers.count {
                let dist = numbers[i].wheelDistance(to: numbers[j])
                if dist <= 3 {
                    clusterScore += 15.0
                    clusterCount += 1
                } else if dist <= 5 {
                    clusterScore += 8.0
                    clusterCount += 1
                }
            }
        }

        // Bonus si un cluster de 3+ numéros proches
        let clusteredGroups = findClusters(numbers: numbers, maxDistance: 4)
        let bigCluster = clusteredGroups.filter { $0.count >= 3 }
        if !bigCluster.isEmpty {
            clusterScore += 25.0
        }

        return min(100.0, clusterScore)
    }

    // MARK: - Détection des clusters de numéros proches
    static func findClusters(numbers: [Int], maxDistance: Int) -> [[Int]] {
        var clusters: [[Int]] = []
        var visited = Set<Int>()

        for number in numbers {
            if visited.contains(number) { continue }
            var cluster = [number]
            visited.insert(number)

            for other in numbers {
                if visited.contains(other) { continue }
                if number.wheelDistance(to: other) <= maxDistance {
                    cluster.append(other)
                    visited.insert(other)
                }
            }
            if cluster.count > 1 { clusters.append(cluster) }
        }
        return clusters
    }

    // MARK: - Numéros recommandés selon score et profil
    static func recommendedNumbers(spins: [SpinData], profile: StrategyProfile) -> [Int] {
        guard spins.count >= 10 else { return [] }

        switch profile {
        case .defense:
            return coupledSectorNumbers(spins: spins, count: 24)
        case .equilibre:
            let coupled = coupledSectorNumbers(spins: spins, count: 12)
            let cold    = coldHuntNumbers(spins: spins, count: 3)
            return Array(Set(coupled + cold))
        case .attaque:
            return coldHuntNumbers(spins: spins, count: 3)
        }
    }

    // MARK: - Stratégie Secteurs Couplés (DÉFENSE)
    /// Sélectionne les numéros des secteurs les plus actifs
    static func coupledSectorNumbers(spins: [SpinData], count: Int) -> [Int] {
        let recent = Array(spins.suffix(37))
        let wheelOrder = [0,32,15,19,4,21,2,25,17,34,6,27,13,36,11,30,8,23,10,5,24,16,33,1,20,14,31,9,22,18,29,7,28,12,35,3,26]

        // Calcul activité par secteur (windows de 7 numéros consécutifs)
        var sectorScores: [(center: Int, score: Double, numbers: [Int])] = []

        for centerIdx in stride(from: 0, to: 37, by: 3) {
            let indices = (0..<7).map { (centerIdx + $0) % 37 }
            let sectorNums = indices.map { wheelOrder[$0] }
            let activity = recent.filter { sectorNums.contains($0.number) }.count
            sectorScores.append((
                center: wheelOrder[centerIdx],
                score: Double(activity),
                numbers: sectorNums
            ))
        }

        // Trier par activité décroissante et prendre les meilleurs secteurs
        let sorted = sectorScores.sorted { $0.score > $1.score }
        var result: [Int] = []
        for sector in sorted {
            result.append(contentsOf: sector.numbers)
            if result.count >= count { break }
        }
        return Array(Set(result.prefix(count)))
    }

    // MARK: - Stratégie Cold Hunt (ATTAQUE)
    /// Sélectionne les numéros qui n'ont pas été tirés depuis longtemps
    static func coldHuntNumbers(spins: [SpinData], count: Int) -> [Int] {
        let recentNumbers = spins.suffix(37).map { $0.number }
        let allNumbers = Array(0...36)

        // Numéros absents des derniers spins = candidats cold
        let absent = allNumbers.filter { !recentNumbers.contains($0) }
        if absent.count >= count { return Array(absent.prefix(count)) }

        // Sinon : les moins fréquents dans les 37 derniers
        let counts = Dictionary(grouping: recentNumbers, by: { $0 }).mapValues { $0.count }
        let sorted = allNumbers.sorted { (counts[$0] ?? 0) < (counts[$1] ?? 0) }
        return Array(sorted.prefix(count))
    }

    // MARK: - Phrase de marché selon score
    static func marketPhrase(score: Double) -> String {
        switch score {
        case 85...:   return "🔥 MARCHÉ EXPLOSIF — FENÊTRE RARE"
        case 75..<85: return "⚡ FORTE OPPORTUNITÉ DÉTECTÉE"
        case 65..<75: return "✅ CONDITIONS FAVORABLES"
        case 55..<65: return "🟡 MARCHÉ NEUTRE — ATTENDS"
        case 40..<55: return "🟠 CONDITIONS DÉFAVORABLES"
        default:      return "🔴 MARCHÉ MORT — NE JOUE PAS"
        }
    }
}
