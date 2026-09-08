using System;
using System.Collections.Generic;
using System.Globalization;
using System.Threading.Tasks;
using HabitHero.Platform;
using UnityEngine;
using UnityEngine.UI;

namespace HabitHero.App
{
    public sealed class HabitHeroParentTaskTemplateView
    {
        private static readonly string[] CategoryValues =
        {
            "life_habit",
            "learning",
            "health",
            "relationship",
            "family_contribution",
            "creativity",
        };

        private static readonly string[] CategoryLabels =
        {
            "生活習慣",
            "學習",
            "健康",
            "關係",
            "家庭貢獻",
            "創意",
        };

        private readonly Transform canvasTransform;
        private readonly Font font;
        private GameObject panel;
        private GameObject editorPanel;
        private GameObject templateListObject;
        private SupabaseParentHomeSnapshot snapshot;
        private SupabaseParentTaskTemplateRecord editingTemplate;
        private readonly HashSet<string> selectedChildIds =
            new HashSet<string>(StringComparer.Ordinal);
        private bool assigning;
        private string pendingDeleteTemplateId;

        private Func<
            SupabaseParentTaskTemplateCreateInput,
            Task<SupabaseParentTaskTemplateMutationResult>> createTemplate;
        private Func<
            string,
            SupabaseParentTaskTemplateUpdateInput,
            Task<SupabaseParentTaskTemplateMutationResult>> updateTemplate;
        private Func<
            string,
            Task<SupabaseParentTaskTemplateMutationResult>> deleteTemplate;
        private Func<
            SupabaseParentTaskCreateInput,
            Task<SupabaseParentTaskMutationResult>> createTask;
        private Action<SupabaseParentHomeSnapshot> applySnapshot;
        private Action<string, bool> setParentStatus;
        private Action onClosed;

        private Text statusText;
        private Text editorStatusText;
        private Text selectedChildText;
        private InputField nameInput;
        private InputField pointsInput;
        private InputField durationInput;
        private InputField dueTimeInput;
        private InputField endTimeInput;
        private Dropdown categoryDropdown;
        private Toggle dailyToggle;
        private Button saveButton;

        public HabitHeroParentTaskTemplateView(Transform canvasTransform, Font font)
        {
            if (canvasTransform == null) throw new ArgumentNullException("canvasTransform");
            if (font == null) throw new ArgumentNullException("font");
            this.canvasTransform = canvasTransform;
            this.font = font;
        }

