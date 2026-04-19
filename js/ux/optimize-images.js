// ─── OPTIMIZACIÓN DE IMÁGENES A WEBP ────────────────────────────────────────
async function convertirAWebP(file, calidad = 0.8) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        canvas.toBlob((blob) => {
          if (blob) {
            resolve(new File([blob], file.name.replace(/\.(jpg|jpeg|png)$/i, '.webp'), { type: 'image/webp' }));
          } else {
            resolve(file); // Fallback a original
          }
        }, 'image/webp', calidad);
      };
      img.onerror = () => resolve(file);
      img.src = e.target.result;
    };
    reader.onerror = () => resolve(file);
    reader.readAsDataURL(file);
  });
}

// Sobrescribir uploadFoto para usar WebP
const originalUploadFoto = typeof uploadFoto === 'function' ? uploadFoto : null;
if (originalUploadFoto) {
  uploadFoto = async function(vehiculoId) {
    if (!_pendingFotoFile) return null;
    const fileOptimizado = await convertirAWebP(_pendingFotoFile);
    const filePath = `${tid()}/${vehiculoId}_${Date.now()}.webp`;
    const { data, error } = await sb.storage.from('vehiculos').upload(filePath, fileOptimizado, {
      contentType: 'image/webp',
      upsert: true
    });
    if (error) { console.error('Upload error:', error); toast('Error al subir foto','error'); return null; }
    const { data: urlData } = sb.storage.from('vehiculos').getPublicUrl(filePath);
    _pendingFotoFile = null;
    return urlData.publicUrl;
  };
}
