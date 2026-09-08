using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;

namespace HabitHero.Platform
{
    public sealed class SupabaseDataException : Exception
    {
        public SupabaseDataException(string message, long statusCode = 0)
            : base(message)
        {
            StatusCode = statusCode;
        }

        public long StatusCode { get; private set; }
    }

    public sealed class SupabaseRestClient
    {
        private readonly SupabaseClientSettings settings;
        private readonly SupabaseAuthClient authClient;
        private readonly ISupabaseTransport transport;

        public SupabaseRestClient(
            SupabaseClientSettings settings,
            SupabaseAuthClient authClient)
            : this(settings, authClient, new UnityWebRequestTransport())
        {
        }

        public SupabaseRestClient(
            SupabaseClientSettings settings,
            SupabaseAuthClient authClient,
            ISupabaseTransport transport)
        {
            if (settings == null) throw new ArgumentNullException("settings");
            if (authClient == null) throw new ArgumentNullException("authClient");
            if (transport == null) throw new ArgumentNullException("transport");

            this.settings = settings;
            this.authClient = authClient;
            this.transport = transport;
        }

        public Task<SupabaseSession> EnsureSessionAsync(
            CancellationToken cancellationToken)
        {
            return authClient.EnsureFreshSessionAsync(cancellationToken);
        }

        public SupabaseSession CurrentSession
        {
            get { return authClient.CurrentSession; }
        }

        public async Task<T[]> SelectManyAsync<T>(
            string table,
            IEnumerable<SupabaseRestFilter> filters,
            string selectColumns,
            string order,
            int limit,
            CancellationToken cancellationToken)
        {
            SupabaseSession session = await RequireSessionAsync(cancellationToken);
            SupabaseRequestContract request;
            string error;
            if (!SupabaseRestRequestBuilder.TryBuildTableSelect(
                    settings,
                    table,
                    filters,
                    selectColumns,
                    order,
                    limit,
                    session.AccessToken,
                    out request,
                    out error))
            {
                throw new SupabaseDataException(error);
            }

            SupabaseHttpResponse response = await transport.SendAsync(request, cancellationToken);
            EnsureSuccess(response);

            T[] rows;
            if (!SupabaseJsonArrayParser.TryParseArray(response.Body, out rows, out error))
            {
                throw new SupabaseDataException(error, response.StatusCode);
            }

            return rows;
        }

        public async Task<T> SelectSingleAsync<T>(
            string table,
            IEnumerable<SupabaseRestFilter> filters,
            string selectColumns,
            CancellationToken cancellationToken)
        {
            T[] rows = await SelectManyAsync<T>(
                table,
                filters,
                selectColumns,
                null,
                0,
                cancellationToken);
            if (rows.Length == 0) return default(T);
            if (rows.Length > 1)
            {
                throw new SupabaseDataException(
                    "Supabase returned more than one row for a single-row query.");
            }

            return rows[0];
        }

        public async Task<string> CallRpcAsync(
            string functionName,
            string jsonBody,
            CancellationToken cancellationToken)
        {
            SupabaseSession session = await RequireSessionAsync(cancellationToken);
            SupabaseRequestContract request;
            string error;
            if (!SupabaseRequestBuilder.TryBuildRpc(
                    settings,
                    functionName,
                    session.AccessToken,
                    jsonBody,
                    out request,
                    out error))
            {
                throw new SupabaseDataException(error);
            }

            SupabaseHttpResponse response = await transport.SendAsync(request, cancellationToken);
            EnsureSuccess(response);
            return response.Body;
        }

        public async Task InsertAsync(
            string table,
            string jsonBody,
            CancellationToken cancellationToken)
        {
            SupabaseSession session = await RequireSessionAsync(cancellationToken);
            SupabaseRequestContract request;
            string error;
            if (!SupabaseRestRequestBuilder.TryBuildTableInsert(
                    settings,
                    table,
                    jsonBody,
                    session.AccessToken,
                    out request,
                    out error))
            {
                throw new SupabaseDataException(error);
            }

            SupabaseHttpResponse response = await transport.SendAsync(request, cancellationToken);
            EnsureSuccess(response);
        }

        public async Task DeleteAsync(
            string table,
            IEnumerable<SupabaseRestFilter> filters,
            CancellationToken cancellationToken)
        {
            SupabaseSession session = await RequireSessionAsync(cancellationToken);
            SupabaseRequestContract request;
            string error;
            if (!SupabaseRestRequestBuilder.TryBuildTableDelete(
                    settings,
                    table,
                    filters,
                    session.AccessToken,
                    out request,
                    out error))
            {
                throw new SupabaseDataException(error);
            }

            SupabaseHttpResponse response = await transport.SendAsync(request, cancellationToken);
            EnsureSuccess(response);
        }

        public async Task UpdateAsync(
            string table,
            IEnumerable<SupabaseRestFilter> filters,
            string jsonBody,
            CancellationToken cancellationToken)
        {
            SupabaseSession session = await RequireSessionAsync(cancellationToken);
            SupabaseRequestContract request;
            string error;
            if (!SupabaseRestRequestBuilder.TryBuildTableUpdate(
                    settings,
                    table,
                    filters,
                    jsonBody,
                    session.AccessToken,
                    out request,
                    out error))
            {
                throw new SupabaseDataException(error);
            }

            SupabaseHttpResponse response = await transport.SendAsync(request, cancellationToken);
            EnsureSuccess(response);
        }

        private async Task<SupabaseSession> RequireSessionAsync(
            CancellationToken cancellationToken)
        {
            SupabaseSession session = await authClient.EnsureFreshSessionAsync(cancellationToken);
            if (session == null || !session.HasTokens)
            {
                throw new SupabaseDataException("Supabase session is missing.");
            }

            return session;
        }

        private static void EnsureSuccess(SupabaseHttpResponse response)
        {
            if (response != null && response.IsSuccess) return;
            if (response == null)
            {
                throw new SupabaseDataException("Supabase data request returned no response.");
            }

            string message = !string.IsNullOrWhiteSpace(response.TransportError)
                ? response.TransportError
                : SupabaseAuthResponseParser.GetErrorMessage(response.Body, response.StatusCode);
            throw new SupabaseDataException(message, response.StatusCode);
        }
    }
}