        public void Show(
            SupabaseParentHomeSnapshot snapshot,
            Func<
                SupabaseParentTaskTemplateCreateInput,
                Task<SupabaseParentTaskTemplateMutationResult>> createTemplate,
            Func<
                string,
                SupabaseParentTaskTemplateUpdateInput,
                Task<SupabaseParentTaskTemplateMutationResult>> updateTemplate,
            Func<string, Task<SupabaseParentTaskTemplateMutationResult>> deleteTemplate,
            Func<
                SupabaseParentTaskCreateInput,
                Task<SupabaseParentTaskMutationResult>> createTask,
            Action<SupabaseParentHomeSnapshot> applySnapshot,
            Action<string, bool> setParentStatus,
            Action onClosed)
        {
            if (snapshot == null) throw new ArgumentNullException("snapshot");
            Dispose();
            this.snapshot = snapshot;
            this.createTemplate = createTemplate;
            this.updateTemplate = updateTemplate;
            this.deleteTemplate = deleteTemplate;
            this.createTask = createTask;
            this.applySnapshot = applySnapshot;
            this.setParentStatus = setParentStatus;
            this.onClosed = onClosed;

            panel = HabitHeroUiFactory.CreatePanel(
                canvasTransform,
                new Color(0.02f, 0.035f, 0.06f, 0.86f),
                "ParentTaskTemplatePanel");
            GameObject card = HabitHeroUiFactory.CreatePanel(
                panel.transform,
                HabitHeroUiFactory.PanelColor,
                "ParentTaskTemplateCard");
            RectTransform cardRect = card.GetComponent<RectTransform>();
            cardRect.anchorMin = new Vector2(0.08f, 0.08f);
            cardRect.anchorMax = new Vector2(0.92f, 0.92f);
            cardRect.offsetMin = Vector2.zero;
            cardRect.offsetMax = Vector2.zero;

            HabitHeroUiFactory.CreateText(
                card.transform,
                font,
                "常用任務模板",
                32,
                TextAnchor.MiddleCenter,
                HabitHeroUiFactory.AccentColor,
                new Vector2(0.08f, 0.9f),
                new Vector2(0.58f, 0.97f));
            Button addButton = HabitHeroUiFactory.CreateButton(
                card.transform,
                font,
                "新增模板",
                new Vector2(0.62f, 0.89f),
                new Vector2(0.92f, 0.97f));
            addButton.onClick.AddListener(() => OpenEditor(null, false));

            templateListObject = CreateVerticalList(
                card.transform,
                "ParentTaskTemplateList",
                new Vector2(0.08f, 0.18f),
                new Vector2(0.92f, 0.87f));
            statusText = HabitHeroUiFactory.CreateText(
                card.transform,
                font,
                "模板會沿用目前家庭的 Supabase 資料。",
                15,
                TextAnchor.MiddleCenter,
                new Color(0.84f, 0.89f, 0.96f, 1f),
                new Vector2(0.08f, 0.11f),
                new Vector2(0.92f, 0.17f));
            Button closeButton = HabitHeroUiFactory.CreateButton(
                card.transform,
                font,
                "關閉",
                new Vector2(0.35f, 0.03f),
                new Vector2(0.65f, 0.1f));
            closeButton.onClick.AddListener(Close);
            RenderList();
        }

        public void ApplySnapshot(SupabaseParentHomeSnapshot snapshot)
        {
            if (snapshot == null) return;
            if (snapshot.taskTemplates == null && this.snapshot != null)
            {
                snapshot.taskTemplates = this.snapshot.taskTemplates;
            }

            this.snapshot = snapshot;
            if (templateListObject != null) RenderList();
        }

        public void Dispose()
        {
            if (panel != null)
            {
                UnityEngine.Object.Destroy(panel);
                panel = null;
            }

            if (editorPanel != null)
            {
                UnityEngine.Object.Destroy(editorPanel);
                editorPanel = null;
            }

            snapshot = null;
            editingTemplate = null;
            selectedChildIds.Clear();
            pendingDeleteTemplateId = null;
            createTemplate = null;
            updateTemplate = null;
            deleteTemplate = null;
            createTask = null;
            applySnapshot = null;
            setParentStatus = null;
            onClosed = null;
            templateListObject = null;
            statusText = null;
            editorStatusText = null;
            selectedChildText = null;
            nameInput = null;
            pointsInput = null;
            durationInput = null;
            dueTimeInput = null;
            endTimeInput = null;
            categoryDropdown = null;
            dailyToggle = null;
            saveButton = null;
        }

        private void RenderList()
        {
            if (templateListObject == null) return;
            foreach (Transform child in templateListObject.transform)
            {
                UnityEngine.Object.Destroy(child.gameObject);
            }

            SupabaseParentTaskTemplateRecord[] templates = snapshot == null
                ? new SupabaseParentTaskTemplateRecord[0]
                : snapshot.taskTemplates ?? new SupabaseParentTaskTemplateRecord[0];
            foreach (SupabaseParentTaskTemplateRecord template in templates)
            {
                if (template == null) continue;
                CreateTemplateRow(template);
            }

            if (templates.Length == 0)
            {
                HabitHeroUiFactory.CreateText(
                    templateListObject.transform,
                    font,
                    "目前沒有模板，點選右上角新增。",
                    20,
                    TextAnchor.MiddleCenter,
                    new Color(0.84f, 0.89f, 0.96f, 1f),
                    Vector2.zero,
                    Vector2.one);
            }
        }

