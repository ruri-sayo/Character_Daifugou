class Card {
    constructor(suit, rank) {
        this.suit = suit; // 's', 'h', 'd', 'c'
        this.rank = rank; // 1(A) to 13(K)
        // 3=0, 4=1, ..., 2=12 for sorting
        this.strength = Card.getStrength(rank);
    }

    static getStrength(rank, isRevolution = false) {
        // 3=0, 4=1, ..., 2=12 (Normal)
        // 3=12, 4=11, ..., 2=0 (Revolution)
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
        this.hasPassed = false;
        this.rank = null; // 'millionaire', 'wealthy', 'commoner', 'poor'
    }

    addCards(cards) {
        this.hand.push(...cards);
        this.sortHand();
    }

    sortHand(isRevolution = false) {
        this.hand.sort((a, b) => Card.getStrength(a.rank, isRevolution) - b.getStrength(b.rank, isRevolution));
    }

    removeCards(cardsToRemove) {
        this.hand = this.hand.filter(c => !cardsToRemove.includes(c));
    }

    play(context) {
        // To be overridden or handled by controller
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

        // Removed sync init call. Waiting for startGame() to call init logic or re-instantiate.
        // Actually, logic is: user clicks Start -> proceedToGame() -> new GameMaster() -> init()
        this.init();
    }

    async init() {
        // Load Character Data
        let charData = [];
        try {
            const res = await fetch('data/charactor.json');
            charData = await res.json();
        } catch (e) {
            console.error("Failed to load char data", e);
            charData = [
                { id: "player", name: "あなぁE, isCpu: false },
                { id: "shiina", name: "椎奁E, isCpu: true },
                { id: "saki", name: "佐紀", isCpu: true },
                { id: "yuka", name: "優花", isCpu: true }
            ];
        }

        // Initialize Players
        // 0: You, 1: Shiina (Right), 2: Saki (Top), 3: Yuka (Left)
        const pData = charData.find(c => c.id === 'player') || charData[0];
        const p0 = new Player(0, pData.name, false);
        p0.params = pData.params;
        this.players.push(p0);

        // CPUs
        const cpuIds = ['shiina', 'saki', 'yuka'];
        cpuIds.forEach((id, idx) => {
            const data = charData.find(c => c.id === id);
            const cpu = new AIPlayer(idx + 1, data ? data.name : id);
            if (data) cpu.params = data.params;
            this.players.push(cpu);
        });

        this.deck.shuffle();

        // Deal 13 cards to each
        this.players.forEach(p => p.addCards(this.deck.deal(13)));

        this.renderAll();
        // Start Turn handled by proceedToGame logic delayed call or immediate if we want
        this.startTurn();
    }

    renderAll() {
        // Player Hand
        this.renderPlayerHand();
        // CPU Hands (Just counts)
        this.renderCPUHands();
    }

    renderPlayerHand() {
        const handDiv = document.getElementById('player-hand');
        handDiv.innerHTML = '';
        const player = this.players[0];

        // Simple List Display (No Fan)
        player.hand.forEach((card, idx) => {
            const el = document.createElement('div');
            el.className = 'hand-card card';
            if (['h', 'd'].includes(card.suit)) el.classList.add('suit-red');
            else el.classList.add('suit-black');

            // Display Suit + Number
            const rankStr = this.getRankDisplay(card.rank);
            el.innerHTML = `
                <div class="text-xs font-bold flex justify-between">
                    <span>${card.suit === 's' ? '♠' : card.suit === 'h' ? '♥' : card.suit === 'd' ? '♦' : '♣'}</span>
                    <span>${rankStr}</span>
                </div>
                <!-- Center Rank Display -->
                <div class="text-2xl text-center self-center font-bold">${rankStr}</div>
                
                <div class="text-xs font-bold self-end transform rotate-180 flex justify-between w-full">
                    <span>${card.suit === 's' ? '♠' : card.suit === 'h' ? '♥' : card.suit === 'd' ? '♦' : '♣'}</span>
                    <span>${rankStr}</span>
                </div>
            `;
            el.dataset.idx = idx;
            el.onclick = () => this.toggleSelect(el);

            // Standard spacing
            el.style.transform = 'none';
            // Handled by CSS

            handDiv.appendChild(el);
        });

        // Update Buttons
        const canPlay = document.querySelectorAll('.hand-card.selected').length > 0;
        document.getElementById('play-btn').disabled = !canPlay;
    }

    getRankDisplay(rank) {
        if (rank === 1) return 'A';
        if (rank === 11) return 'J';
        if (rank === 12) return 'Q';
        if (rank === 13) return 'K';
        return rank;
    }

    renderCPUHands() {
        for (let i = 1; i <= 3; i++) {
            const el = document.getElementById(`count-${i}`);
            if (el) el.innerText = this.players[i].hand.length;
        }
    }

    toggleSelect(el) {
        el.classList.toggle('selected');
        // Validate
        const selectedEls = document.querySelectorAll('.hand-card.selected');
        const selectedIndices = Array.from(selectedEls).map(el => parseInt(el.dataset.idx));
        const player = this.players[0];
        const selectedCards = selectedIndices.map(i => player.hand[i]);

        let isValid = false;
        if (selectedCards.length > 0) {
            isValid = this.validateMove(player, selectedCards);
        }

        document.getElementById('play-btn').disabled = !isValid;
    }

    validateMove(player, cards) {
        // 0. Same Rank Check
        const firstRank = cards[0].rank;
        if (!cards.every(c => c.rank === firstRank)) return false;

        // 0.5. Sequence Check (Stairs/Sequence) - Not implemented in v0, just checking same rank
        // Proposal says "v0 simple rules" -> implies simple play only, maybe stairs are not top priority? 
        // Docs did not specify sequence rules explicitly in v0.1 exclusions, but let's stick to simple "Same Rank" sets.

        // 1. Field Empty? -> Any valid set is OK
        if (this.fieldCards.length === 0) return true;

        // 2. Field Not Empty
        // 2.1 Count must match
        if (cards.length !== this.fieldCards.length) return false;

        // 2.2 Strength Check
        const myStrength = Card.getStrength(cards[0].rank, this.isRevolution);
        const fieldStrength = Card.getStrength(this.fieldCards[0].rank, this.isRevolution);

        return myStrength > fieldStrength;
    }

    startTurn() {
        if (this.players.length === 0) return; // Safety check
        const player = this.players[this.currentTurnIndex];
        this.setActivePlayerIndicator(this.currentTurnIndex);

        if (player.isCpu) {
            setTimeout(() => {
                player.play(this);
            }, 1000); // Wait a bit for "thinking"
        } else {
            console.log("Your turn");
            // Enable UI interaction
        }
    }

    setActivePlayerIndicator(index) {
        document.querySelectorAll('.icon-container > div:first-child').forEach(el => el.classList.remove('active-turn'));
        if (index !== 0) {
            const area = document.getElementById(`player-area-${index}`);
            if (area) {
                const icon = area.querySelector('.icon-container > div:first-child');
                if (icon) icon.classList.add('active-turn');
            }
        }
    }

    playCardAction(player, cards) {
        if (!this.validateMove(player, cards)) {
            console.warn("Invalid Move attempt", cards);
            return;
        }

        console.log(`${player.name} played ${cards.length} cards`);

        // Remove from hand
        player.removeCards(cards);

        // Update field
        this.fieldCards = cards;
        this.renderField(cards);

        // Check Win
        if (player.hand.length === 0) {
            alert(`${player.name} finished!`);
            return;
        }

        // --- Rules Check ---

        // 1. Revolution (4 or more cards)
        if (cards.length >= 4) {
            this.isRevolution = !this.isRevolution;
            const board = document.querySelector('.game-board');
            if (this.isRevolution) {
                board.classList.add('revolution-mode');
                this.players.forEach(p => p.sortHand(this.isRevolution));
            } else {
                board.classList.remove('revolution-mode');
                this.players.forEach(p => p.sortHand(this.isRevolution));
            }
        }

        // 2. 8-giri check
        const isEight = cards.some(c => c.rank === 8);
        if (isEight) {
            console.log("8-giri!");
            // Clear field immediately
            setTimeout(() => {
                this.fieldCards = [];
                this.renderField([]);
                this.passCount = 0;
                // Same player's turn again
                this.startTurn();
            }, 1000);
            this.renderAll();
            return; // Do NOT call nextTurn
        }

        this.passCount = 0;
        this.renderAll();
        this.nextTurn();
    }

    passAction(player) {
        console.log(`${player.name} passed`);
        player.hasPassed = true;
        this.passCount++;

        if (this.passCount >= 3) {
            this.fieldCards = [];
            this.renderField([]);
            this.passCount = 0;
        }

        this.nextTurn();
    }

    renderField(cards) {
        const field = document.getElementById('field-area');
        field.innerHTML = ''; // Clear "FIELD" text

        cards.forEach((card, idx) => {
            const el = document.createElement('div');
            el.className = 'card field-card';
            if (['h', 'd'].includes(card.suit)) el.classList.add('suit-red');
            else el.classList.add('suit-black');
            el.innerHTML = `
                <div class="text-xs font-bold">${card.suit === 's' ? '♠' : card.suit === 'h' ? '♥' : card.suit === 'd' ? '♦' : '♣'}</div>
                <div class="text-2xl text-center self-center font-bold">${this.getRankDisplay(card.rank)}</div>
                <div class="text-xs font-bold self-end transform rotate-180">${card.suit === 's' ? '♠' : card.suit === 'h' ? '♥' : card.suit === 'd' ? '♦' : '♣'}</div>
            `;
            // Stagger cards slightly
            el.style.left = `calc(50% - 20px + ${idx * 15}px)`;
            field.appendChild(el);
        });
    }

    nextTurn() {
        this.currentTurnIndex = (this.currentTurnIndex + 1) % 4;
        this.startTurn();
    }
}

// Global Game Control
let gm;

function startGame() {
    // Hide Home, Show Game
    document.getElementById('home-screen').classList.add('hidden');
    document.getElementById('select-screen').classList.remove('hidden');
}

function proceedToGame() {
    // Called from Select Screen
    document.getElementById('select-screen').classList.add('hidden');
    document.getElementById('game-screen').classList.remove('hidden');

    gm = new GameMaster();
    // GM init is async, so startTurn might be called inside init or here.
    // GM constructor calls init(). init() is async.
    // So init() will return a promise locally but constructor returns object.
    // GM calls startTurn at end of init(). So valid.
}

function returnHome() {
    if (confirm("こ�Eゲームには戻れません。�Eームに戻りますか�E�E)) {
        location.reload();
    }
}
class AIEngine {
    /**
     * 最適な手を決定するメインメソチE��
     * @param {Player} player 思老E��る�Eレイヤー (paramsプロパティを持つこと)
     * @param {Array<Card>|null} fieldCards 場のカーチE
     * @param {boolean} isRevolution 革命状態かどぁE��
     * @returns {Array<Card>|null} 出すカード�E列（パスならnull�E�E
     */
    static think(player, fieldCards, isRevolution) {
        // charactor.jsonから読み込まれたparamsを使用、なければチE��ォルチE
        const defaultParams = { w_attack: 0.5, w_defense: 0.5, w_revolution: 0.5, w_trump: 0.5, epsilon: 0.1 };
        const params = player.params || defaultParams;

        // 1. 合法手の列挙
        const moves = this.getLegalMoves(player.hand, fieldCards, isRevolution);

        // 2. スコアリング
        moves.forEach(move => {
            move.score = this.calculateScore(move, player.hand, fieldCards, isRevolution, params);
        });

        // 3. めE��ぎと選抁E
        // スコアが高い頁E��ソート（ランダム性込み�E�E
        moves.sort((a, b) => b.score - a.score);

        // チE��チE��用ログ
        // console.log(`${player.name}の手候裁E`, moves.map(m => `${m.type}:${m.score.toFixed(1)}`).join(', '));

        const bestMove = moves[0];
        return bestMove.cards;
    }

    /**
     * 合法手�E��Eせるカード�E絁E��合わせ）をすべて列挙する
     * パスめEつの手として含む
     */
    static getLegalMoves(hand, fieldCards, isRevolution) {
        const moves = [];

        // 常にパスは選択肢にある
        moves.push({ cards: null, type: 'PASS' });

        // 手札をランクごとにグルーピング
        const groups = {};
        hand.forEach(c => {
            if (!groups[c.rank]) groups[c.rank] = [];
            groups[c.rank].push(c);
        });

        // 場の状況に応じた制陁E
        let reqCount = 0;
        let minStrength = -1;

        if (fieldCards && fieldCards.length > 0) {
            reqCount = fieldCards.length;
            // Use rank from field card
            minStrength = Card.getStrength(fieldCards[0].rank, isRevolution);
        }

        // 吁E��ンクにつぁE��探索
        for (const rankStr in groups) {
            const rank = parseInt(rankStr);
            const cards = groups[rankStr];
            const strength = Card.getStrength(rank, isRevolution);

            // 場にカードがある場合：枚数が同ぁEかつ 強ぁE��E��がある
            if (reqCount > 0) {
                if (cards.length >= reqCount && strength > minStrength) {
                    moves.push({
                        cards: cards.slice(0, reqCount),
                        type: reqCount === 1 ? 'SINGLE' : 'MULTIPLE',
                        strength: strength,
                        rank: rank
                    });
                }
            }
            // 場にカードがなぁE��合：�Eての絁E��合わせ！E枚、E枚）が可能
            else {
                for (let n = 1; n <= cards.length; n++) {
                    moves.push({
                        cards: cards.slice(0, n),
                        type: n === 1 ? 'SINGLE' : 'MULTIPLE',
                        strength: strength,
                        rank: rank
                    });
                }
            }
        }

        return moves;
    }

    /**
     * 評価関数�E�各手�Eスコアを計箁E
     */
    static calculateScore(move, hand, fieldCards, isRevolution, params) {
        // --- 1. ノイズ付丁E(Random Epsilon) ---
        let score = (Math.random() * 2 - 1) * 50 * params.epsilon;

        // --- パスの場吁E---
        if (move.type === 'PASS') {
            return score;
        }

        const cards = move.cards;
        const count = cards.length;
        const strength = move.strength; // 0~12

        // --- A. 基本スコア (S_base) ---
        score += 100 * params.w_attack;

        // --- B. インパクト�Eーナス (S_impact) ---
        score += strength * 5;
        score += (count - 1) * 20;

        // 8刁E��ボ�Eナス
        const is8 = cards.some(c => c.rank === 8);
        if (is8) {
            score += 50 * (params.w_attack + params.w_defense);
        }

        // --- C. リスク・コスチE(S_risk) ---

        // 終盤度係数
        const endgameFactor = (13 - hand.length) / 13;

        // 刁E��札消費ペナルチE��
        const maxStrength = 12;
        if (strength === maxStrength) {
            const penalty = 100 * params.w_trump * (1.0 - endgameFactor);
            score -= penalty;
        }

        // ペア崩し�EナルチE��
        const sameRankTotal = hand.filter(c => c.rank === move.rank).length;
        if (sameRankTotal > count) {
            score -= 60 * params.w_defense;
        }

        // --- D. 特殊�Eーナス (S_bonus) ---

        // 革命ボ�Eナス
        if (count >= 4) {
            score += 150 * params.w_revolution;
        }

        // あがり�Eーナス
        if (hand.length === count) {
            score += 10000;
        }

        return score;
    }
}

class AIPlayer extends Player {
    constructor(id, name) {
        super(id, name, true);
    }

    play(gm) {
        const cardsToPlay = AIEngine.think(this, gm.fieldCards, gm.isRevolution);

        if (cardsToPlay) {
            this.speak(this.getPlayPhrase());
            gm.playCardAction(this, cardsToPlay);
        } else {
            this.speak(this.getPassPhrase());
            gm.passAction(this);
        }
    }

    speak(msg) {
        const bubble = document.getElementById(`msg-${this.id}`);
        if (bubble) {
            bubble.innerText = msg;
            bubble.classList.add('visible');
            setTimeout(() => {
                bubble.classList.remove('visible');
            }, 2000);
        }
    }

    getPlayPhrase() {
        const phrases = ["これならどぁE��E, "はぁE��", "ぁE��わよ�E�E];
        return phrases[Math.floor(Math.random() * phrases.length)];
    }

    getPassPhrase() {
        const phrases = ["パス...", "無琁E��めE, "お�EにどぁE��"];
        return phrases[Math.floor(Math.random() * phrases.length)];
    }
}
