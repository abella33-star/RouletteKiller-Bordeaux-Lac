# 🎰 Roulette Killer – Barrière Bordeaux Lac

> **Système décisionnel ELITE** pour roulette européenne — iOS 18+ / iPhone 16 optimisé
> Architecture MVVM · SwiftUI · Zero dépendances externes · Dark Mode exclusif

---

## 🚀 Description

**Roulette Killer** est un système d'aide à la décision statistique pour la roulette européenne, conçu spécifiquement pour le Casino Barrière Bordeaux Lac.
Il combine les meilleures stratégies issues de 3 approches IA (Grok, ChatGPT, Claude) pour maximiser les opportunités à court terme et imposer une discipline stricte.

> ⚠️ **Avertissement** : Ce système n'est pas une garantie de gains. La roulette est un jeu de hasard pur (House Edge = 2.7%). Cet outil optimise uniquement la gestion du risque et la discipline comportementale.

---

## 🏗️ Architecture du Projet

```
RouletteKiller/
├── RouletteKiller.xcodeproj/
│   └── project.pbxproj
└── RouletteKiller/
    ├── RouletteKillerApp.swift          # Point d'entrée @main
    ├── ContentView.swift                # Écran principal (écran unique)
    │
    ├── Models/
    │   ├── SpinData.swift               # Données spin + couleur + zone
    │   ├── RouletteProfile.swift        # Profils stratégiques + BettingDecision
    │   └── SessionStats.swift           # Stats session + BacktestResult
    │
    ├── ViewModels/
    │   └── RouletteViewModel.swift      # ViewModel principal MVVM
    │
    ├── Engines/                         # Moteurs de calcul (zero UI)
    │   ├── OpportunityScoreEngine.swift # Score 0-100 (Momentum+Clustering)
    │   ├── ChiSquareAnalyzer.swift      # Détection variance Chi-Square
    │   ├── MoneyManagementEngine.swift  # Money management + Backtest
    │   └── StrategySelector.swift      # Sélection auto profil + décision
    │
    ├── Views/
    │   ├── Dashboard/
    │   │   └── DecisionCardView.swift   # Carte STRIKE / NO PLAY
    │   ├── Components/
    │   │   ├── CircularGaugeView.swift  # Jauge circulaire géante
    │   │   └── BankrollHeaderView.swift # En-tête bankroll + mini-stats
    │   ├── SpinInput/
    │   │   └── SpinInputView.swift      # Grille 3×12 saisie ultra-rapide
    │   ├── History/
    │   │   └── HistoryView.swift        # Historique 20 derniers spins
    │   ├── Strategy/
    │   │   └── StrategyProfilesView.swift # Cartes profils swipeables
    │   ├── Backtest/
    │   │   └── BacktestView.swift       # Simulation 50 derniers spins
    │   ├── Settings/
    │   │   └── BankrollSettingsView.swift # Sheet réglage bankroll
    │   └── AntiTilt/
    │       └── AntiTiltView.swift       # Écran cooldown 2min bloquant
    │
    └── Extensions/
        └── Color+Casino.swift           # Palette casino + modificateurs
```

---

## 🧠 Algorithmes Clés

### 1. Opportunity Score Engine (Score 0–100)
```
Score Final = Momentum (40%) + Clustering (30%) + Anomalie Chi-Square (30%)
```

| Score | Signal | Action |
|-------|--------|--------|
| < 40  | DEAD MARKET 🔴 | Bloquer le jeu |
| 40–70 | NEUTRE 🟡 | Attendre |
| > 70  | OPPORTUNITÉ ✅ | Jouer |
| > 85  | STRIKE 🔥 | Fenêtre rare |

### 2. Analyse Chi-Square (Variance)
- Calcule χ² sur les 37 derniers spins
- χ² élevé = déséquilibre statistique = potentielle opportunité
- Seuils : DÉFENSE (60) / ÉQUILIBRE (70) / ATTAQUE (80)

### 3. Trois Profils Stratégiques

| Profil | Stratégie | Mise | TP | SL | Numéros |
|--------|-----------|------|----|----|---------|
| DÉFENSE | Secteurs Couplés | 0.5% | +10% | -5% | 24 |
| ÉQUILIBRE | Mix Couplés + Cold Hunt | 1.0% | +15% | -10% | 15 |
| ATTAQUE | Cold Hunt seul | 1.5% | +20% | -15% | 3 |

