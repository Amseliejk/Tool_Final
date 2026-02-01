// ===== EXPORT SYSTEM =====
// Handles PNG, GIF, SVG exports with angle presets and batch processing

// Saved angle slots
let savedAngles = Array(8).fill(null);
let selectedSlot = null;

// Export format handling
document.getElementById('exportFormat').addEventListener('change', function() {
  const format = this.value;
  const rotationSettings = document.getElementById('rotationSettings');
  const videoSettings = document.getElementById('videoSettings');
  
  // Show appropriate settings based on format
  if (format === 'mp4' || format === 'gif') {
    videoSettings.style.display = 'block';
    rotationSettings.style.display = 'none';
  } else if (format === 'png-rotation') {
    rotationSettings.style.display = 'block';
    videoSettings.style.display = 'none';
  } else {
    rotationSettings.style.display = 'none';
    videoSettings.style.display = 'none';
  }
});

// Video rotation mode handler
document.getElementById('videoRotationMode').addEventListener('change', function() {
  const mode = this.value;
  const rotationAxisDiv = document.getElementById('videoRotationAxis');
  
  if (mode === 'rotate') {
    rotationAxisDiv.style.display = 'block';
  } else {
    rotationAxisDiv.style.display = 'none';
  }
});

// Angle preset buttons
document.querySelectorAll('.angle-preset').forEach(btn => {
  btn.addEventListener('click', function() {
    const rotX = parseFloat(this.dataset.rotx);
    const rotY = parseFloat(this.dataset.roty);
    applyAngle(rotX, rotY);
  });
});

// Apply angle to view
function applyAngle(rotX, rotY) {
  // Convert degrees to radians and apply to p5 sketch
  if (typeof voxelRotX !== 'undefined') {
    voxelRotX = rotX * Math.PI / 180;
    voxelRotY = rotY * Math.PI / 180;
  }
}

// Main export button
document.getElementById('exportBtn').addEventListener('click', async function() {
  const format = document.getElementById('exportFormat').value;
  const progress = document.getElementById('exportProgress');
  
  progress.style.display = 'block';
  progress.textContent = 'Preparing export...';
  
  try {
    switch(format) {
      case 'png':
        await exportSinglePNG();
        break;
      case 'png-rotation':
        await exportPNGRotation();
        break;
      case 'mp4':
        await exportMP4();
        break;
      case 'svg':
        await exportSVG();
        break;
    }
    
    progress.textContent = 'Export complete!';
    setTimeout(() => {
      progress.style.display = 'none';
    }, 2000);
  } catch(error) {
    progress.textContent = 'Export failed: ' + error.message;
    progress.style.color = '#8B7E74';
    setTimeout(() => {
      progress.style.display = 'none';
      progress.style.color = '#8B7E74';
    }, 3000);
  }
});

// Export single PNG (current view)
async function exportSinglePNG() {
  // Create temporary canvas
  const sourceCanvas = document.querySelector('canvas');
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = sourceCanvas.width;
  tempCanvas.height = sourceCanvas.height;
  const ctx = tempCanvas.getContext('2d');
  
  // Fill with transparent background
  ctx.clearRect(0, 0, tempCanvas.width, tempCanvas.height);
  
  // Draw source canvas
  ctx.drawImage(sourceCanvas, 0, 0);
  
  
  // Download canvas
  tempCanvas.toBlob(blob => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'export.png';
    a.click();
    URL.revokeObjectURL(url);
  }, 'image/png');
}

