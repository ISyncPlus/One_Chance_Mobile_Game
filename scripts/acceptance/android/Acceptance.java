package com.onechance.acceptance;

import android.app.Instrumentation;
import android.os.Bundle;
import android.os.SystemClock;
import android.view.InputDevice;
import android.view.MotionEvent;
import android.view.accessibility.AccessibilityNodeInfo;

/** Test APK only: injects a genuine two-pointer gesture into the running lab. */
public final class Acceptance extends Instrumentation {
  private Bundle args;
  @Override public void onCreate(Bundle arguments) { args = arguments; start(); }
  @Override public void onStart() {
    Bundle result = new Bundle();
    try {
      AccessibilityNodeInfo root = getUiAutomation().getRootInActiveWindow();
      for (int attempt = 0; root == null && attempt < 50; attempt++) {
        SystemClock.sleep(100);
        root = getUiAutomation().getRootInActiveWindow();
      }
      if (root == null || !"com.onechance.mobile".contentEquals(root.getPackageName()))
        throw new IllegalStateException("One Chance must be the foreground app; observed " + (root == null ? "no accessibility root" : root.getPackageName()));
      float x = Float.parseFloat(args.getString("x"));
      float y = Float.parseFloat(args.getString("y"));
      float span = Float.parseFloat(args.getString("span", "100"));
      float factor = Float.parseFloat(args.getString("factor", "1.3"));
      long down = SystemClock.uptimeMillis();
      send(down, MotionEvent.ACTION_DOWN, x, y, span, 1);
      send(down, MotionEvent.ACTION_POINTER_DOWN | (1 << 8), x, y, span, 2);
      for (int i = 1; i <= 40; i++) {
        SystemClock.sleep(20);
        send(down, MotionEvent.ACTION_MOVE, x, y, span * (1 + (factor - 1) * i / 40), 2);
      }
      send(down, MotionEvent.ACTION_POINTER_UP | (1 << 8), x, y, span * factor, 2);
      send(down, MotionEvent.ACTION_UP, x - span * factor / 2, y, 0, 1);
      result.putString("result", "Two-pointer pinch events delivered");
      finish(0, result);
    } catch (Exception error) {
      result.putString("error", error.toString());
      finish(1, result);
    }
  }
  private void send(long down, int action, float x, float y, float span, int count) {
    MotionEvent.PointerProperties[] properties = new MotionEvent.PointerProperties[count];
    MotionEvent.PointerCoords[] coords = new MotionEvent.PointerCoords[count];
    for (int i = 0; i < count; i++) {
      properties[i] = new MotionEvent.PointerProperties(); properties[i].id = i;
      properties[i].toolType = MotionEvent.TOOL_TYPE_FINGER;
      coords[i] = new MotionEvent.PointerCoords();
      coords[i].x = x + (i == 0 ? -span / 2 : span / 2); coords[i].y = y;
      coords[i].pressure = 1; coords[i].size = 0.1f;
    }
    MotionEvent event = MotionEvent.obtain(down, SystemClock.uptimeMillis(), action, count, properties, coords, 0, 0, 1, 1, 0, 0, InputDevice.SOURCE_TOUCHSCREEN, 0);
    boolean delivered = getUiAutomation().injectInputEvent(event, true);
    event.recycle();
    if (!delivered) throw new IllegalStateException("Native event injection rejected");
  }
}
