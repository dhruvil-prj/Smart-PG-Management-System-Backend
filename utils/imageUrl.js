const path = require('path');

const isAbsoluteWebUrl = (value) => /^https?:\/\//i.test(value) || /^data:/i.test(value);

const getBaseUrl = (req) => process.env.PUBLIC_BACKEND_URL || `${req.protocol}://${req.get('host')}`;

const normalizeImageUrl = (image, req) => {
  if (!image || typeof image !== 'string' || isAbsoluteWebUrl(image)) return image;

  const normalized = image.replace(/\\/g, '/');
  const uploadsIndex = normalized.lastIndexOf('/uploads/');
  const baseUrl = getBaseUrl(req);

  if (uploadsIndex >= 0) {
    return `${baseUrl}/uploads/${normalized.slice(uploadsIndex + '/uploads/'.length)}`;
  }

  if (normalized.startsWith('/uploads/')) return `${baseUrl}${normalized}`;
  if (normalized.startsWith('uploads/')) return `${baseUrl}/${normalized}`;

  return image;
};

const normalizePGImages = (pg, req) => {
  if (!pg) return pg;
  const plain = typeof pg.toObject === 'function' ? pg.toObject() : { ...pg };
  if (Array.isArray(plain.images)) {
    plain.images = plain.images.map(image => normalizeImageUrl(image, req));
  }
  return plain;
};

const storedUploadPath = (file) => {
  if (!file?.path) return '';
  if (isAbsoluteWebUrl(file.path)) return file.path;
  return `/uploads/${file.filename || path.basename(file.path)}`;
};

module.exports = { normalizeImageUrl, normalizePGImages, storedUploadPath };