// Export PNG batch (all saved angles)
async function exportPNGBatch() {
  const saved = savedAngles.filter(a => a !== null);
  
  if (saved.length === 0) {
    throw new Error('No saved angles! Save at least one angle first.');
  }
  
  const progress = document.getElementById('exportProgress');
  const originalRotX = voxelRotX;
  const originalRotY = voxelRotY;
  
  // Create ZIP file
  const zip = new JSZip();
  
  for (let i = 0; i < saved.length; i++) {
    progress.textContent = `Capturing ${i + 1}/${saved.length}...`;
    
    // Apply angle
    voxelRotX = saved[i].rotX * Math.PI / 180;
    voxelRotY = saved[i].rotY * Math.PI / 180;
    
    // Wait for render
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Capture canvas
    const canvas = document.querySelector('canvas');
    
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
    const ctx = tempCanvas.getContext('2d');
    
    ctx.drawImage(canvas, 0, 0);
    
    
    const blob = await new Promise(resolve => tempCanvas.toBlob(resolve, 'image/png'));
    
    // Add to ZIP
    zip.file(`angle_${i + 1}.png`, blob);
    
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  
  // Restore original view
  voxelRotX = originalRotX;
  voxelRotY = originalRotY;
  
  // Generate and download ZIP
  progress.textContent = 'Creating ZIP file...';
  const zipBlob = await zip.generateAsync({type: 'blob'});
  downloadBlob(zipBlob, 'export_batch.zip');
}

// Export PNG sequence (360° rotation)
async function exportPNGRotation() {
  const frames = parseInt(document.getElementById('rotationFrames').value);
  const axis = document.getElementById('rotationAxisGif').value;
  
  const progress = document.getElementById('exportProgress');
  
  const originalRotX = voxelRotX;
  const originalRotY = voxelRotY;
  
  const angleStep = (2 * Math.PI) / frames;
  
  // Create ZIP file
  const zip = new JSZip();
  
  for (let i = 0; i < frames; i++) {
    progress.textContent = `Capturing frame ${i + 1}/${frames}...`;
    
    // Apply rotation
    if (axis === 'y') {
      voxelRotY = originalRotY + (i * angleStep);
    } else if (axis === 'x') {
      voxelRotX = originalRotX + (i * angleStep);
    } else { // both
      voxelRotY = originalRotY + (i * angleStep);
      voxelRotX = originalRotX + (i * angleStep * 0.5);
    }
    
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Capture canvas
    const canvas = document.querySelector('canvas');
    
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
    const ctx = tempCanvas.getContext('2d');
    
    ctx.drawImage(canvas, 0, 0);
    
    
    const blob = await new Promise(resolve => tempCanvas.toBlob(resolve, 'image/png'));
    
    // Add to ZIP with padded filename
    const frameNum = String(i).padStart(3, '0');
    zip.file(`frame_${frameNum}.png`, blob);
    
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  
  // Restore
  voxelRotX = originalRotX;
  voxelRotY = originalRotY;
  
  // Generate and download ZIP
  progress.textContent = 'Creating ZIP file...';
  const zipBlob = await zip.generateAsync({type: 'blob'});
  downloadBlob(zipBlob, 'export_batch.zip');
}

// Export GIF animation
async function exportGIF() {
  const progress = document.getElementById('exportProgress');
  const canvas = document.querySelector('canvas');
  
  // Get settings
  const totalFrames = parseInt(document.getElementById('videoFrames').value);
  const rotationMode = document.getElementById('videoRotationMode').value;
  const axis = document.getElementById('rotationAxis').value;
  
  progress.style.display = 'block';
  progress.textContent = 'Preparing GIF encoder...';
  
  // Check if GIF library is loaded
  if (typeof GIF === 'undefined') {
    alert('GIF library not loaded. Please refresh the page.');
    progress.style.display = 'none';
    return;
  }
  
  // Save original state
  const originalRotX = voxelRotX;
  const originalRotY = voxelRotY;
  
  try {
    // Create GIF with optimized settings
    const gif = new GIF({
      workers: 2,
      quality: 20, // Lower quality = faster (1-30, lower is better quality but slower)
      width: canvas.width,
      height: canvas.height,
      // Don't specify workerScript - let gif.js use default
      debug: true
    });
    
    // Set up event handlers BEFORE rendering
    gif.on('finished', function(blob) {
      console.log('GIF encoding complete, blob size:', blob.size);
      console.log('Calling downloadBlob...');
      
      // Direct download without helper function for testing
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'animation.gif';
      document.body.appendChild(a);
      console.log('Clicking download link...');
      a.click();
      console.log('Download clicked!');
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      progress.textContent = 'GIF complete!';
      setTimeout(() => progress.style.display = 'none', 2000);
    });
    
    gif.on('progress', function(p) {
      const percent = Math.round(p * 100);
      progress.textContent = `Encoding GIF... ${percent}%`;
      console.log('Encoding progress:', percent + '%');
    });
    
    gif.on('error', function(e) {
      console.error('GIF encoding error:', e);
      progress.textContent = 'Error creating GIF!';
      setTimeout(() => progress.style.display = 'none', 3000);
    });
    
    progress.textContent = 'Rendering GIF frames...';
    
    // Render each frame
    for (let i = 0; i < totalFrames; i++) {
      const t = i / totalFrames;
      
      // Update rotation if in rotate mode
      if (rotationMode === 'rotate') {
        switch(axis) {
          case 'y':
            voxelRotY = originalRotY + (t * Math.PI * 2);
            break;
          case 'x':
            voxelRotX = originalRotX + (t * Math.PI * 2);
            break;
          case 'both':
            voxelRotY = originalRotY + (t * Math.PI * 2);
            voxelRotX = originalRotX + (t * Math.PI);
            break;
        }
      }
      
      // Wait for render and add frame
      await new Promise(resolve => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              try {
                gif.addFrame(canvas, {delay: 33, copy: true}); // ~30fps
                resolve();
              } catch(e) {
                console.error('Error adding frame:', e);
                resolve();
              }
            });
          });
        });
      });
      
      const percent = Math.round((i / totalFrames) * 100);
      progress.textContent = `Rendering GIF... ${percent}% (${i+1}/${totalFrames})`;
    }
    
    // Restore rotation
    voxelRotX = originalRotX;
    voxelRotY = originalRotY;
    
    console.log('All frames added, starting GIF render...');
    progress.textContent = 'Encoding GIF... (this may take a while)';
    
    // Start rendering
    gif.render();
    
  } catch(error) {
    console.error('GIF export error:', error);
    progress.textContent = 'Error: ' + error.message;
    setTimeout(() => progress.style.display = 'none', 3000);
    
    // Restore rotation
    voxelRotX = originalRotX;
    voxelRotY = originalRotY;
  }
}

