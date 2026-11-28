<?php

namespace App\Domain\Catalog;

use GdImage;
use Illuminate\Http\UploadedFile;
use Illuminate\Validation\ValidationException;

// Re-encodes uploads: strips EXIF/GPS, fixes phone rotation, caps size, and blocks decompression bombs.
class ImageProcessor
{
    /** @return array{binary: string, width: int, height: int} */
    public function toWebp(UploadedFile $file, string $field = 'image'): array
    {
        $path = $file->getRealPath();
        $info = @getimagesize($path);

        if (! $info || ! in_array($info[2], [IMAGETYPE_JPEG, IMAGETYPE_PNG, IMAGETYPE_WEBP], true)) {
            throw ValidationException::withMessages([$field => 'Upload a JPG, PNG, or WEBP photo.']);
        }
        if (config('fdb.catalog.image_max_pixels') < $info[0] * $info[1]) {
            throw ValidationException::withMessages([$field => 'This photo is too large. Use one under 40 megapixels.']);
        }

        $image = @imagecreatefromstring((string) file_get_contents($path));
        if (! $image instanceof GdImage) {
            throw ValidationException::withMessages([$field => 'This photo could not be read. Try another file.']);
        }

        if ($info[2] === IMAGETYPE_JPEG) {
            $image = $this->applyOrientation($image, $path);
        }
        $image = $this->fit($image, config('fdb.catalog.image_max_dimension'));

        imagepalettetotruecolor($image);
        imagealphablending($image, true);
        imagesavealpha($image, true);

        ob_start();
        imagewebp($image, null, 82);
        $binary = (string) ob_get_clean();

        return ['binary' => $binary, 'width' => imagesx($image), 'height' => imagesy($image)];
    }

    private function applyOrientation(GdImage $image, string $path): GdImage
    {
        $orientation = (int) (@exif_read_data($path)['Orientation'] ?? 1);

        $rotated = match ($orientation) {
            3 => imagerotate($image, 180, 0),
            6 => imagerotate($image, -90, 0),
            8 => imagerotate($image, 90, 0),
            default => $image,
        };

        return $rotated instanceof GdImage ? $rotated : $image;
    }

    private function fit(GdImage $image, int $max): GdImage
    {
        $width = imagesx($image);
        $height = imagesy($image);
        $scale = min(1, $max / max($width, $height));

        if ($scale >= 1) {
            return $image;
        }

        $resized = imagescale($image, (int) round($width * $scale), (int) round($height * $scale), IMG_BICUBIC);

        return $resized instanceof GdImage ? $resized : $image;
    }
}
