# 共同開発ガイド

## 開発を始める

```sh
git clone https://github.com/ryo-occho/negisi.git
cd negisi
```

Node.js 22 と Docker Desktop を用意し、`npm ci` で開発ツールをインストールします。PR 前に `npm run lint`、`npm run format:check`、`npm run db:start`、`npm run test:db` を実行してください。`npm run dev` で開発サーバーを起動し、`npm run build` で本番ビルド、`npm run typecheck` で型チェックを行います。
技術スタックを導入する際は、必要なバージョン、セットアップ、各コマンドを README に追加してください。
AI エージェントを利用する場合は AGENTS.md も参照してください。

## 変更の進め方

PR 前には `npm run lint`、`npm run format:check`、`npm run typecheck`、`npm run build` を実行します。認証・DB・希望保存を変更した場合は DB テストと [画面からの検証](docs/readiness.md) も実施してください。CI でも型チェックと本番ビルドを実行します。

1. 不具合や大きな機能追加は、Issue で目的と範囲を共有します。
2. 最新の `develop` から `feature/*` ブランチを作成します（例: `feature/login`、`feature/login-fix`、`feature/docs-setup`）。
3. 関連する変更だけを実装し、必要なドキュメントとテストを更新します。
4. 利用できるテスト・チェックを実行し、差分と機密情報の混入を確認します。
5. 作業ブランチをプッシュして `develop` 向けの PR を作成します。
6. レビューを依頼し、指摘を反映して `develop` にマージします。
7. リリース時に `develop` から `main` 向けの PR を作成し、レビュー後にマージします。

直接プッシュする権限がない場合は、Fork したリポジトリに作業ブランチをプッシュして PR を作成してください。

変更は `feature/* → develop → main` の順で取り込みます。`feature/*` から `main` へ直接 PR を作成しません。

## UI コンポーネント

UI は Tailwind CSS 4 と shadcn/ui（Radix UI、`radix-nova`）を使用します。`npm ci` で必要な依存関係が揃い、追加のセットアップは不要です。
設定は `components.json`、PostCSS の設定は `postcss.config.mjs`、配色は `src/app/globals.css` のテーマ変数で管理します。日本語のフォントは OS の標準フォントを使用します。
共通部品は `src/components/ui/` にあり、`@/components/ui/button` などのエイリアスで読み込みます。追加する場合は `npx shadcn@4.22.1 add <コンポーネント名>` を実行し、生成された差分と依存関係を確認してください。依存関係のバージョンは既存の規約に合わせて固定します。
Tailwind のユーティリティーが個別画面のスタイルを調整できるよう、既存のレイアウト CSS は `@layer components` に配置しています。共通部品を使う画面では、キーボード操作、未保存時の確認、320px 幅での表示も検証してください。

## PR とレビュー

- タイトルは変更内容が分かる簡潔なものにします。
- 目的、変更内容、検証の手順と結果を記載します。
- 未実施の検証は理由を明記し、既存の失敗と今回の変更による失敗を区別します。
- UI の変更は、必要に応じてスクリーンショットを添付します。
- 互換性への影響や未解決の問題があれば記載します。
- マージ前にレビューを受ける運用を推奨します。ブランチ保護は別途 GitHub で設定が必要です。

## 設定と機密情報

実際の認証情報や `.env` はコミットしないでください。
必要な環境変数は、秘密の値を含めず `.env.example` に記載します。
