"""Bake original rounded 3D models into orthographic game sprites.

Python 3 + NumPy + Pillow. No browser, external art or game-state manipulation.
Uses a depth buffer, interpolated normals, directional light and soft cast shadows.
"""
from pathlib import Path
import json
import math
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'verification/volume-render'
OUT.mkdir(parents=True, exist_ok=True)
ELEV = math.asin(18 / 34)
VIEW = np.array([math.cos(ELEV) / 2**.5, math.sin(ELEV), math.cos(ELEV) / 2**.5])
LIGHT = np.array([-3.5, 8, 5.5]); LIGHT /= np.linalg.norm(LIGHT)
HALF = LIGHT + VIEW; HALF /= np.linalg.norm(HALF)
RIGHT = np.array([1, 0, -1]) / 2**.5
DOWN = np.array([math.sin(ELEV) / 2**.5, -math.cos(ELEV), math.sin(ELEV) / 2**.5])
CREAM = '#fff4cb'; WOOD = '#d68b39'; DARK = '#27616b'

def rgb(color):
    return np.array([int(color[i:i+2],16)/255 for i in (1,3,5)])

def rotation(axis, angle):
    a=math.radians(angle); c=math.cos(a); s=math.sin(a)
    if axis=='x': return np.array([[1,0,0],[0,c,-s],[0,s,c]])
    if axis=='y': return np.array([[c,0,s],[0,1,0],[-s,0,c]])
    return np.array([[c,-s,0],[s,c,0],[0,0,1]])

class Model:
    def __init__(self): self.parts=[]
    def mesh(self,vertices,normals,faces,color,center=(0,0,0),rotate=None):
        v=np.asarray(vertices,dtype=float); n=np.asarray(normals,dtype=float)
        if rotate is not None: v=v@rotate.T; n=n@rotate.T
        v+=center
        self.parts.append((v,n,np.asarray(faces,dtype=int),rgb(color)))
    def box(self,center,size,color,r=.08,rotate=None):
        h=np.asarray(size)/2; r=min(r,min(h)*.8); core=h-r
        vertices=[];normals=[];faces=[]
        for axis in range(3):
            u,v=[k for k in range(3) if k!=axis]
            def samples(k):
                return np.array([-h[k],-h[k]+r*.18,-h[k]+r*.50,-h[k]+r,h[k]-r,h[k]-r*.50,h[k]-r*.18,h[k]])
            us,vs=samples(u),samples(v)
            for sign in (-1,1):
                start=len(vertices)
                for a in us:
                    for b in vs:
                        p=np.zeros(3);p[axis]=sign*h[axis];p[u]=a;p[v]=b
                        nearest=np.clip(p,-core,core);normal=p-nearest;normal/=np.linalg.norm(normal)
                        vertices.append(nearest+normal*r);normals.append(normal)
                for i in range(len(us)-1):
                    for j in range(len(vs)-1):
                        q=start+i*len(vs)+j
                        faces.extend([[q,q+1,q+len(vs)],[q+1,q+len(vs)+1,q+len(vs)]])
        self.mesh(vertices,normals,faces,color,center,rotate)
    def sphere(self,center,radii,color,rotate=None,rings=10,sectors=18):
        vertices=[];normals=[];faces=[];r=np.asarray(radii)
        for i in range(rings+1):
            a=math.pi*i/rings
            for j in range(sectors):
                b=2*math.pi*j/sectors;unit=np.array([math.sin(a)*math.cos(b),math.cos(a),math.sin(a)*math.sin(b)])
                vertices.append(unit*r);normal=unit/r;normal/=np.linalg.norm(normal);normals.append(normal)
        for i in range(rings):
            for j in range(sectors):
                k=i*sectors+j; l=i*sectors+(j+1)%sectors
                faces.extend([[k,l,k+sectors],[l,l+sectors,k+sectors]])
        self.mesh(vertices,normals,faces,color,center,rotate)
    def cylinder(self,center,radius,height,color,axis='y',rotate=None):
        vertices=[];normals=[];faces=[];sectors=20;bevel=min(radius*.15,height*.18)
        profile=[(0,-height/2),(radius-bevel,-height/2),(radius,-height/2+bevel),(radius,height/2-bevel),(radius-bevel,height/2),(0,height/2)]
        for k,(r,y) in enumerate(profile):
            for j in range(sectors):
                a=j*math.pi*2/sectors;vertices.append([r*math.cos(a),y,r*math.sin(a)])
                ny=-1 if k<2 else 1 if k>3 else 0
                n=np.array([math.cos(a)*(1-abs(ny)),ny,math.sin(a)*(1-abs(ny))]);normals.append(n)
        for k in range(len(profile)-1):
            for j in range(sectors):
                a=k*sectors+j;b=k*sectors+(j+1)%sectors;faces.extend([[a,b,a+sectors],[b,b+sectors,a+sectors]])
        orient=rotation('z',90) if axis=='x' else rotation('x',90) if axis=='z' else np.eye(3)
        if rotate is not None:orient=rotate@orient
        self.mesh(vertices,normals,faces,color,center,orient)
    def beam(self,a,b,width,color):
        a=np.asarray(a);b=np.asarray(b);direction=b-a;length=np.linalg.norm(direction);up=direction/length
        right=np.cross(up,[0,0,1] if abs(up[2])<.9 else [1,0,0]);right/=np.linalg.norm(right)
        front=np.cross(right,up);orient=np.column_stack([right,up,front])
        self.box((a+b)/2,(width,length,width),color,width*.3,orient)

