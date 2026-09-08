using System;
using System.Threading;
using System.Threading.Tasks;

namespace HabitHero.Platform
{
    public enum SupabaseAuthEvent
    {
        InitialSession,
        SignedIn,
        SignedOut,
        TokenRefreshed,
        PasswordRecovery,
        UserUpdated,
    }

    public sealed class SupabaseAuthException : Exception
    {
        public SupabaseAuthException(string message, long statusCode = 0)
            : base(message)
        {
            StatusCode = statusCode;
        }

        public long StatusCode { get; private set; }
    }

    public sealed class SupabaseAuthClient
    {
        private const long RefreshSkewSeconds = 60;

        private readonly SupabaseClientSettings settings;
        private readonly ISupabaseSessionStore sessionStore;
        private readonly ISupabaseTransport transport;
        private readonly SemaphoreSlim refreshLock = new SemaphoreSlim(1, 1);
        private SupabaseSession currentSession;
        private bool initialized;

        public SupabaseAuthClient(SupabaseClientSettings settings)
            : this(settings, new PlayerPrefsSupabaseSessionStore(), new UnityWebRequestTransport())
        {
        }

        public SupabaseAuthClient(
            SupabaseClientSettings settings,
            ISupabaseSessionStore sessionStore,
            ISupabaseTransport transport)
        {
            if (settings == null) throw new ArgumentNullException("settings");
            if (sessionStore == null) throw new ArgumentNullException("sessionStore");
            if (transport == null) throw new ArgumentNullException("transport");

            this.settings = settings;
            this.sessionStore = sessionStore;
            this.transport = transport;
        }

        public event Action<SupabaseAuthEvent, SupabaseSession> AuthStateChanged;

        public SupabaseSession CurrentSession
        {
            get { return currentSession == null ? null : currentSession.Copy(); }
        }

        public async Task<SupabaseSession> InitializeAsync(CancellationToken cancellationToken)
        {
            if (initialized) return await EnsureFreshSessionAsync(cancellationToken);
            initialized = true;

            SupabaseSession restored;
            string error;
            string serialized = sessionStore.Load();
            if (!SupabaseSessionSerializer.TryDeserialize(serialized, out restored, out error))
            {
                sessionStore.Clear();
            }
            else
            {
                currentSession = restored;
            }

            if (currentSession != null && currentSession.ShouldRefresh(Now(), RefreshSkewSeconds))
            {
                try
                {
                    await RefreshSessionInternalAsync(cancellationToken, false);
                }
                catch (SupabaseAuthException)
                {
                    if (currentSession.ExpiresAt <= Now())
                    {
                        currentSession = null;
                        sessionStore.Clear();
                    }
                }
            }

            Emit(SupabaseAuthEvent.InitialSession);
            return CurrentSession;
        }

        public async Task<SupabaseSession> SignInWithPasswordAsync(
            string email,
            string password,
            CancellationToken cancellationToken)
        {
            SupabaseRequestContract request;
            string error;
            if (!SupabaseAuthRequestBuilder.TryBuildPasswordGrant(
                    settings,
                    email,
                    password,
                    out request,
                    out error))
            {
                throw new SupabaseAuthException(error);
            }

            SupabaseHttpResponse response = await transport.SendAsync(request, cancellationToken);
            EnsureSuccess(response);

            SupabaseSession session;
            if (!SupabaseAuthResponseParser.TryParseSession(
                    response.Body,
                    Now(),
                    out session,
                    out error))
            {
                throw new SupabaseAuthException(error, response.StatusCode);
            }

            SetSession(session, SupabaseAuthEvent.SignedIn);
            return CurrentSession;
        }

        public async Task<SupabaseAuthResponse> SignUpAsync(
            string email,
            string password,
            CancellationToken cancellationToken)
        {
            SupabaseRequestContract request;
            string error;
            if (!SupabaseAuthRequestBuilder.TryBuildSignUp(
                    settings,
                    email,
                    password,
                    out request,
                    out error))
            {
                throw new SupabaseAuthException(error);
            }

            SupabaseHttpResponse response = await transport.SendAsync(request, cancellationToken);
            EnsureSuccess(response);

            SupabaseAuthResponse parsed;
            if (!TryParseAuthResponse(response.Body, out parsed, out error))
            {
                throw new SupabaseAuthException(error, response.StatusCode);
            }

            SupabaseSession session;
            if (SupabaseSession.TryCreateFromAuthResponse(parsed, Now(), out session, out error))
            {
                SetSession(session, SupabaseAuthEvent.SignedIn);
            }

            return parsed;
        }

