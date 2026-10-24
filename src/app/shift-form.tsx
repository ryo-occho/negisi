'use client';

import { useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../lib/database.types';

type Client = SupabaseClient<Database>;
type Slot = 'lunch' | 'dinner' | 'either';
type Half = 'first' | 'second';
type Staff = Database['public']['Tables']['staff']['Row'];
type Period = Database['public']['Tables']['shift_periods']['Row'];
type Availability = Database['public']['Tables']['shift_availability']['Row'];
type Submission = Database['public']['Tables']['shift_submissions']['Row'];
const options: { value: Slot; label: string; symbol: string }[] = [
  { value: 'lunch', label: '昼', symbol: '☀' },
  { value: 'dinner', label: '夜', symbol: '☾' },
  { value: 'either', label: 'どちらも可', symbol: '◐' },
];

export default function ShiftForm({
  client,
  userId,
  initialMonth,
  initialHalf,
}: {
  client: Client;
  userId: string;
  initialMonth: string;
  initialHalf: Half;
}) {
  const [month, setMonth] = useState(initialMonth);
  const [half, setHalf] = useState<Half>(initialHalf);
  const [staff, setStaff] = useState<Staff[] | null>(null);
  const [error, setError] = useState('');
  const [dirty, setDirty] = useState(false);
  const [view, setView] = useState<'edit' | 'preview' | 'everyone'>('edit');
  const [signingOut, setSigningOut] = useState(false);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    let active = true;
    client
      .from('staff')
      .select('*')
      .order('display_name')
      .then(({ data, error: loadError }) => {
        if (!active) return;
        if (loadError)
          setError('スタッフ情報を取得できません。再読み込みしてください。');
        else setStaff(data);
      });
    return () => {
      active = false;
    };
  }, [client]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  const me = staff?.find(({ id, active }) => id === userId && active);
  function canLeave() {
    if (saving) return false;
    return (
      !dirty ||
      window.confirm('未保存の希望があります。変更を破棄して移動しますか？')
    );
  }
  async function signOut() {
    if (!canLeave()) return;
    setSigningOut(true);
    const { error: signOutError } = await client.auth.signOut({
      scope: 'local',
    });
    if (signOutError) {
      setError('ログアウトに失敗しました。もう一度お試しください。');
      setSigningOut(false);
    }
  }
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-seal">ね</span>
          <span>
            ねぎしや<small>SHIFT NOTE</small>
          </span>
        </div>
        <p className="side-caption">スタッフのシフトノート</p>
        <nav aria-label="メインメニュー">
          {(
            [
              { id: 'edit', label: '▦ 希望を入力' },
              { id: 'preview', label: '☑ 提出内容を確認' },
              { id: 'everyone', label: '☷ みんなの希望' },
            ] as const
          ).map(({ id, label }) => (
            <button
              key={id}
              className={view === id ? 'nav-item active' : 'nav-item'}
              onClick={() => setView(id)}
            >
              {label}
            </button>
          ))}
        </nav>
        <div className="side-footer">
          <div>
            {me?.display_name ?? 'スタッフ'}
            <small>ねぎしや</small>
            <button
              className="clear-button"
              disabled={signingOut}
              onClick={signOut}
            >
              ログアウト
            </button>
          </div>
        </div>
      </aside>
      <main>
        <header className="topbar">
          <span>ねぎしや / シフト</span>
          <button
            className="clear-button mobile-logout"
            disabled={signingOut}
            onClick={signOut}
          >
            ログアウト
          </button>
          <span className="demo-badge">スタッフ専用</span>
        </header>
        <div className="content">
          <div className="page-heading">
            <div>
              <p className="eyebrow">SHIFT NOTE</p>
              <h1>
                {view === 'everyone'
                  ? 'みんなの希望'
                  : view === 'preview'
                    ? '提出内容を確認'
                    : '次のシフト、いつ出られる？'}
              </h1>
              <p className="subtitle">
                出勤できる日に、昼・夜の希望を入れましょう。
              </p>
            </div>
            <span className="heading-flower" aria-hidden="true">
              ✳
            </span>
          </div>
          {error && (
            <p role="alert" className="error-message">
              {error}
            </p>
          )}
          {!staff && !error ? (
            <p role="status">スタッフ情報を読み込み中…</p>
          ) : !me ? (
            <p role="alert">
              スタッフ登録がないか、利用が停止されています。店舗の運用担当者に確認してください。
            </p>
          ) : (
            <>
              <section className="period-card" aria-label="対象期間">
                <div>
                  <label htmlFor="month">対象の月</label>
                  <input
                    id="month"
                    type="month"
                    min="2000-01"
                    max="2100-12"
                    value={month}
                    onChange={(event) => {
                      if (
                        /^(20\d{2}|2100)-(0[1-9]|1[0-2])$/.test(
                          event.target.value,
                        ) &&
                        canLeave()
                      ) {
                        setMonth(event.target.value);
                        setDirty(false);
                      }
                    }}
                  />
                </div>
                <div className="half-picker" aria-label="半月の選択">
                  {(['first', 'second'] as const).map((value) => (
                    <button
                      key={value}
                      aria-pressed={half === value}
                      className={half === value ? 'selected' : ''}
                      onClick={() => {
                        if (value !== half && canLeave()) {
                          setHalf(value);
                          setDirty(false);
                        }
                      }}
                    >
                      {value === 'first' ? '前半 1〜15日' : '後半 16〜月末'}
                    </button>
                  ))}
                </div>
              </section>
              <PeriodEditor
                key={`${month}-${half}`}
                client={client}
                userId={userId}
                staff={staff ?? []}
                month={month}
                half={half}
                view={view}
                onDirty={setDirty}
                onSaving={setSaving}
              />
            </>
          )}
          <footer className="page-footer">
            ねぎしやの、みんなでつくるシフト。
          </footer>
        </div>
      </main>
    </div>
  );
}