def pot(m,x,z,y=0):
    m.cylinder((x,y+.2,z),.23,.38,'#f58b43')
    m.cylinder((x,y+.39,z),.26,.10,'#ffc06b')
    m.sphere((x,y+.51,z),(.31,.26,.29),'#4db83b')
    for dx,dz in [(-.17,.08),(.14,.13),(.02,-.12)]:
        m.sphere((x+dx,y+.67,z+dz),(.12,.08,.12),'#ffebfa')
        m.sphere((x+dx,y+.73,z+dz),(.045,.035,.045),'#ffd13b')

def roof(m,x,y,z,width,depth,rise,color,striped=False):
    angle=math.degrees(math.atan2(rise,depth/2));length=math.hypot(rise,depth/2)
    count=8 if striped else 10
    for side in (-1,1):
        for i in range(count):
            shade=CREAM if striped and i%2 else color
            m.box((x-width/2+width*(i+.5)/count,y-rise/2,z+side*depth/4),(width/count+.015,.13,length+.10),shade,.05,rotation('x',side*angle))
    m.cylinder((x,y+.04,z),.09,width+.06,color,axis='x')

def stall(kind):
    m=Model();color={'egg':'#29c8aa','gift':'#ff9c27','cake':'#f76c9e'}[kind]
    m.box((0,.10,.20),(3.5,.20,2.25),'#c79149',.12)
    m.box((0,.56,.28),(3.22,.78,1.94),color,.16)
    for x in [-1.30,-.85,-.40,.05,.5,.95,1.4]:m.box((x,.58,1.265),(.04,.56,.035),'#238c84' if kind=='egg' else '#cd793c' if kind=='gift' else '#c44479',.01)
    m.box((0,1,.28),(3.55,.20,2.20),'#ffe9a7',.09)
    m.box((0,1.10,.28),(3.37,.07,2.04),CREAM,.03)
    for x in [-1.45,1.45]:
        for z in [-.72,.94]:m.cylinder((x,1.34,z),.085,2.48,'#fff1c5')
    roof(m,0,2.82,0,3.75,2.60,.60,color,True)
    for x in np.linspace(-1.62,1.62,9):m.sphere((x,2.17,1.30),(.19,.16,.09),CREAM if round(x*10)%2 else color)
    m.box((0,1.98,1.36),(1.22,.39,.12),'#fff7de',.13)
    m.box((0,1.96,1.435),(.85,.04,.025),color,.01)
    if kind=='egg':
        m.box((-.48,1.20,.65),(1.2,.14,.7),'#df9e4b',.04)
        for x in [-.84,-.49,-.14]:
            for z in [.45,.78]:m.sphere((x,1.38,z),(.13,.19,.13),'#fff9e5')
        m.box((1.08,1.35,.52),(.45,.45,.42),'#52b5e8',.07)
        m.box((1.08,1.48,.75),(.28,.16,.035),'#224f79',.025)
    elif kind=='gift':
        for x,z in [(-.85,.7),(-.15,.7),(.55,.6)]:
            m.box((x,1.40,z),(.53,.55,.51),'#ffc648',.05)
            m.box((x,1.69,z),(.55,.05,.53),'#ffdf70',.02)
            m.box((x,1.42,z+.265),(.12,.55,.02),'#ef655b',.01)
            m.box((x,1.73,z),(.12,.035,.54),'#ed6256',.01)
    else:
        m.cylinder((-.2,1.18,.6),.57,.07,'#fffdf4')
        m.cylinder((-.2,1.39,.6),.48,.40,'#f4ab50')
        m.cylinder((-.2,1.62,.6),.50,.13,'#fff3d9')
        for x,z in [(-.48,.6),(-.12,.36),(.08,.73)]:m.sphere((x,1.76,z),(.12,.14,.12),'#f44d5f')
    pot(m,-1.78,1.1)
    return m

