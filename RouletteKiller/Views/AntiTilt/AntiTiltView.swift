import SwiftUI

// MARK: - Écran Anti-Tilt + Cooldown Bloquant
struct AntiTiltView: View {
    @ObservedObject var vm: RouletteViewModel
    @State private var shakeOffset: CGFloat = 0
    @State private var pulseOpacity: Double = 0.3

    var body: some View {
        ZStack {
            Color.black.opacity(0.95).ignoresSafeArea()

            VStack(spacing: 32) {
                // Icône principale
                Image(systemName: "brain.head.profile")
                    .font(.system(size: 80))
                    .foregroundColor(.casinoRed)
                    .offset(x: shakeOffset)
                    .animation(
                        .easeInOut(duration: 0.07).repeatCount(6, autoreverses: true),
                        value: shakeOffset
                    )

                // Titre
                Text("PAUSE OBLIGATOIRE")
                    .font(.system(size: 28, weight: .black))
                    .tracking(3)
                    .foregroundColor(.white)

                // Message psychologique
                Text("Conditions défavorables\nPause requise")
                    .font(.system(size: 18, weight: .medium))
                    .foregroundColor(.gray)
                    .multilineTextAlignment(.center)
                    .lineSpacing(6)

                // Timer
                timerDisplay

                // Conseil
                adviceCard

                // Bouton urgence (shake)
                if vm.tiltCooldownRemaining > 60 {
                    emergencyHint
                }
            }
            .padding(30)
        }
        .onAppear {
            startShake()
            startPulse()
        }
    }

    // MARK: - Affichage Timer
    private var timerDisplay: some View {
        VStack(spacing: 8) {
            ZStack {
                Circle()
                    .stroke(Color.casinoGray, lineWidth: 8)
                    .frame(width: 140, height: 140)

                Circle()
                    .trim(from: 0, to: timerProgress)
                    .stroke(timerColor, style: StrokeStyle(lineWidth: 8, lineCap: .round))
                    .frame(width: 140, height: 140)
                    .rotationEffect(.degrees(-90))
                    .animation(.linear(duration: 1), value: vm.tiltCooldownRemaining)

                VStack(spacing: 2) {
                    Text(timeString)
                        .font(.system(size: 36, weight: .black, design: .rounded))
                        .foregroundColor(.white)
                        .contentTransition(.numericText())
                    Text("restant")
                        .font(.system(size: 12))
                        .foregroundColor(.gray)
                }
            }
        }
    }

    private var timerProgress: Double {
        let total = 120.0  // 2 minutes par défaut
        return Double(vm.tiltCooldownRemaining) / total
    }

    private var timerColor: Color {
        if vm.tiltCooldownRemaining > 90 { return .casinoRed }
        if vm.tiltCooldownRemaining > 45 { return .casinoOrange }
        return .casinoGreen
    }

    private var timeString: String {
        let min = vm.tiltCooldownRemaining / 60
        let sec = vm.tiltCooldownRemaining % 60
        return String(format: "%d:%02d", min, sec)
    }

    // MARK: - Carte de conseil
    private var adviceCard: some View {
        let advice = psychologicalAdvice[vm.session.consecutiveLosses % psychologicalAdvice.count]

        return VStack(spacing: 10) {
            Image(systemName: "quote.bubble.fill")
                .font(.system(size: 20))
                .foregroundColor(.casinoGold)

            Text(advice)
                .font(.system(size: 15, weight: .medium))
                .foregroundColor(.white.opacity(0.85))
                .multilineTextAlignment(.center)
                .lineSpacing(4)
        }
        .padding(16)
        .background(Color.casinoCard)
        .cornerRadius(14)
        .overlay(
            RoundedRectangle(cornerRadius: 14)
                .stroke(Color.casinoGold.opacity(0.2), lineWidth: 1)
        )
    }

