import { Fragment, FormEvent, useEffect, useMemo, useState } from 'react';
import { Activity, BarChart3, CheckCircle2, Clock3, LogOut, RefreshCw, ShieldCheck, Users } from 'lucide-react';
import { signIn, signOut, toAuthErrorMessage } from '../../../auth';
import { useAuthSession } from '../../../auth';
import {
  fetchAdminAnalytics,
  type AdminAnalyticsPayload,
  type AdminDailyActivity,
} from '../admin-analytics-data';

export const HABITHERO_ADMIN_EMAIL = 'f1272837411@gmail.com';

export function isHabitHeroAdminEmail(email: string | null | undefined) {
  return email?.trim().toLowerCase() === HABITHERO_ADMIN_EMAIL;
}

function formatDuration(seconds: number) {
  if (seconds < 60) return `${Math.round(seconds)} 秒`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round(seconds % 60);
  return remainingSeconds > 0 ? `${minutes} 分 ${remainingSeconds} 秒` : `${minutes} 分`;
}

function formatDate(value: string | null) {
  if (!value) return '尚無資料';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('zh-TW', { month: 'numeric', day: 'numeric' }).format(date);
}

function sumBy(rows: AdminDailyActivity[], key: keyof AdminDailyActivity) {
  return rows.reduce((total, row) => total + Number(row[key] ?? 0), 0);
}

function MetricCard({ label, value, detail, icon: Icon, tone }: {
  label: string;
  value: string;
  detail: string;
  icon: typeof Activity;
  tone: 'blue' | 'amber' | 'green' | 'coral';
}) {
  return (
    <article className={`hh-admin-metric hh-admin-metric--${tone}`}>
      <div className="hh-admin-metric-icon" aria-hidden="true"><Icon size={19} /></div>
      <div>
        <p>{label}</p>
        <strong>{value}</strong>
        <small>{detail}</small>
      </div>
    </article>
  );
}