def coop():
    m=Model();m.box((0,.16,0),(4.8,.32,3.2),'#c78036',.15)
    m.box((0,.36,0),(4.9,.17,3.25),'#f5c96f',.08)
    for x in np.linspace(-2.1,2.1,9):m.box((x,.46,.5),(.44,.06,1.85),'#eab557',.025)
    m.box((0,1.16,-.66),(4.0,1.5,1.75),'#ffdc76',.09)
    for x in np.linspace(-1.8,1.8,13):m.box((x,1.2,.225),(.027,1.25,.035),'#e8a442',.01)
    roof(m,0,2.67,-.66,4.6,2.35,.72,'#ef5547')
    for x in [-1.23,0,1.23]:
        m.box((x,.99,.27),(.74,.88,.12),'#fff6cf',.20)
        m.box((x,.94,.35),(.55,.70,.10),'#365e61',.18)
        m.box((x,.55,.52),(.77,.13,.55),'#e7a746',.05)
        m.sphere((x,.65,.55),(.20,.11,.15),'#ffe29a')
    for x,z in [(-2.3,1.45),(2.3,1.45),(-2.3,-.45),(2.3,-.45)]:
        m.box((x,.79,z),(.14,.85,.14),'#fff1c5',.045)
        m.sphere((x,1.25,z),(.12,.11,.12),'#fff4cf')
    for x in [-2.3,2.3]:m.box((x,.88,.52),(.10,.13,1.95),'#fff0bf',.035)
    m.box((.8,.53,1.53),(2.55,.30,.44),'#28bfc5',.08)
    m.box((.8,.69,1.53),(2.30,.04,.24),'#227f8b',.02)
    for x in np.linspace(-.2,1.8,7):m.sphere((x,.74,1.54),(.12,.07,.09),'#ffd445')
    pot(m,-2.3,1.7)
    return m

def tree():
    m=Model();m.cylinder((0,.85,0),.19,1.65,'#bd7635')
    m.beam((0,1.05,0),(-.57,1.95,.05),.16,'#c4863c')
    m.beam((0,1.25,0),(.5,2.05,-.06),.15,'#bd7635')
    for pos,radii,color in [((0,2.35,0),(1,1.12,.85),'#42b93c'),((-.57,2.35,.15),(.64,.79,.66),'#5bce3e'),((.56,2.45,.06),(.65,.85,.64),'#27a849'),((-.25,3.04,-.12),(.74,.79,.65),'#7bd943'),((.38,3.02,.08),(.56,.65,.59),'#4ec844')]:m.sphere(pos,radii,color)
    for x,y,z in [(-.53,2.54,.65),(.31,2.14,.77),(.61,2.76,.45),(-.2,3.15,.48)]:
        m.sphere((x,y,z),(.15,.17,.15),'#ff9633')
        m.sphere((x+.03,y+.16,z),(.08,.035,.04),'#278640',rotation('z',25))
    return m

def garden():
    m=Model()
    for x,y,z,r in [(-.7,.33,0,.45),(0,.50,-.08,.59),(.65,.34,.08,.46)]:m.sphere((x,y,z),(r,r*.8,r*.75),'#55c849')
    for x,y,z in [(-.7,.65,.2),(-.13,.92,.18),(.45,.62,.36),(.79,.63,.11)]:
        for a in np.linspace(0,math.pi*2,6)[:-1]:m.sphere((x+math.cos(a)*.10,y,z+math.sin(a)*.1),(.095,.065,.095),'#fff3da')
        m.sphere((x,y+.06,z),(.065,.045,.065),'#ffc62e')
    return m

def mill():
    m=Model();m.box((0,.15,0),(2.55,.30,2.25),'#8ab4c1',.12)
    m.box((0,1.28,-.12),(1.65,2.15,1.50),'#ffe5ac',.12)
    m.box((0,.85,.66),(.64,1.2,.10),'#42a8ce',.17)
    m.box((0,.84,.73),(.44,.98,.06),'#256780',.12)
    roof(m,0,2.90,-.12,2.15,1.98,.62,'#2cbcd3')
    for a in [45,135,225,315]:
        ar=math.radians(a);center=(math.cos(ar)*.68,1.92+math.sin(ar)*.68,.91)
        m.box(center,(1.35,.22,.10),'#fff5d4',.04,rotation('z',a))
        for d in [.30,.55,.8,1.05]:
            m.box((math.cos(ar)*d,1.92+math.sin(ar)*d,.98),(.04,.28,.025),'#eeb864',.01,rotation('z',a))
    m.cylinder((0,1.92,.99),.18,.15,'#ffbc3b',axis='z')
    pot(m,1.18,.9)
    return m

