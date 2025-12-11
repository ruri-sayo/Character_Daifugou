class Card {
    constructor(suit, rank) {
        this.suit = suit; // 's', 'h', 'd', 'c'
        this.rank = rank; // 1(A) to 13(K)
        this.strength = Card.getStrength(rank);
    }

    static getStrength(rank, isRevolution = false) {
        let strength;
        if (rank === 1) strength = 12; // Ace
        else if (rank === 2) strength = 13; // 2
        else strength = rank - 3;

        if (isRevolution) {
            return 13 - strength;
        }
        return strength;
    }

    getDisplayStr() {
        const suits = { 's': '♠', 'h': '♥', 'd': '♦', 'c': '♣' };
        const ranks = { 1: 'A', 11: 'J', 12: 'Q', 13: 'K' };
        return suits[this.suit] + (ranks[this.rank] || this.rank);
    }
}

class Deck {
    constructor() {
        this.cards = [];
        const suits = ['s', 'h', 'd', 'c'];
        for (let s of suits) {
            for (let r = 1; r <= 13; r++) {
                this.cards.push(new Card(s, r));
            }
        }
    }

    shuffle() {
        for (let i = this.cards.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
        }
    }

    deal(count) {
        return this.cards.splice(0, count);
    }
}

class Player {
    constructor(id, name, isCpu = false) {
        this.id = id;
        this.name = name;
        this.isCpu = isCpu;
        this.hand = [];
        this.rank = null; // 'millionaire'(1), 'wealthy'(2), 'commoner'(3), 'poor'(4)
        this.rankInt = 0; // 1-4
    }

    addCards(cards) {
        this.hand.push(...cards);
        this.sortHand();
    }

    sortHand(isRevolution = false) {
        this.hand.sort((a, b) => Card.getStrength(a.rank, isRevolution) - Card.getStrength(b.rank, isRevolution));
    }

    removeCards(cardsToRemove) {
        this.hand = this.hand.filter(c => !cardsToRemove.includes(c));
    }

    play(context) {
        console.log(`${this.name} turn`);
    }
}

class GameMaster {
    constructor() {
        this.players = [];
        this.deck = new Deck();
        this.fieldCards = [];
        this.currentTurnIndex = 0;
        this.isRevolution = false;
        this.passCount = 0;
        this.rankings = []; // List of players in order of finish
        this.roundCount = 0;

        this.activeIds = []; // IDs of players in current game
        this.charData = [];
    }

    async init(charData, orderedIds) {
        this.charData = charData;
        this.activeIds = orderedIds;
        this.startNewGame(true); // First game
    }

    startNewGame(isFirst = false) {
        this.players = [];
        this.fieldCards = [];
        this.isRevolution = false;
        this.passCount = 0;
        this.rankings = [];
        this.deck = new Deck();
        this.deck.shuffle();

        // Re-construct players based on activeIds to keep order
        // 0: Bottom (Player), 1: Right, 2: Top, 3: Left
        if (this.activeIds.length !== 4) {
            console.error("Invalid IDs count");
            return;
        }

        // Logic Mapping:
        // Turn order follows array order: 0 -> 1 -> 2 -> 3
        this.activeIds.forEach((id, idx) => {
            const data = this.charData.find(c => c.id === id);
            let p;
            if (id === 'player') {
                p = new Player(0, data.name, false);
            } else {
                // For CPUs, we assign IDs 1, 2, 3 based on slot index for UI mapping
                // But wait, if we shuffle, 'player' might be at index 2?
                // Requirement: "Player" is always at bottom (ID 0) visually?
                // No, requirement says "Character Order Selection".
                // "上から順に時計回り(右→対面→左)に配置されます。"
                // Implicitly, Player is fixed at "Bottom"? Or Player can move?
                // Usually Player is fixed. The "Order" means the OPPONENTS order?
                // "順番を決めてください" usually means turn order / seating.
                // If Player is fixed at Bottom, we only order the 3 opponents.
                // Let's assume Player is fixed at Index 0 (Bottom), and we strictly order the 3 opponents (Right, Top, Left).
                // IF the user wants "Random Start", basically we just shuffle the opponents.

                // However, "Turn Order" is usually determined by Diamond 3.
                // So Seating Order = Turn Order Candidate.

                // Let's stick to: Player is fixed ID 0.
                // orderedIds contains [op1, op2, op3] ?
                // No, activeIds should contain ALL 4? 
                // If `proceedToOrder` passed only opponents, we add 'player' at start?
                // Let's assume `activeIds` includes 'player'.
            }

            // Actually, keep it simple.
            // Player is always ID 0 (Human).
            // Opponents are ID 1, 2, 3.
            // When we "Order", we map the selected characters to ID 1, 2, 3.
            // So orderedIds should be array of ['shiina', 'saki', 'yuka'] (size 3) or similar.

            // ... Wait, if I shuffle, does Player stay at 0?
            // "上から順に時計回り(右→対面→左)" -> List on screen maps to Right, Top, Left.
            // Player is not in the list?
            // "対戦相手を3人選んでください" -> Select 3.
            // Then "Order Screen" checks order of these 3.
            // Okay. Player is separate.
        });

        // Setup Player (Fixed ID 0)
        const pData = this.charData.find(c => c.id === 'player');
        const p0 = new Player(0, pData.name, false);
        p0.params = pData.params;
        // Carry over rank from previous game if exists?
        // For v1.5, we just re-create. Rank tracking needs persistence if we want exchange.
        // We need to persist rank info outside of Player instance if we re-create them.
        // OR we reuse Player instances.

        // Let's re-create for simplicity BUT pass ranks.
        // Actually, better to create players ONCE and reuse.
        // Refactoring init logic.
    }