        private void CreateTemplateRow(SupabaseParentTaskTemplateRecord template)
        {
            GameObject row = new GameObject(
                "TaskTemplateRow",
                typeof(RectTransform),
                typeof(Image),
                typeof(HorizontalLayoutGroup),
                typeof(LayoutElement));
            row.transform.SetParent(templateListObject.transform, false);
            Image rowImage = row.GetComponent<Image>();
            rowImage.color = new Color(1f, 1f, 1f, 0.06f);
            LayoutElement rowElement = row.GetComponent<LayoutElement>();
            rowElement.minHeight = 62f;
            rowElement.preferredHeight = 62f;
            HorizontalLayoutGroup layout = row.GetComponent<HorizontalLayoutGroup>();
            layout.spacing = 6f;
            layout.padding = new RectOffset(10, 10, 6, 6);
            layout.childControlWidth = true;
            layout.childControlHeight = true;
            layout.childForceExpandWidth = false;
            layout.childForceExpandHeight = true;

            Text label = HabitHeroUiFactory.CreateText(
                row.transform,
                font,
                BuildTemplateLabel(template),
                16,
                TextAnchor.MiddleLeft,
                Color.white,
                Vector2.zero,
                Vector2.one);
            LayoutElement labelElement = label.gameObject.AddComponent<LayoutElement>();
            labelElement.flexibleWidth = 1f;
            labelElement.minWidth = 120f;

            Button assignButton = CreateRowButton(row.transform, "派發", 76f);
            assignButton.onClick.AddListener(() => OpenEditor(template, true));
            Button editButton = CreateRowButton(row.transform, "編輯", 76f);
            editButton.onClick.AddListener(() => OpenEditor(template, false));
            Button deleteButton = CreateRowButton(row.transform, "刪除", 76f);
            deleteButton.onClick.AddListener(() => HandleDelete(template));
        }

        private Button CreateRowButton(Transform parent, string label, float width)
        {
            Button button = HabitHeroUiFactory.CreateButton(
                parent,
                font,
                label,
                Vector2.zero,
                Vector2.one);
            LayoutElement element = button.gameObject.AddComponent<LayoutElement>();
            element.minWidth = width;
            element.preferredWidth = width;
            element.minHeight = 46f;
            element.preferredHeight = 46f;
            return button;
        }

        private void HandleDelete(SupabaseParentTaskTemplateRecord template)
        {
            if (template == null || deleteTemplate == null) return;
            if (pendingDeleteTemplateId != template.id)
            {
                pendingDeleteTemplateId = template.id;
                SetStatus("再次點擊才會刪除「" + template.name + "」。", true);
                return;
            }

            pendingDeleteTemplateId = null;
            DeleteAsync(template.id);
        }

        private async void DeleteAsync(string templateId)
        {
            try
            {
                SetStatus("正在刪除模板…", false);
                SupabaseParentTaskTemplateMutationResult result =
                    await deleteTemplate(templateId);
                if (result == null || !result.Deleted)
                {
                    SetStatus("刪除模板回應無效，請稍後再試。", true);
                    return;
                }

                ApplyMutationSnapshot(result.RefreshedSnapshot);
                SetStatus(
                    string.IsNullOrWhiteSpace(result.RefreshError)
                        ? "模板已刪除。"
                        : "模板已刪除；最新資料稍後會自動更新。",
                    false);
            }
            catch (Exception exception)
            {
                SetStatus("刪除模板失敗：" + exception.Message, true);
            }
        }