def oven():
    m=Model();m.box((0,.16,0),(2.8,.32,2.15),'#c87b3c',.13)
    m.box((0,.92,0),(2.25,1.30,1.65),'#f49b4a',.26)
    for x,y in [(-.72,.7),(-.74,1.04),(.73,.7),(.74,1.04),(-.35,1.46),(.35,1.46)]:m.box((x,y,.83),(.52,.08,.03),'#ffd291',.02)
    m.box((0,.85,.86),(1.42,1.05,.14),'#ffc978',.40)
    m.box((0,.83,.95),(1.12,.80,.10),'#653c43',.32)
    m.box((0,.75,1.01),(.87,.47,.03),'#df6726',.18)
    for x,y,r in [(-.27,.72,.16),(0,.87,.22),(.25,.69,.17)]:
        m.sphere((x,y,1.04),(r,r*1.45,.055),'#ffbc2b')
        m.sphere((x,y-.05,1.09),(r*.5,r*.8,.025),'#fff1a0')
    m.box((0,.38,1.07),(1.7,.17,.58),'#ffe8b5',.07)
    m.box((.75,1.88,-.45),(.44,1.4,.46),'#e98142',.06)
    m.box((.75,2.56,-.45),(.64,.18,.65),'#ffca7b',.06)
    m.box((.75,2.66,-.45),(.37,.04,.38),'#795449',.03)
    pot(m,-1.38,.76)
    return m

def pack_table():
    m=Model()
    for x in [-1.2,1.2]:
        for z in [-.65,.65]:m.box((x,.45,z),(.16,.9,.16),'#ffce6e',.04)
    m.box((0,.94,0),(3.08,.34,1.92),'#22b8b0',.10)
    m.box((0,1.13,0),(2.68,.08,1.53),'#217e8b',.035)
    for x in np.linspace(-1.05,1.05,8):m.cylinder((x,1.20,0),.065,1.40,'#90e0d5',axis='z')
    m.box((.2,1.73,-.35),(.95,1.02,.72),'#f7dc8c',.14)
    m.box((.2,1.97,.04),(.57,.32,.055),'#246778',.04)
    m.box((.2,1.99,.077),(.42,.17,.025),'#6aeb8c',.02)
    m.sphere((.53,1.51,.05),(.09,.09,.07),'#ff7849')
    m.box((-.83,1.35,.43),(.60,.30,.53),'#ffbc39',.04)
    return m

def truck():
    m=Model()
    for x in [-1.5,1.5]:
        for z in [-.82,.82]:
            m.cylinder((x,.39,z),.36,.23,'#2d5262',axis='z')
            m.cylinder((x,.39,z+(.13 if z>0 else -.13)),.20,.04,'#c2e9e3',axis='z')
            m.cylinder((x,.39,z+(.16 if z>0 else -.16)),.095,.055,'#ffbd43',axis='z')
    m.box((0,.66,0),(4.15,.30,1.72),'#22a6bd',.12)
    m.box((-1.30,1.36,0),(1.45,1.23,1.68),'#20c6d8',.18)
    m.box((-1.30,2.01,0),(1.55,.15,1.80),'#79e8e8',.08)
    m.box((-1.3,1.64,.86),(1.04,.50,.035),'#276b91',.06)
    m.box((-1.37,1.75,.884),(.75,.10,.02),'#a6effb',.03)
    m.box((-2.04,1.67,0),(.035,.51,1.23),'#3383a1',.05)
    m.box((-1.95,.98,.60),(.14,.15,.23),'#fff2a6',.04)
    m.box((-1.95,.98,-.60),(.14,.15,.23),'#fff2a6',.04)
    m.box((.80,.94,0),(2.58,.14,1.68),'#ffce74',.05)
    for z in [-.85,.85]:m.box((.81,1.20,z),(2.62,.5,.11),'#f4b852',.04)
    m.box((2.09,1.20,0),(.12,.50,1.78),'#e9a23f',.04)
    return m

def tractor():
    m=Model()
    for x,r in [(-.7,.48),(.80,.32)]:
        for z in [-.62,.62]:
            m.cylinder((x,r,z),r,.25,'#315368',axis='z')
            m.cylinder((x,r,z+(.14 if z>0 else -.14)),r*.52,.06,'#ffb62e',axis='z')
    m.box((0,.73,0),(2.1,.42,1.14),'#f85547',.13)
    m.box((.58,1.02,0),(.97,.50,.95),'#ff7953',.13)
    m.box((-.48,1.40,0),(.77,.94,.9),'#5bd7e4',.07)
    m.box((-.48,1.88,0),(1.03,.16,1.13),'#f85144',.07)
    m.box((-.48,1.42,.46),(.55,.58,.03),'#228aa7',.04)
    m.cylinder((.83,1.55,-.3),.065,.85,'#4d5863')
    m.box((1.25,.4,0),(.4,.18,1.65),'#ffc13e',.06)
    for z in np.linspace(-.68,.68,6):m.box((1.49,.30,z),(.38,.10,.08),'#fff0b8',.025)
    return m

