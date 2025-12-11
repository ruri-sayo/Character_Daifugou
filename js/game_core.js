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
        this.rankInt = 0; // 0=None, 1=Daifugou, 2=Fugou, 3=Hinmin, 4=Daihinmin
        this.hasPassed = false;
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

        this.rankings = []; // Finished players in order
        this.roundCount = 0;

        this.isExchangeMode = false;
        this.exchangeCount = 0;
        this.exchangeResolve = null;
    }

    // Initialize players once with ordered opponent IDs
    initPlayers(charData, opponentIds) {
        this.players = [];
        this.charData = charData;

        // Player (Always ID 0)
        const pData = charData.find(c => c.id === 'player') || charData[0];
        const p0 = new Player(0, pData.name, false);
        p0.params = pData.params;
        this.players.push(p0);

        // Opponents (ID 1, 2, 3 based on order)
        opponentIds.forEach((id, idx) => {
            const data = charData.find(c => c.id === id);
            // CP IDs: 1, 2, 3
            // Index logic: 0(Player), 1(Right), 2(Top), 3(Left)
            const cpu = new AIPlayer(idx + 1, data.name, data.dialogues);
            cpu.params = data.params;
            this.players.push(cpu);

            // Update UI info
            this.updatePlayerInfoUI(idx + 1, data);
        });
    }

    updatePlayerInfoUI(index, data) {
        const area = document.getElementById(`player-area-${index}`);
        if (!area) return;

        const nameEl = area.querySelector('span.text-xs');
        if (nameEl) nameEl.innerText = data.name;

        const iconContainer = area.querySelector('.w-12.h-12');
        if (iconContainer) {
            iconContainer.className = iconContainer.className.replace(/bg-\w+-\d+/g, '');
            const colorMap = { 'orange': 'bg-orange-400', 'blue': 'bg-blue-600', 'pink': 'bg-pink-400', 'brown': 'bg-yellow-800', 'red': 'bg-red-600', 'green': 'bg-green-600', 'purple': 'bg-purple-600', 'yellow': 'bg-yellow-400', 'gray': 'bg-gray-500' };
            const newColor = colorMap[data.color] || 'bg-gray-500';
            iconContainer.classList.add(newColor);

            const label = iconContainer.querySelector('span');
            if (label) label.innerText = data.icon || data.name[0];
        }
    }

    async startRound() {
        this.roundCount++;
        this.fieldCards = [];
        this.isRevolution = false;
        this.passCount = 0;
        this.rankings = [];
        this.deck = new Deck();
        this.deck.shuffle();
        this.isExchangeMode = false;

        // Reset UI
        document.querySelector('.game-board').classList.remove('revolution-mode');
        document.getElementById('result-screen').classList.add('hidden');

        // Reset hands & status
        this.players.forEach(p => {
            p.hand = [];
            p.hasPassed = false;
        });

        // Deal
        this.players.forEach(p => p.addCards(this.deck.deal(13)));
        this.renderAll();

        // Exchange Logic (from 2nd round)
        if (this.roundCount > 1) {
            await this.processExchange();
            this.renderAll();
        }

        // Determine Start Player (Diamond 3)
        let savedTurn = -1;
        this.players.forEach((p, idx) => {
            if (p.hand.some(c => c.suit === 'd' && c.rank === 3)) {
                savedTurn = idx;
            }
        });

        if (savedTurn === -1) {
            console.warn("No Diamond 3 -> Random Start");
            savedTurn = Math.floor(Math.random() * 4);
        }

        this.currentTurnIndex = savedTurn;

        // Show start message
        const starter = this.players[this.currentTurnIndex];
        const status = document.getElementById('game-status');
        if (status) status.innerText = `Start: ${starter.name}`;

        if (starter.isCpu && starter instanceof AIPlayer) {
            starter.speak("ダイヤの3を持っているから、私からだね！");
        }

        this.startTurn();
    }

    async processExchange() {
        const rankMap = {};
        this.players.forEach(p => rankMap[p.rankInt] = p);

        const daifugou = rankMap[1];
        const fugou = rankMap[2];
        const hinmin = rankMap[3];
        const daihinmin = rankMap[4];

        if (!daifugou || !daihinmin) return;

        // Reset Exchange State
        this.exchangeSelections = [];

        // 1. Losing side gives strongest (Still auto logic, but maybe visualize later?)
        // For now, logic is instant for losers.
        const cardsDToD = AIEngine.selectExchangeCards(daihinmin, 2, false);
        const cardsHToF = AIEngine.selectExchangeCards(hinmin, 1, false);

        // 2. Winning side
        let cardsDaifugouToD = [];
        if (daifugou.isCpu) {
            cardsDaifugouToD = AIEngine.selectExchangeCards(daifugou, 2, true);
        } else {
            cardsDaifugouToD = await this.visualExchange(daifugou, 2, "大富豪");
        }

        let cardsFugouToH = [];
        if (fugou.isCpu) {
            cardsFugouToH = AIEngine.selectExchangeCards(fugou, 1, true);
        } else {
            cardsFugouToH = await this.visualExchange(fugou, 1, "富豪");
        }

        // Apply
        this.performSwap(daihinmin, daifugou, cardsDToD, cardsDaifugouToD);
        this.performSwap(hinmin, fugou, cardsHToF, cardsFugouToH);

        // Sort
        this.players.forEach(p => p.sortHand());

        // Report
        let msg = "交換結果:\n";
        msg += `${daihinmin.name} → ${daifugou.name} (最強2枚)\n`;
        msg += `${daifugou.name} → ${daihinmin.name} (選出2枚)\n`;
        msg += `${hinmin.name} → ${fugou.name} (最強1枚)\n`;
        msg += `${fugou.name} → ${hinmin.name} (選出1枚)`;
        alert(msg);
    }

    visualExchange(player, count, rankName) {
        return new Promise(resolve => {
            const screen = document.getElementById('exchange-screen');
            const handArea = document.getElementById('ex-hand-area');
            const title = document.getElementById('ex-title');
            const msg = document.getElementById('ex-msg');
            const btn = document.getElementById('ex-confirm-btn');

            title.innerText = `[${rankName}] 交換タイム`;
            msg.innerText = `不要なカードを冥土の土産...じゃなくて、${count}枚選んで相手にあげてください。`;
            btn.disabled = true;
            btn.innerText = `残り ${count} 枚`;

            screen.classList.remove('hidden');
            handArea.innerHTML = '';

            // Temporary Set
            const currentSelection = new Set();

            player.hand.forEach((card, idx) => {
                const el = document.createElement('div');
                el.className = 'hand-card card';
                if (['h', 'd'].includes(card.suit)) el.classList.add('suit-red');
                else el.classList.add('suit-black');

                const rankStr = this.getRankDisplay(card.rank);
                el.innerHTML = `
                    <div class="text-xs font-bold flex justify-between">
                        <span>${card.suit === 's' ? '♠' : card.suit === 'h' ? '♥' : card.suit === 'd' ? '♦' : '♣'}</span>
                        <span>${rankStr}</span>
                    </div>
                    <div class="text-2xl text-center self-center font-bold">${rankStr}</div>
                    <div class="text-xs font-bold self-end transform rotate-180 flex justify-between w-full">
                        <span>${card.suit === 's' ? '♠' : card.suit === 'h' ? '♥' : card.suit === 'd' ? '♦' : '♣'}</span>
                        <span>${rankStr}</span>
                    </div>
                `;

                el.onclick = () => {
                    if (currentSelection.has(idx)) {
                        currentSelection.delete(idx);
                        el.classList.remove('selected');
                    } else {
                        if (currentSelection.size < count) {
                            currentSelection.add(idx);
                            el.classList.add('selected');
                        }
                    }

                    const left = count - currentSelection.size;
                    btn.disabled = left !== 0;
                    btn.innerText = left === 0 ? "交換確定" : `残り ${left} 枚`;
                };

                handArea.appendChild(el);
            });

            btn.onclick = () => {
                const indices = Array.from(currentSelection);
                const cards = indices.map(i => player.hand[i]);
                screen.classList.add('hidden');
                resolve(cards);
            };
        });
    }

    performSwap(p1, p2, c1, c2) {
        p1.removeCards(c1);
        p2.removeCards(c2);
        p1.addCards(c2);
        p2.addCards(c1);
    }

    // promptUserExchange removed in favor of visualExchange

    renderAll() {
        this.renderPlayerHand();
        this.renderCPUHands();
    }

    renderPlayerHand() {
        const handDiv = document.getElementById('player-hand');
        handDiv.innerHTML = '';
        const player = this.players[0];

        player.hand.forEach((card, idx) => {
            const el = document.createElement('div');
            el.className = 'hand-card card';
            if (['h', 'd'].includes(card.suit)) el.classList.add('suit-red');
            else el.classList.add('suit-black');

            const rankStr = this.getRankDisplay(card.rank);
            el.innerHTML = `
                <div class="text-xs font-bold flex justify-between">
                    <span>${card.suit === 's' ? '♠' : card.suit === 'h' ? '♥' : card.suit === 'd' ? '♦' : '♣'}</span>
                    <span>${rankStr}</span>
                </div>
                <div class="text-2xl text-center self-center font-bold">${rankStr}</div>
                <div class="text-xs font-bold self-end transform rotate-180 flex justify-between w-full">
                    <span>${card.suit === 's' ? '♠' : card.suit === 'h' ? '♥' : card.suit === 'd' ? '♦' : '♣'}</span>
                    <span>${rankStr}</span>
                </div>
            `;
            el.dataset.idx = idx;
            el.onclick = () => this.toggleSelect(el);
            el.style.transform = 'none';
            handDiv.appendChild(el);
        });

        // Reset button state
        const btn = document.getElementById('play-btn');
        if (btn) btn.disabled = true;
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
        const selectedEls = document.querySelectorAll('.hand-card.selected');
        const count = selectedEls.length;
        const btn = document.getElementById('play-btn');

        if (this.isExchangeMode) {
            btn.disabled = (count !== this.exchangeCount);
            return;
        }

        // Normal play validation
        const indices = Array.from(selectedEls).map(el => parseInt(el.dataset.idx));
        const player = this.players[0];
        const cards = indices.map(i => player.hand[i]);

        let isValid = false;
        if (count > 0) {
            isValid = this.validateMove(player, cards);
        }
        btn.disabled = !isValid;
    }

    validateMove(player, cards) {
        const firstRank = cards[0].rank;
        if (!cards.every(c => c.rank === firstRank)) return false;

        if (this.fieldCards.length === 0) return true;
        if (cards.length !== this.fieldCards.length) return false;

        const myStrength = Card.getStrength(cards[0].rank, this.isRevolution);
        const fieldStrength = Card.getStrength(this.fieldCards[0].rank, this.isRevolution);

        return myStrength > fieldStrength;
    }

    startTurn() {
        // Skip players who have finished
        while (this.players[this.currentTurnIndex].hand.length === 0 && this.rankings.length < 3) {
            this.currentTurnIndex = (this.currentTurnIndex + 1) % 4;
        }

        const player = this.players[this.currentTurnIndex];
        this.setActivePlayerIndicator(this.currentTurnIndex);

        if (this.rankings.length >= 3) {
            this.finishGame();
            return;
        }

        document.getElementById('game-status').innerText = `Turn: ${player.name}`;

        if (player.isCpu) {
            setTimeout(() => {
                player.play(this);
            }, 1000);
        } else {
            // Unlock Human
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
        // Re-validate to be safe
        if (!this.validateMove(player, cards)) {
            console.warn("Invalid Move", cards);
            return;
        }

        const cardStrs = cards.map(c => c.getDisplayStr()).join(', ');
        console.log(`${player.name} played: ${cardStrs} (${cards.length} cards)`);

        player.removeCards(cards);
        this.fieldCards = cards;
        this.renderField(cards);

        // Check Win
        if (player.hand.length === 0) {
            console.log(`${player.name} finished!`);
            this.handlePlayerFinish(player);
        }

        // Rules
        if (cards.length >= 4) {
            this.isRevolution = !this.isRevolution;
            const board = document.querySelector('.game-board');
            if (this.isRevolution) {
                board.classList.add('revolution-mode');
                if (player.isCpu) player.speak("革命だーーっ！");
            } else {
                board.classList.remove('revolution-mode');
                if (player.isCpu) player.speak("革命返しっ！");
            }
            // 革命時にソートを行わない（混乱防止のため）
            // this.players.forEach(p => p.sortHand(this.isRevolution));
            this.renderPlayerHand();
        }

        const isEight = cards.some(c => c.rank === 8);
        if (isEight) {
            console.log("8-giri");
            if (player.isCpu) player.speak("8切りっ！");
            setTimeout(() => {
                this.fieldCards = [];
                this.renderField([]);
                this.passCount = 0;
                // 8-giri: Turn stays with player, unless they finished
                if (player.hand.length > 0) {
                    this.startTurn(); // Same player
                } else {
                    this.nextTurn(); // Passes to next since this player is gone
                }
            }, 1000);
            this.renderAll();
            return;
        }

        this.passCount = 0;
        this.renderAll();
        this.nextTurn();
    }

    passAction(player) {
        console.log(`${player.name} pass`);
        player.hasPassed = true;
        this.passCount++;

        if (this.passCount >= 3) { // Simplified logic: if 3 passed calculated from active players? 
            // Actually standard rule: if everyone else passed.
            // In 4 player game, if 3 pass, the field clears.
            // Note: finished players are skipped, so we need to count active players?
            // Simple version: if satisfy count, clear.
            this.fieldCards = [];
            this.renderField([]);
            this.passCount = 0;
            // Turn goes to the person who played last? 
            // Wait, if 3 people pass, the turn returns to the one who played.
            // If I play, A pass, B pass, C pass -> My turn again.
            // So nextTurn() should handle "if it's my turn again"?
            // My implementation of passCount resets on Play.
            // So if passCount reaches active_count - 1, logic triggers.
            // For v0, let's stick to 3 passes = clear.
        }

        this.nextTurn();
    }

    handlePlayerFinish(player) {
        this.rankings.push(player);
        const rank = this.rankings.length;
        player.rankInt = rank;
        if (player.isCpu) {
            player.speak(player.getRandomDialogue(rank === 1 ? 'win' : 'lose') || "あがり！");
        } else {
            // Human: No alert as requested
            console.log(`${rank}位抜けです！`);
        }
        this.renderCPUHands(); // Update count to 0

        // Check game end
        if (this.rankings.length === 3) {
            const loser = this.players.find(p => !this.rankings.includes(p));
            this.rankings.push(loser);
            loser.rankInt = 4;
            setTimeout(() => this.finishGame(), 1000);
        }
    }

    nextTurn() {
        // Cycle turn
        this.currentTurnIndex = (this.currentTurnIndex + 1) % 4;
        this.startTurn();
    }

    finishGame() {
        const screen = document.getElementById('result-screen');
        const list = document.getElementById('ranking-list');
        list.innerHTML = '';

        const rankNames = ['大富豪', '富豪', '貧民', '大貧民'];
        const classes = ['ranking-1st', 'ranking-2nd', 'ranking-3rd', 'ranking-4th'];

        this.rankings.forEach((p, i) => {
            const div = document.createElement('div');
            div.className = `ranking-item ${classes[i]} text-white`;
            div.innerHTML = `<span>${i + 1}位 ${rankNames[i]}</span> <span>${p.name}</span>`;
            list.appendChild(div);
        });

        screen.classList.remove('hidden');
    }

    renderField(cards) {
        const field = document.getElementById('field-area');
        field.innerHTML = '';
        if (cards.length === 0) {
            field.innerHTML = '<div class="text-white/20 font-bold text-2xl select-none">FIELD</div>';
            return;
        }
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
            el.style.left = `calc(50% - 20px + ${idx * 15}px)`;
            field.appendChild(el);
        });
    }
}

