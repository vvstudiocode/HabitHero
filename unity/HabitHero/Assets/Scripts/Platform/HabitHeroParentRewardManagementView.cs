using System;
using System.Globalization;
using System.Threading.Tasks;
using HabitHero.Platform;
using UnityEngine;
using UnityEngine.UI;

namespace HabitHero.App
{
    public sealed class HabitHeroParentRewardManagementView
    {
        private readonly Transform canvasTransform;
        private readonly Font font;
        private GameObject panel;
        private GameObject rewardListObject;
        private GameObject childListObject;
        private Text formTitle;
        private Text selectedChildText;
        private Text statusText;
        private InputField nameInput;
        private InputField pointsInput;
        private Button saveButton;
        private Button deleteButton;
        private Text deleteButtonLabel;
        private SupabaseParentHomeSnapshot snapshot;
        private SupabaseChildRewardRecord activeReward;
        private string selectedChildId;
        private bool deleteConfirm;
        private Func<
            SupabaseParentRewardCreateInput,
            Task<SupabaseParentRewardMutationResult>> createReward;
        private Func<
            SupabaseChildRewardRecord,
            string,
            int,
            Task<SupabaseParentRewardMutationResult>> updateReward;
        private Func<string, Task<SupabaseParentRewardMutationResult>> deleteReward;
        private Action<SupabaseParentHomeSnapshot> applySnapshot;
        private Action<string, bool> setParentStatus;
        private Action onClosed;

        public HabitHeroParentRewardManagementView(Transform canvasTransform, Font font)
        {
            if (canvasTransform == null) throw new ArgumentNullException("canvasTransform");
            if (font == null) throw new ArgumentNullException("font");
            this.canvasTransform = canvasTransform;
            this.font = font;
        }

