# ローカル用サンプルデータ

せいや、吉田、かいやき、ザイオン、とあ、ゆな、ゆい、落合、るみ、ひろくんの10名と、次の半月・その次の半月の希望シフトを作成します。昼・夜・どちらも可の希望、提出済み・下書き・未提出を確認できます。落合は操作確認用に未提出の状態で作成します。

## 作成

Node.js 22 と Docker Desktop を用意し、リポジトリのルートで実行します。

```sh
npm ci
npm run db:start:app
npm run db:seed
```

DB だけが起動済みの場合は、先に `npx supabase stop --project-id negisi` でこのプロジェクトだけ停止してから起動します。`--no-backup` は付けません。
認証・REST API を使用するため、DB のみを起動する `npm run db:start` だけではシードを作成できません。

シードスクリプトは Supabase CLI からローカル接続情報を取得し、API URL が `http://127.0.0.1:55321` と一致しない場合は処理を拒否します。クラウドのキーや `.env.local` の接続先は使用しません。`supabase db reset` やマイグレーションからは自動実行されません。

Auth の管理 API で架空のメールアドレスを登録し、本人のセッションから既存の保存 RPC を使って希望を作成します。招待・確認メールは送信しません。

## 画面の起動とログイン

既存の `.env.local` を上書きせず、PowerShell の同じターミナルでローカル接続に切り替えます。

```powershell
$localStatus = (& npx.cmd supabase status -o json | ConvertFrom-Json)
$env:NEXT_PUBLIC_SUPABASE_URL = $localStatus.API_URL
$env:NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = $localStatus.PUBLISHABLE_KEY
npm.cmd run dev -- --hostname 127.0.0.1 --port 3100
```

http://127.0.0.1:3100 を開き、シード用アカウントでログインします。メールアドレスと生成したパスワードはルートの `.env.seed.local` に保存されます。このファイルは Git の対象外です。実際のパスワードをソースコードや共有ログへ記載しないでください。

例として、せいやのメールアドレスは `negisi-seed-seiya@example.test`、パスワードは `.env.seed.local` の `SEED_SEIYA_PASSWORD` です。
落合のメールアドレスは `.env.seed.local` の `SEED_OCHIAI_EMAIL`、パスワードは `SEED_OCHIAI_PASSWORD` です。本番の落合アカウントとは別のローカル用アカウントです。ローカル Auth のメールを変更した場合は、このファイルも同じ値に更新してください。再実行時は保存済みのメールアドレスを使用します。

## 再実行と既存データ

- 同じシード用ユーザーは再利用し、パスワードを変更しません。
- 同じ日付の対象期間がある場合、その締め切り・受付状態を維持します。
- 既存の希望・提出状況は上書きしません。受付終了後の期間には希望を追加しません。
- シード用メールが通常ユーザーと重複する場合、処理を中止します。
- `.env.seed.local` がない状態でシード用ユーザーが存在する場合、パスワードを勝手に変更せずエラーにします。
- 半月が変わると、新しい対象期間を追加します。過去のデータは削除しません。

停止する場合は `npx supabase stop --project-id negisi` を使います。別のプロジェクトを停止したり、既存データを削除したりする必要はありません。

るみ・ひろくんには確定シフトの作成権限があります。操作は [確定シフト](published-shifts.md) を参照してください。
