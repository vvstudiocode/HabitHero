using System;
using System.Threading;
using System.Threading.Tasks;
using HabitHero.Platform;
using UnityEngine;
using UnityEngine.Networking;

namespace HabitHero.App
{
    public static class HabitHeroTaskCompletionAudio
    {
        public const string AssetPath = "/audio/timer-complete.mp3";

        public static bool IsCandidate(
            SupabaseChildTaskRecord task,
            SupabaseTaskTimerSessionRecord timer,
            int remainingSeconds)
        {
            if (task == null
                || timer == null
                || !task.requires_timer
                || task.id != timer.task_id
                || timer.status != "running"
                || remainingSeconds > 0)
            {
                return false;
            }

            return task.status == "todo" || task.status == "revision_requested";
        }

        public static string BuildUrl(string baseUrl, string assetName = "timer-complete.mp3")
        {
            if (string.IsNullOrWhiteSpace(baseUrl)
                || !string.Equals(
                    (assetName ?? string.Empty).TrimStart('/'),
                    "timer-complete.mp3",
                    StringComparison.Ordinal))
            {
                return string.Empty;
            }

            return baseUrl.TrimEnd('/') + AssetPath;
        }
    }

    public sealed class HabitHeroTaskCompletionAudioPlayer : IDisposable
    {
        private readonly Transform parentTransform;
        private readonly string gameAssetBaseUrl;
        private GameObject audioObject;
        private AudioSource audioSource;
        private AudioClip audioClip;
        private CancellationTokenSource loadCancellation;

        public HabitHeroTaskCompletionAudioPlayer(
            Transform parentTransform,
            string gameAssetBaseUrl)
        {
            if (parentTransform == null) throw new ArgumentNullException("parentTransform");
            this.parentTransform = parentTransform;
            this.gameAssetBaseUrl = gameAssetBaseUrl == null
                ? string.Empty
                : gameAssetBaseUrl.Trim();
        }

        public string ActiveTaskId { get; private set; }

        public void Start(string taskId)
        {
            if (string.IsNullOrWhiteSpace(taskId)) return;
            if (ActiveTaskId == taskId && audioSource != null) return;

            Stop();
            string audioUrl = HabitHeroTaskCompletionAudio.BuildUrl(gameAssetBaseUrl);
            if (string.IsNullOrWhiteSpace(audioUrl)) return;

            ActiveTaskId = taskId;
            audioObject = new GameObject("TaskCompletionAudio");
            audioObject.transform.SetParent(parentTransform, false);
            audioSource = audioObject.AddComponent<AudioSource>();
            audioSource.playOnAwake = false;
            audioSource.loop = true;
            audioSource.spatialBlend = 0f;
            audioSource.volume = 1f;

            loadCancellation = new CancellationTokenSource();
            _ = LoadAsync(audioUrl, taskId, audioSource, audioObject, loadCancellation.Token);
        }

        public void Stop()
        {
            if (loadCancellation != null)
            {
                loadCancellation.Cancel();
                loadCancellation.Dispose();
                loadCancellation = null;
            }

            if (audioSource != null)
            {
                audioSource.Stop();
                audioSource.clip = null;
            }

            if (audioObject != null)
            {
                UnityEngine.Object.Destroy(audioObject);
            }

            if (audioClip != null)
            {
                UnityEngine.Object.Destroy(audioClip);
                audioClip = null;
            }

            audioSource = null;
            audioObject = null;
            ActiveTaskId = null;
        }

        public void Dispose()
        {
            Stop();
        }

        private async Task LoadAsync(
            string audioUrl,
            string taskId,
            AudioSource expectedAudio,
            GameObject expectedObject,
            CancellationToken cancellationToken)
        {
            try
            {
                using (UnityWebRequest webRequest = UnityWebRequestMultimedia.GetAudioClip(
                    audioUrl,
                    AudioType.MPEG))
                {
                    UnityWebRequestAsyncOperation operation = webRequest.SendWebRequest();
                    while (!operation.isDone)
                    {
                        cancellationToken.ThrowIfCancellationRequested();
                        await Task.Yield();
                    }

                    cancellationToken.ThrowIfCancellationRequested();
                    if (webRequest.result != UnityWebRequest.Result.Success)
                    {
                        Debug.LogWarning(
                            "HabitHero could not load timer completion audio: "
                            + webRequest.error);
                        if (ActiveTaskId == taskId) Stop();
                        return;
                    }

                    AudioClip clip = DownloadHandlerAudioClip.GetContent(webRequest);
                    if (clip == null
                        || expectedAudio == null
                        || audioSource != expectedAudio
                        || audioObject != expectedObject
                        || ActiveTaskId != taskId)
                    {
                        if (clip != null) UnityEngine.Object.Destroy(clip);
                        return;
                    }

                    audioClip = clip;
                    expectedAudio.clip = clip;
                    expectedAudio.Play();
                }
            }
            catch (OperationCanceledException)
            {
                // Dismissing an alarm or leaving the home view cancels the load.
            }
            catch (Exception exception)
            {
                Debug.LogWarning(
                    "HabitHero timer completion audio failed: " + exception.Message);
                if (ActiveTaskId == taskId) Stop();
            }
        }
    }
}