        public void Show(
            SupabaseParentHomeSnapshot snapshot,
            Func<
                SupabaseParentRewardCreateInput,
                Task<SupabaseParentRewardMutationResult>> createReward,
            Func<
                SupabaseChildRewardRecord,
                string,
                int,
                Task<SupabaseParentRewardMutationResult>> updateReward,
            Func<string, Task<SupabaseParentRewardMutationResult>> deleteReward,
            Action<SupabaseParentHomeSnapshot> applySnapshot,
            Action<string, bool> setParentStatus,
            Action onClosed)
        {
            if (snapshot == null) throw new ArgumentNullException("snapshot");
            if (createReward == null) throw new ArgumentNullException("createReward");
            if (updateReward == null) throw new ArgumentNullException("updateReward");
            if (deleteReward == null) throw new ArgumentNullException("deleteReward");

            Dispose();
            this.snapshot = snapshot;
            this.createReward = createReward;
            this.updateReward = updateReward;
            this.deleteReward = deleteReward;
            this.applySnapshot = applySnapshot;
            this.setParentStatus = setParentStatus;
            this.onClosed = onClosed;
            selectedChildId = FindFirstChildId();

            panel = HabitHeroUiFactory.CreatePanel(
                canvasTransform,
                new Color(0.02f, 0.035f, 0.06f, 0.86f),
                "ParentRewardManagementPanel");
            GameObject card = HabitHeroUiFactory.CreatePanel(
                panel.transform,
                HabitHeroUiFactory.PanelColor,
                "ParentRewardManagementCard");
            RectTransform cardRect = card.GetComponent<RectTransform>();
            cardRect.anchorMin = new Vector2(0.06f, 0.03f);
            cardRect.anchorMax = new Vector2(0.94f, 0.97f);
            cardRect.offsetMin = Vector2.zero;
            cardRect.offsetMax = Vector2.zero;

            HabitHeroUiFactory.CreateText(
                card.transform,
                font,
                "管理獎勵商店",
                32,
                TextAnchor.MiddleCenter,
                HabitHeroUiFactory.AccentColor,
                new Vector2(0.08f, 0.91f),
                new Vector2(0.92f, 0.97f));
            HabitHeroUiFactory.CreateText(
                card.transform,
                font,
                "目前獎勵",
                18,
                TextAnchor.MiddleLeft,
                Color.white,
                new Vector2(0.08f, 0.85f),
                new Vector2(0.92f, 0.9f));
            rewardListObject = CreateVerticalList(
                card.transform,
                "ParentRewardList",
                new Vector2(0.08f, 0.67f),
                new Vector2(0.92f, 0.85f));
            RenderRewardList();

            formTitle = HabitHeroUiFactory.CreateText(
                card.transform,
                font,
                "新增獎勵",
                19,
                TextAnchor.MiddleLeft,
                HabitHeroUiFactory.AccentColor,
                new Vector2(0.08f, 0.61f),
                new Vector2(0.92f, 0.66f));
            HabitHeroUiFactory.CreateText(
                card.transform,
                font,
                "指定孩子",
                16,
                TextAnchor.MiddleLeft,
                Color.white,
                new Vector2(0.08f, 0.56f),
                new Vector2(0.92f, 0.61f));
            childListObject = CreateVerticalList(
                card.transform,
                "ParentRewardChildList",
                new Vector2(0.08f, 0.47f),
                new Vector2(0.92f, 0.56f));
            RenderChildList();
            selectedChildText = HabitHeroUiFactory.CreateText(
                card.transform,
                font,
                "目前指定：" + GetChildName(selectedChildId),
                15,
                TextAnchor.MiddleCenter,
                HabitHeroUiFactory.AccentColor,
                new Vector2(0.08f, 0.43f),
                new Vector2(0.92f, 0.47f));

            nameInput = HabitHeroUiFactory.CreateInput(
                card.transform,
                font,
                "獎勵名稱，例如：週末看電影",
                false,
                new Vector2(0.08f, 0.35f),
                new Vector2(0.92f, 0.42f));
            nameInput.contentType = InputField.ContentType.Standard;
            nameInput.lineType = InputField.LineType.SingleLine;
            HabitHeroUiFactory.CreateText(
                card.transform,
                font,
                "獎勵點數",
                16,
                TextAnchor.MiddleLeft,
                Color.white,
                new Vector2(0.08f, 0.3f),
                new Vector2(0.92f, 0.35f));
            pointsInput = HabitHeroUiFactory.CreateInput(
                card.transform,
                font,
                "例如：50",
                false,
                new Vector2(0.08f, 0.23f),
                new Vector2(0.92f, 0.3f));
            pointsInput.contentType = InputField.ContentType.IntegerNumber;
            pointsInput.lineType = InputField.LineType.SingleLine;
            pointsInput.text = "50";
            statusText = HabitHeroUiFactory.CreateText(
                card.transform,
                font,
                "新增或選取現有獎勵後編輯。",
                14,
                TextAnchor.MiddleCenter,
                new Color(0.84f, 0.89f, 0.96f, 1f),
                new Vector2(0.08f, 0.17f),
                new Vector2(0.92f, 0.22f));
            saveButton = HabitHeroUiFactory.CreateButton(
                card.transform,
                font,
                "建立獎勵",
                new Vector2(0.08f, 0.1f),
                new Vector2(0.46f, 0.16f));
            saveButton.onClick.AddListener(HandleSave);
            deleteButton = HabitHeroUiFactory.CreateButton(
                card.transform,
                font,
                "刪除目前獎勵",
                new Vector2(0.54f, 0.1f),
                new Vector2(0.92f, 0.16f));
            deleteButtonLabel = deleteButton.GetComponentInChildren<Text>();
            deleteButton.gameObject.SetActive(false);
            deleteButton.onClick.AddListener(HandleDelete);
            Button closeButton = HabitHeroUiFactory.CreateButton(
                card.transform,
                font,
                "關閉",
                new Vector2(0.35f, 0.03f),
                new Vector2(0.65f, 0.09f));
            closeButton.onClick.AddListener(Close);
        }

        public void Dispose()
        {
            if (panel != null)
            {
                UnityEngine.Object.Destroy(panel);
                panel = null;
            }

            snapshot = null;
            activeReward = null;
            selectedChildId = null;
            createReward = null;
            updateReward = null;
            deleteReward = null;
            applySnapshot = null;
            setParentStatus = null;
            onClosed = null;
            rewardListObject = null;
            childListObject = null;
            formTitle = null;
            selectedChildText = null;
            statusText = null;
            nameInput = null;
            pointsInput = null;
            saveButton = null;
            deleteButton = null;
            deleteButtonLabel = null;
            deleteConfirm = false;
        }

        private void RenderRewardList()
        {
            if (rewardListObject == null) return;
            foreach (Transform child in rewardListObject.transform)
            {
                UnityEngine.Object.Destroy(child.gameObject);
            }

            Button addButton = HabitHeroUiFactory.CreateButton(
                rewardListObject.transform,
                font,
                "＋新增獎勵",
                Vector2.zero,
                Vector2.one);
            addButton.GetComponent<RectTransform>().sizeDelta = new Vector2(0f, 38f);
            addButton.onClick.AddListener(OpenCreateForm);

            int visibleCount = 0;
            foreach (SupabaseChildRewardRecord reward in
                snapshot.rewards ?? new SupabaseChildRewardRecord[0])
            {
                if (reward == null || string.IsNullOrWhiteSpace(reward.id)
                    || visibleCount >= 5) continue;
                Button rewardButton = HabitHeroUiFactory.CreateButton(
                    rewardListObject.transform,
                    font,
                    GetChildName(reward.child_profile_id) + "｜" + reward.name
                        + "｜" + reward.points + " 點",
                    Vector2.zero,
                    Vector2.one);
                rewardButton.GetComponent<RectTransform>().sizeDelta =
                    new Vector2(0f, 38f);
                rewardButton.onClick.AddListener(() => SelectReward(reward));
                visibleCount += 1;
            }
        }