    // New Init Logic: Create Players once, then reset hands/deck.
    initPlayers(charData, opponentIdsSorted) {
        this.players = [];
        this.charData = charData;

        // Human
        const pData = charData.find(c => c.id === 'player');
        const p0 = new Player(0, pData.name, false);
        p0.params = pData.params;
        this.players.push(p0);

        // Opponents
        opponentIdsSorted.forEach((id, idx) => {
            const data = charData.find(c => c.id === id);
            // CP IDs: 1, 2, 3
            // dialogues passed here
            const cpu = new AIPlayer(idx + 1, data.name, data.dialogues);
            cpu.params = data.params;
            this.players.push(cpu);

            // UI Update
            this.updatePlayerInfoUI(idx + 1, data);
        });
    }

    async startRound(isFirst = false) {
        this.fieldCards = [];
        this.isRevolution = false;
        this.passCount = 0;
        this.rankings = [];
        this.deck = new Deck();
        this.deck.shuffle();

        // Reset hands
        this.players.forEach(p => {
            p.hand = [];
            p.hasPassed = false;
        });

        // Deal
        this.players.forEach(p => p.addCards(this.deck.deal(13)));

        // Handle Exchange if not first
        if (!isFirst) {
            await this.processExchange();
        }

        this.renderAll();

        // Determine Start Player (Diamond 3)
        let savedTurn = -1;
        this.players.forEach((p, idx) => {
            if (p.hand.some(c => c.suit === 'd' && c.rank === 3)) {
                savedTurn = idx;
            }
        });

        if (savedTurn === -1) {
            console.warn("No Diamond 3 found? Rare bug or deck issue.");
            savedTurn = Math.floor(Math.random() * 4);
        }

        this.currentTurnIndex = savedTurn;

        // UI Message
        const startP = this.players[this.currentTurnIndex];
        console.log(`Start Player: ${startP.name}`);

        this.startTurn();
    }

    async processExchange() {
        // Logic: 
        // 1st(Daifugou) <-> 4th(Daihinmin) (2 cards)
        // 2nd(Fugou) <-> 3rd(Hinmin) (1 card)

        // We need previous ranks. 
        // players[i].rankInt should be set from previous result.

        const rankMap = {}; // rankInt -> player
        this.players.forEach(p => rankMap[p.rankInt] = p);

        const daifugou = rankMap[1];
        const fugou = rankMap[2];
        const hinmin = rankMap[3];
        const daihinmin = rankMap[4];

        if (!daifugou || !daihinmin) return; // Should not happen

        // --- Execute Exchanges ---
        // 1. Daihinmin gives 2 strongest to Daifugou
        const cardsDToD = AIPlayer.selectExchangeCards(daihinmin, 2, false); // Losing side

        // 2. Hinmin gives 1 strongest to Fugou
        const cardsHToF = AIPlayer.selectExchangeCards(hinmin, 1, false);

        // 3. Daifugou gives 2 (Method?)
        // If Human, show UI. If AI, use logic.
        let cardsDaifugouToD = [];
        if (daifugou.isCpu) {
            cardsDaifugouToD = AIPlayer.selectExchangeCards(daifugou, 2, true);
        } else {
            cardsDaifugouToD = await this.promptUserExchange(2);
        }

        let cardsFugouToH = [];
        if (fugou.isCpu) {
            cardsFugouToH = AIPlayer.selectExchangeCards(fugou, 1, true);
        } else {
            cardsFugouToH = await this.promptUserExchange(1);
        }

        // Apply Swap
        this.performSwap(daihinmin, daifugou, cardsDToD, cardsDaifugouToD);
        this.performSwap(hinmin, fugou, cardsHToF, cardsFugouToH);

        // Sort again
        this.players.forEach(p => p.sortHand());
        alert("カード交換が完了しました");
    }

