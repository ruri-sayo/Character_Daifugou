# AI強化実装計画書

## 概要

本計画書は、`report_1.md` および `report_1_review.md` のレビュー結果を踏まえ、スマートフォンユーザ（70%）を考慮したAI強化の実装スケジュールを定義します。

---

## ユーザ要件サマリ

| 項目 | 仕様 |
|---|---|
| 時間制限 | 800ms（提案Aより変更） |
| 思考中メッセージ | バリエーションを増やす |
| Web Worker | 導入（提案B） |
| あがり確定判定 | 先行実装（提案D） |
| 難易度設定 | ホーム画面に設定ボタンを追加、デフォルトはレベル1 |
| 警告表示 | レベル2/3選択時に「警告！計算量が必要です。端末が熱くなる可能性があります。」と表示 |
| 導線確保 | 吹き出しで「難易度変更はここから」と表示 |

---

## 難易度レベル定義

| レベル | 名称 | 説明 | 計算負荷 |
|---|---|---|---|
| 1 | 標準（軽量） | 現行のヒューリスティックAI（貪欲法） | 🟢 軽い |
| 2 | 中級（終盤強化） | 終盤のみあがり確定判定 + 簡易探索（深さ2） | 🟡 中程度 |
| 3 | 上級（フルPIMC） | モンテカルロ法 + 時間制限800ms | 🔴 重い（PC向け） |

---

## 実装フェーズ

### フェーズ0: 基盤整備 【優先度: 最高】

#### 0.1 設定画面の追加

