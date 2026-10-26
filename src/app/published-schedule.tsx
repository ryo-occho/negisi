'use client';

import StaffName from './staff-name';

import { useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/database.types';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

type Tables = Database['public']['Tables'];
type Entry = { staff_id: string; work_date: string; slot: string };
const labels: Record<string, string> = {
  lunch: '昼',
  dinner: '夜',
  both: '昼夜',
};

export default function PublishedSchedule({
  client,
  period,
  staff,
  days,
}: {
  client: SupabaseClient<Database>;
  period: Tables['shift_periods']['Row'];
  staff: Tables['staff']['Row'][];
  days: { key: string; day: number; weekday: number }[];
}) {
  const [schedule, setSchedule] = useState<
    Tables['published_shifts']['Row'] | null
  >(null);
  const [view, setView] = useState<'days' | 'table'>('days');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const { data, error: loadError } = await client
          .from('published_shifts')
          .select('*')
          .eq('period_id', period.id)
          .maybeSingle();
        if (loadError) throw loadError;
        if (active) {
          setSchedule(data);
          setError('');
        }
      } catch {
        if (active)
          setError('確定シフトを取得できません。再読み込みしてください。');
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    const timer = window.setInterval(() => void load(), 30000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [client, period.id, revision]);
  const entries = (schedule?.entries ?? []) as Entry[];
  const byDay = new Map(
    entries.map((entry) => [
      entry.staff_id + ':' + entry.work_date,
      entry.slot,
    ]),
  );
  const people = staff.filter(
    (person) =>
      person.active || entries.some((entry) => entry.staff_id === person.id),
  );
  return (
    <Card className="preview-card min-w-0 gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3>確定シフト</h3>
        <Button
          variant="outline"
          disabled={loading}
          onClick={() => {
            setLoading(true);
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
      {loading ? (
        <p role="status">確定シフトを読み込み中…</p>
      ) : schedule ? (
        <>
          <p className="hint">
            公開済みのシフトです。表示中は30秒ごとに最新の内容を取得します。訂正は担当者の「シフト作成」から行います。
          </p>
          <p className="hint">
            最終更新：
            {new Date(schedule.updated_at).toLocaleString('ja-JP', {
              timeZone: 'Asia/Tokyo',
            })}
            （
            {staff.find((person) => person.id === schedule.updated_by)
              ?.display_name ?? '担当者'}
            ）
          </p>
          <ToggleGroup
            type="single"
            variant="outline"
            className="availability-view-switch w-full"
            aria-label="確定シフトの表示方法"
            value={view}
            onValueChange={(value) => {
              if (value === 'days' || value === 'table') setView(value);
            }}
          >
            <ToggleGroupItem
              value="days"
              className="min-h-11 min-w-0 flex-1 px-2 text-xs"
            >
              日付ごと
            </ToggleGroupItem>
            <ToggleGroupItem
              value="table"
              className="min-h-11 min-w-0 flex-1 px-2 text-xs"
            >
              スタッフ別の表
            </ToggleGroupItem>
          </ToggleGroup>
          {view === 'days' ? (
            <div className="mobile-day-list" aria-label="日付ごとの確定シフト">
              {days.map(({ key, day, weekday }) => (
                <section
                  className="mobile-day-card"
                  key={key}
                  aria-label={day + '日の確定シフト'}
                >
                  <h4>
                    {day}日（{'日月火水木金土'[weekday]}）
                  </h4>
                  {(['lunch', 'dinner'] as const).map((slot) => {
                    const assigned = people.filter((person) => {
                      const shift = byDay.get(person.id + ':' + key);
                      return shift === slot || shift === 'both';
                    });
                    return (
                      <div className="mobile-slot-row" key={slot}>
                        <Badge
                          variant="secondary"
                          className={
                            'shift-chip ' +
                            (slot === 'lunch'
                              ? 'bg-emerald-50 text-emerald-800'
                              : 'bg-indigo-50 text-indigo-800')
                          }
                        >
                          {labels[slot]} {assigned.length}名
                        </Badge>
                        <div className="mobile-slot-people">
                          {assigned.length ? (
                            assigned.map((person) => (
                              <span className="mobile-person" key={person.id}>
                                <StaffName name={person.display_name} />
                                {!person.active && <small>利用停止</small>}
                              </span>
                            ))
                          ) : (
                            <span className="hint">割り当てなし</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </section>
              ))}
            </div>
          ) : (
            <div
              className="min-w-0 max-w-full overflow-x-auto rounded-lg border border-border"
              role="region"
              aria-label="確定シフト表（横スクロール可能）"
              tabIndex={0}
            >
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr>
                    <th scope="col" className="min-w-24 border p-2">
                      スタッフ
                    </th>
                    {days.map((day) => (
                      <th
                        scope="col"
                        key={day.key}
                        className="min-w-20 border p-2"
                      >
                        {day.day}日<br />
                        {'日月火水木金土'[day.weekday]}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {people.map((person) => (
                    <tr key={person.id}>
                      <th scope="row" className="border p-2">
                        <StaffName name={person.display_name} />
                        {!person.active && '（利用停止）'}
                      </th>
                      {days.map((day) => (
                        <td key={day.key} className="border p-2 text-center">
                          {labels[byDay.get(person.id + ':' + day.key) ?? ''] ??
                            '—'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : (
        <p role="status">この期間の確定シフトはまだ公開されていません。</p>
      )}
    </Card>
  );
}
