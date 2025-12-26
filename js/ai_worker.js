/**
 * AI Worker - AI計算を別スレッドで実行する
 * レベル2/3で使用される
 */

// カード強度計算（Card.getStrengthの複製）
function getCardStrength(rank, isRevolution = false) {
    let strength;
    if (rank === 1) strength = 12; // Ace
    else if (rank === 2) strength = 13; // 2
    else strength = rank - 3;

    if (isRevolution) {
        return 13 - strength;
    }
    return strength;
}

/**
 * 合法手を列挙する
 */
function getLegalMoves(hand, fieldCards, isRevolution) {
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
        minStrength = getCardStrength(fieldCards[0].rank, isRevolution);
    }

    // 各ランクについて探索
    for (const rankStr in groups) {
        const rank = parseInt(rankStr);
        const cards = groups[rankStr];
        const strength = getCardStrength(rank, isRevolution);

        if (reqCount > 0) {
            if (cards.length >= reqCount && strength > minStrength) {
                moves.push({
                    cards: cards.slice(0, reqCount),
                    type: reqCount === 1 ? 'SINGLE' : 'MULTIPLE',
                    strength: strength,
                    rank: rank
                });
            }
        } else {
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
 * 評価関数（基本版）
 */
function calculateScore(move, hand, fieldCards, isRevolution, params) {
    let score = (Math.random() * 2 - 1) * 50 * params.epsilon;

    if (move.type === 'PASS') {
        return score;
    }

    const cards = move.cards;
    const count = cards.length;
    const strength = move.strength;

    // 基本スコア
    score += 100 * params.w_attack;

    // インパクトボーナス
    score += strength * 5;
    score += (count - 1) * 20;

    // 8切りボーナス
    const is8 = cards.some(c => c.rank === 8);
    if (is8) {
        score += 50 * (params.w_attack + params.w_defense);
    }

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
 * AI思考処理（レベル1用）
 */
function thinkLevel1(hand, fieldCards, isRevolution, params) {
    const moves = getLegalMoves(hand, fieldCards, isRevolution);

    moves.forEach(move => {
        move.score = calculateScore(move, hand, fieldCards, isRevolution, params);
    });

    moves.sort((a, b) => b.score - a.score);
    return moves[0].cards;
}

/**
 * あがり確定判定（レベル2/3用）
 */
function canWinImmediately(hand, fieldCards, isRevolution) {
    // 手札が1組だけで、それが出せる場合
    const moves = getLegalMoves(hand, fieldCards, isRevolution);
    const playMoves = moves.filter(m => m.type !== 'PASS');

    // 手札全部を一度に出せる手があるか
    for (const move of playMoves) {
        if (move.cards && move.cards.length === hand.length) {
            return move.cards;
        }
    }

    return null;
}

/**
 * メッセージハンドラ
 */
self.onmessage = function (e) {
    const { type, data } = e.data;

    if (type === 'think') {
        const { hand, fieldCards, isRevolution, params, difficulty } = data;

        let result;

        // あがり確定チェック（レベル2/3）
        if (difficulty >= 2) {
            const winningMove = canWinImmediately(hand, fieldCards, isRevolution);
            if (winningMove) {
                self.postMessage({ type: 'result', cards: winningMove });
                return;
            }
        }

        // 通常の思考処理
        result = thinkLevel1(hand, fieldCards, isRevolution, params);

        self.postMessage({ type: 'result', cards: result });
    }
};
