/**
 * Card Inference Engine - カード推論エンジン
 * 場に出たカードを追跡し、残りのカードを推測する
 * レベル3 (PIMC法) で使用
 */

class CardInference {
    constructor() {
        this.reset();
    }

    /**
     * 状態をリセット
     */
    reset() {
        // 52枚の全カードを生成
        this.allCards = [];
        const suits = ['s', 'h', 'd', 'c'];
        for (const suit of suits) {
            for (let rank = 1; rank <= 13; rank++) {
                this.allCards.push({ suit, rank });
            }
        }

        // 出されたカードの記録
        this.playedCards = [];

        // 各プレイヤーの手札枚数
        this.handCounts = [0, 0, 0, 0];
    }

    /**
     * ゲーム開始時の初期化
     * @param {Array} players プレイヤー配列
     */
    initGame(players) {
        this.reset();
        players.forEach((p, idx) => {
            this.handCounts[idx] = p.hand.length;
        });
    }

    /**
     * カードが出されたことを記録
     * @param {number} playerIndex プレイヤーインデックス
     * @param {Array} cards 出されたカード
     */
    recordPlay(playerIndex, cards) {
        cards.forEach(c => {
            this.playedCards.push({ suit: c.suit, rank: c.rank });
        });
        this.handCounts[playerIndex] -= cards.length;
    }

    /**
     * プレイヤーの手札枚数を更新
     * @param {number} playerIndex プレイヤーインデックス
     * @param {number} count 新しい手札枚数
     */
    updateHandCount(playerIndex, count) {
        this.handCounts[playerIndex] = count;
    }

    /**
     * まだ出されていないカードを取得
     * @returns {Array} 未出カードの配列
     */
    getRemainingCards() {
        return this.allCards.filter(c =>
            !this.playedCards.some(p => p.suit === c.suit && p.rank === c.rank)
        );
    }

    /**
     * 自分の手札を除いた未知のカードを取得
     * @param {Array} myHand 自分の手札
     * @returns {Array} 他のプレイヤーが持っている可能性のあるカード
     */
    getUnknownCards(myHand) {
        const remaining = this.getRemainingCards();
        return remaining.filter(c =>
            !myHand.some(m => m.suit === c.suit && m.rank === c.rank)
        );
    }

    /**
     * 未知のカードをランダムに各プレイヤーに配分
     * @param {number} myIndex 自分のインデックス
     * @param {Array} myHand 自分の手札
     * @returns {Object} { playerIndex: [cards] } の形式
     */
    sampleHands(myIndex, myHand) {
        const unknownCards = this.getUnknownCards(myHand);
        const shuffled = [...unknownCards].sort(() => Math.random() - 0.5);

        const hands = {};
        let cardIndex = 0;

        for (let i = 0; i < 4; i++) {
            if (i === myIndex) {
                hands[i] = [...myHand];
            } else {
                const count = this.handCounts[i];
                hands[i] = shuffled.slice(cardIndex, cardIndex + count);
                cardIndex += count;
            }
        }

        return hands;
    }

    /**
     * 複数回サンプリングを行う
     * @param {number} myIndex 自分のインデックス
     * @param {Array} myHand 自分の手札
     * @param {number} numSamples サンプル数
     * @returns {Array} サンプリング結果の配列
     */
    multiSample(myIndex, myHand, numSamples = 50) {
        const samples = [];
        for (let i = 0; i < numSamples; i++) {
            samples.push(this.sampleHands(myIndex, myHand));
        }
        return samples;
    }
}

// グローバルインスタンス
const cardInference = new CardInference();
