import Foundation

// MARK: - Numéro de roulette
struct SpinData: Identifiable, Codable, Equatable {
    let id: UUID
    let number: Int          // 0-36
    let timestamp: Date
    let color: RouletteColor
    let zone: RouletteZone

    init(number: Int, timestamp: Date = Date()) {
        self.id = UUID()
        self.number = number
        self.timestamp = timestamp
        self.color = RouletteColor.from(number: number)
        self.zone = RouletteZone.from(number: number)
    }
}

// MARK: - Couleur roulette européenne
enum RouletteColor: String, Codable {
    case rouge = "Rouge"
    case noir  = "Noir"
    case vert  = "Zéro"

    static func from(number: Int) -> RouletteColor {
        if number == 0 { return .vert }
        let rougeNumbers: Set<Int> = [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]
        return rougeNumbers.contains(number) ? .rouge : .noir
    }
}

// MARK: - Zones de la roue européenne
enum RouletteZone: String, Codable, CaseIterable {
    case voisinsZero  = "Voisins du Zéro"   // 22-25 (9 numbers)
    case tiersRoue   = "Tiers de la Roue"   // 27-33 (12 numbers)
    case orphelins   = "Orphelins"           // reste (8 numbers)
    case zero        = "Zéro"

    static func from(number: Int) -> RouletteZone {
        if number == 0 { return .zero }
        let voisins: Set<Int> = [22,18,29,7,28,12,35,3,26,0,32,15,19,4,21,2,25]
        let tiers:   Set<Int> = [27,13,36,11,30,8,23,10,5,24,16,33]
        return voisins.contains(number) ? .voisinsZero :
               tiers.contains(number)   ? .tiersRoue   : .orphelins
    }
}

// MARK: - Position physique sur la roue (sens horaire)
extension Int {
    /// Retourne la position 0-36 sur la roue européenne
    var rouletteWheelPosition: Int {
        let wheelOrder = [0,32,15,19,4,21,2,25,17,34,6,27,13,36,11,30,8,23,10,5,24,16,33,1,20,14,31,9,22,18,29,7,28,12,35,3,26]
        return wheelOrder.firstIndex(of: self) ?? 0
    }

    /// Distance minimale sur la roue entre deux numéros (0-18)
    func wheelDistance(to other: Int) -> Int {
        let posA = self.rouletteWheelPosition
        let posB = other.rouletteWheelPosition
        let diff = abs(posA - posB)
        return min(diff, 37 - diff)
    }
}
