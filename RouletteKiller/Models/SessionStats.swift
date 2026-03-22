import Foundation

// MARK: - Statistiques de session
struct SessionStats: Codable {
    var startBankroll: Double
    var currentBankroll: Double
    var startTime: Date
    var totalSpins: Int
    var wins: Int
    var losses: Int
    var consecutiveLosses: Int
    var consecutiveWins: Int
    var maxConsecutiveLosses: Int
    var peakBankroll: Double
    var lowestBankroll: Double
    var totalWagered: Double
    var disciplineScore: Double   // 0-100 (anti-tilt)
    var streakSessions: Int       // sessions gagnantes consécutives

    init(bankroll: Double) {
        self.startBankroll = bankroll
        self.currentBankroll = bankroll
        self.startTime = Date()
        self.totalSpins = 0
        self.wins = 0
        self.losses = 0
        self.consecutiveLosses = 0
        self.consecutiveWins = 0
        self.maxConsecutiveLosses = 0
        self.peakBankroll = bankroll
        self.lowestBankroll = bankroll
        self.totalWagered = 0
        self.disciplineScore = 100.0
        self.streakSessions = 0
    }

    var profitLoss: Double { currentBankroll - startBankroll }
    var profitLossPct: Double { startBankroll > 0 ? (profitLoss / startBankroll) * 100 : 0 }
    var winRate: Double { totalSpins > 0 ? Double(wins) / Double(totalSpins) * 100 : 0 }
    var roi: Double { totalWagered > 0 ? (profitLoss / totalWagered) * 100 : 0 }
    var maxDrawdown: Double {
        peakBankroll > 0 ? ((peakBankroll - lowestBankroll) / peakBankroll) * 100 : 0
    }
    var sessionDuration: TimeInterval { Date().timeIntervalSince(startTime) }

    mutating func recordWin(amount: Double, wagered: Double) {
        currentBankroll += amount
        wins += 1
        totalSpins += 1
        consecutiveLosses = 0
        consecutiveWins += 1
        totalWagered += wagered
        if currentBankroll > peakBankroll { peakBankroll = currentBankroll }
        updateDisciplineScore(isPositive: true)
    }

    mutating func recordLoss(wagered: Double) {
        currentBankroll -= wagered
        losses += 1
        totalSpins += 1
        consecutiveLosses += 1
        consecutiveWins = 0
        totalWagered += wagered
        if consecutiveLosses > maxConsecutiveLosses {
            maxConsecutiveLosses = consecutiveLosses
        }
        if currentBankroll < lowestBankroll { lowestBankroll = currentBankroll }
        updateDisciplineScore(isPositive: false)
    }

    private mutating func updateDisciplineScore(isPositive: Bool) {
        if isPositive {
            disciplineScore = min(100, disciplineScore + 2)
        } else {
            // Pénalité progressive selon les pertes consécutives
            let penalty = Double(consecutiveLosses) * 5.0
            disciplineScore = max(0, disciplineScore - penalty)
        }
    }
}

// MARK: - Résultat de backtest
struct BacktestResult: Identifiable {
    let id = UUID()
    let profile: StrategyProfile
    let roi: Double
    let winRate: Double
    let maxDrawdown: Double
    let totalTrades: Int
    let finalBankroll: Double
    let initialBankroll: Double

    var isPositive: Bool { roi > 0 }
    var profit: Double { finalBankroll - initialBankroll }
}