    performSwap(pFrom, pTo, cardsFrom, cardsTo) {
        pFrom.removeCards(cardsFrom);
        pTo.removeCards(cardsTo);
        pFrom.addCards(cardsTo);
        pTo.addCards(cardsFrom);
        console.log(`Swapped: ${pFrom.name} gave ${cardsFrom.length}, ${pTo.name} gave ${cardsTo.length}`);
    }

    promptUserExchange(count) {
        return new Promise(resolve => {
            alert(`あなたは${count === 2 ? '大富豪' : '富豪'}です。交換するカードを${count}枚選んでください。`);
            // Set UI state to 'exchange'
            // We need a proper UI mode for this. 
            // For v1.5 MVP, let's use a temporary handler on the "Play" button.
            const btn = document.getElementById('play-btn');
            const originalText = btn.innerText;
            btn.innerText = "交換する";
            btn.onclick = () => {
                const selectedEls = document.querySelectorAll('.hand-card.selected');
                if (selectedEls.length !== count) {
                    alert(`${count}枚選んでください`);
                    return;
                }
                const indices = Array.from(selectedEls).map(el => parseInt(el.dataset.idx));
                const cards = indices.map(i => this.players[0].hand[i]);

                // Restore UI
                btn.innerText = originalText;
                btn.onclick = humanPlay; // restore global

                resolve(cards);
            };
            // Enable button if selection matches
            // We need to hook into toggleSelect to enable button only if count matches
            // This is getting tricky. Let's hijack playCardAction logic or add a flag.
            this.isExchangeMode = true;
            this.exchangeCount = count;
            this.exchangeResolve = resolve;

            // Force re-render to update button state logic? 
            // toggleSelect needs to know we are in exchange mode.
        });
    }

    toggleSelect(el) {
        el.classList.toggle('selected');
        const selectedEls = document.querySelectorAll('.hand-card.selected');
        const count = selectedEls.length;

        let isValid = false;
        const btn = document.getElementById('play-btn');

        if (this.isExchangeMode) {
            // Exchange validation
            isValid = (count === this.exchangeCount);
        } else {
            // Normal validation
            const indices = Array.from(selectedEls).map(el => parseInt(el.dataset.idx));
            const player = this.players[0];
            const cards = indices.map(i => player.hand[i]);
            if (count > 0) {
                isValid = this.validateMove(player, cards);
            }
        }

        btn.disabled = !isValid;
    }

    // ... (Updated playCardAction to check for end game) ...
    playCardAction(player, cards) {
        // ... (Validation & Play logic) ...

        // Remove cards, Update Field...

        // Check Win
        if (player.hand.length === 0) {
            this.handlePlayerFinish(player);
            if (this.rankings.length === 3) {
                // Game Over (Last player is fixed)
                const lastPlayer = this.players.find(p => !this.rankings.includes(p));
                this.handlePlayerFinish(lastPlayer);
                this.finishGame();
                return;
            }
            // Skip turn for finished player in nextTurn?
        }

        // ... (Rules) ...
        // ... (Next Turn) ...
    }

    handlePlayerFinish(player) {
        console.log(`${player.name} Finished!`);
        this.rankings.push(player);

        // Assign provisional rank
        const order = this.rankings.length; // 1, 2, 3, 4
        player.rankInt = order;

        // UI: Remove hand or show "Waiting"
        // Also skip this player in rotation
    }

    nextTurn() {
        // Find next active player
        let nextIdx = this.currentTurnIndex;
        let loopCount = 0;
        do {
            nextIdx = (nextIdx + 1) % 4;
            loopCount++;
            if (loopCount > 10) break; // emergency break
        } while (this.players[nextIdx].hand.length === 0 && this.rankings.length < 3);

        this.currentTurnIndex = nextIdx;
        this.startTurn();
    }

    finishGame() {
        // Show Result Screen
        const screen = document.getElementById('result-screen');
        const list = document.getElementById('ranking-list');
        list.innerHTML = '';

        const rankNames = ['大富豪', '富豪', '貧民', '大貧民'];
        const rankClasses = ['ranking-1st', 'ranking-2nd', 'ranking-3rd', 'ranking-4th'];

        this.rankings.forEach((p, i) => {
            const div = document.createElement('div');
            div.className = `ranking-item ${rankClasses[i]} text-white`;
            div.innerHTML = `<span>${i + 1}位 (${rankNames[i]})</span> <span>${p.name}</span>`;
            list.appendChild(div);
        });

        screen.classList.remove('hidden');
    }

    // ... (render, validate, etc.) ...
}
