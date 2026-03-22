import SwiftUI
import Combine
import Foundation

// MARK: - ViewModel Principal (MVVM)
@MainActor
final class RouletteViewModel: ObservableObject {

    // MARK: - État de l'interface
    @Published var spins: [SpinData] = []
    @Published var session: SessionStats
    @Published var currentDecision: BettingDecision?
    @Published var selectedProfile: StrategyProfile = .equilibre
    @Published var moneyMode: MoneyManagementMode = .adaptive
    @Published var isX2Mode: Bool = false
    @Published var isTiltLocked: Bool = false
    @Published var tiltCooldownRemaining: Int = 0  // secondes
    @Published var showCelebration: Bool = false
    @Published var celebrationMessage: String = ""
    @Published var chiSquareScore: Double = 0
    @Published var heatmap: [ChiSquareAnalyzer.SectorHeatmap] = []
    @Published var autoRecommendation: StrategySelector.Recommendation?

    // MARK: - Bankroll
    @AppStorage("bankroll") var bankroll: Double = 1000.0
    @AppStorage("streakSessions") var streakSessions: Int = 0

    // Persistance des spins
    private let spinsKey = "savedSpins"
    private var cooldownTimer: AnyCancellable?

    // MARK: - Init
    init() {
        self.session = SessionStats(bankroll: UserDefaults.standard.double(forKey: "bankroll").nonZero ?? 1000.0)
        loadSpins()
        refreshDecision()
    }

    // MARK: - Ajouter un spin
    func addSpin(_ number: Int) {
        guard !isTiltLocked else { return }

        let spin = SpinData(number: number)
        spins.append(spin)

        // Limiter l'historique à 200 spins
        if spins.count > 200 { spins.removeFirst() }

        saveSpins()
        refreshDecision()
        checkAutoStop()
    }

    // MARK: - Enregistrer un pari
    func recordBet(won: Bool, stake: Double, numberPlayed: [Int]) {
        if won {
            let payoutMultiplier = 36.0 / Double(max(1, numberPlayed.count))
            session.recordWin(amount: stake * (payoutMultiplier - 1), wagered: stake)
        } else {
            session.recordLoss(wagered: stake)
        }

        bankroll = session.currentBankroll
        refreshDecision()
        checkAutoStop()
    }

    // MARK: - Recalcul complet de la décision
    func refreshDecision() {
        // Score Chi-Square
        chiSquareScore = ChiSquareAnalyzer.chiSquareValue(spins: spins)

        // Heatmap
        heatmap = ChiSquareAnalyzer.generateHeatmap(spins: spins)

        // Recommandation automatique de profil
        autoRecommendation = StrategySelector.autoSelect(
            spins: spins,
            session: session,
            currentProfile: selectedProfile
        )

        // Décision principale
        currentDecision = StrategySelector.makeDecision(
            spins: spins,
            session: session,
            profile: selectedProfile,
            moneyMode: moneyMode,
            bankroll: bankroll
        )
    }

    // MARK: - Vérification arrêt automatique
    private func checkAutoStop() {
        let stopCheck = MoneyManagementEngine.checkStops(
            session: session,
            profile: selectedProfile,
            isX2Mode: isX2Mode
        )

        if stopCheck.shouldStop, let reason = stopCheck.reason {
            handleStop(reason: reason)
        }
    }

    private func handleStop(reason: MoneyManagementEngine.StopReason) {
        switch reason {
        case .takeProfitReached, .x2Target:
            celebrationMessage = reason.rawValue
            showCelebration = true
            streakSessions += 1

        case .consecutiveLosses, .disciplineAlert:
            triggerTiltLock(duration: 120)  // 2 minutes

        case .stopLossReached:
            triggerTiltLock(duration: 60)

        case .timeLimit:
            triggerTiltLock(duration: 30)
        }
    }

    // MARK: - Anti-Tilt Lock
    func triggerTiltLock(duration: Int = 120) {
        isTiltLocked = true
        tiltCooldownRemaining = duration

        cooldownTimer?.cancel()
        cooldownTimer = Timer.publish(every: 1, on: .main, in: .common)
            .autoconnect()
            .sink { [weak self] _ in
                guard let self else { return }
                if self.tiltCooldownRemaining > 0 {
                    self.tiltCooldownRemaining -= 1
                } else {
                    self.isTiltLocked = false
                    self.cooldownTimer?.cancel()
                }
            }
    }

    // MARK: - Déblocage manuel
    func unlockTilt() {
        isTiltLocked = false
        tiltCooldownRemaining = 0
        cooldownTimer?.cancel()
    }

    // MARK: - Mode X2
    func toggleX2Mode() {
        isX2Mode.toggle()
        refreshDecision()
    }

    // MARK: - Nouvelle session
    func resetSession() {
        session = SessionStats(bankroll: bankroll)
        isTiltLocked = false
        tiltCooldownRemaining = 0
        cooldownTimer?.cancel()
        refreshDecision()
    }

    // MARK: - Réinitialiser tous les spins
    func resetSpins() {
        spins = []
        saveSpins()
        refreshDecision()
    }

    // MARK: - Changer de profil
    func switchProfile(to profile: StrategyProfile) {
        selectedProfile = profile
        refreshDecision()
    }

    // MARK: - Backtest sur les 50 derniers spins
    func runBacktest() -> [BacktestResult] {
        return StrategyProfile.allCases.map { profile in
            MoneyManagementEngine.backtest(
                spins: spins,
                initialBankroll: session.startBankroll,
                profile: profile,
                windowSize: 50
            )
        }
    }

    // MARK: - Numéros Hot / Cold
    var hotNumbers: [Int] { ChiSquareAnalyzer.hotNumbers(spins: spins) }
    var coldNumbers: [Int] { ChiSquareAnalyzer.coldNumbers(spins: spins) }

    // MARK: - Dernier spin
    var lastSpin: SpinData? { spins.last }
    var recentSpins: [SpinData] { Array(spins.suffix(20).reversed()) }

    // MARK: - Persistance JSON
    private func saveSpins() {
        guard let data = try? JSONEncoder().encode(spins) else { return }
        UserDefaults.standard.set(data, forKey: spinsKey)
    }

    private func loadSpins() {
        guard let data = UserDefaults.standard.data(forKey: spinsKey),
              let saved = try? JSONDecoder().decode([SpinData].self, from: data)
        else { return }
        spins = saved
    }
}

// MARK: - Extension utilitaire
private extension Double {
    var nonZero: Double? { self == 0 ? nil : self }
}