// Export MP4 video (pre-rendered frames, then create video)
async function exportMP4() {
  const progress = document.getElementById('exportProgress');
  const canvas = document.querySelector('canvas');
  
  // Get settings
  const totalFrames = parseInt(document.getElementById('videoFrames').value);
  const rotationMode = document.getElementById('videoRotationMode').value;
  const axis = document.getElementById('rotationAxis').value;
  
  progress.style.display = 'block';
  progress.textContent = 'Pre-rendering all frames...';
  
  // Save original state
  const originalRotX = voxelRotX;
  const originalRotY = voxelRotY;
  
  // Store all rendered frames as ImageData
  const frames = [];
  
  // Pre-render all frames completely
  for (let i = 0; i < totalFrames; i++) {
    const t = i / totalFrames;
    
    // Calculate smooth rotation for this frame
    if (rotationMode === 'rotate') {
      switch(axis) {
        case 'y':
          voxelRotY = originalRotY + (t * Math.PI * 2);
          break;
        case 'x':
          voxelRotX = originalRotX + (t * Math.PI * 2);
          break;
        case 'both':
          voxelRotY = originalRotY + (t * Math.PI * 2);
          voxelRotX = originalRotX + (t * Math.PI);
          break;
      }
    }
    
    // Wait for multiple render cycles to ensure complete drawing
    await new Promise(resolve => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              // Capture ImageData (faster than blob)
              const ctx = canvas.getContext('2d');
              const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
              frames.push(imageData);
              resolve();
            });
          });
        });
      });
    });
    
    const percent = Math.round((i / totalFrames) * 100);
    progress.textContent = `Rendering frames... ${percent}% (${i+1}/${totalFrames})`;
  }
  
  // Restore original state
  voxelRotX = originalRotX;
  voxelRotY = originalRotY;
  
  progress.textContent = 'Creating video from pre-rendered frames...';
  
  // Create offscreen canvas for encoding
  const offscreenCanvas = document.createElement('canvas');
  offscreenCanvas.width = canvas.width;
  offscreenCanvas.height = canvas.height;
  const ctx = offscreenCanvas.getContext('2d');
  
  const fps = 30;
  
  // Use best available codec
  let mimeType = 'video/webm;codecs=vp9';
  if (!MediaRecorder.isTypeSupported(mimeType)) {
    mimeType = 'video/webm;codecs=vp8';
  }
  
  const stream = offscreenCanvas.captureStream(fps);
  const mediaRecorder = new MediaRecorder(stream, {
    mimeType: mimeType,
    videoBitsPerSecond: 15000000 // 15 Mbps very high quality
  });
  
  const chunks = [];
  mediaRecorder.ondataavailable = (e) => {
    if (e.data.size > 0) {
      chunks.push(e.data);
    }
  };
  
  // Start recording
  mediaRecorder.start();
  
  // Feed pre-rendered frames at exact timing
  const frameDuration = 1000 / fps;
  let frameIndex = 0;
  
  const feedFrame = () => {
    if (frameIndex < frames.length) {
      // Draw pre-rendered frame
      ctx.putImageData(frames[frameIndex], 0, 0);
      frameIndex++;
      
      const percent = Math.round((frameIndex / frames.length) * 100);
      if (frameIndex % 3 === 0) {
        progress.textContent = `Encoding video... ${percent}%`;
      }
      
      setTimeout(feedFrame, frameDuration);
    } else {
      // All frames fed, stop recording
      setTimeout(() => {
        mediaRecorder.stop();
      }, 500);
    }
  };
  
  // Start feeding frames
  feedFrame();
  
  return new Promise((resolve) => {
    mediaRecorder.onstop = () => {
      const blob = new Blob(chunks, { type: mimeType });
      downloadBlob(blob, 'animation.webm');
      progress.textContent = 'Video complete! (WEBM)';
      setTimeout(() => progress.style.display = 'none', 2000);
      resolve();
    };
  });
}

