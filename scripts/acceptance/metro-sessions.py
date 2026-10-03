"""Three real Metro restarts; never hides overlays or repairs a failed observation."""
import importlib.util, json, os, signal, subprocess, time, urllib.request
from pathlib import Path

os.environ['ONE_CHANCE_ACCEPTANCE_OUTPUT'] = 'artifacts/phase-1b/metro-sessions'
spec = importlib.util.spec_from_file_location('lab', Path(__file__).parent / 'android/run.py')
lab = importlib.util.module_from_spec(spec); spec.loader.exec_module(lab)
IOS = os.environ.get('ONE_CHANCE_IOS_SIMULATOR', 'A3806801-E5BE-4EFD-A58F-E7CB949B8B44')
URL = 'onechance://expo-development-client/?url=http%3A%2F%2F127.0.0.1%3A8082&disableOnboarding=1&disableAutoLaunch=1&disableFab=1'

for cycle in range(1, 4):
    # Cycle 1 preserves the active clients to repeat the original warm-reentry trigger.
    if cycle > 1:
        lab.adb('shell', 'am', 'force-stop', 'com.onechance.mobile')
        subprocess.run(['xcrun', 'simctl', 'terminate', IOS, 'com.onechance.mobile'], check=False)
    env = os.environ.copy(); env['NODE_OPTIONS'] = '--dns-result-order=ipv4first'
    with (lab.OUT / f'metro-{cycle}.log').open('w') as log:
        server = subprocess.Popen(['node', 'node_modules/expo/bin/cli', 'start', '--dev-client', '--localhost', '--port', '8082', '--scheme', 'onechance'], env=env, stdout=log, stderr=subprocess.STDOUT)
        try:
            deadline = time.monotonic() + 60
            while True:
                try:
                    with urllib.request.urlopen('http://127.0.0.1:8082/status', timeout=2) as response:
                        assert response.read() == b'packager-status:running'
                    break
                except (OSError, AssertionError):
                    if time.monotonic() > deadline: raise TimeoutError('Metro startup failed')
                    time.sleep(1)
            lab.adb('shell', 'am', 'start', '-W', '-a', 'android.intent.action.VIEW', '-d', URL)
            subprocess.run(['xcrun', 'simctl', 'openurl', IOS, URL], check=True)
            deadline = time.monotonic() + 60
            android = 'FAIL'
            while time.monotonic() < deadline:
                try:
                    tree = lab.nodes(); lab.find('Fit world', tree)
                    assert lab.status(tree, 'WAL / FULL / FK on')
                    android = 'PASS'; break
                except AssertionError: time.sleep(1)
            lab.snapshot(f'android-metro-{cycle}')
            (lab.OUT / f'android-metro-{cycle}-crash.log').write_text(lab.adb('logcat', '-d', '-b', 'crash'))
            with (lab.OUT / f'ios-metro-{cycle}.log').open('w') as ios_log:
                ios = subprocess.run(['xcodebuild', '-project', 'artifacts/phase-1b/ios-tests/Acceptance.xcodeproj', '-scheme', 'Acceptance', '-destination', f'platform=iOS Simulator,id={IOS}', '-derivedDataPath', 'artifacts/phase-1b/ios-test-build', '-resultBundlePath', str(lab.OUT / f'ios-metro-{cycle}.xcresult'), '-only-testing:Acceptance/Acceptance/testObserveCurrentSession', 'CODE_SIGNING_ALLOWED=NO', 'test'], stdout=ios_log, stderr=subprocess.STDOUT, timeout=180)
            print(json.dumps({'cycle': cycle, 'mode': 'warm reentry' if cycle == 1 else 'fresh process', 'android': android, 'ios': 'PASS' if ios.returncode == 0 else 'FAIL'}), flush=True)
        finally:
            server.send_signal(signal.SIGINT)
            try: server.wait(timeout=20)
            except subprocess.TimeoutExpired: server.terminate(); server.wait(timeout=10)