        private void OpenEditor(
            SupabaseParentTaskTemplateRecord template,
            bool assignTemplate)
        {
            if (assignTemplate && (snapshot == null
                || snapshot.children == null
                || snapshot.children.Length == 0
                || createTask == null))
            {
                SetStatus("目前沒有可派發的孩子帳號。", true);
                return;
            }

            if (!assignTemplate && (createTemplate == null || updateTemplate == null))
            {
                SetStatus("模板功能尚未連線。", true);
                return;
            }

            CloseEditor();
            editingTemplate = template;
            assigning = assignTemplate;
            selectedChildIds.Clear();
            if (assignTemplate)
            {
                foreach (SupabaseChildProfileRecord child in snapshot.children)
                {
                    if (child != null && !string.IsNullOrWhiteSpace(child.id))
                    {
                        selectedChildIds.Add(child.id);
                    }
                }
            }

            editorPanel = HabitHeroUiFactory.CreatePanel(
                panel.transform,
                new Color(0.02f, 0.035f, 0.06f, 0.94f),
                "ParentTaskTemplateEditorPanel");
            GameObject card = HabitHeroUiFactory.CreatePanel(
                editorPanel.transform,
                HabitHeroUiFactory.PanelColor,
                "ParentTaskTemplateEditorCard");
            RectTransform cardRect = card.GetComponent<RectTransform>();
            cardRect.anchorMin = new Vector2(0.08f, 0.06f);
            cardRect.anchorMax = new Vector2(0.92f, 0.94f);
            cardRect.offsetMin = Vector2.zero;
            cardRect.offsetMax = Vector2.zero;

            HabitHeroUiFactory.CreateText(
                card.transform,
                font,
                assigning ? "派發任務模板" : (template == null ? "新增任務模板" : "編輯任務模板"),
                30,
                TextAnchor.MiddleCenter,
                HabitHeroUiFactory.AccentColor,
                new Vector2(0.08f, 0.89f),
                new Vector2(0.92f, 0.97f));
            CreateEditorLabel(card.transform, "名稱", 0.79f, 0.85f);
            nameInput = CreateEditorInput(card.transform, "例如：整理書包", 0.72f, 0.79f);
            CreateEditorLabel(card.transform, "點數", 0.64f, 0.7f);
            pointsInput = CreateEditorInput(card.transform, "例如：10", 0.57f, 0.64f);
            pointsInput.contentType = InputField.ContentType.IntegerNumber;
            CreateEditorLabel(card.transform, "計時分鐘（選填）", 0.49f, 0.55f);
            durationInput = CreateEditorInput(card.transform, "例如：15", 0.42f, 0.49f);
            durationInput.contentType = InputField.ContentType.IntegerNumber;
            CreateEditorLabel(card.transform, "分類", 0.34f, 0.4f);
            categoryDropdown = CreateCategoryDropdown(card.transform, 0.27f, 0.34f);
            CreateEditorLabel(card.transform, "開始／結束時間（選填）", 0.19f, 0.25f);
            dueTimeInput = CreateEditorInput(card.transform, "18:00", 0.12f, 0.18f);
            endTimeInput = CreateEditorInput(card.transform, "19:00", 0.05f, 0.11f);

            if (assigning)
            {
                selectedChildText = HabitHeroUiFactory.CreateText(
                    card.transform,
                    font,
                    string.Empty,
                    15,
                    TextAnchor.MiddleRight,
                    new Color(0.84f, 0.89f, 0.96f, 1f),
                    new Vector2(0.42f, 0.79f),
                    new Vector2(0.92f, 0.85f));
                CreateChildSelectionList(card.transform);
                dailyToggle = CreateOptionToggle(
                    card.transform,
                    "設為每日任務",
                    new Vector2(0.08f, 0.03f),
                    new Vector2(0.45f, 0.1f));
            }

            PopulateEditor(template);
            saveButton = HabitHeroUiFactory.CreateButton(
                card.transform,
                font,
                assigning ? "派發" : "儲存",
                new Vector2(0.52f, 0.03f),
                new Vector2(0.76f, 0.1f));
            saveButton.onClick.AddListener(HandleSave);
            Button cancelButton = HabitHeroUiFactory.CreateButton(
                card.transform,
                font,
                "取消",
                new Vector2(0.78f, 0.03f),
                new Vector2(0.92f, 0.1f));
            cancelButton.onClick.AddListener(CloseEditor);
            editorStatusText = HabitHeroUiFactory.CreateText(
                card.transform,
                font,
                string.Empty,
                14,
                TextAnchor.MiddleCenter,
                new Color(0.84f, 0.89f, 0.96f, 1f),
                new Vector2(0.08f, 0.11f),
                new Vector2(0.92f, 0.15f));
            UpdateSelectedChildText();
        }

