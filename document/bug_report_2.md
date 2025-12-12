# バグ調査報告書：2周目突入時のエラー

## 現象
2周目（カード交換が発生するラウンド）の開始時、以下のエラーが発生しゲームが進行不能になる場合がある。

```
Uncaught TypeError: Cannot read properties of undefined (reading 'rank')
    at GameMaster.validateMove (game_core.js:399:36)
    at GameMaster.toggleSelect (game_core.js:393:28)
    at el.onclick (game_core.js:350:37)
```

## 原因
**カード交換（Exchange）処理中における、メイン手札への不適切な操作**が原因です。

1. **`isExchangeMode` フラグの管理不備**
   `game_core.js` の `startRound` メソッドで `this.isExchangeMode = false` に初期化されていますが、その後 `processExchange`（カード交換処理）に入っても `true` に切り替える処理がありません。
   
2. **メイン画面の操作がロックされていない**
   フラグが `false` のままであるため、カード交換用のオーバーレイが表示されている最中（`visualExchange` の待機中）であっても、背面のメイン手札をクリックすると `toggleSelect` が「通常プレイ時の処理」として動作してしまいます。
   
3. **手札の状態不整合（Desync）**
   ユーザーが背面のカードを選択し、「出す（Play）」動作を行ってしまうと、交換処理前に手札からカードが減ります。
   その状態で「交換」処理が進む、あるいはさらに別のカードをクリックすると、DOM上のインデックス（例：13枚時の12番）と、実際に減った手札配列（例：残り12枚時の12番＝undefined）の間に不整合が生じ、`validateMove` 内で `player.hand[i]` が `undefined` となり、プロパティ `rank` へのアクセスでクラッシュします。

## 修正方針
`js/game_core.js` を以下の通り修正する必要があります。

1. **フラグの適切な制御**
   `processExchange` メソッドの開始時に `this.isExchangeMode = true` を設定し、終了時に `false` に戻す処理を追加します。

2. **`toggleSelect` のガード処理**
   `toggleSelect` メソッドにおいて、`this.isExchangeMode` が `true` の場合は、メイン手札の操作を無視（return）するように変更します。
   （※現在のコードにある `if (this.isExchangeMode) { ... }` ブロックは `visualExchange` が独自のハンドラを持つため不要、または誤解を招く実装になっている可能性があります。メイン手札については「操作禁止」にするのが安全です）

この修正により、交換モード中の誤操作によるクラッシュを防止できます。
