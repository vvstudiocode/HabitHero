using System;

namespace HabitHero.App
{
    public static class HabitHeroAuthValidation
    {
        public static bool TryValidateParentRegistration(
            string email,
            string password,
            out string error)
        {
            string normalizedEmail = email == null ? string.Empty : email.Trim();
            if (!IsEmail(normalizedEmail))
            {
                error = "請輸入有效的 Email。";
                return false;
            }

            if (string.IsNullOrEmpty(password)
                || password.Length < 8
                || !HasUppercase(password)
                || !HasLowercase(password))
            {
                error = "密碼需至少 8 碼，並包含大小寫英文字母。";
                return false;
            }

            error = null;
            return true;
        }

        public static bool TryValidatePasswordConfirmation(
            string password,
            string confirmation,
            out string error)
        {
            if (string.IsNullOrEmpty(confirmation))
            {
                error = "請再次輸入相同的家長密碼。";
                return false;
            }

            if (!string.Equals(password, confirmation, StringComparison.Ordinal))
            {
                error = "兩次輸入的密碼不一致。";
                return false;
            }

            error = null;
            return true;
        }

        private static bool IsEmail(string value)
        {
            int atIndex = value.IndexOf('@');
            return atIndex > 0
                && atIndex == value.LastIndexOf('@')
                && atIndex < value.Length - 1
                && value.IndexOf('.', atIndex + 1) > atIndex + 1
                && value.IndexOf(' ') < 0
                && value.IndexOf('\t') < 0
                && value.IndexOf('\r') < 0
                && value.IndexOf('\n') < 0;
        }

        private static bool HasUppercase(string value)
        {
            foreach (char character in value)
            {
                if (char.IsUpper(character)) return true;
            }

            return false;
        }

        private static bool HasLowercase(string value)
        {
            foreach (char character in value)
            {
                if (char.IsLower(character)) return true;
            }

            return false;
        }
    }
}