    // MARK: - Conseil urgence
    private var emergencyHint: some View {
        VStack(spacing: 6) {
            Image(systemName: "iphone.gen3.radiowaves.left.and.right")
                .font(.system(size: 18))
                .foregroundColor(.gray)
            Text("Agite le téléphone pour\ndéverrouillage d'urgence")
                .font(.system(size: 12))
                .foregroundColor(.gray.opacity(0.6))
                .multilineTextAlignment(.center)
        }
        .padding(.top, 8)
    }

    // MARK: - Animations
    private func startShake() {
        shakeOffset = 10
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
            shakeOffset = 0
        }
    }

    private func startPulse() {
        withAnimation(.easeInOut(duration: 1.5).repeatForever(autoreverses: true)) {
            pulseOpacity = 0.8
        }
    }

    // MARK: - Conseils psychologiques
    private let psychologicalAdvice = [
        "Le casino est conçu pour vous faire jouer trop longtemps. Résistez.",
        "Une pause de 2 minutes peut vous épargner des heures de regrets.",
        "Les meilleurs joueurs arrêtent quand ils le décident, pas le casino.",
        "Le vrai edge, c'est la discipline. Pas la chance.",
        "Respirez. Recalculez. Recommencez avec la tête froide.",
        "Chaque spin est indépendant. Votre état mental, lui, se cumule.",
        "Le tilt coûte plus cher que toutes les mauvaises séries réunies.",
        "Attendre le bon moment, c'est 80% de la stratégie."
    ]
}

// MARK: - Écran de Félicitations (Take Profit)
struct CelebrationView: View {
    let message: String
    let session: SessionStats
    var onDismiss: () -> Void

    @State private var scale: CGFloat = 0.5
    @State private var sparklesVisible = true

    var body: some View {
        ZStack {
            Color.black.opacity(0.97).ignoresSafeArea()

            VStack(spacing: 28) {
                // Trophée animé
                Image(systemName: "trophy.fill")
                    .font(.system(size: 80))
                    .foregroundColor(.casinoGold)
                    .scaleEffect(scale)
                    .onAppear {
                        withAnimation(.spring(response: 0.6, dampingFraction: 0.5)) {
                            scale = 1.0
                        }
                    }

                Text(message)
                    .font(.system(size: 24, weight: .black))
                    .foregroundColor(.casinoGold)
                    .multilineTextAlignment(.center)

                // Stats session
                sessionSummary

                // Boutons d'action
                VStack(spacing: 12) {
                    Button {
                        onDismiss()
                    } label: {
                        HStack {
                            Image(systemName: "arrow.counterclockwise.circle.fill")
                                .font(.system(size: 22))
                            Text("NOUVELLE SESSION")
                                .font(.system(size: 18, weight: .black))
                                .tracking(2)
                        }
                        .foregroundColor(.black)
                        .casinoButton(color: .casinoGold)
                    }
                }
            }
            .padding(30)
        }
    }

    private var sessionSummary: some View {
        VStack(spacing: 12) {
            HStack(spacing: 20) {
                summaryCell(
                    value: String(format: "%+.1f%%", session.profitLossPct),
                    label: "Profit",
                    color: .casinoGreen
                )
                summaryCell(
                    value: "\(session.wins)W/\(session.losses)L",
                    label: "Score",
                    color: .casinoGold
                )
                summaryCell(
                    value: "\(Int(session.disciplineScore))",
                    label: "Discipline",
                    color: .casinoGreen
                )
            }
        }
        .padding(16)
        .background(Color.casinoCard)
        .cornerRadius(14)
    }

    private func summaryCell(value: String, label: String, color: Color) -> some View {
        VStack(spacing: 4) {
            Text(value)
                .font(.system(size: 20, weight: .black, design: .rounded))
                .foregroundColor(color)
            Text(label)
                .font(.system(size: 11))
                .foregroundColor(.gray)
        }
        .frame(maxWidth: .infinity)
    }
}
