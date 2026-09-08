using System;
using System.Threading;
using System.Threading.Tasks;
using UnityEngine;
using UnityEngine.Networking;

namespace HabitHero.App
{
    public static class HabitHeroParentBackgroundMusic
    {
        public const string AssetPath =
            "/audio/alex-morgan-piano-lounge-sunny-cafe-music-564271.mp3";
        public const float Volume = 0.2f;

        private const string PreferencePrefix =
            "habithero.parent-background-music:";

        public static string BuildUrl(string baseUrl)
        {
            if (string.IsNullOrWhiteSpace(baseUrl)) return string.Empty;
            return baseUrl.TrimEnd('/') + AssetPath;
        }

        public static bool GetEnabled(string familyId)
        {
            if (string.IsNullOrWhiteSpace(familyId)) return true;
            return PlayerPrefs.GetInt(GetPreferenceKey(familyId), 1) != 0;
        }

        public static void SetEnabled(string familyId, bool enabled)
        {
            if (string.IsNullOrWhiteSpace(familyId)) return;
            PlayerPrefs.SetInt(GetPreferenceKey(familyId), enabled ? 1 : 0);
            PlayerPrefs.Save();
        }

        private static string GetPreferenceKey(string familyId)
        {
            return PreferencePrefix + familyId.Trim();
        }
    }

    public sealed class HabitHeroParentBackgroundMusicPlayer : IDisposable
    {
        private readonly Transform parentTransform;
        private readonly string gameAssetBaseUrl;
        private GameObject audioObject;
        private AudioSource audioSource;
        private AudioClip audioClip;
        private CancellationTokenSource loadCancellation;

        public HabitHeroParentBackgroundMusicPlayer(
            Transform parentTransform,
            string gameAssetBaseUrl)
        {
            if (parentTransform == null)
            {
                throw new ArgumentNullException("parentTransform");
            }

            this.parentTransform = parentTransform;
            this.gameAssetBaseUrl = gameAssetBaseUrl == null
                ? string.Empty
                : gameAssetBaseUrl.Trim();
        }

        public void Start()
        {
            string musicUrl = HabitHeroParentBackgroundMusic.BuildUrl(
                gameAssetBaseUrl);
            if (string.IsNullOrWhiteSpace(musicUrl)) return;

            Stop();
            audioObject = new GameObject("ParentBackgroundMusic");
            audioObject.transform.SetParent(parentTransform, false);
            audioSource = audioObject.AddComponent<AudioSource>();
            audioSource.playOnAwake = false;
            audioSource.loop = true;
            audioSource.spatialBlend = 0f;
            audioSource.volume = HabitHeroParentBackgroundMusic.Volume;
            loadCancellation = new CancellationTokenSource();

            AudioSource expectedAudio = audioSource;
            GameObject expectedObject = audioObject;
            _ = LoadAsync(
                musicUrl,
                expectedAudio,
                expectedObject,
                loadCancellation.Token);
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
                audioObject = null;
            }

            if (audioClip != null)
            {
                UnityEngine.Object.Destroy(audioClip);
                audioClip = null;
            }

            audioSource = null;
        }

        public void Dispose()
        {
            Stop();
        }

        private async Task LoadAsync(
            string musicUrl,
            AudioSource expectedAudio,
            GameObject expectedObject,
            CancellationToken cancellationToken)
        {
            try
            {
                using (UnityWebRequest webRequest = UnityWebRequestMultimedia.GetAudioClip(
                    musicUrl,
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
                            "HabitHero parent background music failed: "
                            + webRequest.error);
                        return;
                    }

                    AudioClip clip = DownloadHandlerAudioClip.GetContent(webRequest);
                    if (clip == null
                        || audioSource != expectedAudio
                        || audioObject != expectedObject)
                    {
                        if (clip != null) UnityEngine.Object.Destroy(clip);
                        return;
                    }

                    audioClip = clip;
                    expectedAudio.clip = clip;
                    expectedAudio.loop = true;
                    expectedAudio.volume = HabitHeroParentBackgroundMusic.Volume;
                    expectedAudio.Play();
                }
            }
            catch (OperationCanceledException)
            {
                // Closing the parent workbench cancels the remote audio load.
            }
            catch (Exception exception)
            {
                Debug.LogWarning(
                    "HabitHero parent background music failed: " + exception.Message);
            }
        }
    }
}
