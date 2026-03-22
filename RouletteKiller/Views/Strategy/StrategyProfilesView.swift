import SwiftUI

// MARK: - Vue Profils Stratégiques (cartes swipeables)
struct StrategyProfilesView: View {
    @ObservedObject var vm: RouletteViewModel
    @State private var dragOffset: CGFloat = 0
    @State private var showWarning: Bool = false
    @State private var pendingProfile: StrategyProfile? = nil

    var body: some View {
        VStack(spacing: 12) {
            // En-tête
            HStack {
                Image(systemName: "person.crop.circle.badge.questionmark")
                    .foregroundColor(.casinoGold)
                Text("PROFIL STRATÉGIQUE")
                    .font(.system(size: 13, weight: .black))
                    .tracking(2)
                    .foregroundColor(.gray)
                Spacer()

                // Recommandation auto
                if let rec = vm.autoRecommendation {
                    autoRecommendBadge(rec)
                }
            }
            .padding(.horizontal, 16)

            // Cartes des profils
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 12) {
                    ForEach(StrategyProfile.allCases, id: \.self) { profile in
                        profileCard(profile)
                    }
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 4)
            }

            // Moment détecté (Kiwi)
            if let score = vm.currentDecision?.opportunityScore, score >= 55 {
                momentDetectedCard
            }
        }
        .padding(.vertical, 10)
        .background(Color.casinoCard)
        .cornerRadius(16)
        .overlay(
            RoundedRectangle(cornerRadius: 16)
                .stroke(Color.casinoCardBorder, lineWidth: 1)
        )
        .alert("Changer de Profil", isPresented: $showWarning) {
            Button("Confirmer", role: .destructive) {
                if let p = pendingProfile { vm.switchProfile(to: p) }
            }
            Button("Annuler", role: .cancel) {}
        } message: {
            Text("Changer de profil réinitialise les métriques de risque de la session.")
        }
    }

    // MARK: - Carte profil
    private func profileCard(_ profile: StrategyProfile) -> some View {
        let isSelected = vm.selectedProfile == profile
        let profColor = Color(hex: profile.color)

        return Button {
            if profile != vm.selectedProfile {
                if vm.session.totalSpins > 0 {
                    pendingProfile = profile
                    showWarning = true
                } else {
                    vm.switchProfile(to: profile)
                }
            }
        } label: {
            VStack(alignment: .leading, spacing: 10) {
                // En-tête carte
                HStack {
                    Image(systemName: profile.icon)
                        .font(.system(size: 24))
                        .foregroundColor(profColor)

                    Spacer()

                    if isSelected {
                        Image(systemName: "checkmark.circle.fill")
                            .foregroundColor(profColor)
                            .font(.system(size: 18))
                    }
                }

                // Nom
                Text(profile.rawValue)
                    .font(.system(size: 20, weight: .black))
                    .foregroundColor(isSelected ? profColor : .white)

                // Description
                Text(profile.description)
                    .font(.system(size: 11))
                    .foregroundColor(.gray)
                    .multilineTextAlignment(.leading)
                    .lineLimit(2)

                Divider().background(Color.casinoCardBorder)

                // Métriques
                VStack(spacing: 6) {
                    metricRow("Mise", value: "\(Int(profile.stakePct * 100 * 10))‰ BK", color: profColor)
                    metricRow("TP", value: "+\(Int(profile.takeProfitPct * 100))%", color: .casinoGreen)
                    metricRow("SL", value: "-\(Int(profile.stopLossPct * 100))%", color: .casinoRed)
                    metricRow("Nums", value: "\(profile.maxNumbers) max", color: .casinoGold)
                }

                // Score minimum
                HStack {
                    Image(systemName: "gauge.medium")
                        .font(.system(size: 10))
                    Text("Score min: \(Int(profile.minOpportunityScore))")
                        .font(.system(size: 11, weight: .semibold))
                }
                .foregroundColor(profColor.opacity(0.8))
                .padding(.horizontal, 8).padding(.vertical, 4)
                .background(profColor.opacity(0.1))
                .cornerRadius(6)
            }
            .padding(16)
            .frame(width: 180)
            .background(isSelected ? profColor.opacity(0.08) : Color.casinoBackground)
            .cornerRadius(14)
            .overlay(
                RoundedRectangle(cornerRadius: 14)
                    .stroke(isSelected ? profColor : Color.casinoCardBorder, lineWidth: isSelected ? 2 : 1)
            )
            .shadow(color: isSelected ? profColor.opacity(0.2) : .clear, radius: 8)
        }
        .buttonStyle(.plain)
        .scaleEffect(isSelected ? 1.03 : 1.0)
        .animation(.spring(response: 0.3), value: isSelected)
    }

    // MARK: - Moment Détecté
    private var momentDetectedCard: some View {
        let score = vm.chiSquareScore
        let level: String = score > 70 ? "FORTE" : score > 50 ? "MODÉRÉE" : "FAIBLE"
        let color: Color = score > 70 ? .casinoGreen : score > 50 ? .casinoOrange : .gray

        return HStack(spacing: 12) {
            Image(systemName: "waveform.path.ecg.rectangle.fill")
                .font(.system(size: 28))
                .foregroundColor(color)

            VStack(alignment: .leading, spacing: 2) {
                Text("MOMENT DÉTECTÉ")
                    .font(.system(size: 11, weight: .black))
                    .tracking(1.5)
                    .foregroundColor(.gray)
                Text("Variance \(level)")
                    .font(.system(size: 16, weight: .bold))
                    .foregroundColor(color)
                Text("χ² = \(String(format: "%.1f", score))")
                    .font(.system(size: 12))
                    .foregroundColor(.gray)
            }

            Spacer()

            VStack(spacing: 4) {
                Text("\(Int(score))")
                    .font(.system(size: 28, weight: .black, design: .rounded))
                    .foregroundColor(color)
                Text("Chi²")
                    .font(.system(size: 10))
                    .foregroundColor(.gray)
            }
        }
        .padding(14)
        .background(color.opacity(0.06))
        .cornerRadius(12)
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(color.opacity(0.3), lineWidth: 1)
        )
        .padding(.horizontal, 16)
    }

    // MARK: - Badge recommandation auto
    private func autoRecommendBadge(_ rec: StrategySelector.Recommendation) -> some View {
        let color = Color(hex: rec.profile.color)
        return HStack(spacing: 4) {
            Image(systemName: "sparkles")
                .font(.system(size: 10))
            Text("Auto: \(rec.profile.rawValue)")
                .font(.system(size: 11, weight: .bold))
        }
        .foregroundColor(color)
        .padding(.horizontal, 8).padding(.vertical, 3)
        .background(color.opacity(0.1))
        .cornerRadius(8)
    }

    private func metricRow(_ label: String, value: String, color: Color) -> some View {
        HStack {
            Text(label)
                .font(.system(size: 11))
                .foregroundColor(.gray)
            Spacer()
            Text(value)
                .font(.system(size: 12, weight: .bold))
                .foregroundColor(color)
        }
    }
}
