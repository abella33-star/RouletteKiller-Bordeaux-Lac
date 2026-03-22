import SwiftUI

// MARK: - Jauge Circulaire Géante (Score 0-100)
struct CircularGaugeView: View {
    let score: Double
    let isAnimating: Bool

    @State private var animatedScore: Double = 0
    @State private var pulseScale: CGFloat = 1.0
    @State private var showFireworks: Bool = false

    var gaugeColor: Color { Color.scoreColor(score: animatedScore) }

    var body: some View {
        ZStack {
            // Fond de jauge (anneau gris)
            Circle()
                .stroke(Color.casinoGray, lineWidth: 20)
                .frame(width: 240, height: 240)

            // Anneau de score coloré
            Circle()
                .trim(from: 0, to: animatedScore / 100)
                .stroke(
                    AngularGradient(
                        colors: gradientColors,
                        center: .center,
                        startAngle: .degrees(-90),
                        endAngle: .degrees(270)
                    ),
                    style: StrokeStyle(lineWidth: 22, lineCap: .round)
                )
                .frame(width: 240, height: 240)
                .rotationEffect(.degrees(-90))

            // Lueur extérieure si score élevé
            if animatedScore >= 70 {
                Circle()
                    .stroke(gaugeColor.opacity(0.2), lineWidth: 32)
                    .frame(width: 240, height: 240)
                    .blur(radius: 8)
            }

            // Contenu central
            VStack(spacing: 4) {
                // Score principal
                Text("\(Int(animatedScore))")
                    .font(.system(size: 72, weight: .black, design: .rounded))
                    .foregroundColor(.white)
                    .scaleEffect(pulseScale)
                    .contentTransition(.numericText())

                // Label selon état
                scoreLabel
            }

            // Feu d'artifice à 85+
            if showFireworks {
                fireworksOverlay
            }
        }
        .onAppear {
            withAnimation(.spring(response: 1.2, dampingFraction: 0.7)) {
                animatedScore = score
            }
            checkFireworks()
        }
        .onChange(of: score) { _, newScore in
            withAnimation(.spring(response: 0.8, dampingFraction: 0.8)) {
                animatedScore = newScore
            }
            checkFireworks()
            if newScore >= 70 { startPulse() }
        }
    }

    // MARK: - Label sous le score
    @ViewBuilder
    private var scoreLabel: some View {
        if animatedScore >= 85 {
            Text("STRIKE")
                .font(.system(size: 22, weight: .black))
                .foregroundColor(.casinoGreen)
                .padding(.horizontal, 12).padding(.vertical, 4)
                .background(Color.casinoGreen.opacity(0.15))
                .cornerRadius(8)
        } else if animatedScore >= 70 {
            Text("OPPORTUNITÉ")
                .font(.system(size: 16, weight: .bold))
                .foregroundColor(.casinoGreen)
        } else if animatedScore >= 40 {
            Text("ATTENDS")
                .font(.system(size: 16, weight: .bold))
                .foregroundColor(.casinoOrange)
        } else {
            Text("DEAD MARKET")
                .font(.system(size: 14, weight: .bold))
                .foregroundColor(.casinoRed)
        }
    }

    // MARK: - Feu d'artifice SF Symbol
    @ViewBuilder
    private var fireworksOverlay: some View {
        ForEach(0..<6, id: \.self) { i in
            Image(systemName: "sparkle")
                .font(.system(size: 24))
                .foregroundColor(.casinoGold)
                .offset(
                    x: CGFloat.random(in: -120...120),
                    y: CGFloat.random(in: -120...120)
                )
                .scaleEffect(CGFloat.random(in: 0.5...1.5))
                .opacity(Double.random(in: 0.6...1.0))
                .animation(
                    .easeInOut(duration: 0.5)
                    .repeatForever(autoreverses: true)
                    .delay(Double(i) * 0.1),
                    value: showFireworks
                )
        }
    }

    // MARK: - Couleurs gradient
    private var gradientColors: [Color] {
        if animatedScore >= 70 { return [.casinoGreen.opacity(0.6), .casinoGreen] }
        if animatedScore >= 40 { return [.casinoOrange.opacity(0.6), .casinoOrange] }
        return [.casinoRed.opacity(0.6), .casinoRed]
    }

    private func startPulse() {
        withAnimation(.easeInOut(duration: 1.0).repeatForever(autoreverses: true)) {
            pulseScale = 1.05
        }
    }

    private func checkFireworks() {
        showFireworks = score >= 85
    }
}

// MARK: - Preview
#Preview {
    ZStack {
        Color.casinoBackground.ignoresSafeArea()
        VStack(spacing: 40) {
            CircularGaugeView(score: 87, isAnimating: true)
            CircularGaugeView(score: 55, isAnimating: false)
            CircularGaugeView(score: 25, isAnimating: false)
        }
    }
}
