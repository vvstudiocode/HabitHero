using System;
using System.Threading.Tasks;
using HabitHero.Platform;
using UnityEngine;
using UnityEngine.UI;

namespace HabitHero.App
{
    public sealed class HabitHeroParentGeneralAdventureManagementView
    {
        private readonly Transform canvasTransform;
        private readonly Font font;
        private GameObject panel;
        private GameObject groupListObject;
        private InputField titleInput;
        private Button saveButton;
        private Text selectedGroupText;
        private Text statusText;
        private SupabaseParentHomeSnapshot snapshot;
        private SupabaseParentAdventureGroupRecord selectedGroup;
        private Func<
            string,
            string,
            Task<SupabaseParentAdventureTitleMutationResult>> updateTitle;
        private Action<SupabaseParentHomeSnapshot> applySnapshot;
        private Action<string, bool> setParentStatus;
        private Action openCreatePanel;
        private Action onClosed;

        public HabitHeroParentGeneralAdventureManagementView(
            Transform canvasTransform,
            Font font)
        {
            if (canvasTransform == null)
            {
                throw new ArgumentNullException("canvasTransform");
            }
            if (font == null) throw new ArgumentNullException("font");
            this.canvasTransform = canvasTransform;
            this.font = font;
        }

        public void Show(
            SupabaseParentHomeSnapshot snapshot,
            Func<
                string,
                string,
                Task<SupabaseParentAdventureTitleMutationResult>> updateTitle,
            Action<SupabaseParentHomeSnapshot> applySnapshot,
            Action<string, bool> setParentStatus,
            Action openCreatePanel,
            Action onClosed)
        {
            if (snapshot == null) throw new ArgumentNullException("snapshot");
            if (updateTitle == null) throw new ArgumentNullException("updateTitle");

            Dispose();
            this.snapshot = snapshot;
            this.updateTitle = updateTitle;
            this.applySnapshot = applySnapshot;
            this.setParentStatus = setParentStatus;
            this.openCreatePanel = openCreatePanel;
            this.onClosed = onClosed;
            selectedGroup = FindFirstActiveGroup();

            panel = HabitHeroUiFactory.CreatePanel(
                canvasTransform,
                new Color(0.02f, 0.035f, 0.06f, 0.9f),
                "ParentGeneralAdventureManagementPanel");
            GameObject card = HabitHeroUiFactory.CreatePanel(
                panel.transform,
                HabitHeroUiFactory.PanelColor,
                "ParentGeneralAdventureManagementCard");
            RectTransform cardRect = card.GetComponent<RectTransform>();
            cardRect.anchorMin = new Vector2(0.06f, 0.04f);
            cardRect.anchorMax = new Vector2(0.94f, 0.96f);
            cardRect.offsetMin = Vector2.zero;
            cardRect.offsetMax = Vector2.zero;

            HabitHeroUiFactory.CreateText(
                card.transform,
                font,
                "一般冒險管理",
                32,
                TextAnchor.MiddleCenter,
                HabitHeroUiFactory.AccentColor,
                new Vector2(0.08f, 0.91f),
                new Vector2(0.92f, 0.97f));
            HabitHeroUiFactory.CreateText(
                card.transform,
                font,
                "管理每位孩子目前的一般冒險名稱；任務與完成紀錄仍由 Supabase 保護。",
                14,
                TextAnchor.MiddleCenter,
                new Color(0.84f, 0.89f, 0.96f, 1f),
                new Vector2(0.08f, 0.86f),
                new Vector2(0.92f, 0.91f));

            groupListObject = CreateVerticalList(
                card.transform,
                "ParentGeneralAdventureGroupList",
                new Vector2(0.08f, 0.56f),
                new Vector2(0.92f, 0.84f));
            selectedGroupText = HabitHeroUiFactory.CreateText(
                card.transform,
                font,
                string.Empty,
                15,
                TextAnchor.MiddleLeft,
                HabitHeroUiFactory.AccentColor,
                new Vector2(0.08f, 0.51f),
                new Vector2(0.92f, 0.56f));
            titleInput = HabitHeroUiFactory.CreateInput(
                card.transform,
                font,
                "一般冒險名稱",
                false,
                new Vector2(0.08f, 0.44f),
                new Vector2(0.92f, 0.5f));
            titleInput.contentType = InputField.ContentType.Standard;
            titleInput.lineType = InputField.LineType.SingleLine;
            saveButton = HabitHeroUiFactory.CreateButton(
                card.transform,
                font,
                "儲存名稱",
                new Vector2(0.08f, 0.37f),
                new Vector2(0.43f, 0.43f));
            saveButton.onClick.AddListener(HandleSave);
            Button createButton = HabitHeroUiFactory.CreateButton(
                card.transform,
                font,
                "建立新冒險",
                new Vector2(0.57f, 0.37f),
                new Vector2(0.92f, 0.43f));
            createButton.interactable = openCreatePanel != null;
            createButton.onClick.AddListener(() =>
            {
                if (openCreatePanel != null) openCreatePanel();
            });
            statusText = HabitHeroUiFactory.CreateText(
                card.transform,
                font,
                string.Empty,
                14,
                TextAnchor.MiddleCenter,
                new Color(0.84f, 0.89f, 0.96f, 1f),
                new Vector2(0.08f, 0.28f),
                new Vector2(0.92f, 0.35f));
            Button closeButton = HabitHeroUiFactory.CreateButton(
                card.transform,
                font,
                "關閉",
                new Vector2(0.35f, 0.08f),
                new Vector2(0.65f, 0.16f));
            closeButton.onClick.AddListener(Close);

            Render();
        }

