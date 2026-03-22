import SwiftUI

// MARK: - Heatmap Secteurs de la Roue Électronique
struct SectorHeatmapView: View {
    @ObservedObject var vm: RouletteViewModel

    var body: some View {
        VStack(spacing: 8) {
            // En-tête
            HStack {
                Image(systemName: "dot.radiowaves.up.forward")
                    .foregroundColor(.casinoOrange)
                Text("ANALYSE ROUE ÉLECTRONIQUE")
                    .font(.system(size: 11, weight: .black))
                    .tracking(1.5)
                    .foregroundColor(.gray)
                Spacer()
                if let elec = vm.electronicScore {
                    scoreChip(elec.overallScore)
                }
            }
            .padding(.horizontal, 14)

            // Raison principale
            if let elec = vm.electronicScore, !elec.primaryReason.isEmpty {
                HStack(spacing: 6) {
                    Image(systemName: "lightbulb.fill")
                        .font(.system(size: 12))
                        .foregroundColor(.casinoGold)
                    Text(elec.primaryReason)
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundColor(.white)
                    Spacer()
                }
                .padding(.horizontal, 14)
            }

            // Roue physique visuelle (représentation linéaire)
            wheelVisualization
                .padding(.horizontal, 10)

            // Pattern temporel
            if let pattern = vm.temporalPattern, pattern.confidence >= 50 {
                temporalPatternCard(pattern)
                    .padding(.horizontal, 14)
            }

            // Voisins dynamiques
            if !vm.dynamicNeighbors.isEmpty {
                neighborsCard
                    .padding(.horizontal, 14)
            }

            // Rapid Repetition Score
            if vm.rapidRepetitionScore >= 30 {
                repetitionAlert
                    .padding(.horizontal, 14)
            }
        }
        .padding(.vertical, 10)
        .background(Color.casinoCard)
        .cornerRadius(16)
        .overlay(
            RoundedRectangle(cornerRadius: 16)
                .stroke(Color.casinoCardBorder, lineWidth: 1)
        )
    }

