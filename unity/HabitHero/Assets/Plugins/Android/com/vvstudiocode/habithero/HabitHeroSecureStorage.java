package com.vvstudiocode.habithero;

import android.content.Context;
import android.content.SharedPreferences;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;

import java.nio.ByteBuffer;
import java.security.KeyStore;
import java.util.Arrays;

import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

public final class HabitHeroSecureStorage {
    private static final String PREFERENCES = "HabitHeroSecureStorage.v1";
    private static final String KEY_ALIAS = "HabitHeroSupabaseSessionKey.v1";
    private static final String KEYSTORE = "AndroidKeyStore";
    private static final int GCM_TAG_BITS = 128;

    private HabitHeroSecureStorage() {}

    public static String load(Context context, String key) {
        try {
            String encoded = preferences(context).getString(key, null);
            if (encoded == null || encoded.isEmpty()) return null;
            byte[] packed = Base64.decode(encoded, Base64.NO_WRAP);
            if (packed.length <= 12) return null;
            byte[] iv = Arrays.copyOfRange(packed, 0, 12);
            byte[] encrypted = Arrays.copyOfRange(packed, 12, packed.length);
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, getOrCreateKey(), new GCMParameterSpec(GCM_TAG_BITS, iv));
            return new String(cipher.doFinal(encrypted), java.nio.charset.StandardCharsets.UTF_8);
        } catch (Exception ignored) {
            return null;
        }
    }

    public static boolean save(Context context, String key, String value) {
        try {
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE, getOrCreateKey());
            byte[] iv = cipher.getIV();
            byte[] encrypted = cipher.doFinal(value.getBytes(java.nio.charset.StandardCharsets.UTF_8));
            ByteBuffer packed = ByteBuffer.allocate(iv.length + encrypted.length);
            packed.put(iv);
            packed.put(encrypted);
            return preferences(context)
                .edit()
                .putString(key, Base64.encodeToString(packed.array(), Base64.NO_WRAP))
                .commit();
        } catch (Exception ignored) {
            return false;
        }
    }

    public static boolean clear(Context context, String key) {
        return preferences(context).edit().remove(key).commit();
    }

    private static SharedPreferences preferences(Context context) {
        return context.getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE);
    }

    private static SecretKey getOrCreateKey() throws Exception {
        KeyStore keyStore = KeyStore.getInstance(KEYSTORE);
        keyStore.load(null);
        if (keyStore.containsAlias(KEY_ALIAS)) {
            return ((KeyStore.SecretKeyEntry) keyStore.getEntry(KEY_ALIAS, null)).getSecretKey();
        }

        KeyGenerator generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, KEYSTORE);
        generator.init(new KeyGenParameterSpec.Builder(
                KEY_ALIAS,
                KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
            .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
            .setUserAuthenticationRequired(false)
            .build());
        return generator.generateKey();
    }
}
