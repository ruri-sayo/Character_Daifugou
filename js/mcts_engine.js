/**
 * MCTS Engine - モンテカルロ木探索エンジン
 * レベル3 (PIMC法) で使用
 * 時間制限: 800ms
 */

class MCTSEngine {

    /**
     * PIMC法による最適手の探索
     * @param {Object} player 現在のプレイヤー
     * @param {Array|null} fieldCards 場のカード
     * @param {boolean} isRevolution 革命状態
     * @param {Object} gameState ゲーム状態
     * @param {number} timeLimit 時間制限(ms)
     * @returns {Array|null} 選択した手
     */
    static search(player, fieldCards, isRevolution, gameState, timeLimit = 800) {
        const startTime = Date.now();
        const myIndex = player.id;

        // 合法手を列挙
        const moves = AIEngine.getLegalMoves(player.hand, fieldCards, isRevolution);

        // 各手の勝率を記録
        const moveStats = moves.map(move => ({
            move,
            wins: 0,
            plays: 0
        }));

        // サンプル数（時間内でできるだけ多く）
        let simulationCount = 0;

        while (Date.now() - startTime < timeLimit) {
            // 1. 手札をランダムサンプリング
            const sampledHands = cardInference.sampleHands(myIndex, player.hand);

            // 2. 各手についてシミュレーション
            for (let i = 0; i < moveStats.length; i++) {
                if (Date.now() - startTime >= timeLimit) break;

                const stat = moveStats[i];
                const result = this.simulate(
                    stat.move,
                    sampledHands,
                    myIndex,
                    fieldCards,
                    isRevolution
                );

                stat.plays++;
                if (result) stat.wins++;
            }

            simulationCount++;
        }

        // 3. 最も勝率の高い手を選択
        let bestMove = moveStats[0];
        for (const stat of moveStats) {
            if (stat.plays > 0) {
                const winRate = stat.wins / stat.plays;
                const bestWinRate = bestMove.plays > 0 ? bestMove.wins / bestMove.plays : 0;
                if (winRate > bestWinRate) {
                    bestMove = stat;
                }
            }
        }

        console.log(`[MCTS] ${simulationCount} simulations, best: ${bestMove.move.type}, winRate: ${bestMove.plays > 0 ? (bestMove.wins / bestMove.plays * 100).toFixed(1) : 0}%`);

        return bestMove.move.cards;
    }

    /**
     * 1回のシミュレーション（プレイアウト）
     * @returns {boolean} 勝利したかどうか
     */
    static simulate(move, sampledHands, myIndex, fieldCards, isRevolution) {
        // 簡易シミュレーション
        // 仮想的なゲーム状態を作成
        const hands = {};
        for (let i = 0; i < 4; i++) {
            hands[i] = [...sampledHands[i]];
        }

        let currentField = fieldCards ? [...fieldCards] : [];
        let currentPlayer = myIndex;
        let passCount = 0;
        const finishOrder = [];

        // 最初の手を適用
        if (move.cards) {
            const playedCards = move.cards;
            hands[myIndex] = hands[myIndex].filter(c =>
                !playedCards.some(p => p.suit === c.suit && p.rank === c.rank)
            );
            currentField = playedCards;

            // 8切りチェック
            if (playedCards.some(c => c.rank === 8)) {
                currentField = [];
            }

            // あがりチェック
            if (hands[myIndex].length === 0) {
                finishOrder.push(myIndex);
            }

            passCount = 0;
        } else {
            passCount = 1;
        }

        // 次のプレイヤーへ
        currentPlayer = (currentPlayer + 1) % 4;

        // ゲームをシミュレート（最大50手）
        for (let turn = 0; turn < 50 && finishOrder.length < 3; turn++) {
            // 既にあがっているプレイヤーはスキップ
            if (hands[currentPlayer].length === 0) {
                currentPlayer = (currentPlayer + 1) % 4;
                continue;
            }

            // 合法手を取得
            const legalMoves = this.getSimpleLegalMoves(hands[currentPlayer], currentField, isRevolution);

            // ランダムに手を選択（簡易版）
            const playableNonPass = legalMoves.filter(m => m.cards !== null);
            let selectedMove;

            if (playableNonPass.length > 0 && Math.random() > 0.3) {
                // 70%の確率で出せる手を出す
                selectedMove = playableNonPass[Math.floor(Math.random() * playableNonPass.length)];
            } else {
                // パス
                selectedMove = { cards: null };
            }

            if (selectedMove.cards) {
                const playedCards = selectedMove.cards;
                hands[currentPlayer] = hands[currentPlayer].filter(c =>
                    !playedCards.some(p => p.suit === c.suit && p.rank === c.rank)
                );
                currentField = playedCards;

                // 8切り
                if (playedCards.some(c => c.rank === 8)) {
                    currentField = [];
                }

                // あがり
                if (hands[currentPlayer].length === 0) {
                    finishOrder.push(currentPlayer);
                }

                passCount = 0;
            } else {
                passCount++;

                // 全員パスで場リセット
                const activePlayers = [0, 1, 2, 3].filter(i => hands[i].length > 0).length;
                if (passCount >= activePlayers - 1) {
                    currentField = [];
                    passCount = 0;
                }
            }

            currentPlayer = (currentPlayer + 1) % 4;
        }

        // 勝利判定: 1位か2位ならtrue
        const myRank = finishOrder.indexOf(myIndex);
        return myRank === 0 || myRank === 1;
    }

    /**
     * 簡易版の合法手列挙
     */
    static getSimpleLegalMoves(hand, fieldCards, isRevolution) {
        const moves = [{ cards: null }]; // パス

        const groups = {};
        hand.forEach(c => {
            if (!groups[c.rank]) groups[c.rank] = [];
            groups[c.rank].push(c);
        });

        let reqCount = 0;
        let minStrength = -1;

        if (fieldCards && fieldCards.length > 0) {
            reqCount = fieldCards.length;
            minStrength = Card.getStrength(fieldCards[0].rank, isRevolution);
        }

        for (const rankStr in groups) {
            const rank = parseInt(rankStr);
            const cards = groups[rankStr];
            const strength = Card.getStrength(rank, isRevolution);

            if (reqCount > 0) {
                if (cards.length >= reqCount && strength > minStrength) {
                    moves.push({ cards: cards.slice(0, reqCount) });
                }
            } else {
                for (let n = 1; n <= cards.length; n++) {
                    moves.push({ cards: cards.slice(0, n) });
                }
            }
        }

        return moves;
    }
}