def chicken():
    m=Model()
    for x in [-.18,.18]:
        m.cylinder((x,.18,.05),.045,.3,'#f69c20')
        m.box((x,.06,.12),(.18,.07,.28),'#ffb522',.025)
    m.sphere((0,.52,0),(.43,.43,.42),'#fff3ce')
    m.sphere((.33,.53,.04),(.13,.26,.31),'#ffd37a',rotation('z',20))
    m.sphere((0,.95,.23),(.26,.30,.26),'#fff8df')
    for x in [-.1,0,.1]:m.sphere((x,1.23,.22),(.09,.13,.10),'#f64f52')
    m.sphere((.24,1.01,.30),(.035,.05,.035),'#284c5e')
    m.sphere((.245,1.027,.324),(.012,.017,.012),'#ffffff')
    m.sphere((.02,.96,.50),(.15,.08,.17),'#ffb31e')
    m.sphere((-.2,.65,-.38),(.19,.28,.10),'#ffd56f',rotation('z',-25))
    return m

def corn():
    m=Model();m.cylinder((0,.80,0),.045,1.6,'#339b36')
    for i in range(3):
        y=.4+i*.4
        for side in [-1,1]:m.sphere((side*.28,y+.16,.02),(.39,.065,.15),'#6cce34' if side<0 else '#3fb238',rotation('z',side*32))
    for x,y,z in [(-.18,1.05,.18),(.17,1.42,.10)]:
        m.sphere((x,y,z),(.15,.33,.15),'#ffc524',rotation('z',-x*60))
        for h in np.linspace(-.20,.20,5):
            for dx in [-.065,.045]:m.sphere((x+dx,y+h,z+.125),(.046,.048,.035),'#ffdf3f')
    for x in [-.1,0,.1]:m.beam((0,1.6,0),(x,1.9,-.02),.025,'#ffe16d')
    return m

def person(role,direction,frame):
    m=Model();step=.10 if frame else -.10
    shirt={'player':'#ff7055','harvest':'#ffb52d','clerk':'#37c3d5','customer':'#8f69df','customer2':'#f06e9f'}[role]
    for x,phase in [(-.14,step),(.14,-step)]:
        m.beam((x,.54,0),(x,.19,phase),.17,'#2987c2')
        m.sphere((x,.12,phase+.04),(.13,.10,.20),'#295268')
    m.box((0,.78,0),(.53,.58,.33),shirt,.14)
    m.box((0,.58,.045),(.47,.23,.35),'#2a9bd0',.07)
    m.box((0,.76,.19),(.33,.32,.04),'#46b5e5',.05)
    for x in [-.18,.18]:m.box((x,.93,.18),(.065,.30,.045),'#46b5e5',.02)
    for x in [-.12,.12]:m.sphere((x,.86,.23),(.03,.03,.02),'#ffdc52')
    for side in [-1,1]:
        m.beam((side*.31,.98,0),(side*.34,.55,step*side),.15,shirt)
        m.sphere((side*.34,.49,step*side),(.09,.11,.09),'#ffc58d')
    m.cylinder((0,1.08,0),.09,.13,'#f3ad72')
    m.sphere((0,1.35,.02),(.28,.31,.26),'#ffd0a0')
    m.sphere((0,1.53,-.065),(.285,.18,.24),'#a8582b')
    for x in [-.10,.10]:
        m.sphere((x,1.38,.265),(.032,.043,.016),'#234f61')
        m.sphere((x-.006,1.395,.278),(.010,.014,.006),'#ffffff')
    m.sphere((0,1.30,.286),(.05,.045,.043),'#f2a66c')
    if role=='player':
        m.sphere((.29,1.30,-.16),(.13,.30,.13),'#a8582b',rotation('z',-20))
        m.sphere((.26,1.49,-.16),(.10,.055,.10),'#ffdc3b')
    elif role=='harvest':
        m.cylinder((0,1.61,0),.41,.07,'#ffc748')
        m.cylinder((0,1.72,0),.27,.20,'#ffe07d')
        m.cylinder((0,1.65,0),.274,.07,'#c97a38')
    elif role=='clerk':
        m.sphere((0,1.59,0),(.29,.17,.27),'#1aadd0')
        m.box((0,1.56,.27),(.46,.07,.30),'#36d1e1',.06)
    rotate=rotation('y',[45,225,135,-45][direction])
    m.parts=[(v@rotate.T,n@rotate.T,f,c)for v,n,f,c in m.parts]
    return m

