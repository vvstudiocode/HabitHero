using System;
using System.Collections.Generic;
using System.Text;

namespace HabitHero.Platform
{
    public sealed class SupabaseRealtimePostgresChange
    {
        public string Event;
        public string Schema;
        public string Table;
        public string Filter;
    }

    public sealed class SupabaseRealtimeChannelOptions
    {
        public bool Private = true;
        public bool PresenceEnabled;
        public string PresenceKey;
        public bool BroadcastSelf;
        public bool BroadcastAck;
        public List<SupabaseRealtimePostgresChange> PostgresChanges =
            new List<SupabaseRealtimePostgresChange>();
    }

    public sealed class SupabaseRealtimeEnvelope
    {
        public string Topic;
        public string Event;
        public string Reference;
        public string JoinReference;
        public object Payload;
    }

    public static class SupabaseRealtimeProtocol
    {
        public const string ProtocolVersion = "1.0.0";
        public const int HeartbeatIntervalMilliseconds = 20000;

        public static string BuildWebSocketUrl(SupabaseClientSettings settings)
        {
            if (settings == null) throw new ArgumentNullException("settings");

            Uri parsedUrl = new Uri(settings.Url, UriKind.Absolute);
            StringBuilder builder = new StringBuilder();
            builder.Append("wss://").Append(parsedUrl.Host);
            if (!parsedUrl.IsDefaultPort && parsedUrl.Port > 0)
            {
                builder.Append(":").Append(parsedUrl.Port);
            }

            builder.Append("/realtime/v1/websocket?apikey=")
                .Append(Uri.EscapeDataString(settings.PublishableKey))
                .Append("&vsn=")
                .Append(ProtocolVersion);
            return builder.ToString();
        }

        public static string BuildJoin(
            string topic,
            string reference,
            string joinReference,
            string accessToken,
            SupabaseRealtimeChannelOptions options)
        {
            if (options == null) options = new SupabaseRealtimeChannelOptions();
            string normalizedTopic = NormalizeTopic(topic);
            string safeReference = RequireReference(reference);
            string safeJoinReference = RequireReference(joinReference);
            if (string.IsNullOrWhiteSpace(accessToken))
            {
                throw new ArgumentException("Realtime access token is required.", "accessToken");
            }

            StringBuilder config = new StringBuilder();
            config.Append("{\"broadcast\":{\"ack\":")
                .Append(options.BroadcastAck ? "true" : "false")
                .Append(",\"self\":")
                .Append(options.BroadcastSelf ? "true" : "false")
                .Append("},\"presence\":{\"enabled\":")
                .Append(options.PresenceEnabled ? "true" : "false");
            if (!string.IsNullOrEmpty(options.PresenceKey))
            {
                config.Append(",\"key\":").Append(SupabaseJson.Quote(options.PresenceKey));
            }

            config.Append("},\"postgres_changes\":[");
            for (int index = 0; index < options.PostgresChanges.Count; index += 1)
            {
                if (index > 0) config.Append(",");
                SupabaseRealtimePostgresChange change = options.PostgresChanges[index];
                if (change == null) throw new ArgumentException("Realtime postgres change cannot be null.", "options");
                config.Append("{\"event\":")
                    .Append(SupabaseJson.Quote(change.Event ?? "*"))
                    .Append(",\"schema\":")
                    .Append(SupabaseJson.Quote(change.Schema ?? "public"))
                    .Append(",\"table\":")
                    .Append(SupabaseJson.Quote(change.Table ?? "*"));
                if (!string.IsNullOrEmpty(change.Filter))
                {
                    config.Append(",\"filter\":").Append(SupabaseJson.Quote(change.Filter));
                }

                config.Append("}");
            }

            config.Append("],\"private\":")
                .Append(options.Private ? "true" : "false")
                .Append("}");

            string payload = "{\"config\":" + config + ",\"access_token\":"
                + SupabaseJson.Quote(accessToken) + "}";
            return BuildMessage(normalizedTopic, "phx_join", payload, safeReference, safeJoinReference);
        }

        public static string BuildHeartbeat(string reference)
        {
            return BuildMessage("phoenix", "heartbeat", "{}", RequireReference(reference), null);
        }

        public static string BuildBroadcast(
            string topic,
            string joinReference,
            string reference,
            string eventName,
            string payloadJson)
        {
            string payload = "{\"type\":\"broadcast\",\"event\":"
                + SupabaseJson.Quote(RequireValue(eventName, "eventName"))
                + ",\"payload\":" + NormalizeJsonObject(payloadJson) + "}";
            return BuildMessage(
                NormalizeTopic(topic),
                "broadcast",
                payload,
                RequireReference(reference),
                RequireReference(joinReference));
        }

        public static string BuildTrack(
            string topic,
            string joinReference,
            string reference,
            string presenceJson)
        {
            string payload = "{\"type\":\"presence\",\"event\":\"track\",\"payload\":"
                + NormalizeJsonObject(presenceJson) + "}";
            return BuildMessage(
                NormalizeTopic(topic),
                "presence",
                payload,
                RequireReference(reference),
                RequireReference(joinReference));
        }

