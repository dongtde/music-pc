"""Bake weather masks/noise once. Runtime only samples small local textures.

Requires Pillow and numpy. Masks are authored for the existing CC0 city panorama.
RGBA = sky coverage, authored window lights, distance haze, night facade detail.
"""
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

target = Path('public/models/sky-lounge')
source = Image.open(target / 'city-panorama-4k.jpg').resize((2048, 1024), Image.Resampling.LANCZOS)
rgb = np.asarray(source, dtype=np.float32) / 255

# Follow the roof opening and actual skyline; glass facades must remain buildings.
outline = [(241,220),(300,207),(420,187),(444,147),(475,108),(520,77),(595,56),
           (702,43),(870,38),(1060,49),(1167,72),(1222,111),(1257,165),(1282,225),
           (1298,285),(1290,311),(1275,337),(1262,379),(1260,476),
           (1230,474),(1200,482),(1160,478),(1110,493),(1080,492),(1080,450),
           (1022,443),(1018,411),(1000,394),(958,379),(860,364),(884,404),
           (870,410),(828,421),(805,413),(774,420),(757,449),(728,448),
           (728,434),(693,432),(693,452),(670,449),(670,422),(629,418),
           (570,387),(522,376),(473,364),(435,350),(386,346),(338,347),
           (294,357),(263,368),(241,381)]
sky = Image.new('L', source.size); ImageDraw.Draw(sky).polygon(outline, fill=255)
# Subtract the bridge within the opening, preserving its photographed structure.
ImageDraw.Draw(sky).polygon([(472,365),(675,411),(675,442),(473,396)], fill=0)
sky = sky.filter(ImageFilter.GaussianBlur(1.1))
# Refine the hand-authored boundary with photograph detail, retaining rooflines,
# poles and bridges instead of painting a smooth silhouette over the buildings.
light = rgb @ np.array([.2126,.7152,.0722])
blue_sky = np.clip((rgb[:,:,2]-rgb[:,:,0]-.035)/.09,0,1) * np.clip((light-.43)/.23,0,1)
white_cloud = np.clip((light-.74)/.13,0,1)
coverage = np.asarray(sky)/255 * np.maximum(blue_sky,white_cloud)
sky = Image.fromarray(np.uint8(coverage*255)).filter(ImageFilter.GaussianBlur(.4))
# Author inside actual photographed panes. Color thresholds cannot distinguish
# a warm lamp from sunlight on stone or a golden reflection in unlit glass.
emission = Image.new('L', source.size); draw = ImageDraw.Draw(emission)
for polygon, intensity in [
    ([(372,355),(381,355),(381,406),(372,408)],100),
    ([(404,355),(413,355),(413,407),(404,406)],65),
    ([(456,355),(466,355),(466,405),(456,406)],90),
    ([(1313,387),(1321,383),(1321,429),(1313,431)],85),
    ([(1364,366),(1374,364),(1374,427),(1364,429)],110),
    ([(1391,360),(1400,359),(1400,427),(1391,427)],55),
    ([(1475,362),(1484,365),(1484,431),(1475,430)],95),
    ([(1510,377),(1518,381),(1518,433),(1510,432)],65),
    ([(1366,475),(1374,474),(1374,521),(1366,521)],100),
    ([(1480,474),(1487,477),(1487,524),(1480,523)],80),
    ([(1631,410),(1641,406),(1641,477),(1631,479)],65),
    ([(1687,391),(1696,387),(1696,471),(1687,473)],90),
    ([(955,489),(961,489),(961,513),(955,513)],80),
    ([(977,488),(984,488),(984,513),(977,513)],60),
]:
    draw.polygon(polygon, fill=intensity)
emission = emission.filter(ImageFilter.GaussianBlur(.45))
y, x = np.mgrid[:1024, :2048]
rng = np.random.default_rng(419)
# Preserve the noise atlas seed sequence when regenerating only the facade mask.
rng.random((50, 122))
# Remove daylight color and compress baked sunlight/shadow contrast offline.
# Store normalized detail in alpha; the shader supplies the dim moonlit color.
warm_sun = np.clip((rgb[:,:,0]-rgb[:,:,2]-.035)*4,0,1)
night_detail = np.clip(.18 + light*.46 - warm_sun*.16, .12, .64)
# Five-bit detail is enough at moonlight levels and keeps the download compact.
night_detail = np.round(night_detail*31)/31
distance = np.clip(1-np.abs(y-475)/430,0,1)**2
mask = Image.merge('RGBA',(sky,emission,Image.fromarray(np.uint8(distance*255)),Image.fromarray(np.uint8(night_detail*255))))
mask.save(target/'weather-mask.png', optimize=True)

size=256
def periodic_noise(grid):
    field=rng.random((grid,grid))
    uv=np.arange(size)*grid/size
    index=uv.astype(int); blend=uv-index; blend=blend*blend*(3-2*blend)
    a=field[index[:,None],index[None,:]]
    b=field[index[:,None],(index[None,:]+1)%grid]
    c=field[(index[:,None]+1)%grid,index[None,:]]
    d=field[(index[:,None]+1)%grid,(index[None,:]+1)%grid]
    return (a*(1-blend[None,:])+b*blend[None,:])*(1-blend[:,None])+(c*(1-blend[None,:])+d*blend[None,:])*blend[:,None]
cloud=sum(periodic_noise(g)*w for g,w in [(4,.5),(8,.25),(16,.14),(32,.07),(64,.04)])
cloud=np.clip((cloud-.23)/.54,0,1)
gradient=np.clip(.5+(np.roll(cloud,-2,axis=1)-np.roll(cloud,2,axis=1))*2.4,0,1)
fine=periodic_noise(64)
stars=np.zeros((size,size)); stars[rng.integers(0,size,100),rng.integers(0,size,100)]=rng.uniform(.25,1,100)
Image.fromarray(np.uint8(np.stack([cloud,gradient,fine,stars],axis=2)*255),'RGBA').save(target/'weather-noise.png',optimize=True)
print('\n'.join(f'{p.name}: {p.stat().st_size:,} bytes' for p in [target/'weather-mask.png',target/'weather-noise.png']))
