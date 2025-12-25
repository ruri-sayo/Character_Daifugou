# バグ報告書3：2周目以降プレイ不能になる問題

## 現象
ゲームの2周目（第2ラウンド）以降、プレイヤーが手札を選択しても「出す」ボタンが有効化されず、カードを出すことができない。開発者ツール（Console）を確認すると、以下のエラーが発生している場合がある。

```
TypeError: Cannot read properties of undefined (reading 'rank')
```

## 原因
`js/game_core.js` の `toggleSelect` メソッドにおけるDOM要素の取得範囲が不適切であることが原因です。

1.  **カード交換処理の残留**: 第2ラウンド開始時の「カード交換画面（Exchange Screen）」でカードを選択すると、そのHTML要素に `selected` クラスが付与されます。
2.  **クラスのクリア漏れ**: カード交換が完了し、交換画面が非表示（`hidden`）になっても、それらの要素から `selected` クラスは削除されません。
3.  **セレクタの干渉**: メインゲームでのカード選択処理（`toggleSelect`）において、以下のコードで選択カードを取得しています。
    ```javascript
    const selectedEls = document.querySelectorAll('.hand-card.selected');
    ```
    この `document.querySelectorAll` は文書全体を探索するため、**非表示になっている交換画面のカードも取得してしまいます。**
4.  **インデックスの不整合**: 取得された `selectedEls` に交換画面のカードが含まれることで、本来の手札枚数やインデックスと不整合が生じ、バリデーションロジックや `gm.playCardAction` 呼び出し時に誤ったカード配列（あるいは `undefined`）を生成し、エラーとなります。

## 再現手順
1.  ゲームを開始し、1周目を勝利して終了する（大富豪または富豪になる）。
2.  「次のゲームへ」を選択する。
3.  カード交換画面が表示されるので、交換枚数分のカードを選択し「交換確定」を押す。
4.  ゲーム本編（メイン画面）が表示されたら、手札を選択する。
5.  「出す」ボタンが有効にならず、操作不能となる。

## 修正案
`js/game_core.js` に対して以下の修正を行います。

1.  **セレクタのスコープ限定**: `toggleSelect` 内でのカード取得を、プレイヤーの手札エリア（`#player-hand`）内に限定します。
    ```javascript
    // 修正前
    const selectedEls = document.querySelectorAll('.hand-card.selected');
    
    // 修正後
    const selectedEls = document.querySelectorAll('#player-hand .hand-card.selected');
    ```
2.  **交換終了時のクリーンアップ（推奨）**: 交換処理完了時に、交換画面のカードから `selected` クラスを削除するか、HTML内容をクリアするようにします。
    * 現状の実装でも `visualExchange` の冒頭で `handArea.innerHTML = '';` しているので、次の交換時にはクリアされますが、念のため交換完了時にも状態をリセットするのが安全です。

## 補足
ブラウザの開発者ツールを使用した検証により、2周目において `document.querySelectorAll('.hand-card.selected')` の取得数が、実際に画面で見えている選択枚数よりも多くなっていることが確認されました。
