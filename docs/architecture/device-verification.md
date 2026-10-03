# Native verification and performance procedure

## Build prerequisites

Use a native development client with the locked dependency set. iOS requires Xcode and a simulator or signed device. Android requires Java, SDK/build tools, and an emulator or device. Configure ANDROID_HOME/ANDROID_SDK_ROOT to the actual SDK containing the chosen AVD's system image. Record any external setup blocker precisely.

The [Phase 1B report](../phase-1b-verification.md) records native lifecycle source evidence, repeated launch/reload results and environment failures. Reusable host-only native acceptance procedures are in [scripts/acceptance](../../scripts/acceptance/README.md). Keep failed trials separate from successful retries.

Run `npm run check`, `npm run check:dependencies`, and `npm run doctor`. Start Metro with `npm start -- --localhost`; build and launch with the native scripts. Inspect Metro, native logs, and on-screen error overlays.

During a server restart, terminate the client first, start one Metro process, wait for its ready status, then launch the client again. Ordinary Metro reloads avoid external deep-link reentry during asynchronous ReactHost teardown. This is a tested development procedure, not a fix for the historical launcher exception. Save native crash/ANR and Metro logs before resetting a failed session. On this host, Node needed `NODE_OPTIONS=--dns-result-order=ipv4first` for URLs using 127.0.0.1; a Java IPv4 build-process retry resolved Maven `No route to host` failures. Neither setting changes application networking.

## Rendering lab checklist

1. Confirm landscape dimensions, safe-area inset readout, visible controls, and the full grid at Fit world.
2. Confirm the coral horizontal X axis, mint vertical Y axis, two rings, and one gold token render.
3. Tap the token: expect TOKEN HIT and world coordinates near its center. Tap empty space: expect Miss.
4. Drag the world, then tap the token again. Repeat after pinch zoom and focal-point movement. The token's visible location must remain its hit region.
5. Move the token. Check smooth progression to the other ring. Tap its current position during movement and after arrival.
6. Use Zoom + / Zoom − and Fit world. Fit should restore a centered scene. Test actual two-finger pinch separately from the buttons.
7. Invoke Haptic; check API completion and test sensation on supported physical hardware. A simulator cannot establish tactile behaviour.
8. Toggle the haptic preference. Disabled means no adapter invocation.
9. Confirm SQLite reports WAL / FULL / FK on. This verifies connection policy, not match recovery.
10. Background/resume. Token animation must stop while inactive; an in-progress frame capture is cancelled. No gameplay state exists to lose.
11. Try both landscape directions, a smaller phone, and a tablet. Safe areas must keep controls away from system UI. Large text can wrap the lab's controls; this is not a final consumer accessibility implementation.

## Frame timing

Capture 10s while panning, pinching, and moving the token. Record device model, OS, build configuration, refresh rate, thermal conditions, frame count, callback rate, worst interval, and intervals above 20 ms. The sampler updates shared values per frame and crosses to React once on completion. It cancels if backgrounded.

The 20 ms count is a coarse missed-60-Hz-budget indicator, not an exact dropped-frame counter. Callback rate is not GPU-rendered FPS. Debug builds, simulators, instrumentation, and variable-refresh displays can distort results. Do not claim 60 FPS from this sample.

Use Xcode Instruments animation/hitch tools and Android Studio System Trace/Perfetto on physical devices to correlate UI scheduling, GPU work, memory, and thermal load. A future approved profiling build may expose the isolated lab while retaining release optimization; ordinary release builds exclude it. Measure representative production artwork once available.

## Release/offline checks

Export both native bundles and verify diagnostic markers are absent. Run a packaged release build with Metro stopped and network unavailable. The foundation screen should cold-launch and SQLite should initialize. Full launch-to-victory airplane-mode acceptance is deferred until real gameplay exists.