function PeriodEditor({
  client,
  userId,
  staff,
  month,
  half,
  view,
  onDirty,
  onSaving,
}: {
  client: Client;
  userId: string;
  staff: Staff[];
  month: string;
  half: Half;
  view: 'edit' | 'preview' | 'everyone';
  onDirty: (value: boolean) => void;
  onSaving: (value: boolean) => void;
}) {
  const [year, monthNumber] = month.split('-').map(Number);
  const start = half === 'first' ? 1 : 16;
  const end = half === 'first' ? 15 : new Date(year, monthNumber, 0).getDate();
  const startsOn = `${month}-${String(start).padStart(2, '0')}`;
  const endsOn = `${month}-${end}`;
  const previousDay = new Date(Date.UTC(year, monthNumber - 1, start - 1))
    .toISOString()
    .slice(0, 10);
  const [deadline, setDeadline] = useState(`${previousDay}T23:59`);
  const [period, setPeriod] = useState<Period | null>(null);
  const [rows, setRows] = useState<Availability[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [availability, setAvailability] = useState<Record<string, Slot>>({});
  const [submittedAt, setSubmittedAt] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const { data: p, error: periodError } = await client
          .from('shift_periods')
          .select('*')
          .eq('starts_on', startsOn)
          .maybeSingle();
        if (periodError) throw periodError;
        if (!active) return;
        if (!p) {
          setPeriod(null);
          return;
        }
        const [a, s] = await Promise.all([
          client.from('shift_availability').select('*').eq('period_id', p.id),
          client.from('shift_submissions').select('*').eq('period_id', p.id),
        ]);
        if (a.error) throw a.error;
        if (s.error) throw s.error;
        if (!active) return;
        setPeriod(p);
        setRows(a.data);
        setSubmissions(s.data);
        setAvailability(
          Object.fromEntries(
            a.data
              .filter((row) => row.staff_id === userId)
              .map((row) => [row.work_date, row.slot as Slot]),
          ),
        );
        setSubmittedAt(
          s.data.find((row) => row.staff_id === userId)?.submitted_at ?? null,
        );
      } catch {
        if (active)
          setError(
            'データを取得できません。通信状態とスタッフ登録を確認してください。',
          );
      } finally {
        if (active) setBusy(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [client, startsOn, userId, revision]);

  const days = Array.from({ length: end - start + 1 }, (_, index) => {
    const day = start + index;
    return {
      day,
      key: `${month}-${String(day).padStart(2, '0')}`,
      weekday: new Date(year, monthNumber - 1, day).getDay(),
    };
  });
  const selectedDays = days.filter(({ key }) => availability[key]);
  const closed =
    !period?.accepting || Date.now() >= new Date(period.deadline).getTime();
  function choose(key: string, slot?: Slot) {
    if (busy || closed) return;
    setAvailability((previous) => {
      const next = { ...previous };
      if (slot) next[key] = slot;
      else delete next[key];
      return next;
    });
    setDirty(true);
    onDirty(true);
    setMessage('');
  }
  async function save(submit: boolean) {
    if (!period || busy) return;
    setBusy(true);
    onSaving(true);
    setError('');
    setMessage('');
    try {
      const { data, error: saveError } = await client.rpc(
        'save_shift_availability',
        {
          p_period_id: period.id,
          p_entries: selectedDays.map(({ key }) => ({
            work_date: key,
            slot: availability[key],
          })),
          p_submit: submit,
        },
      );
      if (saveError) throw saveError;
      setSubmittedAt(data);
      setDirty(false);
      onDirty(false);
      setMessage(submit ? '希望を提出しました。' : '下書きを保存しました。');
      setRevision((value) => value + 1);
    } catch {
      setError(
        '保存できませんでした。締め切り・受付状況・通信状態を確認してください。入力内容は保持されています。',
      );
      setBusy(false);
    } finally {
      onSaving(false);
    }
  }

  if (busy && !period) return <p role="status">希望シフトを読み込み中…</p>;
  if (!period)
    return (
      <section className="preview-card setup-card">
        <h2>
          {monthNumber}月{start}日〜{end}日の受付
        </h2>
        {error ? (
          <p className="error-message" role="alert">
            {error}
          </p>
        ) : (
          <p>
            この期間はまだ受付が作成されていません。全スタッフが作成できます。
          </p>
        )}
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            setBusy(true);
            setError('');
            try {
              const { error: createError } = await client
                .from('shift_periods')
                .insert({
                  starts_on: startsOn,
                  ends_on: endsOn,
                  deadline: `${deadline}:00+09:00`,
                });
              if (createError && createError.code !== '23505')
                throw createError;
              setRevision((value) => value + 1);
            } catch {
              setError(
                '受付を作成できません。締め切りは対象期間の開始前に設定してください。',
              );
              setBusy(false);
            }
          }}
        >
          <label htmlFor="deadline">提出締め切り（日本時間）</label>
          <input
            id="deadline"
            type="datetime-local"
            required
            value={deadline}
            onChange={(event) => setDeadline(event.target.value)}
            disabled={busy}
          />
          <button className="submit-button" disabled={busy}>
            {busy ? '作成中…' : 'この期間の受付を作成'}
          </button>
        </form>
      </section>
    );

  return (
    <>
      <div className="demo-note">
        締め切り：
        {new Date(period.deadline).toLocaleString('ja-JP', {
          timeZone: 'Asia/Tokyo',
        })}
        （日本時間） · {closed ? '受付終了' : '受付中'}
        <br />
        希望は「下書き保存」または「提出」で保存されます。希望と確定シフトは異なります。
      </div>
      <div className="section-heading">
        <h2>
          {monthNumber}月{start}日 <span>—</span> {end}日
        </h2>
        <span className="status">
          {dirty ? '未保存の変更あり' : submittedAt ? '● 提出済み' : '○ 未提出'}
        </span>
      </div>
      {error && (
        <p role="alert" className="error-message">
          {error}
        </p>
      )}
      {view === 'everyone' ? (
        <section className="preview-card">
          <h3>全員の保存済み希望</h3>
          <p className="hint">
            未提出の下書きも表示します。最新の内容は再読み込みして確認してください。
          </p>
          <div className="shared-table">
            <table>
              <thead>
                <tr>
                  <th>スタッフ</th>
                  <th>提出状況</th>
                  {days.map(({ day }) => (
                    <th key={day}>{day}日</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {staff.map((person) => (
                  <tr key={person.id}>
                    <th>
                      {person.display_name}
                      {person.active ? '' : '（利用停止）'}
                    </th>
                    <td>
                      {submissions.find((s) => s.staff_id === person.id)
                        ?.submitted_at
                        ? '提出済み'
                        : '未提出'}
                    </td>
                    {days.map(({ key }) => (
                      <td key={key}>
                        {options.find(
                          (o) =>
                            o.value ===
                            rows.find(
                              (r) =>
                                r.staff_id === person.id && r.work_date === key,
                            )?.slot,
                        )?.label ?? '—'}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="hint">
            —
            は出勤不可です。未提出者の空欄は、まだ入力していない場合もあります。
          </p>
        </section>
      ) : view === 'preview' ? (
        <section className="preview-card">
          <h3>
            {dirty
              ? '未保存の希望'
              : submittedAt
                ? '提出した希望'
                : '入力中の希望'}
          </h3>
          {selectedDays.length === 0 ? (
            <p>出勤可能な日はありません。</p>
          ) : (
            <ul>
              {selectedDays.map(({ key, day }) => (
                <li key={key}>
                  <span>
                    {monthNumber}月{day}日
                  </span>
                  <strong>
                    {
                      options.find(
                        (option) => option.value === availability[key],
                      )?.label
                    }
                  </strong>
                </li>
              ))}
            </ul>
          )}
          <p className="hint">ここにない日は出勤不可です。</p>
        </section>
      ) : (
        <section className="schedule-card" aria-label="希望シフトの入力">
          <div className="table-heading">
            <span>日付</span>
            <span>出勤できる時間帯</span>
            <span>選択内容</span>
          </div>
          {days.map(({ day, key, weekday }) => (
            <div className="day-row" key={key}>
              <div
                className={`date ${weekday === 0 ? 'sunday' : weekday === 6 ? 'saturday' : ''}`}
              >
                <strong>{day}</strong>
                <span>
                  {['日', '月', '火', '水', '木', '金', '土'][weekday]}
                </span>
              </div>
              <div
                className="slot-options"
                role="group"
                aria-label={`${monthNumber}月${day}日の希望`}
              >
                {options.map(({ value, label, symbol }) => (
                  <button
                    key={value}
                    disabled={busy || closed}
                    aria-pressed={availability[key] === value}
                    className={`slot ${availability[key] === value ? `chosen ${value}` : ''}`}
                    onClick={() =>
                      choose(
                        key,
                        availability[key] === value ? undefined : value,
                      )
                    }
                  >
                    <span aria-hidden="true">{symbol}</span>
                    {label}
                  </button>
                ))}
              </div>
              <div className="row-summary">
                {availability[key] ? (
                  <button
                    disabled={busy || closed}
                    className="clear-button"
                    aria-label={`${monthNumber}月${day}日の選択を解除`}
                    onClick={() => choose(key)}
                  >
                    解除 ×
                  </button>
                ) : (
                  <span>出勤不可</span>
                )}
              </div>
            </div>
          ))}
        </section>
      )}
      {view !== 'everyone' && (
        <div className="bottom-panel">
          <div>
            <strong>選ばない日は、出勤不可になります。</strong>
            <p>「どちらも可」は昼か夜のどちらでも勤務できる意味です。</p>
            <small>{selectedDays.length}日 出勤可能</small>
          </div>
          <div className="save-actions">
            <button
              className="secondary-button"
              disabled={busy || closed || !dirty}
              onClick={() => save(false)}
            >
              下書き保存
            </button>
            <button
              className="submit-button"
              disabled={busy || closed || Boolean(submittedAt && !dirty)}
              onClick={() => save(true)}
            >
              {busy ? '保存中…' : 'この内容で提出'}
            </button>
          </div>
        </div>
      )}
      <p className="feedback" role="status">
        {message}
      </p>
    </>
  );
}