**対象ファイル:**
- [MODIFY] [index.html](file:///c:/Users/miura/WP_blog/2_Game_projects/Character_Daifugou_AI_kai/index.html)
- [MODIFY] [game_core.js](file:///c:/Users/miura/WP_blog/2_Game_projects/Character_Daifugou_AI_kai/js/game_core.js)
- [MODIFY] [style.css](file:///c:/Users/miura/WP_blog/2_Game_projects/Character_Daifugou_AI_kai/css/style.css)

**実装内容:**
1.  ホーム画面に「設定」ボタン（歯車アイコン）を追加
2.  設定モーダルを作成（難易度選択UI）
3.  難易度は `localStorage` に保存し、ゲーム開始時に読み込む
4.  初回訪問時は吹き出しで「難易度変更はここから」と表示
5.  レベル2/3選択時に警告ダイアログを表示

**予想作業時間:** 3時間

---

### フェーズ1: 思考中メッセージの強化 【優先度: 高】

#### 1.1 思考中メッセージのバリエーション追加

**対象ファイル:**
- [MODIFY] [charactor.json](file:///c:/Users/miura/WP_blog/2_Game_projects/Character_Daifugou_AI_kai/data/charactor.json)
- [MODIFY] [AI_engin.js](file:///c:/Users/miura/WP_blog/2_Game_projects/Character_Daifugou_AI_kai/js/AI_engin.js)

**実装内容:**
1.  各キャラクターの `thinking` フレーズを現在の1〜2個から **5〜8個** に増やす
2.  難易度レベル2/3では思考時間が長いため、**段階的にメッセージを変更**する機能を追加
    -   例: 0〜200ms「うーん...」→ 200〜500ms「これはどうかな...」→ 500ms〜「ちょっと待ってね...」

**予想作業時間:** 2時間

---

### フェーズ2: Web Worker の導入 【優先度: 高】

#### 2.1 AI計算の別スレッド化

**対象ファイル:**
- [NEW] [ai_worker.js](file:///c:/Users/miura/WP_blog/2_Game_projects/Character_Daifugou_AI_kai/js/ai_worker.js)
- [MODIFY] [AI_engin.js](file:///c:/Users/miura/WP_blog/2_Game_projects/Character_Daifugou_AI_kai/js/AI_engin.js)
- [MODIFY] [game_core.js](file:///c:/Users/miura/WP_blog/2_Game_projects/Character_Daifugou_AI_kai/js/game_core.js)

**実装内容:**
1.  `ai_worker.js` を新規作成し、AI計算ロジックをWorkerに移動
2.  メインスレッドからWorkerへ `postMessage` でゲーム状態を送信
3.  Workerから `onmessage` で計算結果（選択したカード）を受信
4.  レベル1では従来通りメインスレッドで処理（Workerのオーバーヘッドを回避）
5.  レベル2/3ではWorkerを使用

**予想作業時間:** 4時間

---

### フェーズ3: あがり確定判定の実装 【優先度: 中】

#### 3.1 Endgame Detector の実装

**対象ファイル:**
- [NEW] [endgame_solver.js](file:///c:/Users/miura/WP_blog/2_Game_projects/Character_Daifugou_AI_kai/js/endgame_solver.js)
- [MODIFY] [AI_engin.js](file:///c:/Users/miura/WP_blog/2_Game_projects/Character_Daifugou_AI_kai/js/AI_engin.js)

**実装内容:**
1.  「この手を出せば100%あがれる」状態を検出する `canWinImmediately()` 関数を実装
2.  条件：
    -   手札が1組（例: 3のペア1つだけ）で、場に出せる状態
    -   手札が連続して出せる組み合わせで、途中で止められない状態
3.  あがり確定時は他の評価を無視してその手を選択

**予想作業時間:** 3時間

---

### フェーズ4: 簡易探索の実装（レベル2用） 【優先度: 中】

#### 4.1 浅い深さの先読み

**対象ファイル:**
- [MODIFY] [endgame_solver.js](file:///c:/Users/miura/WP_blog/2_Game_projects/Character_Daifugou_AI_kai/js/endgame_solver.js)
- [MODIFY] [AI_engin.js](file:///c:/Users/miura/WP_blog/2_Game_projects/Character_Daifugou_AI_kai/js/AI_engin.js)

**実装内容:**
1.  終盤（全員の手札合計が12枚以下）になったら、深さ2のMinimax風探索を実行
2.  相手の手を「ランダムな合法手」と仮定して評価
3.  時間制限 (800ms) を超えたら即座に現時点での最善手を返す

**予想作業時間:** 5時間

---

### フェーズ5: PIMC法のプロトタイプ実装（レベル3用） 【優先度: 低】

#### 5.1 カード推論エンジン

**対象ファイル:**
- [NEW] [card_inference.js](file:///c:/Users/miura/WP_blog/2_Game_projects/Character_Daifugou_AI_kai/js/card_inference.js)

**実装内容:**
1.  場に出たカードを記録し、「残りの未出カード」をリスト化
2.  各プレイヤーの手札枚数を追跡
3.  「未出カード」を「各プレイヤーの手札枚数」に応じてランダム分配する関数を実装

**予想作業時間:** 3時間

---

#### 5.2 モンテカルロシミュレーション

**対象ファイル:**
- [NEW] [mcts_engine.js](file:///c:/Users/miura/WP_blog/2_Game_projects/Character_Daifugou_AI_kai/js/mcts_engine.js)
- [MODIFY] [ai_worker.js](file:///c:/Users/miura/WP_blog/2_Game_projects/Character_Daifugou_AI_kai/js/ai_worker.js)

**実装内容:**
1.  分配された仮想手札で、ゲームを高速にシミュレーション（プレイアウト）
2.  各候補手について勝率を計算
3.  800ms以内で可能な限り多くのシミュレーションを実行
4.  勝率が最も高い手を選択

**予想作業時間:** 8時間

---

## 実装スケジュール表

| フェーズ | 内容 | 優先度 | 予想時間 | 累計時間 | 難易度適用 |
|---|---|---|---|---|---|
| フェーズ0 | 設定画面の追加 | 最高 | 3時間 | 3時間 | 全レベル |
| フェーズ1 | 思考中メッセージ強化 | 高 | 2時間 | 5時間 | 全レベル |
| フェーズ2 | Web Worker導入 | 高 | 4時間 | 9時間 | レベル2/3 |
| フェーズ3 | あがり確定判定 | 中 | 3時間 | 12時間 | レベル2/3 |
| フェーズ4 | 簡易探索（深さ2） | 中 | 5時間 | 17時間 | レベル2 |
| フェーズ5 | PIMC法プロトタイプ | 低 | 11時間 | 28時間 | レベル3 |

**総予想作業時間:** 約28時間（4〜5営業日相当）

---

## 検証計画

### 自動テスト（単体テスト）

本プロジェクトには現在、自動テストフレームワークは導入されていません。
以下の検証は手動で行います。

### 手動検証

#### 検証1: 設定画面の動作確認

1.  ブラウザで `index.html` を開く
2.  ホーム画面に「設定」ボタンが表示されることを確認
3.  「設定」ボタンをクリックし、設定モーダルが開くことを確認
4.  難易度を「レベル2」に変更し、警告メッセージが表示されることを確認
5.  設定を保存してページをリロードし、設定が保持されていることを確認

#### 検証2: 思考中メッセージの確認

1.  難易度をレベル1に設定してゲームを開始
2.  AIのターンで吹き出しにメッセージが表示されることを確認
3.  複数ターン観察し、メッセージにバリエーションがあることを確認

#### 検証3: Web Worker の動作確認

1.  難易度をレベル2またはレベル3に設定
2.  ブラウザの開発者ツールを開き、「ソース」タブで Worker が起動していることを確認
3.  AIのターン中、UIがフリーズせずに思考中メッセージが表示され続けることを確認

#### 検証4: あがり確定判定の確認

1.  デバッグモードで手札を操作し、AIが「確実にあがれる状態」を作る
2.  AIがその手を選択してあがることを確認

#### 検証5: スマホ実機テスト

1.  スマートフォンのブラウザでゲームを開く
2.  レベル1でプレイし、カクつきがないことを確認
3.  レベル2でプレイし、端末の発熱が許容範囲であることを確認
4.  レベル3でプレイし、警告通り発熱することを確認（ただし動作は継続すること）

---

## 注意事項

> [!IMPORTANT]
> フェーズ5（PIMC法）は計算量が大きいため、**PCユーザ向けのオプション機能**として位置づけます。スマートフォンでの実用性は保証しません。

> [!TIP]
> フェーズ0〜3の実装だけでも、終盤のミスが減少し「強くなった」と感じられる効果が期待できます。まずはここまでを優先して実装することを推奨します。

---

**作成日:** 2025-12-27  
**最終更新:** 2025-12-27  
**バージョン:** 1.0