        public void ApplySnapshot(SupabaseParentHomeSnapshot snapshot)
        {
            if (snapshot == null || panel == null) return;
            this.snapshot = snapshot;
            if (selectedGroup != null)
            {
                selectedGroup = FindGroup(selectedGroup.id)
                    ?? FindFirstActiveGroup();
            }
            else
            {
                selectedGroup = FindFirstActiveGroup();
            }
            Render();
        }

        public void Dispose()
        {
            if (panel != null)
            {
                UnityEngine.Object.Destroy(panel);
                panel = null;
            }

            snapshot = null;
            selectedGroup = null;
            updateTitle = null;
            applySnapshot = null;
            setParentStatus = null;
            openCreatePanel = null;
            onClosed = null;
            groupListObject = null;
            titleInput = null;
            saveButton = null;
            selectedGroupText = null;
            statusText = null;
        }

        private void Render()
        {
            RenderGroupList();
            if (selectedGroupText != null)
            {
                selectedGroupText.text = selectedGroup == null
                    ? "尚未有可編輯的一般冒險。"
                    : "目前選取：" + GetChildName(selectedGroup.child_profile_id);
            }
            if (titleInput != null)
            {
                titleInput.text = selectedGroup == null
                    ? string.Empty
                    : selectedGroup.title ?? string.Empty;
                titleInput.interactable = selectedGroup != null;
            }
            if (saveButton != null)
            {
                saveButton.interactable = selectedGroup != null
                    && updateTitle != null;
            }
            SetStatus(
                selectedGroup == null
                    ? "建立一般冒險後，這裡會顯示目前名稱。"
                    : "可修改目前一般冒險名稱，任務紀錄不會被重寫。",
                false);
        }

        private void RenderGroupList()
        {
            if (groupListObject == null) return;
            for (int index = groupListObject.transform.childCount - 1;
                index >= 0;
                index -= 1)
            {
                UnityEngine.Object.Destroy(
                    groupListObject.transform.GetChild(index).gameObject);
            }

            SupabaseParentAdventureGroupRecord[] groups =
                snapshot == null
                    ? null
                    : snapshot.adventureGroups;
            int count = 0;
            foreach (SupabaseParentAdventureGroupRecord group in
                groups ?? new SupabaseParentAdventureGroupRecord[0])
            {
                if (group == null
                    || group.status != "active"
                    || string.IsNullOrWhiteSpace(group.id)
                    || count >= 6)
                {
                    continue;
                }

                GameObject row = HabitHeroUiFactory.CreatePanel(
                    groupListObject.transform,
                    new Color(0.035f, 0.06f, 0.1f, 0.9f),
                    "GeneralAdventureGroupRow");
                row.AddComponent<LayoutElement>().preferredHeight = 46f;
                HabitHeroUiFactory.CreateText(
                    row.transform,
                    font,
                    GetChildName(group.child_profile_id) + " · "
                        + (string.IsNullOrWhiteSpace(group.title)
                            ? "一般冒險"
                            : group.title),
                    15,
                    TextAnchor.MiddleLeft,
                    Color.white,
                    new Vector2(0.04f, 0.08f),
                    new Vector2(0.7f, 0.92f));
                Button selectButton = HabitHeroUiFactory.CreateButton(
                    row.transform,
                    font,
                    "編輯",
                    new Vector2(0.74f, 0.12f),
                    new Vector2(0.96f, 0.88f));
                string groupId = group.id;
                selectButton.onClick.AddListener(() => SelectGroup(groupId));
                count += 1;
            }

            if (count == 0)
            {
                HabitHeroUiFactory.CreateText(
                    groupListObject.transform,
                    font,
                    "目前沒有進行中的一般冒險。",
                    16,
                    TextAnchor.MiddleCenter,
                    new Color(0.84f, 0.89f, 0.96f, 1f),
                    Vector2.zero,
                    Vector2.one).gameObject.AddComponent<LayoutElement>()
                    .preferredHeight = 46f;
            }
        }

        private void SelectGroup(string groupId)
        {
            selectedGroup = FindGroup(groupId);
            Render();
        }

