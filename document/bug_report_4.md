# バグレポート #4: 実機スマホでの手札表示問題

## 問題の概要

| 項目 | 内容 |
|---|---|
| 発生環境 | 実機スマートフォン（iOS/Android） |
| 症状 | 手札が表示されない、または上端のみ表示される |
| 再現性 | 機種により発生 |
| PCブラウザ (スマホモード) | 正常動作を確認 |

---

## 原因分析

### 1. 100vh問題（最も可能性が高い）

**問題点:**
- `body` に `h-screen`（= `height: 100vh`）を使用している
- モバイルブラウザ（特にiOS Safari、Chrome）では `100vh` がアドレスバーやナビゲーションバーを**含んだ**高さで計算される
- しかし実際の表示領域はこれらのUIが占有しているため、下部コンテンツが画面外に押し出される

```
┌─────────────────┐
│   アドレスバー   │  ← 計算に含まれるが表示領域を占有
├─────────────────┤
│                 │
│   ゲーム画面     │
│                 │
├─────────────────┤
│   手札エリア     │  ← 画面外に押し出される！
├─────────────────┤
│  ナビゲーション  │  ← 計算に含まれるが表示領域を占有
└─────────────────┘
```

### 2. PCデベロッパーツールで再現しない理由

- PC版Chromeのモバイルエミュレータは、実際のモバイルブラウザのviewport挙動を完全には再現しない
- 特にアドレスバーの動的な表示/非表示の挙動が異なる

---

## 該当コード

### index.html (line 13)
```html
<body class="h-screen w-screen flex flex-col">
```

### style.css (line 192)
```css
main {
    flex: 1;  /* flex-1 は残りスペースを埋めるが、親が100vhで計算されると問題 */
}
```

---

## 提案される対策

### 対策A: CSS `dvh` ユニットを使用（推奨）

**概要:** WWDC22で導入された新しいviewport単位を使用

```css
body {
    height: 100vh;  /* フォールバック */
    height: 100dvh; /* Dynamic Viewport Height */
}
```

**メリット:**
- ブラウザUIの表示/非表示に動的に対応
- iOS Safari 15.4+、Chrome 108+でサポート

**デメリット:**
- 古いブラウザでは非対応（フォールバック必要）

---

### 対策B: JavaScript による動的高さ設定

**概要:** `window.innerHeight` を使用してCSS変数を設定

```javascript
function setVh() {
    const vh = window.innerHeight * 0.01;
    document.documentElement.style.setProperty('--vh', `${vh}px`);
}

window.addEventListener('resize', setVh);
window.addEventListener('orientationchange', setVh);
setVh();
```

```css
body {
    height: calc(var(--vh, 1vh) * 100);
}
```

**メリット:**
- 古いブラウザでも動作
- より細かい制御が可能

**デメリット:**
- JavaScriptに依存
- resize/orientationchangeイベントへの対応が必要

---

### 対策C: 固定高さの回避とスクロール許可

**概要:** `h-screen` を削除し、コンテンツに応じた高さに変更

```html
<body class="min-h-screen w-screen flex flex-col">
```

```css
body {
    min-height: 100vh;
    min-height: 100dvh;
}
```

**メリット:**
- 最もシンプル
- 上方向のスクロールで対応可能

**デメリット:**
- ゲーム画面がスクロール可能になる可能性

---

### 対策D: ハイブリッドアプローチ（最も堅牢）

**dvh + JavaScript フォールバック**

```css
:root {
    --app-height: 100vh;
}

@supports (height: 100dvh) {
    :root {
        --app-height: 100dvh;
    }
}

body {
    height: var(--app-height);
}
```

```javascript
// dvh非対応ブラウザ用フォールバック
if (!CSS.supports('height', '100dvh')) {
    function setAppHeight() {
        document.documentElement.style.setProperty('--app-height', `${window.innerHeight}px`);
    }
    window.addEventListener('resize', setAppHeight);
    window.addEventListener('orientationchange', setAppHeight);
    setAppHeight();
}
```

---

## 推奨対応

**対策Dを推奨します。**

理由:
1. 最新ブラウザでは `dvh` の恩恵を受けられる
2. 古いブラウザでもJavaScriptフォールバックで対応
3. パフォーマンスへの影響が最小限

---

## 追加確認事項

1. **`overflow: hidden`の確認**
   - `body` や `main` に `overflow: hidden` があると、コンテンツが見えなくなる可能性

2. **セーフエリア対応**
   - iPhone X以降の「ノッチ」や「ホームバー」への対応
   ```css
   padding-bottom: env(safe-area-inset-bottom, 0);
   ```

3. **flex-shrink の確認**
   - 手札エリアが `flex-shrink: 1` の場合、他の要素に押されて縮小される可能性

---

## テスト確認項目

- [ ] iOS Safari での表示確認
- [ ] iOS Chrome での表示確認
- [ ] Android Chrome での表示確認
- [ ] 縦向き・横向きの切り替え時の動作
- [ ] アドレスバー表示/非表示時の動作

---

**報告日:** 2025-12-27
**作成者:** AI Assistant
