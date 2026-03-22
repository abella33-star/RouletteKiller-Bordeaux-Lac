import SwiftUI
import Combine
import Foundation

// MARK: - ViewModel Principal (MVVM) — Version ELITE
@MainActor
final class RouletteViewModel: ObservableObject {

    // MARK: - État de l'interface de base
    @Published var spins: [SpinData] = []
    @Published var session: SessionStats
    @Published var currentDecision: BettingDecision?
    @Published var selectedProfile: StrategyProfile = .equilibre
    @Published var moneyMode: MoneyManagementMode = .adaptive
    @Published var isX2Mode: Bool = false
    @Published var isTiltLocked: Bool = false
    @Published var tiltCooldownRemaining: Int = 0
    @Published var showCelebration: Bool = false
    @Published var celebrationMessage: String = ""
    @Published var chiSquareScore: Double = 0
    @Published var heatmap: [ChiSquareAnalyzer.SectorHeatmap] = []
    @Published var autoRecommendation: StrategySelector.Recommendation?

    // MARK: - Nouveaux états (moteurs ELITE)
    @Published var sessionPhase: SessionGuaranteeEngine.SessionPhase = .calibration
    @Published var sessionPlan: SessionGuaranteeEngine.SessionPlan?
    @Published var electronicScore: ElectronicRouletteAnalyzer.ElectronicScore?
    @Published var sectorBiases: [ElectronicRouletteAnalyzer.SectorBias] = []
    @Published var temporalPattern: ElectronicRouletteAnalyzer.TemporalPattern?
    @Published var profitLockMessage: String?
    @Published var exitSignal: ProfitLockEngine.ExitSignal?
    @Published var exitScore: Double = 0
    @Published var oscarState: WinProtectionEngine.OscarState
    @Published var selectedSystem: WinProtectionEngine.ProgressionSystem = .oscarsGrind
    @Published var showExitAlert: Bool = false
    @Published var rapidRepetitionScore: Double = 0

    // MARK: - Bankroll
    @AppStorage("bankroll") var bankroll: Double = 1000.0
    @AppStorage("streakSessions") var streakSessions: Int = 0

    private let spinsKey = "savedSpins"
    private var cooldownTimer: AnyCancellable?

    // MARK: - Init
    init() {
        let savedBankroll = UserDefaults.standard.double(forKey: "bankroll").nonZero ?? 1000.0
        self.session = SessionStats(bankroll: savedBankroll)
        self.oscarState = WinProtectionEngine.OscarState(unit: savedBankroll * 0.01)
        loadSpins()
        refreshDecision()
    }

    // MARK: - Ajouter un spin (point d'entrée principal)
    func addSpin(_ number: Int) {
        guard !isTiltLocked else { return }

        let spin = SpinData(number: number)
        spins.append(spin)

        if spins.count > 200 { spins.removeFirst() }

        saveSpins()
        refreshDecision()
        checkAutoStop()
    }

    // MARK: - Enregistrer un pari (résultat)
    func recordBet(won: Bool, stake: Double, numberPlayed: [Int]) {
        if won {
            let payoutMultiplier = 36.0 / Double(max(1, numberPlayed.count))
            session.recordWin(amount: stake * (payoutMultiplier - 1), wagered: stake)
            oscarState.afterWin()
        } else {
            session.recordLoss(wagered: stake)
            oscarState.afterLoss()
        }

        bankroll = session.currentBankroll
        refreshDecision()
        checkAutoStop()

        // Signal de sortie si profit vérouillé atteint
        if let lock = ProfitLockEngine.protectedExitThreshold(session: session),
           session.currentBankroll <= lock {
            showExitAlert = true
        }
    }

