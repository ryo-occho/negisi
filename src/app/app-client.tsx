'use client';

import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { getSupabase } from '../lib/supabase';
import ShiftForm from './shift-form';
import UiIcon from './ui-icon';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';

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
      <div className="login-layout">
        <aside className="login-story" aria-label="シフトノートについて">
          <p className="eyebrow">NEGISHIYA / SHIFT NOTE</p>
          <h2>
            いつものお店を、
            <br />
            みんなの予定で。
          </h2>
          <p className="login-story-copy">
            働ける日を選んで、ひとつのシフトノートに。
            <br />
            次の半月も、気持ちよくはじめましょう。
          </p>
          <div className="login-illustration" aria-hidden="true">
            <div className="illustration-calendar">
              <span>SHIFT NOTE</span>
              <div className="illustration-grid">
                {Array.from({ length: 12 }, (_, index) => (
                  <i key={index}>
                    {index === 4 || index === 6 || index === 9 ? (
                      <UiIcon name="check" />
                    ) : null}
                  </i>
                ))}
              </div>
            </div>
            <span className="illustration-stamp">
              <UiIcon name="sun" />
            </span>
          </div>
          <p className="login-story-footer">
            ねぎしやの、みんなでつくるシフト。
          </p>
        </aside>
        <Card className="login-card gap-0 border-0 bg-transparent p-7 shadow-none ring-0 sm:p-12">
          <div className="brand">
            <span className="brand-seal">ね</span>
            <span>
              ねぎしや<small>SHIFT NOTE</small>
            </span>
          </div>
          <p className="eyebrow">WELCOME BACK</p>
          <h1>シフトノートにログイン</h1>
          <p className="login-description">あなたの予定を、ここから。</p>
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
              <Label htmlFor="email">メールアドレス</Label>
              <Input
                id="email"
                type="email"
                autoComplete="username"
                required
                value={email}
                disabled={busy}
                onChange={(event) => setEmail(event.target.value)}
              />
              <Label htmlFor="password">パスワード</Label>
              <Input
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
              <Button type="submit" className="submit-button" disabled={busy}>
                {busy ? 'ログイン中…' : 'ログイン'}
                <UiIcon name="arrow" />
              </Button>
              <p className="hint">
                ねぎしやの登録済みスタッフのみ利用できます。アカウントがない場合やパスワードを忘れた場合は、店舗の運用担当者に連絡してください。
              </p>
            </form>
          )}
        </Card>
      </div>
    </main>
  );
}