def resource(kind):
    m=Model()
    if kind in ['egg','egg-stack']:
        for x in ([0] if kind=='egg' else [-.20,.20]):m.sphere((x,.38,0),(.25,.38,.25),'#fff9df')
    elif kind=='gift':
        m.box((0,.37,0),(1,.74,.88),'#ffb52e',.07);m.box((0,.77,0),(1.06,.12,.94),'#ffd44c',.04)
        m.box((0,.4,.46),(.19,.78,.025),'#f35968',.01);m.box((.52,.4,0),(.025,.78,.18),'#e94e67',.01)
        m.box((0,.85,0),(1.04,.035,.18),'#ff6c7a',.01);m.box((0,.86,0),(.18,.035,.94),'#ff6c7a',.01)
        for x in [-.16,.16]:m.sphere((x,.94,0),(.18,.09,.13),'#fff3c9',rotation('z',x*90))
    elif kind=='flour':
        m.sphere((0,.43,0),(.36,.43,.30),'#fff0bd');m.cylinder((0,.85,0),.17,.18,'#ffe5a0')
        m.cylinder((0,.82,0),.20,.07,'#de9c3b');m.box((0,.46,.29),(.41,.27,.04),'#2ebba0',.04)
        m.beam((-.08,.35,.325),(.08,.55,.325),.03,'#fff2ac')
    elif kind=='cake':
        m.cylinder((0,.055,0),.57,.1,'#fff9e6');m.cylinder((0,.32,0),.46,.48,'#f6ae4c')
        m.cylinder((0,.4,0),.465,.09,'#fff0d5');m.cylinder((0,.6,0),.49,.14,'#fff9e5')
        for x,z in [(-.25,.14),(.20,.20),(0,-.24)]:
            m.sphere((x,.77,z),(.13,.16,.13),'#f94d62');m.sphere((x,.91,z),(.11,.025,.08),'#45b74c')
    elif kind=='corn-stack':
        m.sphere((0,.2,0),(.65,.20,.22),'#ffc524')
        for x in np.linspace(-.48,.48,7):
            for z in [-.1,.08]:m.sphere((x,.35,z),(.065,.065,.065),'#ffe15b')
        m.sphere((-.54,.16,0),(.25,.065,.22),'#59c53b',rotation('z',-20))
    elif kind=='cash':
        for y in [.06,.11,.16]:m.box((0,y,0),(1.2,.06,.65),'#48b850',.025)
        m.box((0,.21,0),(1.15,.035,.61),'#86e65c',.02);m.cylinder((0,.245,0),.18,.015,'#e9ffa7')
    elif kind in ['wheat','wheat-stack']:
        for i in range(5):
            x=(i-2)*.19;y=1.35+(i%2)*.14;z=(i%2)*.12
            m.beam((0,.06,0),(x,y,z),.035,'#e8a822')
            for j in range(4):
                for side in [-1,1]:m.sphere((x+side*.055,y-j*.11,z),(.065,.115,.055),'#ffcc35' if side>0 else '#ffe166',rotation('z',side*26))
        if kind=='wheat-stack':
            turn=rotation('z',72);m.parts=[(v@turn.T+np.array([.45,.15,0]),n@turn.T,f,c)for v,n,f,c in m.parts]
    return m

def car(color):
    m=Model()
    for x in [-.61,.61]:
        for z in [-.72,.73]:
            m.cylinder((x,.28,z),.25,.15,'#2c4a61',axis='x')
            m.cylinder((x+(.085 if x>0 else -.085),.28,z),.13,.025,'#9ae5df',axis='x')
    m.box((0,.52,0),(1.25,.55,2.10),color,.16)
    m.box((0,.90,-.15),(1.08,.54,1.03),color,.13)
    m.box((0,.93,.39),(.90,.32,.035),'#256c92',.04)
    m.box((.55,.93,-.16),(.025,.31,.74),'#2a82a3',.04)
    m.box((0,1.19,-.15),(1.11,.10,1.02),color,.04)
    m.box((0,.35,1.075),(1.14,.12,.12),'#c9e9e4',.04)
    for x in [-.42,.42]:m.box((x,.63,1.065),(.22,.16,.055),'#fff0ac',.04)
    return m

def atm():
    m=Model();m.box((0,.13,0),(1.1,.25,.80),'#197c91',.08);m.box((0,1.07,0),(.95,1.75,.70),'#21b9b8',.10)
    m.box((0,1.43,.37),(.69,.62,.08),'#fff4cd',.06);m.box((0,1.45,.42),(.52,.38,.035),'#23627b',.03)
    m.box((0,1.45,.44),(.37,.19,.015),'#7ce79d',.02);m.box((0,.84,.38),(.50,.08,.035),'#235f75',.02)
    m.box((0,.69,.44),(.56,.05,.20),'#ffdd70',.025);return m