// --- Global Control ---
let gm;
let globalCharData = [];

// 1. Start App -> Load Data -> Show Select
window.onload = async () => {
    try {
        const res = await fetch('data/charactor.json');
        globalCharData = await res.json();

        // Setup initial select screen
        const container = document.querySelector('#select-screen .flex-col');
        container.innerHTML = '';
        const opponents = globalCharData.filter(c => c.isCpu);

        opponents.forEach((char, i) => {
            const label = document.createElement('label');
            label.className = "flex items-center space-x-3 cursor-pointer p-2 rounded hover:bg-white/10 char-select-item";
            label.innerHTML = `
                <input type="checkbox" name="opponent" value="${char.id}" class="form-checkbox h-5 w-5 text-blue-600 rounded">
                <div class="flex items-center gap-2">
                     <span class="text-2xl">${char.icon}</span>
                     <div class="flex flex-col">
                        <span class="text-white font-bold">${char.name}</span>
                        <span class="text-xs text-gray-400">${char.description}</span>
                     </div>
                </div>
            `;
            if (i < 3) label.querySelector('input').checked = true;
            container.appendChild(label);
        });

    } catch (e) { console.error(e); }
};

function startGame() {
    document.getElementById('home-screen').classList.add('hidden');
    document.getElementById('select-screen').classList.remove('hidden');
}

