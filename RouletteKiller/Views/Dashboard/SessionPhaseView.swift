import SwiftUI

// MARK: - Vue Phase de Session + Plan Garanti
// Affiche la phase actuelle et l'instruction exacte à suivre
struct SessionPhaseView: View {
    @ObservedObject var vm: RouletteViewModel

    @State private var pulseScale: CGFloat = 1.0

    var body: some View {
        VStack(spacing: 0) {
            // Bandeau phase (toujours visible, gros et clair)
            phaseBanner

            if let plan = vm.sessionPlan {
                planDetails(plan)
            }
        }
        .background(Color.casinoCard)
        .cornerRadius(16)
        .overlay(
            RoundedRectangle(cornerRadius: 16)
                .stroke(phaseColor.opacity(0.4), lineWidth: 2)
        )
        .shadow(color: phaseColor.opacity(0.15), radius: 10)
    }

    // MARK: - Bandeau principal de phase
    private var phaseBanner: some View {
        HStack(spacing: 14) {
            // Icône phase
            Image(systemName: vm.sessionPhase.icon)
                .font(.system(size: 32))
                .foregroundColor(phaseColor)
                .scaleEffect(pulseScale)
                .onAppear { animatePulse() }
                .onChange(of: vm.sessionPhase) { _, _ in animatePulse() }

            VStack(alignment: .leading, spacing: 4) {
                // Nom de la phase
                Text(vm.sessionPhase.rawValue)
                    .font(.system(size: 11, weight: .black))
                    .tracking(3)
                    .foregroundColor(phaseColor.opacity(0.8))

                // Instruction principale
                Text(vm.sessionPhase.instruction)
                    .font(.system(size: 15, weight: .bold))
                    .foregroundColor(.white)
                    .lineLimit(2)
                    .fixedSize(horizontal: false, vertical: true)
            }

            Spacer()

            // Indicateur progression session
            sessionProgressCircle
        }
        .padding(16)
        .background(phaseColor.opacity(0.08))
    }

    // MARK: - Détails du plan
    private func planDetails(_ plan: SessionGuaranteeEngine.SessionPlan) -> some View {
        VStack(spacing: 0) {
            Divider().background(Color.casinoCardBorder)

            // Mise + Système
            HStack(spacing: 0) {
                planCell(
                    icon: "eurosign.circle.fill",
                    value: plan.currentStake > 0
                        ? plan.currentStake.formatted(.currency(code: "EUR"))
                        : "PAUSE",
                    label: "Mise maintenant",
                    color: plan.currentStake > 0 ? phaseColor : .gray
                )
                Divider().background(Color.casinoCardBorder).frame(height: 45)
                planCell(
                    icon: plan.progressionSystem.icon,
                    value: plan.progressionSystem.rawValue,
                    label: "Système",
                    color: .casinoGold
                )
                Divider().background(Color.casinoCardBorder).frame(height: 45)
                planCell(
                    icon: "flag.fill",
                    value: plan.targetProfit.formatted(.currency(code: "EUR")),
                    label: "Objectif",
                    color: .casinoGreen
                )
            }
            .padding(.vertical, 6)

            Divider().background(Color.casinoCardBorder)

            // Barre de progression vers l'objectif
            progressBar(plan: plan)
                .padding(.horizontal, 16)
                .padding(.vertical, 10)
        }
    }

    // MARK: - Barre progression profit
    private func progressBar(plan: SessionGuaranteeEngine.SessionPlan) -> some View {
        let progress = plan.targetProfit > 0
            ? min(1.0, max(0, vm.session.profitLoss / plan.targetProfit))
            : 0.0
        let pct = Int(progress * 100)

        return VStack(spacing: 4) {
            HStack {
                Text("Progression vers l'objectif")
                    .font(.system(size: 11))
                    .foregroundColor(.gray)
                Spacer()
                Text("\(pct)%")
                    .font(.system(size: 12, weight: .bold))
                    .foregroundColor(progress >= 1 ? .casinoGreen : phaseColor)
            }
            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    RoundedRectangle(cornerRadius: 4)
                        .fill(Color.casinoGray)
                        .frame(height: 8)
                    RoundedRectangle(cornerRadius: 4)
                        .fill(LinearGradient(
                            colors: [phaseColor.opacity(0.7), phaseColor],
                            startPoint: .leading,
                            endPoint: .trailing
                        ))
                        .frame(width: max(0, geo.size.width * progress), height: 8)
                        .animation(.spring(response: 0.5), value: progress)
                }
            }
            .frame(height: 8)

