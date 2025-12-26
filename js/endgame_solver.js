/**
 * Endgame Solver - 終盤の完全読みと即あがり判定
 * レベル2/3で使用される
 */

class EndgameSolver {

    /**
     * 即座にあがれるかチェック
     * @param {Array} hand 手札
     * @param {Array|null} fieldCards 場のカード
     * @param {boolean} isRevolution 革命状態か
     * @returns {Array|null} あがれる手があればそのカード配列、なければnull
     */
    static canWinImmediately(hand, fieldCards, isRevolution) {
        // 手札が0枚なら既にあがっている
        if (hand.length === 0) return null;

        // 手札を同じランクでグループ化
        const groups = {};
        hand.forEach(c => {
            if (!groups[c.rank]) groups[c.rank] = [];
            groups[c.rank].push(c);
        });

        const groupList = Object.values(groups);

        // 1組しかない場合：その1組で出せればあがり
        if (groupList.length === 1) {
            const cards = groupList[0];
            if (this.canPlayCards(cards, fieldCards, isRevolution)) {
                return cards;
            }
        }

        // 複数組ある場合：今回出せる組を出した後、残りが1組かチェック
        // （簡易版：2組までのチェック）
        if (groupList.length === 2) {
            for (let i = 0; i < 2; i++) {
                const playCards = groupList[i];
                const remainCards = groupList[1 - i];

                if (this.canPlayCards(playCards, fieldCards, isRevolution)) {
                    // 出した後、8切りなら場がリセット
                    const is8 = playCards.some(c => c.rank === 8);
                    if (is8) {
                        // 8切り後は場がリセットされるので残りは自由に出せる
                        return playCards; // 8切りを優先
                    }
                }
            }
        }

        return null;
    }

    /**
     * カードが場に出せるかチェック
     */
    static canPlayCards(cards, fieldCards, isRevolution) {
        if (!fieldCards || fieldCards.length === 0) {
            return true; // 場が空なら何でも出せる
        }

        if (cards.length !== fieldCards.length) {
            return false; // 枚数が違う
        }

        const myStrength = Card.getStrength(cards[0].rank, isRevolution);
        const fieldStrength = Card.getStrength(fieldCards[0].rank, isRevolution);

        return myStrength > fieldStrength;
    }

    /**
     * 終盤かどうかを判定
     * @param {Array} players プレイヤー配列
     * @returns {boolean} 終盤ならtrue
     */
    static isEndgame(players) {
        const totalCards = players.reduce((sum, p) => sum + p.hand.length, 0);
        return totalCards <= 12; // 全員合計12枚以下で終盤
    }

    /**
     * 浅い深さのMinimax（レベル2用）- 簡易版
     * 時間制限付きで動作
     * @param {Object} player 現在のプレイヤー
     * @param {Array|null} fieldCards 場のカード
     * @param {boolean} isRevolution 革命状態
     * @param {number} timeLimit 時間制限(ms)
     * @returns {Array|null} 選択した手
     */
    static shallowSearch(player, fieldCards, isRevolution, timeLimit = 800) {
        const startTime = Date.now();
        const moves = AIEngine.getLegalMoves(player.hand, fieldCards, isRevolution);

        let bestMove = moves[0];
        let bestScore = -Infinity;

        for (const move of moves) {
            // 時間チェック
            if (Date.now() - startTime > timeLimit) {
                break;
            }

            // 各手のスコアを計算（基本評価 + 終盤ボーナス）
            let score = AIEngine.calculateScore(move, player.hand, fieldCards, isRevolution, player.params);

            // 即あがりボーナス
            if (move.cards && move.cards.length === player.hand.length) {
                score += 100000;
            }

            // 8切りで残り1組なら高評価
            if (move.cards && move.cards.some(c => c.rank === 8)) {
                const remaining = player.hand.length - move.cards.length;
                const groups = {};
                player.hand.filter(c => !move.cards.includes(c)).forEach(c => {
                    if (!groups[c.rank]) groups[c.rank] = [];
                    groups[c.rank].push(c);
                });
                if (Object.keys(groups).length === 1 && remaining > 0) {
                    score += 5000; // 8切りで残り1組
                }
            }

            if (score > bestScore) {
                bestScore = score;
                bestMove = move;
            }
        }

        return bestMove.cards;
    }
}
