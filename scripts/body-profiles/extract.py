"""Extract side-view body profiles from the CC0 MakeHuman base mesh.

Writes src/draw/bodyProfiles.json: for each sex and body segment, the front and
back outline (as a fraction of standing height) at N stations along the bone.

Usage: python3 scripts/body-profiles/extract.py
"""
import gzip
import json
import math
import urllib.request
from pathlib import Path

try:
    import numpy as np
except ImportError:
    raise SystemExit('needs numpy: python3 -m pip install numpy')

CACHE = Path(__file__).parent / '.cache'
OUT = Path(__file__).parents[2] / 'src/draw/bodyProfiles.json'
MH_SHA = 'a8bc2d54ff0ac92e78ff71431b1023eda42bf482'
ANNY_SHA = '8f35dc2df1c4062fd2fae86734f9705de50c0c2b'
MH = f'https://raw.githubusercontent.com/makehumancommunity/makehuman/{MH_SHA}/makehuman/data'
ANNY = (f'https://raw.githubusercontent.com/naver/anny/{ANNY_SHA}'
        '/src/anny/data/mpfb2/targets/macrodetails')
N = 25


def fetch(url, name):
    CACHE.mkdir(parents=True, exist_ok=True)
    path = CACHE / name
    if not path.exists():
        try:
            with urllib.request.urlopen(url, timeout=60) as r:
                path.write_bytes(r.read())
        except Exception:
            raise SystemExit(f'download failed: {url}')
    return path


def load_obj(fn):
    V = []
    for line in open(fn):
        if line.startswith('v '):
            V.append([float(x) for x in line.split()[1:4]])
    return np.array(V)


def load_target(fn):
    d = []
    with gzip.open(fn, 'rt') as f:
        for line in f:
            if line.startswith('#') or not line.strip():
                continue
            i, x, y, z = line.split()
            d.append((int(i), float(x), float(y), float(z)))
    return d


def apply(V, targets, weight):
    V = V.copy()
    for t in targets:
        for i, x, y, z in t:
            V[i] += weight * np.array([x, y, z])
    return V


base = load_obj(fetch(f'{MH}/3dobjs/base.obj', 'base.obj'))
skel = json.load(open(fetch(f'{MH}/rigs/default.mhskel', 'default.mhskel')))
weights = json.load(open(fetch(f'{MH}/rigs/default_weights.mhw', 'default_weights.mhw')))['weights']

NBODY = 13380
owner = np.full(NBODY, '', dtype=object)
best = np.zeros(NBODY)
for bone, lst in weights.items():
    for i, wgt in lst:
        if i < NBODY and wgt > best[i]:
            best[i] = wgt
            owner[i] = bone


def joint(V, name):
    return V[skel['joints'][name]].mean(axis=0)


def head_of(V, bone):
    return joint(V, skel['bones'][bone]['head'])


def tail_of(V, bone):
    return joint(V, skel['bones'][bone]['tail'])


GROUPS = {
    'thigh': lambda b: b in ('upperleg01.R', 'upperleg02.R'),
    'calf': lambda b: b in ('lowerleg01.R', 'lowerleg02.R'),
    'upperArm': lambda b: b in ('upperarm01.R', 'upperarm02.R'),
    'forearm': lambda b: b in ('lowerarm01.R', 'lowerarm02.R'),
    'torso': lambda b: b == 'root' or b.startswith('spine') or b.startswith('pelvis') or b.startswith('breast')
    or b.startswith('clavicle') or b.startswith('shoulder01'),
    'head': lambda b: b.startswith('neck') or b == 'head' or b == 'jaw' or b.startswith('special')
    or b.startswith('eye') or b.startswith('oculi') or b.startswith('orbicularis') or b.startswith('oris')
    or b.startswith('levator') or b.startswith('risorius') or b.startswith('temporalis') or b.startswith('tongue'),
}
RANGES = {'thigh': (0.0, 1.0), 'calf': (0.0, 1.0), 'upperArm': (0.0, 1.0), 'forearm': (0.0, 1.0),
          'torso': (-0.2, 1.12), 'head': (-0.2, 1.0)}


