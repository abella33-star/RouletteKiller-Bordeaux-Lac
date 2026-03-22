import SwiftUI

// MARK: - Historique des Derniers Spins (20 derniers visibles)
struct HistoryView: View {
    @ObservedObject var vm: RouletteViewModel

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            // En-tête
            HStack {
                Image(systemName: "clock.arrow.circlepath")
                    .foregroundColor(.casinoGold)
                Text("HISTORIQUE")
                    .font(.system(size: 13, weight: .black))
                    .tracking(2)
                    .foregroundColor(.gray)

                Spacer()

                // Chi-Square badge
                HStack(spacing: 4) {
                    Image(systemName: "waveform.path.ecg")
                        .font(.system(size: 11))
                        .foregroundColor(.casinoOrange)
                    Text("χ² \(String(format: "%.1f", vm.chiSquareScore))")
                        .font(.system(size: 12, weight: .bold))
                        .foregroundColor(.casinoOrange)
                }
                .padding(.horizontal, 8).padding(.vertical, 3)
                .background(Color.casinoOrange.opacity(0.1))
                .cornerRadius(8)

                // Bouton reset
                if !vm.spins.isEmpty {
                    Button {
                        withAnimation { vm.resetSpins() }
                    } label: {
                        Image(systemName: "trash")
                            .font(.system(size: 14))
                            .foregroundColor(.gray)
                    }
                }
            }
            .padding(.horizontal, 16)

            // Défilement horizontal des numéros
            if vm.recentSpins.isEmpty {
                Text("Aucun spin enregistré")
                    .font(.system(size: 14))
                    .foregroundColor(.gray)
                    .frame(maxWidth: .infinity, alignment: .center)
                    .padding(.vertical, 16)
            } else {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        ForEach(Array(vm.recentSpins.enumerated()), id: \.element.id) { index, spin in
                            spinChip(spin: spin, position: index)
                        }
                    }
                    .padding(.horizontal, 16)
                    .padding(.vertical, 4)
                }

                // Statistiques rapides
                quickStats
            }
        }
        .padding(.vertical, 10)
        .background(Color.casinoCard)
        .cornerRadius(16)
        .overlay(
            RoundedRectangle(cornerRadius: 16)
                .stroke(Color.casinoCardBorder, lineWidth: 1)
        )
    }

    // MARK: - Chip de spin individuel
    private func spinChip(spin: SpinData, position: Int) -> some View {
        let isHot = vm.hotNumbers.contains(spin.number)
        let isCold = vm.coldNumbers.contains(spin.number)

        return VStack(spacing: 3) {
            // Indicateur hot/cold
            if isHot {
                Image(systemName: "flame.fill")
                    .font(.system(size: 8))
                    .foregroundColor(.hotRed)
            } else if isCold {
                Image(systemName: "snowflake")
                    .font(.system(size: 8))
                    .foregroundColor(.coldBlue)
            } else {
                Color.clear.frame(height: 10)
            }

            // Numéro
            Text("\(spin.number)")
                .font(.system(size: 16, weight: .black, design: .rounded))
                .foregroundColor(position == 0 ? .casinoGold : Color.rouletteNumberColor(spin.number))
                .frame(width: 40, height: 40)
                .background(chipBackground(spin: spin, isFirst: position == 0))
                .clipShape(Circle())
                .overlay(
                    Circle()
                        .stroke(position == 0 ? Color.casinoGold : Color.clear, lineWidth: 2)
                )

            // Position (1 = dernier)
            Text("\(position + 1)")
                .font(.system(size: 9))
                .foregroundColor(.gray.opacity(0.6))
        }
        .scaleEffect(position == 0 ? 1.1 : 1.0)
    }

    private func chipBackground(spin: SpinData, isFirst: Bool) -> Color {
        if isFirst { return Color.casinoGold.opacity(0.2) }
        switch spin.color {
        case .rouge: return Color.casinoRed.opacity(0.4)
        case .noir:  return Color.casinoGray
        case .vert:  return Color.casinoGreen.opacity(0.4)
        }
    }

    // MARK: - Statistiques rapides
    private var quickStats: some View {
        let last20 = Array(vm.spins.suffix(20))
        let rouge = last20.filter { $0.color == .rouge }.count
        let noir = last20.filter { $0.color == .noir }.count
        let zero = last20.filter { $0.color == .vert }.count

        return HStack(spacing: 0) {
            statPill(value: "\(rouge)", label: "Rouge", color: .casinoRed)
            statPill(value: "\(noir)", label: "Noir", color: .white)
            statPill(value: "\(zero)", label: "Zéro", color: .casinoGreen)
            statPill(value: "\(vm.spins.count)", label: "Total", color: .casinoGold)
        }
        .padding(.horizontal, 16)
        .padding(.bottom, 4)
    }

    private func statPill(value: String, label: String, color: Color) -> some View {
        VStack(spacing: 1) {
            Text(value)
                .font(.system(size: 16, weight: .black, design: .rounded))
                .foregroundColor(color)
            Text(label)
                .font(.system(size: 9, weight: .medium))
                .foregroundColor(.gray)
        }
        .frame(maxWidth: .infinity)
    }
}
