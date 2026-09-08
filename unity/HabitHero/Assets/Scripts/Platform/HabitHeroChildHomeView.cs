using System;
using System.Threading.Tasks;
using HabitHero.Platform;
using UnityEngine;
using UnityEngine.UI;

namespace HabitHero.App
{
    public sealed class HabitHeroChildHomeView
    {
        private readonly Transform canvasTransform;
        private readonly Font font;
        private GameObject panel;
        private Text statusText;
        private Func<string, Task> submitTask;

        public HabitHeroChildHomeView(Transform canvasTransform, Font font)
        {
            if (canvasTransform == null) throw new ArgumentNullException("canvasTransform");
            if (font == null) throw new ArgumentNullException("font");
            this.canvasTransform = canvasTransform;
            this.font = font;
        }

        public void Show(
            SupabaseChildHomeSnapshot snapshot,
            Func<string, Task> submitTask,
            Action onSignOut)
        {
            if (snapshot == null || snapshot.child == null)
            {
                throw new ArgumentNullException("snapshot");
            }

            Dispose();
            this.submitTask = submitTask;
            panel = HabitHeroUiFactory.CreatePanel(
                canvasTransform,
                HabitHeroUiFactory.PanelColor,
                "ChildHomePanel");
            RectTransform panelRect = panel.GetComponent<RectTransform>();
            panelRect.anchorMin = new Vector2(0.5f, 0.5f);
            panelRect.anchorMax = new Vector2(0.5f, 0.5f);
            panelRect.pivot = new Vector2(0.5f, 0.5f);
            panelRect.sizeDelta = new Vector2(680f, 720f);
            panelRect.anchoredPosition = Vector2.zero;

            HabitHeroUiFactory.CreateText(
                panel.transform,
                font,
                "今日任務",
                40,
                TextAnchor.MiddleCenter,
                HabitHeroUiFactory.AccentColor,
                new Vector2(0.08f, 0.84f),
                new Vector2(0.92f, 0.95f));
            HabitHeroUiFactory.CreateText(
                panel.transform,
                font,
                snapshot.child.display_name + "　目前點數：" + snapshot.child.points_balance,
                21,
                TextAnchor.MiddleCenter,
                Color.white,
                new Vector2(0.08f, 0.76f),
                new Vector2(0.92f, 0.84f));

            Button signOutButton = HabitHeroUiFactory.CreateButton(
                panel.transform,
                font,
                "登出",
                new Vector2(0.72f, 0.91f),
                new Vector2(0.91f, 0.97f));
            signOutButton.onClick.AddListener(() => onSignOut());

            GameObject taskListObject = new GameObject(
                "TaskList",
                typeof(RectTransform),
                typeof(VerticalLayoutGroup));
            taskListObject.transform.SetParent(panel.transform, false);
            RectTransform taskListRect = taskListObject.GetComponent<RectTransform>();
            taskListRect.anchorMin = new Vector2(0.08f, 0.18f);
            taskListRect.anchorMax = new Vector2(0.92f, 0.74f);
            taskListRect.offsetMin = Vector2.zero;
            taskListRect.offsetMax = Vector2.zero;
            VerticalLayoutGroup layout = taskListObject.GetComponent<VerticalLayoutGroup>();
            layout.spacing = 12f;
            layout.childControlWidth = true;
            layout.childControlHeight = true;
            layout.childForceExpandWidth = true;
            layout.childForceExpandHeight = false;

            int visibleTaskCount = 0;
            foreach (SupabaseChildTaskRecord task in snapshot.tasks ?? new SupabaseChildTaskRecord[0])
            {
                if (!IsActionable(task.status) || visibleTaskCount >= 8) continue;
                Button taskButton = HabitHeroUiFactory.CreateButton(
                    taskListObject.transform,
                    font,
                    task.name + " 　+" + task.points + " 點",
                    Vector2.zero,
                    Vector2.one);
                RectTransform taskRect = taskButton.GetComponent<RectTransform>();
                taskRect.sizeDelta = new Vector2(0f, 58f);
                taskButton.onClick.AddListener(() => HandleTaskSubmit(task, taskButton));
                visibleTaskCount += 1;
            }

            if (visibleTaskCount == 0)
            {
                HabitHeroUiFactory.CreateText(
                    taskListObject.transform,
                    font,
                    "今天暫時沒有待完成任務。",
                    22,
                    TextAnchor.MiddleCenter,
                    new Color(0.84f, 0.89f, 0.96f, 1f),
                    Vector2.zero,
                    Vector2.one);
            }

            statusText = HabitHeroUiFactory.CreateText(
                panel.transform,
                font,
                "任務資料已從 Supabase 載入。",
                17,
                TextAnchor.MiddleCenter,
                new Color(0.84f, 0.89f, 0.96f, 1f),
                new Vector2(0.08f, 0.04f),
                new Vector2(0.92f, 0.13f));
        }

        public void Dispose()
        {
            submitTask = null;
            if (panel != null)
            {
                UnityEngine.Object.Destroy(panel);
                panel = null;
            }

            statusText = null;
        }

        private async void HandleTaskSubmit(
            SupabaseChildTaskRecord task,
            Button button)
        {
            if (submitTask == null || task == null || button == null) return;

            button.interactable = false;
            Text buttonText = button.GetComponentInChildren<Text>();
            if (buttonText != null) buttonText.text = "同步中…";
            SetStatus("正在送出「" + task.name + "」…", false);
            try
            {
                await submitTask(task.id);
                if (buttonText != null) buttonText.text = "已送出回報：" + task.name;
                SetStatus("任務已送出，等待家長確認點數。", false);
            }
            catch (Exception exception)
            {
                button.interactable = true;
                if (buttonText != null) buttonText.text = task.name + " 　+" + task.points + " 點";
                SetStatus("任務同步失敗：" + exception.Message, true);
            }
        }

        private void SetStatus(string message, bool isError)
        {
            if (statusText == null) return;
            statusText.text = message;
            statusText.color = isError
                ? new Color(1f, 0.52f, 0.52f, 1f)
                : new Color(0.84f, 0.89f, 0.96f, 1f);
        }

        private static bool IsActionable(string status)
        {
            return status == "todo"
                || status == "pending"
                || status == "revision_requested"
                || status == "proposed"
                || status == "proposal_revision_requested";
        }
    }
}
