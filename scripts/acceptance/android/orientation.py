"""Actual emulator sensor rotation and current-sprite hits in both landscapes."""
import json, time
import run as lab

lab.adb('shell', 'settings', 'put', 'system', 'accelerometer_rotation', '1')
rotations = set()
for direction, acceleration in [('left', '9.81:0:0'), ('right', '-9.81:0:0')]:
    lab.adb('emu', 'sensor', 'set', 'acceleration', acceleration)
    time.sleep(2)
    tree = lab.nodes(); rotation = tree.get('rotation'); rotations.add(rotation)
    assert rotation in ('1', '3'), f'Expected landscape, observed rotation {rotation}'
    lab.button('Fit world'); lab.hit('landscape-' + direction)
    lab.button('Zoom +'); lab.hit('landscape-' + direction + '-zoom')
    lab.button('Fit world'); _, tree = lab.snapshot('landscape-' + direction + '-fit')
    print(json.dumps({'direction': direction, 'rotation': rotation, 'metrics': lab.status(tree, 'Safe L')}), flush=True)
assert rotations == {'1', '3'}, 'Both landscape directions must actually occur'
