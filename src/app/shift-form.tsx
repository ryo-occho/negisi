'use client';

import { useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../lib/database.types';
import UiIcon from './ui-icon';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { cn } from '@/lib/utils';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

type Client = SupabaseClient<Database>;
type Slot = 'lunch' | 'dinner' | 'either';
type Half = 'first' | 'second';
type View = 'edit' | 'preview' | 'resubmit' | 'everyone';
type Staff = Database['public']['Tables']['staff']['Row'];
type Period = Database['public']['Tables']['shift_periods']['Row'];
type Availability = Database['public']['Tables']['shift_availability']['Row'];
type Submission = Database['public']['Tables']['shift_submissions']['Row'];
const options = [
  { value: 'lunch', label: '昼', icon: 'sun' },
  { value: 'dinner', label: '夜', icon: 'moon' },
  { value: 'either', label: 'どちらも可', icon: 'either' },
] as const;

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
  const [view, setView] = useState<View>('edit');
  const [signingOut, setSigningOut] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);
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
  function requestLeave(action: () => void) {
    if (saving) return;
    if (dirty) setPendingAction(() => action);
    else action();
  }
  async function signOut() {
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
        <p className="side-caption">WORKSPACE</p>
        <nav aria-label="メインメニュー">
          {(
            [
              { id: 'edit', label: '希望を入力', icon: 'calendar' },
              { id: 'preview', label: '提出内容を確認', icon: 'check' },
              { id: 'resubmit', label: '再提出', icon: 'refresh' },
              { id: 'everyone', label: 'スタッフの希望一覧', icon: 'users' },
            ] as const
          ).map(({ id, label, icon }) => (
            <Button
              variant="ghost"
              key={id}
              className={cn(
                'nav-item h-auto min-w-0 justify-start text-[13px] max-[760px]:justify-center max-[760px]:px-1 max-[760px]:text-[11px] max-[380px]:text-[10px]',
                view === id && 'active',
              )}
              aria-pressed={view === id}
              onClick={() => setView(id)}
            >
              <UiIcon name={icon} />
              <span>{label}</span>
            </Button>
          ))}
        </nav>
        <div className="side-footer">
          <span className="avatar" aria-hidden="true">
            {me?.display_name.slice(0, 1) ?? 'ね'}
          </span>
          <div>
            {me?.display_name ?? 'スタッフ'}
            <small>ねぎしや</small>
            <Button
              variant="ghost"
              size="sm"
              className="clear-button"
              disabled={signingOut}
              onClick={() => requestLeave(() => void signOut())}
            >
              <UiIcon name="logout" />
              ログアウト
            </Button>
          </div>
        </div>
      </aside>
      <main>
        <header className="topbar">
          <span className="breadcrumb">
            ねぎしや <span>/</span> シフトノート
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="clear-button mobile-logout hidden max-[760px]:inline-flex"
            disabled={signingOut}
            onClick={() => requestLeave(() => void signOut())}
          >
            <UiIcon name="logout" />
            ログアウト
          </Button>
          <Badge variant="secondary" className="demo-badge max-[760px]:hidden">
            スタッフ専用
          </Badge>
        </header>
        <div className="content">
          <div className="page-heading">
            <div>
              <p className="eyebrow">MAKE ROOM FOR YOUR DAYS</p>
              <h1>
                {view === 'everyone'
                  ? 'スタッフの希望一覧'
                  : view === 'preview'
                    ? '提出内容を確認'
                    : view === 'resubmit'
                      ? '提出した希望を変更する'
                      : '希望シフトの入力'}
              </h1>
              <p className="subtitle">
                {view === 'everyone'
                  ? 'スタッフの希望と提出状況を一覧で確認できます。'
                  : view === 'preview'
                    ? '選んだ日と時間帯を、もう一度チェックしましょう。'
                    : view === 'resubmit'
                      ? '提出済みの希望を修正して、変更した内容を再提出できます。'
                      : '出勤可能な日と時間帯を選択してください。'}
              </p>
            </div>
            <span className="heading-icon" aria-hidden="true">
              <UiIcon
                name={
                  view === 'everyone'
                    ? 'users'
                    : view === 'preview'
                      ? 'check'
                      : view === 'resubmit'
                        ? 'refresh'
                        : 'calendar'
                }
              />
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
              <Card
                className="period-card flex-row flex-wrap items-center gap-5 p-5 shadow-none"
                role="region"
                aria-label="対象期間"
              >
                <div>
                  <Label htmlFor="month">対象の月</Label>
                  <Input
                    id="month"
                    type="month"
                    min="2000-01"
                    max="2100-12"
                    value={month}
                    onChange={(event) => {
                      const nextMonth = event.target.value;
                      if (/^(20\d{2}|2100)-(0[1-9]|1[0-2])$/.test(nextMonth)) {
                        requestLeave(() => {
                          setMonth(nextMonth);
                          setDirty(false);
                        });
                      }
                    }}
                  />
                </div>
                <div className="half-picker" aria-label="半月の選択">
                  {(['first', 'second'] as const).map((value) => (
                    <Button
                      variant="ghost"
                      key={value}
                      aria-pressed={half === value}
                      className={cn(
                        'h-11 min-w-0 flex-1 px-2 text-xs',
                        half === value && 'selected',
                      )}
                      onClick={() => {
                        if (value !== half) {
                          requestLeave(() => {
                            setHalf(value);
                            setDirty(false);
                          });
                        }
                      }}
                    >
                      {value === 'first' ? '前半 1〜15日' : '後半 16〜月末'}
                    </Button>
                  ))}
                </div>
              </Card>
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
                onViewChange={setView}
              />
            </>
          )}
          <footer className="page-footer">
            ねぎしやの、みんなでつくるシフト。
          </footer>
        </div>
      </main>
      <AlertDialog
        open={pendingAction !== null}
        onOpenChange={(open) => {
          if (!open) setPendingAction(null);
        }}
      >
        <AlertDialogContent className="w-[calc(100%-2rem)]">
          <AlertDialogHeader>
            <AlertDialogTitle>未保存の希望があります</AlertDialogTitle>
            <AlertDialogDescription>
              移動すると、保存していない変更は失われます。編集を続けるか、変更を破棄して移動してください。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="min-h-11">
              編集を続ける
            </AlertDialogCancel>
            <AlertDialogAction
              className="min-h-11"
              onClick={() => {
                pendingAction?.();
                setPendingAction(null);
              }}
            >
              変更を破棄して移動
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
  onViewChange,
}: {
  client: Client;
  userId: string;
  staff: Staff[];
  month: string;
  half: Half;
  view: View;
  onDirty: (value: boolean) => void;
  onSaving: (value: boolean) => void;
  onViewChange: (view: View) => void;
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
      setMessage(
        submit
          ? view === 'resubmit'
            ? '変更を再提出しました。'
            : '希望を提出しました。'
          : '下書きを保存しました。',
      );
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
  if (!period && view === 'resubmit' && !error)
    return (
      <Card className="preview-card setup-card gap-4">
        <h2>この期間はまだ提出されていません</h2>
        <p className="hint">初めての提出は「希望を入力」から行ってください。</p>
        <Button
          className="submit-button self-start"
          onClick={() => onViewChange('edit')}
        >
          希望を入力する
          <UiIcon name="arrow" />
        </Button>
      </Card>
    );
  if (!period)
    return (
      <Card className="preview-card setup-card gap-0 p-6 sm:p-8">
        <span className="setup-icon">
          <UiIcon name="calendar" />
        </span>
        <p className="eyebrow">A NEW SCHEDULE</p>
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
          <Label htmlFor="deadline">提出締め切り（日本時間）</Label>
          <Input
            id="deadline"
            type="datetime-local"
            required
            value={deadline}
            onChange={(event) => setDeadline(event.target.value)}
            disabled={busy}
          />
          <Button type="submit" className="submit-button" disabled={busy}>
            {busy ? '作成中…' : 'この期間の受付を作成'}
          </Button>
        </form>
      </Card>
    );

  return (
    <>
      <div className="demo-note">
        <div className="deadline-label">
          <UiIcon name="clock" />
          <span>提出締め切り</span>
        </div>
        <div className="deadline-detail">
          <strong>
            {new Date(period.deadline).toLocaleString('ja-JP', {
              timeZone: 'Asia/Tokyo',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </strong>
          <span className={`acceptance ${closed ? 'closed' : ''}`}>
            {closed ? '受付終了' : '受付中'}
          </span>
        </div>
        <p>
          日本時間 ·
          希望は下書き保存・提出で保存されます。確定シフトとは異なります。
        </p>
      </div>
      <div className="section-heading">
        <h2>
          {monthNumber}月{start}日 <span>—</span> {end}日
        </h2>
        <Badge
          variant="outline"
          className={cn(
            'status h-auto px-3 py-1.5 text-xs',
            submittedAt && !dirty
              ? 'submitted border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-amber-200 bg-amber-50 text-amber-800',
          )}
        >
          {submittedAt && !dirty ? (
            <UiIcon name="check" />
          ) : (
            <span className="status-dot" aria-hidden="true" />
          )}
          {dirty ? '未保存の変更あり' : submittedAt ? '提出済み' : '未提出'}
        </Badge>
      </div>
      {error && (
        <p role="alert" className="error-message">
          {error}
        </p>
      )}
      {view === 'everyone' ? (
        <Card className="preview-card gap-0">
          <h3>全員の保存済み希望</h3>
          <p className="hint">
            未提出の下書きも表示します。最新の内容は再読み込みして確認してください。
          </p>
          <div className="shared-table">
            <table>
              <thead>
                <tr>
                  <th scope="col">スタッフ</th>
                  <th scope="col">提出状況</th>
                  {days.map(({ day }) => (
                    <th scope="col" key={day}>
                      {day}日
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {staff.map((person) => (
                  <tr key={person.id}>
                    <th scope="row">
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
        </Card>
      ) : view === 'preview' ||
        (view === 'edit' && submittedAt) ||
        (view === 'resubmit' && !submittedAt) ? (
        <Card className="preview-card gap-0">
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
          {submittedAt ? (
            <div className="mt-5 flex flex-col items-start gap-3 border-t border-border pt-5">
              <p className="hint m-0">
                {closed
                  ? '受付が終了したため、この提出内容は変更できません。'
                  : '変更したい場合は「再提出」から修正できます。変更を再提出するまでは、前回の提出内容が保存されています。'}
              </p>
              <Button
                className="submit-button"
                disabled={closed || busy}
                onClick={() => onViewChange('resubmit')}
              >
                <UiIcon name="refresh" />
                再提出へ進む
              </Button>
            </div>
          ) : view === 'resubmit' ? (
            <div className="mt-5 flex flex-col items-start gap-3 border-t border-border pt-5">
              <p className="hint m-0">
                この期間はまだ未提出です。初めての提出は「希望を入力」から行ってください。
              </p>
              <Button
                className="submit-button"
                onClick={() => onViewChange('edit')}
              >
                希望を入力する
                <UiIcon name="arrow" />
              </Button>
            </div>
          ) : null}
        </Card>
      ) : (
        <Card
          className="schedule-card gap-0 overflow-hidden py-0 shadow-none"
          role="region"
          aria-label="希望シフトの入力"
        >
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
              <ToggleGroup
                type="single"
                variant="outline"
                value={availability[key] ?? ''}
                onValueChange={(value) =>
                  choose(key, value ? (value as Slot) : undefined)
                }
                disabled={busy || closed}
                className="slot-options w-full"
                aria-label={`${monthNumber}月${day}日の希望`}
              >
                {options.map(({ value, label, icon }) => (
                  <ToggleGroupItem
                    key={value}
                    value={value}
                    className={cn(
                      'slot h-11 min-w-0 flex-1 px-2 text-xs last:flex-[1.5]',
                      value === 'lunch'
                        ? 'data-[state=on]:border-emerald-300 data-[state=on]:bg-emerald-50 data-[state=on]:text-emerald-800'
                        : value === 'dinner'
                          ? 'data-[state=on]:border-indigo-300 data-[state=on]:bg-indigo-50 data-[state=on]:text-indigo-800'
                          : 'data-[state=on]:border-amber-300 data-[state=on]:bg-amber-50 data-[state=on]:text-amber-800',
                    )}
                  >
                    <UiIcon name={icon} />
                    {label}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
              <div className="row-summary">
                {availability[key] ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={busy || closed}
                    className="clear-button"
                    aria-label={`${monthNumber}月${day}日の選択を解除`}
                    onClick={() => choose(key)}
                  >
                    解除 ×
                  </Button>
                ) : (
                  <span>出勤不可</span>
                )}
              </div>
            </div>
          ))}
        </Card>
      )}
      {view === 'resubmit' && submittedAt && (
        <p className="hint mt-4">
          {closed
            ? '受付が終了したため、再提出はできません。'
            : '変更後は「変更を再提出」を押してください。再提出するまでは、前回の提出内容は変わりません。'}
        </p>
      )}
      {((view === 'resubmit' && submittedAt) ||
        ((view === 'edit' || view === 'preview') && !submittedAt)) && (
        <div className="bottom-panel">
          <div>
            <strong>選ばない日は、出勤不可になります。</strong>
            <p>「どちらも可」は昼か夜のどちらでも勤務できる意味です。</p>
            <small>{selectedDays.length}日 出勤可能</small>
          </div>
          <div className="save-actions">
            {view !== 'resubmit' && (
              <Button
                variant="outline"
                className="secondary-button"
                disabled={busy || closed || !dirty}
                onClick={() => save(false)}
              >
                下書き保存
              </Button>
            )}
            <Button
              type="button"
              className="submit-button"
              disabled={busy || closed || Boolean(submittedAt && !dirty)}
              onClick={() => save(true)}
            >
              {busy
                ? '保存中…'
                : view === 'resubmit'
                  ? '変更を再提出'
                  : 'この内容で提出'}
              <UiIcon name="arrow" />
            </Button>
          </div>
        </div>
      )}
      <p className="feedback" role="status">
        {message}
      </p>
    </>
  );
}
