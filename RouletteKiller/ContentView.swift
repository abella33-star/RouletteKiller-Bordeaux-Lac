import SwiftUI

// MARK: - Vue Principale (Écran Unique)
struct ContentView: View {
    @StateObject private var vm = RouletteViewModel()

    @State private var showBankrollSheet = false
    @State private var showX2Warning = false
    @State private var showBacktest = false
    @State private var showStrategySheet = false

    var body: some View {
        ZStack {
            // Fond casino noir profond
            Color.casinoBackground.ignoresSafeArea()

            if vm.isTiltLocked {
                // Écran anti-tilt bloquant
                AntiTiltView(vm: vm)
                    .transition(.opacity)
            } else {
                mainDashboard
            }

            // Overlay félicitations
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
            Button(vm.isX2Mode ? "Désactiver" : "Activer ⚠️") {
                vm.toggleX2Mode()
            }
            Button("Annuler", role: .cancel) {}
        } message: {
            Text(vm.isX2Mode
                ? "Désactiver le mode X2 Bankroll ?"
                : "ATTENTION : Mode haute intensité.\nObjectif +50% bankroll.\nArrêt IMMÉDIAT si 3 pertes consécutives.\nRisque élevé — Experts uniquement."
            )
        }
    }

    // MARK: - Dashboard principal
    private var mainDashboard: some View {
        VStack(spacing: 0) {
            // EN-TÊTE : Bankroll + Boutons
            BankrollHeaderView(
                vm: vm,
                showBankrollSheet: $showBankrollSheet,
                showX2Warning: $showX2Warning
            )

            // Mini-stats bar
            MiniStatsBar(session: vm.session)

            // CONTENU SCROLLABLE
            ScrollView(.vertical, showsIndicators: false) {
                VStack(spacing: 14) {
                    // Jauge + Décision principale
                    scoreAndDecisionSection

                    // Saisie rapide des spins
                    SpinInputView(vm: vm)
                        .padding(.horizontal, 16)

                    // Historique
                    HistoryView(vm: vm)
                        .padding(.horizontal, 16)

                    // Profils stratégiques
                    StrategyProfilesView(vm: vm)
                        .padding(.horizontal, 16)

                    // Actions secondaires
                    actionButtons

                    // Gamification
                    gamificationCard

                    Spacer(minLength: 30)
                }
                .padding(.vertical, 14)
            }
        }
    }

