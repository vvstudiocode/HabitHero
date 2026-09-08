using System.Text;

namespace HabitHero.Platform
{
    public static class SupabaseJson
    {
        public static string Escape(string value)
        {
            if (value == null) return string.Empty;

            StringBuilder builder = new StringBuilder(value.Length + 8);
            foreach (char character in value)
            {
                switch (character)
                {
                    case '\\': builder.Append("\\\\"); break;
                    case '"': builder.Append("\\\""); break;
                    case '\b': builder.Append("\\b"); break;
                    case '\f': builder.Append("\\f"); break;
                    case '\n': builder.Append("\\n"); break;
                    case '\r': builder.Append("\\r"); break;
                    case '\t': builder.Append("\\t"); break;
                    default:
                        if (character < 32)
                        {
                            builder.Append("\\u").Append(((int)character).ToString("x4"));
                        }
                        else
                        {
                            builder.Append(character);
                        }
                        break;
                }
            }

            return builder.ToString();
        }

        public static string Quote(string value)
        {
            return "\"" + Escape(value ?? string.Empty) + "\"";
        }

        public static string NullableString(string value)
        {
            return value == null ? "null" : Quote(value);
        }
    }
}
