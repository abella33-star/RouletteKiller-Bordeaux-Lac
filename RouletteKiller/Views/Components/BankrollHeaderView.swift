import SwiftUI

// MARK: - En-tête Bankroll (haut d'écran)
struct BankrollHeaderView: View {
    @ObservedObject var vm: RouletteViewModel
    @Binding var showBankrollSheet: Bool
    @Binding var showX2Warning: Bool

    var profitColor: Color {
        vm.session.profitLoss > 0 ? .casinoGreen :
        vm.session.profitLoss < 0 ? .casinoRed : .gray
    }

    var body: some View {
        HStack(alignment: .center, spacing: 12) {
            // Bankroll principale
            VStack(alignment: .leading, spacing: 2) {
                Text("BANKROLL")
                    .font(.system(size: 10, weight: .semibold))
                    .foregroundColor(.gray)
                    .tracking(1.5)

                Text(vm.bankroll.formatted(.currency(code: "EUR")))
                    .font(.system(size: 28, weight: .black, design: .rounded))
                    .foregroundColor(.white)
                    .contentTransition(.numericText())
            }

            Spacer()

            // Profit/Perte session
            VStack(alignment: .center, spacing: 2) {
                Text("SESSION")
                    .font(.system(size: 10, weight: .semibold))
                    .foregroundColor(.gray)
                    .tracking(1.5)

                HStack(spacing: 4) {
                    Image(systemName: vm.session.profitLoss >= 0 ? "arrow.up.right" : "arrow.down.right")
                        .font(.system(size: 12, weight: .bold))
                    Text(String(format: "%+.1f%%", vm.session.profitLossPct))
                        .font(.system(size: 22, weight: .black, design: .rounded))
                }
                .foregroundColor(profitColor)
            }

            Spacer()

            // Boutons d'action
            HStack(spacing: 10) {
                // Bouton Mode X2
                Button {
                    showX2Warning = true
                } label: {
                    VStack(spacing: 2) {
                        Image(systemName: "multiply.circle.fill")
                            .font(.system(size: 22))
                        Text("X2")
                            .font(.system(size: 9, weight: .black))
                    }
                    .foregroundColor(vm.isX2Mode ? .white : .casinoRed)
                    .frame(width: 50, height: 50)
                    .background(vm.isX2Mode ? Color.casinoRed : Color.casinoRed.opacity(0.15))
                    .cornerRadius(12)
                    .overlay(
                        RoundedRectangle(cornerRadius: 12)
                            .stroke(Color.casinoRed, lineWidth: vm.isX2Mode ? 2 : 1)
                    )
                }

                // Bouton Régler Bankroll
                Button {
                    showBankrollSheet = true
                } label: {
                    VStack(spacing: 2) {
                        Image(systemName: "eurosign.circle.fill")
                            .font(.system(size: 22))
                        Text("MISE")
                            .font(.system(size: 9, weight: .black))
                    }
                    .foregroundColor(.casinoGold)
                    .frame(width: 50, height: 50)
                    .background(Color.casinoGold.opacity(0.15))
                    .cornerRadius(12)
                    .overlay(
                        RoundedRectangle(cornerRadius: 12)
                            .stroke(Color.casinoGold.opacity(0.5), lineWidth: 1)
                    )
                }
            }
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 12)
        .background(Color.casinoCard)
    }
}

// MARK: - Stats mini-bar
struct MiniStatsBar: View {
    let session: SessionStats

    var body: some View {
        HStack(spacing: 0) {
            miniStat(
                value: "\(session.wins)W / \(session.losses)L",
                icon: "chart.bar.fill",
                color: .casinoGold
            )
            Divider().background(Color.casinoCardBorder).frame(height: 20)
            miniStat(
                value: "\(Int(session.winRate))%",
                icon: "percent",
                color: .casinoGreen
            )
            Divider().background(Color.casinoCardBorder).frame(height: 20)
            miniStat(
                value: "\(Int(session.disciplineScore))",
                icon: "brain.fill",
                color: session.disciplineScore >= 70 ? .casinoGreen : .casinoOrange
            )
            Divider().background(Color.casinoCardBorder).frame(height: 20)
            miniStat(
                value: "\(session.consecutiveLosses)x🔴",
                icon: "exclamationmark.triangle.fill",
                color: session.consecutiveLosses >= 3 ? .casinoRed : .gray
            )
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 8)
        .background(Color.casinoBackground)
    }

    private func miniStat(value: String, icon: String, color: Color) -> some View {
        HStack(spacing: 4) {
            Image(systemName: icon)
                .font(.system(size: 11))
                .foregroundColor(color)
            Text(value)
                .font(.system(size: 12, weight: .semibold, design: .rounded))
                .foregroundColor(.white)
        }
        .frame(maxWidth: .infinity)
    }
}
