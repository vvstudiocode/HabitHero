package com.vvstudiocode.habithero;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Intent;
import android.os.Build;

import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

import org.json.JSONException;
import org.json.JSONObject;

public final class HabitHeroFirebaseMessagingService extends FirebaseMessagingService {
    private static final String CHANNEL_ID = "habithero-default";

    @Override
    public void onMessageReceived(RemoteMessage message) {
        String payload = createPayload(message);
        if (payload == null) return;

        String title = message.getNotification() == null
            ? message.getData().get("title")
            : message.getNotification().getTitle();
        String body = message.getNotification() == null
            ? message.getData().get("body")
            : message.getNotification().getBody();
        showNotification(
            title == null || title.trim().isEmpty() ? "習慣冒險島" : title,
            body == null || body.trim().isEmpty() ? "有新的任務通知。" : body,
            payload);
    }

    private String createPayload(RemoteMessage message) {
        String taskId = message.getData().get("taskId");
        String scheduleId = message.getData().get("scheduleId");
        String event = message.getData().get("event");
        if ((taskId == null || taskId.trim().isEmpty())
            && (scheduleId == null || scheduleId.trim().isEmpty())) return null;

        try {
            JSONObject payload = new JSONObject();
            if (taskId != null && !taskId.trim().isEmpty()) payload.put("taskId", taskId);
            if (scheduleId != null && !scheduleId.trim().isEmpty()) payload.put("scheduleId", scheduleId);
            payload.put("event", event == null || event.trim().isEmpty() ? "created" : event);
            return payload.toString();
        } catch (JSONException exception) {
            return null;
        }
    }

    private void showNotification(String title, String body, String payload) {
        NotificationManager manager = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        if (manager == null) return;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            manager.createNotificationChannel(new NotificationChannel(
                CHANNEL_ID,
                "HabitHero",
                NotificationManager.IMPORTANCE_DEFAULT));
        }

        Intent launchIntent = getPackageManager().getLaunchIntentForPackage(getPackageName());
        if (launchIntent == null) return;
        launchIntent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        launchIntent.putExtra("habithero_notification_data", payload);
        PendingIntent pendingIntent = PendingIntent.getActivity(
            this,
            payload.hashCode(),
            launchIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        Notification.Builder builder = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
            ? new Notification.Builder(this, CHANNEL_ID)
            : new Notification.Builder(this);
        builder
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentTitle(title)
            .setContentText(body)
            .setAutoCancel(true)
            .setContentIntent(pendingIntent);
        manager.notify(payload.hashCode(), builder.build());
    }
}
