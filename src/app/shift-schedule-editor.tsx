'use client';

import { useEffect, useRef, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/database.types';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
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

type Tables = Database['public']['Tables'];
type Entry = { staff_id: string; work_date: string; slot: string };
type Day = { key: string; day: number; weekday: number };
type TimeSlot = 'lunch' | 'dinner';
const labels: Record<string, string> = {
  lunch: '昼',
  dinner: '夜',
  both: '昼夜',
};
const hopeLabels: Record<string, string> = {
  lunch: '昼',
  dinner: '夜',
  either: 'どちらも可',
};

export default function ShiftScheduleEditor({
  client,
  period,
  staff,
  days,
  onDirty,
  onSaving,
}: {
  client: SupabaseClient<Database>;
  period: Tables['shift_periods']['Row'];
  staff: Tables['staff']['Row'][];
  days: Day[];
  onDirty: (value: boolean) => void;
  onSaving: (value: boolean) => void;
}) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [publishedEntries, setPublishedEntries] = useState<Entry[]>([]);
  const [draftVersion, setDraftVersion] = useState(0);
  const [publishedVersion, setPublishedVersion] = useState(0);
  const [availability, setAvailability] = useState<
    Tables['shift_availability']['Row'][]
  >([]);
  const [submissions, setSubmissions] = useState<
    Tables['shift_submissions']['Row'][]
  >([]);
  const [draftInfo, setDraftInfo] = useState<{
    updated_by: string;
    updated_at: string;
  } | null>(null);
  const [dayIndex, setDayIndex] = useState(0);
  const dateListRef = useRef<HTMLDivElement>(null);
  const selectedDateRef = useRef<HTMLButtonElement>(null);
  const [desktopView, setDesktopView] = useState<'day' | 'table'>('table');
  const [dirty, setDirty] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [revision, setRevision] = useState(0);
  const [pendingEntry, setPendingEntry] = useState<
    (Entry & { reason: string }) | null
  >(null);
  const [confirmPublish, setConfirmPublish] = useState(false);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const [draft, published, hopes, submitted] = await Promise.all([
          client
            .from('shift_schedule_drafts')
            .select('*')
            .eq('period_id', period.id)
            .maybeSingle(),
          client
            .from('published_shifts')
            .select('*')
            .eq('period_id', period.id)
            .maybeSingle(),
          client
            .from('shift_availability')
            .select('*')
            .eq('period_id', period.id),
          client
            .from('shift_submissions')
            .select('*')
            .eq('period_id', period.id),
        ]);
        if (draft.error || published.error || hopes.error || submitted.error)
          throw new Error('load failed');
        if (!active) return;
        const publishedRows = (published.data?.entries ?? []) as Entry[];
        setEntries((draft.data?.entries ?? publishedRows) as Entry[]);
        setPublishedEntries(publishedRows);
        setDraftVersion(draft.data?.version ?? 0);
        setPublishedVersion(published.data?.version ?? 0);
        setAvailability(hopes.data);
        setSubmissions(submitted.data);
        setDraftInfo(
          draft.data
            ? {
                updated_by: draft.data.updated_by,
                updated_at: draft.data.updated_at,
              }
            : null,
        );
        setLoaded(true);
        setConflict(false);
        setError('');
      } catch {
        if (active) {
          setLoaded(false);
          setError(
            '作成中のシフトと希望を取得できません。「最新の内容を取得」で再度お試しください。',
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [client, period.id, revision]);

  useEffect(() => {
    const list = dateListRef.current;
    const selected = selectedDateRef.current;
    if (!list || !selected) return;

    const listBounds = list.getBoundingClientRect();
    const selectedBounds = selected.getBoundingClientRect();
    const left = selectedBounds.left - listBounds.left;
    const right = selectedBounds.right - listBounds.right;
    const offset = left < 0 ? left : right > 0 ? right : 0;
    if (offset === 0) return;

    list.scrollBy({
      left: offset,
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
        ? 'auto'
        : 'smooth',
    });
  }, [dayIndex, loaded, loading]);

  const hopeByDay = new Map(
    availability.map((row) => [row.staff_id + ':' + row.work_date, row.slot]),
  );
  const submittedByStaff = new Map(
    submissions.map((row) => [row.staff_id, Boolean(row.submitted_at)]),
  );
  const byDay = new Map(
    entries.map((entry) => [
      entry.staff_id + ':' + entry.work_date,
      entry.slot,
    ]),
  );
  const publishedByDay = new Map(
    publishedEntries.map((entry) => [
      entry.staff_id + ':' + entry.work_date,
      entry.slot,
    ]),
  );
  const activeStaff = staff.filter((person) => person.active);
  const day = days[dayIndex];
  function isEligible(
    person: Tables['staff']['Row'],
    date: string,
    slot: TimeSlot,
  ) {
    const hope = hopeByDay.get(person.id + ':' + date);
    return (
      person.active &&
      submittedByStaff.get(person.id) &&
      (hope === slot || hope === 'either')
    );
  }
  const countsByDay = new Map(
    days.map((item) => [item.key, { lunch: 0, dinner: 0 }]),
  );
  for (const entry of entries) {
    const count = countsByDay.get(entry.work_date);
    if (!count) continue;
    if (entry.slot === 'lunch' || entry.slot === 'both') count.lunch++;
    if (entry.slot === 'dinner' || entry.slot === 'both') count.dinner++;
  }
  const tablePeople = staff.filter(
    (person) =>
      entries.some((entry) => entry.staff_id === person.id) ||
      (person.active &&
        submittedByStaff.get(person.id) &&
        availability.some((row) => row.staff_id === person.id)),
  );
  const differsFromPublished =
    entries.length !== publishedEntries.length ||
    entries.some(
      (entry) =>
        publishedByDay.get(entry.staff_id + ':' + entry.work_date) !==
        entry.slot,
    );

  function warning(entry: Entry) {
    if (!staff.some((person) => person.id === entry.staff_id && person.active))
      return '利用停止のスタッフです。割り当てを解除してください。';
    if (!submittedByStaff.get(entry.staff_id))
      return '希望が未提出です。本人に確認してから割り当ててください。';
    const hope = hopeByDay.get(entry.staff_id + ':' + entry.work_date);
    if (!hope)
      return '出勤不可として提出されています。本人に確認してください。';
    if (hope === 'either')
      return entry.slot === 'both'
        ? '「どちらも可」は昼夜の両方に勤務する意味ではありません。本人に確認してください。'
        : '';
    return hope === entry.slot
      ? ''
      : '提出した希望と異なる時間帯です。本人に確認してください。';
  }
  const warnings = entries
    .map((entry) => ({ ...entry, reason: warning(entry) }))
    .filter((entry) => entry.reason);
  const inactiveAssigned = entries.some(
    (entry) => !activeStaff.some((person) => person.id === entry.staff_id),
  );
  function applyEntry(entry: Entry) {
    setEntries((previous) => {
      const next = previous.filter(
        (row) =>
          row.staff_id !== entry.staff_id || row.work_date !== entry.work_date,
      );
      if (entry.slot)
        next.push({
          staff_id: entry.staff_id,
          work_date: entry.work_date,
          slot: entry.slot,
        });
      return next;
    });
    setDirty(true);
    onDirty(true);
    setMessage('');
  }
  function choose(entry: Entry) {
    const reason = entry.slot ? warning(entry) : '';
    if (reason) setPendingEntry({ ...entry, reason });
    else applyEntry(entry);
  }
  function toggleAssignment(staffId: string, date: string, timeSlot: TimeSlot) {
    const otherSlot = timeSlot === 'lunch' ? 'dinner' : 'lunch';
    const current = byDay.get(staffId + ':' + date) ?? '';
    const assigned = current === timeSlot || current === 'both';
    const entry = {
      staff_id: staffId,
      work_date: date,
      slot: assigned
        ? current === 'both'
          ? otherSlot
          : ''
        : current === otherSlot
          ? 'both'
          : timeSlot,
    };
    if (assigned) applyEntry(entry);
    else choose(entry);
  }
  async function save(publish: boolean) {
    if (!loaded || loading || saving || conflict || inactiveAssigned) return;
    setSaving(true);
    onSaving(true);
    setError('');
    setMessage('');
    try {
      const { data, error: saveError } = await client.rpc(
        'save_shift_schedule',
        {
          p_period_id: period.id,
          p_entries: entries,
          p_draft_version: draftVersion,
          p_published_version: publishedVersion,
          p_publish: publish,
          p_requirements: {},
        },
      );
      if (saveError) {
        if (saveError.code === '40001' || saveError.code === '23505') {
          setConflict(true);
          setError(
            '別の担当者が更新しています。入力内容を確認し、「最新の内容を取得」で読み直してから編集してください。',
          );
          return;
        }
        throw saveError;
      }
      const result = data as {
        draft_version: number;
        published_version: number;
        updated_by: string;
        updated_at: string;
      };
      setDraftVersion(result.draft_version);
      setPublishedVersion(result.published_version);
      setDraftInfo({
        updated_by: result.updated_by,
        updated_at: result.updated_at,
      });
      if (publish) setPublishedEntries([...entries]);
      setDirty(false);
      onDirty(false);
      setMessage(
        publish
          ? '全期間のシフトを公開しました。全スタッフが確認できます。'
          : '全期間の下書きを保存しました。るみ・ひろくんだけが確認できます。',
      );
    } catch {
      setError(
        '保存できませんでした。通信状態と作成権限を確認してください。入力内容は保持しています。',
      );
    } finally {
      setSaving(false);
      onSaving(false);
    }
  }

  function renderSlot(slot: TimeSlot) {
    const people = activeStaff.filter((person) =>
      isEligible(person, day.key, slot),
    );
    const ids = new Set(people.map((person) => person.id));
    const outside = staff.filter((person) => {
      const assigned = byDay.get(person.id + ':' + day.key);
      return !ids.has(person.id) && (assigned === slot || assigned === 'both');
    });
    const count = countsByDay.get(day.key)?.[slot] ?? 0;
    return (
      <section
        key={slot}
        className="min-w-0 overflow-hidden rounded-2xl border border-border bg-white"
        aria-label={day.day + '日の' + labels[slot] + 'のシフト'}
      >
        <div
          className={
            'space-y-3 border-b p-4 ' +
            (slot === 'lunch' ? 'bg-emerald-50' : 'bg-indigo-50')
          }
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="m-0 text-base font-semibold">
              {labels[slot]}のシフト
            </h4>
            <span className="text-sm">
              <strong className="text-xl">{count}</strong> 名
            </span>
          </div>
        </div>
        <div className="p-4">
          <p className="mb-3 text-xs text-muted-foreground">
            名前をタップして選択・解除
          </p>
          {people.length ? (
            <div className="flex flex-wrap gap-2">
              {people.map((person) => {
                const current = byDay.get(person.id + ':' + day.key);
                const assigned = current === slot || current === 'both';
                return (
                  <Button
                    key={person.id}
                    variant={assigned ? 'default' : 'outline'}
                    className="min-h-11 h-auto max-w-full whitespace-normal break-words px-4 py-2 text-sm"
                    aria-pressed={assigned}
                    aria-label={
                      person.display_name +
                      'を' +
                      labels[slot] +
                      (assigned ? 'から外す' : 'に追加')
                    }
                    disabled={saving || conflict}
                    onClick={() => toggleAssignment(person.id, day.key, slot)}
                  >
                    {assigned && <span aria-hidden="true">✓</span>}
                    {person.display_name}
                  </Button>
                );
              })}
            </div>
          ) : (
            <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
              勤務可能な希望を提出したスタッフはいません。
            </p>
          )}
          {outside.length > 0 && (
            <details className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3">
              <summary className="cursor-pointer text-xs font-medium text-amber-900">
                割り当て済みの要確認スタッフ（{outside.length}名）
              </summary>
              <div className="mt-3 grid gap-3">
                {outside.map((person) => {
                  const current = byDay.get(person.id + ':' + day.key)!;
                  return (
                    <div key={person.id} className="space-y-2">
                      <p className="text-xs leading-relaxed text-amber-900">
                        {person.display_name}：
                        {warning({
                          staff_id: person.id,
                          work_date: day.key,
                          slot: current,
                        })}
                      </p>
                      <Button
                        variant="outline"
                        className="min-h-11"
                        disabled={saving || conflict}
                        onClick={() =>
                          toggleAssignment(person.id, day.key, slot)
                        }
                      >
                        {person.display_name}を外す
                      </Button>
                    </div>
                  );
                })}
              </div>
            </details>
          )}
        </div>
      </section>
    );
  }

  return (
    <Card className="preview-card min-w-0 gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3>シフトを作成</h3>
        <Button
          variant="outline"
          disabled={loading || saving}
          onClick={() => {
            if (
              dirty &&
              !window.confirm(
                '未保存の変更を破棄して、最新の内容を取得しますか？',
              )
            )
              return;
            setDirty(false);
            onDirty(false);
            setLoading(true);
            setMessage('');
            setRevision((value) => value + 1);
          }}
        >
          最新の内容を取得
        </Button>
      </div>
      {error && (
        <p role="alert" className="error-message">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="text-sm text-emerald-800">
          {message}
        </p>
      )}
      {loading ? (
        <p role="status">下書きと希望を読み込み中…</p>
      ) : (
        loaded && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Badge variant="outline">
                {dirty
                  ? '未保存の変更あり'
                  : differsFromPublished
                    ? '未公開の下書き'
                    : publishedVersion
                      ? '公開内容と同じ'
                      : '未公開'}
              </Badge>
            </div>
            <div
              ref={dateListRef}
              className="flex gap-2 overflow-x-auto pb-2"
              role="region"
              aria-label="日付ごとの配置状況"
              tabIndex={0}
            >
              {days.map((item, index) => (
                <button
                  key={item.key}
                  type="button"
                  ref={dayIndex === index ? selectedDateRef : null}
                  aria-pressed={dayIndex === index}
                  disabled={saving}
                  onClick={() => {
                    setDayIndex(index);
                    setDesktopView('day');
                  }}
                  className={
                    'min-h-24 w-36 shrink-0 rounded-xl border p-3 text-left ' +
                    (dayIndex === index
                      ? 'border-emerald-600 bg-emerald-50'
                      : 'border-border bg-white')
                  }
                >
                  <span className="mb-2 block text-sm font-semibold">
                    {Number(item.key.slice(5, 7))}月{item.day}日（
                    {'日月火水木金土'[item.weekday]}）
                  </span>
                  {(['lunch', 'dinner'] as const).map((slot) => (
                    <span
                      key={slot}
                      className="block text-xs leading-relaxed text-muted-foreground"
                    >
                      {labels[slot]} {countsByDay.get(item.key)?.[slot] ?? 0}名
                    </span>
                  ))}
                </button>
              ))}
            </div>
            <ToggleGroup
              type="single"
              variant="outline"
              className="hidden w-full lg:flex"
              value={desktopView}
              aria-label="シフト作成画面の表示方法"
              onValueChange={(value) => {
                if (value === 'day' || value === 'table') setDesktopView(value);
              }}
            >
              <ToggleGroupItem value="table" className="min-h-11 flex-1">
                期間全体の表
              </ToggleGroupItem>
              <ToggleGroupItem value="day" className="min-h-11 flex-1">
                日ごとに作成
              </ToggleGroupItem>
            </ToggleGroup>
            <div
              className={
                desktopView === 'day' ? 'grid gap-4' : 'grid gap-4 lg:hidden'
              }
            >
              <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2">
                <Button
                  variant="outline"
                  className="min-h-11 px-3"
                  disabled={dayIndex === 0 || saving}
                  onClick={() => setDayIndex((index) => index - 1)}
                >
                  前日
                </Button>
                <select
                  aria-label="作成する日付"
                  className="h-11 w-full min-w-0 rounded-md border border-input bg-white px-2 text-base"
                  value={dayIndex}
                  disabled={saving}
                  onChange={(event) => setDayIndex(Number(event.target.value))}
                >
                  {days.map((item, index) => (
                    <option key={item.key} value={index}>
                      {Number(item.key.slice(5, 7))}月{item.day}日（
                      {'日月火水木金土'[item.weekday]}）
                    </option>
                  ))}
                </select>
                <Button
                  variant="outline"
                  className="min-h-11 px-3"
                  disabled={dayIndex === days.length - 1 || saving}
                  onClick={() => setDayIndex((index) => index + 1)}
                >
                  翌日
                </Button>
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                {renderSlot('lunch')}
                {renderSlot('dinner')}
              </div>
            </div>
            <div
              className={
                desktopView === 'table' ? 'hidden min-w-0 lg:block' : 'hidden'
              }
            >
              <p className="hint">
                希望に合う昼・夜をクリックして割り当てます。勤務日数は昼夜両方でも同じ日は1日と数えます。
              </p>
              <div
                className="max-h-[65vh] min-w-0 overflow-auto rounded-xl border"
                role="region"
                aria-label="期間全体の希望とシフト編集表"
                tabIndex={0}
              >
                <table className="w-full border-separate border-spacing-0 text-xs">
                  <thead className="sticky top-0 z-20 bg-white">
                    <tr>
                      <th
                        scope="col"
                        className="sticky left-0 z-30 min-w-28 border-b border-r bg-white p-3 text-left"
                      >
                        スタッフ
                      </th>
                      {days.map((item, index) => (
                        <th
                          scope="col"
                          key={item.key}
                          className="min-w-24 border-b border-r bg-white p-2"
                        >
                          <button
                            type="button"
                            className="min-h-11 w-full rounded hover:bg-emerald-50"
                            disabled={saving}
                            onClick={() => {
                              setDayIndex(index);
                              setDesktopView('day');
                            }}
                          >
                            {item.day}日（{'日月火水木金土'[item.weekday]}）
                          </button>
                        </th>
                      ))}
                      <th
                        scope="col"
                        className="min-w-20 border-b bg-white p-2"
                      >
                        勤務日数
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {tablePeople.map((person) => (
                      <tr key={person.id}>
                        <th
                          scope="row"
                          className="sticky left-0 z-10 border-b border-r bg-white p-3 text-left"
                        >
                          {person.display_name}
                          {!person.active && (
                            <span className="block text-amber-800">
                              利用停止
                            </span>
                          )}
                        </th>
                        {days.map((item) => {
                          const current =
                            byDay.get(person.id + ':' + item.key) ?? '';
                          const hope = hopeByDay.get(
                            person.id + ':' + item.key,
                          );
                          return (
                            <td
                              key={item.key}
                              className="border-b border-r p-2 text-center"
                            >
                              <span className="mb-1 block text-[10px] text-muted-foreground">
                                {submittedByStaff.get(person.id)
                                  ? (hopeLabels[hope ?? ''] ?? '—')
                                  : '—'}
                              </span>
                              <div className="flex gap-1">
                                {(['lunch', 'dinner'] as const).map((slot) => {
                                  const assigned =
                                    current === slot || current === 'both';
                                  return (
                                    <button
                                      key={slot}
                                      type="button"
                                      aria-pressed={assigned}
                                      aria-label={
                                        person.display_name +
                                        ' ' +
                                        item.day +
                                        '日の' +
                                        labels[slot] +
                                        (assigned ? 'を解除' : 'に追加')
                                      }
                                      disabled={
                                        saving ||
                                        conflict ||
                                        (!assigned &&
                                          !isEligible(person, item.key, slot))
                                      }
                                      className={
                                        'min-h-11 flex-1 rounded-md border px-2 disabled:cursor-default disabled:opacity-30 ' +
                                        (assigned
                                          ? slot === 'lunch'
                                            ? 'border-emerald-600 bg-emerald-100 text-emerald-900'
                                            : 'border-indigo-600 bg-indigo-100 text-indigo-900'
                                          : 'border-border bg-white')
                                      }
                                      onClick={() =>
                                        toggleAssignment(
                                          person.id,
                                          item.key,
                                          slot,
                                        )
                                      }
                                    >
                                      {assigned ? '✓ ' : ''}
                                      {labels[slot]}
                                    </button>
                                  );
                                })}
                              </div>
                            </td>
                          );
                        })}
                        <td className="border-b p-2 text-center font-semibold">
                          {
                            entries.filter(
                              (entry) => entry.staff_id === person.id,
                            ).length
                          }
                          日
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    {(['lunch', 'dinner'] as const).map((slot) => (
                      <tr key={slot}>
                        <th
                          scope="row"
                          className="sticky left-0 z-10 border-r bg-slate-50 p-3 text-left"
                        >
                          {labels[slot]}の人数
                        </th>
                        {days.map((item) => (
                          <td
                            key={item.key}
                            className="border-r bg-slate-50 p-2 text-center"
                          >
                            {countsByDay.get(item.key)?.[slot] ?? 0}名
                          </td>
                        ))}
                        <td className="bg-slate-50" />
                      </tr>
                    ))}
                  </tfoot>
                </table>
              </div>
              <p className="hint">
                日付をクリックすると、その日の候補を選択できます。
              </p>
            </div>
            {inactiveAssigned && (
              <p role="alert" className="error-message">
                利用停止のスタッフへの割り当てがあります。該当日の「要確認スタッフ」または期間全体の表で解除してください。
              </p>
            )}
            <div className="sticky bottom-3 z-30 grid grid-cols-2 gap-2 rounded-xl border bg-white p-3 shadow-sm">
              <Button
                variant="outline"
                className="min-h-11 px-2"
                disabled={
                  saving ||
                  conflict ||
                  inactiveAssigned ||
                  (!dirty && draftVersion > 0)
                }
                onClick={() => void save(false)}
              >
                {saving ? '保存中…' : '下書き保存'}
              </Button>
              <Button
                className="min-h-11 px-2"
                disabled={
                  saving ||
                  conflict ||
                  inactiveAssigned ||
                  (!dirty && !differsFromPublished && publishedVersion > 0)
                }
                onClick={() => setConfirmPublish(true)}
              >
                全員に公開
              </Button>
            </div>
            <p className="hint m-0">
              下書きは二人だけで共有し、公開するまでスタッフの画面は変わりません。保存・公開は期間全体に適用されます。
            </p>
            {draftInfo && (
              <p className="hint m-0">
                最終保存：
                {new Date(draftInfo.updated_at).toLocaleString('ja-JP', {
                  timeZone: 'Asia/Tokyo',
                })}
                （
                {staff.find((person) => person.id === draftInfo.updated_by)
                  ?.display_name ?? '担当者'}
                ）
              </p>
            )}
          </>
        )
      )}
      <AlertDialog
        open={pendingEntry !== null}
        onOpenChange={(open) => {
          if (!open) setPendingEntry(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>希望を確認してください</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingEntry?.reason} 確認済みの場合は割り当てを続けられます。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>戻る</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingEntry) applyEntry(pendingEntry);
                setPendingEntry(null);
              }}
            >
              確認して割り当てる
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={confirmPublish} onOpenChange={setConfirmPublish}>
        <AlertDialogContent className="max-h-[85dvh] overflow-y-auto">
          <AlertDialogHeader>
            <AlertDialogTitle>全期間のシフトを公開しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              {period.starts_on}〜{period.ends_on}{' '}
              のシフトを全スタッフに公開します。前回公開した内容は今回の内容に置き換わります。
            </AlertDialogDescription>
          </AlertDialogHeader>
          {warnings.length > 0 && (
            <div className="max-h-56 overflow-y-auto rounded-lg border border-amber-200 bg-amber-50 p-3">
              <p className="text-sm font-medium text-amber-900">
                希望・提出状況の確認が必要な割り当て：{warnings.length}件
              </p>
              <div className="space-y-2">
                {warnings.map((entry) => (
                  <p
                    key={entry.staff_id + ':' + entry.work_date}
                    className="text-xs leading-relaxed text-amber-900"
                  >
                    {entry.work_date}{' '}
                    {
                      staff.find((person) => person.id === entry.staff_id)
                        ?.display_name
                    }
                    （{labels[entry.slot]}）：{entry.reason}
                  </p>
                ))}
              </div>
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>戻る</AlertDialogCancel>
            <AlertDialogAction onClick={() => void save(true)}>
              確認して公開する
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
