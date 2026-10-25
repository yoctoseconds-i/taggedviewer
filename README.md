# 🖼️ TaggedViewer

> **ローカルAIの力で、大量の画像・AIイラストを一瞬で自動タグ付け＆スマート整理。**  
> 完全ローカル完結型・超高速な Electron ベースのスマート画像ビューア。

---

## 🌟 TaggedViewer とは？

**「ローカルフォルダに溜まったAI画像やイラスト、探すのに苦労していませんか？」**

`TaggedViewer` は、Hugging Face の **WD14 Tagger (ONNX Runtime)** を内蔵し、外部サーバーに画像を一切送信することなく、完全ローカルで高速に画像を全自動解析・タグ付けする次世代の画像管理アプリケーションです。

---

## ✨ 5つの主な特徴

### 1. 🤖 完全ローカル AI 自動タグ付け (WD14 Tagger)

- **プライバシー完全重視**: 外部 API やクラウドを使わず、PC ローカル上で ONNX Runtime (WD14 ViT V2) を実行。
- **マルチスレッド調整**: ご使用の PC スペックに合わせてスレッド数を自由調整（シングル〜アグレッシブ高速スキャン）。

### 2. 📝 AI 生成プロンプトの自動抽出 (PNG Info)
- WebUI や ComfyUI などで生成された PNG 画像から、プロンプト、ネガティブプロンプト、Seed 値などのメタデータを瞬時に読み取って表示。

### 3. 🔍 超高速タグ検索 ＆ タググループ
- アニメ特徴・ポーズ・背景など、お好みのタグをまとめた**「カスタムタググループ」**を作成可能。
- お気に入りタグのピン留め、非表示タグのフィルタリング、高速 AND/OR 検索に対応。

### 4. 🎬 ダイナミック Lightbox ＆ スライドショー
- **ノイズレス UI**: 閲覧を邪魔しない洗練されたダイナミック操作パネル。
- **スライドショー機能**: 表示順（通常/ランダム）や切替間隔を指定して、コレクションを快適に観賞。

### 5. ⚡ ローカルファースト ＆ エクスプローラー連携
- 低遅延なデータベース設計により、数万枚スケールのコレクションもサクサク快適に動作。
- アプリ内から即座に OS のエクスプローラーでファイル位置を開くことが可能。

---

## 🚀 インストール ＆ 実行

### 動作環境

- **OS**: Windows 10/11
- **Node.js**: v18 以降推奨

### 開発モードの起動

```bash
# リポジトリのクローン
git clone https://github.com/yoctoseconds/taggedviewer.git
cd taggedviewer

# 依存関係のインストール
npm install

# 開発サーバー & Electron の起動
npm run dev
```

### 本番ビルド (Windows Executable)

```bash
npm run dist
```
`dist/` ディレクトリに実行可能ファイル (.exe) が出力されます。

---

## 🛠️ 技術スタック

| レイヤー | 使用技術 / ライブリ |
| :--- | :--- |
| **Frontend** | React, Tailwind CSS, Lucide Icons, react-i18next |
| **Desktop Shell** | Electron, Vite, electron-vite |
| **AI / Machine Learning** | ONNX Runtime (WD14 ViT V2 Model) |
| **Database / Metadata** | SQLite / LowDB |
| **Image Processing** | Jimp |

---

## 🧪 テスト ＆ Lint

```bash
# ESLint & Prettier チェック
npm run lint

# 単体テスト (Vitest)
npm run test:unit

# E2Eテスト (Playwright)
npm run test:e2e
```

---

## 📄 ライセンス

MIT License

