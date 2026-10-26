import { execFileSync } from 'node:child_process';
import console from 'node:console';
import { resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath, URL } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const root = fileURLToPath(new URL('../', import.meta.url));
const profiles = [
  { slug: 'seiya', name: 'せいや' },
  { slug: 'yoshida', name: '吉田' },
  { slug: 'kaiyaki', name: 'かいやき' },
  { slug: 'zion', name: 'ザイオン' },
  { slug: 'toa', name: 'とあ' },
  { slug: 'yuna', name: 'ゆな' },
  { slug: 'yui', name: 'ゆい', unsubmitted: true },
  { slug: 'ochiai', name: '落合', unsubmitted: true },
  { slug: 'rumi', name: 'るみ', canManageShifts: true, unsubmitted: true },
  {
    slug: 'hirokun',
    name: 'ひろくん',
    canManageShifts: true,
    unsubmitted: true,
  },
];

const authOptions = {
  auth: { persistSession: false, autoRefreshToken: false },
};
async function checked(request, operation) {
  const { data, error } = await request;
  if (error) {
    throw new Error(
      `${operation}に失敗しました（${error.code ?? error.status ?? 'API error'}）。既存データは削除していません。`,
    );
  }
  return data;
}

function localStatus() {
  let status;
  try {
    const command =
      process.platform === 'win32'
        ? process.env.ComSpec || 'cmd.exe'
        : resolve(root, 'node_modules/.bin/supabase');
    const args =
      process.platform === 'win32'
        ? ['/d', '/s', '/c', 'node_modules\\.bin\\supabase.cmd status -o json']
        : ['status', '-o', 'json'];
    status = JSON.parse(
      execFileSync(command, args, {
        cwd: root,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      }),
    );
  } catch {
    throw new Error(
      '先に npm run db:start:app でローカル環境を起動してください。',
    );
  }
  if (
    status.API_URL !== 'http://127.0.0.1:55321' ||
    !status.SERVICE_ROLE_KEY ||
    !status.PUBLISHABLE_KEY
  ) {
    throw new Error('negisi のローカル API 以外にはシードを投入できません。');
  }
  return status;
}

function samplePeriods() {
  const today = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Tokyo',
  }).format(new Date());
  const [year, month, day] = today.split('-').map(Number);
  let start = new Date(
    Date.UTC(year, month - 1 + (day > 15 ? 1 : 0), day > 15 ? 1 : 16),
  );
  return Array.from({ length: 2 }, () => {
    const first = start.getUTCDate() === 1;
    const end = new Date(
      Date.UTC(
        start.getUTCFullYear(),
        start.getUTCMonth() + (first ? 0 : 1),
        first ? 15 : 0,
      ),
    );
    const previous = new Date(start.getTime() - 86400000);
    const period = {
      starts_on: start.toISOString().slice(0, 10),
      ends_on: end.toISOString().slice(0, 10),
      deadline: `${previous.toISOString().slice(0, 10)}T23:59:00+09:00`,
    };
    start = new Date(
      Date.UTC(
        start.getUTCFullYear(),
        start.getUTCMonth() + (first ? 0 : 1),
        first ? 16 : 1,
      ),
    );
    return period;
  });
}

function choices(period, index) {
  const start = new Date(`${period.starts_on}T00:00:00Z`);
  const end = new Date(`${period.ends_on}T00:00:00Z`);
  const slots = ['lunch', 'dinner', 'either'];
  const entries = [];
  for (let day = 0; start.getTime() + day * 86400000 <= end.getTime(); day++) {
    if ((day + index * 2) % 5 < 3) {
      entries.push({
        work_date: new Date(start.getTime() + day * 86400000)
          .toISOString()
          .slice(0, 10),
        slot: slots[(day + index) % slots.length],
      });
    }
  }
  return entries;
}

async function main() {
  const status = localStatus();
  const admin = createClient(
    status.API_URL,
    status.SERVICE_ROLE_KEY,
    authOptions,
  );
  const people = [];
  for (const profile of profiles) {
    let person = await checked(
      admin
        .from('staff')
        .select('*')
        .eq('display_name', profile.name)
        .maybeSingle(),
      'スタッフの確認',
    );
    if (!person) {
      person = await checked(
        admin
          .from('staff')
          .insert({
            display_name: profile.name,
            active: true,
            can_manage_shifts: profile.canManageShifts ?? false,
          })
          .select()
          .single(),
        'スタッフの登録',
      );
    } else if (profile.canManageShifts && !person.can_manage_shifts) {
      await checked(
        admin
          .from('staff')
          .update({ can_manage_shifts: true })
          .eq('id', person.id),
        'シフト作成権限の設定',
      );
    }
    people.push({ ...profile, id: person.id, active: person.active });
  }
  const periods = [];
  for (const sample of samplePeriods()) {
    const existing = await checked(
      admin
        .from('shift_periods')
        .select('*')
        .eq('starts_on', sample.starts_on)
        .eq('ends_on', sample.ends_on)
        .maybeSingle(),
      '対象期間の確認',
    );
    periods.push(
      existing ??
        (await checked(
          admin.from('shift_periods').insert(sample).select().single(),
          '対象期間の作成',
        )),
    );
  }
  const client = createClient(
    status.API_URL,
    status.PUBLISHABLE_KEY,
    authOptions,
  );
  await checked(client.auth.signInAnonymously(), '名前選択用の接続');
  const identity = await checked(
    client.auth.getSession(),
    '端末セッションの確認',
  );
  const userId = identity.session?.user.id;
  if (!userId) throw new Error('名前選択用の接続を開始できません。');
  let created = 0;
  let skipped = 0;
  try {
    for (const [index, person] of people.entries()) {
      if (!person.active || person.unsubmitted) continue;
      await checked(
        client
          .from('staff_sessions')
          .upsert({ user_id: userId, staff_id: person.id }),
        'スタッフの選択',
      );
      for (const [periodIndex, period] of periods.entries()) {
        const existing = await checked(
          client
            .from('shift_submissions')
            .select('staff_id')
            .eq('period_id', period.id)
            .eq('staff_id', person.id)
            .maybeSingle(),
          '希望の確認',
        );
        if (
          existing ||
          !period.accepting ||
          Date.now() >= new Date(period.deadline).getTime()
        ) {
          skipped++;
          continue;
        }
        await checked(
          client.rpc('save_shift_availability', {
            p_period_id: period.id,
            p_entries: choices(period, index + periodIndex),
            p_submit: index < 5 - periodIndex,
          }),
          '希望シフトの作成',
        );
        created++;
      }
    }
  } finally {
    await checked(
      client.auth.signOut({ scope: 'local' }),
      'シード用接続の終了',
    );
  }
  console.log(
    'ローカル用スタッフ ' +
      people.length +
      '名を用意しました。アプリで自分の名前を選んでください。',
  );
  console.log(
    '希望の新規作成 ' +
      created +
      '件、既存・受付終了のため維持 ' +
      skipped +
      '件。',
  );
  console.log('メールアドレス・パスワード・招待メールは使用しません。');
}

main().catch((error) => {
  console.error(
    error instanceof Error
      ? error.message
      : 'ローカルデータを作成できませんでした。',
  );
  process.exitCode = 1;
});