    // MARK: - Section Score + Décision
    private var scoreAndDecisionSection: some View {
        VStack(spacing: 14) {
            // Jauge circulaire géante
            ZStack {
                CircularGaugeView(
                    score: vm.currentDecision?.opportunityScore ?? 0,
                    isAnimating: true
                )

                // Mode X2 warning clignotant
                if vm.isX2Mode {
                    VStack {
                        HStack {
                            Spacer()
                            x2Badge
                                .padding(.trailing, -10)
                        }
                        Spacer()
                    }
                }
            }
            .frame(height: 280)

            // Phrase de marché
            if let decision = vm.currentDecision {
                Text(OpportunityScoreEngine.marketPhrase(score: decision.opportunityScore))
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundColor(.white.opacity(0.85))
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 20)

                // Carte de décision
                DecisionCardView(decision: decision, session: vm.session)
                    .padding(.horizontal, 16)
            } else {
                Text("Ajoute des spins pour commencer")
                    .font(.system(size: 15))
                    .foregroundColor(.gray)
            }
        }
    }

    // MARK: - Badge X2 Clignotant
    private var x2Badge: some View {
        HStack(spacing: 4) {
            Image(systemName: "multiply.circle.fill")
                .font(.system(size: 14))
            Text("MODE X2")
                .font(.system(size: 12, weight: .black))
                .tracking(1)
        }
        .foregroundColor(.white)
        .padding(.horizontal, 10).padding(.vertical, 5)
        .background(Color.casinoRed)
        .cornerRadius(10)
        .shadow(color: .casinoRed.opacity(0.6), radius: 6)
        .opacity(blinkOpacity)
        .onAppear { startBlink() }
    }

    @State private var blinkOpacity: Double = 1.0

    private func startBlink() {
        withAnimation(.easeInOut(duration: 0.6).repeatForever(autoreverses: true)) {
            blinkOpacity = 0.3
        }
    }

    // MARK: - Boutons d'action
    private var actionButtons: some View {
        HStack(spacing: 12) {
            // Backtest
            Button {
                showBacktest = true
            } label: {
                VStack(spacing: 6) {
                    Image(systemName: "chart.xyaxis.line")
                        .font(.system(size: 28))
                    Text("SIMULER")
                        .font(.system(size: 13, weight: .black))
                        .tracking(1)
                }
                .foregroundColor(.casinoGold)
                .frame(maxWidth: .infinity)
                .frame(height: 80)
                .background(Color.casinoGold.opacity(0.08))
                .cornerRadius(14)
                .overlay(
                    RoundedRectangle(cornerRadius: 14)
                        .stroke(Color.casinoGold.opacity(0.3), lineWidth: 1)
                )
            }

            // Reset session
            Button {
                vm.resetSession()
                let impact = UINotificationFeedbackGenerator()
                impact.notificationOccurred(.warning)
            } label: {
                VStack(spacing: 6) {
                    Image(systemName: "arrow.counterclockwise.circle.fill")
                        .font(.system(size: 28))
                    Text("RESET")
                        .font(.system(size: 13, weight: .black))
                        .tracking(1)
                }
                .foregroundColor(.casinoOrange)
                .frame(maxWidth: .infinity)
                .frame(height: 80)
                .background(Color.casinoOrange.opacity(0.08))
                .cornerRadius(14)
                .overlay(
                    RoundedRectangle(cornerRadius: 14)
                        .stroke(Color.casinoOrange.opacity(0.3), lineWidth: 1)
                )
            }
        }
        .padding(.horizontal, 16)
    }

    // MARK: - Gamification
    private var gamificationCard: some View {
        HStack(spacing: 16) {
            // Streak sessions
            VStack(spacing: 4) {
                Image(systemName: "flame.fill")
                    .font(.system(size: 24))
                    .foregroundColor(.casinoOrange)
                Text("\(vm.streakSessions)")
                    .font(.system(size: 28, weight: .black, design: .rounded))
                    .foregroundColor(.casinoOrange)
                Text("Streak")
                    .font(.system(size: 11))
                    .foregroundColor(.gray)
            }
            .frame(maxWidth: .infinity)

            Divider().background(Color.casinoCardBorder).frame(height: 50)

            // Score discipline
            VStack(spacing: 4) {
                Image(systemName: "brain.fill")
                    .font(.system(size: 24))
                    .foregroundColor(disciplineColor)
                Text("\(Int(vm.session.disciplineScore))")
                    .font(.system(size: 28, weight: .black, design: .rounded))
                    .foregroundColor(disciplineColor)
                Text("Discipline")
                    .font(.system(size: 11))
                    .foregroundColor(.gray)
            }
            .frame(maxWidth: .infinity)

            Divider().background(Color.casinoCardBorder).frame(height: 50)

            // Niveau joueur
            VStack(spacing: 4) {
                Image(systemName: playerLevelIcon)
                    .font(.system(size: 24))
                    .foregroundColor(.casinoGold)
                Text(playerLevel)
                    .font(.system(size: 16, weight: .black))
                    .foregroundColor(.casinoGold)
                Text("Niveau")
                    .font(.system(size: 11))
                    .foregroundColor(.gray)
            }
            .frame(maxWidth: .infinity)
        }
        .padding(16)
        .casinoCard(borderColor: .casinoGold.opacity(0.2))
        .padding(.horizontal, 16)
    }

    private var disciplineColor: Color {
        vm.session.disciplineScore >= 70 ? .casinoGreen :
        vm.session.disciplineScore >= 40 ? .casinoOrange : .casinoRed
    }

    private var playerLevel: String {
        switch vm.streakSessions {
        case 0..<3:   return "ROOKIE"
        case 3..<7:   return "PRO"
        case 7..<15:  return "ELITE"
        default:      return "KILLER"
        }
    }

    private var playerLevelIcon: String {
        switch vm.streakSessions {
        case 0..<3:   return "person.fill"
        case 3..<7:   return "star.fill"
        case 7..<15:  return "crown.fill"
        default:      return "bolt.shield.fill"
        }
    }
}

// MARK: - Preview
#Preview {
    ContentView()
        .preferredColorScheme(.dark)
}
