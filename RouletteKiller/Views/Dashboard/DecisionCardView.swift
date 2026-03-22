import SwiftUI

// MARK: - Carte de Décision (STRIKE / NO PLAY)
struct DecisionCardView: View {
    let decision: BettingDecision
    let session: SessionStats

    @State private var blinkOpacity: Double = 1.0

    var body: some View {
        VStack(spacing: 16) {
            if decision.shouldPlay {
                strikeCard
            } else {
                noPlayCard
            }
        }
    }

    // MARK: - STRIKE Card
    private var strikeCard: some View {
        VStack(spacing: 12) {
            // Bouton STRIKE
            HStack(spacing: 16) {
                Image(systemName: "bolt.circle.fill")
                    .font(.system(size: 40))
                    .foregroundColor(.black)

                VStack(alignment: .leading, spacing: 2) {
                    Text("STRIKE !")
                        .font(.system(size: 36, weight: .black))
                        .foregroundColor(.black)
                    Text(decision.rationale)
                        .font(.system(size: 13))
                        .foregroundColor(.black.opacity(0.7))
                        .lineLimit(1)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(20)
            .background(Color.casinoGreen)
            .cornerRadius(16)
            .shadow(color: Color.casinoGreen.opacity(0.5), radius: 12)

            // Numéros recommandés
            if !decision.recommendedNumbers.isEmpty {
                recommendedNumbersCard
            }

            // Mise + Stats
            betStatsRow
        }
    }

    // MARK: - NO PLAY Card
    private var noPlayCard: some View {
        VStack(spacing: 10) {
            HStack(spacing: 16) {
                Image(systemName: "hand.raised.fill")
                    .font(.system(size: 36))
                    .foregroundColor(.gray)

                VStack(alignment: .leading, spacing: 2) {
                    Text("NE PAS JOUER")
                        .font(.system(size: 28, weight: .black))
                        .foregroundColor(.gray)

                    Text(decision.rationale)
                        .font(.system(size: 13))
                        .foregroundColor(.gray.opacity(0.7))
                        .lineLimit(2)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(20)
            .background(Color.casinoGray.opacity(0.3))
            .cornerRadius(16)
            .overlay(
                RoundedRectangle(cornerRadius: 16)
                    .stroke(Color.casinoGray, lineWidth: 1)
            )

            // Score insuffisant
            scoreBar(score: decision.opportunityScore)
        }
    }

    // MARK: - Numéros recommandés
    private var recommendedNumbersCard: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Image(systemName: "target")
                    .foregroundColor(.casinoGold)
                Text("JOUER CES NUMÉROS")
                    .font(.system(size: 12, weight: .black))
                    .tracking(1.5)
                    .foregroundColor(.casinoGold)
                Spacer()
                // Probabilité
                Text(String(format: "P=%.1f%%", decision.estimatedProbability))
                    .font(.system(size: 12, weight: .bold))
                    .foregroundColor(.casinoGold)
            }

            // Grille des numéros
            LazyVGrid(
                columns: Array(repeating: GridItem(.flexible(), spacing: 6), count: min(8, decision.recommendedNumbers.count)),
                spacing: 6
            ) {
                ForEach(decision.recommendedNumbers.sorted(), id: \.self) { num in
                    numberChip(num)
                }
            }
        }
        .padding(14)
        .casinoCard(borderColor: .casinoGold.opacity(0.3))
    }

    private func numberChip(_ num: Int) -> some View {
        Text("\(num)")
            .font(.system(size: 15, weight: .black))
            .foregroundColor(Color.rouletteNumberColor(num))
            .frame(minWidth: 36, minHeight: 36)
            .background(
                RoundedRectangle(cornerRadius: 8)
                    .fill(num == 0 ? Color.casinoGreen.opacity(0.3) :
                          [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36].contains(num) ?
                          Color.casinoRed.opacity(0.25) : Color.casinoGray)
            )
    }

    // MARK: - Stats mise/gain
    private var betStatsRow: some View {
        HStack(spacing: 0) {
            statCell(
                icon: "eurosign.circle.fill",
                value: decision.recommendedStake.formatted(.currency(code: "EUR")),
                label: "Mise recommandée",
                color: .casinoGold
            )
            Divider().background(Color.casinoCardBorder).frame(height: 35)
            statCell(
                icon: "arrow.up.right.circle.fill",
                value: decision.potentialGain.formatted(.currency(code: "EUR")),
                label: "Gain potentiel",
                color: .casinoGreen
            )
            Divider().background(Color.casinoCardBorder).frame(height: 35)
            statCell(
                icon: decision.riskLevel.icon,
                value: decision.riskLevel.rawValue,
                label: "Risque",
                color: decision.riskLevel == .low ? .casinoGreen :
                       decision.riskLevel == .medium ? .casinoOrange : .casinoRed
            )
        }
        .padding(.vertical, 8)
        .casinoCard()
    }

    // MARK: - Barre de score
    private func scoreBar(score: Double) -> some View {
        VStack(spacing: 4) {
            HStack {
                Text("Score marché")
                    .font(.system(size: 12))
                    .foregroundColor(.gray)
                Spacer()
                Text("\(Int(score))/100")
                    .font(.system(size: 12, weight: .bold))
                    .foregroundColor(.gray)
            }

            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    RoundedRectangle(cornerRadius: 3).fill(Color.casinoGray).frame(height: 6)
                    RoundedRectangle(cornerRadius: 3)
                        .fill(Color.scoreColor(score: score))
                        .frame(width: geo.size.width * score / 100, height: 6)
                }
            }
            .frame(height: 6)
        }
        .padding(.horizontal, 16).padding(.vertical, 8)
    }

    private func statCell(icon: String, value: String, label: String, color: Color) -> some View {
        VStack(spacing: 3) {
            Image(systemName: icon)
                .font(.system(size: 14))
                .foregroundColor(color)
            Text(value)
                .font(.system(size: 13, weight: .bold, design: .rounded))
                .foregroundColor(color)
            Text(label)
                .font(.system(size: 9))
                .foregroundColor(.gray)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 6)
    }
}