        public async Task<SupabaseSession> EnsureFreshSessionAsync(CancellationToken cancellationToken)
        {
            if (!initialized)
            {
                await InitializeAsync(cancellationToken);
            }

            if (currentSession == null) return null;
            if (!currentSession.ShouldRefresh(Now(), RefreshSkewSeconds)) return CurrentSession;
            return await RefreshSessionInternalAsync(cancellationToken, false);
        }

        public async Task<SupabaseSession> RefreshSessionAsync(CancellationToken cancellationToken)
        {
            return await RefreshSessionInternalAsync(cancellationToken, true);
        }

        public bool TrySetSessionFromCallback(
            string accessToken,
            string refreshToken,
            bool isPasswordRecovery,
            out SupabaseSession session,
            out string error)
        {
            SupabaseAuthResponse response = new SupabaseAuthResponse
            {
                access_token = accessToken,
                refresh_token = refreshToken,
                token_type = "bearer",
                expires_in = 3600,
            };

            if (!SupabaseSession.TryCreateFromAuthResponse(
                    response,
                    Now(),
                    out session,
                    out error))
            {
                return false;
            }

            initialized = true;
            SetSession(
                session,
                isPasswordRecovery ? SupabaseAuthEvent.PasswordRecovery : SupabaseAuthEvent.SignedIn);
            session = CurrentSession;
            return true;
        }

        public async Task<SupabaseUser> GetUserAsync(CancellationToken cancellationToken)
        {
            SupabaseSession session = await EnsureFreshSessionAsync(cancellationToken);
            if (session == null) throw new SupabaseAuthException("Supabase session is missing.");

            SupabaseRequestContract request;
            string error;
            if (!SupabaseAuthRequestBuilder.TryBuildUser(
                    settings,
                    session.AccessToken,
                    out request,
                    out error))
            {
                throw new SupabaseAuthException(error);
            }

            SupabaseHttpResponse response = await transport.SendAsync(request, cancellationToken);
            EnsureSuccess(response);

            SupabaseUser user;
            if (!SupabaseAuthResponseParser.TryParseUser(response.Body, out user, out error))
            {
                throw new SupabaseAuthException(error, response.StatusCode);
            }

            currentSession.user = user;
            PersistCurrentSession();
            return user;
        }

        public async Task RequestPasswordResetAsync(
            string email,
            string redirectTo,
            CancellationToken cancellationToken)
        {
            SupabaseRequestContract request;
            string error;
            if (!SupabaseAuthRequestBuilder.TryBuildPasswordRecovery(
                    settings,
                    email,
                    redirectTo,
                    out request,
                    out error))
            {
                throw new SupabaseAuthException(error);
            }

            SupabaseHttpResponse response = await transport.SendAsync(request, cancellationToken);
            EnsureSuccess(response);
        }

        public async Task UpdatePasswordAsync(string password, CancellationToken cancellationToken)
        {
            SupabaseSession session = await EnsureFreshSessionAsync(cancellationToken);
            if (session == null) throw new SupabaseAuthException("Supabase session is missing.");

            SupabaseRequestContract request;
            string error;
            if (!SupabaseAuthRequestBuilder.TryBuildUpdatePassword(
                    settings,
                    session.AccessToken,
                    password,
                    out request,
                    out error))
            {
                throw new SupabaseAuthException(error);
            }

            SupabaseHttpResponse response = await transport.SendAsync(request, cancellationToken);
            EnsureSuccess(response);
            Emit(SupabaseAuthEvent.UserUpdated);
        }