### 4. Money Management (3 modes)
- **SAFE** : Mise fixe constante
- **ADAPTATIF** : Ajustement selon performance session
- **ATTAQUE MAX** : Progression après gains uniquement (jamais après pertes)

---

## 📱 Fonctionnalités

- ✅ **Jauge circulaire géante** (0-100) avec animation Spring + feux d'artifice à 85+
- ✅ **STRIKE / NO PLAY** en un coup d'œil
- ✅ **Grille saisie ultra-rapide** 3×12 avec hot/cold/recommended
- ✅ **Historique 20 spins** avec heatmap couleurs
- ✅ **3 profils stratégiques** avec cartes swipeables
- ✅ **Sélection automatique** du meilleur profil
- ✅ **Backtest live** sur 50 derniers spins (3 profils en parallèle)
- ✅ **Anti-Tilt** avec cooldown 2 minutes bloquant
- ✅ **Take Profit Auto** (+10/15/20%) avec célébration
- ✅ **Mode X2 Bankroll** objectif +50% avec stops stricts
- ✅ **Score Discipline** (0-100) psycho-tracking
- ✅ **Gamification** : Streak sessions, niveaux (ROOKIE→KILLER)
- ✅ **Persistance complète** (UserDefaults + JSON)
- ✅ **Bankroll live** + profit session en %

---

## 🛠️ Build & Installation

### Prérequis
- Xcode 16.0+
- iOS 18.0+ SDK
- Apple Developer Account (pour déploiement device)
- iPhone 16 / 16 Pro / 16 Pro Max recommandé

### Étapes

```bash
# 1. Cloner le repo
git clone https://github.com/ton-username/RouletteKiller.git
cd RouletteKiller

# 2. Ouvrir dans Xcode
open RouletteKiller.xcodeproj

# 3. Sélectionner le target
# Target: RouletteKiller
# Scheme: RouletteKiller

# 4. Configurer le Bundle ID
# PRODUCT_BUNDLE_IDENTIFIER = com.tonnom.roulettekiller

# 5. Build & Run (⌘R)
```

### Configuration Signing
1. Ouvrir `RouletteKiller.xcodeproj` dans Xcode
2. Sélectionner le target `RouletteKiller`
3. Tab "Signing & Capabilities"
4. Changer Team → votre Apple ID
5. Bundle Identifier → `com.tonnom.roulettekiller`

---

## 📊 Guide d'Utilisation en Casino

### Workflow Standard
```
1. Ouvrir l'app → Régler Bankroll (bouton €)
2. Choisir Profil : ÉQUILIBRE recommandé pour débuter
3. Saisir les 10-15 premiers spins SANS miser (calibration)
4. Attendre STRIKE (vert) avant de jouer
5. Miser EXACTEMENT la mise recommandée
6. Arrêter DÈS que Take Profit ou Stop Loss atteint
```

### Règles D'OR
- **Ne jamais jouer si Score < 55**
- **Ne jamais augmenter la mise après une perte**
- **Respecter TOUJOURS le Stop Loss**
- **Quitter si tilt lock se déclenche**
- **Maximum 1h30 de session**

---

## 🔄 Merger sur GitHub

```bash
# Depuis la branche de développement
git checkout claude/roulette-killer-ios-app-OVyPm
git add .
git commit -m "feat: Roulette Killer iOS app - système décisionnel ELITE"

# Créer Pull Request vers main
gh pr create --title "Roulette Killer – Système ELITE iOS" \
  --body "Application iOS complète avec 4 moteurs IA, 3 profils stratégiques, backtest live"

# Après review
git checkout main
git merge claude/roulette-killer-ios-app-OVyPm
git push origin main
```

---

## 🌐 Version Web Lite (Vercel – Future)

```bash
# Stack recommandée
npx create-next-app@latest roulette-killer-web --typescript --tailwind

# Composants à porter depuis Swift
# - OpportunityScoreEngine.ts (logique pure)
# - ChiSquareAnalyzer.ts
# - MoneyManagementEngine.ts
# - UI avec Recharts pour les graphiques

# Deploy
vercel --prod
```

---

## 📄 License

Usage personnel uniquement. Optimisé exclusivement pour Casino Barrière Bordeaux Lac.

---

**PROJET TERMINÉ — PRÊT À MERGER SUR GITHUB** 🚀
