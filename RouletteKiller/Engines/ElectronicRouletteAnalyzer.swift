import Foundation

// MARK: - Analyseur Roulette Électronique Casino Barrière Bordeaux Lac
// Les roulettes électroniques utilisent des générateurs physiques (vraie bille + roue)
// mais avec interface numérique — des biais de timing et de secteur existent
final class ElectronicRouletteAnalyzer {

    // MARK: - Roue européenne physique (Casino Barrière standard)
    static let wheelOrder = [0,32,15,19,4,21,2,25,17,34,6,27,13,36,11,30,8,23,10,5,24,16,33,1,20,14,31,9,22,18,29,7,28,12,35,3,26]

    // MARK: - Secteurs physiques de la roue (9 zones de 4 numéros)
    static let physicalSectors: [[Int]] = [
        [0, 32, 15, 19],   // Secteur 1 : Voisins haut
        [4, 21, 2, 25],    // Secteur 2
        [17, 34, 6, 27],   // Secteur 3
        [13, 36, 11, 30],  // Secteur 4 : Centre roue
        [8, 23, 10, 5],    // Secteur 5
        [24, 16, 33, 1],   // Secteur 6
        [20, 14, 31, 9],   // Secteur 7
        [22, 18, 29, 7],   // Secteur 8
        [28, 12, 35, 3],   // Secteur 9
        [26],              // Secteur 10 : extrémité
    ]

    // MARK: - Analyse de Bias de Secteur
    struct SectorBias {
        let sectorIndex: Int
        let numbers: [Int]
        let observedFreq: Double    // fréquence observée (%)
        let expectedFreq: Double    // fréquence attendue (%)
        let biasScore: Double       // score de biais (-100 à +100)
        let isBiased: Bool          // seuil 40%+ de déviation = biais détecté
        let direction: BiasDirection

        enum BiasDirection {
            case hot    // sur-représenté
            case cold   // sous-représenté
            case neutral
        }
    }

    static func analyzeSectorBias(spins: [SpinData]) -> [SectorBias] {
        guard spins.count >= 20 else { return [] }
        let window = Array(spins.suffix(min(spins.count, 100)))
        let n = Double(window.count)

        return physicalSectors.enumerated().map { (idx, sector) in
            let observed = window.filter { sector.contains($0.number) }.count
            let observedPct = Double(observed) / n * 100
            let expectedPct = Double(sector.count) / 37.0 * 100
            let bias = ((observedPct - expectedPct) / expectedPct) * 100

            return SectorBias(
                sectorIndex: idx,
                numbers: sector,
                observedFreq: observedPct,
                expectedFreq: expectedPct,
                biasScore: bias,
                isBiased: abs(bias) >= 40,
                direction: bias > 15 ? .hot : bias < -15 ? .cold : .neutral
            )
        }
    }

    // MARK: - Détection de Pattern Temporel (Electronic Specific)
    // Les roulettes électroniques ont souvent des cycles de résultats réguliers
    struct TemporalPattern {
        let cycleLengthDetected: Int?   // longueur du cycle détecté (nil si aucun)
        let nextPredictedSector: [Int]  // secteur probable au prochain spin
        let confidence: Double          // confiance 0-100
        let patternType: PatternType

        enum PatternType: String {
            case sectorAlternation = "ALTERNANCE SECTEUR"
            case colorBalance      = "ÉQUILIBRAGE COULEUR"
            case neighborRepeat    = "RÉPÉTITION VOISIN"
            case noPattern         = "PAS DE PATTERN"
        }
    }

    static func detectTemporalPattern(spins: [SpinData]) -> TemporalPattern {
        guard spins.count >= 8 else {
            return TemporalPattern(cycleLengthDetected: nil, nextPredictedSector: [], confidence: 0, patternType: .noPattern)
        }

        let recent = Array(spins.suffix(16))

        // 1. Alternance couleur (rouge/noir régulier)
        let colors = recent.map { $0.color }
        let colorChanges = zip(colors, colors.dropFirst()).filter { $0 != $1 }.count
        if colorChanges >= Int(Double(colors.count - 1) * 0.8) {
            let lastColor = colors.last
            let lastNum = recent.last!.number
            let nextColorNums = lastColor == .rouge ?
                [1,4,7,10,13,16,19,22,25,28,31,34] :
                [2,5,8,11,14,17,20,23,26,29,32,35]
            return TemporalPattern(
                cycleLengthDetected: 2,
                nextPredictedSector: nextColorNums,
                confidence: 65,
                patternType: .colorBalance
            )
        }

        // 2. Répétition de voisins (bille qui atterrit dans la même zone)
        let positions = recent.map { $0.number.rouletteWheelPosition }
        var neighborCount = 0
        for i in 1..<positions.count {
            let dist = abs(positions[i] - positions[i-1])
            if min(dist, 37 - dist) <= 5 { neighborCount += 1 }
        }
        if Double(neighborCount) / Double(positions.count - 1) >= 0.5 {
            let lastPos = positions.last!
            let neighborPositions = (0..<7).map { (lastPos + $0 - 3 + 37) % 37 }
            let neighborNumbers = neighborPositions.map { wheelOrder[$0] }
            return TemporalPattern(
                cycleLengthDetected: 1,
                nextPredictedSector: neighborNumbers,
                confidence: 60,
                patternType: .neighborRepeat
            )
        }

        // 3. Alternance de secteur (roue physique qui favorise des zones)
        let sectorHistory = recent.map { sectorIndex(for: $0.number) }
        let uniqueSectors = Set(sectorHistory)
        if uniqueSectors.count <= 3 && recent.count >= 8 {
            let mostFreqSector = sectorHistory.reduce(into: [:]) { $0[$1, default: 0] += 1 }
                .max(by: { $0.value < $1.value })?.key ?? 0
            return TemporalPattern(
                cycleLengthDetected: nil,
                nextPredictedSector: physicalSectors[min(mostFreqSector, physicalSectors.count - 1)],
                confidence: 55,
                patternType: .sectorAlternation
            )
        }

        return TemporalPattern(cycleLengthDetected: nil, nextPredictedSector: [], confidence: 0, patternType: .noPattern)
    }

