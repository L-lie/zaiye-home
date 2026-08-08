(function initializePortfolioImageTools(global) {
  const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
  const MAX_FILE_BYTES = 30 * 1024 * 1024;
  const MAX_PIXELS = 80_000_000;

  function extensionForType(type) {
    if (type === "image/jpeg") return "jpg";
    if (type === "image/png") return "png";
    if (type === "image/webp") return "webp";
    throw new Error("仅支持 JPG、PNG 和 WebP 图片");
  }

  function canvasBlob(canvas, quality) {
    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => blob ? resolve(blob) : reject(new Error("浏览器无法生成 WebP 图片")),
        "image/webp",
        quality,
      );
    });
  }

  function outputSize(width, height, maxEdge) {
    const scale = Math.min(1, maxEdge / Math.max(width, height));
    return {
      width: Math.max(1, Math.round(width * scale)),
      height: Math.max(1, Math.round(height * scale)),
    };
  }

  function drawWatermark(ctx, width, height) {
    const fontSize = Math.min(30, Math.max(14, Math.round(Math.max(width, height) * 0.012)));
    const stepX = fontSize * 12;
    const stepY = fontSize * 8;
    const diagonal = Math.hypot(width, height);

    ctx.save();
    ctx.translate(width / 2, height / 2);
    ctx.rotate(-22 * Math.PI / 180);
    ctx.font = `600 ${fontSize}px "PingFang SC", "Microsoft YaHei", sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    let row = 0;
    for (let y = -diagonal; y <= diagonal; y += stepY) {
      const offset = row % 2 ? stepX / 2 : 0;
      for (let x = -diagonal; x <= diagonal; x += stepX) {
        ctx.globalAlpha = 0.028;
        ctx.fillStyle = "#000";
        ctx.fillText("再野文化", x + offset + 1, y + 1);
        ctx.globalAlpha = 0.055;
        ctx.fillStyle = "#fff";
        ctx.fillText("再野文化", x + offset, y);
      }
      row += 1;
    }
    ctx.restore();
  }

  async function makeVariant(bitmap, maxEdge, quality) {
    const size = outputSize(bitmap.width, bitmap.height, maxEdge);
    const canvas = document.createElement("canvas");
    canvas.width = size.width;
    canvas.height = size.height;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) throw new Error("浏览器无法处理图片");
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bitmap, 0, 0, size.width, size.height);
    drawWatermark(ctx, size.width, size.height);
    return {
      blob: await canvasBlob(canvas, quality),
      width: size.width,
      height: size.height,
    };
  }

  async function processImage(file) {
    if (!(file instanceof File)) throw new Error("请选择图片文件");
    if (!ALLOWED_TYPES.has(file.type)) throw new Error("仅支持 JPG、PNG 和 WebP 图片");
    if (file.size <= 0 || file.size > MAX_FILE_BYTES) throw new Error("图片必须小于 30 MB");

    let bitmap;
    try {
      bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch {
      throw new Error("图片无法解码或文件已经损坏");
    }
    try {
      if (!bitmap.width || !bitmap.height || bitmap.width * bitmap.height > MAX_PIXELS) {
        throw new Error("图片尺寸过大，最多支持 8000 万像素");
      }
      const [preview, display] = await Promise.all([
        makeVariant(bitmap, 1280, 0.76),
        makeVariant(bitmap, 2400, 0.84),
      ]);
      return {
        width: bitmap.width,
        height: bitmap.height,
        preview,
        display,
      };
    } finally {
      bitmap.close();
    }
  }

  async function removeUploaded(client, originalPath, previewPath, displayPath) {
    await Promise.allSettled([
      client.storage.from("portfolio-originals").remove([originalPath]),
      client.storage.from("portfolio-public").remove([previewPath, displayPath]),
    ]);
  }

  async function uploadPortfolioImage(client, user, file, report = () => {}) {
    report("正在生成水印缩略图和展示图…");
    const processed = await processImage(file);
    const assetId = crypto.randomUUID();
    const basePath = `${user.id}/${assetId}`;
    const originalPath = `${basePath}/original.${extensionForType(file.type)}`;
    const previewPath = `${basePath}/preview.webp`;
    const displayPath = `${basePath}/display.webp`;

    report("正在上传私人原图…");
    const originalUpload = await client.storage.from("portfolio-originals").upload(originalPath, file, {
      cacheControl: "3600",
      contentType: file.type,
      upsert: false,
    });
    if (originalUpload.error) throw originalUpload.error;

    try {
      report("正在上传带水印的公开图片…");
      const [previewUpload, displayUpload] = await Promise.allSettled([
        client.storage.from("portfolio-public").upload(previewPath, processed.preview.blob, {
          cacheControl: "31536000",
          contentType: "image/webp",
          upsert: false,
        }),
        client.storage.from("portfolio-public").upload(displayPath, processed.display.blob, {
          cacheControl: "31536000",
          contentType: "image/webp",
          upsert: false,
        }),
      ]);
      const previewResult = previewUpload.status === "fulfilled" ? previewUpload.value : null;
      const displayResult = displayUpload.status === "fulfilled" ? displayUpload.value : null;
      const uploadError = previewUpload.status === "rejected"
        ? previewUpload.reason
        : displayUpload.status === "rejected"
          ? displayUpload.reason
          : previewResult.error || displayResult.error;
      if (uploadError) throw uploadError;

      const previewUrl = client.storage.from("portfolio-public").getPublicUrl(previewPath).data.publicUrl;
      const displayUrl = client.storage.from("portfolio-public").getPublicUrl(displayPath).data.publicUrl;
      const registry = await client.from("portfolio_assets").insert({
        id: assetId,
        owner_id: user.id,
        original_path: originalPath,
        preview_path: previewPath,
        display_path: displayPath,
        source_mime: file.type,
        width: processed.width,
        height: processed.height,
      });
      if (registry.error) throw registry.error;

      report("图片上传完成");
      return {
        assetId,
        file: displayUrl,
        media: {
          width: processed.width,
          height: processed.height,
          preview: previewUrl,
          display: displayUrl,
          watermarked: true,
        },
      };
    } catch (error) {
      await removeUploaded(client, originalPath, previewPath, displayPath);
      throw error;
    }
  }

  global.PortfolioImageTools = Object.freeze({
    processImage,
    uploadPortfolioImage,
  });
})(window);
