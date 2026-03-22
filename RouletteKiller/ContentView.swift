import SwiftUI

// MARK: - Vue Principale ELITE — Session Toujours Gagnante
struct ContentView: View {
    @StateObject private var vm = RouletteViewModel()

    @State private var showBankrollSheet  = false
    @State private var showX2Warning      = false
    @State private var showBacktest       = false
    @State private var blinkOpacity: Double = 1.0

    var body: some View {
        ZStack {
            Color.casinoBackground.ignoresSafeArea()

            if vm.isTiltLocked {
                AntiTiltView(vm: vm)
                    .transition(.opacity)
            } else {
                mainDashboard
            }

            // Célébration Take Profit
            if vm.showCelebration {
                CelebrationView(
                    message: vm.celebrationMessage,
                    session: vm.session
                ) {
                    vm.showCelebration = false
                    vm.resetSession()
                }
                .transition(.scale.combined(with: .opacity))
                .zIndex(100)
            }
        }
        .animation(.easeInOut(duration: 0.3), value: vm.isTiltLocked)
        .animation(.spring(response: 0.5), value: vm.showCelebration)
        .preferredColorScheme(.dark)
        .sheet(isPresented: $showBankrollSheet) {
            BankrollSettingsView(vm: vm)
                .presentationDetents([.medium, .large])
                .presentationDragIndicator(.visible)
        }
        .sheet(isPresented: $showBacktest) {
            BacktestView(vm: vm)
        }
        .alert("Mode X2 Bankroll", isPresented: $showX2Warning) {
            Button(vm.isX2Mode ? "Désactiver" : "Activer ⚠️") { vm.toggleX2Mode() }
            Button("Annuler", role: .cancel) {}
        } message: {
            Text(vm.isX2Mode
                ? "Désactiver le mode X2 ?"
                : "Mode haute intensité — objectif +50%\n3 pertes consécutives = arrêt IMMÉDIAT")
        }
        .alert("🚪 Sors GAGNANT maintenant", isPresented: $vm.showExitAlert) {
            Button("Je pars — J'encaisse ✅") { vm.resetSession() }
            Button("Je reste encore", role: .cancel) {}
        } message: {
            Text("Ton profit est protégé. Si tu continues et que tu perds, tu risques de le perdre.\nLe casino sera là demain.")
        }
    }

    // MARK: - Dashboard Principal
    private var mainDashboard: some View {
        VStack(spacing: 0) {
            BankrollHeaderView(
                vm: vm,
                showBankrollSheet: $showBankrollSheet,
                showX2Warning: $showX2Warning
            )
            MiniStatsBar(session: vm.session)

            ScrollView(.vertical, showsIndicators: false) {
                VStack(spacing: 14) {

                    // ★ PHASE SESSION (priorité absolue en haut)
                    SessionPhaseView(vm: vm)
                        .padding(.horizontal, 16)

                    // ★ SIGNAL DE SORTIE OPTIMAL (si actif)
                    if let signal = vm.exitSignal, vm.exitScore >= 55 {
                        ExitSignalView(signal: signal, exitScore: vm.exitScore) {
                            vm.showCelebration = true
                            vm.celebrationMessage = "🏆 PARTI GAGNANT !"
                        }
                        .padding(.horizontal, 16)
                        .transition(.scale.combined(with: .opacity))
                    }

                    // ★ JAUGE + DÉCISION
                    scoreAndDecisionSection

                    // ★ ANALYSE ROUE ÉLECTRONIQUE
                    SectorHeatmapView(vm: vm)
                        .padding(.horizontal, 16)

                    // ★ SAISIE ULTRA-RAPIDE
                    SpinInputView(vm: vm)
                        .padding(.horizontal, 16)

                    // ★ HISTORIQUE
                    HistoryView(vm: vm)
                        .padding(.horizontal, 16)

                    // ★ PROFILS STRATÉGIQUES
                    StrategyProfilesView(vm: vm)
                        .padding(.horizontal, 16)

                    // ★ PROTECTION PROFIT (si actif)
                    if let lockMsg = vm.profitLockMessage {
                        profitLockBanner(lockMsg)
                            .padding(.horizontal, 16)
                    }

                    // ★ BOUTONS ACTION
                    actionButtons

                    // ★ GAMIFICATION
                    gamificationCard

                    Spacer(minLength: 30)
                }
                .padding(.vertical, 14)
            }
        }
    }

