import SwiftUI

// MARK: - Palette Casino Roulette Killer
extension Color {
    // Couleurs principales
    static let casinoBackground  = Color(hex: "#0A0A0A")
    static let casinoCard        = Color(hex: "#141414")
    static let casinoCardBorder  = Color(hex: "#1E1E1E")
    static let casinoRed         = Color(hex: "#E30613")
    static let casinoGold        = Color(hex: "#FFD700")
    static let casinoGreen       = Color(hex: "#00E676")
    static let casinoOrange      = Color(hex: "#FF6D00")
    static let casinoGray        = Color(hex: "#3A3A3A")

    // Couleurs fonctionnelles
    static let strikeGreen       = Color(hex: "#00E676")
    static let noPlayGray        = Color(hex: "#555555")
    static let hotRed            = Color(hex: "#FF1744")
    static let coldBlue          = Color(hex: "#0091EA")

    // Couleurs de profil
    static let profileDefense    = Color(hex: "#4CAF50")
    static let profileEquilibre  = Color(hex: "#FF9800")
    static let profileAttaque    = Color(hex: "#E30613")

    // Init hex
    init(hex: String) {
        let hex = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&int)
        let a, r, g, b: UInt64
        switch hex.count {
        case 3:
            (a, r, g, b) = (255, (int >> 8) * 17, (int >> 4 & 0xF) * 17, (int & 0xF) * 17)
        case 6:
            (a, r, g, b) = (255, int >> 16, int >> 8 & 0xFF, int & 0xFF)
        case 8:
            (a, r, g, b) = (int >> 24, int >> 16 & 0xFF, int >> 8 & 0xFF, int & 0xFF)
        default:
            (a, r, g, b) = (255, 0, 0, 0)
        }
        self.init(
            .sRGB,
            red:   Double(r) / 255,
            green: Double(g) / 255,
            blue:  Double(b) / 255,
            opacity: Double(a) / 255
        )
    }
}

// MARK: - Couleur dynamique selon score d'opportunité
extension Color {
    static func scoreColor(score: Double) -> Color {
        switch score {
        case 70...:   return .casinoGreen
        case 40..<70: return .casinoOrange
        default:      return .casinoRed
        }
    }

    static func rouletteNumberColor(_ number: Int) -> Color {
        if number == 0 { return .casinoGreen }
        let rouge: Set<Int> = [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]
        return rouge.contains(number) ? .casinoRed : Color.white.opacity(0.9)
    }
}

// MARK: - Modificateurs de style casino
extension View {
    /// Fond carte casino
    func casinoCard(borderColor: Color = .casinoCardBorder) -> some View {
        self
            .background(Color.casinoCard)
            .cornerRadius(16)
            .overlay(
                RoundedRectangle(cornerRadius: 16)
                    .stroke(borderColor, lineWidth: 1)
            )
    }

    /// Bouton casino gros (min 70pt)
    func casinoButton(color: Color = .casinoRed) -> some View {
        self
            .frame(maxWidth: .infinity)
            .frame(minHeight: 70)
            .background(color)
            .cornerRadius(14)
            .shadow(color: color.opacity(0.4), radius: 8, x: 0, y: 4)
    }
}