// Export video using frame-by-frame rendering (legacy WebM function)
async function exportVideo() {
  const progress = document.getElementById('exportProgress');
  const canvas = document.querySelector('canvas');
  
  // Get settings
  const totalFrames = parseInt(document.getElementById('videoFrames').value);
  const rotationMode = document.getElementById('videoRotationMode').value;
  const axis = document.getElementById('rotationAxis').value;
  
  const fps = 60; // Fixed 60fps for smooth playback
  
  progress.style.display = 'block';
  progress.textContent = 'Rendering frames...';
  
  // Save original state
  const originalRotX = voxelRotX;
  const originalRotY = voxelRotY;
  
  // Check MediaRecorder support
  if (!MediaRecorder.isTypeSupported('video/webm;codecs=vp9')) {
    if (!MediaRecorder.isTypeSupported('video/webm;codecs=vp8')) {
      throw new Error('WebM video recording not supported in this browser');
    }
  }
  
  // Create offscreen canvas for clean rendering
  const stream = canvas.captureStream(0);
  const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9') 
    ? 'video/webm;codecs=vp9' 
    : 'video/webm;codecs=vp8';
  const mediaRecorder = new MediaRecorder(stream, {
    mimeType: mimeType,
    videoBitsPerSecond: 8000000 // 8 Mbps for high quality
  });
  
  const chunks = [];
  mediaRecorder.ondataavailable = (e) => {
    if (e.data.size > 0) {
      chunks.push(e.data);
    }
  };
  
  // Start recording
  mediaRecorder.start(100);
  
  // Render each frame
  for (let i = 0; i < totalFrames; i++) {
    const t = i / totalFrames;
    
    // Update rotation if in rotate mode
    if (rotationMode === 'rotate') {
      switch(axis) {
        case 'y':
          voxelRotY = originalRotY + (t * Math.PI * 2);
          break;
        case 'x':
          voxelRotX = originalRotX + (t * Math.PI * 2);
          break;
        case 'both':
          voxelRotY = originalRotY + (t * Math.PI * 2);
          voxelRotX = originalRotX + (t * Math.PI);
          break;
      }
    }
    // If static mode, rotation stays at original values
    
    // Wait for multiple render cycles to ensure frame is fully rendered
    await new Promise(resolve => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            // Capture frame to stream after 3 animation frames
            stream.getTracks()[0].requestFrame();
            // Give more time for complex effects to render
            setTimeout(resolve, 50);
          });
        });
      });
    });
    
    // Update progress
    const percent = Math.round((i / totalFrames) * 100);
    progress.textContent = `Rendering... ${percent}% (${i+1}/${totalFrames})`;
  }
  
  // Restore rotation
  voxelRotX = originalRotX;
  voxelRotY = originalRotY;
  
  // Stop recording and finalize
  progress.textContent = 'Finalizing video...';
  
  return new Promise((resolve, reject) => {
    mediaRecorder.onstop = () => {
      const blob = new Blob(chunks, { type: 'video/webm' });
      downloadBlob(blob, 'animation.webm');
      progress.textContent = 'Video complete!';
      resolve();
    };
    
    mediaRecorder.onerror = (e) => {
      reject(new Error('Recording failed: ' + e.error));
    };
    
    mediaRecorder.stop();
  });
}