        public static string BuildUntrack(
            string topic,
            string joinReference,
            string reference)
        {
            return BuildMessage(
                NormalizeTopic(topic),
                "presence",
                "{\"type\":\"presence\",\"event\":\"untrack\",\"payload\":{}}",
                RequireReference(reference),
                RequireReference(joinReference));
        }

        public static string BuildAccessToken(
            string topic,
            string joinReference,
            string reference,
            string accessToken)
        {
            string payload = "{\"access_token\":"
                + SupabaseJson.Quote(RequireValue(accessToken, "accessToken")) + "}";
            return BuildMessage(
                NormalizeTopic(topic),
                "access_token",
                payload,
                RequireReference(reference),
                RequireReference(joinReference));
        }

        public static string BuildLeave(string topic, string joinReference, string reference)
        {
            return BuildMessage(
                NormalizeTopic(topic),
                "phx_leave",
                "{}",
                RequireReference(reference),
                RequireReference(joinReference));
        }

        public static string NormalizeTopic(string topic)
        {
            string value = RequireValue(topic, "topic").Trim();
            if (value.StartsWith("realtime:", StringComparison.Ordinal)) return value;
            return "realtime:" + value;
        }

        private static string BuildMessage(
            string topic,
            string eventName,
            string payloadJson,
            string reference,
            string joinReference)
        {
            StringBuilder message = new StringBuilder();
            message.Append("{\"topic\":").Append(SupabaseJson.Quote(topic))
                .Append(",\"event\":").Append(SupabaseJson.Quote(eventName))
                .Append(",\"payload\":").Append(payloadJson)
                .Append(",\"ref\":").Append(SupabaseJson.Quote(reference));
            if (!string.IsNullOrEmpty(joinReference))
            {
                message.Append(",\"join_ref\":").Append(SupabaseJson.Quote(joinReference));
            }

            return message.Append("}").ToString();
        }

        private static string NormalizeJsonObject(string json)
        {
            string value = string.IsNullOrWhiteSpace(json) ? "{}" : json.Trim();
            if (!value.StartsWith("{", StringComparison.Ordinal)
                || !value.EndsWith("}", StringComparison.Ordinal))
            {
                throw new ArgumentException("Realtime payload must be a JSON object.", "json");
            }

            return value;
        }

        private static string RequireReference(string value)
        {
            return RequireValue(value, "reference");
        }

        private static string RequireValue(string value, string parameterName)
        {
            if (string.IsNullOrWhiteSpace(value)
                || value.IndexOfAny(new[] { '\r', '\n', '\u0000' }) >= 0)
            {
                throw new ArgumentException("Realtime " + parameterName + " is required.", parameterName);
            }

            return value;
        }
    }

    public static class SupabaseRealtimeMessageParser
    {
        public static bool TryParseEnvelope(
            string json,
            out SupabaseRealtimeEnvelope envelope,
            out string error)
        {
            envelope = null;
            error = null;

            object value;
            if (!SupabaseRealtimeJsonParser.TryParse(json, out value, out error)) return false;
            Dictionary<string, object> record = value as Dictionary<string, object>;
            if (record == null)
            {
                error = "Realtime message must be a JSON object.";
                return false;
            }

            string topic = GetString(record, "topic");
            string eventName = GetString(record, "event");
            if (string.IsNullOrEmpty(topic) || string.IsNullOrEmpty(eventName))
            {
                error = "Realtime message is missing topic or event.";
                return false;
            }

            envelope = new SupabaseRealtimeEnvelope
            {
                Topic = topic,
                Event = eventName,
                Reference = GetString(record, "ref"),
                JoinReference = GetString(record, "join_ref"),
                Payload = record.ContainsKey("payload") ? record["payload"] : null,
            };
            return true;
        }

        public static Dictionary<string, object> AsObject(object value)
        {
            return value as Dictionary<string, object>;
        }

        public static List<object> AsArray(object value)
        {
            return value as List<object>;
        }

        public static string GetString(Dictionary<string, object> record, string key)
        {
            if (record == null || !record.ContainsKey(key) || record[key] == null) return null;
            return record[key] as string;
        }

        public static bool TryGetString(
            Dictionary<string, object> record,
            string key,
            out string value)
        {
            value = GetString(record, key);
            return value != null;
        }
    }

    internal static class SupabaseRealtimeJsonParser
    {
        public static bool TryParse(string json, out object value, out string error)
        {
            value = null;
            error = null;
            if (string.IsNullOrWhiteSpace(json))
            {
                error = "Realtime message is empty.";
                return false;
            }

            try
            {
                Parser parser = new Parser(json);
                value = parser.ParseValue();
                parser.SkipWhitespace();
                if (!parser.IsAtEnd)
                {
                    error = "Realtime message has trailing JSON content.";
                    return false;
                }

                return true;
            }
            catch (Exception exception)
            {
                error = "Realtime message is invalid: " + exception.Message;
                return false;
            }
        }

