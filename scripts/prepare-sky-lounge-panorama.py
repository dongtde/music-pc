"""Re-encode the CC0 source panorama for the local WebGL backdrop (requires Pillow)."""
from pathlib import Path
import json
from PIL import Image

source = Path('output/sky-lounge-sources/city-source.jpg')
target = Path('public/models/sky-lounge/city-panorama.jpg')
with Image.open(source) as image:
    for width, path in [(8192, target), (4096, target.with_name('city-panorama-4k.jpg'))]:
        image.resize((width, width // 2), Image.Resampling.LANCZOS).save(path, quality=91, optimize=True)
        print(f'{path}: {path.stat().st_size:,} bytes')

manifest_path = target.with_name('sources.json')
if manifest_path.exists():
    manifest = json.loads(manifest_path.read_text())
    previous = manifest.get('derived', [])
    if isinstance(previous, dict):
        previous = [previous]
    manifest['derived'] = [
        {'file': name, 'source': source.name, 'process': f'{width}x{width // 2} JPEG quality 91'}
        for name, width in [('city-panorama.jpg', 8192), ('city-panorama-4k.jpg', 4096)]
    ] + [entry for entry in previous if entry['file'] not in ['city-panorama.jpg', 'city-panorama-4k.jpg']]
    manifest_path.write_text(json.dumps(manifest, indent=2) + '\n')