        private void PopulateEditor(SupabaseParentTaskTemplateRecord template)
        {
            if (template == null) return;
            if (nameInput != null) nameInput.text = template.name ?? string.Empty;
            if (pointsInput != null)
            {
                pointsInput.text = template.points.ToString(CultureInfo.InvariantCulture);
            }
            if (durationInput != null && template.duration_minutes > 0)
            {
                durationInput.text = template.duration_minutes.ToString(CultureInfo.InvariantCulture);
            }
            if (dueTimeInput != null) dueTimeInput.text = TrimTime(template.due_time);
            if (endTimeInput != null) endTimeInput.text = TrimTime(template.end_time);
            if (categoryDropdown != null)
            {
                categoryDropdown.value = GetCategoryIndex(template.category);
            }
        }

        private async void HandleSave()
        {
            if (saveButton != null) saveButton.interactable = false;
            try
            {
                string name = nameInput == null ? string.Empty : nameInput.text.Trim();
                string pointsText = pointsInput == null ? string.Empty : pointsInput.text.Trim();
                string durationText = durationInput == null ? string.Empty : durationInput.text.Trim();
                int points;
                if (name.Length < 1 || name.Length > 120)
                {
                    SetEditorStatus("名稱必須介於 1 到 120 個字元。", true);
                    return;
                }
                if (!int.TryParse(pointsText, NumberStyles.Integer, CultureInfo.InvariantCulture, out points)
                    || points <= 0)
                {
                    SetEditorStatus("點數必須是大於 0 的整數。", true);
                    return;
                }

                int duration;
                int? durationMinutes = null;
                if (!string.IsNullOrWhiteSpace(durationText))
                {
                    if (!int.TryParse(durationText, NumberStyles.Integer, CultureInfo.InvariantCulture, out duration)
                        || duration <= 0
                        || duration > 1440)
                    {
                        SetEditorStatus("計時分鐘必須介於 1 到 1440。", true);
                        return;
                    }

                    durationMinutes = duration;
                }

                string dueTime = NormalizeTime(dueTimeInput == null ? string.Empty : dueTimeInput.text);
                string endTime = NormalizeTime(endTimeInput == null ? string.Empty : endTimeInput.text);
                if (!ValidateTimeWindow(dueTime, endTime)) return;
                string category = GetSelectedCategory();

                if (assigning)
                {
                    if (selectedChildIds.Count == 0 || editingTemplate == null)
                    {
                        SetEditorStatus("請至少選擇一位孩子。", true);
                        return;
                    }

                    SetEditorStatus("正在派發模板…", false);
                    SupabaseParentTaskMutationResult latestResult = null;
                    foreach (string childProfileId in selectedChildIds)
                    {
                        latestResult = await createTask(
                            new SupabaseParentTaskCreateInput
                            {
                                childProfileId = childProfileId,
                                name = editingTemplate.name,
                                points = editingTemplate.points,
                                icon = string.IsNullOrWhiteSpace(editingTemplate.icon)
                                    ? "Star"
                                    : editingTemplate.icon,
                                durationMinutes = editingTemplate.duration_minutes > 0
                                    ? editingTemplate.duration_minutes
                                    : (int?)null,
                                isDaily = dailyToggle != null && dailyToggle.isOn,
                                dueTime = dueTime,
                                endTime = endTime,
                                category = category,
                                origin = "system_template",
                                requiresReviewBeforeNextTask = false,
                            });
                    }

                    if (latestResult != null)
                    {
                        ApplyMutationSnapshot(latestResult.RefreshedSnapshot);
                    }
                    CloseEditor();
                    SetStatus("模板已派發給選取的孩子。", false);
                    return;
                }

                SetEditorStatus("正在儲存模板…", false);
                SupabaseParentTaskTemplateMutationResult result;
                if (editingTemplate == null)
                {
                    result = await createTemplate(
                        new SupabaseParentTaskTemplateCreateInput
                        {
                            name = name,
                            points = points,
                            icon = "Star",
                            durationMinutes = durationMinutes,
                            category = category,
                            suggestedEvidence = "reflection",
                            dueTime = dueTime,
                            endTime = endTime,
                            requiresReviewBeforeNextTask = false,
                        });
                }
                else
                {
                    result = await updateTemplate(
                        editingTemplate.id,
                        new SupabaseParentTaskTemplateUpdateInput
                        {
                            name = name,
                            points = points,
                            icon = string.IsNullOrWhiteSpace(editingTemplate.icon)
                                ? "Star"
                                : editingTemplate.icon,
                            durationMinutes = durationMinutes,
                            category = category,
                            suggestedEvidence = string.IsNullOrWhiteSpace(editingTemplate.suggested_evidence)
                                ? "reflection"
                                : editingTemplate.suggested_evidence,
                            dueTime = dueTime,
                            endTime = endTime,
                            requiresReviewBeforeNextTask = false,
                        });
                }

                if (result == null || (!result.Created && !result.Updated))
                {
                    SetEditorStatus("儲存模板回應無效，請稍後再試。", true);
                    return;
                }

                ApplyMutationSnapshot(result.RefreshedSnapshot);
                CloseEditor();
                SetStatus(
                    string.IsNullOrWhiteSpace(result.RefreshError)
                        ? "模板已儲存。"
                        : "模板已儲存；最新資料稍後會自動更新。",
                    false);
            }
            catch (Exception exception)
            {
                SetEditorStatus("儲存失敗：" + exception.Message, true);
            }
            finally
            {
                if (saveButton != null) saveButton.interactable = true;
            }
        }

