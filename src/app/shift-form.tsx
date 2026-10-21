'use client';

import { useState } from 'react';

type Slot = 'lunch' | 'dinner' | 'either';
type Half = 'first' | 'second';
const options: { value: Slot; label: string; symbol: string }[] = [
  { value: 'lunch', label: '昼', symbol: '☀' },
  { value: 'dinner', label: '夜', symbol: '☾' },
  { value: 'either', label: 'どちらも可', symbol: '◐' },
];

export default function ShiftForm({
  initialMonth,
  initialHalf,
}: {
  initialMonth: string;
  initialHalf: Half;
}) {
  const [month, setMonth] = useState(initialMonth);
  const [half, setHalf] = useState<Half>(initialHalf);
  const [availability, setAvailability] = useState<Record<string, Slot>>({});
  const [submitted, setSubmitted] = useState<Record<string, boolean>>({});
  const [view, setView] = useState<'edit' | 'preview'>('edit');
  const [message, setMessage] = useState('');
  const [year, monthNumber] = month.split('-').map(Number);
  const start = half === 'first' ? 1 : 16;
  const end = half === 'first' ? 15 : new Date(year, monthNumber, 0).getDate();
  const periodKey = `${month}-${half}`;
  const days = Array.from({ length: end - start + 1 }, (_, index) => {
    const day = start + index;
    return {
      day,
      key: `${month}-${String(day).padStart(2, '0')}`,
      weekday: new Date(year, monthNumber - 1, day).getDay(),
    };
  });
  const selectedDays = days.filter(({ key }) => availability[key]);
  const isSubmitted = Boolean(submitted[periodKey]);

  function choose(key: string, slot?: Slot) {
    setAvailability((previous) => {
      const next = { ...previous };
      if (slot) next[key] = slot;
      else delete next[key];
      return next;
    });
    setSubmitted((previous) => ({ ...previous, [periodKey]: false }));
    setMessage('');
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="/" aria-label="ねぎしや ホーム">
          <span className="brand-seal">ね</span>
          <span>
            ねぎしや<small>SHIFT NOTE</small>
          </span>
        </a>
        <p className="side-caption">スタッフのシフトノート</p>
        <nav aria-label="メインメニュー">
          <button
            className={view === 'edit' ? 'nav-item active' : 'nav-item'}
            onClick={() => setView('edit')}
          >
            <span>▦</span> 希望を入力
          </button>
          <button
            className={view === 'preview' ? 'nav-item active' : 'nav-item'}
            onClick={() => setView('preview')}
          >
            <span>☑</span> 提出内容を確認
          </button>
        </nav>
        <div className="side-footer">
          <span className="avatar">試</span>
          <div>
            おためしスタッフ<small>フロントエンド試作版</small>
          </div>
        </div>
      </aside>
      <main>
        <header className="topbar">
          <span>ねぎしや / シフト</span>
          <span className="demo-badge">おためし版</span>
        </header>
        <div className="content">
          <div className="page-heading">
            <div>
              <p className="eyebrow">MY AVAILABILITY</p>
              <h1>
                {view === 'edit'
                  ? '次のシフト、いつ出られる？'
                  : '提出内容を確認'}
              </h1>
              <p className="subtitle">
                出勤できる日に、昼・夜の希望を入れましょう。
              </p>
            </div>
            <span className="heading-flower" aria-hidden="true">
              ✳
            </span>
          </div>
          <div className="demo-note">
            <span aria-hidden="true">ⓘ</span>{' '}
            画面を試すためのデモです。入力はこの画面内のみで保持され、お店には送信されません。
          </div>
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
                    /^(20\d{2}|2100)-(0[1-9]|1[0-2])$/.test(event.target.value)
                  ) {
                    setMonth(event.target.value);
                    setMessage('');
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
                    setHalf(value);
                    setMessage('');
                  }}
                >
                  {value === 'first' ? '前半 1〜15日' : '後半 16〜月末'}
                </button>
              ))}
            </div>
            <span className={isSubmitted ? 'status submitted' : 'status'}>
              {isSubmitted ? '● 提出済み（デモ）' : '○ 未提出'}
            </span>
          </section>
          <div className="section-heading">
            <h2>
              {monthNumber}月{start}日 <span>—</span> {end}日{' '}
              <small>{half === 'first' ? '前半' : '後半'}</small>
            </h2>
            <span>
              {selectedDays.length}
              <small> / {days.length}日 出勤可能</small>
            </span>
          </div>
          {view === 'edit' ? (
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
          ) : (
            <section className="preview-card">
              <h3>
                {isSubmitted ? '提出した希望（デモ）' : '現在入力中の希望'}
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
                            ({ value }) => value === availability[key],
                          )?.label
                        }
                      </strong>
                    </li>
                  ))}
                </ul>
              )}
              <p className="hint">
                ここにない日は出勤不可です。確定した勤務予定ではありません。
              </p>
              <button
                className="secondary-button"
                onClick={() => setView('edit')}
              >
                入力に戻る
              </button>
            </section>
          )}
          <div className="bottom-panel">
            <div>
              <strong>選ばない日は、出勤不可になります。</strong>
              <p>「どちらも可」は昼か夜のどちらでも勤務できる意味です。</p>
            </div>
            <button
              className="submit-button"
              disabled={isSubmitted}
              onClick={() => {
                setSubmitted((previous) => ({
                  ...previous,
                  [periodKey]: true,
                }));
                setMessage(
                  `${monthNumber}月${half === 'first' ? '前半' : '後半'}の希望を提出済みにしました（デモ）。実際には送信されていません。`,
                );
              }}
            >
              {isSubmitted ? '提出済み ✓' : 'この内容で提出（デモ） →'}
            </button>
          </div>
          <p className="feedback" role="status">
            {message}
          </p>
          <footer className="page-footer">
            ねぎしやの、みんなでつくるシフト。
          </footer>
        </div>
      </main>
    </div>
  );
}
