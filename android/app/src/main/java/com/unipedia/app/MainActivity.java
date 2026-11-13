package com.unipedia.app;

import android.content.Intent;
import android.graphics.Color;
import android.os.Bundle;
import android.view.View;
import android.view.Window;
import androidx.annotation.Keep;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginHandle;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import ee.forgr.capacitor.social.login.GoogleProvider;
import ee.forgr.capacitor.social.login.ModifiedMainActivityForSocialLoginPlugin;
import ee.forgr.capacitor.social.login.SocialLoginPlugin;

public class MainActivity extends BridgeActivity implements ModifiedMainActivityForSocialLoginPlugin {
    @Override
    public void IHaveModifiedTheMainActivityForTheUseWithSocialLoginPlugin() {
        // Requerido pelo SocialLoginPlugin para scopes OAuth do Google (Drive, Calendar, Gmail).
    }

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(ThemeChromePlugin.class);
        super.onCreate(savedInstanceState);
        applySystemBars("#faf8f5", false);
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
}