        private void ApplyMutationSnapshot(SupabaseParentHomeSnapshot nextSnapshot)
        {
            if (nextSnapshot == null) return;
            ApplySnapshot(nextSnapshot);
            if (applySnapshot != null) applySnapshot(nextSnapshot);
        }

        private void CloseEditor()
        {
            if (editorPanel != null)
            {
                UnityEngine.Object.Destroy(editorPanel);
                editorPanel = null;
            }

            editingTemplate = null;
            assigning = false;
            selectedChildIds.Clear();
            editorStatusText = null;
            selectedChildText = null;
            nameInput = null;
            pointsInput = null;
            durationInput = null;
            dueTimeInput = null;
            endTimeInput = null;
            categoryDropdown = null;
            dailyToggle = null;
            saveButton = null;
        }

        private void Close()
        {
            Action closed = onClosed;
            Dispose();
            if (closed != null) closed();
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
            if (setParentStatus != null) setParentStatus(message, isError);
        }

        private void SetEditorStatus(string message, bool isError)
        {
            if (editorStatusText != null)
            {
                editorStatusText.text = message;
                editorStatusText.color = isError
                    ? new Color(1f, 0.52f, 0.52f, 1f)
                    : new Color(0.84f, 0.89f, 0.96f, 1f);
            }
            else
            {
                SetStatus(message, isError);
            }
        }

        private void CreateEditorLabel(
            Transform parent,
            string label,
            float minY,
            float maxY)
        {
            HabitHeroUiFactory.CreateText(
                parent,
                font,
                label,
                16,
                TextAnchor.MiddleLeft,
                Color.white,
                new Vector2(0.08f, minY),
                new Vector2(0.4f, maxY));
        }