def axis(V, seg):
    return {
        'thigh': lambda: (head_of(V, 'upperleg01.R'), head_of(V, 'lowerleg01.R')),
        'calf': lambda: (head_of(V, 'lowerleg01.R'), head_of(V, 'foot.R')),
        'upperArm': lambda: (head_of(V, 'upperarm01.R'), head_of(V, 'lowerarm01.R')),
        'forearm': lambda: (head_of(V, 'lowerarm01.R'), head_of(V, 'wrist.R')),
        'torso': lambda: (head_of(V, 'upperleg01.R'), head_of(V, 'upperarm01.R')),
        'head': lambda: (head_of(V, 'neck01'), tail_of(V, 'head')),
    }[seg]()


def frame(V, seg):
    A, B = axis(V, seg)
    d = B - A
    L = np.linalg.norm(d)
    d = d / L
    z = np.array([0.0, 0.0, 1.0])
    f = z - (z @ d) * d
    f /= np.linalg.norm(f)
    return A, d, f, L


def profile(V, seg, H):
    A, d, f, L = frame(V, seg)
    sel = np.array([GROUPS[seg](b) for b in owner])
    P = V[:NBODY][sel] - A
    t = (P @ d) / L
    s = P @ f
    lo, hi = RANGES[seg]
    st = np.linspace(lo, hi, N)
    half = (hi - lo) / (N - 1) * 1.25
    front, back = [], []
    for c in st:
        m = np.abs(t - c) <= half
        front.append(np.percentile(s[m], 97) if m.sum() >= 6 else np.nan)
        back.append(np.percentile(s[m], 3) if m.sum() >= 6 else np.nan)
    front = np.array(front)
    back = np.array(back)
    for arr in (front, back):
        idx = np.arange(N)
        ok = ~np.isnan(arr)
        arr[~ok] = np.interp(idx[~ok], idx[ok], arr[ok])
        k = np.array([1, 3, 6, 8, 6, 3, 1], float)
        k /= k.sum()
        arr[:] = np.convolve(np.pad(arr, 3, mode='edge'), k, mode='valid')
    return {'range': [lo, hi], 'front': [round(float(x) / H, 5) for x in front],
            'back': [round(float(x) / H, 5) for x in back], 'lengthOverH': round(float(L) / H, 5)}


out = {
    'stations': N,
    'source': {
        'license': 'CC0-1.0',
        'makehuman': MH_SHA,
        'anny': ANNY_SHA,
        'note': 'Derived from the MakeHuman base mesh and targets (CC0). '
                'Regenerate with scripts/body-profiles/extract.py',
    },
}
for sex in ('male', 'female'):
    targets = [load_target(fetch(f'{ANNY}/{e}-{sex}-young.target.gz', f'{e}-{sex}.target.gz'))
               for e in ('african', 'asian', 'caucasian')]
    V = apply(base, targets, 1 / 3)
    body = V[:NBODY]
    H = float(body[:, 1].max() - body[:, 1].min())
    out[sex] = {'heightUnits': round(H, 4)}
    for seg in GROUPS:
        out[sex][seg] = profile(V, seg, H)
    A, d, f, L = frame(V, 'torso')
    nb = head_of(V, 'neck01') - A
    out[sex]['neckBase'] = [round(float(nb @ d / L), 5), round(float(nb @ f / H), 5)]
    _, hd, _, _ = frame(V, 'head')
    out[sex]['headRestLeanDeg'] = round(math.degrees(math.atan2(hd[2], hd[1])), 2)
    depth = {k: round(max(a - b for a, b in zip(out[sex][k]['front'], out[sex][k]['back'])), 4) for k in GROUPS}
    length = {k: out[sex][k]['lengthOverH'] for k in GROUPS}
    print(sex, 'length/H', length)
    print(sex, 'max depth/H', depth, 'headRestLeanDeg', out[sex]['headRestLeanDeg'])

OUT.write_text(json.dumps(out, indent=1) + '\n')
print('wrote', OUT)
