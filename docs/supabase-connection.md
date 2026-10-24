# Supabase 接続とスタッフの利用開始

## アプリの接続設定

`.env.example` を `.env.local` にコピーし、Supabase の Project URL と publishable key を設定します。

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

この2つはブラウザーで利用する公開情報です。secret key や service_role キーを設定しないでください。
実際の `.env.local` は Git の追跡対象外です。Vercel でも同じ名前で対象環境に設定し、反映には新しいビルドが必要です。

## スタッフ登録

アプリに管理者ロールはありませんが、利用者を店舗のスタッフに限定するため、最初の登録は Supabase Dashboard で行います。

1. Authentication > Users で、スタッフのメールアドレス・本人に渡す初期パスワードを使ってユーザーを作成します。
2. メール確認済みとして利用できるように設定し、そのユーザーの UUID を確認します。
3. Table Editor の staff に同じ UUID、表示名、active=true を登録します。
4. スタッフはアプリのログイン画面でメールアドレス・パスワードを入力します。

パスワードをソースコード、Issue、PR、共有チャットへ記載しないでください。
自己登録画面はありません。Auth にユーザーがいても staff に有効な登録がなければ DB へアクセスできません。
退職時は staff.active を false にすると、既存ログインセッションが残っていても DB の RLS がアクセスを拒否します。
Auth の公開サインアップは Dashboard で無効化してください。パスワード再設定は当面 Dashboard の運用で対応します。

2026-10-24 の読み取り確認では、クラウドの公開サインアップは有効（`disable_signup=false`）でした。今回は設定を変更していません。実スタッフの利用開始前に必ず無効化し、登録済みユーザーのログインが引き続き可能なことを確認してください。Auth ユーザーと staff はともに0件でした。登録前後の確認手順は [利用開始・検証ガイド](readiness.md) を参照してください。

## 対象期間と希望保存

- 初期表示は次の半月です。月と前半・後半を切り替えられます。
- 受付がない期間は、全スタッフが日本時間の締め切りを指定して作成できます。
- 未入力は出勤不可です。下書き保存と提出は、それぞれ DB に保存します。
- 提出後も締め切り前は修正・再提出が可能です。未保存の入力は別の期間への移動や再読み込みで失われるため、警告を表示します。
- 全日出勤不可の場合も、空の希望で提出できます。
- 「みんなの希望」で、全員の保存済み希望と提出状況を確認します。未提出の下書きも閲覧対象です。
- 締め切り後・受付終了後の保存は DB が拒否します。開始済み期間も表示できますが、新規の希望提出はできません。

確定シフトの割り当て・公開は今回の対象外です。複数端末で同じ本人の希望を編集した場合は、最後に保存した内容が反映されます。

## 保存の安全性

save_shift_availability は SECURITY INVOKER の RPC です。本人の ID は auth.uid() から取得し、スタッフ ID を引数で受け取りません。
既存の RLS を適用したまま、希望の置き換えと提出状態の更新を1トランザクションで行います。入力不正などで失敗した場合は元の希望が保持されます。
関数の実行は authenticated のみに許可し、匿名ユーザーへの実行は拒否します。

## 検証

```sh
npm run lint
npm run typecheck
npm run build
npm run db:start
npm run test:db
```

ローカルで認証と REST API も試す場合は、Docker を起動して次を実行します。

```sh
npx supabase start -x realtime,storage-api,imgproxy,mailpit,postgres-meta,studio,edge-runtime,logflare,vector,supavisor
```

ローカル API は http://127.0.0.1:55321、DB は55322です。接続先をローカル用の URL・公開キーに切り替え、ローカルの Auth にテストユーザーを作成してください。
クラウドのスタッフ情報や認証情報をテストデータとして使用しません。

## クラウドへの反映状況

保存用 RPC のマイグレーションはクラウドに適用済みです。Vercel の Preview / Production / Development に上記2つの公開環境変数を登録し、Framework Preset を Next.js に設定しました。アプリの変更を公開環境へ反映するには、新しいデプロイが必要です。

ローカル設定では auth.enable_signup=false で自己登録を禁止し、auth.email.enable_signup=true でメールログイン機能を有効にしています。既存ユーザーのログインと、誰でも登録できることは別々に制御しています。