        private async void HandleSave()
        {
            if (selectedGroup == null || updateTitle == null) return;
            string title = titleInput == null || titleInput.text == null
                ? string.Empty
                : titleInput.text.Trim();
            if (title.Length < 1 || title.Length > 120)
            {
                SetStatus("冒險名稱必須介於 1 到 120 個字元。", true);
                return;
            }

            if (saveButton != null) saveButton.interactable = false;
            SetStatus("正在更新一般冒險名稱…", false);
            try
            {
                SupabaseParentAdventureTitleMutationResult result =
                    await updateTitle(selectedGroup.child_profile_id, title);
                if (result == null || result.Group == null)
                {
                    throw new SupabaseDataException("Supabase 沒有回傳更新後的冒險群組。");
                }

                selectedGroup = result.Group;
                if (result.RefreshedSnapshot != null)
                {
                    snapshot = result.RefreshedSnapshot;
                    if (applySnapshot != null) applySnapshot(snapshot);
                }
                else if (snapshot != null && snapshot.adventureGroups != null)
                {
                    for (int index = 0; index < snapshot.adventureGroups.Length; index += 1)
                    {
                        if (snapshot.adventureGroups[index] != null
                            && snapshot.adventureGroups[index].id == result.Group.id)
                        {
                            snapshot.adventureGroups[index] = result.Group;
                            break;
                        }
                    }
                    if (applySnapshot != null) applySnapshot(snapshot);
                }

                SetStatus(
                    string.IsNullOrWhiteSpace(result.RefreshError)
                        ? "一般冒險名稱已更新。"
                        : "名稱已更新，但家庭資料刷新失敗，請稍後重試。",
                    !string.IsNullOrWhiteSpace(result.RefreshError));
                if (setParentStatus != null && !string.IsNullOrWhiteSpace(result.RefreshError))
                {
                    setParentStatus("一般冒險名稱已更新，但刷新失敗：" + result.RefreshError, true);
                }
            }
            catch (Exception exception)
            {
                SetStatus("更新一般冒險名稱失敗：" + exception.Message, true);
            }
            finally
            {
                if (saveButton != null) saveButton.interactable = selectedGroup != null;
            }
        }

        private SupabaseParentAdventureGroupRecord FindFirstActiveGroup()
        {
            foreach (SupabaseParentAdventureGroupRecord group in
                snapshot == null
                    ? new SupabaseParentAdventureGroupRecord[0]
                    : snapshot.adventureGroups
                        ?? new SupabaseParentAdventureGroupRecord[0])
            {
                if (group != null && group.status == "active") return group;
            }
            return null;
        }

        private SupabaseParentAdventureGroupRecord FindGroup(string groupId)
        {
            if (string.IsNullOrWhiteSpace(groupId) || snapshot == null) return null;
            foreach (SupabaseParentAdventureGroupRecord group in
                snapshot.adventureGroups
                    ?? new SupabaseParentAdventureGroupRecord[0])
            {
                if (group != null && group.id == groupId && group.status == "active")
                {
                    return group;
                }
            }
            return null;
        }

        private string GetChildName(string childId)
        {
            foreach (SupabaseChildProfileRecord child in
                snapshot == null
                    ? new SupabaseChildProfileRecord[0]
                    : snapshot.children ?? new SupabaseChildProfileRecord[0])
            {
                if (child != null && child.id == childId)
                {
                    return string.IsNullOrWhiteSpace(child.display_name)
                        ? "孩子"
                        : child.display_name;
                }
            }
            return "孩子";
        }

        private void SetStatus(string message, bool isError)
        {
            if (statusText == null) return;
            statusText.text = message;
            statusText.color = isError
                ? new Color(1f, 0.52f, 0.52f, 1f)
                : new Color(0.84f, 0.89f, 0.96f, 1f);
        }

        private void Close()
        {
            Action closed = onClosed;
            Dispose();
            if (closed != null) closed();
        }

        private static GameObject CreateVerticalList(
            Transform parent,
            string objectName,
            Vector2 anchorMin,
            Vector2 anchorMax)
        {
            GameObject list = new GameObject(
                objectName,
                typeof(RectTransform),
                typeof(VerticalLayoutGroup));
            list.transform.SetParent(parent, false);
            RectTransform rect = list.GetComponent<RectTransform>();
            rect.anchorMin = anchorMin;
            rect.anchorMax = anchorMax;
            rect.offsetMin = Vector2.zero;
            rect.offsetMax = Vector2.zero;
            VerticalLayoutGroup layout = list.GetComponent<VerticalLayoutGroup>();
            layout.spacing = 6f;
            layout.childControlWidth = true;
            layout.childControlHeight = true;
            layout.childForceExpandWidth = true;
            layout.childForceExpandHeight = false;
            return list;
        }
    }
}
