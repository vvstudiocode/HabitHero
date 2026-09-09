using System;
using System.Threading.Tasks;
using HabitHero.Platform;
using UnityEngine;
using UnityEngine.UI;

namespace HabitHero.App
{
    public sealed class HabitHeroParentChildAccountView
    {
        private readonly Transform canvasTransform;
        private readonly Font font;
        private GameObject panel;
        private GameObject childListObject;
        private Text formTitle;
        private Text selectedChildText;
        private Text genderButtonLabel;
        private Text characterButtonLabel;
        private Text statusText;
        private InputField nameInput;
        private InputField loginInput;
        private InputField passwordInput;
        private InputField confirmationInput;
        private Button saveButton;
        private Button deleteButton;
        private Text deleteButtonLabel;
        private SupabaseParentHomeSnapshot snapshot;
        private string selectedChildId;
        private bool creatingNewChild;
        private bool deleteConfirm;
        private string selectedGender = "boy";
        private string selectedCharacterId = "character.arthur";
        private Func<
            SupabaseParentChildAccountCreateInput,
            Task<SupabaseParentChildAccountMutationResult>> createAccount;
        private Func<
            string,
            string,
            Task<SupabaseParentChildAccountMutationResult>> resetPassword;
        private Func<
            string,
            string,
            Task<SupabaseParentChildAccountMutationResult>> updateName;
        private Func<
            string,
            Task<SupabaseParentChildAccountMutationResult>> deleteAccount;
        private Action<SupabaseParentHomeSnapshot> applySnapshot;
        private Action<string, bool> setParentStatus;
        private Action onClosed;
        private bool parentConsentCurrent;

        private static readonly string[] CharacterIds =
        {
            "character.arthur",
            "character.elina",
            "character.sia",
            "character.elio",
        };

        public HabitHeroParentChildAccountView(Transform canvasTransform, Font font)
        {
            if (canvasTransform == null) throw new ArgumentNullException("canvasTransform");
            if (font == null) throw new ArgumentNullException("font");
            this.canvasTransform = canvasTransform;
            this.font = font;
        }