// 2. Select -> Order
function proceedToGame() {
    const checkboxes = document.querySelectorAll('input[name="opponent"]:checked');
    if (checkboxes.length !== 3) {
        alert("3人選んでください");
        return;
    }
    const selectedIds = Array.from(checkboxes).map(cb => cb.value);
    proceedToOrder(selectedIds);
}

// 3. Order Screen Logic
let currentOrderIds = [];

function proceedToOrder(ids) {
    currentOrderIds = ids;
    document.getElementById('select-screen').classList.add('hidden');
    document.getElementById('order-screen').classList.remove('hidden');
    renderOrderList();
}

function renderOrderList() {
    const list = document.getElementById('order-list');
    list.innerHTML = '';

    currentOrderIds.forEach((id, idx) => {
        const data = globalCharData.find(c => c.id === id);
        const item = document.createElement('div');
        item.className = 'order-item text-white';
        item.draggable = true;
        item.innerHTML = `
            <span class="font-bold mr-4">Select ${idx + 1} (Player ${idx + 2})</span>
            <div class="flex items-center gap-2">
                <span>${data.icon}</span>
                <span>${data.name}</span>
            </div>
            <span class="text-gray-400">☰</span>
        `;

        // Drag Events
        item.ondragstart = (e) => {
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', idx);
            item.classList.add('dragging');
        };
        item.ondragend = () => item.classList.remove('dragging');
        item.ondragover = (e) => e.preventDefault();
        item.ondrop = (e) => {
            e.preventDefault();
            const fromIdx = parseInt(e.dataTransfer.getData('text/plain'));
            const toIdx = idx;
            if (fromIdx !== toIdx) {
                // Swap
                [currentOrderIds[fromIdx], currentOrderIds[toIdx]] = [currentOrderIds[toIdx], currentOrderIds[fromIdx]];
                renderOrderList();
            }
        };

        list.appendChild(item);
    });
}

