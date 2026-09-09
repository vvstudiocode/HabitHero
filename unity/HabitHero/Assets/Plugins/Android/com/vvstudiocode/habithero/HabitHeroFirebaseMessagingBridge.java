package com.vvstudiocode.habithero;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;

import com.google.firebase.FirebaseApp;
import com.google.firebase.messaging.FirebaseMessaging;
import com.google.android.gms.tasks.OnCompleteListener;
import com.google.android.gms.tasks.Task;

public final class HabitHeroFirebaseMessagingBridge {
    private static volatile String token;
    private static volatile String error;
    private static volatile boolean pending;

    private HabitHeroFirebaseMessagingBridge() {}

    public static synchronized boolean requestToken(Context context) {
        token = null;
        error = null;
        pending = false;
        try {
            FirebaseApp app = FirebaseApp.getApps(context).isEmpty()
                ? FirebaseApp.initializeApp(context)
                : FirebaseApp.getInstance();
            if (app == null) {
                error = "找不到 Firebase 設定，請把 google-services.json 放入 Unity Android 設定。";
                return false;
            }

            pending = true;
            FirebaseMessaging.getInstance().getToken().addOnCompleteListener(
                new OnCompleteListener<String>() {
                    @Override
                    public void onComplete(Task<String> task) {
                        pending = false;
                        if (!task.isSuccessful()) {
                            Exception exception = task.getException();
                            error = exception == null
                                ? "Firebase Cloud Messaging 未回傳 Push Token。"
                                : exception.getMessage();
                            return;
                        }
                        token = task.getResult();
                        if (token == null || token.trim().isEmpty()) {
                            error = "Firebase Cloud Messaging 回傳空白 Push Token。";
                        }
                    }
                });
            return true;
        } catch (Exception exception) {
            pending = false;
            error = exception.getMessage();
            return false;
        }
    }

    public static boolean isTokenReady() {
        return token != null && !token.trim().isEmpty();
    }

    public static String getToken() {
        return token;
    }

    public static boolean hasError() {
        return error != null && !error.trim().isEmpty() && !pending;
    }

    public static String getError() {
        return error;
    }

    public static String consumeLaunchPayload(Activity activity) {
        if (activity == null) return null;
        Intent intent = activity.getIntent();
        if (intent == null || !intent.hasExtra("habithero_notification_data")) return null;
        String payload = intent.getStringExtra("habithero_notification_data");
        intent.removeExtra("habithero_notification_data");
        return payload;
    }
}