function AdminLogin({ onError }: { onError: (message: string) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!email.trim() || !password) return;
    setSubmitting(true);
    onError('');
    try {
      const result = await signIn({ email: email.trim(), password });
      if (result.error) onError(toAuthErrorMessage(result.error));
    } catch (error) {
      onError(toAuthErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="hh-admin-login-page">
      <section className="hh-admin-login-card" aria-labelledby="admin-login-title">
        <div className="hh-admin-brand-mark" aria-hidden="true"><BarChart3 size={22} /></div>
        <p className="hh-admin-eyebrow">HABITHERO / PRODUCT OPS</p>
        <h1 id="admin-login-title">使用分析管理中心</h1>
        <p className="hh-admin-login-copy">這是產品管理者專用入口。請使用指定的 Supabase 管理者帳號登入。</p>
        <form onSubmit={handleSubmit} className="hh-admin-login-form">
          <label htmlFor="admin-email">管理者 Email</label>
          <input id="admin-email" type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="輸入管理者 Email" required />
          <label htmlFor="admin-password">密碼</label>
          <input id="admin-password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="輸入密碼" minLength={6} required />
          <button type="submit" disabled={submitting || !email || !password} className="hh-admin-primary-button">
            {submitting ? '驗證中…' : '登入分析看板'}
          </button>
        </form>
        <p className="hh-admin-login-note"><ShieldCheck size={16} aria-hidden="true" /> 只有指定帳號可以查看跨家庭統計資料</p>
      </section>
    </main>
  );
}

function AccessDenied({ onLogout }: { onLogout: () => void }) {
  return (
    <main className="hh-admin-login-page">
      <section className="hh-admin-login-card hh-admin-login-card--denied" aria-labelledby="admin-denied-title">
        <div className="hh-admin-denied-icon" aria-hidden="true"><ShieldCheck size={25} /></div>
        <p className="hh-admin-eyebrow">ACCESS RESTRICTED</p>
        <h1 id="admin-denied-title">這個帳號沒有看板權限</h1>
        <p className="hh-admin-login-copy">此網址只開放給 HabitHero 指定產品管理者。請登出後改用管理者帳號登入。</p>
        <button type="button" className="hh-admin-secondary-button" onClick={onLogout}><LogOut size={17} /> 登出</button>
      </section>
    </main>
  );
}

function DailyActivityChart({ rows }: { rows: AdminDailyActivity[] }) {
  const chartRows = rows.slice(-14);
  const maxUsers = Math.max(1, ...chartRows.map((row) => row.active_users));
  return (
    <div className="hh-admin-chart" role="img" aria-label="每日活躍使用者圖表">
      {chartRows.length === 0 && <p className="hh-admin-empty">事件資料還在累積中。</p>}
      {chartRows.map((row) => (
        <div className="hh-admin-chart-column" key={row.activity_date}>
          <div className="hh-admin-chart-value">{row.active_users}</div>
          <div className="hh-admin-chart-bar-wrap"><div className="hh-admin-chart-bar" style={{ height: `${Math.max(6, row.active_users / maxUsers * 100)}%` }} /></div>
          <span>{row.activity_date.slice(5)}</span>
        </div>
      ))}
    </div>
  );
}

function AnalyticsContent({ payload, onRefresh, refreshing }: { payload: AdminAnalyticsPayload; onRefresh: () => void; refreshing: boolean }) {
  const [range, setRange] = useState<7 | 30 | 90>(30);
  const dailyRows = useMemo(() => payload.dailyActivity.slice(-range), [payload.dailyActivity, range]);
  const latestDay = dailyRows.at(-1);
  const sessionCount = sumBy(dailyRows, 'sessions_ended');
  const sessionSeconds = sumBy(dailyRows, 'session_seconds');
  const averageSessionSeconds = sessionCount > 0 ? sessionSeconds / sessionCount : 0;
  const completedTasks = sumBy(dailyRows, 'tasks_completed');
  const latestD7 = [...payload.retention].filter((row) => row.days_since_first_open === 7 && row.cohort_users > 0).at(-1);
  const funnelTotals = payload.funnel.reduce((totals, row) => ({
    planned: totals.planned + row.planned_tasks,
    submitted: totals.submitted + row.submitted_tasks,
    completed: totals.completed + row.completed_tasks,
  }), { planned: 0, submitted: 0, completed: 0 });
  const hasBehaviorData = dailyRows.some((row) => row.total_analytics_events > 0);
  const tutorialMax = Math.max(1, ...payload.tutorial.map((row) => row.unique_users));

  return (
    <main className="hh-admin-page">
      <header className="hh-admin-header">
        <div>
          <p className="hh-admin-eyebrow">HABITHERO / PRODUCT OPS</p>
          <h1>使用分析</h1>
          <p>用真實使用行為，找出孩子在哪裡開始、停留與離開。</p>
        </div>
        <div className="hh-admin-header-actions">
          <span className="hh-admin-secure-badge"><ShieldCheck size={16} /> 管理者已驗證</span>
          <button type="button" className="hh-admin-refresh-button" onClick={onRefresh} disabled={refreshing}><RefreshCw size={16} className={refreshing ? 'hh-admin-spin' : undefined} /> {refreshing ? '更新中…' : '重新整理'}</button>
        </div>
      </header>

      <section className="hh-admin-toolbar" aria-label="分析範圍">
        <span>顯示最近</span>
        {[7, 30, 90].map((days) => <button key={days} type="button" className={range === days ? 'is-active' : undefined} onClick={() => setRange(days as 7 | 30 | 90)}>{days} 天</button>)}
        <span className="hh-admin-toolbar-hint">資料時區：台北</span>
      </section>

      {!hasBehaviorData && <div className="hh-admin-info-banner"><Activity size={18} /><span>行為追蹤已接上，新的開啟、使用時間、畫面與場景資料會從這次更新後開始累積；既有任務與孩子資料仍會立即顯示。</span></div>}

      <section className="hh-admin-metric-grid" aria-label="核心指標">
        <MetricCard label="最近一日 DAU" value={`${latestDay?.active_users ?? 0}`} detail="登入後有實際活動的帳號" icon={Users} tone="blue" />
        <MetricCard label="平均 Session" value={formatDuration(averageSessionSeconds)} detail={`${sessionCount} 次已完成 Session`} icon={Clock3} tone="amber" />
        <MetricCard label="D7 留存" value={latestD7 ? `${latestD7.retention_rate}%` : '等待資料'} detail={latestD7 ? `${latestD7.retained_users} / ${latestD7.cohort_users} 人` : '至少累積 7 天後顯示'} icon={Activity} tone="green" />
        <MetricCard label="完成任務" value={`${completedTasks}`} detail={`最近 ${range} 天`} icon={CheckCircle2} tone="coral" />
      </section>

      <section className="hh-admin-main-grid">
        <article className="hh-admin-panel hh-admin-panel--wide">
          <div className="hh-admin-panel-heading"><div><p className="hh-admin-section-kicker">DAILY ACTIVE USERS</p><h2>每日活躍與使用時間</h2></div><span>{dailyRows.length ? `${formatDate(dailyRows[0].activity_date)} – ${formatDate(dailyRows.at(-1)?.activity_date ?? null)}` : '尚無事件資料'}</span></div>
          <DailyActivityChart rows={dailyRows} />
          <div className="hh-admin-data-strip"><span><b>{sumBy(dailyRows, 'app_opens')}</b> 次開啟</span><span><b>{sumBy(dailyRows, 'screen_views')}</b> 次看畫面</span><span><b>{formatDuration(sumBy(dailyRows, 'scene_dwell_seconds'))}</b> 場景停留</span><span><b>{sumBy(dailyRows, 'button_clicks')}</b> 次點擊</span></div>
        </article>

        <article className="hh-admin-panel">
          <div className="hh-admin-panel-heading"><div><p className="hh-admin-section-kicker">TASK FUNNEL</p><h2>任務漏斗</h2></div><span>既有資料</span></div>
          <div className="hh-admin-funnel">
            {[['安排', funnelTotals.planned], ['送出', funnelTotals.submitted], ['完成', funnelTotals.completed]].map(([label, value]) => {
              const numericValue = Number(value);
              const width = funnelTotals.planned > 0 ? Math.max(5, numericValue / funnelTotals.planned * 100) : 5;
              return <div className="hh-admin-funnel-row" key={String(label)}><div><span>{label}</span><b>{numericValue}</b></div><div className="hh-admin-funnel-track"><i style={{ width: `${width}%` }} /></div></div>;
            })}
          </div>
          <p className="hh-admin-panel-footnote">完成率 {funnelTotals.planned ? `${(funnelTotals.completed / funnelTotals.planned * 100).toFixed(1)}%` : '尚無任務'}</p>
        </article>
      </section>

      <section className="hh-admin-secondary-grid">
        <article className="hh-admin-panel">
          <div className="hh-admin-panel-heading"><div><p className="hh-admin-section-kicker">TUTORIAL DROP-OFF</p><h2>新手指引走到哪一步</h2></div></div>
          <div className="hh-admin-step-list">
            {payload.tutorial.length === 0 && <p className="hh-admin-empty">尚未收到新手指引事件。</p>}
            {payload.tutorial.map((row) => <div className="hh-admin-step-row" key={row.step_number}><span>第 {row.step_number} 步</span><div className="hh-admin-step-track"><i style={{ width: `${Math.max(5, row.unique_users / tutorialMax * 100)}%` }} /></div><b>{row.unique_users} 人</b></div>)}
          </div>
        </article>

        <article className="hh-admin-panel">
          <div className="hh-admin-panel-heading"><div><p className="hh-admin-section-kicker">RETENTION</p><h2>回來使用的比例</h2></div></div>
          <div className="hh-admin-retention-grid"><span>週期</span><span>人數</span><span>比例</span>{[0, 1, 7].map((day) => { const row = [...payload.retention].filter((candidate) => candidate.days_since_first_open === day).at(-1); return <Fragment key={day}><b>D{day}</b><span>{row?.cohort_users ?? '—'}</span><strong>{row ? `${row.retention_rate}%` : '—'}</strong></Fragment>; })}</div>
          <p className="hh-admin-panel-footnote">D7 需要事件資料累積滿一週才有意義。</p>
        </article>

        <article className="hh-admin-panel">
          <div className="hh-admin-panel-heading"><div><p className="hh-admin-section-kicker">WORLD DWELL TIME</p><h2>世界場景停留</h2></div></div>
          <div className="hh-admin-scene-list">
            {payload.sceneDwell.length === 0 && <p className="hh-admin-empty">尚未收到場景事件。</p>}
            {payload.sceneDwell.slice(0, 5).map((row) => <div className="hh-admin-scene-row" key={row.scene_name}><div><b>{row.scene_name}</b><small>{row.unique_users} 人 · 進入 {row.scene_enters} 次</small></div><strong>{formatDuration(row.avg_dwell_seconds)}</strong></div>)}
          </div>
        </article>
      </section>

      <section className="hh-admin-panel hh-admin-panel--table">
        <div className="hh-admin-panel-heading"><div><p className="hh-admin-section-kicker">USER SNAPSHOT</p><h2>孩子使用概況</h2></div><span>{payload.summary.length} 位孩子</span></div>
        <div className="hh-admin-table-scroll"><table><thead><tr><th>孩子</th><th>最近畫面</th><th>Session</th><th>平均使用</th><th>場景停留</th><th>任務完成率</th><th>最後活動</th></tr></thead><tbody>{payload.summary.map((row) => <tr key={row.child_profile_id}><td><strong>{row.child_name}</strong><small>{row.family_name}</small></td><td>{row.last_screen_name ?? '尚無'}</td><td>{row.analytics_sessions}</td><td>{row.analytics_sessions ? formatDuration(row.analytics_session_seconds / row.analytics_sessions) : '尚無'}</td><td>{formatDuration(row.scene_dwell_seconds)}</td><td>{row.task_completion_rate}%</td><td>{formatDate(row.last_known_activity_at)}</td></tr>)}</tbody></table></div>
        {payload.summary.length === 0 && <p className="hh-admin-empty">目前沒有孩子資料。</p>}
      </section>
    </main>
  );
}

export function AdminAnalyticsDashboard() {
  const { session, loading: sessionLoading, error: sessionError } = useAuthSession();
  const [payload, setPayload] = useState<AdminAnalyticsPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    document.title = 'HabitHero 使用分析';
    return () => { document.title = 'HabitHero'; };
  }, []);

  const allowed = isHabitHeroAdminEmail(session?.user.email);
  const load = async () => {
    if (!allowed) return;
    setLoading(true);
    setError('');
    try {
      setPayload(await fetchAdminAnalytics());
    } catch {
      setError('目前無法載入分析資料，請稍後再試。');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (allowed) void load(); }, [allowed]);

  if (sessionLoading) return <main className="hh-admin-login-page"><p className="hh-admin-loading">正在驗證管理者登入狀態…</p></main>;
  if (!session) return <AdminLogin onError={setError} />;
  if (!allowed) return <AccessDenied onLogout={() => { void signOut(); }} />;
  if (!payload) return <main className="hh-admin-login-page"><section className="hh-admin-login-card"><div className="hh-admin-brand-mark" aria-hidden="true"><BarChart3 size={22} /></div><h1>正在準備分析看板</h1><p className="hh-admin-login-copy">正在讀取產品資料…</p>{(error || sessionError) && <p className="hh-admin-error" role="alert">{error || '登入服務暫時無法使用。'}</p>}<button type="button" className="hh-admin-primary-button" onClick={() => void load()} disabled={loading}>{loading ? '讀取中…' : '重新載入'}</button></section></main>;

  return <><AnalyticsContent payload={payload} onRefresh={() => void load()} refreshing={loading} /><button type="button" className="hh-admin-floating-logout" onClick={() => { void signOut(); }} aria-label="登出管理者看板"><LogOut size={17} /> 登出</button></>;
}
