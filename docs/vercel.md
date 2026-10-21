# Vercel の設定と運用

## 確認済みの設定

| 項目              | 値                        |
| ----------------- | ------------------------- |
| プロジェクト      | negisi                    |
| チーム            | Occho（occho）            |
| プラン            | Hobby                     |
| GitHub リポジトリ | ryo-occho/negisi          |
| 本番ブランチ      | main                      |
| Node.js           | 24.x                      |
| Framework Preset  | Next.js                   |
| Root Directory    | リポジトリルート          |
| 公開 URL          | https://negisi.vercel.app |

これらは Vercel 側の設定です。この文書をマージしても設定の変更やデプロイは実行されません。
Node.js 24.x は現在の Vercel 設定で、CI の Node.js 22 とは異なります。
Framework Preset は Next.js に変更済みです。Node.js のバージョンを変更する際は CI と合わせて確認してください。

## 現在の公開状態

GitHub との連携と本番デプロイの作成は完了しています。
確認時点の main は初期構成のコミット 68a0d55 で、アプリ本体やトップページがないため公開 URL は404です。
Vercel の Ready はデプロイ処理の完了を示し、アプリ画面の実装完了を示すものではありません。
アプリの初期画面を実装した後、プレビューで表示を検証します。
Supabase 接続用の公開 URL と publishable key は Preview / Production / Development に登録済みです。接続・スタッフ登録の手順は [Supabase 接続ガイド](supabase-connection.md) を参照してください。

## ブランチの運用

1. feature/* から develop に PR を作成し、CI と必要なプレビュー確認を行います。
2. リリース時に develop から main に PR を作成します。
3. main にマージされた変更は、GitHub 連携による本番デプロイの対象になります。

本番へのマージや手動デプロイは、明示的な承認を得て実行します。
GitHub 連携によるプレビューの自動生成は、アプリ実装後の PR で動作を確認してください。

## CLI による確認

Vercel CLI 65.0.0 で、同じアカウント・チームからプロジェクトを取得できることを確認済みです。
CLI を導入した環境では、以下で認証とプロジェクトを確認できます。

```sh
vercel login
vercel whoami --format json --non-interactive
vercel --scope occho project inspect negisi --non-interactive
```

このコマンドは設定の変更やデプロイを行いません（login は CLI の認証を行います）。
CLI の認証情報は端末で管理し、トークンをチャットやリポジトリに記載しないでください。

## プラグインの既知の問題

確認時点では、ブラウザーと CLI から取得できる同じプロジェクトが、Vercel プラグインでは404になります。
チーム・アカウント・Project ID を照合済みで、CLI による同じ API の取得は成功しています。
プラグインの実効アクセス範囲、またはリクエスト処理に問題がある可能性が残っています。
内部原因は未確定です。当面の設定確認には CLI を使用します。
