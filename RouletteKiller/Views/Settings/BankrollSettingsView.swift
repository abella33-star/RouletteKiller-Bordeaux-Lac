import SwiftUI

// MARK: - Sheet Réglage Bankroll
struct BankrollSettingsView: View {
    @ObservedObject var vm: RouletteViewModel
    @Environment(\.dismiss) private var dismiss

    @State private var inputText: String = ""
    @State private var showConfirm = false

    private let quickAmounts: [Double] = [500, 1000, 2000, 5000]

    var body: some View {
        NavigationStack {
            ZStack {
                Color.casinoBackground.ignoresSafeArea()

                ScrollView {
                    VStack(spacing: 24) {
                        // Bankroll actuelle
                        currentBankrollCard

                        // Saisie manuelle
                        manualInputSection

                        // Montants rapides
                        quickAmountsSection

                        // Profil Money Management
                        moneyModeSection

                        // Bouton confirmer
                        confirmButton
                    }
                    .padding(20)
                }
            }
            .navigationTitle("Régler Bankroll")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Fermer") { dismiss() }
                        .foregroundColor(.casinoGold)
                }
            }
        }
    }

    // MARK: - Bankroll actuelle
    private var currentBankrollCard: some View {
        VStack(spacing: 8) {
            Text("BANKROLL ACTUELLE")
                .font(.system(size: 11, weight: .bold))
                .tracking(2)
                .foregroundColor(.gray)

            Text(vm.bankroll.formatted(.currency(code: "EUR")))
                .font(.system(size: 48, weight: .black, design: .rounded))
                .foregroundColor(.casinoGold)

            // Profit/Perte
            HStack(spacing: 8) {
                profitBadge(vm.session.profitLoss, pct: vm.session.profitLossPct)
            }
        }
        .frame(maxWidth: .infinity)
        .padding(20)
        .casinoCard(borderColor: .casinoGold.opacity(0.3))
    }

    // MARK: - Saisie manuelle
    private var manualInputSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Label("Montant personnalisé", systemImage: "keyboard")
                .font(.system(size: 14, weight: .semibold))
                .foregroundColor(.white)

            HStack {
                Text("€")
                    .font(.system(size: 24, weight: .bold))
                    .foregroundColor(.casinoGold)

                TextField("Ex: 1500", text: $inputText)
                    .keyboardType(.decimalPad)
                    .font(.system(size: 28, weight: .black, design: .rounded))
                    .foregroundColor(.white)

                if !inputText.isEmpty {
                    Button { inputText = "" } label: {
                        Image(systemName: "xmark.circle.fill")
                            .foregroundColor(.gray)
                    }
                }
            }
            .padding(16)
            .casinoCard()
        }
    }

    // MARK: - Montants rapides
    private var quickAmountsSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Label("Montants rapides", systemImage: "bolt.fill")
                .font(.system(size: 14, weight: .semibold))
                .foregroundColor(.white)

            LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 10), count: 2), spacing: 10) {
                ForEach(quickAmounts, id: \.self) { amount in
                    Button {
                        inputText = String(Int(amount))
                        let impact = UIImpactFeedbackGenerator(style: .medium)
                        impact.impactOccurred()
                    } label: {
                        VStack(spacing: 4) {
                            Text(amount.formatted(.currency(code: "EUR")))
                                .font(.system(size: 22, weight: .black, design: .rounded))
                                .foregroundColor(.casinoGold)

                            // Mise selon profil
                            let stake = amount * vm.selectedProfile.stakePct
                            Text("Mise: \(stake.formatted(.currency(code: "EUR")))")
                                .font(.system(size: 11))
                                .foregroundColor(.gray)
                        }
                        .frame(maxWidth: .infinity)
                        .frame(height: 70)
                        .casinoCard(borderColor: inputText == String(Int(amount)) ? .casinoGold : .casinoCardBorder)
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    // MARK: - Mode Money Management
    private var moneyModeSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Label("Mode de mise", systemImage: "chart.bar.fill")
                .font(.system(size: 14, weight: .semibold))
                .foregroundColor(.white)

            ForEach(MoneyManagementMode.allCases, id: \.self) { mode in
                Button {
                    vm.moneyMode = mode
                } label: {
                    HStack {
                        Image(systemName: mode.icon)
                            .font(.system(size: 20))
                            .foregroundColor(.casinoGold)
                            .frame(width: 36)

                        VStack(alignment: .leading, spacing: 2) {
                            Text(mode.rawValue)
                                .font(.system(size: 16, weight: .bold))
                                .foregroundColor(.white)
                            Text(mode.description)
                                .font(.system(size: 12))
                                .foregroundColor(.gray)
                        }

                        Spacer()

                        if vm.moneyMode == mode {
                            Image(systemName: "checkmark.circle.fill")
                                .foregroundColor(.casinoGreen)
                                .font(.system(size: 20))
                        }
                    }
                    .padding(14)
                    .casinoCard(borderColor: vm.moneyMode == mode ? .casinoGreen : .casinoCardBorder)
                }
                .buttonStyle(.plain)
            }
        }
    }

    // MARK: - Bouton Confirmer
    private var confirmButton: some View {
        VStack(spacing: 12) {
            Button {
                applyBankroll()
            } label: {
                HStack {
                    Image(systemName: "checkmark.circle.fill")
                        .font(.system(size: 22))
                    Text("CONFIRMER")
                        .font(.system(size: 20, weight: .black))
                        .tracking(2)
                }
                .foregroundColor(.black)
                .casinoButton(color: .casinoGold)
            }
            .disabled(inputText.isEmpty && vm.bankroll > 0)

            Button {
                vm.resetSession()
                dismiss()
            } label: {
                HStack {
                    Image(systemName: "arrow.counterclockwise")
                    Text("Nouvelle Session")
                        .font(.system(size: 16, weight: .semibold))
                }
                .foregroundColor(.casinoRed)
                .frame(maxWidth: .infinity)
                .frame(height: 50)
            }
        }
    }

    // MARK: - Appliquer la bankroll
    private func applyBankroll() {
        if let amount = Double(inputText.replacingOccurrences(of: ",", with: ".")), amount > 0 {
            vm.bankroll = amount
            vm.resetSession()
        }
        let impact = UINotificationFeedbackGenerator()
        impact.notificationOccurred(.success)
        dismiss()
    }

    private func profitBadge(_ profit: Double, pct: Double) -> some View {
        let color: Color = profit >= 0 ? .casinoGreen : .casinoRed
        return HStack(spacing: 4) {
            Image(systemName: profit >= 0 ? "arrow.up.right" : "arrow.down.right")
            Text(String(format: "%+.2f€ (%+.1f%%)", profit, pct))
                .font(.system(size: 14, weight: .bold))
        }
        .foregroundColor(color)
        .padding(.horizontal, 10).padding(.vertical, 4)
        .background(color.opacity(0.1))
        .cornerRadius(8)
    }
}