            // Seuil minimum (plancher de sortie)
            HStack {
                Image(systemName: "lock.fill")
                    .font(.system(size: 9))
                    .foregroundColor(.casinoGold)
                Text("Plancher protégé: \(plan.minimumExit.formatted(.currency(code: "EUR")))")
                    .font(.system(size: 10))
                    .foregroundColor(.casinoGold.opacity(0.7))
            }
        }
    }

    // MARK: - Cercle progression session
    private var sessionProgressCircle: some View {
        ZStack {
            Circle()
                .stroke(Color.casinoGray, lineWidth: 4)
                .frame(width: 54, height: 54)

            Circle()
                .trim(from: 0, to: min(1, max(0, vm.session.profitLossPct / 20)))
                .stroke(phaseColor, style: StrokeStyle(lineWidth: 4, lineCap: .round))
                .frame(width: 54, height: 54)
                .rotationEffect(.degrees(-90))

            VStack(spacing: 0) {
                Text(String(format: "%+.0f", vm.session.profitLossPct))
                    .font(.system(size: 13, weight: .black, design: .rounded))
                    .foregroundColor(.white)
                Text("%")
                    .font(.system(size: 9))
                    .foregroundColor(.gray)
            }
        }
    }

    private var phaseColor: Color {
        Color(hex: vm.sessionPhase.color)
    }

    private func planCell(icon: String, value: String, label: String, color: Color) -> some View {
        VStack(spacing: 3) {
            Image(systemName: icon)
                .font(.system(size: 13))
                .foregroundColor(color)
            Text(value)
                .font(.system(size: 12, weight: .black, design: .rounded))
                .foregroundColor(color)
                .lineLimit(1)
                .minimumScaleFactor(0.7)
            Text(label)
                .font(.system(size: 9))
                .foregroundColor(.gray)
        }
        .frame(maxWidth: .infinity)
    }

    private func animatePulse() {
        withAnimation(.easeInOut(duration: 1.0).repeatCount(3, autoreverses: true)) {
            pulseScale = 1.2
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
            pulseScale = 1.0
        }
    }
}

// MARK: - Signal de Sortie Optimal
struct ExitSignalView: View {
    let signal: ProfitLockEngine.ExitSignal
    let exitScore: Double
    var onExit: () -> Void

    @State private var blinkOn = true

    var body: some View {
        VStack(spacing: 12) {
            // En-tête urgence
            HStack(spacing: 10) {
                Image(systemName: signal.urgency == .high ? "flag.checkered.2.crossed" : "flag.fill")
                    .font(.system(size: 26))
                    .foregroundColor(.casinoGold)
                    .opacity(blinkOn ? 1 : 0.3)
                    .onAppear {
                        withAnimation(.easeInOut(duration: 0.7).repeatForever(autoreverses: true)) {
                            blinkOn = false
                        }
                    }

                VStack(alignment: .leading, spacing: 2) {
                    Text(signal.urgency == .high ? "SORTIE OPTIMALE" : "SIGNAL DE SORTIE")
                        .font(.system(size: 13, weight: .black))
                        .tracking(2)
                        .foregroundColor(.casinoGold)
                    Text(signal.message)
                        .font(.system(size: 13))
                        .foregroundColor(.white)
                        .lineLimit(2)
                }
            }

            // Score de sortie
            HStack(spacing: 12) {
                VStack(spacing: 2) {
                    Text("\(Int(exitScore))")
                        .font(.system(size: 28, weight: .black, design: .rounded))
                        .foregroundColor(.casinoGold)
                    Text("Exit Score")
                        .font(.system(size: 10))
                        .foregroundColor(.gray)
                }

                VStack(spacing: 2) {
                    Text(signal.profit.formatted(.currency(code: "EUR")))
                        .font(.system(size: 22, weight: .black))
                        .foregroundColor(.casinoGreen)
                    Text("Profit à encaisser")
                        .font(.system(size: 10))
                        .foregroundColor(.gray)
                }
                .frame(maxWidth: .infinity, alignment: .center)

                Button {
                    onExit()
                } label: {
                    VStack(spacing: 2) {
                        Image(systemName: "door.right.hand.open")
                            .font(.system(size: 22))
                        Text("PARTIR")
                            .font(.system(size: 11, weight: .black))
                    }
                    .foregroundColor(.black)
                    .frame(width: 70, height: 60)
                    .background(Color.casinoGold)
                    .cornerRadius(12)
                    .shadow(color: Color.casinoGold.opacity(0.5), radius: 8)
                }
            }
        }
        .padding(16)
        .background(Color.casinoGold.opacity(0.06))
        .cornerRadius(14)
        .overlay(
            RoundedRectangle(cornerRadius: 14)
                .stroke(Color.casinoGold, lineWidth: 2)
        )
    }
}
