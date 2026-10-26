'use client';

import StaffName from './staff-name';

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import type { Database } from '@/lib/database.types';
import UiIcon from './ui-icon';

type Tables = Database['public']['Tables'];
type Day = { key: string; day: number; weekday: number };

const slots = {
  lunch: { label: '昼', className: 'bg-emerald-50 text-emerald-800' },
  dinner: { label: '夜', className: 'bg-indigo-50 text-indigo-800' },
  either: { label: 'どちらも可', className: 'bg-amber-50 text-amber-800' },
};

export default function StaffAvailabilityTable({
  staff,
  submissions,
  availability,
  days,
}: {
  staff: Tables['staff']['Row'][];
  submissions: Tables['shift_submissions']['Row'][];
  availability: Tables['shift_availability']['Row'][];
  days: Day[];
}) {
  const [view, setView] = useState<'days' | 'table'>('days');
  const submissionByStaff = new Map(
    submissions.map((item) => [item.staff_id, item]),
  );
  const slotByDay = new Map(
    availability.map((item) => [
      `${item.staff_id}:${item.work_date}`,
      item.slot,
    ]),
  );
  const activeStaff = staff.filter((person) => person.active);
  const submittedCount = activeStaff.filter(
    (person) => submissionByStaff.get(person.id)?.submitted_at,
  ).length;
  const pendingCount = activeStaff.length - submittedCount;

  return (
    <div className="staff-availability" data-view={view}>
      <h3>提出状況と希望シフト</h3>
      <ToggleGroup
        type="single"
        variant="outline"
        className="availability-view-switch w-full"
        aria-label="希望一覧の表示方法"
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
      <dl className="shared-summary" aria-label="提出状況の集計">
        <div className="summary-submitted">
          <dt>
            <UiIcon name="check" />
            提出済み
          </dt>
          <dd>
            <strong>{submittedCount}</strong>
            <span> / {activeStaff.length}名</span>
          </dd>
        </div>
        <div className="summary-pending">
          <dt>
            <UiIcon name="clock" />
            未提出
          </dt>
          <dd>
            <strong>{pendingCount}</strong>
            <span>名</span>
          </dd>
        </div>
      </dl>
      <div className="shared-legend" aria-label="希望時間帯の凡例">
        {Object.entries(slots).map(([key, slot]) => (
          <Badge
            key={key}
            variant="secondary"
            className={`shift-chip ${slot.className}`}
          >
            {slot.label}
          </Badge>
        ))}
        <span>— 出勤不可</span>
      </div>
      <div className="mobile-availability">
        <details className="mobile-submission-status">
          <summary>スタッフごとの提出状況を見る</summary>
          <ul>
            {staff.map((person) => (
              <li
                key={person.id}
                data-submitted={Boolean(
                  submissionByStaff.get(person.id)?.submitted_at,
                )}
              >
                <span>
                  <StaffName name={person.display_name} />
                </span>
                <span>
                  {!person.active
                    ? '利用停止'
                    : submissionByStaff.get(person.id)?.submitted_at
                      ? '✓ 提出済み'
                      : submissionByStaff.has(person.id)
                        ? '未提出（下書きあり）'
                        : '未提出'}
                </span>
              </li>
            ))}
          </ul>
        </details>
        <div className="mobile-day-list" aria-label="日付ごとのスタッフの希望">
          {days.map(({ key, day, weekday }) => (
            <section
              className="mobile-day-card"
              key={key}
              aria-label={`${day}日の希望`}
            >
              <h4>
                {day}日（{['日', '月', '火', '水', '木', '金', '土'][weekday]}）
              </h4>
              {Object.entries(slots).map(([slotKey, details]) => {
                const people = staff.filter(
                  (person) => slotByDay.get(`${person.id}:${key}`) === slotKey,
                );
                return (
                  <div className="mobile-slot-row" key={slotKey}>
                    <Badge
                      variant="secondary"
                      className={`shift-chip ${details.className}`}
                    >
                      {details.label}
                    </Badge>
                    <div className="mobile-slot-people">
                      {people.length ? (
                        people.map((person) => (
                          <span className="mobile-person" key={person.id}>
                            <StaffName name={person.display_name} />
                            {!person.active ? (
                              <small>利用停止</small>
                            ) : (
                              !submissionByStaff.get(person.id)
                                ?.submitted_at && <small>下書き</small>
                            )}
                          </span>
                        ))
                      ) : (
                        <span className="hint">希望なし</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </section>
          ))}
        </div>
      </div>
      <p className="hint shared-scroll-hint">
        横にスクロールできます。スタッフ名と提出状況は固定表示されます。
      </p>
      <div
        className="shared-table"
        role="region"
        aria-label="希望シフト表（横スクロール可能）"
        tabIndex={0}
      >
        <table aria-label="スタッフの希望シフトと提出状況">
          <thead>
            <tr>
              <th scope="col">スタッフ</th>
              <th scope="col">提出状況</th>
              {days.map(({ key, day, weekday }) => (
                <th
                  scope="col"
                  key={key}
                  className={
                    weekday === 0
                      ? 'weekend-sunday'
                      : weekday === 6
                        ? 'weekend-saturday'
                        : ''
                  }
                >
                  <span className="shared-date">{day}日</span>
                  <span className="shared-weekday">
                    {['日', '月', '火', '水', '木', '金', '土'][weekday]}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {staff.map((person) => {
              const submission = submissionByStaff.get(person.id);
              const submitted = Boolean(submission?.submitted_at);
              return (
                <tr
                  key={person.id}
                  data-submission-state={
                    !person.active
                      ? 'inactive'
                      : submitted
                        ? 'submitted'
                        : 'pending'
                  }
                >
                  <th scope="row">
                    <span className="staff-name" title={person.display_name}>
                      <StaffName name={person.display_name} />
                    </span>
                  </th>
                  <td>
                    <Badge
                      variant="outline"
                      className={`submission-badge h-7 gap-1 px-2 text-[11px] ${!person.active ? 'border-slate-200 bg-slate-50 text-slate-600' : submitted ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-amber-200 bg-amber-50 text-amber-800'}`}
                    >
                      {person.active && (
                        <UiIcon name={submitted ? 'check' : 'clock'} />
                      )}
                      {!person.active
                        ? '利用停止'
                        : submitted
                          ? '提出済み'
                          : '未提出'}
                    </Badge>
                    {person.active && !submitted && submission && (
                      <span className="draft-note">下書き保存あり</span>
                    )}
                  </td>
                  {days.map(({ key }) => {
                    const slot = slotByDay.get(`${person.id}:${key}`);
                    const details = slots[slot as keyof typeof slots];
                    return (
                      <td key={key}>
                        {details ? (
                          <Badge
                            variant="secondary"
                            className={`shift-chip ${details.className}`}
                          >
                            {details.label}
                          </Badge>
                        ) : (
                          <span className="unavailable-slot">—</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="hint">
        未提出の下書きも表示します。希望がない日には、まだ入力していない場合もあります。最新の内容は再読み込みして確認してください。
      </p>
    </div>
  );
}
