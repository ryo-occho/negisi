'use client';

import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { getSupabase } from '../lib/supabase';
import ShiftForm from './shift-form';

export default function AppClient({
  initialMonth,
  initialHalf,
}: {
  initialMonth: string;
  initialHalf: 'first' | 'second';
}) {
  const [client] = useState(getSupabase);
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!client) return;
    let active = true;
    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((_event, next) => {
      if (active) {
        setSession(next);
        setReady(true);
      }
    });
    client.auth
      .getSession()
      .then(({ data, error: sessionError }) => {
        if (!active) return;
        if (sessionError)
          setError('ログイン状態を確認できません。再読み込みしてください。');
        setSession(data.session);
        setReady(true);
      })
      .catch(() => {
        if (active) {
          setError('接続できません。通信状態を確認してください。');
          setReady(true);
        }
      });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [client]);

  if (client && session)
    return (
      <ShiftForm
        key={session.user.id}
        client={client}
        userId={session.user.id}
        initialMonth={initialMonth}
        initialHalf={initialHalf}
      />
    );

  return (
    <main className="login-page">
      <section className="login-card">
        <div className="brand">
          <span className="brand-seal">ね</span>
          <span>
            ねぎしや<small>SHIFT NOTE</small>
          </span>
        </div>
        <h1>シフトノートにログイン</h1>
        {!client ? (
          <p role="alert">
            接続設定が必要です。.env.example を参考に Supabase の URL
            と公開キーを設定してください。
          </p>
        ) : !ready ? (
          <p role="status">ログイン状態を確認しています…</p>
        ) : (
          <form
            onSubmit={async (event) => {
              event.preventDefault();
              setBusy(true);
              setError('');
              try {
                const { error: signInError } =
                  await client.auth.signInWithPassword({
                    email: email.trim(),
                    password,
                  });
                if (signInError)
                  setError(
                    'ログインできませんでした。メールアドレス・パスワードを確認してください。',
                  );
                else setPassword('');
              } catch {
                setError(
                  '通信に失敗しました。時間をおいて再度お試しください。',
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            <label htmlFor="email">メールアドレス</label>
            <input
              id="email"
              type="email"
              autoComplete="username"
              required
              value={email}
              disabled={busy}
              onChange={(event) => setEmail(event.target.value)}
            />
            <label htmlFor="password">パスワード</label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              disabled={busy}
              onChange={(event) => setPassword(event.target.value)}
            />
            <p role="alert" className="error-message">
              {error}
            </p>
            <button className="submit-button" disabled={busy}>
              {busy ? 'ログイン中…' : 'ログイン'}
            </button>
            <p className="hint">
              ねぎしやの登録済みスタッフのみ利用できます。アカウントがない場合やパスワードを忘れた場合は、店舗の運用担当者に連絡してください。
            </p>
          </form>
        )}
      </section>
    </main>
  );
}
