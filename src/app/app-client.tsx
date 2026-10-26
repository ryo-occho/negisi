'use client';

import StaffName from './staff-name';

import { useEffect, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import type { Database } from '@/lib/database.types';
import { getSupabase } from '../lib/supabase';
import ShiftForm from './shift-form';
import UiIcon from './ui-icon';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

type Staff = Database['public']['Tables']['staff']['Row'];

export default function AppClient({
  initialMonth,
  initialHalf,
}: {
  initialMonth: string;
  initialHalf: 'first' | 'second';
}) {
  const [client] = useState(getSupabase);
  const [session, setSession] = useState<Session | null>(null);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [selected, setSelected] = useState<Staff | null>(null);
  const [ready, setReady] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const connecting = useRef<Promise<Session> | null>(null);

  useEffect(() => {
    if (!client) return;
    let active = true;
    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        connecting.current = null;
        setSelected(null);
        setSession(null);
        setReady(false);
        setRevision((value) => value + 1);
      }
    });
    async function load() {
      try {
        // Reuse a device session; opening the selector never picks a staff profile automatically.
        connecting.current ??= (async () => {
          const { data, error: sessionError } = await client!.auth.getSession();
          if (sessionError) throw sessionError;
          if (data.session) return data.session;
          const { data: guest, error: guestError } =
            await client!.auth.signInAnonymously();
          if (guestError || !guest.session)
            throw new Error('connection_failed');
          return guest.session;
        })();
        const current = await connecting.current;
        const { data, error: staffError } = await client!
          .from('staff')
          .select('*')
          .eq('active', true)
          .order('display_name');
        if (staffError) throw staffError;
        if (active) {
          setSession(current);
          setStaff(data);
          setError('');
        }
      } catch {
        connecting.current = null;
        if (active)
          setError(
            '名前の一覧を取得できません。通信状態を確認し、もう一度お試しください。',
          );
      } finally {
        if (active) setReady(true);
      }
    }
    void load();
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [client, revision]);

  if (client && selected)
    return (
      <ShiftForm
        key={selected.id}
        client={client}
        userId={selected.id}
        initialMonth={initialMonth}
        initialHalf={initialHalf}
        onChangeStaff={() => setSelected(null)}
      />
    );

  return (
    <main className="login-page">
      <Card className="w-full max-w-xl gap-5 rounded-3xl p-6 sm:p-10">
        <div className="brand">
          <span className="brand-seal">ね</span>
          <span>
            ねぎしや<small>SHIFT NOTE</small>
          </span>
        </div>
        <div>
          <h1>あなたの名前を選んでください</h1>
          <p className="hint m-0">名前をタップして、シフトノートを開きます。</p>
        </div>
        {!client ? (
          <p role="alert" className="error-message">
            接続設定が必要です。店舗の担当者に確認してください。
          </p>
        ) : !ready ? (
          <p role="status">名前を読み込み中…</p>
        ) : error ? (
          <>
            <p role="alert" className="error-message">
              {error}
            </p>
            <Button
              variant="outline"
              className="min-h-11"
              disabled={busyId !== null}
              onClick={() => {
                setReady(false);
                setRevision((value) => value + 1);
              }}
            >
              もう一度読み込む
            </Button>
          </>
        ) : staff.length === 0 ? (
          <p role="status">選択できるスタッフがまだ登録されていません。</p>
        ) : (
          <div className="grid grid-cols-2 gap-3" aria-label="スタッフの名前">
            {staff.map((person) => (
              <Button
                key={person.id}
                variant="outline"
                className="h-auto min-h-16 min-w-0 justify-between gap-2 whitespace-normal rounded-xl px-4 py-4 text-base"
                disabled={busyId !== null}
                onClick={async () => {
                  if (!session || busyId !== null) return;
                  setBusyId(person.id);
                  try {
                    const { error: selectError } = await client
                      .from('staff_sessions')
                      .upsert({
                        user_id: session.user.id,
                        staff_id: person.id,
                      });
                    if (selectError) throw selectError;
                    setSelected(person);
                  } catch {
                    setError(
                      '名前を選択できませんでした。もう一度読み込んでから選び直してください。',
                    );
                  } finally {
                    setBusyId(null);
                  }
                }}
              >
                <span className="min-w-0 flex-1 break-words text-center">
                  <StaffName name={person.display_name} />
                </span>
                <UiIcon name={busyId === person.id ? 'clock' : 'arrow'} />
              </Button>
            ))}
          </div>
        )}
      </Card>
    </main>
  );
}
