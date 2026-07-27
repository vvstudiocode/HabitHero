export const PRIVACY_POLICY_VERSION = '2026-07-23';
export const PARENT_CONSENT_VERSION = '2026-07-23';

export function isCurrentParentConsent(version: string | null | undefined): boolean {
  return version === PARENT_CONSENT_VERSION;
}

export const privacyPolicySections = [
  {
    title: '我們收集哪些資料',
    paragraphs: [
      'HabitHero 會收集家長帳號 Email、家庭成員設定、孩子顯示名稱、任務與獎勵紀錄，以及孩子主動提交的心得、心情與難度評分。',
      '我們只收集提供家庭任務、同步、登入、安全與支援服務所必要的資料，不以兒童資料投放個人化廣告。',
    ],
  },
  {
    title: '資料如何使用',
    paragraphs: [
      '資料用於同步家庭資料、執行家長核准與點數交易、維持帳號安全、處理刪除請求，以及改善服務穩定性。',
      '若功能使用第三方服務（例如 Supabase 或 AI 服務），只會在提供該功能所需的範圍內傳輸資料，並依其服務條款與隱私政策處理。',
    ],
  },
  {
    title: '兒童資料與家長責任',
    paragraphs: [
      'HabitHero 的兒童帳號由家長建立與管理。家長應確認自己有權代表家庭與孩子提供資料，並在孩子使用前向孩子說明任務與資料紀錄的用途。',
      '孩子不能自行核准任務、增加點數或開啟家長功能；家長可以修改孩子資料、重設孩子登入密碼或刪除孩子帳號。',
    ],
  },
  {
    title: '保存、分享與刪除',
    paragraphs: [
      '資料會保存至家長要求刪除帳號，或服務不再需要該資料為止；法律要求保存的資料除外。',
      '我們不販售個人資料。依法或為提供服務所必要的受託服務商，僅能在其工作範圍內處理資料。',
      '家長可以在設定中刪除自己的帳號與家庭資料，也可以要求刪除孩子資料。刪除後通常無法復原。',
    ],
  },
  {
    title: '聯絡我們',
    paragraphs: ['若你需要查詢、更正、匯出或刪除資料，請透過支援頁聯絡 HabitHero。正式上架前，請將此段的聯絡方式替換成實際支援 Email 與公司/營運者名稱。'],
  },
] as const;

export const supportTopics = [
  { title: '登入或刷新失敗', body: '請確認網路連線，重新整理後再試；孩子帳號請由家長確認登入名稱與密碼仍有效。' },
  { title: '孩子看不到自己的任務', body: '請確認孩子使用正確帳號，並由家長重新整理管理端。孩子只能看到所屬家庭與自己的資料。' },
  { title: '點數或獎勵狀態不一致', body: '請先不要重複點擊，確認網路恢復後使用頁面上的重試；所有點數交易以伺服器確認結果為準。' },
  { title: '資料刪除與隱私請求', body: '請使用設定中的刪除帳號流程。若無法登入，請透過公開支援頁提出刪除請求，並提供可驗證的家長帳號 Email。' },
] as const;

export const parentalConsentChecklist = [
  '我是孩子的家長或合法監護人，並有權代表孩子使用 HabitHero。',
  '我已閱讀隱私政策，了解任務、心得、心情與帳號資料的用途。',
  '我同意由我管理孩子帳號、任務核准、點數交易與資料刪除。',
  '我會在孩子使用前以適合其年齡的方式說明資料紀錄與安全規則。',
] as const;
