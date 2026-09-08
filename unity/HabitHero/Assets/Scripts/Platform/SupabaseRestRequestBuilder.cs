using System;
using System.Collections.Generic;
using System.Text;
using System.Text.RegularExpressions;

namespace HabitHero.Platform
{
    public sealed class SupabaseRestFilter
    {
        public SupabaseRestFilter(string column, string operation, string value)
        {
            Column = column;
            Operation = operation;
            Value = value;
        }

        public string Column { get; private set; }

        public string Operation { get; private set; }

        public string Value { get; private set; }
    }

    public static class SupabaseRestRequestBuilder
    {
        private static readonly Regex SafeIdentifier = new Regex(
            "^[a-zA-Z][a-zA-Z0-9_]*$",
            RegexOptions.CultureInvariant);
        private static readonly Regex SafeSelect = new Regex(
            "^[a-zA-Z0-9_*,().:>-]+$",
            RegexOptions.CultureInvariant);
        private static readonly Regex SafeOrder = new Regex(
            "^[a-zA-Z][a-zA-Z0-9_]*(\\.(asc|desc))?(,[a-zA-Z][a-zA-Z0-9_]*(\\.(asc|desc))?)*$",
            RegexOptions.CultureInvariant);

        public static bool TryBuildTableSelect(
            SupabaseClientSettings settings,
            string table,
            IEnumerable<SupabaseRestFilter> filters,
            string selectColumns,
            string order,
            int limit,
            string accessToken,
            out SupabaseRequestContract request,
            out string error)
        {
            request = null;
            error = null;

            if (settings == null)
            {
                error = "Supabase client settings are missing.";
                return false;
            }

            if (string.IsNullOrWhiteSpace(table) || !SafeIdentifier.IsMatch(table))
            {
                error = "Supabase table name is invalid.";
                return false;
            }

            string columns = string.IsNullOrWhiteSpace(selectColumns) ? "*" : selectColumns.Trim();
            if (!SafeSelect.IsMatch(columns))
            {
                error = "Supabase select columns are invalid.";
                return false;
            }

            if (limit < 0)
            {
                error = "Supabase row limit cannot be negative.";
                return false;
            }

            if (!string.IsNullOrWhiteSpace(order) && !SafeOrder.IsMatch(order.Trim()))
            {
                error = "Supabase order expression is invalid.";
                return false;
            }

            StringBuilder query = new StringBuilder("?select=").Append(columns);
            if (filters != null)
            {
                foreach (SupabaseRestFilter filter in filters)
                {
                    if (filter == null
                        || string.IsNullOrWhiteSpace(filter.Column)
                        || !SafeIdentifier.IsMatch(filter.Column)
                        || string.IsNullOrWhiteSpace(filter.Operation)
                        || !IsSupportedOperation(filter.Operation))
                    {
                        error = "Supabase table filter is invalid.";
                        return false;
                    }

                    query.Append('&')
                        .Append(filter.Column)
                        .Append('=')
                        .Append(filter.Operation)
                        .Append('.')
                        .Append(Uri.EscapeDataString(filter.Value ?? string.Empty));
                }
            }

            if (!string.IsNullOrWhiteSpace(order))
            {
                query.Append("&order=").Append(Uri.EscapeDataString(order.Trim()));
            }

            if (limit > 0) query.Append("&limit=").Append(limit);

            Dictionary<string, string> headers = new Dictionary<string, string>
            {
                { "apikey", settings.PublishableKey },
                { "Accept", "application/json" },
            };
            if (!string.IsNullOrWhiteSpace(accessToken))
            {
                headers["Authorization"] = "Bearer " + accessToken.Trim();
            }

            request = new SupabaseRequestContract(
                "GET",
                settings.Url + "/rest/v1/" + table.Trim() + query,
                headers,
                string.Empty);
            return true;
        }

        private static bool IsSupportedOperation(string operation)
        {
            switch (operation.Trim().ToLowerInvariant())
            {
                case "eq":
                case "neq":
                case "gt":
                case "gte":
                case "lt":
                case "lte":
                case "like":
                case "ilike":
                case "is":
                    return true;
                default:
                    return false;
            }
        }
    }
}