        public void Show(
            SupabaseParentHomeSnapshot snapshot,
            bool parentConsentCurrent,
            Func<
                SupabaseParentChildAccountCreateInput,
                Task<SupabaseParentChildAccountMutationResult>> createAccount,
            Func<
                string,
                string,
                Task<SupabaseParentChildAccountMutationResult>> resetPassword,
            Func<
                string,
                string,
                Task<SupabaseParentChildAccountMutationResult>> updateName,
            Func<
                string,
                Task<SupabaseParentChildAccountMutationResult>> deleteAccount,
            Action<SupabaseParentHomeSnapshot> applySnapshot,
            Action<string, bool> setParentStatus,
            Action onClosed)
        {
            if (snapshot == null) throw new ArgumentNullException("snapshot");
            if (createAccount == null) throw new ArgumentNullException("createAccount");
            if (resetPassword == null) throw new ArgumentNullException("resetPassword");
            if (updateName == null) throw new ArgumentNullException("updateName");
            if (deleteAccount == null) throw new ArgumentNullException("deleteAccount");

            Dispose();
            this.snapshot = snapshot;
            this.parentConsentCurrent = parentConsentCurrent;
            this.createAccount = createAccount;
            this.resetPassword = resetPassword;
            this.updateName = updateName;
            this.deleteAccount = deleteAccount;
            this.applySnapshot = applySnapshot;
            this.setParentStatus = setParentStatus;
            this.onClosed = onClosed;
            selectedChildId = FindFirstChildId();
            creatingNewChild = selectedChildId == null;

            panel = HabitHeroUiFactory.CreatePanel(
                canvasTransform,
                new Color(0.02f, 0.035f, 0.06f, 0.86f),
                "ParentChildAccountPanel");
            GameObject card = HabitHeroUiFactory.CreatePanel(
                panel.transform,
                HabitHeroUiFactory.PanelColor,
                "ParentChildAccountCard");
            RectTransform cardRect = card.GetComponent<RectTransform>();
            cardRect.anchorMin = new Vector2(0.06f, 0.03f);
            cardRect.anchorMax = new Vector2(0.94f, 0.97f);
            cardRect.offsetMin = Vector2.zero;
            cardRect.offsetMax = Vector2.zero;

            HabitHeroUiFactory.CreateText(
                card.transform,
                font,
                "管理孩子帳號",
                32,
                TextAnchor.MiddleCenter,
                HabitHeroUiFactory.AccentColor,
                new Vector2(0.08f, 0.91f),
                new Vector2(0.92f, 0.97f));
            Button newChildButton = HabitHeroUiFactory.CreateButton(
                card.transform,
                font,
                "新增孩子",
                new Vector2(0.62f, 0.84f),
                new Vector2(0.92f, 0.9f));
            newChildButton.onClick.AddListener(StartNewChild);
            HabitHeroUiFactory.CreateText(
                card.transform,
                font,
                "家庭孩子",
                18,
                TextAnchor.MiddleLeft,
                Color.white,
                new Vector2(0.08f, 0.85f),
                new Vector2(0.58f, 0.9f));
            childListObject = CreateVerticalList(
                card.transform,
                "ParentAccountChildList",
                new Vector2(0.08f, 0.67f),
                new Vector2(0.92f, 0.82f));
            RenderChildList();

            formTitle = HabitHeroUiFactory.CreateText(
                card.transform,
                font,
                string.Empty,
                19,
                TextAnchor.MiddleLeft,
                HabitHeroUiFactory.AccentColor,
                new Vector2(0.08f, 0.61f),
                new Vector2(0.92f, 0.66f));
            selectedChildText = HabitHeroUiFactory.CreateText(
                card.transform,
                font,
                string.Empty,
                15,
                TextAnchor.MiddleCenter,
                new Color(0.84f, 0.89f, 0.96f, 1f),
                new Vector2(0.08f, 0.56f),
                new Vector2(0.92f, 0.61f));
            nameInput = HabitHeroUiFactory.CreateInput(
                card.transform,
                font,
                "孩子名稱",
                false,
                new Vector2(0.08f, 0.49f),
                new Vector2(0.92f, 0.55f));
            nameInput.contentType = InputField.ContentType.Standard;
            nameInput.lineType = InputField.LineType.SingleLine;
            loginInput = HabitHeroUiFactory.CreateInput(
                card.transform,
                font,
                "登入名稱，例如 leo123",
                false,
                new Vector2(0.08f, 0.42f),
                new Vector2(0.92f, 0.48f));
            loginInput.contentType = InputField.ContentType.Standard;
            loginInput.lineType = InputField.LineType.SingleLine;
            passwordInput = HabitHeroUiFactory.CreateInput(
                card.transform,
                font,
                "新密碼（至少 6 碼英數）",
                true,
                new Vector2(0.08f, 0.35f),
                new Vector2(0.92f, 0.41f));
            passwordInput.contentType = InputField.ContentType.Password;
            passwordInput.lineType = InputField.LineType.SingleLine;
            confirmationInput = HabitHeroUiFactory.CreateInput(
                card.transform,
                font,
                "再次輸入密碼",
                true,
                new Vector2(0.08f, 0.28f),
                new Vector2(0.92f, 0.34f));
            confirmationInput.contentType = InputField.ContentType.Password;
            confirmationInput.lineType = InputField.LineType.SingleLine;

            Button genderButton = HabitHeroUiFactory.CreateButton(
                card.transform,
                font,
                string.Empty,
                new Vector2(0.08f, 0.21f),
                new Vector2(0.46f, 0.27f));
            genderButtonLabel = genderButton.GetComponentInChildren<Text>();
            genderButton.onClick.AddListener(ToggleGender);
            Button characterButton = HabitHeroUiFactory.CreateButton(
                card.transform,
                font,
                string.Empty,
                new Vector2(0.54f, 0.21f),
                new Vector2(0.92f, 0.27f));
            characterButtonLabel = characterButton.GetComponentInChildren<Text>();
            characterButton.onClick.AddListener(CycleCharacter);

            statusText = HabitHeroUiFactory.CreateText(
                card.transform,
                font,
                string.Empty,
                14,
                TextAnchor.MiddleCenter,
                new Color(0.84f, 0.89f, 0.96f, 1f),
                new Vector2(0.08f, 0.15f),
                new Vector2(0.92f, 0.2f));
            saveButton = HabitHeroUiFactory.CreateButton(
                card.transform,
                font,
                string.Empty,
                new Vector2(0.08f, 0.08f),
                new Vector2(0.46f, 0.14f));
            saveButton.onClick.AddListener(HandleSave);
            deleteButton = HabitHeroUiFactory.CreateButton(
                card.transform,
                font,
                "刪除登入帳號",
                new Vector2(0.54f, 0.08f),
                new Vector2(0.92f, 0.14f));
            deleteButtonLabel = deleteButton.GetComponentInChildren<Text>();
            deleteButton.onClick.AddListener(HandleDelete);
            Button closeButton = HabitHeroUiFactory.CreateButton(
                card.transform,
                font,
                "關閉",
                new Vector2(0.35f, 0.02f),
                new Vector2(0.65f, 0.07f));
            closeButton.onClick.AddListener(Close);
            RenderEditor();
        }