    // MARK: - Recalcul complet (appelé à chaque spin)
    func refreshDecision() {
        // === MOTEURS DE BASE ===
        chiSquareScore = ChiSquareAnalyzer.chiSquareValue(spins: spins)
        heatmap = ChiSquareAnalyzer.generateHeatmap(spins: spins)

        // === MOTEURS ELECTRONIQUE ===
        let elecScore = ElectronicRouletteAnalyzer.calculateElectronicScore(spins: spins)
        electronicScore = elecScore
        sectorBiases = ElectronicRouletteAnalyzer.analyzeSectorBias(spins: spins)
        temporalPattern = ElectronicRouletteAnalyzer.detectTemporalPattern(spins: spins)
        rapidRepetitionScore = ElectronicRouletteAnalyzer.rapidRepetitionScore(spins: spins)

        // === SCORE D'OPPORTUNITÉ FUSIONNÉ ===
        // On intègre le score électronique dans le score global
        let baseScore = OpportunityScoreEngine.calculateScore(spins: spins)
        let elecBonus = elecScore.overallScore * 0.20  // bonus 20% depuis analyse électronique
        let fusedScore = min(100, baseScore * 0.80 + elecBonus)

        // === SÉLECTEUR DE PROFIL AUTO ===
        autoRecommendation = StrategySelector.autoSelect(
            spins: spins,
            session: session,
            currentProfile: selectedProfile
        )

        // === PLAN SESSION GARANTIE ===
        let plan = SessionGuaranteeEngine.buildPlan(
            spins: spins,
            session: session,
            profile: selectedProfile,
            opportunityScore: fusedScore,
            electronicScore: elecScore
        )
        sessionPlan = plan
        sessionPhase = plan.phase

        // === DÉCISION PRINCIPALE ENRICHIE ===
        let optimalNums = spins.count >= 15
            ? SessionGuaranteeEngine.optimalNumbers(
                spins: spins,
                phase: plan.phase,
                profile: selectedProfile,
                electronicScore: elecScore
            )
            : []

        let baseDecision = StrategySelector.makeDecision(
            spins: spins,
            session: session,
            profile: selectedProfile,
            moneyMode: moneyMode,
            bankroll: bankroll
        )

        // Fusionner les numéros : priorité aux numéros électroniques + sélecteur
        let finalNumbers: [Int]
        if !optimalNums.isEmpty && baseDecision.shouldPlay {
            finalNumbers = Array(Set(optimalNums + baseDecision.recommendedNumbers))
                .prefix(selectedProfile.maxNumbers)
                .sorted()
        } else {
            finalNumbers = baseDecision.recommendedNumbers
        }

        currentDecision = BettingDecision(
            shouldPlay: baseDecision.shouldPlay && plan.phase != .calibration && plan.phase != .exitZone,
            opportunityScore: fusedScore,
            recommendedNumbers: finalNumbers,
            recommendedStake: plan.currentStake > 0 ? plan.currentStake : baseDecision.recommendedStake,
            rationale: plan.nextAction,
            profile: selectedProfile,
            estimatedProbability: Double(finalNumbers.count) / 37.0 * 100,
            potentialGain: plan.currentStake * (36.0 / Double(max(1, finalNumbers.count)) - 1),
            riskLevel: baseDecision.riskLevel
        )

        // === PROTECTION DES PROFITS ===
        profitLockMessage = ProfitLockEngine.activeLockMessage(session: session)
        exitSignal = ProfitLockEngine.shouldExitNow(session: session, opportunityScore: fusedScore)
        exitScore = SessionGuaranteeEngine.exitScore(
            session: session,
            opportunityScore: fusedScore,
            spins: spins
        )

        // === SYSTÈME DE PROGRESSION ===
        selectedSystem = WinProtectionEngine.recommendSystem(
            session: session,
            opportunityScore: fusedScore
        )
    }

    // MARK: - Stops automatiques
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
            triggerTiltLock(duration: 120)
        case .stopLossReached:
            triggerTiltLock(duration: 60)
        case .timeLimit:
            triggerTiltLock(duration: 30)
        }
    }

    // MARK: - Anti-Tilt
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
        oscarState = WinProtectionEngine.OscarState(unit: bankroll * 0.01)
        isTiltLocked = false
        tiltCooldownRemaining = 0
        showExitAlert = false
        cooldownTimer?.cancel()
        refreshDecision()
    }

    func resetSpins() {
        spins = []
        saveSpins()
        refreshDecision()
    }

    func switchProfile(to profile: StrategyProfile) {
        selectedProfile = profile
        refreshDecision()
    }

    // MARK: - Backtest
    func runBacktest() -> [BacktestResult] {
        StrategyProfile.allCases.map { profile in
            MoneyManagementEngine.backtest(
                spins: spins,
                initialBankroll: session.startBankroll,
                profile: profile,
                windowSize: 50
            )
        }
    }

    // MARK: - Helpers publics
    var hotNumbers: [Int] { ChiSquareAnalyzer.hotNumbers(spins: spins) }
    var coldNumbers: [Int] { ChiSquareAnalyzer.coldNumbers(spins: spins) }
    var lastSpin: SpinData? { spins.last }
    var recentSpins: [SpinData] { Array(spins.suffix(20).reversed()) }

    var dynamicNeighbors: [Int] {
        guard let last = spins.last else { return [] }
        return ElectronicRouletteAnalyzer.dynamicNeighbors(of: last.number, count: 5)
    }

    // MARK: - Persistance
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

private extension Double {
    var nonZero: Double? { self == 0 ? nil : self }
}
