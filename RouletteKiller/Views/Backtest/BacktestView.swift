import SwiftUI

// MARK: - Vue Backtest (simulation sur 50 derniers spins)
struct BacktestView: View {
    @ObservedObject var vm: RouletteViewModel
    @Environment(\.dismiss) private var dismiss

    @State private var results: [BacktestResult] = []
    @State private var isRunning = false

    var body: some View {
        NavigationStack {
            ZStack {
                Color.casinoBackground.ignoresSafeArea()

                ScrollView {
                    VStack(spacing: 20) {
                        // En-tête info
                        infoCard

                        if isRunning {
                            loadingView
                        } else if results.isEmpty {
                            emptyState
                        } else {
                            // Résultats
                            ForEach(results.sorted(by: { $0.roi > $1.roi })) { result in
                                backtestResultCard(result)
                            }

                            // Meilleur profil
                            if let best = results.sorted(by: { $0.roi > $1.roi }).first {
                                bestProfileBanner(best)
                            }
                        }
                    }
                    .padding(20)
                }
            }
            .navigationTitle("Backtest Live")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Fermer") { dismiss() }
                        .foregroundColor(.casinoGold)
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        runBacktest()
                    } label: {
                        Label("Simuler", systemImage: "play.circle.fill")
                            .foregroundColor(.casinoGreen)
                    }
                    .disabled(vm.spins.count < 15 || isRunning)
                }
            }
        }
    }

    // MARK: - Carte info
    private var infoCard: some View {
        HStack(spacing: 12) {
            Image(systemName: "info.circle.fill")
                .font(.system(size: 24))
                .foregroundColor(.casinoGold)

            VStack(alignment: .leading, spacing: 4) {
                Text("Simulation sur \(min(vm.spins.count, 50)) derniers spins")
                    .font(.system(size: 14, weight: .bold))
                    .foregroundColor(.white)
                Text("Compare les 3 profils sur données réelles")
                    .font(.system(size: 12))
                    .foregroundColor(.gray)
            }
            Spacer()
            Text("\(vm.spins.count) spins")
                .font(.system(size: 14, weight: .black))
                .foregroundColor(.casinoGold)
        }
        .padding(16)
        .casinoCard(borderColor: .casinoGold.opacity(0.3))
    }

    // MARK: - Chargement
    private var loadingView: some View {
        VStack(spacing: 16) {
            ProgressView()
                .progressViewStyle(CircularProgressViewStyle(tint: .casinoGreen))
                .scaleEffect(1.5)
            Text("Simulation en cours...")
                .font(.system(size: 16, weight: .semibold))
                .foregroundColor(.gray)
        }
        .frame(maxWidth: .infinity)
        .padding(40)
    }

    // MARK: - État vide
    private var emptyState: some View {
        VStack(spacing: 16) {
            Image(systemName: "chart.bar.xaxis")
                .font(.system(size: 48))
                .foregroundColor(.gray)
            Text("Appuie sur SIMULER")
                .font(.system(size: 20, weight: .bold))
                .foregroundColor(.white)
            Text("Min. 15 spins requis (\(vm.spins.count) actuels)")
                .font(.system(size: 14))
                .foregroundColor(.gray)

            if vm.spins.count >= 15 {
                Button { runBacktest() } label: {
                    Label("SIMULER", systemImage: "play.circle.fill")
                        .font(.system(size: 18, weight: .black))
                        .foregroundColor(.black)
                        .casinoButton(color: .casinoGreen)
                }
            }
        }
        .frame(maxWidth: .infinity)
        .padding(40)
    }

    // MARK: - Carte résultat
    private func backtestResultCard(_ result: BacktestResult) -> some View {
        let profColor = Color(hex: result.profile.color)

        return VStack(spacing: 12) {
            // En-tête profil
            HStack {
                Image(systemName: result.profile.icon)
                    .font(.system(size: 22))
                    .foregroundColor(profColor)

                Text(result.profile.rawValue)
                    .font(.system(size: 18, weight: .black))
                    .foregroundColor(profColor)

                Spacer()

                // ROI badge
                Text(String(format: "%+.1f%%", result.roi))
                    .font(.system(size: 20, weight: .black, design: .rounded))
                    .foregroundColor(result.isPositive ? .casinoGreen : .casinoRed)
                    .padding(.horizontal, 10).padding(.vertical, 4)
                    .background((result.isPositive ? Color.casinoGreen : Color.casinoRed).opacity(0.15))
                    .cornerRadius(8)
            }

            // Métriques
            HStack(spacing: 0) {
                metricCell(
                    value: String(format: "%.0f%%", result.winRate),
                    label: "Win Rate",
                    color: result.winRate >= 30 ? .casinoGreen : .casinoOrange
                )
                Divider().background(Color.casinoCardBorder).frame(height: 35)
                metricCell(
                    value: "\(result.totalTrades)",
                    label: "Trades",
                    color: .casinoGold
                )
                Divider().background(Color.casinoCardBorder).frame(height: 35)
                metricCell(
                    value: String(format: "%.1f%%", result.maxDrawdown),
                    label: "Drawdown",
                    color: result.maxDrawdown > 20 ? .casinoRed : .casinoOrange
                )
                Divider().background(Color.casinoCardBorder).frame(height: 35)
                metricCell(
                    value: result.finalBankroll.formatted(.currency(code: "EUR")),
                    label: "Final",
                    color: result.isPositive ? .casinoGreen : .casinoRed
                )
            }

            // Barre de profit/perte
            profitBar(result: result)
        }
        .padding(16)
        .casinoCard(borderColor: profColor.opacity(0.3))
    }

    // MARK: - Barre profit
    private func profitBar(result: BacktestResult) -> some View {
        GeometryReader { geo in
            ZStack(alignment: .leading) {
                RoundedRectangle(cornerRadius: 4)
                    .fill(Color.casinoGray)
                    .frame(height: 8)

                RoundedRectangle(cornerRadius: 4)
                    .fill(result.isPositive ? Color.casinoGreen : Color.casinoRed)
                    .frame(
                        width: min(geo.size.width, geo.size.width * abs(result.roi) / 50),
                        height: 8
                    )
            }
        }
        .frame(height: 8)
    }

    // MARK: - Bannière meilleur profil
    private func bestProfileBanner(_ result: BacktestResult) -> some View {
        let color = Color(hex: result.profile.color)
        return HStack(spacing: 12) {
            Image(systemName: "trophy.fill")
                .font(.system(size: 28))
                .foregroundColor(.casinoGold)

            VStack(alignment: .leading, spacing: 2) {
                Text("MEILLEUR PROFIL SIMULÉ")
                    .font(.system(size: 11, weight: .black))
                    .tracking(1.5)
                    .foregroundColor(.gray)
                Text(result.profile.rawValue)
                    .font(.system(size: 20, weight: .black))
                    .foregroundColor(color)
            }

            Spacer()

            Text(String(format: "%+.1f%%", result.roi))
                .font(.system(size: 24, weight: .black, design: .rounded))
                .foregroundColor(.casinoGold)
        }
        .padding(16)
        .background(Color.casinoGold.opacity(0.06))
        .cornerRadius(14)
        .overlay(
            RoundedRectangle(cornerRadius: 14)
                .stroke(Color.casinoGold.opacity(0.3), lineWidth: 2)
        )
    }

    private func metricCell(value: String, label: String, color: Color) -> some View {
        VStack(spacing: 2) {
            Text(value)
                .font(.system(size: 14, weight: .black, design: .rounded))
                .foregroundColor(color)
            Text(label)
                .font(.system(size: 9))
                .foregroundColor(.gray)
        }
        .frame(maxWidth: .infinity)
    }

    // MARK: - Lancer le backtest
    private func runBacktest() {
        isRunning = true
        Task {
            try? await Task.sleep(nanoseconds: 500_000_000)  // 0.5s UX
            results = vm.runBacktest()
            isRunning = false
        }
    }
}