// Export SVG (All brush types)
async function exportSVG() {
  // Get all tubes
  if (typeof tubes === 'undefined' || tubes.length === 0) {
    throw new Error('No strokes to export. Draw something first!');
  }
  
  // Get current brush type
  const currentBrushType = typeof brushType !== 'undefined' ? brushType : 'pixel';
  
  // Create SVG from strokes
  const svg = createSVGFromStrokes(tubes, currentBrushType);
  
  // Download SVG file
  downloadSVG(svg, 'export.svg');
}

// Convert strokes to SVG (all brush types)
function createSVGFromStrokes(allTubes, brushType) {
  // Get canvas dimensions for SVG viewBox
  const canvas = document.querySelector('canvas');
  const width = canvas.width;
  const height = canvas.height;
  
  // Get current rotation for 3D to 2D projection
  const rotX = typeof voxelRotX !== 'undefined' ? voxelRotX : 0;
  const rotY = typeof voxelRotY !== 'undefined' ? voxelRotY : 0;
  const zoom = typeof voxelZoom !== 'undefined' ? voxelZoom : 1;
  
  // Start SVG with viewBox centered at 0,0 (like p5 WEBGL)
  const viewSize = Math.max(width, height);
  const svgHeader = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-viewSize/2} ${-viewSize/2} ${viewSize} ${viewSize}" width="${width}" height="${height}">
  <g id="drawing" fill="black" stroke="none">`;
  
  let svgPaths = '';
  
  // Process each tube based on brush type
  for (let tube of allTubes) {
    if (tube.length < 1) continue;
    
    // Project 3D points to 2D
    const projectedTube = tube.map(p => project3Dto2D(p, rotX, rotY, zoom));
    
    if (brushType === 'outline2') {
      // Vector Ink: stroke polygon
      const strokeWidth = typeof basePixelSize !== 'undefined' ? basePixelSize * 3 : 24;
      const polygon = createStrokePolygonForSVG(projectedTube, strokeWidth);
      if (polygon && polygon.length > 0) {
        const pathData = polygonToSVGPath(polygon);
        svgPaths += `\n    <path d="${pathData}"/>`;
      }
    } else if (brushType === 'smooth') {
      // Smooth: create smooth outline with rounded caps and variable width
      const baseSize = typeof basePixelSize !== 'undefined' ? basePixelSize : 8;
      const waveAmp = typeof waveAmpAndBlurRadius !== 'undefined' ? waveAmpAndBlurRadius : 15;
      const isWaveEnabled = typeof waveAnimationEnabled !== 'undefined' ? waveAnimationEnabled : false;
      const currentFrame = typeof frameCount !== 'undefined' ? frameCount : 0;
      
      if (projectedTube.length > 1) {
        // Export as densely packed circles for smooth appearance
        // Interpolate between points for denser coverage
        for (let i = 0; i < projectedTube.length - 1; i++) {
          const p1 = projectedTube[i];
          const p2 = projectedTube[i + 1];
          const dist = Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2);
          
          // Calculate wave size for point i
          let radius1;
          if (isWaveEnabled) {
            const wavePhase1 = i * 0.3 - currentFrame * 0.1;
            const waveAmplitude = Math.max(0.1, Math.min(0.4, (waveAmp - 5) / (60 - 5) * 0.3 + 0.1));
            const waveFactor1 = 1 + Math.sin(wavePhase1) * waveAmplitude;
            radius1 = (baseSize * waveFactor1) / 2;
          } else {
            radius1 = baseSize / 2;
          }
          
          // Add circles along the segment for smooth coverage
          const steps = Math.max(3, Math.ceil(dist / (radius1 * 0.3))); // Overlap circles
          for (let step = 0; step <= steps; step++) {
            const t = step / steps;
            const x = p1.x + (p2.x - p1.x) * t;
            const y = p1.y + (p2.y - p1.y) * t;
            const idx = i + t;
            
            // Interpolate wave size
            let radius;
            if (isWaveEnabled) {
              const wavePhase = idx * 0.3 - currentFrame * 0.1;
              const waveAmplitude = Math.max(0.1, Math.min(0.4, (waveAmp - 5) / (60 - 5) * 0.3 + 0.1));
              const waveFactor = 1 + Math.sin(wavePhase) * waveAmplitude;
              radius = (baseSize * waveFactor) / 2;
            } else {
              radius = baseSize / 2;
            }
            
            svgPaths += `\n    <circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="${radius.toFixed(2)}" fill="black"/>`;
          }
        }
      } else if (projectedTube.length === 1) {
        // Single point as circle
        const p = projectedTube[0];
        const radius = baseSize / 2;
        svgPaths += `\n    <circle cx="${p.x.toFixed(2)}" cy="${p.y.toFixed(2)}" r="${radius}" fill="black"/>`;
      }
    } else if (brushType === 'pixel' || brushType === 'simple' || brushType === 'surface') {
      // Box-based brushes: export each box with wave animation if enabled
      const baseSize = typeof basePixelSize !== 'undefined' ? basePixelSize : 8;
      const waveAmp = typeof waveAmpAndBlurRadius !== 'undefined' ? waveAmpAndBlurRadius : 15;
      const isWaveEnabled = typeof waveAnimationEnabled !== 'undefined' ? waveAnimationEnabled : false;
      const currentFrame = typeof frameCount !== 'undefined' ? frameCount : 0;
      
      for (let i = 0; i < projectedTube.length; i++) {
        const p = projectedTube[i];
        
        // Calculate wave size (same formula as in sketch.js)
        let size;
        if (isWaveEnabled) {
          const waveValue = Math.sin(i * 0.3 - currentFrame * 0.1);
          const t = (waveValue + 1) / 2; // normalize -1,1 to 0,1
          size = baseSize * 0.5 + t * (baseSize + waveAmp - baseSize * 0.5);
        } else {
          size = baseSize + waveAmp * 0.5;
        }
        
        const half = size / 2;
        svgPaths += `\n    <rect x="${(p.x - half).toFixed(2)}" y="${(p.y - half).toFixed(2)}" width="${size.toFixed(2)}" height="${size.toFixed(2)}" fill="black"/>`;
      }
    }
  }
  
  const svgFooter = `\n  </g>\n</svg>`;
  
  return svgHeader + svgPaths + svgFooter;
}

// Legacy function for backward compatibility
function createSVGFromOutline2(allTubes) {
  // Get canvas dimensions for SVG viewBox
  const canvas = document.querySelector('canvas');
  const width = canvas.width;
  const height = canvas.height;
  
  // Get current rotation for 3D to 2D projection
  const rotX = typeof voxelRotX !== 'undefined' ? voxelRotX : 0;
  const rotY = typeof voxelRotY !== 'undefined' ? voxelRotY : 0;
  const zoom = typeof voxelZoom !== 'undefined' ? voxelZoom : 1;
  
  // Start SVG with viewBox centered at 0,0 (like p5 WEBGL)
  const viewSize = Math.max(width, height);
  const svgHeader = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-viewSize/2} ${-viewSize/2} ${viewSize} ${viewSize}" width="${width}" height="${height}">
  <g id="drawing" fill="black" stroke="none">`;
  
  let svgPaths = '';
  
  // Process each tube
  for (let tube of allTubes) {
    if (tube.length < 2) continue;
    
    // Project 3D points to 2D using current view rotation
    const projectedTube = tube.map(p => project3Dto2D(p, rotX, rotY, zoom));
    
    // Create stroke polygon with width
    const strokeWidth = typeof basePixelSize !== 'undefined' ? basePixelSize * 3 : 24;
    const polygon = createStrokePolygonForSVG(projectedTube, strokeWidth);
    
    if (polygon && polygon.length > 0) {
      // Convert polygon to SVG path
      const pathData = polygonToSVGPath(polygon);
      svgPaths += `\n    <path d="${pathData}"/>`;
    }
  }
  
  const svgFooter = `
  </g>
</svg>`;
  
  return svgHeader + svgPaths + svgFooter;
}

