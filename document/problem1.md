# 問題調査報告: ゲームが動作しない（カードが配布されない）件

## 現象
- ゲーム画面に遷移しても、プレイヤーの手札が表示されない（あるいは操作できない）。
- プレイヤー、AIともに「パス」しか選択できない状況。
- しかしゲーム自体（gmインスタンス）は存在している。

## 原因の特定
`js/game_core.js` 内の `Player` クラスにある `sortHand` メソッドにバグがありました。

前回の改修で `Card.getStrength` を **静的メソッド (static method)** に変更しましたが、`sortHand` メソッド内での呼び出し記述に一部修正漏れがありました。

**修正前のコード (現在の状態):**
```javascript
this.hand.sort((a, b) => Card.getStrength(a.rank, isRevolution) - b.getStrength(b.rank, isRevolution));
```

ここで `b.getStrength` はインスタンスメソッドとして呼び出そうとしていますが、`getStrength` は `static` なのでインスタンスからは呼び出せず、`TypeError` が発生します。
このエラーにより、`gm.init()` 内の `addCards()` 処理が中断され、カード配布が完了する前に処理が停止しています。結果として手札が空（または不完全）のままとなり、誰もカードを出せない状態になっています。

## 改良案
`js/game_core.js` の `sortHand` メソッドを正しく修正します。

**修正案:**
```javascript
this.hand.sort((a, b) => Card.getStrength(a.rank, isRevolution) - Card.getStrength(b.rank, isRevolution));
```

この修正により、カード配布時のソート処理が正常に完了し、ゲームが正しく開始されるようになります。
