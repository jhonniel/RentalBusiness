from collections import deque
from pathlib import Path

from PIL import Image

ROOT = Path('/Users/jhanniel/Documents/Projects/RentalBusiness')
ASSETS = Path('/Users/jhanniel/.cursor/projects/Users-jhanniel-Documents-Projects-RentalBusiness/assets')
OUT = ROOT / 'public/storefront'


def flood_key(im: Image.Image, is_backdrop) -> Image.Image:
    rgba = im.convert('RGBA')
    width, height = rgba.size
    pixels = rgba.load()
    visited = bytearray(width * height)
    queue = deque()

    def index(x: int, y: int) -> int:
        return y * width + x

    def seed(x: int, y: int) -> None:
        i = index(x, y)
        if visited[i]:
            return
        visited[i] = 1
        queue.append((x, y))

    for x in range(width):
        seed(x, 0)
        seed(x, height - 1)
    for y in range(height):
        seed(0, y)
        seed(width - 1, y)

    while queue:
        x, y = queue.popleft()
        if not is_backdrop(pixels[x, y]):
            continue
        pixels[x, y] = (255, 255, 255, 0)
        for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
            if 0 <= nx < width and 0 <= ny < height:
                i = index(nx, ny)
                if not visited[i]:
                    visited[i] = 1
                    queue.append((nx, ny))

    return rgba


def white_backdrop(color) -> bool:
    red, green, blue, _alpha = color
    return red >= 248 and green >= 248 and blue >= 248


def black_backdrop(color) -> bool:
    red, green, blue, _alpha = color
    return red + green + blue <= 10


def fit(image: Image.Image, max_width: int, max_height: int) -> Image.Image:
    ratio = min(max_width / image.width, max_height / image.height)
    size = (max(1, int(image.width * ratio)), max(1, int(image.height * ratio)))
    return image.resize(size, Image.Resampling.LANCZOS)


drone = flood_key(Image.open(ASSETS / 'image-7fb11fb6-e9a0-47d5-a61f-ac50d1f37e8f.png'), white_backdrop)
drone.save(OUT / 'drone.png', 'PNG')

starlink = flood_key(Image.open(ASSETS / 'image-c739fdfd-173c-4deb-a898-ca14b7b0a9e4.png'), white_backdrop)
starlink.save(OUT / 'starlink.png', 'PNG')

camera = flood_key(Image.open(ASSETS / 'image-501fc8e0-c196-4548-b835-ffeb442a48e4.png'), white_backdrop)
camera.save(OUT / 'action-camera.png', 'PNG')

print('drone alpha', drone.getextrema()[3])
print('starlink alpha', starlink.getextrema()[3])
print('camera alpha', camera.getextrema()[3])