        private InputField CreateEditorInput(
            Transform parent,
            string placeholder,
            float minY,
            float maxY)
        {
            InputField input = HabitHeroUiFactory.CreateInput(
                parent,
                font,
                placeholder,
                false,
                new Vector2(0.42f, minY),
                new Vector2(0.92f, maxY));
            input.contentType = InputField.ContentType.Standard;
            input.lineType = InputField.LineType.SingleLine;
            return input;
        }

        private Dropdown CreateCategoryDropdown(
            Transform parent,
            float minY,
            float maxY)
        {
            GameObject dropdownObject = new GameObject(
                "TaskTemplateCategory",
                typeof(RectTransform),
                typeof(Image),
                typeof(Dropdown));
            dropdownObject.transform.SetParent(parent, false);
            RectTransform rect = dropdownObject.GetComponent<RectTransform>();
            rect.anchorMin = new Vector2(0.42f, minY);
            rect.anchorMax = new Vector2(0.92f, maxY);
            rect.offsetMin = Vector2.zero;
            rect.offsetMax = Vector2.zero;
            dropdownObject.GetComponent<Image>().color = new Color(1f, 1f, 1f, 0.1f);
            Dropdown dropdown = dropdownObject.GetComponent<Dropdown>();
            dropdown.captionText = HabitHeroUiFactory.CreateText(
                dropdownObject.transform,
                font,
                CategoryLabels[0],
                18,
                TextAnchor.MiddleLeft,
                Color.white,
                new Vector2(0.05f, 0f),
                new Vector2(0.95f, 1f));
            dropdown.options = new List<Dropdown.OptionData>();
            foreach (string label in CategoryLabels)
            {
                dropdown.options.Add(new Dropdown.OptionData(label));
            }
            dropdown.value = 0;
            return dropdown;
        }

        private void CreateChildSelectionList(Transform parent)
        {
            GameObject list = CreateVerticalList(
                parent,
                "TaskTemplateChildSelectionList",
                new Vector2(0.08f, 0.36f),
                new Vector2(0.38f, 0.78f));
            foreach (SupabaseChildProfileRecord child in
                snapshot.children ?? new SupabaseChildProfileRecord[0])
            {
                if (child == null || string.IsNullOrWhiteSpace(child.id)) continue;
                Toggle toggle = CreateChildToggle(list.transform, child);
                toggle.onValueChanged.AddListener(value =>
                {
                    if (value) selectedChildIds.Add(child.id);
                    else selectedChildIds.Remove(child.id);
                    UpdateSelectedChildText();
                });
            }
        }

        private Toggle CreateChildToggle(
            Transform parent,
            SupabaseChildProfileRecord child)
        {
            GameObject toggleObject = new GameObject(
                "TaskTemplateChildToggle",
                typeof(RectTransform),
                typeof(Toggle),
                typeof(LayoutElement));
            toggleObject.transform.SetParent(parent, false);
            LayoutElement layoutElement = toggleObject.GetComponent<LayoutElement>();
            layoutElement.minHeight = 40f;
            layoutElement.preferredHeight = 40f;
            Toggle toggle = toggleObject.GetComponent<Toggle>();
            GameObject backgroundObject = new GameObject(
                "Background",
                typeof(RectTransform),
                typeof(Image));
            backgroundObject.transform.SetParent(toggleObject.transform, false);
            RectTransform backgroundRect = backgroundObject.GetComponent<RectTransform>();
            backgroundRect.anchorMin = new Vector2(0f, 0.15f);
            backgroundRect.anchorMax = new Vector2(0f, 0.85f);
            backgroundRect.sizeDelta = new Vector2(28f, 0f);
            backgroundRect.anchoredPosition = new Vector2(14f, 0f);
            Image background = backgroundObject.GetComponent<Image>();
            background.color = new Color(1f, 1f, 1f, 0.18f);
            GameObject checkObject = new GameObject(
                "Checkmark",
                typeof(RectTransform),
                typeof(Image));
            checkObject.transform.SetParent(backgroundObject.transform, false);
            RectTransform checkRect = checkObject.GetComponent<RectTransform>();
            checkRect.anchorMin = new Vector2(0.15f, 0.15f);
            checkRect.anchorMax = new Vector2(0.85f, 0.85f);
            checkRect.offsetMin = Vector2.zero;
            checkRect.offsetMax = Vector2.zero;
            checkObject.GetComponent<Image>().color = HabitHeroUiFactory.AccentColor;
            HabitHeroUiFactory.CreateText(
                toggleObject.transform,
                font,
                GetChildName(child.id),
                16,
                TextAnchor.MiddleLeft,
                Color.white,
                new Vector2(0.12f, 0f),
                new Vector2(1f, 1f));
            toggle.targetGraphic = background;
            toggle.graphic = checkObject.GetComponent<Image>();
            toggle.isOn = selectedChildIds.Contains(child.id);
            return toggle;
        }

