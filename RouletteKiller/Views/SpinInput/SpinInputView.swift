import SwiftUI

// MARK: - Saisie Ultra-Rapide des Spins (grille 4×10 + 0)
struct SpinInputView: View {
    @ObservedObject var vm: RouletteViewModel
    @State private var lastTapped: Int? = nil
    @State private var showConfirmation: Bool = false

    // Disposition numéros 0-36 par rangées de la roulette
    private let rows: [[Int]] = [
        [3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36],
        [2, 5, 8, 11, 14, 17, 20, 23, 26, 29, 32, 35],
        [1, 4, 7, 10, 13, 16, 19, 22, 25, 28, 31, 34]
    ]

    var body: some View {
        VStack(spacing: 8) {
            // Titre
            HStack {
                Image(systemName: "number.circle.fill")
                    .foregroundColor(.casinoGold)
                Text("SAISIR LE NUMÉRO")
                    .font(.system(size: 13, weight: .black))
                    .tracking(2)
                    .foregroundColor(.gray)
                Spacer()
                if let last = vm.lastSpin {
                    HStack(spacing: 6) {
                        Text("Dernier:")
                            .font(.system(size: 12))
                            .foregroundColor(.gray)
                        numberBadge(last.number, large: false)
                    }
                }
            }
            .padding(.horizontal, 16)

            // Zéro (touche spéciale)
            Button { handleInput(0) } label: {
                Text("0")
                    .font(.system(size: 20, weight: .black))
                    .foregroundColor(.white)
                    .frame(maxWidth: .infinity)
                    .frame(height: 50)
                    .background(lastTapped == 0 ? Color.casinoGreen : Color(hex: "#1A3A1A"))
                    .cornerRadius(10)
                    .overlay(
                        RoundedRectangle(cornerRadius: 10)
                            .stroke(Color.casinoGreen.opacity(0.4), lineWidth: 1)
                    )
                    .animation(.spring(response: 0.2), value: lastTapped)
            }
            .padding(.horizontal, 16)

            // Grille 3×12 (1-36)
            VStack(spacing: 5) {
                ForEach(rows, id: \.self) { row in
                    HStack(spacing: 5) {
                        ForEach(row, id: \.self) { number in
                            numberButton(number)
                        }
                    }
                }
            }
            .padding(.horizontal, 12)
        }
        .padding(.vertical, 10)
        .background(Color.casinoCard)
        .cornerRadius(16)
        .overlay(
            RoundedRectangle(cornerRadius: 16)
                .stroke(Color.casinoCardBorder, lineWidth: 1)
        )
        .overlay(
            // Flash de confirmation
            showConfirmation ? confirmationFlash : nil
        )
    }

    // MARK: - Bouton numéro individuel
    private func numberButton(_ number: Int) -> some View {
        let isHot = vm.hotNumbers.contains(number)
        let isCold = vm.coldNumbers.contains(number)
        let isRecommended = vm.currentDecision?.recommendedNumbers.contains(number) ?? false
        let isLastTapped = lastTapped == number

        return Button { handleInput(number) } label: {
            ZStack {
                // Fond
                RoundedRectangle(cornerRadius: 7)
                    .fill(backgroundColor(number: number, isHot: isHot, isCold: isCold, isRecommended: isRecommended, isLastTapped: isLastTapped))

                // Indicateurs
                if isRecommended && !isLastTapped {
                    RoundedRectangle(cornerRadius: 7)
                        .stroke(Color.casinoGreen, lineWidth: 2)
                }

                Text("\(number)")
                    .font(.system(size: 14, weight: .black, design: .rounded))
                    .foregroundColor(textColor(number: number))

                // Badge hot/cold
                if isHot {
                    VStack {
                        HStack {
                            Spacer()
                            Circle()
                                .fill(Color.hotRed)
                                .frame(width: 5, height: 5)
                                .padding(2)
                        }
                        Spacer()
                    }
                } else if isCold {
                    VStack {
                        HStack {
                            Spacer()
                            Circle()
                                .fill(Color.coldBlue)
                                .frame(width: 5, height: 5)
                                .padding(2)
                        }
                        Spacer()
                    }
                }
            }
            .frame(height: 44)
            .scaleEffect(isLastTapped ? 1.15 : 1.0)
            .animation(.spring(response: 0.2, dampingFraction: 0.6), value: isLastTapped)
        }
        .buttonStyle(.plain)
    }

    // MARK: - Couleurs de fond
    private func backgroundColor(number: Int, isHot: Bool, isCold: Bool, isRecommended: Bool, isLastTapped: Bool) -> Color {
        if isLastTapped { return Color.casinoGold }
        if isRecommended { return Color.casinoGreen.opacity(0.3) }
        if isHot { return Color.hotRed.opacity(0.4) }
        if isCold { return Color.coldBlue.opacity(0.3) }
        if number == 0 { return Color(hex: "#1A3A1A") }
        let rouge: Set<Int> = [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]
        return rouge.contains(number) ? Color(hex: "#2A0A0A") : Color(hex: "#1A1A1A")
    }

    private func textColor(number: Int) -> Color {
        if lastTapped == number { return .black }
        if number == 0 { return .casinoGreen }
        let rouge: Set<Int> = [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]
        return rouge.contains(number) ? .casinoRed : .white
    }

    // MARK: - Badge numéro
    private func numberBadge(_ number: Int, large: Bool = true) -> some View {
        Text("\(number)")
            .font(.system(size: large ? 18 : 13, weight: .black))
            .foregroundColor(Color.rouletteNumberColor(number))
            .frame(width: large ? 36 : 26, height: large ? 36 : 26)
            .background(
                Circle()
                    .fill(number == 0 ? Color.casinoGreen.opacity(0.3) :
                          [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36].contains(number) ?
                          Color.casinoRed.opacity(0.3) : Color.casinoGray)
            )
    }

    // MARK: - Flash confirmation
    @ViewBuilder
    private var confirmationFlash: some View {
        RoundedRectangle(cornerRadius: 16)
            .fill(Color.casinoGreen.opacity(0.15))
            .allowsHitTesting(false)
            .transition(.opacity)
    }

    // MARK: - Gestion saisie
    private func handleInput(_ number: Int) {
        guard !vm.isTiltLocked else { return }

        // Haptic
        let impact = UIImpactFeedbackGenerator(style: .medium)
        impact.impactOccurred()

        lastTapped = number

        vm.addSpin(number)

        // Reset animation
        withAnimation(.spring(response: 0.2).delay(0.3)) {
            showConfirmation = true
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
            showConfirmation = false
            if lastTapped == number { lastTapped = nil }
        }
    }
}