        public void Dispose()
        {
            if (panel != null)
            {
                UnityEngine.Object.Destroy(panel);
                panel = null;
            }

            snapshot = null;
            selectedChildId = null;
            creatingNewChild = false;
            deleteConfirm = false;
            createAccount = null;
            resetPassword = null;
            updateName = null;
            deleteAccount = null;
            applySnapshot = null;
            setParentStatus = null;
            onClosed = null;
            parentConsentCurrent = false;
            childListObject = null;
            formTitle = null;
            selectedChildText = null;
            genderButtonLabel = null;
            characterButtonLabel = null;
            statusText = null;
            nameInput = null;
            loginInput = null;
            passwordInput = null;
            confirmationInput = null;
            saveButton = null;
            deleteButton = null;
            deleteButtonLabel = null;
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
                    || visibleCount >= 5) continue;
                string accountStatus = string.IsNullOrWhiteSpace(child.profile_id)
                    ? "尚未建立登入帳號"
                    : "帳號：" + (string.IsNullOrWhiteSpace(child.login_name)
                        ? "已連結"
                        : child.login_name);
                Button childButton = HabitHeroUiFactory.CreateButton(
                    childListObject.transform,
                    font,
                    GetChildName(child) + "｜" + accountStatus,
                    Vector2.zero,
                    Vector2.one);
                childButton.GetComponent<RectTransform>().sizeDelta =
                    new Vector2(0f, 42f);
                childButton.onClick.AddListener(() => SelectChild(child));
                visibleCount += 1;
            }