// Project 3D point to 2D screen space (matching p5.js WEBGL projection)
function project3Dto2D(point, rotX, rotY, zoom) {
  let x = point.x;
  let y = point.y;
  let z = point.z;
  
  // Apply Y rotation
  let cosY = Math.cos(rotY);
  let sinY = Math.sin(rotY);
  let tempX = x * cosY + z * sinY;
  let tempZ = -x * sinY + z * cosY;
  x = tempX;
  z = tempZ;
  
  // Apply X rotation
  let cosX = Math.cos(rotX);
  let sinX = Math.sin(rotX);
  let tempY = y * cosX - z * sinX;
  tempZ = y * sinX + z * cosX;
  y = tempY;
  z = tempZ;
  
  // Apply zoom
  x *= zoom;
  y *= zoom;
  
  // Simple orthographic projection (ignore z for 2D)
  return { x: x, y: y };
}

// Create stroke polygon from tube points (simplified version for SVG)
function createStrokePolygonForSVG(points, width) {
  if (points.length < 2) return null;
  
  const halfWidth = width / 2;
  const leftSide = [];
  const rightSide = [];
  
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    
    // Calculate perpendicular offset
    let dx = 0, dy = 0;
    
    if (i < points.length - 1) {
      const next = points[i + 1];
      dx += next.x - p.x;
      dy += next.y - p.y;
    }
    if (i > 0) {
      const prev = points[i - 1];
      dx += p.x - prev.x;
      dy += p.y - prev.y;
    }
    
    // Normalize and rotate 90 degrees
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len > 0.01) {
      const perpX = -dy / len * halfWidth;
      const perpY = dx / len * halfWidth;
      
      leftSide.push({ x: p.x - perpX, y: p.y - perpY });
      rightSide.push({ x: p.x + perpX, y: p.y + perpY });
    }
  }
  
  // Combine left side + reversed right side to form closed polygon
  return [...leftSide, ...rightSide.reverse()];
}

