export const MAX_AVATAR_FILE_BYTES = 5 * 1024 * 1024;
export const AVATAR_SIZE = 256;
export const ALLOWED_AVATAR_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
];

export function validateAvatarFile(file) {
  if (!file) return "Choose an image to upload.";
  if (!ALLOWED_AVATAR_TYPES.includes(file.type)) {
    return "Choose a PNG, JPEG, or WebP image.";
  }
  if (file.size > MAX_AVATAR_FILE_BYTES) {
    return "Image must be smaller than 5 MB.";
  }
  return "";
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read that image."));
    };
    image.src = url;
  });
}

export async function fileToAvatarDataUrl(file) {
  const validationError = validateAvatarFile(file);
  if (validationError) throw new Error(validationError);

  const image = await loadImage(file);
  const width = image.naturalWidth || image.width;
  const height = image.naturalHeight || image.height;

  if (!width || !height) {
    throw new Error("Could not read that image.");
  }

  const canvas = document.createElement("canvas");
  canvas.width = AVATAR_SIZE;
  canvas.height = AVATAR_SIZE;

  const context = canvas.getContext("2d");
  if (!context) throw new Error("Image processing is not supported.");

  const scale = Math.max(AVATAR_SIZE / width, AVATAR_SIZE / height);
  const drawWidth = width * scale;
  const drawHeight = height * scale;

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, AVATAR_SIZE, AVATAR_SIZE);
  context.drawImage(
    image,
    (AVATAR_SIZE - drawWidth) / 2,
    (AVATAR_SIZE - drawHeight) / 2,
    drawWidth,
    drawHeight
  );

  return canvas.toDataURL("image/jpeg", 0.85);
}