    // MARK: - Section Score + Décision
    private var scoreAndDecisionSection: some View {
        VStack(spacing: 12) {
            ZStack {
                CircularGaugeView(
                    score: vm.currentDecision?.opportunityScore ?? 0,
                    isAnimating: true
                )

                if vm.isX2Mode { x2Badge }
            }
            .frame(height: 280)

            // Phrase marché
            if let decision = vm.currentDecision {
                Text(OpportunityScoreEngine.marketPhrase(score: decision.opportunityScore))
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundColor(.white.opacity(0.85))
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 20)

                DecisionCardView(decision: decision, session: vm.session)
                    .padding(.horizontal, 16)
            } else {
                calibrationPrompt
            }
        }
    }

    // MARK: - Invite calibration
    private var calibrationPrompt: some View {
        VStack(spacing: 12) {
            Image(systemName: "binoculars.fill")
                .font(.system(size: 40))
                .foregroundColor(.gray)
            Text("Calibration en cours…")
                .font(.system(size: 18, weight: .bold))
                .foregroundColor(.gray)
            Text("Saisis \(max(0, 15 - vm.spins.count)) numéros supplémentaires\nsans miser pour activer les moteurs")
                .font(.system(size: 14))
                .foregroundColor(.gray.opacity(0.7))
                .multilineTextAlignment(.center)

            // Barre calibration
            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    RoundedRectangle(cornerRadius: 4).fill(Color.casinoGray).frame(height: 6)
                    RoundedRectangle(cornerRadius: 4)
                        .fill(Color.casinoGold)
                        .frame(width: geo.size.width * min(1, Double(vm.spins.count) / 15), height: 6)
                }
            }
            .frame(height: 6)
            .padding(.horizontal, 30)
        }
        .padding(.vertical, 20)
        .frame(maxWidth: .infinity)
        .casinoCard()
        .padding(.horizontal, 16)
    }

    // MARK: - Bannière Protection Profit
    private func profitLockBanner(_ message: String) -> some View {
        HStack(spacing: 10) {
            Image(systemName: "lock.shield.fill")
                .font(.system(size: 22))
                .foregroundColor(.casinoGold)
            Text(message)
                .font(.system(size: 13, weight: .semibold))
                .foregroundColor(.casinoGold)
            Spacer()
        }
        .padding(12)
        .background(Color.casinoGold.opacity(0.08))
        .cornerRadius(12)
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(Color.casinoGold.opacity(0.4), lineWidth: 1)
        )
    }

    // MARK: - Badge X2 clignotant
    private var x2Badge: some View {
        VStack {
            HStack {
                Spacer()
                HStack(spacing: 4) {
                    Image(systemName: "multiply.circle.fill").font(.system(size: 14))
                    Text("MODE X2").font(.system(size: 12, weight: .black)).tracking(1)
                }
                .foregroundColor(.white)
                .padding(.horizontal, 10).padding(.vertical, 5)
                .background(Color.casinoRed)
                .cornerRadius(10)
                .shadow(color: .casinoRed.opacity(0.6), radius: 6)
                .opacity(blinkOpacity)
                .onAppear {
                    withAnimation(.easeInOut(duration: 0.6).repeatForever(autoreverses: true)) {
                        blinkOpacity = 0.3
                    }
                }
                .padding(.trailing, 10)
            }
            Spacer()
        }
    }

    // MARK: - Boutons d'action
    private var actionButtons: some View {
        HStack(spacing: 12) {
            Button { showBacktest = true } label: {
                VStack(spacing: 6) {
                    Image(systemName: "chart.xyaxis.line").font(.system(size: 28))
                    Text("SIMULER").font(.system(size: 13, weight: .black)).tracking(1)
                }
                .foregroundColor(.casinoGold)
                .frame(maxWidth: .infinity).frame(height: 80)
                .background(Color.casinoGold.opacity(0.08)).cornerRadius(14)
                .overlay(RoundedRectangle(cornerRadius: 14).stroke(Color.casinoGold.opacity(0.3), lineWidth: 1))
            }

            Button {
                vm.resetSession()
                UINotificationFeedbackGenerator().notificationOccurred(.warning)
            } label: {
                VStack(spacing: 6) {
                    Image(systemName: "arrow.counterclockwise.circle.fill").font(.system(size: 28))
                    Text("RESET").font(.system(size: 13, weight: .black)).tracking(1)
                }
                .foregroundColor(.casinoOrange)
                .frame(maxWidth: .infinity).frame(height: 80)
                .background(Color.casinoOrange.opacity(0.08)).cornerRadius(14)
                .overlay(RoundedRectangle(cornerRadius: 14).stroke(Color.casinoOrange.opacity(0.3), lineWidth: 1))
            }
        }
        .padding(.horizontal, 16)
    }

    // MARK: - Gamification
    private var gamificationCard: some View {
        HStack(spacing: 0) {
            gamCell(icon: "flame.fill", value: "\(vm.streakSessions)",
                    label: "Streak", color: .casinoOrange)
            Divider().background(Color.casinoCardBorder).frame(height: 50)
            gamCell(icon: "brain.fill", value: "\(Int(vm.session.disciplineScore))",
                    label: "Discipline", color: disciplineColor)
            Divider().background(Color.casinoCardBorder).frame(height: 50)
            gamCell(icon: playerLevelIcon, value: playerLevel,
                    label: "Niveau", color: .casinoGold)
            Divider().background(Color.casinoCardBorder).frame(height: 50)
            gamCell(icon: "crown.fill", value: "\(Int(vm.exitScore))",
                    label: "Exit Score", color: vm.exitScore >= 60 ? .casinoGold : .gray)
        }
        .padding(.vertical, 12)
        .casinoCard(borderColor: .casinoGold.opacity(0.2))
        .padding(.horizontal, 16)
    }

    private func gamCell(icon: String, value: String, label: String, color: Color) -> some View {
        VStack(spacing: 3) {
            Image(systemName: icon).font(.system(size: 18)).foregroundColor(color)
            Text(value).font(.system(size: 18, weight: .black, design: .rounded)).foregroundColor(color)
            Text(label).font(.system(size: 9)).foregroundColor(.gray)
        }
        .frame(maxWidth: .infinity)
    }

    private var disciplineColor: Color {
        vm.session.disciplineScore >= 70 ? .casinoGreen :
        vm.session.disciplineScore >= 40 ? .casinoOrange : .casinoRed
    }

    private var playerLevel: String {
        switch vm.streakSessions {
        case 0..<3:  return "ROOKIE"
        case 3..<7:  return "PRO"
        case 7..<15: return "ELITE"
        default:     return "KILLER"
        }
    }

    private var playerLevelIcon: String {
        switch vm.streakSessions {
        case 0..<3:  return "person.fill"
        case 3..<7:  return "star.fill"
        case 7..<15: return "crown.fill"
        default:     return "bolt.shield.fill"
        }
    }
}

#Preview {
    ContentView().preferredColorScheme(.dark)
}