            if (visibleCount == 0)
            {
                HabitHeroUiFactory.CreateText(
                    childListObject.transform,
                    font,
                    "目前沒有孩子，請使用右上角新增孩子。",
                    16,
                    TextAnchor.MiddleCenter,
                    new Color(0.84f, 0.89f, 0.96f, 1f),
                    Vector2.zero,
                    Vector2.one);
            }
        }

        private void SelectChild(SupabaseChildProfileRecord child)
        {
            if (child == null || string.IsNullOrWhiteSpace(child.id)) return;
            selectedChildId = child.id;
            creatingNewChild = false;
            deleteConfirm = false;
            RenderEditor();
        }

        private void StartNewChild()
        {
            selectedChildId = null;
            creatingNewChild = true;
            deleteConfirm = false;
            selectedGender = "boy";
            selectedCharacterId = "character.arthur";
            RenderEditor();
            SetStatus("請輸入新孩子的名稱、登入名稱與密碼。", false);
        }

        private void RenderEditor()
        {
            SupabaseChildProfileRecord child = FindChild(selectedChildId);
            bool hasAccount = !creatingNewChild
                && child != null
                && !string.IsNullOrWhiteSpace(child.profile_id);
            if (formTitle != null)
            {
                formTitle.text = creatingNewChild
                    ? "建立新的孩子帳號"
                    : "管理「" + GetChildName(child) + "」的帳號";
            }
            if (selectedChildText != null)
            {
                selectedChildText.text = creatingNewChild
                    ? "新增孩子會同時建立可登入的孩子帳號。"
                    : BuildSelectedChildMessage(child);
            }
            if (nameInput != null)
            {
                nameInput.text = creatingNewChild || child == null
                    ? string.Empty
                    : child.display_name;
                nameInput.interactable = true;
            }
            if (loginInput != null)
            {
                loginInput.text = creatingNewChild || child == null
                    ? string.Empty
                    : child.login_name;
                loginInput.interactable = !hasAccount;
            }
            if (passwordInput != null) passwordInput.text = string.Empty;
            if (confirmationInput != null) confirmationInput.text = string.Empty;
            if (genderButtonLabel != null)
            {
                genderButtonLabel.text = hasAccount
                    ? "已建立帳號"
                    : "性別：" + (selectedGender == "girl" ? "女孩" : "男孩");
            }
            if (characterButtonLabel != null)
            {
                characterButtonLabel.text = hasAccount
                    ? "人物不可變更"
                    : "人物：" + GetCharacterLabel(selectedCharacterId);
            }
            if (saveButton != null)
            {
                saveButton.GetComponentInChildren<Text>().text = hasAccount
                    ? "儲存名稱／重設密碼"
                    : "建立登入帳號";
            }
            if (deleteButton != null)
            {
                deleteButton.gameObject.SetActive(hasAccount);
                deleteConfirm = false;
                if (deleteButtonLabel != null) deleteButtonLabel.text = "刪除登入帳號";
            }
            SetStatus(
                hasAccount
                    ? "可修改孩子名稱、重設密碼或刪除登入帳號；孩子資料會保留。"
                    : "建立帳號後，孩子即可使用登入名稱與密碼登入。",
                false);
        }

        private async void HandleSave()
        {
            if (saveButton != null) saveButton.interactable = false;
            try
            {
                SupabaseChildProfileRecord child = FindChild(selectedChildId);
                bool hasAccount = !creatingNewChild
                    && child != null
                    && !string.IsNullOrWhiteSpace(child.profile_id);
                string password = passwordInput == null ? string.Empty : passwordInput.text;
                string confirmation = confirmationInput == null
                    ? string.Empty
                    : confirmationInput.text;
                SupabaseParentChildAccountMutationResult result;
                string message;
                if (hasAccount)
                {
                    string name = nameInput == null ? string.Empty : nameInput.text.Trim();
                    bool nameChanged = name != GetChildName(child);
                    bool passwordProvided = password.Length > 0 || confirmation.Length > 0;
                    if (!nameChanged && !passwordProvided)
                    {
                        SetStatus("請修改孩子名稱，或輸入要重設的新密碼。", true);
                        return;
                    }
                    if (passwordProvided
                        && (password.Length < 6 || password != confirmation))
                    {
                        SetStatus("請輸入相同的 6 碼以上英數密碼。", true);
                        return;
                    }
                    if (nameChanged)
                    {
                        result = await updateName(child.id, name);
                        message = "「" + name + "」的孩子名稱已更新。";
                    }
                    else
                    {
                        result = new SupabaseParentChildAccountMutationResult
                        {
                            Succeeded = true,
                        };
                        message = string.Empty;
                    }

                    if (passwordProvided)
                    {
                        result = await resetPassword(child.id, password);
                        message = string.IsNullOrWhiteSpace(message)
                            ? "「" + GetChildName(child) + "」的登入密碼已重設。"
                            : message + " 登入密碼也已重設。";
                    }
                }
                else
                {
                    if (!parentConsentCurrent)
                    {
                        SetStatus("請先在家庭設定完成家長同意，再建立孩子帳號。", true);
                        return;
                    }
                    if (password.Length < 6 || password != confirmation)
                    {
                        SetStatus("請輸入相同的 6 碼以上英數密碼。", true);
                        return;
                    }

                    string name = nameInput == null ? string.Empty : nameInput.text.Trim();
                    string login = loginInput == null ? string.Empty : loginInput.text.Trim();
                    result = await createAccount(
                        new SupabaseParentChildAccountCreateInput
                        {
                            childProfileId = creatingNewChild ? null : selectedChildId,
                            childName = name,
                            loginName = login,
                            password = password,
                            gender = creatingNewChild ? selectedGender : null,
                            characterId = creatingNewChild ? selectedCharacterId : null,
                        });
                    message = creatingNewChild
                        ? "孩子帳號已建立。"
                        : "「" + name + "」的登入帳號已建立。";
                }

                ApplyMutationResult(result, message);
            }
            catch (Exception exception)
            {
                SetStatus("孩子帳號操作失敗：" + exception.Message, true);
                if (saveButton != null) saveButton.interactable = true;
            }
        }

        private async void HandleDelete()
        {
            SupabaseChildProfileRecord child = FindChild(selectedChildId);
            if (child == null || string.IsNullOrWhiteSpace(child.profile_id)) return;
            if (!deleteConfirm)
            {
                deleteConfirm = true;
                if (deleteButtonLabel != null) deleteButtonLabel.text = "再次確認刪除";
                SetStatus("再次點擊即可刪除登入帳號；孩子的任務與點數資料會保留。", true);
                return;
            }

            if (deleteButton != null) deleteButton.interactable = false;
            try
            {
                SupabaseParentChildAccountMutationResult result =
                    await deleteAccount(child.id);
                ApplyMutationResult(
                    result,
                    "「" + GetChildName(child) + "」的登入帳號已刪除，孩子資料仍保留。 ");
            }
            catch (Exception exception)
            {
                SetStatus("刪除孩子帳號失敗：" + exception.Message, true);
                if (deleteButton != null) deleteButton.interactable = true;
            }
        }

        private void ApplyMutationResult(
            SupabaseParentChildAccountMutationResult result,
            string message)
        {
            if (result == null || !result.Succeeded)
            {
                SetStatus("孩子帳號操作沒有完成。", true);
                if (saveButton != null) saveButton.interactable = true;
                if (deleteButton != null) deleteButton.interactable = true;
                return;
            }
            if (result.RefreshedSnapshot != null && applySnapshot != null)
            {
                applySnapshot(result.RefreshedSnapshot);
            }

            Action<string, bool> parentStatus = setParentStatus;
            Close();
            if (parentStatus != null)
            {
                parentStatus(
                    string.IsNullOrWhiteSpace(result.RefreshError)
                        ? message
                        : message + " 家庭資料稍後會自動更新。",
                    false);
            }
        }

        private void ToggleGender()
        {
            if (!creatingNewChild) return;
            selectedGender = selectedGender == "girl" ? "boy" : "girl";
            if (genderButtonLabel != null)
            {
                genderButtonLabel.text = "性別：" + (selectedGender == "girl" ? "女孩" : "男孩");
            }
        }

        private void CycleCharacter()
        {
            if (!creatingNewChild) return;
            int index = Array.IndexOf(CharacterIds, selectedCharacterId);
            selectedCharacterId = CharacterIds[(index + 1) % CharacterIds.Length];
            if (characterButtonLabel != null)
            {
                characterButtonLabel.text = "人物：" + GetCharacterLabel(selectedCharacterId);
            }
        }

        private void Close()
        {
            Action closed = onClosed;
            Dispose();
            if (closed != null) closed();
        }

        private SupabaseChildProfileRecord FindChild(string childId)
        {
            foreach (SupabaseChildProfileRecord child in
                snapshot == null
                    ? new SupabaseChildProfileRecord[0]
                    : snapshot.children ?? new SupabaseChildProfileRecord[0])
            {
                if (child != null && child.id == childId) return child;
            }

            return null;
        }

        private string FindFirstChildId()
        {
            foreach (SupabaseChildProfileRecord child in
                snapshot.children ?? new SupabaseChildProfileRecord[0])
            {
                if (child != null && !string.IsNullOrWhiteSpace(child.id)) return child.id;
            }

            return null;
        }

        private static string GetChildName(SupabaseChildProfileRecord child)
        {
            return child == null || string.IsNullOrWhiteSpace(child.display_name)
                ? "孩子"
                : child.display_name;
        }

        private static string BuildSelectedChildMessage(
            SupabaseChildProfileRecord child)
        {
            if (child == null) return "尚未選擇孩子。";
            string loginName = string.IsNullOrWhiteSpace(child.login_name)
                ? "尚未設定"
                : child.login_name;
            return "登入名稱：" + loginName + "｜點數：" + child.points_balance;
        }

        private static string GetCharacterLabel(string characterId)
        {
            switch (characterId)
            {
                case "character.elina": return "Elina";
                case "character.sia": return "Sia";
                case "character.elio": return "Elio";
                default: return "Arthur";
            }
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
            if (statusText == null) return;
            statusText.text = message;
            statusText.color = isError
                ? new Color(1f, 0.52f, 0.52f, 1f)
                : new Color(0.84f, 0.89f, 0.96f, 1f);
        }
    }
}