def render(model,width,height,anchor,filename):
    ss=2;w=width*ss;h=height*ss;pad=3
    positions=np.concatenate([part[0] for part in model.parts])
    # Characters and vegetation use a foot anchor; buildings retain their footprint center.
    foot_anchor=filename.startswith('actor-') or filename.startswith('resource-') or filename in ['tree.png','garden.png','chicken.png','corn.png','wheat.png']
    offset=max(positions@DOWN) if foot_anchor else 0
    xy=np.column_stack([positions@RIGHT,positions@DOWN-offset])
    bottom_limit=float('inf') if foot_anchor else max(3,height-anchor-1)/max(.1,max(xy[:,1]))
    scale=min((width/2-pad)/max(abs(xy[:,0])),(anchor-pad)/max(.1,-min(xy[:,1])),bottom_limit)*.95
    zbuffer=np.full((h,w),-np.inf);pixels=np.zeros((h,w,4),dtype=np.uint8)
    shadow=Image.new('L',(w,h));draw=ImageDraw.Draw(shadow)
    for v,n,faces,color in model.parts:
        ground=v-v[:,1,None]*LIGHT[None,:]/LIGHT[1]*.55;ground[:,1]=0
        points=np.column_stack([ground@RIGHT*scale+width/2,(ground@DOWN-offset)*scale+anchor])*ss
        if not foot_anchor:
            for face in faces:draw.polygon([tuple(p) for p in points[face]],fill=80)
    if foot_anchor:
        ry=min(7,max(2,height-anchor-2));rx=width*.27
        draw.ellipse(((width/2-rx)*ss,(anchor-ry)*ss,(width/2+rx)*ss,(anchor+ry)*ss),fill=100)
    shadow=shadow.filter(ImageFilter.GaussianBlur(3*ss))
    # A transparent guard band avoids a rectangular cut in wide tree/actor shadows.
    yy,xx=np.mgrid[0:h,0:w];edge=np.minimum.reduce([xx,yy,w-1-xx,h-1-yy])
    shadow=Image.fromarray((np.asarray(shadow)*np.clip(edge/(6*ss),0,1)).astype(np.uint8))
    for v,n,faces,color in model.parts:
        coords=np.column_stack([v@RIGHT*scale+width/2,(v@DOWN-offset)*scale+anchor])*ss;depth=v@VIEW
        for face in faces:
            normals=n[face]
            if np.mean(normals,axis=0)@VIEW<-.02:continue
            a,b,c=coords[face];den=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1])
            if abs(den)<1e-7:continue
            lo=np.maximum(np.floor(np.min([a,b,c],axis=0)).astype(int),0);hi=np.minimum(np.ceil(np.max([a,b,c],axis=0)).astype(int),[w-1,h-1])
            if np.any(hi<lo):continue
            xx,yy=np.meshgrid(np.arange(lo[0],hi[0]+1)+.5,np.arange(lo[1],hi[1]+1)+.5)
            u=((b[1]-c[1])*(xx-c[0])+(c[0]-b[0])*(yy-c[1]))/den
            t=((c[1]-a[1])*(xx-c[0])+(a[0]-c[0])*(yy-c[1]))/den;q=1-u-t
            z=u*depth[face[0]]+t*depth[face[1]]+q*depth[face[2]]
            target=zbuffer[lo[1]:hi[1]+1,lo[0]:hi[0]+1]
            mask=(u>=-1e-5)&(t>=-1e-5)&(q>=-1e-5)&(z>target)
            if not np.any(mask):continue
            weights=np.stack([u[mask],t[mask],q[mask]],axis=1);normal=weights@normals;normal/=np.linalg.norm(normal,axis=1)[:,None]
            lambert=np.maximum(0,normal@LIGHT);spec=np.maximum(0,normal@HALF)**42
            shade=.26+.72*lambert+.13*np.maximum(0,normal[:,1])
            linear=color[None,:]**2.2*shade[:,None]+spec[:,None]*.15
            # A cool ambient tint keeps saturated shadow faces readable.
            linear+=np.array([.005,.012,.018])[None,:]*(1-lambert[:,None])
            colored=np.clip(linear,0,1)**(1/2.2)
            patch=pixels[lo[1]:hi[1]+1,lo[0]:hi[0]+1];patch[mask,:3]=(colored*255).astype(np.uint8);patch[mask,3]=255;target[mask]=z[mask]
    base=Image.new('RGBA',(w,h),(27,74,64,0));base.putalpha(shadow)
    base=Image.alpha_composite(base,Image.fromarray(pixels)).resize((width*2,height*2),Image.Resampling.LANCZOS)
    base.save(OUT/filename,optimize=True)
    if base.getchannel('A').getbbox() is None:raise ValueError('Empty render: '+filename)
    return base

