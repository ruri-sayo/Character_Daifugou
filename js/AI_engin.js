class AIEngine {
    /**
     * 最適な手を決定するメインメソッド
     * @param {Player} player 思考するプレイヤー (paramsプロパティを持つこと)
     * @param {Array<Card>|null} fieldCards 場のカード
     * @param {boolean} isRevolution 革命状態かどうか
     * @returns {Array<Card>|null} 出すカード配列（パスならnull）
     */
    static think(player, fieldCards, isRevolution) {
        // charactor.jsonから読み込まれたparamsを使用、なければデフォルト
        const defaultParams = { w_attack: 0.5, w_defense: 0.5, w_revolution: 0.5, w_trump: 0.5, epsilon: 0.1 };
        const params = player.params || defaultParams;

        // 1. 合法手の列挙
        const moves = this.getLegalMoves(player.hand, fieldCards, isRevolution);

        // 2. スコアリング
        moves.forEach(move => {
            move.score = this.calculateScore(move, player.hand, fieldCards, isRevolution, params);
        });

        // 3. ゆらぎと選択
        // スコアが高い順にソート（ランダム性込み）
        moves.sort((a, b) => b.score - a.score);

        // デバッグ用ログ
        // console.log(`${player.name}の手候補:`, moves.map(m => `${m.type}:${m.score.toFixed(1)}`).join(', '));

        const bestMove = moves[0];
        return bestMove.cards;
    }

    /**
     * 合法手（出せるカードの組み合わせ）をすべて列挙する
     * パスも1つの手として含む
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

        // 場の状況に応じた制限
        let reqCount = 0;
        let minStrength = -1;

        if (fieldCards && fieldCards.length > 0) {
            reqCount = fieldCards.length;
            // Use rank from field card
            minStrength = Card.getStrength(fieldCards[0].rank, isRevolution);
        }

        // 各ランクについて探索
        for (const rankStr in groups) {
            const rank = parseInt(rankStr);
            const cards = groups[rankStr];
            const strength = Card.getStrength(rank, isRevolution);

            // 場にカードがある場合：枚数が同じ かつ 強い必要がある
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
            // 場にカードがない場合：全ての組み合わせ（1枚〜4枚）が可能
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
     * 評価関数：各手のスコアを計算
     */
    static calculateScore(move, hand, fieldCards, isRevolution, params) {
        // ... (existing code) ...
        // --- 1. ノイズ付与 (Random Epsilon) ---
        let score = (Math.random() * 2 - 1) * 50 * params.epsilon;

        // --- パスの場合 ---
        if (move.type === 'PASS') {
            return score;
        }

        const cards = move.cards;
        const count = cards.length;
        const strength = move.strength; // 0~12

        // --- A. 基本スコア (S_base) ---
        score += 100 * params.w_attack;

        // --- B. インパクトボーナス (S_impact) ---
        score += strength * 5;
        score += (count - 1) * 20;

        // 8切りボーナス
        const is8 = cards.some(c => c.rank === 8);
        if (is8) {
            score += 50 * (params.w_attack + params.w_defense);
        }

        // --- C. リスク・コスト (S_risk) ---

        // 終盤度係数
        const endgameFactor = (13 - hand.length) / 13;

        // 切り札消費ペナルティ
        const maxStrength = 12;
        if (strength === maxStrength) {
            const penalty = 100 * params.w_trump * (1.0 - endgameFactor);
            score -= penalty;
        }

        // ペア崩しペナルティ
        const sameRankTotal = hand.filter(c => c.rank === move.rank).length;
        if (sameRankTotal > count) {
            score -= 60 * params.w_defense;
        }

        // --- D. 特殊ボーナス (S_bonus) ---

        // 革命ボーナス
        if (count >= 4) {
            score += 150 * params.w_revolution;
        }

        // あがりボーナス
        if (hand.length === count) {
            score += 10000;
        }

        return score;
    }

    /**
     * カード交換用AI
     * @param {Player} player
     * @param {number} count 交換枚数
     * @param {boolean} isWinner 自分は勝者側か（自由に選べるか）
     * @returns {Array<Card>} 出すカード
     */
    static selectExchangeCards(player, count, isWinner) {
        // カードを強さ順にコピー
        // isRevolution は交換時は通常考慮しない（基本的な強さで判断）
        const sorted = [...player.hand].sort((a, b) => Card.getStrength(a.rank, false) - Card.getStrength(b.rank, false));

        if (isWinner) {
            // 勝者側：基本は「弱いカード」を渡す
            // 戦術：単騎の弱いカードを優先的に渡すとか、ペアを残すとか高度なことは一旦なし
            // 単純に最弱を渡す
            return sorted.slice(0, count);
        } else {
            // 敗者側：最強カードを渡す（ルール上強制だが、AIメソッドとして実装しておく）
            return sorted.slice(sorted.length - count);
        }
    }
}

class AIPlayer extends Player {
    constructor(id, name, dialogues) {
        super(id, name, true);
        this.dialogues = dialogues || {};
    }

    play(gm) {
        // Thinking time phrase
        this.speak(this.getRandomDialogue('thinking'));

        // Delay decision slightly to show thinking bubble
        setTimeout(() => {
            const cardsToPlay = AIEngine.think(this, gm.fieldCards, gm.isRevolution);
            if (cardsToPlay) {
                // If special moves (8, revolution), can check here and say specific lines
                // For now, simpler logic
                if (cardsToPlay.length >= 4) {
                    this.speak(this.getRandomDialogue('skill') || "革命！");
                } else if (cardsToPlay.some(c => c.rank === 8)) {
                    this.speak(this.getRandomDialogue('skill') || "8切り！");
                } else {
                    this.speak(this.getRandomDialogue('generic') || this.getPlayPhrase());
                }

                gm.playCardAction(this, cardsToPlay);
            } else {
                this.speak(this.getRandomDialogue('ai_pass') || this.getPassPhrase());
                gm.passAction(this);
            }
        }, 1200);
    }

    speak(msg) {
        if (!msg) return;
        const bubble = document.getElementById(`msg-${this.id}`);
        if (bubble) {
            bubble.innerText = msg;
            bubble.classList.add('visible');
            setTimeout(() => {
                bubble.classList.remove('visible');
            }, 2500);
        }
    }

    getRandomDialogue(type) {
        if (this.dialogues && this.dialogues[type] && this.dialogues[type].length > 0) {
            const list = this.dialogues[type];
            return list[Math.floor(Math.random() * list.length)];
        }
        return null;
    }

    getPlayPhrase() {
        const phrases = ["これならどう？", "はいよ", "いくわよ！"];
        return phrases[Math.floor(Math.random() * phrases.length)];
    }

    getPassPhrase() {
        const phrases = ["パス...", "無理だわ", "お先にどうぞ"];
        return phrases[Math.floor(Math.random() * phrases.length)];
    }
}