// Create variable-width stroke polygon (for smooth brush with waves)
function createVariableStrokePolygonForSVG(points, baseSize, waveAmp, isWaveEnabled, currentFrame) {
  if (points.length < 2) return null;
  
  const leftSide = [];
  const rightSide = [];
  
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    
    // Calculate wave width for this point
    let halfWidth;
    if (isWaveEnabled) {
      const wavePhase = i * 0.3 - currentFrame * 0.1;
      const waveAmplitude = Math.max(0.1, Math.min(0.4, (waveAmp - 5) / (60 - 5) * 0.3 + 0.1));
      const waveFactor = 1 + Math.sin(wavePhase) * waveAmplitude;
      halfWidth = (baseSize * waveFactor) / 2;
    } else {
      halfWidth = baseSize / 2;
    }
    
    // Calculate perpendicular offset
    let dx = 0, dy = 0;
    
    if (i < points.length - 1) {
      const next = points[i + 1];
      dx += next.x - p.x;
      dy += next.y - p.y;
    }
    if (i > 0) {
      const prev = points[i - 1];
      dx += p.x - prev.x;
      dy += p.y - prev.y;
    }
    
    // Normalize and rotate 90 degrees
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len > 0.01) {
      const perpX = -dy / len * halfWidth;
      const perpY = dx / len * halfWidth;
      
      leftSide.push({ x: p.x - perpX, y: p.y - perpY });
      rightSide.push({ x: p.x + perpX, y: p.y + perpY });
    }
  }
  
  // Combine left side + reversed right side to form closed polygon
  return [...leftSide, ...rightSide.reverse()];
}

// Convert polygon points to SVG path data
function polygonToSVGPath(polygon) {
  if (polygon.length === 0) return '';
  
  let path = `M ${polygon[0].x.toFixed(2)} ${polygon[0].y.toFixed(2)}`;
  
  for (let i = 1; i < polygon.length; i++) {
    path += ` L ${polygon[i].x.toFixed(2)} ${polygon[i].y.toFixed(2)}`;
  }
  
  path += ' Z'; // Close path
  return path;
}

// Convert points to SVG stroke path (for smooth brush)
function pointsToStrokePath(points) {
  if (points.length === 0) return '';
  
  let path = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;
  
  for (let i = 1; i < points.length; i++) {
    path += ` L ${points[i].x.toFixed(2)} ${points[i].y.toFixed(2)}`;
  }
  
  return path;
}

// Download SVG as file
function downloadSVG(svgContent, filename) {
  const blob = new Blob([svgContent], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Download blob as file (for ZIP files)
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
