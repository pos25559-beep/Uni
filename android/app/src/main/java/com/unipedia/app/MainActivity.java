package com.unipedia.app;

import android.app.ActivityManager;
import android.app.NotificationManager;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.os.Bundle;
import android.provider.Settings;
import android.view.View;
import android.view.Window;
import androidx.annotation.Keep;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginHandle;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import ee.forgr.capacitor.social.login.GoogleProvider;
import ee.forgr.capacitor.social.login.ModifiedMainActivityForSocialLoginPlugin;
import ee.forgr.capacitor.social.login.SocialLoginPlugin;

public class MainActivity extends BridgeActivity implements ModifiedMainActivityForSocialLoginPlugin {
    private static final String SHIELD_PREFS = "unipedia_focus_shield";
    private static final String KEY_MANAGED_DND = "managed_dnd_active";
    private static final String KEY_PREV_FILTER = "prev_interruption_filter";

    @Override
    public void IHaveModifiedTheMainActivityForTheUseWithSocialLoginPlugin() {
        // Requerido pelo SocialLoginPlugin para scopes OAuth do Google (Drive, Calendar, Gmail).
    }

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(ThemeChromePlugin.class);
        registerPlugin(FocusShieldPlugin.class);
        super.onCreate(savedInstanceState);
        restoreManagedDnd();
        applySystemBars("#faf8f5", false);
    }

    @Override
    public void onDestroy() {
        restoreManagedDnd();
        super.onDestroy();
    }

    /** Restaura o filtro de interrupções anterior se o modo Não Incomodar tiver sido gerido pela app. */
    void restoreManagedDnd() {
        SharedPreferences prefs = getSharedPreferences(SHIELD_PREFS, Context.MODE_PRIVATE);
        if (!prefs.getBoolean(KEY_MANAGED_DND, false)) return;
        int prevFilter = prefs.getInt(KEY_PREV_FILTER, NotificationManager.INTERRUPTION_FILTER_ALL);
        prefs.edit().putBoolean(KEY_MANAGED_DND, false).remove(KEY_PREV_FILTER).apply();
        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null || !nm.isNotificationPolicyAccessGranted()) return;
        try {
            nm.setInterruptionFilter(prevFilter);
        } catch (SecurityException ignored) {
            // Permissão revogada externamente.
        }
    }

    boolean isLockTaskActive() {
        ActivityManager am = (ActivityManager) getSystemService(Context.ACTIVITY_SERVICE);
        if (am == null) return false;
        return am.getLockTaskModeState() != ActivityManager.LOCK_TASK_MODE_NONE;
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode >= GoogleProvider.REQUEST_AUTHORIZE_GOOGLE_MIN
                && requestCode < GoogleProvider.REQUEST_AUTHORIZE_GOOGLE_MAX) {
            PluginHandle pluginHandle = getBridge().getPlugin("SocialLogin");
            if (pluginHandle == null) return;
            Plugin plugin = pluginHandle.getInstance();
            if (plugin instanceof SocialLoginPlugin) {
                ((SocialLoginPlugin) plugin).handleGoogleLoginIntent(requestCode, data);
            }
        }
    }

    private void applySystemBars(String hexColor, boolean isDark) {
        int color = Color.parseColor(hexColor);
        Window window = getWindow();
        View decorView = window.getDecorView();
        decorView.setBackgroundColor(color);
        View content = findViewById(android.R.id.content);
        if (content != null) {
            content.setBackgroundColor(color);
        }
        WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(window, decorView);
        controller.setAppearanceLightStatusBars(!isDark);
        controller.setAppearanceLightNavigationBars(!isDark);
    }

    @Keep
    @CapacitorPlugin(name = "ThemeChrome")
    public static class ThemeChromePlugin extends Plugin {
        @PluginMethod
        public void apply(PluginCall call) {
            String color = call.getString("color", "#faf8f5");
            boolean isDark = Boolean.TRUE.equals(call.getBoolean("isDark", false));
            getActivity().runOnUiThread(() -> {
                if (getActivity() instanceof MainActivity) {
                    ((MainActivity) getActivity()).applySystemBars(color, isDark);
                }
                call.resolve();
            });
        }
    }

    @Keep
    @CapacitorPlugin(name = "FocusShield")
    public static class FocusShieldPlugin extends Plugin {
        @PluginMethod
        public void getCapabilities(PluginCall call) {
            Context ctx = getContext();
            NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
            boolean dndGranted = nm != null && nm.isNotificationPolicyAccessGranted();
            int interruptionFilter = nm != null
                    ? nm.getCurrentInterruptionFilter()
                    : NotificationManager.INTERRUPTION_FILTER_ALL;
            boolean inLockTask = getActivity() instanceof MainActivity
                    && ((MainActivity) getActivity()).isLockTaskActive();
            SharedPreferences prefs = ctx.getSharedPreferences(SHIELD_PREFS, Context.MODE_PRIVATE);

            JSObject ret = new JSObject();
            ret.put("dndSupported", nm != null);
            ret.put("dndGranted", dndGranted);
            ret.put("screenPinningSupported", true);
            ret.put("inLockTask", inLockTask);
            ret.put("dndActiveByApp", prefs.getBoolean(KEY_MANAGED_DND, false));
            ret.put("interruptionFilter", interruptionFilter);
            call.resolve(ret);
        }

        @PluginMethod
        public void openDndSettings(PluginCall call) {
            try {
                Intent intent = new Intent(Settings.ACTION_NOTIFICATION_POLICY_ACCESS_SETTINGS);
                getActivity().startActivity(intent);
                call.resolve();
            } catch (Exception err) {
                call.reject("Não foi possível abrir as definições de Não Incomodar.", err);
            }
        }

        @PluginMethod
        public void activate(PluginCall call) {
            boolean wantDnd = Boolean.TRUE.equals(call.getBoolean("dnd", false));
            boolean wantPin = Boolean.TRUE.equals(call.getBoolean("screenPinning", false));
            getActivity().runOnUiThread(() -> {
                boolean dndActivated = false;
                boolean pinningRequested = false;
                Context ctx = getContext();

                if (wantDnd) {
                    NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
                    if (nm != null && nm.isNotificationPolicyAccessGranted()) {
                        SharedPreferences prefs = ctx.getSharedPreferences(SHIELD_PREFS, Context.MODE_PRIVATE);
                        if (!prefs.getBoolean(KEY_MANAGED_DND, false)) {
                            prefs.edit()
                                    .putInt(KEY_PREV_FILTER, nm.getCurrentInterruptionFilter())
                                    .putBoolean(KEY_MANAGED_DND, true)
                                    .apply();
                        }
                        try {
                            nm.setInterruptionFilter(NotificationManager.INTERRUPTION_FILTER_PRIORITY);
                            dndActivated = true;
                        } catch (SecurityException ignored) {
                            prefs.edit().putBoolean(KEY_MANAGED_DND, false).remove(KEY_PREV_FILTER).apply();
                        }
                    }
                }

                if (wantPin && getActivity() instanceof MainActivity) {
                    MainActivity act = (MainActivity) getActivity();
                    if (!act.isLockTaskActive()) {
                        try {
                            act.startLockTask();
                            pinningRequested = true;
                        } catch (Exception ignored) {
                            // Alguns launchers/ROMs podem bloquear startLockTask em certas condições.
                        }
                    } else {
                        pinningRequested = true;
                    }
                }

                JSObject ret = new JSObject();
                ret.put("dndActivated", dndActivated);
                ret.put("pinningRequested", pinningRequested);
                call.resolve(ret);
            });
        }

        @PluginMethod
        public void deactivate(PluginCall call) {
            boolean restoreDnd = Boolean.TRUE.equals(call.getBoolean("restoreDnd", true));
            boolean stopPinning = Boolean.TRUE.equals(call.getBoolean("stopPinning", true));
            getActivity().runOnUiThread(() -> {
                if (getActivity() instanceof MainActivity) {
                    MainActivity act = (MainActivity) getActivity();
                    if (restoreDnd) {
                        act.restoreManagedDnd();
                    }
                    if (stopPinning && act.isLockTaskActive()) {
                        try {
                            act.stopLockTask();
                        } catch (Exception ignored) {
                            // O sistema pode já ter libertado o lock task.
                        }
                    }
                }
                call.resolve();
            });
        }
    }
}