        private sealed class Parser
        {
            private readonly string json;
            private int index;

            public Parser(string json)
            {
                this.json = json;
            }

            public bool IsAtEnd
            {
                get { return index >= json.Length; }
            }

            public object ParseValue()
            {
                SkipWhitespace();
                if (IsAtEnd) throw new FormatException("Unexpected end of message.");
                char character = json[index];
                if (character == '{') return ParseObject();
                if (character == '[') return ParseArray();
                if (character == '"') return ParseString();
                if (character == 't' && ConsumeLiteral("true")) return true;
                if (character == 'f' && ConsumeLiteral("false")) return false;
                if (character == 'n' && ConsumeLiteral("null")) return null;
                return ParseNumber();
            }

            public void SkipWhitespace()
            {
                while (!IsAtEnd && char.IsWhiteSpace(json[index])) index += 1;
            }

            private Dictionary<string, object> ParseObject()
            {
                Expect('{');
                Dictionary<string, object> result = new Dictionary<string, object>();
                SkipWhitespace();
                if (TryConsume('}')) return result;

                while (true)
                {
                    SkipWhitespace();
                    if (IsAtEnd || json[index] != '"')
                    {
                        throw new FormatException("Object key must be a string.");
                    }

                    string key = ParseString();
                    SkipWhitespace();
                    Expect(':');
                    result[key] = ParseValue();
                    SkipWhitespace();
                    if (TryConsume('}')) return result;
                    Expect(',');
                }
            }

            private List<object> ParseArray()
            {
                Expect('[');
                List<object> result = new List<object>();
                SkipWhitespace();
                if (TryConsume(']')) return result;

                while (true)
                {
                    result.Add(ParseValue());
                    SkipWhitespace();
                    if (TryConsume(']')) return result;
                    Expect(',');
                }
            }

            private string ParseString()
            {
                Expect('"');
                StringBuilder result = new StringBuilder();
                while (!IsAtEnd)
                {
                    char character = json[index++];
                    if (character == '"') return result.ToString();
                    if (character != '\\')
                    {
                        result.Append(character);
                        continue;
                    }

                    if (IsAtEnd) throw new FormatException("Unterminated string escape.");
                    char escaped = json[index++];
                    switch (escaped)
                    {
                        case '"': result.Append('"'); break;
                        case '\\': result.Append('\\'); break;
                        case '/': result.Append('/'); break;
                        case 'b': result.Append('\b'); break;
                        case 'f': result.Append('\f'); break;
                        case 'n': result.Append('\n'); break;
                        case 'r': result.Append('\r'); break;
                        case 't': result.Append('\t'); break;
                        case 'u': result.Append(ParseUnicodeEscape()); break;
                        default: throw new FormatException("Unknown string escape.");
                    }
                }

                throw new FormatException("Unterminated JSON string.");
            }

            private char ParseUnicodeEscape()
            {
                if (index + 4 > json.Length) throw new FormatException("Incomplete unicode escape.");
                int value = 0;
                for (int offset = 0; offset < 4; offset += 1)
                {
                    int digit = HexValue(json[index++]);
                    if (digit < 0) throw new FormatException("Invalid unicode escape.");
                    value = (value * 16) + digit;
                }

                return (char)value;
            }

            private object ParseNumber()
            {
                int start = index;
                if (json[index] == '-') index += 1;
                while (!IsAtEnd && char.IsDigit(json[index])) index += 1;
                if (!IsAtEnd && json[index] == '.')
                {
                    index += 1;
                    while (!IsAtEnd && char.IsDigit(json[index])) index += 1;
                }

                if (!IsAtEnd && (json[index] == 'e' || json[index] == 'E'))
                {
                    index += 1;
                    if (!IsAtEnd && (json[index] == '+' || json[index] == '-')) index += 1;
                    while (!IsAtEnd && char.IsDigit(json[index])) index += 1;
                }

                string number = json.Substring(start, index - start);
                double parsed;
                if (!double.TryParse(
                        number,
                        System.Globalization.NumberStyles.Float,
                        System.Globalization.CultureInfo.InvariantCulture,
                        out parsed))
                {
                    throw new FormatException("Invalid JSON number.");
                }

                return parsed;
            }

            private bool ConsumeLiteral(string literal)
            {
                if (index + literal.Length > json.Length
                    || string.CompareOrdinal(json, index, literal, 0, literal.Length) != 0)
                {
                    return false;
                }

                index += literal.Length;
                return true;
            }

            private void Expect(char character)
            {
                if (IsAtEnd || json[index] != character)
                {
                    throw new FormatException("Expected '" + character + "'.");
                }

                index += 1;
            }

            private bool TryConsume(char character)
            {
                if (IsAtEnd || json[index] != character) return false;
                index += 1;
                return true;
            }

            private static int HexValue(char character)
            {
                if (character >= '0' && character <= '9') return character - '0';
                if (character >= 'a' && character <= 'f') return character - 'a' + 10;
                if (character >= 'A' && character <= 'F') return character - 'A' + 10;
                return -1;
            }
        }
    }
}