SPECS=[
 ('building.coop',coop,400,300,190,'coop.png'),
 ('building.counter',lambda:stall('egg'),300,230,176,'egg-stall.png'),
 ('building.gift-stall',lambda:stall('gift'),300,230,176,'gift-stall.png'),
 ('building.cake-stall',lambda:stall('cake'),300,230,176,'cake-stall.png'),
 ('building.mill',mill,270,240,178,'mill.png'),
 ('building.oven',oven,260,210,154,'oven.png'),
 ('building.pack-table',pack_table,300,190,130,'packing.png'),
 ('vehicle.wholesale',truck,370,230,165,'truck.png'),
 ('vehicle.harvester',tractor,170,145,116,'tractor.png'),
 ('environment.pine',tree,140,220,205,'tree.png'),
 ('environment.garden',garden,120,62,50,'garden.png'),
 ('animal.chicken',chicken,60,65,58,'chicken.png'),
 ('crop.corn',corn,76,118,112,'corn.png'),
 ('crop.wheat',lambda:resource('wheat'),64,100,95,'wheat.png'),
 ('resource.egg',lambda:resource('egg'),28,34,30,'resource-egg.png'),
 ('resource.egg-stack',lambda:resource('egg-stack'),36,24,21,'resource-egg-stack.png'),
 ('resource.corn-stack',lambda:resource('corn-stack'),34,15,12,'resource-corn-stack.png'),
 ('resource.gift-box',lambda:resource('gift'),58,40,34,'resource-gift.png'),
 ('resource.flour',lambda:resource('flour'),42,48,44,'resource-flour.png'),
 ('resource.cake',lambda:resource('cake'),54,43,38,'resource-cake.png'),
 ('resource.wheat',lambda:resource('wheat-stack'),40,24,20,'resource-wheat.png'),
 ('resource.cash',lambda:resource('cash'),40,19,15,'resource-cash.png'),
 ('building.atm',atm,96,132,110,'atm.png'),
]
for color,name in [('#f7584e','red'),('#29b9e3','blue'),('#ffc12d','gold'),('#bd62d8','plum')]:
    SPECS.append(('vehicle.car.'+name,lambda c=color:car(c),115,123,105,'car-'+name+'.png'))
for role in ['player','harvest','clerk','customer','customer2']:
    for direction in range(4):
        for frame in range(2):
            SPECS.append(('actor.'+role+'.'+str(direction)+'.'+str(frame),lambda r=role,d=direction,f=frame:person(r,d,f),80,110,100,'actor-'+role+'-'+str(direction)+'-'+str(frame)+'.png'))

def atlas(records):
    dest=ROOT/'src/assets';dest.mkdir(parents=True,exist_ok=True)
    pages=[];current=Image.new('RGBA',(2048,2048));x=y=row=0;frames={}
    for entry in sorted(records,key=lambda e:-e['height']):
        image=Image.open(OUT/entry['file']);w,h=image.size
        if x+w+4>2048:x=0;y+=row+4;row=0
        if y+h+4>2048:pages.append(current);current=Image.new('RGBA',(2048,2048));x=y=row=0
        current.alpha_composite(image,(x+2,y+2))
        frames[entry['key']]={'page':len(pages),'x':x+2,'y':y+2,'width':w,'height':h}
        x+=w+4;row=max(row,h)
    pages.append(current)
    for i,page in enumerate(pages):page.save(dest/('volume-atlas-'+str(i)+'.png'),optimize=True)
    (ROOT/'src/content/volume-art.json').write_text(json.dumps(frames,indent=2),encoding='utf-8')
    imports=["import page"+str(i)+" from '../assets/volume-atlas-"+str(i)+".png';"for i in range(len(pages))]
    (ROOT/'src/rendering/volumeSources.ts').write_text('// Generated by tools/render_volume_assets.py\n'+'\n'.join(imports)+'\nexport const VOLUME_SOURCES=['+','.join('page'+str(i)for i in range(len(pages)))+'];\n',encoding='utf-8')
    print('Packed '+str(len(records))+' sprites into '+str(len(pages))+' atlases.',flush=True)

if __name__=='__main__':
    records=[]
    for key,maker,w,h,anchor,file in SPECS:
        render(maker(),w,h,anchor,file);records.append({'key':key,'file':file,'width':w,'height':h,'anchor':anchor});print('Rendered '+key,flush=True)
    (OUT/'manifest.json').write_text(json.dumps(records,ensure_ascii=False,indent=2),encoding='utf-8')
    atlas(records)
    print('Baked '+str(len(records))+' original 3D models.',flush=True)