function shuffleOrder() {
    currentOrderIds.sort(() => Math.random() - 0.5);
    renderOrderList();
}

// 4. Game Start
function startGameFromOrder() {
    document.getElementById('order-screen').classList.add('hidden');
    document.getElementById('game-screen').classList.remove('hidden');

    gm = new GameMaster();
    gm.initPlayers(globalCharData, currentOrderIds);
    gm.startRound(true);
}

function nextGame() {
    gm.startRound(false); // Not first game (Exchange active)
}

function returnHome() {
    location.reload();
}

// --- Bridge for HTML ---
function humanPlay() {
    const selectedEls = document.querySelectorAll('.hand-card.selected');
    const player = gm.players[0];
    const indices = Array.from(selectedEls).map(el => parseInt(el.dataset.idx));
    const cards = indices.map(i => player.hand[i]);
    gm.playCardAction(player, cards);
}

function humanPass() {
    gm.passAction(gm.players[0]);
}

// --- Debug Mode ---
let isDebugMode = false;

function toggleDebug() {
    isDebugMode = !isDebugMode;
    console.log(`Debug Mode: ${isDebugMode ? 'ON' : 'OFF'}`);
    if (isDebugMode) {
        enableDebugView();
    } else {
        disableDebugView();
    }
}

function enableDebugView() {
    if (!gm) return;
    // Show CPU hands
    gm.players.forEach(p => {
        if (p.isCpu) {
            console.log(`[DEBUG] ${p.name}'s Hand:`, p.hand.map(c => c.getDisplayStr()).join(', '));
            // Optional: Render small text on screen?
        }
    });
}

function disableDebugView() {
    // Clear debug artifacts if any
}

// Expose to window for console access
window.debug = {
    toggle: toggleDebug,
    showHands: () => {
        if (!gm) return "Game not started";
        gm.players.forEach(p => {
            console.log(`${p.name} (${p.hand.length}):`, p.hand.map(c => c.getDisplayStr()).join(', '));
        });
        return "Done";
    }
};