        private void RenderChildList()
        {
            if (childListObject == null) return;
            foreach (Transform child in childListObject.transform)
            {
                UnityEngine.Object.Destroy(child.gameObject);
            }

            int visibleCount = 0;
            foreach (SupabaseChildProfileRecord child in
                snapshot.children ?? new SupabaseChildProfileRecord[0])
            {
                if (child == null || string.IsNullOrWhiteSpace(child.id)
                    || visibleCount >= 4) continue;
                Button childButton = HabitHeroUiFactory.CreateButton(
                    childListObject.transform,
                    font,
                    child.display_name,
                    Vector2.zero,
                    Vector2.one);
                childButton.GetComponent<RectTransform>().sizeDelta =
                    new Vector2(0f, 34f);
                childButton.onClick.AddListener(() => SelectChild(child));
                visibleCount += 1;
            }
        }

        private void OpenCreateForm()
        {
            activeReward = null;
            deleteConfirm = false;
            if (string.IsNullOrWhiteSpace(selectedChildId))
            {
                selectedChildId = FindFirstChildId();
            }
            if (formTitle != null) formTitle.text = "新增獎勵";
            if (nameInput != null) nameInput.text = string.Empty;
            if (pointsInput != null) pointsInput.text = "50";
            if (saveButton != null) saveButton.GetComponentInChildren<Text>().text = "建立獎勵";
            if (deleteButton != null) deleteButton.gameObject.SetActive(false);
            if (deleteButtonLabel != null) deleteButtonLabel.text = "刪除目前獎勵";
            SetStatus("請選孩子並輸入獎勵內容。", false);
        }

        private void SelectReward(SupabaseChildRewardRecord reward)
        {
            if (reward == null) return;
            activeReward = reward;
            selectedChildId = reward.child_profile_id;
            deleteConfirm = false;
            if (formTitle != null) formTitle.text = "編輯獎勵";
            if (nameInput != null) nameInput.text = reward.name ?? string.Empty;
            if (pointsInput != null) pointsInput.text = reward.points.ToString(CultureInfo.InvariantCulture);
            if (selectedChildText != null)
            {
                selectedChildText.text = "目前指定：" + GetChildName(selectedChildId);
            }
            if (saveButton != null) saveButton.GetComponentInChildren<Text>().text = "儲存修改";
            if (deleteButton != null) deleteButton.gameObject.SetActive(true);
            if (deleteButtonLabel != null) deleteButtonLabel.text = "刪除目前獎勵";
            SetStatus("正在編輯「" + reward.name + "」。", false);
        }

        private void SelectChild(SupabaseChildProfileRecord child)
        {
            if (child == null || string.IsNullOrWhiteSpace(child.id)) return;
            selectedChildId = child.id;
            if (selectedChildText != null)
            {
                selectedChildText.text = "目前指定：" + GetChildName(selectedChildId);
            }
            if (activeReward == null)
            {
                SetStatus("新增獎勵會建立給 " + GetChildName(selectedChildId) + "。", false);
            }
            else
            {
                SetStatus("編輯中的獎勵仍屬於原本的孩子。", false);
            }
        }

