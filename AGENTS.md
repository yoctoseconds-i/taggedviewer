# AGENTS.md

このドキュメントは、`taggedviewer` の開発に携わるエージェントおよび開発者のための規約、ワークフロー、および重要な注意点をまとめたものです。

## プロジェクト概要

`taggedviewer` は、ローカルLLMを用いたタグ付け機能を持つElectronベースの画像ビューアです。フロントエンドにはReact、データストレージにはSQLiteを使用しています。

## ワークフロー

### テストとLint

- **Linting**: ESLintとPrettierを使用して厳格なLintを行っています。
  - `npm run lint`: エラーチェックを実行します。
  - `npm run lint -- --fix`: フォーマットの問題を自動修正します。
  - **重要**: `npm run lint` は、テストコマンド（`test:unit`, `test:e2e`）の前に自動的に実行されます。これをバイパスしないでください。
  - Prettierのエラーが発生した場合は、先に `npm run format` を実行してください。

- **単体テスト (Unit Tests)**:
  - `npm run test:unit` (Vitestを使用) を実行します。
  - テストファイルはソースファイルと同じ場所に配置されています（例：`App.test.tsx`）。
  - コンポーネントを変更した際は、関連するテストが通ることを確認してください。

- **E2Eテスト**:
  - `npm run test:e2e` (Playwrightを使用) を実行します。
  - ビルドに依存するテストがある場合、実行前にアプリケーションが正しくビルドされていることを確認してください。

### ビルド

- **開発モード**: `npm run dev` でElectron + Viteの開発サーバーを起動します。
- **本番ビルド**: `npm run dist` でWindows用の実行可能ファイルをビルドします。
  - **注意**: `npm run dist` は内部で `npm run build` を実行します。

## コード規約

### 命名規則

- **ファイル**: ReactコンポーネントはPascalCase（`ImageGrid.tsx`）、ユーティリティ/フックはcamelCase（`useIpc.ts`）、設定ファイルはkebab-case。
- **変数/関数**: camelCase。
- **インターフェース/型**: PascalCase。

### 構造

- `src/main`: Electronメインプロセスのコード。
- `src/preload`: Electronプリロードスクリプト。
- `src/renderer`: Reactフロントエンドコード。
  - `components`: 再利用可能なUIコンポーネント。
  - `hooks`: カスタムReactフック。
  - `i18n.ts`: 国際化設定。

## 開発上の注意点

- **IPC**: メインプロセスとレンダラープロセスの通信は `ipcRenderer.invoke` で行われます。
  - レンダラー側の抽象化については `src/renderer/src/hooks/useIpc.ts` を参照してください。
  - メイン側のハンドラについては `src/main/ipc.ts` （または類似ファイル）を参照してください。
- **データベース**: 画像のメタデータとタグの保存にはSQLiteを使用しています。スキーマの変更は慎重に行ってください（現在は `src/main/db.ts` で管理）。
- **国際化 (I18n)**: ユーザー向けの文字列はすべて `react-i18next` を使用して国際化する必要があります。
  - 翻訳キーは `src/renderer/src/i18n.ts` （またはロードされるリソース）にあります。

## よくある落とし穴

- **CIでのLint**: CIはLintの警告やエラーが一つでもあると失敗します（`--max-warnings 0`）。必ずローカルで問題を解決してください。
- **Effect内のAsync/Await**: `useEffect` 内では、自己実行非同期関数を適切に使用してください。
- **Prettier**: "Delete CR" や奇妙なフォーマットエラーが発生した場合は、`npm run lint -- --fix` または `npm run format` を実行してください。