    private static func sectorIndex(for number: Int) -> Int {
        for (i, sector) in physicalSectors.enumerated() {
            if sector.contains(number) { return i }
        }
        return 0
    }

    // MARK: - Score RNG Spécifique Roulette Électronique
    // Plus le score est haut, plus la roulette montre des anomalies exploitables
    struct ElectronicScore {
        let sectorBiasScore: Double     // 0-100 : biais de secteur détecté
        let temporalScore: Double       // 0-100 : pattern temporel détecté
        let overallScore: Double        // 0-100 : score combiné
        let exploitableNumbers: [Int]   // numéros recommandés basés sur l'analyse
        let primaryReason: String       // raison principale de l'opportunité
    }

    static func calculateElectronicScore(spins: [SpinData]) -> ElectronicScore {
        guard spins.count >= 15 else {
            return ElectronicScore(
                sectorBiasScore: 0, temporalScore: 0, overallScore: 0,
                exploitableNumbers: [],
                primaryReason: "Besoin de plus de données (\(spins.count)/15)"
            )
        }

        // Score biais secteur
        let biases = analyzeSectorBias(spins: spins)
        let hotSectors = biases.filter { $0.direction == .hot && $0.isBiased }
        let sectorScore = min(100, Double(hotSectors.count) * 25.0 +
            (hotSectors.max(by: { $0.biasScore < $1.biasScore })?.biasScore ?? 0) * 0.3)

        // Score temporel
        let pattern = detectTemporalPattern(spins: spins)
        let temporalScore = pattern.confidence

        // Score combiné
        let combined = (sectorScore * 0.60) + (temporalScore * 0.40)

        // Numéros exploitables
        var exploitable: [Int] = []
        if !hotSectors.isEmpty {
            for sector in hotSectors.sorted(by: { $0.biasScore > $1.biasScore }).prefix(2) {
                exploitable.append(contentsOf: sector.numbers)
            }
        }
        if !pattern.nextPredictedSector.isEmpty && pattern.confidence >= 55 {
            exploitable.append(contentsOf: pattern.nextPredictedSector)
        }
        exploitable = Array(Set(exploitable))

        // Raison principale
        let reason: String
        if sectorScore >= 60 {
            reason = "Biais secteur détecté — \(hotSectors.first.map { "Secteur \($0.sectorIndex + 1)" } ?? "")"
        } else if temporalScore >= 55 {
            reason = "Pattern: \(pattern.patternType.rawValue)"
        } else {
            reason = "Marché stable — attends une anomalie"
        }

        return ElectronicScore(
            sectorBiasScore: sectorScore,
            temporalScore: temporalScore,
            overallScore: combined,
            exploitableNumbers: exploitable,
            primaryReason: reason
        )
    }

    // MARK: - Numéros "Voisins Dynamiques" (5 voisins du dernier numéro tiré)
    // Très utilisé en casino physique — les voisins restent chauds quelques tours
    static func dynamicNeighbors(of number: Int, count: Int = 5) -> [Int] {
        guard let pos = wheelOrder.firstIndex(of: number) else { return [] }
        let half = count / 2
        return (-half...half).map { offset in
            wheelOrder[(pos + offset + 37) % 37]
        }.filter { $0 != number }
    }

    // MARK: - Analyse des répétitions rapides (same number or neighbors)
    static func rapidRepetitionScore(spins: [SpinData]) -> Double {
        let recent = Array(spins.suffix(10))
        guard recent.count >= 5 else { return 0 }

        var score = 0.0
        for i in 1..<recent.count {
            let dist = recent[i].number.wheelDistance(to: recent[i-1].number)
            if dist == 0 { score += 30 }      // même numéro !
            else if dist <= 2 { score += 20 } // quasi-voisin
            else if dist <= 5 { score += 10 } // voisin proche
        }
        return min(100, score)
    }
}