        private async void HandleSave()
        {
            string name = nameInput == null ? string.Empty : nameInput.text.Trim();
            string pointsText = pointsInput == null ? string.Empty : pointsInput.text.Trim();
            int points;
            if (activeReward == null && string.IsNullOrWhiteSpace(selectedChildId))
            {
                SetStatus("請先選擇孩子。", true);
                return;
            }
            if (name.Length < 1 || name.Length > 120)
            {
                SetStatus("請輸入 1 到 120 個字元的獎勵名稱。", true);
                return;
            }
            if (!int.TryParse(
                    pointsText,
                    NumberStyles.Integer,
                    CultureInfo.InvariantCulture,
                    out points)
                || points <= 0)
            {
                SetStatus("請輸入大於 0 的整數點數。", true);
                return;
            }

            if (saveButton != null) saveButton.interactable = false;
            SetStatus(activeReward == null ? "正在建立獎勵…" : "正在儲存修改…", false);
            try
            {
                SupabaseParentRewardMutationResult result;
                if (activeReward == null)
                {
                    result = await createReward(
                        new SupabaseParentRewardCreateInput
                        {
                            childProfileId = selectedChildId,
                            name = name,
                            points = points,
                            icon = "Gift",
                        });
                }
                else
                {
                    result = await updateReward(activeReward, name, points);
                }

                if (result == null)
                {
                    SetStatus("獎勵回應無效，請稍後再試。", true);
                    if (saveButton != null) saveButton.interactable = true;
                    return;
                }
                if (result.RefreshedSnapshot != null && applySnapshot != null)
                {
                    applySnapshot(result.RefreshedSnapshot);
                }
                string message = string.IsNullOrWhiteSpace(result.RefreshError)
                    ? (activeReward == null ? "獎勵已建立。" : "獎勵已更新。")
                    : "獎勵已寫入；最新家庭資料稍後會自動更新。";
                Close();
                if (setParentStatus != null) setParentStatus(message, false);
            }
            catch (Exception exception)
            {
                SetStatus("儲存獎勵失敗：" + exception.Message, true);
                if (saveButton != null) saveButton.interactable = true;
            }
        }

        private async void HandleDelete()
        {
            if (activeReward == null || deleteReward == null) return;
            if (!deleteConfirm)
            {
                deleteConfirm = true;
                if (deleteButtonLabel != null) deleteButtonLabel.text = "再次確認刪除";
                SetStatus("再次點擊才會刪除「" + activeReward.name + "」。", true);
                return;
            }

            if (deleteButton != null) deleteButton.interactable = false;
            SetStatus("正在刪除獎勵…", false);
            try
            {
                SupabaseParentRewardMutationResult result = await deleteReward(activeReward.id);
                if (result == null)
                {
                    SetStatus("刪除回應無效，請稍後再試。", true);
                    if (deleteButton != null) deleteButton.interactable = true;
                    return;
                }
                if (result.RefreshedSnapshot != null && applySnapshot != null)
                {
                    applySnapshot(result.RefreshedSnapshot);
                }
                string message = string.IsNullOrWhiteSpace(result.RefreshError)
                    ? "獎勵已刪除。"
                    : "獎勵已刪除；最新家庭資料稍後會自動更新。";
                Close();
                if (setParentStatus != null) setParentStatus(message, false);
            }
            catch (Exception exception)
            {
                SetStatus("刪除獎勵失敗：" + exception.Message, true);
                if (deleteButton != null) deleteButton.interactable = true;
            }
        }

        private void Close()
        {
            Action closed = onClosed;
            Dispose();
            if (closed != null) closed();
        }

        private string FindFirstChildId()
        {
            foreach (SupabaseChildProfileRecord child in
                snapshot == null
                    ? new SupabaseChildProfileRecord[0]
                    : snapshot.children ?? new SupabaseChildProfileRecord[0])
            {
                if (child != null && !string.IsNullOrWhiteSpace(child.id)) return child.id;
            }

            return null;
        }

        private string GetChildName(string childProfileId)
        {
            foreach (SupabaseChildProfileRecord child in
                snapshot == null
                    ? new SupabaseChildProfileRecord[0]
                    : snapshot.children ?? new SupabaseChildProfileRecord[0])
            {
                if (child != null && child.id == childProfileId)
                {
                    return string.IsNullOrWhiteSpace(child.display_name)
                        ? "孩子"
                        : child.display_name;
                }
            }

            return "孩子";
        }

        private GameObject CreateVerticalList(
            Transform parent,
            string name,
            Vector2 anchorMin,
            Vector2 anchorMax)
        {
            GameObject list = new GameObject(
                name,
                typeof(RectTransform),
                typeof(VerticalLayoutGroup));
            list.transform.SetParent(parent, false);
            RectTransform rect = list.GetComponent<RectTransform>();
            rect.anchorMin = anchorMin;
            rect.anchorMax = anchorMax;
            rect.offsetMin = Vector2.zero;
            rect.offsetMax = Vector2.zero;
            VerticalLayoutGroup layout = list.GetComponent<VerticalLayoutGroup>();
            layout.spacing = 5f;
            layout.childControlWidth = true;
            layout.childControlHeight = true;
            layout.childForceExpandWidth = true;
            layout.childForceExpandHeight = false;
            return list;
        }

        private void SetStatus(string message, bool isError)
        {
            if (statusText != null)
            {
                statusText.text = message;
                statusText.color = isError
                    ? new Color(1f, 0.52f, 0.52f, 1f)
                    : new Color(0.84f, 0.89f, 0.96f, 1f);
            }
            else if (setParentStatus != null)
            {
                setParentStatus(message, isError);
            }
        }
    }
}
