using System;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using UnityEngine.Networking;

namespace HabitHero.Platform
{
    public sealed class UnityWebRequestTransport : ISupabaseTransport
    {
        public async Task<SupabaseHttpResponse> SendAsync(
            SupabaseRequestContract request,
            CancellationToken cancellationToken)
        {
            if (request == null) throw new ArgumentNullException("request");

            using (UnityWebRequest webRequest = new UnityWebRequest(request.Url, request.Method))
            {
                if (!string.IsNullOrEmpty(request.Body))
                {
                    webRequest.uploadHandler = new UploadHandlerRaw(Encoding.UTF8.GetBytes(request.Body));
                }

                webRequest.downloadHandler = new DownloadHandlerBuffer();
                foreach (var header in request.Headers)
                {
                    webRequest.SetRequestHeader(header.Key, header.Value);
                }

                UnityWebRequestAsyncOperation operation = webRequest.SendWebRequest();
                while (!operation.isDone)
                {
                    cancellationToken.ThrowIfCancellationRequested();
                    await Task.Yield();
                }

                cancellationToken.ThrowIfCancellationRequested();
                string transportError = webRequest.result == UnityWebRequest.Result.Success
                    ? null
                    : webRequest.error;
                return new SupabaseHttpResponse(
                    webRequest.responseCode,
                    webRequest.downloadHandler == null ? string.Empty : webRequest.downloadHandler.text,
                    transportError);
            }
        }
    }
}
