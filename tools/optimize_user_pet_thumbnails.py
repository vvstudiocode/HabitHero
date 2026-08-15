"""Convert the supplied transparent shop images to compact WebP thumbnails."""

from __future__ import annotations

import os

import bpy


ROOT = "/Users/studio.vv/Desktop/HabitHero"
THUMBNAIL_SIZE = 640
THUMBNAIL_QUALITY = 88

THUMBNAILS = (
    ("/Users/studio.vv/Downloads/布雷夫虎去背.png", os.path.join(ROOT, "public/assets/pets/buleifu-tiger-thumbnail.webp")),
    ("/Users/studio.vv/Downloads/貝里洛斯狐狸去背.png", os.path.join(ROOT, "public/assets/pets/belilos-fox-thumbnail.webp")),
)


def convert(source: str, output: str) -> None:
    image = bpy.data.images.load(source, check_existing=False)
    image.scale(THUMBNAIL_SIZE, THUMBNAIL_SIZE)
    image.file_format = "WEBP"
    image.save(filepath=output, quality=THUMBNAIL_QUALITY)
    print(f"THUMBNAIL_EXPORT {output} SIZE={image.size[:]} FORMAT={image.file_format}")


def main() -> None:
    for source, output in THUMBNAILS:
        os.makedirs(os.path.dirname(output), exist_ok=True)
        convert(source, output)


if __name__ == "__main__":
    main()
