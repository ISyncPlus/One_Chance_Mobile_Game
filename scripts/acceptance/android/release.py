"""Packaged Release only. Requires Metro stopped and emulator airplane mode on."""
import json, subprocess, time, urllib.request
import run as lab

try:
    urllib.request.urlopen('http://127.0.0.1:8082/status', timeout=2)
except OSError:
    pass
else:
    raise AssertionError('Project Metro is still running')
assert lab.adb('shell', 'settings', 'get', 'global', 'airplane_mode_on').strip() == '1'
assert not lab.adb('reverse', '--list').strip(), 'adb networking is still forwarded'

for cycle in range(1, 4):
    lab.adb('shell', 'am', 'force-stop', 'com.onechance.mobile')
    pid = subprocess.run([lab.ADB, '-s', lab.SERIAL, 'shell', 'pidof', 'com.onechance.mobile'], capture_output=True, text=True, timeout=10)
    assert pid.returncode == 1 and not pid.stdout.strip(), f'App process survived force-stop: {pid.stdout} {pid.stderr}'
    launch = lab.adb('shell', 'am', 'start', '-W', '-n', 'com.onechance.mobile/.MainActivity')
    deadline = time.monotonic() + 30
    while True:
        tree = lab.nodes()
        if lab.status(tree, 'Gameplay is not available'): break
        if time.monotonic() > deadline: raise AssertionError('Packaged Release failed to render')
        time.sleep(1)
    assert not lab.status(tree, 'RENDERING LAB')
    lab.snapshot(f'offline-cold-{cycle}')
    lab.adb('shell', 'input', 'keyevent', 'KEYCODE_HOME')
    lab.adb('shell', 'am', 'start', '-W', '-n', 'com.onechance.mobile/.MainActivity')
    assert lab.status(lab.nodes(), 'Gameplay is not available')
    print(json.dumps({'cycle': cycle, 'cold_launch': 'PASS', 'resume': 'PASS', 'airplane_mode': 1, 'launch_output': launch}), flush=True)

(lab.OUT / 'crash.log').write_text(lab.adb('logcat', '-d', '-b', 'crash'))
(lab.OUT / 'lastanr.txt').write_text(lab.adb('shell', 'dumpsys', 'activity', 'lastanr'))
