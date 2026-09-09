package com.plinkscore.app;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;

import android.content.Context;
import android.content.Intent;
import android.content.pm.ResolveInfo;
import android.net.Uri;

import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;

import org.junit.Test;
import org.junit.runner.RunWith;

import java.util.List;

@RunWith(AndroidJUnit4.class)
public class NativeAuthCallbackTest {

    @Test
    public void appUsesExpectedApplicationId() {
        Context appContext = InstrumentationRegistry.getInstrumentation().getTargetContext();

        assertEquals(
            appContext.getString(R.string.package_name),
            appContext.getPackageName()
        );
    }

    @Test
    public void authCallbackOpensMainActivity() {
        Context appContext = InstrumentationRegistry.getInstrumentation().getTargetContext();
        Intent callbackIntent = new Intent(
            Intent.ACTION_VIEW,
            Uri.parse("plink://auth/callback?code=test-code")
        );
        callbackIntent.addCategory(Intent.CATEGORY_BROWSABLE);
        callbackIntent.setPackage(appContext.getPackageName());

        List<ResolveInfo> handlers = appContext
            .getPackageManager()
            .queryIntentActivities(callbackIntent, 0);

        assertFalse("No activity handles the native auth callback", handlers.isEmpty());
        assertEquals(MainActivity.class.getName(), handlers.get(0).activityInfo.name);
    }
}