        private Toggle CreateOptionToggle(
            Transform parent,
            string label,
            Vector2 anchorMin,
            Vector2 anchorMax)
        {
            Toggle toggle = HabitHeroUiFactory.CreateSwitch(parent, anchorMin, anchorMax);
            HabitHeroUiFactory.CreateText(
                toggle.transform,
                font,
                label,
                16,
                TextAnchor.MiddleLeft,
                Color.white,
                new Vector2(0f, 0f),
                new Vector2(0.82f, 1f));
            return toggle;
        }

        private void UpdateSelectedChildText()
        {
            if (selectedChildText == null) return;
            selectedChildText.text = "已選 " + selectedChildIds.Count + " 位孩子";
        }

        private string GetSelectedCategory()
        {
            int index = categoryDropdown == null ? 0 : categoryDropdown.value;
            if (index < 0 || index >= CategoryValues.Length) index = 0;
            return CategoryValues[index];
        }

        private static int GetCategoryIndex(string category)
        {
            for (int index = 0; index < CategoryValues.Length; index += 1)
            {
                if (CategoryValues[index] == category) return index;
            }

            return 0;
        }

        private static string BuildTemplateLabel(SupabaseParentTaskTemplateRecord template)
        {
            string duration = template.duration_minutes > 0
                ? "　" + template.duration_minutes + " 分鐘"
                : string.Empty;
            string times = string.IsNullOrWhiteSpace(template.due_time)
                ? string.Empty
                : "　" + TrimTime(template.due_time)
                    + (string.IsNullOrWhiteSpace(template.end_time)
                        ? string.Empty
                        : "–" + TrimTime(template.end_time));
            return (template.name ?? "未命名模板")
                + "　+" + template.points + " 點"
                + duration
                + times;
        }

        private static string TrimTime(string value)
        {
            if (string.IsNullOrWhiteSpace(value)) return string.Empty;
            return value.Length >= 5 ? value.Substring(0, 5) : value;
        }

        private static string NormalizeTime(string value)
        {
            return string.IsNullOrWhiteSpace(value) ? null : value.Trim();
        }

        private bool ValidateTimeWindow(string dueTime, string endTime)
        {
            if (string.IsNullOrWhiteSpace(dueTime) || string.IsNullOrWhiteSpace(endTime))
            {
                return true;
            }

            TimeSpan due;
            TimeSpan end;
            if (!TimeSpan.TryParse(dueTime, CultureInfo.InvariantCulture, out due)
                || !TimeSpan.TryParse(endTime, CultureInfo.InvariantCulture, out end))
            {
                SetEditorStatus("時間請使用 24 小時制，例如 18:00。", true);
                return false;
            }
            if (end <= due)
            {
                SetEditorStatus("結束時間必須晚於開始時間。", true);
                return false;
            }

            return true;
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
            layout.spacing = 8f;
            layout.childControlWidth = true;
            layout.childControlHeight = true;
            layout.childForceExpandWidth = true;
            layout.childForceExpandHeight = false;
            return list;
        }
    }
}
