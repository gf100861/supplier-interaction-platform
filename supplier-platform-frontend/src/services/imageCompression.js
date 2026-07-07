const MAX_IMAGE_DIMENSION = 1600;
const IMAGE_COMPRESSION_QUALITY = 0.72;

const getImageMimeType = (file, fallback = 'image/jpeg') => {
    const type = file?.type || '';
    if (type.startsWith('image/') && !['image/gif', 'image/svg+xml'].includes(type)) {
        return type === 'image/png' ? 'image/jpeg' : type;
    }
    return fallback;
};

export const compressImageFile = async (file, originalName = 'image.jpg') => {
    const fileType = file?.type || '';
    if (!fileType.startsWith('image/') || ['image/gif', 'image/svg+xml'].includes(fileType)) {
        return file;
    }

    const objectUrl = URL.createObjectURL(file);

    try {
        const image = await new Promise((resolve, reject) => {
            const img = new window.Image();
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = objectUrl;
        });

        // Some Android/Xiaomi WebViews report image.width/image.height as 0 for an
        // image that is not mounted in the DOM. naturalWidth/naturalHeight are the
        // decoded pixel dimensions and must be preferred, otherwise a real photo
        // gets silently converted into a 1x1 JPEG.
        const sourceWidth = image.naturalWidth || image.width;
        const sourceHeight = image.naturalHeight || image.height;

        if (!Number.isFinite(sourceWidth) || !Number.isFinite(sourceHeight)
            || sourceWidth < 2 || sourceHeight < 2) {
            throw new Error(`Invalid decoded image dimensions: ${sourceWidth}x${sourceHeight}`);
        }

        const scale = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(sourceWidth, sourceHeight));
        const width = Math.max(2, Math.round(sourceWidth * scale));
        const height = Math.max(2, Math.round(sourceHeight * scale));

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext('2d');
        if (!context) {
            throw new Error('Canvas 2D context is unavailable');
        }
        context.drawImage(image, 0, 0, width, height);

        const mimeType = getImageMimeType(file);
        const compressedBlob = await new Promise((resolve) => {
            canvas.toBlob(resolve, mimeType, IMAGE_COMPRESSION_QUALITY);
        });

        // A sub-1KB result for a substantially larger source is almost always a
        // broken/blank mobile canvas export. Preserve the original instead.
        const suspiciouslySmall = compressedBlob
            && compressedBlob.size < 1024
            && file.size > compressedBlob.size * 2;

        if (!compressedBlob || suspiciouslySmall || compressedBlob.size >= file.size) {
            return file;
        }

        const outputName = mimeType === 'image/jpeg' && !/\.jpe?g$/i.test(originalName)
            ? (originalName.includes('.') ? originalName.replace(/\.[^.]+$/, '.jpg') : `${originalName}.jpg`)
            : originalName;

        return new File([compressedBlob], outputName, {
            type: mimeType,
            lastModified: Date.now(),
        });
    } catch (error) {
        console.warn('Image compression skipped:', error);
        return file;
    } finally {
        URL.revokeObjectURL(objectUrl);
    }
};
