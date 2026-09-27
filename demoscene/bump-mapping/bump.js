// bump.js - simple CPU-based bump-mapping demo
// Loads image.png from the same folder and applies a bump (normal) lighting
// effect with a light that follows the mouse cursor.

(function () {
  const canvas = document.getElementById('canvas') || document.getElementById('bump-canvas');
  const ctx = canvas.getContext('2d');
  const img = new Image();
  let paused = false;
  img.src = 'image.png';
  img.crossOrigin = 'anonymous';

  const restartButton = document.getElementById('restart');
  restartButton?.addEventListener('click', () => {
    paused = false;
    const pauseBtn = document.getElementById('pause');
    if (pauseBtn) pauseBtn.textContent = 'Pause';
    if (width && height) {
      light.x = width / 2;
      light.y = height / 2;
      mousePos.x = light.x;
      mousePos.y = light.y;
    }
  });

  const pauseBtn = document.getElementById('pause');
  pauseBtn?.addEventListener('click', () => {
    paused = !paused;
    pauseBtn.textContent = paused ? 'Resume' : 'Pause';
  });

  // Parameters
  const bumpStrength = 50; // how strong the height -> normal effect is
  const ambient = 0.25; // ambient light
  const diffuseMul = 1.0; // diffuse multiplier
  const specularMul = 0.9; // specular multiplier
  const shininess = 40; // specular exponent

  let width, height;
  let originalPixels; // Uint8ClampedArray copy of original image data
  let normals; // Float32Array of length width*height*3

  // Light state
  const light = { x: 0, y: 0, z: 120 };
  let mousePos = { x: 0, y: 0 };

  // Mouse tracking
  function setupMouseTracking() {
    canvas.addEventListener('mousemove', function(e) {
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      mousePos.x = (e.clientX - rect.left) * scaleX;
      mousePos.y = (e.clientY - rect.top) * scaleY;
    });
    
    canvas.addEventListener('mouseenter', function() {
      canvas.style.cursor = 'none';
    });
    
    canvas.addEventListener('mouseleave', function() {
      canvas.style.cursor = 'default';
    });
  }

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  img.onload = function () {
    width = canvas.width = img.width;
    height = canvas.height = img.height;
    ctx.drawImage(img, 0, 0);
    const imgData = ctx.getImageData(0, 0, width, height);
    originalPixels = new Uint8ClampedArray(imgData.data); // copy

    // Compute height map from luminance (0..1)
    const heightMap = new Float32Array(width * height);
    for (let y = 0, p = 0; y < height; y++) {
      for (let x = 0; x < width; x++, p += 4) {
        const r = originalPixels[p] / 255;
        const g = originalPixels[p + 1] / 255;
        const b = originalPixels[p + 2] / 255;
        // luminance
        heightMap[y * width + x] = 0.33 * r + 0.33 * g + 0.33 * b;
      }
    }

    // Precompute normals from height map using central differences
    normals = new Float32Array(width * height * 3);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const xm = clamp(x - 1, 0, width - 1);
        const xp = clamp(x + 1, 0, width - 1);
        const ym = clamp(y - 1, 0, height - 1);
        const yp = clamp(y + 1, 0, height - 1);

        const hL = heightMap[y * width + xm];
        const hR = heightMap[y * width + xp];
        const hU = heightMap[ym * width + x];
        const hD = heightMap[yp * width + x];

        // gradients
        const dx = (hR - hL) * bumpStrength;
        const dy = (hD - hU) * bumpStrength;

        // normal: (-dx, -dy, 1) then normalized
        let nx = -dx;
        let ny = -dy;
        let nz = 1;
        const len = Math.hypot(nx, ny, nz) || 1;
        nx /= len; ny /= len; nz /= len;

        const idx = (y * width + x) * 3;
        normals[idx] = nx;
        normals[idx + 1] = ny;
        normals[idx + 2] = nz;
      }
    }

    // Initialize light and mouse tracking
    light.x = width / 2;
    light.y = height / 2;
    light.z = Math.max(60, Math.min(160, width / 4));
    mousePos.x = light.x;
    mousePos.y = light.y;
    setupMouseTracking();

    requestAnimationFrame(loop);
  };

  function updateLight() {
    // smooth interpolation towards mouse position
    const t = 0.12; // smooth following speed
    light.x += (mousePos.x - light.x) * t;
    light.y += (mousePos.y - light.y) * t;
    // keep z stable for consistent lighting
    light.z = 150;
  }

  function loop() {
    if (!paused) {
      updateLight();

      const out = ctx.createImageData(width, height);
      const outData = out.data;

      for (let y = 0, i = 0; y < height; y++) {
        for (let x = 0; x < width; x++, i++) {
          const srcIdx = i * 4;
          const nx = normals[i * 3 + 0];
          const ny = normals[i * 3 + 1];
          const nz = normals[i * 3 + 2];

          // light vector
          let lx = light.x - x;
          let ly = light.y - y;
          let lz = light.z;
          const llen = Math.hypot(lx, ly, lz) || 1;
          lx /= llen; ly /= llen; lz /= llen;

          // diffuse term
          let dot = nx * lx + ny * ly + nz * lz;
          dot = Math.max(0, dot);

          // specular: reflect L around N, compare with view (0,0,1)
          // reflect = 2*(N.L)*N - L
          //const rx = 2 * dot * nx - lx;
          //const ry = 2 * dot * ny - ly;
          const rz = 2 * dot * nz - lz;
          const rvz = Math.max(0, rz); // view vector is (0,0,1)
          const spec = Math.pow(rvz, shininess) * specularMul;

          const shade = clamp(ambient + diffuseMul * dot + spec, 0, 2);

          // apply shading to original color
          outData[srcIdx] = clamp(originalPixels[srcIdx] * shade, 0, 255);
          outData[srcIdx + 1] = clamp(originalPixels[srcIdx + 1] * shade, 0, 255);
          outData[srcIdx + 2] = clamp(originalPixels[srcIdx + 2] * shade, 0, 255);
          outData[srcIdx + 3] = originalPixels[srcIdx + 3];
        }
      }

      ctx.putImageData(out, 0, 0);
    }

    requestAnimationFrame(loop);
  }

})();
