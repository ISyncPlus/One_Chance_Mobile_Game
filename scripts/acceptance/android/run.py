"""Native emulator acceptance; requires bundled Pillow and a built test APK."""
import json, os, subprocess, sys, time, xml.etree.ElementTree as ET
from pathlib import Path
from PIL import Image

ADB = os.environ['ANDROID_SDK_ROOT'] + '/platform-tools/adb'
SERIAL = os.environ.get('ANDROID_SERIAL', 'emulator-5554')
OUT = Path(os.environ.get('ONE_CHANCE_ACCEPTANCE_OUTPUT', 'artifacts/phase-1b/android-interactions')); OUT.mkdir(parents=True, exist_ok=True)

def adb(*args, binary=False):
    return subprocess.check_output([ADB, '-s', SERIAL, *args], timeout=40, text=not binary)

def nodes():
    for attempt in range(5):
        adb('shell', 'rm', '-f', '/sdcard/onechance-acceptance.xml')
        output = adb('shell', 'uiautomator', 'dump', '/sdcard/onechance-acceptance.xml')
        if 'dumped to:' in output:
            return ET.fromstring(adb('exec-out', 'cat', '/sdcard/onechance-acceptance.xml'))
        time.sleep(0.2)
    raise AssertionError('Android accessibility dump failed: ' + output)

def bounds(node):
    import re
    return tuple(map(int, re.findall(r'\d+', node.attrib['bounds'])))

def find(label, tree=None):
    tree = nodes() if tree is None else tree
    for n in tree.iter('node'):
        if n.get('content-desc') == label or n.get('text') == label: return bounds(n)
    raise AssertionError(f'{label} absent')

def tap_at(x, y): adb('shell', 'input', 'tap', str(round(x)), str(round(y)))

def button(label):
    x1,y1,x2,y2=find(label); tap_at((x1+x2)/2,(y1+y2)/2)

def snapshot(name):
    image_path=OUT/(name+'.png'); image_path.write_bytes(adb('exec-out','screencap','-p',binary=True))
    tree=nodes(); (OUT/(name+'.xml')).write_bytes(ET.tostring(tree))
    return image_path,tree

def token(name):
    path,tree=snapshot(name)
    x1,y1,x2,y2=find('Diagnostic world. Gold token on a coordinate grid. Use the controls below as alternatives to gestures.',tree)
    image=Image.open(path).convert('RGB'); pixels=image.load()
    points=[(x,y) for y in range(y1,y2) for x in range(x1,x2) if pixels[x,y][0]>220 and 165<pixels[x,y][1]<225 and pixels[x,y][2]<125]
    assert len(points)>10, 'No rendered gold token found'
    return sum(x for x,y in points)/len(points),sum(y for x,y in points)/len(points),max(x for x,y in points)-min(x for x,y in points)

def status(tree,part):
    return [n.get('text','') for n in tree.iter('node') if part in n.get('text','')]

def hit(name):
    x,y,size=token(name+'-before')
    x1,y1,x2,y2=find('Diagnostic world. Gold token on a coordinate grid. Use the controls below as alternatives to gestures.')
    # Stay below Expo's floating dev-menu button and inside rounded canvas corners.
    miss=max([(x1+75,y2-75),(x2-75,y2-75)],key=lambda p:(p[0]-x)**2+(p[1]-y)**2)
    tap_at(*miss); assert status(nodes(),'Miss'), 'Could not clear prior hit status'
    tap_at(x,y)
    path,tree=snapshot(name)
    assert status(tree,'TOKEN HIT'), 'Visible token did not hit'
    print(json.dumps({'step':name,'status':status(tree,'TOKEN HIT'),'token_width_pixels':size}),flush=True)
    return size

def main():
    for attempt in range(30):
        try:
            find('Fit world')
            break
        except AssertionError:
            time.sleep(1)
    else:
        raise AssertionError('Diagnostic did not become ready')
    button('Fit world'); base=hit('baseline')
    canvas=find('Diagnostic world. Gold token on a coordinate grid. Use the controls below as alternatives to gestures.')
    x1,y1,x2,y2=canvas; cx=(x1+x2)/2; cy=(y1+y2)/2
    adb('shell','input','swipe',str(round(cx)),str(round(cy)),str(round(cx+130)),str(round(cy+60)),'700')
    hit('pan')
    result=adb('shell','am','instrument','-w','-e','x',str(cx),'-e','y',str(cy),'-e','span','400','-e','factor','1.8','com.onechance.acceptance/.Acceptance')
    print(result,flush=True); assert 'Two-pointer pinch events delivered' in result
    pinched=hit('pinch'); assert pinched>base*1.1, 'Pinch did not visibly enlarge token'
    button('Zoom +'); zoomed=hit('zoom-in'); assert zoomed>pinched*1.1
    button('Zoom −'); hit('zoom-out')
    button('Fit world'); tap_at(x1+25,y2-25)
    _,tree=snapshot('miss'); assert status(tree,'Miss'), 'Empty-space tap unexpectedly hit'
    button('Move token'); time.sleep(1.5); hit('moved')
    button('Haptic'); _,tree=snapshot('haptic'); assert status(tree,'Haptic API resolved')
    button('Haptics on'); button('Haptic'); _,tree=snapshot('haptic-off'); assert status(tree,'Haptics disabled')
    button('Haptics off')
    # Gather bounds before starting animation, avoiding UI dumps during its 1.2 seconds.
    cap=find('Capture 10s'); move=find('Move token')
    tap_at((cap[0]+cap[2])/2,(cap[1]+cap[3])/2)
    tap_at((move[0]+move[2])/2,(move[1]+move[3])/2)
    adb('shell','input','keyevent','KEYCODE_HOME'); time.sleep(1)
    adb('shell','am','start','-n','com.onechance.mobile/.MainActivity')
    _,tree=snapshot('background-resume'); assert status(tree,'Capture cancelled: app left foreground')
    print(json.dumps({'step':'background-resume','status':status(tree,'Capture cancelled')}),flush=True)
    print('ANDROID INTERACTION SUITE PASSED',flush=True)

if __name__ == "__main__":
    main()