    // MARK: - Visualisation de la roue (linéaire)
    private var wheelVisualization: some View {
        let wheelOrder = ElectronicRouletteAnalyzer.wheelOrder

        return ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 3) {
                ForEach(Array(wheelOrder.enumerated()), id: \.offset) { idx, num in
                    wheelCell(num: num, idx: idx)
                }
            }
            .padding(.horizontal, 4)
        }
    }

    private func wheelCell(num: Int, idx: Int) -> some View {
        let isHot = vm.hotNumbers.contains(num)
        let isCold = vm.coldNumbers.contains(num)
        let isRecommended = vm.currentDecision?.recommendedNumbers.contains(num) ?? false
        let isLastSpin = vm.spins.last?.number == num
        let isNeighbor = vm.dynamicNeighbors.contains(num)

        let bgColor: Color
        if isLastSpin        { bgColor = .casinoGold }
        else if isRecommended { bgColor = .casinoGreen.opacity(0.6) }
        else if isHot        { bgColor = .hotRed.opacity(0.5) }
        else if isNeighbor   { bgColor = .casinoOrange.opacity(0.3) }
        else if isCold       { bgColor = .coldBlue.opacity(0.3) }
        else if num == 0     { bgColor = Color(hex: "#1A3A1A") }
        else {
            let rouge: Set<Int> = [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]
            bgColor = rouge.contains(num) ? Color(hex: "#2A0A0A") : Color(hex: "#1E1E1E")
        }

        return VStack(spacing: 2) {
            Text("\(num)")
                .font(.system(size: 10, weight: .black))
                .foregroundColor(isLastSpin ? .black : Color.rouletteNumberColor(num))
                .frame(width: 28, height: 28)
                .background(bgColor)
                .cornerRadius(5)

            // Indicateur biais
            if isHot {
                Image(systemName: "flame.fill")
                    .font(.system(size: 6))
                    .foregroundColor(.hotRed)
            } else if isCold {
                Image(systemName: "snowflake")
                    .font(.system(size: 6))
                    .foregroundColor(.coldBlue)
            } else if isRecommended {
                Image(systemName: "star.fill")
                    .font(.system(size: 6))
                    .foregroundColor(.casinoGreen)
            } else {
                Spacer().frame(height: 8)
            }
        }
        .scaleEffect(isLastSpin ? 1.2 : 1.0)
        .animation(.spring(response: 0.3), value: isLastSpin)
    }

    // MARK: - Pattern temporel
    private func temporalPatternCard(_ pattern: ElectronicRouletteAnalyzer.TemporalPattern) -> some View {
        HStack(spacing: 10) {
            Image(systemName: "waveform")
                .font(.system(size: 20))
                .foregroundColor(.casinoOrange)

            VStack(alignment: .leading, spacing: 2) {
                Text(pattern.patternType.rawValue)
                    .font(.system(size: 12, weight: .black))
                    .foregroundColor(.casinoOrange)
                Text("Confiance: \(Int(pattern.confidence))%")
                    .font(.system(size: 11))
                    .foregroundColor(.gray)
            }

            Spacer()

            // Numéros prédits
            HStack(spacing: 4) {
                ForEach(pattern.nextPredictedSector.prefix(4), id: \.self) { num in
                    Text("\(num)")
                        .font(.system(size: 12, weight: .bold))
                        .foregroundColor(Color.rouletteNumberColor(num))
                        .frame(width: 24, height: 24)
                        .background(Color.casinoOrange.opacity(0.2))
                        .cornerRadius(5)
                }
                if pattern.nextPredictedSector.count > 4 {
                    Text("+\(pattern.nextPredictedSector.count - 4)")
                        .font(.system(size: 10))
                        .foregroundColor(.gray)
                }
            }
        }
        .padding(10)
        .background(Color.casinoOrange.opacity(0.06))
        .cornerRadius(10)
        .overlay(
            RoundedRectangle(cornerRadius: 10)
                .stroke(Color.casinoOrange.opacity(0.3), lineWidth: 1)
        )
    }

    // MARK: - Voisins dynamiques
    private var neighborsCard: some View {
        HStack(spacing: 10) {
            VStack(alignment: .leading, spacing: 2) {
                Text("VOISINS DU DERNIER")
                    .font(.system(size: 10, weight: .black))
                    .tracking(1.5)
                    .foregroundColor(.gray)
                Text("5 voisins physiques de \(vm.spins.last?.number ?? 0)")
                    .font(.system(size: 12))
                    .foregroundColor(.casinoOrange)
            }

            Spacer()

            HStack(spacing: 6) {
                ForEach(vm.dynamicNeighbors, id: \.self) { num in
                    Text("\(num)")
                        .font(.system(size: 14, weight: .black))
                        .foregroundColor(Color.rouletteNumberColor(num))
                        .frame(width: 32, height: 32)
                        .background(
                            Circle()
                                .fill(Color.casinoOrange.opacity(0.2))
                        )
                }
            }
        }
        .padding(10)
        .background(Color.casinoOrange.opacity(0.04))
        .cornerRadius(10)
    }

    // MARK: - Alerte répétition rapide
    private var repetitionAlert: some View {
        HStack(spacing: 8) {
            Image(systemName: "repeat.circle.fill")
                .font(.system(size: 18))
                .foregroundColor(.casinoGreen)
            VStack(alignment: .leading, spacing: 1) {
                Text("RÉPÉTITION ZONE DÉTECTÉE")
                    .font(.system(size: 11, weight: .black))
                    .foregroundColor(.casinoGreen)
                Text("La bille revient dans la même zone — score \(Int(vm.rapidRepetitionScore))")
                    .font(.system(size: 11))
                    .foregroundColor(.gray)
            }
            Spacer()
            Image(systemName: "chevron.right.circle.fill")
                .foregroundColor(.casinoGreen.opacity(0.5))
        }
        .padding(10)
        .background(Color.casinoGreen.opacity(0.06))
        .cornerRadius(10)
        .overlay(
            RoundedRectangle(cornerRadius: 10)
                .stroke(Color.casinoGreen.opacity(0.3), lineWidth: 1)
        )
    }

    // MARK: - Badge score électronique
    private func scoreChip(_ score: Double) -> some View {
        let color: Color = score >= 60 ? .casinoGreen : score >= 35 ? .casinoOrange : .gray
        return HStack(spacing: 3) {
            Text("Elec")
                .font(.system(size: 9))
                .foregroundColor(.gray)
            Text("\(Int(score))")
                .font(.system(size: 13, weight: .black))
                .foregroundColor(color)
        }
        .padding(.horizontal, 8).padding(.vertical, 3)
        .background(color.opacity(0.1))
        .cornerRadius(8)
    }
}