        public async Task SignOutAsync(CancellationToken cancellationToken)
        {
            SupabaseAuthException pendingError = null;
            try
            {
                if (currentSession != null)
                {
                    SupabaseRequestContract request;
                    string error;
                    if (!SupabaseAuthRequestBuilder.TryBuildLogout(
                            settings,
                            currentSession.AccessToken,
                            out request,
                            out error))
                    {
                        pendingError = new SupabaseAuthException(error);
                    }
                    else
                    {
                        SupabaseHttpResponse response = await transport.SendAsync(request, cancellationToken);
                        if (!response.IsSuccess)
                        {
                            pendingError = ToException(response);
                        }
                    }
                }
            }
            catch (OperationCanceledException)
            {
                throw;
            }
            catch (SupabaseAuthException exception)
            {
                pendingError = exception;
            }
            finally
            {
                currentSession = null;
                sessionStore.Clear();
                initialized = true;
                Emit(SupabaseAuthEvent.SignedOut);
            }

            if (pendingError != null) throw pendingError;
        }

        private async Task<SupabaseSession> RefreshSessionInternalAsync(
            CancellationToken cancellationToken,
            bool force)
        {
            await refreshLock.WaitAsync(cancellationToken);
            try
            {
                if (!force
                    && currentSession != null
                    && !currentSession.ShouldRefresh(Now(), RefreshSkewSeconds))
                {
                    return CurrentSession;
                }

                if (currentSession == null || string.IsNullOrWhiteSpace(currentSession.RefreshToken))
                {
                    throw new SupabaseAuthException("Supabase refresh token is missing.");
                }

                SupabaseRequestContract request;
                string error;
                if (!SupabaseAuthRequestBuilder.TryBuildRefreshGrant(
                        settings,
                        currentSession.RefreshToken,
                        out request,
                        out error))
                {
                    throw new SupabaseAuthException(error);
                }

                SupabaseHttpResponse response = await transport.SendAsync(request, cancellationToken);
                EnsureSuccess(response);

                SupabaseSession refreshedSession;
                if (!SupabaseAuthResponseParser.TryParseSession(
                        response.Body,
                        Now(),
                        out refreshedSession,
                        out error))
                {
                    throw new SupabaseAuthException(error, response.StatusCode);
                }

                SetSession(refreshedSession, SupabaseAuthEvent.TokenRefreshed);
                return CurrentSession;
            }
            finally
            {
                refreshLock.Release();
            }
        }

        private void SetSession(SupabaseSession session, SupabaseAuthEvent eventType)
        {
            currentSession = session.Copy();
            initialized = true;
            PersistCurrentSession();
            Emit(eventType);
        }

        private void PersistCurrentSession()
        {
            sessionStore.Save(SupabaseSessionSerializer.Serialize(currentSession));
        }

        private void Emit(SupabaseAuthEvent eventType)
        {
            Action<SupabaseAuthEvent, SupabaseSession> listener = AuthStateChanged;
            if (listener != null) listener(eventType, CurrentSession);
        }

        private static void EnsureSuccess(SupabaseHttpResponse response)
        {
            if (response != null && response.IsSuccess) return;
            throw ToException(response);
        }

        private static SupabaseAuthException ToException(SupabaseHttpResponse response)
        {
            if (response == null) return new SupabaseAuthException("Supabase request returned no response.");
            if (!string.IsNullOrWhiteSpace(response.TransportError))
            {
                return new SupabaseAuthException(response.TransportError, response.StatusCode);
            }

            return new SupabaseAuthException(
                SupabaseAuthResponseParser.GetErrorMessage(response.Body, response.StatusCode),
                response.StatusCode);
        }

        private static bool TryParseAuthResponse(
            string body,
            out SupabaseAuthResponse response,
            out string error)
        {
            response = null;
            error = null;
            try
            {
                response = UnityEngine.JsonUtility.FromJson<SupabaseAuthResponse>(body);
            }
            catch (Exception exception)
            {
                error = "Supabase auth response JSON is invalid: " + exception.Message;
                return false;
            }

            if (response == null)
            {
                error = "Supabase auth response JSON is invalid.";
                return false;
            }

            return true;
        }

        private static long Now()
        {
            return DateTimeOffset.UtcNow.ToUnixTimeSeconds();
        }
    }
}
