"""Real development-client lifecycle checks; records each failure independently."""
import json, subprocess, time
import run as lab

URL = 'onechance://expo-development-client/?url=http%3A%2F%2F127.0.0.1%3A8082&disableOnboarding=1&disableAutoLaunch=1&disableFab=1'

def launch():
    lab.adb('shell', 'am', 'start', '-W', '-a', 'android.intent.action.VIEW', '-d', URL)

def ready():
    deadline = time.monotonic() + 60
    while time.monotonic() < deadline:
        try:
            tree = lab.nodes()
            lab.find('Fit world', tree)
            assert lab.status(tree, 'WAL / FULL / FK on')
            return
        except AssertionError:
            time.sleep(1)
    raise AssertionError('Native diagnostic readiness timed out')

def check(name, action):
    result = {'case': name}
    try:
        action(); ready(); lab.snapshot(name)
        result['result'] = 'PASS'
    except Exception as error:
        result.update(result='FAIL', error=str(error))
    finally:
        (lab.OUT / (name + '-crash.log')).write_text(lab.adb('logcat', '-d', '-b', 'crash'))
        (lab.OUT / (name + '-anr.txt')).write_text(lab.adb('shell', 'dumpsys', 'activity', 'lastanr'))
    print(json.dumps(result), flush=True)

def fresh():
    lab.adb('shell', 'am', 'force-stop', 'com.onechance.mobile'); launch()

def background():
    lab.adb('shell', 'input', 'keyevent', 'KEYCODE_HOME')
    time.sleep(1)
    lab.adb('shell', 'am', 'start', '-W', '-n', 'com.onechance.mobile/.MainActivity')

if __name__ == '__main__':
    for name, action in [('force-stop-launch', fresh), ('background-foreground', background),
                         ('app-reload', lambda: subprocess.run(['node', 'scripts/acceptance/reload.mjs'], check=True))]:
        for cycle in range(1, 4):
            check(f'{name}-{cycle}', action)
    for cycle in range(1, 4):
        fresh(); ready()
        check(f'warm-deep-link-{cycle}', launch)
