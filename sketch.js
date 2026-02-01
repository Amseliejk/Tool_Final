// ===== VARIABLES =====
let tubes = [];
let currentTube = [];
let tubeIdCounter = 0; // Unique ID counter for tubes
let voxelRotX = 0;
let voxelRotY = 0;
let lastMouseX, lastMouseY;
let lastDragX = 0, lastDragY = 0; // For camera rotation tracking
let rotateSpeed = 0.01;
let voxelZoom = 1;
let isDrawing = false;
let hasStarted = false; // Track if user has pressed space for the first time
let hasDrawnOnce = false; // Track if user has drawn at least one stroke

// Interaction modes
let interactionMode = "draw"; // "draw", "rotate", "pan"
let isPanning = false;
let panStartX = 0;
let panStartY = 0;
let panOffsetX = 0;
let panOffsetY = 0;

// Undo/Redo history
let tubesHistory = [];
let historyIndex = -1;
let maxHistorySize = 50;

// Cube configuration - each face stores text position [x, y] in normalized coords (0-1)
let cubeConfig = {
  text: 'A',
  font: 'Arial',
  textSize: 40,
  visibleFaces: 1,
  animate: false,
  editorMode: 'net', // 'net' or '3d'
  // For 3D mode: single position that wraps around cube
  uvPosition: {x: 0.5, y: 0.5}, // Position in unwrapped UV space (0-1)
  // For net mode: individual face positions
  facePositions: [
    {x: 0.5, y: 0.5}, // 0: top
    {x: 0.5, y: 0.5}, // 1: left
    {x: 0.5, y: 0.5}, // 2: front
    {x: 0.5, y: 0.5}, // 3: right
    {x: 0.5, y: 0.5}, // 4: bottom
    {x: 0.5, y: 0.5}  // 5: back
  ],
  activeFaces: [2], // which faces have text
  // Text on brushes
  textOnSurface: false,
  textOnOutline: false,
  brushText: 'HELLO',
  brushTextScale: 1.0,
  textRepeat: true
};
window.cubeConfig = cubeConfig; // Make accessible from HTML

// UI Elements
let cubeNetCanvas;
let pixelSizeSlider, waveSlider;
let brushTypeSelect, drawingMethodSelect;

// Drawing parameters
let waveAmpAndBlurRadius = 15;
let basePixelSize = 8;
let enableShading = false; // Enable lighting/shadows for 3D effect
let brushType = "pixel";
let drawingMethod = "freehand";
let waveAnimationEnabled = true; // Toggle wave animation on/off
let animationPaused = false; // Pause/Play animation
let outlineLevels = 0; // Number of concentric outlines
let outlineSpacing = 8; // Distance between outline levels
let outlineSmoothness = 0; // Smoothness of outline corners (0-100)
let brushEffect = "none"; // Effect overlay: "none", "growth"
let weingartActive = false; // Weingart cubes only active after clicking Activate button
let growthIntensity = 10; // Strength of differential growth

// Outline 2 (Vector Ink) variables
let mergedInkPolygon = null; // Stores the unified polygon outline

// Smoothing variables
let smoothedSpeed = 0;
let smoothedZ = 0;
let speedSmoothFactor = 0.3; // Lower = smoother (0.1-0.5 range)
let zSmoothFactor = 0.7; // Higher = more responsive, lower = smoother
let growthIteration = 3; // Number of growth iterations (now controls branching frequency)
let growthProgress = {}; // Stores current growth iteration for each tube
let maxGrowthIterations = 150; // Maximum growth iterations before stopping

// 3D Grid parameters
let showGrid = false; // Toggle grid visibility
window.showGrid = false; // Make it accessible from HTML
let gridSize = 20; // Size of each grid cell (hole size in pixels)
window.gridSize = 20; // Make it accessible from HTML
let gridDimensions = { x: 30, y: 30, z: 15 }; // Number of cells in each dimension
let filledCells = new Set(); // Set of world coordinates "x,y,z" for filled areas

// Z-depth parameters
let zDepthAmplitude = 600; // Increased from 150 for much stronger depth effect
let zSpeed = 0.05;
let zMode = "speed"; // "wave", "linear", "linear-back", "static", "speed"
let prevMousePos = null;
let currentSpeed = 0;
let maxSpeed = 10; // Lowered from 15 for more sensitive speed detection

// Arrow key drawing
let arrowPos;
let arrowSpeed = 10;
let arrowDirection = null;
let lastArrowUpdate = 0;
let arrowUpdateInterval = 50;

// Mini text cubes
let miniCubeTextLayers = [];
let miniCubeFaceSize = 64; // Increased for better quality
let showCubeMode = false;
let animationSpeed = 1;

// 3D cube drag state
let isDraggingNet = false;
let draggedFace = -1;
let netDragStartX = 0;
let netDragStartY = 0;
let dragStartPosX = 0; // Original position when drag started
let dragStartPosY = 0;

function setup() {
  // Check if coming from reset - skip welcome message and enable controls
  if (sessionStorage.getItem('skipWelcome') === 'true') {
    hasStarted = true;
    sessionStorage.removeItem('skipWelcome');
    // Hide welcome text IMMEDIATELY before any rendering
    let welcomeText = document.getElementById('welcomeText');
    if (welcomeText) {
      welcomeText.style.display = 'none';
    }
  }
  
  // Get the canvas container dimensions
  let container = document.getElementById('canvasContainer');
  let w = container.offsetWidth;
  let h = container.offsetHeight;
  
  let canvas = createCanvas(w, h, WEBGL);
  canvas.parent('canvasContainer');
  frameRate(60);
  
  // Enable transparency blending for opacity to work
  canvas.elt.getContext('webgl', {alpha: true});
  
  lastMouseX = mouseX;
  lastMouseY = mouseY;
  
  // Update cursor based on interaction mode
  updateCursor();
  
  // Initialize grid dimensions based on screen size
  updateGridDimensions();
  
  // Add keyboard shortcuts for mode switching
  document.addEventListener('keydown', (e) => {
    // Space is handled in keyPressed() function below
    if (e.key === 'h' || e.key === 'H') {
      interactionMode = "pan";
      updateCursor();
    }
  });
  

  
  // Initialize mini cube textures (6 faces)
  for (let i = 0; i < 6; i++) {
    let tl = createGraphics(miniCubeFaceSize, miniCubeFaceSize);
    tl.clear();
    tl.noSmooth();
    miniCubeTextLayers.push(tl);
  }

  // Setup cube net preview canvas
  cubeNetCanvas = select("#cubePreviewCanvas").elt;
  cubeNetCanvas.width = 640;
  cubeNetCanvas.height = 640;
  cubeNetCanvas.addEventListener('click', handleCubeNetClick);
  cubeNetCanvas.addEventListener('mousedown', handleCubeNetMouseDown);
  cubeNetCanvas.addEventListener('mousemove', handleCubeNetMouseMove);
  cubeNetCanvas.addEventListener('mouseup', handleCubeNetMouseUp);
  
  // Get UI elements
  pixelSizeSlider = select("#pixelSizeSlider");
  waveSlider = select("#waveSlider");
  brushTypeSelect = select("#brushType");
  drawingMethodSelect = select("#drawingMethod");
  
  // Wave animation checkbox
  let waveAnimationCheck = select("#waveAnimationCheck");
  waveAnimationCheck.changed(() => {
    waveAnimationEnabled = waveAnimationCheck.checked();
    // Enable/disable wave slider based on animation state
    let waveSliderElement = document.getElementById("waveSlider");
    if (waveSliderElement) {
      waveSliderElement.disabled = !waveAnimationEnabled;
    }
  });
  
  // Pause/Play button
  let pausePlayBtn = select("#pausePlayBtn");
  if (pausePlayBtn) {
    pausePlayBtn.mousePressed(() => {
      animationPaused = !animationPaused;
      let canvasContainer = document.getElementById('canvasContainer');
      let pauseBtn = document.getElementById('pausePlayBtn');
      
      if (animationPaused) {
        // Add 'paused' class to show pen cursor icon
        pauseBtn.classList.add('paused');
        // Switch to paused cursor (rotation cursor)
        canvasContainer.classList.remove('cursor-draw', 'cursor-rotate', 'cursor-pan');
        canvasContainer.classList.add('cursor-paused');
      } else {
        // Remove 'paused' class to show rotation cursor icon
        pauseBtn.classList.remove('paused');
        // Restore draw cursor
        canvasContainer.classList.remove('cursor-paused');
        updateCursor();
        
        // Reset view to front/default view when returning to draw mode
        voxelRotX = 0;
        voxelRotY = 0;
      }
    });
  }
  
  // Shading checkbox
  let shadingCheck = select("#shadingCheck");
  if (shadingCheck) {
    shadingCheck.changed(() => {
      enableShading = shadingCheck.checked();
    });
  }
  
  // Z-depth controls
  let zModeSelect = select("#zModeSelect");
  
  zModeSelect.changed(() => {
    zMode = zModeSelect.value();
  });
  
  // Outline levels controls
  let outlineLevelsSlider = select("#outlineLevelsSlider");
  let outlineSpacingSlider = select("#outlineSpacingSlider");
  
  outlineLevelsSlider.input(() => {
    outlineLevels = int(outlineLevelsSlider.value());
    console.log('>>> OUTLINE LEVELS CHANGED TO: ' + outlineLevels);
    let valueDisplay = select("#outlineLevelsValue");
    if (valueDisplay) valueDisplay.html(outlineLevels);
  });
  
  outlineSpacingSlider.input(() => {
    outlineSpacing = float(outlineSpacingSlider.value());
    let valueDisplay = select("#outlineSpacingValue");
    if (valueDisplay) valueDisplay.html(outlineSpacing);
  });
  
  // Effect controls
  let brushEffectSelect = select("#brushEffect");
  let growthIntensitySlider = select("#growthIntensitySlider");
  let growthIterationSlider = select("#growthIterationSlider");
  
  brushEffectSelect.changed(() => {
    brushEffect = brushEffectSelect.value();
    
    // Reset ALL effects first
    outlineLevels = 0;
    growthProgress = {}; // Clear all growth states completely
    
    // Deactivate Weingart if active
    if (weingartActive) {
      weingartActive = false;
      let activateBtn = document.getElementById('activateWeingartBtn');
      if (activateBtn) {
        activateBtn.textContent = 'Activate Weingart Cubes';
        activateBtn.style.background = '#8B7E74';
      }
    }
    
    // Now activate ONLY the selected effect
    if (brushEffect === "growth") {
      growthProgress = {}; // Fresh start for growth
      // Keep outlines at 0
      let outlineLevelsSlider = select("#outlineLevelsSlider");
      if (outlineLevelsSlider) {
        outlineLevelsSlider.value(0);
      }
    } else if (brushEffect === "outlines") {
      // Set default outline levels
      outlineLevels = 3;
      let outlineLevelsSlider = select("#outlineLevelsSlider");
      if (outlineLevelsSlider) {
        outlineLevelsSlider.value(3);
      }
    } else if (brushEffect === "weingart") {
      // Weingart gets activated via its own button, just select it here
      // User needs to click "Activate Weingart Cubes" button
    } else if (brushEffect === "none") {
      // Everything already reset above
    }
  });
  
  growthIntensitySlider.input(() => {
    growthIntensity = float(growthIntensitySlider.value());
    // Reset growth when parameters change for immediate effect
    if (brushEffect === "growth") {
      growthProgress = {};
    }
  });
  
  select("#drawingMethod").changed(() => {
    // Save current tube before switching methods
    if (currentTube.length > 1) {
      let finishedTube = [...currentTube];
      finishedTube.tubeId = tubeIdCounter++;
      tubes.push(finishedTube);
    }
    
    drawingMethod = select("#drawingMethod").value();
    updateCursor(); // Update cursor when drawing method changes
    
    // Reset current tube
    currentTube = [];
    
    if (drawingMethod === "arrow" && isDrawing) {
      arrowPos = createVector(0, 0, 0);
      
      // If grid is active, snap initial position to grid
      if (showGrid) {
        let gridPos = worldToGrid(0, 0, 0);
        let halfX = (gridDimensions.x * gridSize) / 2;
        let halfY = (gridDimensions.y * gridSize) / 2;
        let halfZ = (gridDimensions.z * gridSize) / 2;
        
        arrowPos.x = gridPos.x * gridSize - halfX + gridSize / 2;
        arrowPos.y = gridPos.y * gridSize - halfY + gridSize / 2;
        arrowPos.z = gridPos.z * gridSize - halfZ + gridSize / 2;
        
        fillCellAtPosition(arrowPos.x, arrowPos.y, arrowPos.z);
      }
      
      currentTube = [arrowPos.copy()];
      arrowDirection = null;
    }
  });
  
  updateMiniCubeText();
  drawCubePreview();
  drawCubeNetPreview(); // Ensure net is drawn initially
  
  // Text cube controls - using IDs from weingartControls
  let textInputElem = select("#cubeText");
  if (textInputElem) {
    textInputElem.input(() => {
      cubeConfig.text = select("#cubeText").value() || 'A';
      updateMiniCubeText();
      drawCubePreview();
    });
  }
  
  // Font select - check if it exists in weingart controls
  let fontSelectElem = select("#cubeFontSelect");
  if (fontSelectElem) {
    fontSelectElem.changed(() => {
      let selectedValue = select("#cubeFontSelect").value();
      
      // If upload option selected, trigger file input
      if (selectedValue === '__UPLOAD__') {
        let fileInput = document.getElementById('cubeFontUpload');
        if (fileInput) {
          fileInput.click();
        }
        return;
      }
      
      cubeConfig.font = selectedValue;
      updateMiniCubeText();
      drawCubePreview();
    });
  }
  
  // Custom font upload handler for Weingart Cube
  let cubeFontUploadElem = document.getElementById('cubeFontUpload');
  let cubeFontStatusElem = document.getElementById('cubeFontStatus');
  if (cubeFontUploadElem && cubeFontStatusElem && fontSelectElem) {
    cubeFontUploadElem.addEventListener('change', function(e) {
      let file = e.target.files[0];
      if (!file) {
        // Reset to previous selection if cancelled
        let selectElem = document.getElementById('cubeFontSelect');
        let foundCustom = false;
        for (let i = 0; i < selectElem.options.length; i++) {
          if (selectElem.options[i].value !== '__UPLOAD__' && selectElem.options[i].value.startsWith('CustomFont_')) {
            selectElem.value = selectElem.options[i].value;
            foundCustom = true;
            break;
          }
        }
        if (!foundCustom) {
          selectElem.value = 'Arial';
        }
        cubeConfig.font = selectElem.value;
        return;
      }
      
      cubeFontStatusElem.textContent = 'Loading font...';
      cubeFontStatusElem.style.color = '#ffa500';
      
      let reader = new FileReader();
      reader.onload = function(event) {
        let fontData = event.target.result;
        
        // Extract font name from filename
        let fontName = file.name.replace(/\.(ttf|otf|woff|woff2)$/i, '');
        fontName = fontName.replace(/[^a-zA-Z0-9]/g, '');
        let fontFamily = 'CustomFont_' + fontName;
        
        // Create and load font
        let fontFace = new FontFace(fontFamily, fontData);
        fontFace.load().then(function(loadedFont) {
          document.fonts.add(loadedFont);
          
          let selectElem = document.getElementById('cubeFontSelect');
          
          // Remove upload option
          let uploadOption = selectElem.querySelector('option[value="__UPLOAD__"]');
          if (uploadOption) uploadOption.remove();
          
          // Add custom font option
          let option = document.createElement('option');
          option.value = fontFamily;
          option.textContent = fontName + ' (Custom)';
          selectElem.appendChild(option);
          
          // Re-add upload option
          let newUploadOption = document.createElement('option');
          newUploadOption.value = '__UPLOAD__';
          newUploadOption.textContent = '+ Upload Custom Font...';
          newUploadOption.style.color = '#ffa500';
          newUploadOption.style.fontWeight = 'bold';
          selectElem.appendChild(newUploadOption);
          
          // Select the new font
          selectElem.value = fontFamily;
          cubeConfig.font = fontFamily;
          
          cubeFontStatusElem.textContent = 'Font loaded: ' + fontName;
          cubeFontStatusElem.style.color = '#4CAF50';
          
          updateMiniCubeText();
          drawCubePreview();
          
          console.log('Custom font loaded for Weingart Cube:', fontFamily);
        }).catch(function(error) {
          cubeFontStatusElem.textContent = 'Error loading font';
          cubeFontStatusElem.style.color = '#f44336';
          let selectElem = document.getElementById('cubeFontSelect');
          selectElem.value = 'Arial';
          cubeConfig.font = 'Arial';
          console.error('Font loading error:', error);
        });
      };
      
      reader.onerror = function() {
        cubeFontStatusElem.textContent = 'Error reading file';
        cubeFontStatusElem.style.color = '#f44336';
        let selectElem = document.getElementById('cubeFontSelect');
        selectElem.value = 'Arial';
        cubeConfig.font = 'Arial';
      };
      
      reader.readAsArrayBuffer(file);
    });
  }
  
  // Letter Size slider
  let letterSizeElem = select("#cubeLetterSize");
  if (letterSizeElem) {
    letterSizeElem.input(() => {
      cubeConfig.textSize = parseInt(select("#cubeLetterSize").value());
      updateMiniCubeText();
      drawCubePreview();
    });
  }
  
  let visibleFacesElem = select("#visibleFacesSlider");
  if (visibleFacesElem) {
    visibleFacesElem.input(() => {
      let count = parseInt(select("#visibleFacesSlider").value());
      cubeConfig.visibleFaces = count;
      // Update active faces based on count (start from front face and expand)
      let faceOrder = [2, 3, 1, 0, 4, 5]; // front, right, left, top, bottom, back
      cubeConfig.activeFaces = faceOrder.slice(0, count);
      drawCubeNetPreview();
    });
  }
  
  let animateCheckElem = select("#animateCubeCheck");
  if (animateCheckElem) {
    animateCheckElem.changed(() => {
      cubeConfig.animate = select("#animateCubeCheck").checked();
    });
  }

  // Button handlers
  let combineButtonElement = select("#combineButton");
  if (combineButtonElement) {
    combineButtonElement.mousePressed(() => {
      showCubeMode = !showCubeMode;
      if (showCubeMode) {
        select("#combineButton").html("Zurueck zum Zeichnen");
        updateMiniCubeText();
      } else {
        select("#combineButton").html("Kombiniere Zeichnung mit Wuerfeln");
      }
    });
  }
  
  // Reset button (in history buttons area) - use setTimeout to ensure DOM is ready
  setTimeout(() => {
    let resetBtn = document.getElementById('resetBtn');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        // Clear canvas like 'C' key
        tubes = [];
        currentTube = [];
        filledCells.clear();
        voxelRotX = 0;
        voxelRotY = 0;
        showCubeMode = false;
        let combineBtn = select("#combineButton");
        if (combineBtn) combineBtn.html("🎲 Kombiniere Zeichnung mit Würfeln");
        background(0);
        saveToHistory();
      });
    }
  }, 100);
  
  // Update cursor initially
  updateCursor();
  
  // Disable all canvas controls initially until space is pressed
  setTimeout(() => {
    let buttons = document.querySelectorAll('#historyButtons button, #gridToggleBtn');
    buttons.forEach(btn => btn.disabled = true);
    
    let zoomSlider = document.getElementById('onCanvasZoomSlider');
    if (zoomSlider) zoomSlider.disabled = true;
    
    let gridSlider = document.getElementById('gridSizeControlSlider');
    if (gridSlider) gridSlider.disabled = true;
    
    // Disable side panel controls
    let panel = document.getElementById('cubeConfigPanel');
    if (panel) {
      let inputs = panel.querySelectorAll('input, select, button');
      inputs.forEach(input => input.disabled = true);
      
      // Disable section headers (tabs)
      let headers = panel.querySelectorAll('h2');
      headers.forEach(header => {
        header.style.pointerEvents = 'none';
        header.style.opacity = '0.5';
      });
    }
  }, 100);
  
  // Undo/Redo buttons - use setTimeout to ensure DOM is ready
  setTimeout(() => {
    let undoBtn = document.getElementById('undoBtn');
    let redoBtn = document.getElementById('redoBtn');
    if (undoBtn && redoBtn) {
      undoBtn.addEventListener('click', undo);
      redoBtn.addEventListener('click', redo);
      // Save initial empty state
      saveToHistory();
    }
    
    // If we came from reset, hide welcome text and enable controls
    if (hasStarted) {
      let welcomeText = document.getElementById('welcomeText');
      if (welcomeText) {
        welcomeText.classList.remove('show');
      }
      enableCanvasControls();
    }
  }, 100);
}



function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  updateGridDimensions(); // Recalculate grid when window size changes
}

function enableCanvasControls() {
  // Enable all buttons
  let buttons = document.querySelectorAll('#historyButtons button, #gridToggleBtn');
  buttons.forEach(btn => btn.disabled = false);
  
  // Enable zoom slider
  let zoomSlider = document.getElementById('onCanvasZoomSlider');
  if (zoomSlider) zoomSlider.disabled = false;
  
  // Enable grid size slider
  let gridSlider = document.getElementById('gridSizeControlSlider');
  if (gridSlider) gridSlider.disabled = false;
  
  // Enable side panel controls
  let panel = document.getElementById('cubeConfigPanel');
  if (panel) {
    let inputs = panel.querySelectorAll('input, select, button');
    inputs.forEach(input => input.disabled = false);
    
    // Enable section headers (tabs)
    let headers = panel.querySelectorAll('h2');
    headers.forEach(header => {
      header.style.pointerEvents = 'auto';
      header.style.opacity = '1';
    });
  }
}

function updateCursor() {
  let container = document.getElementById('canvasContainer');
  
  // Remove all cursor classes
  container.classList.remove('cursor-draw', 'cursor-rotate', 'cursor-pan', 'cursor-hidden', 'arrow-drawing');
  
  // If not started yet, hide cursor
  if (!hasStarted) {
    container.classList.add('cursor-hidden');
    return;
  }
  
  // Add appropriate cursor class
  if (interactionMode === "draw") {
    container.classList.add('cursor-draw');
    // Hide cursor when in arrow key mode (not just when drawing)
    if (drawingMethod === "arrow") {
      container.classList.add('arrow-drawing');
    }
  } else if (interactionMode === "rotate") {
    container.classList.add('cursor-rotate');
  } else if (interactionMode === "pan") {
    container.classList.add('cursor-pan');
  }
}

function draw() {
  background(0, 0, 0, 0); // Transparent background
  
  // Enable alpha blending for transparency in WEBGL
  drawingContext.enable(drawingContext.BLEND);
  drawingContext.blendFunc(drawingContext.SRC_ALPHA, drawingContext.ONE_MINUS_SRC_ALPHA);
  
  // Sync grid variables with HTML controls
  showGrid = window.showGrid;
  gridSize = window.gridSize;
  
  // Update animation
  if (showCubeMode && cubeConfig.animate && frameCount % 3 === 0) {
    updateMiniCubeText();
  }

  // Get parameters
  waveAmpAndBlurRadius = float(waveSlider.value());
  brushType = brushTypeSelect.value();
  
  // If grid is active, brush size matches grid cell size
  if (showGrid) {
    basePixelSize = gridSize;
  } else {
    basePixelSize = float(pixelSizeSlider.value());
  }

  // Rotation (in rotate or pan mode, not when drawing)
  // Only rotate automatically with mouse movement when NOT paused
  if ((interactionMode === "rotate" || interactionMode === "pan") && !isDrawing && !animationPaused) {
    let dx = (mouseX - lastMouseX) * rotateSpeed;
    let dy = (mouseY - lastMouseY) * rotateSpeed;
    voxelRotY += dx;
    voxelRotX += dy;
  }

  // Apply transformations
  push();
  translate(panOffsetX, panOffsetY, 0);
  rotateX(voxelRotX);
  rotateY(voxelRotY);
  scale(voxelZoom);
  
  // Enable lighting if shading is active
  if (enableShading) {
    // Stronger ambient light
    ambientLight(80, 80, 80);
    
    // Main directional light from top-right
    directionalLight(200, 200, 200, 0.3, -0.5, -0.8);
    
    // Point light for dramatic effect
    pointLight(150, 150, 150, 200, -200, 200);
    
    // Subtle fill light from opposite side
    directionalLight(80, 80, 80, -0.3, 0.3, 0.5);
  } else {
    noLights();
  }
  
  // Don't use fill() here - will be set per brush type with materials
  noStroke();
  
  // Draw 3D grid
  drawGrid();
  
  // Always draw filled cells (from grid drawing)
  drawFilledCells();
  
  // Draw tubes only if grid is not active (in grid mode, only show filled cells)
  if (!showGrid) {
    // Special handling for Outline 2 (Vector Ink) with boolean union
    if (brushType === "outline2" && brushEffect !== "growth") {
      // Outline2 uses its own rendering UNLESS growth is active
      renderVectorInkOutline2([...tubes, ...(isDrawing && currentTube.length >= 2 ? [currentTube] : [])]);
    } else {
      // Normal brush rendering (including outline2 with growth)
      let drawFunc = showCubeMode ? drawBlockTube : drawSimpleTube;
    
      for (let i = 0; i < tubes.length; i++) {
        let tube = tubes[i];
        if (brushEffect === "growth") {
          // For growth, draw each branch separately to maintain structure
          // Use tube's unique ID if available, otherwise fall back to index
          let tubeId = tube.tubeId !== undefined ? tube.tubeId : i;
          drawGrowthBranches(tube, tubeId, brushType);
          continue;
        }
        drawFunc(tube, brushType);
      }

      if (isDrawing && currentTube.length > 1) {
        // While drawing, always show the correct brush style (growth starts after finishing)
        drawFunc(currentTube, brushType);
      } else if (isDrawing && currentTube.length > 0) {
        drawFunc(currentTube, brushType);
      }
    } // End of outline2 check
  }
  
  // Update and render preview window
  renderPreview();
  
  // Arrow key drawing updates
  if (isDrawing && drawingMethod === "arrow" && currentTube.length > 0) {
    if (arrowDirection && millis() - lastArrowUpdate > arrowUpdateInterval) {
      arrowPos.add(arrowDirection);
      
      // If grid is active, snap arrow position to grid
      if (showGrid) {
        let gridPos = worldToGrid(arrowPos.x, arrowPos.y, arrowPos.z);
        let halfX = (gridDimensions.x * gridSize) / 2;
        let halfY = (gridDimensions.y * gridSize) / 2;
        let halfZ = (gridDimensions.z * gridSize) / 2;
        
        // Snap to center of grid cell
        arrowPos.x = gridPos.x * gridSize - halfX + gridSize / 2;
        arrowPos.y = gridPos.y * gridSize - halfY + gridSize / 2;
        arrowPos.z = gridPos.z * gridSize - halfZ + gridSize / 2;
        
        // Fill the grid cell
        fillCellAtPosition(arrowPos.x, arrowPos.y, arrowPos.z);
      }
      
      currentTube.push(arrowPos.copy());
      lastArrowUpdate = millis();
    }
    
    // Draw cursor at arrow position (replaces red dot)
    push();
    translate(arrowPos.x, arrowPos.y, arrowPos.z);
    
    // Draw cursor matching the selected brush type
    if (brushType === "pixel") {
      noStroke();
      fill(255);
      box(basePixelSize * 1.2);
    } else if (brushType === "smooth") {
      noStroke();
      fill(255);
      sphere(basePixelSize * 0.8);
    } else if (brushType === "outline2") {
      stroke(255);
      strokeWeight(basePixelSize * 0.5);
      noFill();
      sphere(basePixelSize * 0.8);
    } else if (brushType === "surface") {
      noStroke();
      fill(255, 200);
      if (showCubeMode) {
        drawMiniTextCube(0, 0, 0, basePixelSize * 1.2);
      } else {
        box(basePixelSize * 1.2);
      }
    }
    pop();
  }
  
  pop(); // Close the pan/rotate transformation

  lastMouseX = mouseX;
  lastMouseY = mouseY;
}

function mouseDragged() {
  // Don't allow any interaction before first space press
  if (!hasStarted) return;
  
  // Get panel element to check if mouse is over it
  let panel = document.getElementById('cubeConfigPanel');
  let panelRect = panel.getBoundingClientRect();
  
  // Get grid size control panel
  let gridSizeControl = document.getElementById('gridSizeControl');
  let gridControlRect = gridSizeControl ? gridSizeControl.getBoundingClientRect() : null;
  
  // Get grid toggle button
  let gridToggleBtn = document.getElementById('gridToggleBtn');
  let gridBtnRect = gridToggleBtn ? gridToggleBtn.getBoundingClientRect() : null;
  
  // Don't interact if over panel or grid controls
  if (mouseX >= panelRect.left) return;
  if (gridControlRect && mouseX >= gridControlRect.left && mouseX <= gridControlRect.right && 
      mouseY >= gridControlRect.top && mouseY <= gridControlRect.bottom) return;
  if (gridBtnRect && mouseX >= gridBtnRect.left && mouseX <= gridBtnRect.right && 
      mouseY >= gridBtnRect.top && mouseY <= gridBtnRect.bottom) return;
  
  // Don't interact if over history buttons
  let historyButtons = document.getElementById('historyButtons');
  let historyRect = historyButtons ? historyButtons.getBoundingClientRect() : null;
  if (historyRect && mouseX >= historyRect.left && mouseX <= historyRect.right && 
      mouseY >= historyRect.top && mouseY <= historyRect.bottom) return;
  
  // In paused mode, allow camera rotation with mouse drag
  if (animationPaused) {
    let dx = (mouseX - lastDragX) * rotateSpeed;
    let dy = (mouseY - lastDragY) * rotateSpeed;
    voxelRotY += dx;
    voxelRotX += dy;
    lastDragX = mouseX;
    lastDragY = mouseY;
    return; // Don't process drawing in paused mode
  }
  
  // Draw mode - only draw in freehand mode and NOT over the panel
  if (interactionMode === "draw" && isDrawing && drawingMethod === "freehand") {
    // Use inverse projection for accurate mouse-to-3D conversion
    let worldPos = screenTo3D(mouseX, mouseY, 0);
    let x = worldPos.x;
    let y = worldPos.y;
    let z = 0;
    
    // Calculate drawing speed
    if (prevMousePos) {
      let dx = x - prevMousePos.x;
      let dy = y - prevMousePos.y;
      currentSpeed = sqrt(dx * dx + dy * dy);
      // Apply exponential moving average for smooth speed changes
      smoothedSpeed = smoothedSpeed * (1 - speedSmoothFactor) + currentSpeed * speedSmoothFactor;
    } else {
      smoothedSpeed = 0;
    }
    
    // Calculate Z based on selected mode
    let rawZ = 0;
    if (zMode === "speed") {
      // Speed-based: slow = backward, fast = forward
      // Normalize speed (0 = slow/stopped, 1 = very fast)
      let normalizedSpeed = constrain(smoothedSpeed / maxSpeed, 0, 1);
      // Invert so slow movement goes backward
      rawZ = -(1 - normalizedSpeed) * zDepthAmplitude;
    } else if (zMode === "wave") {
      let t = frameCount * zSpeed;
      rawZ = sin(t) * zDepthAmplitude;
    } else if (zMode === "linear") {
      rawZ = (frameCount * zSpeed * 10) % (zDepthAmplitude * 2) - zDepthAmplitude;
    } else if (zMode === "linear-back") {
      rawZ = -((frameCount * zSpeed * 10) % (zDepthAmplitude * 2) - zDepthAmplitude);
    } else if (zMode === "static") {
      rawZ = 0;
    }
    
    // Apply exponential moving average for smooth Z changes
    smoothedZ = smoothedZ * (1 - zSmoothFactor) + rawZ * zSmoothFactor;
    z = smoothedZ;
    
    let newPoint = createVector(x, y, z);
    
    // If grid is active, snap to grid and draw as filled cells
    if (showGrid) {
      // Snap coordinates to grid
      let gridPos = worldToGrid(x, y, z);
      let halfX = (gridDimensions.x * gridSize) / 2;
      let halfY = (gridDimensions.y * gridSize) / 2;
      let halfZ = (gridDimensions.z * gridSize) / 2;
      
      // Convert grid position back to world coordinates (center of cell)
      let snappedX = gridPos.x * gridSize - halfX + gridSize / 2;
      let snappedY = gridPos.y * gridSize - halfY + gridSize / 2;
      let snappedZ = gridPos.z * gridSize - halfZ + gridSize / 2;
      
      newPoint = createVector(snappedX, snappedY, snappedZ);
      
      // Fill cells
      fillCellAtPosition(x, y, z);
      
      // Fill interpolated cells for continuous drawing
      if (currentTube.length > 0) {
        let lastPoint = currentTube[currentTube.length - 1];
        let distance3D = dist(lastPoint.x, lastPoint.y, lastPoint.z, snappedX, snappedY, snappedZ);
        let threshold = gridSize * 0.5;
        
        if (distance3D > threshold) {
          let steps = ceil(distance3D / threshold);
          for (let i = 1; i < steps; i++) {
            let t = i / steps;
            let interpX = lerp(lastPoint.x, snappedX, t);
            let interpY = lerp(lastPoint.y, snappedY, t);
            let interpZ = lerp(lastPoint.z, snappedZ, t);
            fillCellAtPosition(interpX, interpY, interpZ);
          }
        }
      }
    }
    
    // Always add to tube for actual drawing
    currentTube.push(newPoint);
    prevMousePos = createVector(x, y);
  }
  
  // Rotate/Pan mode - handle camera rotation
  if ((interactionMode === "rotate" || interactionMode === "pan") && !isDrawing) {
    let dx = (mouseX - lastDragX) * rotateSpeed;
    let dy = (mouseY - lastDragY) * rotateSpeed;
    voxelRotY += dx;
    voxelRotX += dy;
    
    // Update last drag position
    lastDragX = mouseX;
    lastDragY = mouseY;
  }
}

function mousePressed() {
  // Don't allow any interaction before first space press
  if (!hasStarted) return;
  
  // Get panel element to check if mouse is over it
  let panel = document.getElementById('cubeConfigPanel');
  let panelRect = panel.getBoundingClientRect();
  
  // Don't interact if over panel
  if (mouseX >= panelRect.left) return;
  
  // Don't interact if over history buttons
  let historyButtons = document.getElementById('historyButtons');
  let historyRect = historyButtons ? historyButtons.getBoundingClientRect() : null;
  if (historyRect && mouseX >= historyRect.left && mouseX <= historyRect.right && 
      mouseY >= historyRect.top && mouseY <= historyRect.bottom) return;
  
  // Initialize drag position for rotation
  lastDragX = mouseX;
  lastDragY = mouseY;
  
  // Don't start drawing if paused
  if (animationPaused) return;
  
  // Draw mode - start new line if in freehand mode
  if (interactionMode === "draw" && drawingMethod === "freehand") {
    isDrawing = true;
    currentTube = [];
    prevMousePos = null;
    currentSpeed = 0;
    smoothedSpeed = 0;
    smoothedZ = 0;
  }
}

function mouseReleased() {
  
  // Stop drawing
  if (isDrawing && interactionMode === "draw") {
    isDrawing = false;
    
    // Open preview window on first stroke
    if (!hasDrawnOnce && currentTube.length > 0) {
      hasDrawnOnce = true;
      let previewWindow = document.getElementById('previewWindow');
      if (previewWindow && previewWindow.classList.contains('minimized')) {
        previewWindow.classList.remove('minimized');
        document.getElementById('previewToggle').textContent = '▼';
      }
    }
  }
}

// ===== MINI TEXT CUBE FUNCTIONS =====

function drawCubePreview() {
  if (cubeConfig.editorMode === '3d') {
    drawCube3DPreview();
  } else {
    drawCubeNetPreview();
  }
}

// Make functions globally accessible
window.drawCubePreview = drawCubePreview;
window.drawCubeNetPreview = drawCubeNetPreview;

function convertFaceToUV() {
  // Convert the first active face position to UV coordinates
  if (cubeConfig.activeFaces.length > 0) {
    let faceIndex = cubeConfig.activeFaces[0];
    let facePos = cubeConfig.facePositions[faceIndex];
    
    // Simple UV mapping: map face to 2D unwrapped space
    // Front face (2) is centered, others wrap around
    let uvX = 0.5, uvY = 0.5;
    
    switch(faceIndex) {
      case 0: // top
        uvX = facePos.x;
        uvY = 1.0 - facePos.y * 0.25;
        break;
      case 1: // left
        uvX = facePos.x * 0.25;
        uvY = 0.25 + facePos.y * 0.5;
        break;
      case 2: // front
        uvX = 0.25 + facePos.x * 0.25;
        uvY = 0.25 + facePos.y * 0.5;
        break;
      case 3: // right
        uvX = 0.5 + facePos.x * 0.25;
        uvY = 0.25 + facePos.y * 0.5;
        break;
      case 4: // bottom
        uvX = facePos.x;
        uvY = 0.75 + facePos.y * 0.25;
        break;
      case 5: // back
        uvX = 0.75 + facePos.x * 0.25;
        uvY = 0.25 + facePos.y * 0.5;
        break;
    }
    
    cubeConfig.uvPosition = {x: uvX, y: uvY};
    select("#textPosXSlider").value(uvX);
    select("#textPosYSlider").value(uvY);
  }
}

function uvToFacePosition(uvX, uvY) {
  // Convert UV coordinates (0-1) to face positions
  // UV space is laid out as an unwrapped cube
  
  let faceIndex = -1;
  let localX = 0, localY = 0;
  
  // Determine which face based on UV coordinates
  if (uvY > 0.75) { // Bottom section
    faceIndex = 4; // bottom
    localX = uvX;
    localY = (uvY - 0.75) / 0.25;
  } else if (uvY < 0.25) { // Top section
    faceIndex = 0; // top
    localX = uvX;
    localY = 1.0 - uvY / 0.25;
  } else { // Middle section (main faces)
    localY = (uvY - 0.25) / 0.5;
    
    if (uvX < 0.25) { // Left
      faceIndex = 1;
      localX = uvX / 0.25;
    } else if (uvX < 0.5) { // Front
      faceIndex = 2;
      localX = (uvX - 0.25) / 0.25;
    } else if (uvX < 0.75) { // Right
      faceIndex = 3;
      localX = (uvX - 0.5) / 0.25;
    } else { // Back
      faceIndex = 5;
      localX = (uvX - 0.75) / 0.25;
    }
  }
  
  return {faceIndex, x: localX, y: localY};
}

// Removed updateMiniCubeTextFromUV - 3D mode deleted

function drawTextOnCubeFace(faceIndex, x, y, letter) {
  if (faceIndex < 0 || faceIndex > 5) return;
  
  miniCubeTextLayers[faceIndex].push();
  miniCubeTextLayers[faceIndex].fill(0);
  miniCubeTextLayers[faceIndex].noStroke();
  
  // Limit text size to fit within face (max 80% of face size)
  let maxTextSize = miniCubeFaceSize * 0.8;
  let actualTextSize = min(cubeConfig.textSize, maxTextSize);
  
  miniCubeTextLayers[faceIndex].textSize(actualTextSize);
  miniCubeTextLayers[faceIndex].textAlign(CENTER, CENTER);
  miniCubeTextLayers[faceIndex].textFont(cubeConfig.font);
  miniCubeTextLayers[faceIndex].text(letter, x, y);
  miniCubeTextLayers[faceIndex].pop();
}

function handleTextOverflow(faceIndex, x, y, letter, textWidth, textHeight) {
  // Use adjacency map to draw overflow text
  const adjacency = {
    0: [ // Top
      {edge: 0, adjacent: 5},
      {edge: 1, adjacent: 3},
      {edge: 2, adjacent: 2},
      {edge: 3, adjacent: 1}
    ],
    1: [ // Left
      {edge: 0, adjacent: 0},
      {edge: 1, adjacent: 2},
      {edge: 2, adjacent: 4},
      {edge: 3, adjacent: 5}
    ],
    2: [ // Front
      {edge: 0, adjacent: 0},
      {edge: 1, adjacent: 3},
      {edge: 2, adjacent: 4},
      {edge: 3, adjacent: 1}
    ],
    3: [ // Right
      {edge: 0, adjacent: 0},
      {edge: 1, adjacent: 5},
      {edge: 2, adjacent: 4},
      {edge: 3, adjacent: 2}
    ],
    4: [ // Bottom
      {edge: 0, adjacent: 2},
      {edge: 1, adjacent: 3},
      {edge: 2, adjacent: 5},
      {edge: 3, adjacent: 1}
    ],
    5: [ // Back
      {edge: 0, adjacent: 0},
      {edge: 1, adjacent: 1},
      {edge: 2, adjacent: 4},
      {edge: 3, adjacent: 3}
    ]
  };
  
  if (x - textWidth/2 < 0) {
    let overflow = -(x - textWidth/2);
    let adj = adjacency[faceIndex][3];
    drawTextOnFace(adj.adjacent, miniCubeFaceSize - overflow, y, letter);
  }
  if (x + textWidth/2 > miniCubeFaceSize) {
    let overflow = (x + textWidth/2) - miniCubeFaceSize;
    let adj = adjacency[faceIndex][1];
    drawTextOnFace(adj.adjacent, overflow, y, letter);
  }
  if (y - textHeight/2 < 0) {
    let overflow = -(y - textHeight/2);
    let adj = adjacency[faceIndex][0];
    drawTextOnFace(adj.adjacent, x, miniCubeFaceSize - overflow, letter);
  }
  if (y + textHeight/2 > miniCubeFaceSize) {
    let overflow = (y + textHeight/2) - miniCubeFaceSize;
    let adj = adjacency[faceIndex][2];
    drawTextOnFace(adj.adjacent, x, overflow, letter);
  }
}

// Removed drawCube3DPreview - 3D mode deleted

function handleCubeNetClick(event) {
  let rect = cubeNetCanvas.getBoundingClientRect();
  let clickX = event.clientX - rect.left;
  let clickY = event.clientY - rect.top;
  
  // Scale to canvas coordinates
  let scaleX = cubeNetCanvas.width / rect.width;
  let scaleY = cubeNetCanvas.height / rect.height;
  clickX *= scaleX;
  clickY *= scaleY;
  
  // Dynamic scaling based on canvas size
  let scale = cubeNetCanvas.width / 280; // Original was 280x280
  let faceSize = 50 * scale;
  let gap = 8 * scale;
  let startX = 28 * scale; // Zentriert
  let startY = 30 * scale;
  
  // Cube net positions: [gridX, gridY, faceIndex]
  let netPositions = [
    [1, 0, 0], // top
    [0, 1, 1], // left
    [1, 1, 2], // front
    [2, 1, 3], // right
    [1, 2, 4], // bottom
    [3, 1, 5]  // back
  ];
  
  // Check which face was clicked
  for (let pos of netPositions) {
    let fx = startX + pos[0] * (faceSize + gap);
    let fy = startY + pos[1] * (faceSize + gap);
    let faceIndex = pos[2];
    
    if (clickX >= fx && clickX <= fx + faceSize &&
        clickY >= fy && clickY <= fy + faceSize) {
      // Calculate normalized position within face (0-1)
      let normX = (clickX - fx) / faceSize;
      let normY = (clickY - fy) / faceSize;
      
      // Update face position
      cubeConfig.facePositions[faceIndex] = {x: normX, y: normY};
      
      // Add this face to active faces if not already active
      if (!cubeConfig.activeFaces.includes(faceIndex)) {
        cubeConfig.activeFaces.push(faceIndex);
      }
      
      updateMiniCubeText();
      drawCubeNetPreview();
      break;
    }
  }
}

function handleCubeNetMouseDown(event) {
  let rect = cubeNetCanvas.getBoundingClientRect();
  let mouseX = event.clientX - rect.left;
  let mouseY = event.clientY - rect.top;
  
  let scaleX = cubeNetCanvas.width / rect.width;
  let scaleY = cubeNetCanvas.height / rect.height;
  mouseX *= scaleX;
  mouseY *= scaleY;
  
  // Dynamic scaling based on canvas size
  let scale = cubeNetCanvas.width / 280;
  let faceSize = 50 * scale;
  let gap = 8 * scale;
  let startX = 28 * scale; // Zentriert
  let startY = 30 * scale;
  
  let netPositions = [
    [1, 0, 0], [0, 1, 1], [1, 1, 2], [2, 1, 3], [1, 2, 4], [3, 1, 5]
  ];
  
  // Check if clicking on an active face
  for (let pos of netPositions) {
    let fx = startX + pos[0] * (faceSize + gap);
    let fy = startY + pos[1] * (faceSize + gap);
    let faceIndex = pos[2];
    
    if (cubeConfig.activeFaces.includes(faceIndex) &&
        mouseX >= fx && mouseX <= fx + faceSize &&
        mouseY >= fy && mouseY <= fy + faceSize) {
      isDraggingNet = true;
      draggedFace = faceIndex;
      
      // Calculate where within the face the click happened
      let clickOffsetX = (mouseX - fx) / faceSize;
      let clickOffsetY = (mouseY - fy) / faceSize;
      
      netDragStartX = mouseX;
      netDragStartY = mouseY;
      // Store original position
      dragStartPosX = cubeConfig.facePositions[faceIndex].x;
      dragStartPosY = cubeConfig.facePositions[faceIndex].y;
      break;
    }
  }
}

function handleCubeNetMouseMove(event) {
  if (!isDraggingNet) return;
  
  let rect = cubeNetCanvas.getBoundingClientRect();
  let mouseX = event.clientX - rect.left;
  let mouseY = event.clientY - rect.top;
  
  let scaleX = cubeNetCanvas.width / rect.width;
  let scaleY = cubeNetCanvas.height / rect.height;
  mouseX *= scaleX;
  mouseY *= scaleY;
  
  // Dynamic scaling
  let scale = cubeNetCanvas.width / 280;
  let faceSize = 50 * scale;
  
  // Calculate delta from original drag start position
  let totalDeltaX = (mouseX - netDragStartX) / faceSize;
  let totalDeltaY = (mouseY - netDragStartY) / faceSize;
  
  // Update position from original start position
  let pos = cubeConfig.facePositions[draggedFace];
  pos.x = constrain(dragStartPosX + totalDeltaX, 0, 1);
  pos.y = constrain(dragStartPosY + totalDeltaY, 0, 1);
  
  updateMiniCubeText();
  drawCubeNetPreview();
}

function handleCubeNetMouseUp(event) {
  isDraggingNet = false;
  draggedFace = -1;
}

function handleCube3DMouseDown(event) {
  // Removed - 3D mode deleted
}

function handleCube3DMouseMove(event) {
  // Removed - 3D mode deleted
}

function handleCube3DMouseUp(event) {
  // Removed - 3D mode deleted
}
function handleCube3DMouseUp(event) {
  isDragging3D = false;
}

function drawCubeNetPreview() {
  let ctx = cubeNetCanvas.getContext('2d');
  ctx.clearRect(0, 0, cubeNetCanvas.width, cubeNetCanvas.height);
  
  // Skalierung basierend auf Canvas-Größe
  let scale = cubeNetCanvas.width / 280; // Original war 280x280
  let faceSize = 50 * scale;
  let gap = 8 * scale;
  // Zentrieren: Netz ist 4 Faces breit = 4*faceSize + 3*gap = 224
  // (280 - 224) / 2 = 28
  let startX = 28 * scale;
  let startY = 30 * scale;
  
  // Cube net positions: [gridX, gridY, label, faceIndex]
  let netPositions = [
    [1, 0, 'Oben', 0],
    [0, 1, 'Links', 1],
    [1, 1, 'Vorne', 2],
    [2, 1, 'Rechts', 3],
    [1, 2, 'Unten', 4],
    [3, 1, 'Hinten', 5]
  ];
  
  netPositions.forEach((pos) => {
    let x = startX + pos[0] * (faceSize + gap);
    let y = startY + pos[1] * (faceSize + gap);
    let faceIndex = pos[3];
    
    // Check if this face is active
    let isActive = cubeConfig.activeFaces.includes(faceIndex);
    
    // Draw face background
    ctx.fillStyle = isActive ? '#8B7E74' : '#444';
    ctx.fillRect(x, y, faceSize, faceSize);
    
    // Draw border
    ctx.strokeStyle = isActive ? '#8B7E74' : '#444';
    ctx.lineWidth = 2 * scale;
    ctx.strokeRect(x, y, faceSize, faceSize);
    
    // Draw text if active
    if (isActive) {
      let textPos = cubeConfig.facePositions[faceIndex];
      let textX = x + textPos.x * faceSize;
      let textY = y + textPos.y * faceSize;
      
      // Draw text position indicator (crosshair)
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.lineWidth = 1 * scale;
      ctx.beginPath();
      ctx.moveTo(textX - 5 * scale, textY);
      ctx.lineTo(textX + 5 * scale, textY);
      ctx.moveTo(textX, textY - 5 * scale);
      ctx.lineTo(textX, textY + 5 * scale);
      ctx.stroke();
      
      // Draw text
      ctx.fillStyle = '#fff';
      ctx.font = `${cubeConfig.textSize * scale}px ${cubeConfig.font}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(cubeConfig.text, textX, textY);
    }
    
    // Draw text position indicator (crosshair) if active
    if (isActive) {
      let textPos = cubeConfig.facePositions[faceIndex];
      let textX = x + textPos.x * faceSize;
      let textY = y + textPos.y * faceSize;
      
      ctx.strokeStyle = 'rgba(255, 0, 0, 0.7)';
      ctx.lineWidth = 1 * scale;
      ctx.beginPath();
      ctx.moveTo(textX - 5 * scale, textY);
      ctx.lineTo(textX + 5 * scale, textY);
      ctx.moveTo(textX, textY - 5 * scale);
      ctx.lineTo(textX, textY + 5 * scale);
      ctx.stroke();
    }
    
    // Draw label
    ctx.fillStyle = '#999';
    ctx.font = `${10 * scale}px Arial`;
    ctx.textAlign = 'center';
    ctx.fillText(pos[2], x + faceSize/2, y + faceSize + 15 * scale);
  });
  
  // Instructions
  ctx.fillStyle = '#999';
  ctx.font = `${16 * scale}px Arial`;
  ctx.textAlign = 'left';
  ctx.fillText('Click to position the letter', 15 * scale, cubeNetCanvas.height - 15 * scale);
}

function updateMiniCubeText() {
  // Clear all faces
  for (let i = 0; i < 6; i++) {
    miniCubeTextLayers[i].clear();
    miniCubeTextLayers[i].background(255);
  }
  
  let letter = cubeConfig.text || 'A';
  let animOffset = cubeConfig.animate ? (frameCount * animationSpeed) % (miniCubeFaceSize * 2) : 0;
  
  // Define which faces are adjacent to each face and how they connect
  // Format: [faceIndex, edgeDirection, adjacentFace, adjacentEdge, flipX, flipY, rotation]
  // Edges: 0=top, 1=right, 2=bottom, 3=left
  const adjacency = {
    0: [ // Top face
      {edge: 0, adjacent: 5, transform: {flipX: false, flipY: true, rotate: 0}},   // top -> back bottom
      {edge: 1, adjacent: 3, transform: {flipX: false, flipY: false, rotate: 0}},  // right -> right left
      {edge: 2, adjacent: 2, transform: {flipX: false, flipY: false, rotate: 0}},  // bottom -> front top
      {edge: 3, adjacent: 1, transform: {flipX: false, flipY: false, rotate: 0}}   // left -> left right
    ],
    1: [ // Left face
      {edge: 0, adjacent: 0, transform: {flipX: false, flipY: false, rotate: 0}},  // top -> top left
      {edge: 1, adjacent: 2, transform: {flipX: false, flipY: false, rotate: 0}},  // right -> front left
      {edge: 2, adjacent: 4, transform: {flipX: false, flipY: false, rotate: 0}},  // bottom -> bottom left
      {edge: 3, adjacent: 5, transform: {flipX: false, flipY: false, rotate: 0}}   // left -> back right
    ],
    2: [ // Front face
      {edge: 0, adjacent: 0, transform: {flipX: false, flipY: false, rotate: 0}},  // top -> top bottom
      {edge: 1, adjacent: 3, transform: {flipX: false, flipY: false, rotate: 0}},  // right -> right left
      {edge: 2, adjacent: 4, transform: {flipX: false, flipY: false, rotate: 0}},  // bottom -> bottom top
      {edge: 3, adjacent: 1, transform: {flipX: false, flipY: false, rotate: 0}}   // left -> left right
    ],
    3: [ // Right face
      {edge: 0, adjacent: 0, transform: {flipX: false, flipY: false, rotate: 0}},  // top -> top right
      {edge: 1, adjacent: 5, transform: {flipX: false, flipY: false, rotate: 0}},  // right -> back left
      {edge: 2, adjacent: 4, transform: {flipX: false, flipY: false, rotate: 0}},  // bottom -> bottom right
      {edge: 3, adjacent: 2, transform: {flipX: false, flipY: false, rotate: 0}}   // left -> front right
    ],
    4: [ // Bottom face
      {edge: 0, adjacent: 2, transform: {flipX: false, flipY: false, rotate: 0}},  // top -> front bottom
      {edge: 1, adjacent: 3, transform: {flipX: false, flipY: false, rotate: 0}},  // right -> right bottom
      {edge: 2, adjacent: 5, transform: {flipX: false, flipY: true, rotate: 0}},   // bottom -> back top
      {edge: 3, adjacent: 1, transform: {flipX: false, flipY: false, rotate: 0}}   // left -> left bottom
    ],
    5: [ // Back face
      {edge: 0, adjacent: 0, transform: {flipX: false, flipY: true, rotate: 0}},   // top -> top top
      {edge: 1, adjacent: 1, transform: {flipX: false, flipY: false, rotate: 0}},  // right -> left left
      {edge: 2, adjacent: 4, transform: {flipX: false, flipY: true, rotate: 0}},   // bottom -> bottom bottom
      {edge: 3, adjacent: 3, transform: {flipX: false, flipY: false, rotate: 0}}   // left -> right right
    ]
  };
  
  // Draw text on active faces - each face gets one character
  let text = cubeConfig.text || 'A';
  
  for (let i = 0; i < cubeConfig.activeFaces.length; i++) {
    let faceIndex = cubeConfig.activeFaces[i];
    if (faceIndex < 0 || faceIndex >= 6) continue;
    
    let pos = cubeConfig.facePositions[faceIndex];
    let textX = pos.x * miniCubeFaceSize + (cubeConfig.animate ? animOffset : 0);
    let textY = pos.y * miniCubeFaceSize;
    
    // Get character for this face (cycle through text if needed)
    let char = text[i % text.length];
    
    // Draw character on this face
    drawTextOnCubeFace(faceIndex, textX, textY, char);
  }
}

function drawTextOnFace(faceIndex, x, y, letter) {
  if (faceIndex < 0 || faceIndex >= 6) return;
  
  miniCubeTextLayers[faceIndex].push();
  miniCubeTextLayers[faceIndex].fill(0);
  miniCubeTextLayers[faceIndex].noStroke();
  miniCubeTextLayers[faceIndex].textSize(cubeConfig.textSize);
  miniCubeTextLayers[faceIndex].textAlign(CENTER, CENTER);
  miniCubeTextLayers[faceIndex].textFont(cubeConfig.font);
  miniCubeTextLayers[faceIndex].text(letter, x, y);
  miniCubeTextLayers[faceIndex].pop();
}

function drawMiniTextCube(x, y, z, size) {
  let s = size || miniCubeFaceSize;
  
  push();
  translate(x, y, z);
  noStroke();
  noFill();
  
  // All 6 faces
  let faces = [
    [0, -s/2, 0, HALF_PI, 1, 0],  // Top
    [-s/2, 0, 0, -HALF_PI, 0, 1], // Left
    [0, 0, s/2, 0, 0, 2],         // Front
    [s/2, 0, 0, HALF_PI, 0, 3],   // Right
    [0, s/2, 0, -HALF_PI, 1, 4],  // Bottom
    [0, 0, -s/2, PI, 0, 5]        // Back
  ];
  
  for (let f of faces) {
    push();
    translate(f[0], f[1], f[2]);
    if (f[4] === 0) rotateY(f[3]);
    else rotateX(f[3]);
    texture(miniCubeTextLayers[f[5]]);
    plane(s, s);
    pop();
  }
  
  pop();
}

function drawMiniTextCubeOutline(x, y, z, size) {
  let s = size || miniCubeFaceSize;
  let h = s / 2;
  
  push();
  translate(x, y, z);
  stroke(255);
  strokeWeight(1.5);
  noFill();
  
  // Draw 12 edges of the cube
  // Bottom face
  line(-h, h, -h, h, h, -h);
  line(h, h, -h, h, h, h);
  line(h, h, h, -h, h, h);
  line(-h, h, h, -h, h, -h);
  
  // Top face
  line(-h, -h, -h, h, -h, -h);
  line(h, -h, -h, h, -h, h);
  line(h, -h, h, -h, -h, h);
  line(-h, -h, h, -h, -h, -h);
  
  // Vertical edges
  line(-h, -h, -h, -h, h, -h);
  line(h, -h, -h, h, h, -h);
  line(h, -h, h, h, h, h);
  line(-h, -h, h, -h, h, h);
  
  pop();
}

// ===== 3D GRID FUNCTIONS =====

function updateGridDimensions() {
  // Calculate grid dimensions to fill the entire screen
  // Use zoom to determine the visible area
  let visibleWidth = (width / voxelZoom) * 1.5; // Add margin
  let visibleHeight = (height / voxelZoom) * 1.5;
  
  gridDimensions.x = ceil(visibleWidth / gridSize);
  gridDimensions.y = ceil(visibleHeight / gridSize);
  gridDimensions.z = 15; // Keep Z dimension fixed for 3D drawing
}

// Make it globally accessible
window.updateGridDimensions = updateGridDimensions;

function drawGrid() {
  if (!showGrid) return;
  
  push();
  stroke(150, 150, 150, 200); // Brighter, more visible gray
  strokeWeight(2); // Thicker lines for clearer visibility
  noFill();
  
  let halfX = (gridDimensions.x * gridSize) / 2;
  let halfY = (gridDimensions.y * gridSize) / 2;
  
  // Draw only 2D grid on XY plane (Z = 0), like Excel
  // Horizontal lines (rows)
  for (let y = 0; y <= gridDimensions.y; y++) {
    let yPos = y * gridSize - halfY;
    line(-halfX, yPos, 0, halfX, yPos, 0);
  }
  
  // Vertical lines (columns)
  for (let x = 0; x <= gridDimensions.x; x++) {
    let xPos = x * gridSize - halfX;
    line(xPos, -halfY, 0, xPos, halfY, 0);
  }
  
  pop();
}

function drawFilledCells() {
  if (filledCells.size === 0) return;
  
  push();
  fill(255, 255, 255, 200);
  noStroke();
  
  // Group world coordinates by current grid cells (pixelization filter)
  let currentGridCells = new Set();
  
  for (let cellKey of filledCells) {
    let [worldX, worldY, worldZ] = cellKey.split(',').map(Number);
    
    // Convert world coords to current grid indices
    let gridPos = worldToGrid(worldX, worldY, worldZ);
    let currentCellKey = `${gridPos.x},${gridPos.y},${gridPos.z}`;
    currentGridCells.add(currentCellKey);
  }
  
  // Draw cells at current grid size
  let halfX = (gridDimensions.x * gridSize) / 2;
  let halfY = (gridDimensions.y * gridSize) / 2;
  let halfZ = (gridDimensions.z * gridSize) / 2;
  
  for (let cellKey of currentGridCells) {
    let [gx, gy, gz] = cellKey.split(',').map(Number);
    let xPos = gx * gridSize - halfX + gridSize / 2;
    let yPos = gy * gridSize - halfY + gridSize / 2;
    let zPos = gz * gridSize - halfZ + gridSize / 2;
    
    push();
    translate(xPos, yPos, zPos);
    box(gridSize * 0.9); // Slightly smaller to show grid
    pop();
  }
  
  pop();
}

function worldToGrid(x, y, z) {
  // Convert world coordinates to grid cell coordinates
  let halfX = (gridDimensions.x * gridSize) / 2;
  let halfY = (gridDimensions.y * gridSize) / 2;
  let halfZ = (gridDimensions.z * gridSize) / 2;
  
  let gx = floor((x + halfX) / gridSize);
  let gy = floor((y + halfY) / gridSize);
  let gz = floor((z + halfZ) / gridSize);
  
  // Clamp to grid bounds
  gx = constrain(gx, 0, gridDimensions.x - 1);
  gy = constrain(gy, 0, gridDimensions.y - 1);
  gz = constrain(gz, 0, gridDimensions.z - 1);
  
  return { x: gx, y: gy, z: gz };
}

function fillCellAtPosition(worldX, worldY, worldZ) {
  let gridPos = worldToGrid(worldX, worldY, worldZ);
  let halfX = (gridDimensions.x * gridSize) / 2;
  let halfY = (gridDimensions.y * gridSize) / 2;
  let halfZ = (gridDimensions.z * gridSize) / 2;
  
  // Store multiple world coordinates within the cell to ensure proper pixelation at smaller sizes
  // Sample points at 1/4 intervals within the cell
  let cellWorldX = gridPos.x * gridSize - halfX + gridSize / 2;
  let cellWorldY = gridPos.y * gridSize - halfY + gridSize / 2;
  let cellWorldZ = gridPos.z * gridSize - halfZ + gridSize / 2;
  
  // Store center and sample points for better resolution when grid gets smaller
  let samplePoints = [
    {x: cellWorldX, y: cellWorldY, z: cellWorldZ}, // center
    {x: cellWorldX - gridSize/4, y: cellWorldY - gridSize/4, z: cellWorldZ},
    {x: cellWorldX + gridSize/4, y: cellWorldY - gridSize/4, z: cellWorldZ},
    {x: cellWorldX - gridSize/4, y: cellWorldY + gridSize/4, z: cellWorldZ},
    {x: cellWorldX + gridSize/4, y: cellWorldY + gridSize/4, z: cellWorldZ}
  ];
  
  for (let point of samplePoints) {
    let cellKey = `${point.x},${point.y},${point.z}`;
    filledCells.add(cellKey);
  }
}

// Convert all existing tubes to grid cells
function convertTubesToGrid() {
  // Clear any existing grid cells before converting
  filledCells.clear();
  
  // Convert each tube's points to grid cells
  for (let tube of tubes) {
    for (let point of tube) {
      fillCellAtPosition(point.x, point.y, point.z);
    }
  }
  
  // Convert current tube if exists
  for (let point of currentTube) {
    fillCellAtPosition(point.x, point.y, point.z);
  }
  
}

// Convert grid cells back to tubes and clear grid
function convertGridToTubes() {
  // Simply clear the grid without converting to tubes
  // This prevents creating massive tubes that cause lag
  filledCells.clear();
  currentTube = [];
  
  // Note: Grid cells are not converted back to tubes because:
  // 1. They would create one huge tube with thousands of disconnected points
  // 2. This causes severe performance issues
  // 3. User wants grid pixels to disappear when grid is turned off
}

// Make it globally accessible
window.convertTubesToGrid = convertTubesToGrid;
window.convertGridToTubes = convertGridToTubes;

// ===== DRAWING FUNCTIONS =====

// ===== DIFFERENTIAL GROWTH EFFECT =====

// Node class for differential line growth (adapted for 3D)
class Node3D {
  constructor(x, y, z, mF, mS, dS, sCR, gS) {
    this.position = createVector(x, y, z);
    this.velocity = createVector(0, 0, 0);
    this.acceleration = createVector(0, 0, 0);

    this.maxForce = mF;
    this.maxSpeed = mS;
    this.desiredSeparation = dS;
    this.separationCohesionRation = sCR;

    this.dontGrow = gS;
  }

  run(nodes) {
    if (this.dontGrow) {
      this.differentiate(nodes);
      this.update();
    }
  }

  applyForce(force) {
    this.acceleration.add(force);
  }

  differentiate(nodes) {
    let separation = this.separate(nodes);
    let cohesion = this.edgeCohesion(nodes);

    separation.mult(this.separationCohesionRation);
    this.applyForce(separation);
    this.applyForce(cohesion);
  }

  update() {
    this.velocity.add(this.acceleration);
    this.velocity.limit(this.maxSpeed);
    this.position.add(this.velocity);
    this.acceleration.mult(0);
  }

  seek(target) {
    let desired = p5.Vector.sub(target, this.position);
    desired = desired.setMag(this.maxSpeed);
    let steer = p5.Vector.sub(desired, this.velocity);
    steer = steer.limit(this.maxForce);
    return steer;
  }

  separate(nodes) {
    let steer = createVector(0, 0, 0);
    let count = 0;

    for (let other of nodes) {
      let d = this.position.dist(other.position);
      if (d > 0 && d < this.desiredSeparation) {
        let diff = createVector(this.position.x, this.position.y, this.position.z).sub(other.position);
        diff.normalize();
        diff.div(d);
        
        // Moderate Z-axis variation for organic 3D growth without chaos
        diff.z += random(-0.3, 0.3);
        
        steer.add(diff);
        count++;
      }
    }
    if (count > 0) {
      steer.div(count);
    }
    if (steer.mag() > 0) {
      steer.setMag(this.maxSpeed);
      steer.sub(this.velocity);
      steer.limit(this.maxForce);
    }
    return steer;
  }

  edgeCohesion(nodes) {
    let sum = createVector(0, 0, 0);
    let this_index = nodes.indexOf(this);

    if (this_index != 0 && this_index != nodes.length - 1) {
      sum = p5.Vector.add(sum, nodes[this_index - 1].position);
      sum = p5.Vector.add(sum, nodes[this_index + 1].position);
    } else if (this_index == 0) {
      // Weaker attraction to end for slower closing
      sum = p5.Vector.add(sum, p5.Vector.lerp(nodes[nodes.length - 1].position, nodes[this_index].position, 0.7));
      sum = p5.Vector.add(sum, nodes[this_index + 1].position);
    } else if (this_index == nodes.length - 1) {
      // Weaker attraction to start for slower closing
      sum = p5.Vector.add(sum, nodes[this_index - 1].position);
      sum = p5.Vector.add(sum, p5.Vector.lerp(nodes[0].position, nodes[this_index].position, 0.7));
    }

    sum = p5.Vector.div(sum, 2);
    return this.seek(sum);
  }
}

// DifferentialLine class for managing nodes
class DifferentialLine3D {
  constructor(mF, mS, dS, sCr, eL) {
    this.nodes = [];
    this.maxSpeed = mF;
    this.maxForce = mS;
    this.desiredSeparation = dS;
    this.separationCohesionRation = sCr;
    this.maxEdgeLen = eL;
  }

  run() {
    for (let n of this.nodes) {
      n.run(this.nodes);
    }
    this.growth();
  }

  addNode(n) {
    this.nodes.push(n);
  }

  addNodeAt(n, i) {
    this.nodes.splice(i, 0, n);
  }

  growth() {
    // Iterate through all nodes including connection from last to first (closed loop)
    for (let i = 0; i < this.nodes.length; i++) {
      let n1 = this.nodes[i];
      let n2 = this.nodes[(i + 1) % this.nodes.length]; // Wrap around to close the loop
      let d = n1.position.dist(n2.position);
      if (d > this.maxEdgeLen + map(noise(millis() / 1000), 0, 1, -2, 5)) {
        let middleNode = n1.position.copy().add(n2.position).div(2);
        
        // Organic 3D growth variation - balanced for flowing forms
        let zVariation = random(-5, 5) * (growthIntensity / 20);
        middleNode.z += zVariation;
        
        // Subtle XY variation for organic irregularity
        middleNode.x += random(-2, 2) * (growthIntensity / 30);
        middleNode.y += random(-2, 2) * (growthIntensity / 30);
        
        // Insert after current node (for last node, insert before first)
        let insertIndex = (i + 1) % this.nodes.length;
        this.addNodeAt(
          new Node3D(
            middleNode.x,
            middleNode.y,
            middleNode.z,
            this.maxForce + random(-0.1, 0.1),
            this.maxSpeed + random(-0.1, 0.1),
            this.desiredSeparation + noise(millis() / 1000) * 5,
            this.separationCohesionRation,
            true
          ),
          insertIndex
        );
      }
    }
  }

  getPoints() {
    return this.nodes.map(n => createVector(n.position.x, n.position.y, n.position.z));
  }
}

function drawGrowthBranches(tube, tubeId, brushType) {
  if (tube.length < 3) return;
  
  // Get or create growth state with differential line
  if (!growthProgress[tubeId]) {
    // Map growth controls to differential line parameters - optimized for organic growth
    let maxForce = map(growthIntensity, 1, 50, 0.8, 2.5);
    let maxSpeed = map(growthIntensity, 1, 50, 0.8, 2.5);
    let desiredSeparation = map(growthIntensity, 1, 50, 12, 30); // Balance between separation and organic form
    let separationCohesionRatio = 1.2; // Higher = more cohesion, more organic flowing forms
    let maxEdgeLen = 8; // Slightly longer edges for more organic growth
    
    let diffLine = new DifferentialLine3D(maxForce, maxSpeed, desiredSeparation, separationCohesionRatio, maxEdgeLen);
    
    // Start with fewer nodes for better performance - sample every Nth point
    let nodeSpacing = max(3, floor(tube.length / 40)); // Start with only ~40 nodes
    for (let i = 0; i < tube.length; i += nodeSpacing) {
      let p = tube[i];
      diffLine.addNode(
        new Node3D(
          p.x, p.y, p.z,
          maxForce + random(-0.3, 0.3), // More variation for organic growth
          maxSpeed + random(-0.2, 0.2), // Vary speed too
          desiredSeparation + random(-2, 2), // Vary separation for organic irregularity
          separationCohesionRatio,
          true // dontGrow = true means it will move
        )
      );
    }
    
    growthProgress[tubeId] = {
      iteration: 0,
      diffLine: diffLine,
      framesSinceLastGrowth: 0
    };
  }
  
  let state = growthProgress[tubeId];
  
  // Get current number of points
  let points = state.diffLine.getPoints();
  
  // Safety checks to prevent performance issues - lower limit for better FPS
  const MAX_POINTS = 800; // Lower maximum for better performance
  const MAX_ITERATIONS = 500; // Maximum iterations before stopping
  
  // Check if growth should stop
  if (points.length > MAX_POINTS || state.iteration > MAX_ITERATIONS) {
    // Stop growing - just draw the final state with brush-specific rendering
    drawGrowthWithBrushStyle(points, brushType);
    return;
  }
  
  // Update every frame for smooth animation - slow and organic
  state.framesSinceLastGrowth++;
  if (state.framesSinceLastGrowth < 2) {
    // Just draw existing nodes without updating
    drawGrowthWithBrushStyle(points, brushType);
    return;
  }
  state.framesSinceLastGrowth = 0;
  
  // Perform only one growth step per update for slow, visible organic growth
  state.diffLine.run();
  state.iteration++;
  
  // Draw the differential line with brush-specific style
  points = state.diffLine.getPoints();
  drawGrowthWithBrushStyle(points, brushType);
}

function drawGrowthWithBrushStyle(points, brushType) {
  if (points.length < 2) return;
  
  if (brushType === "outline" || brushType === "outline2") {
    // Outline brush: draw outlines around the grown path with organic style
    stroke(255, 255);
    strokeWeight(2);
    noFill();
    
    let outlineOffset = basePixelSize * 1.5;
    
    // Smooth the grown path first using averaging
    let smoothedPoints = [];
    let smoothWindow = 5;
    
    for (let i = 0; i < points.length; i++) {
      let sum = createVector(0, 0, 0);
      let count = 0;
      
      for (let j = -smoothWindow; j <= smoothWindow; j++) {
        let idx = (i + j + points.length) % points.length; // Wrap around for closed loop
        sum.add(points[idx]);
        count++;
      }
      
      smoothedPoints.push(p5.Vector.div(sum, count));
    }
    
    // Generate left and right outlines with organic variation
    let leftOutline = [];
    let rightOutline = [];
    
    for (let i = 0; i < smoothedPoints.length; i++) {
      let p = smoothedPoints[i];
      let next = smoothedPoints[(i + 1) % smoothedPoints.length];
      let prev = smoothedPoints[(i - 1 + smoothedPoints.length) % smoothedPoints.length];
      
      let dx = next.x - prev.x;
      let dy = next.y - prev.y;
      
      let len = sqrt(dx * dx + dy * dy);
      let offsetX = 0, offsetY = 0;
      if (len > 0.01) {
        offsetX = -dy / len * outlineOffset;
        offsetY = dx / len * outlineOffset;
      }
      
      // Smooth organic variation instead of sharp wave
      let organic = map(sin(i * 0.15) * cos(i * 0.08), -1, 1, 0.85, 1.15);
      let organicOffsetX = offsetX * organic;
      let organicOffsetY = offsetY * organic;
      
      leftOutline.push(createVector(p.x - organicOffsetX, p.y - organicOffsetY, p.z));
      rightOutline.push(createVector(p.x + organicOffsetX, p.y + organicOffsetY, p.z));
    }
    
    // Draw smooth closed curves using curveVertex
    beginShape();
    curveVertex(leftOutline[0].x, leftOutline[0].y, leftOutline[0].z);
    for (let p of leftOutline) {
      curveVertex(p.x, p.y, p.z);
    }
    curveVertex(leftOutline[0].x, leftOutline[0].y, leftOutline[0].z);
    endShape(CLOSE);
    
    beginShape();
    curveVertex(rightOutline[0].x, rightOutline[0].y, rightOutline[0].z);
    for (let p of rightOutline) {
      curveVertex(p.x, p.y, p.z);
    }
    curveVertex(rightOutline[0].x, rightOutline[0].y, rightOutline[0].z);
    endShape(CLOSE);
  } else if (brushType === "surface") {
    // Surface brush: draw filled surfaces that grow outward
    noStroke();
    
    if (enableShading) {
      let alpha = 200;
      ambientMaterial(255, 255, 255, alpha);
      emissiveMaterial(50, 50, 50, alpha);
      specularMaterial(200, 200, 200);
      shininess(50);
    } else {
      fill(255, 200);
      emissiveMaterial(255, 255, 255, 200);
    }
    
    // Draw main filled surface
    beginShape();
    for (let p of points) {
      vertex(p.x, p.y, p.z);
    }
    endShape(CLOSE);
    
    // Add outline for definition
    stroke(255, 255);
    strokeWeight(1);
    noFill();
    beginShape();
    for (let p of points) {
      vertex(p.x, p.y, p.z);
    }
    endShape(CLOSE);
  } else {
    // Pixel and smooth brush: draw as tube
    let drawFunc = showCubeMode ? drawBlockTube : drawSimpleTube;
    drawFunc(points, brushType);
  }
}

function applyDifferentialGrowthAnimated(tube, tubeId) {
  // Legacy function - no longer used
  return tube;
}

// Find intersection points between all tubes
function findIntersections() {
  let intersections = [];
  let threshold = basePixelSize * 3; // Distance threshold for considering points as intersecting
  
  // Compare each tube with every other tube
  for (let i = 0; i < tubes.length; i++) {
    for (let j = i + 1; j < tubes.length; j++) {
      let tubeA = tubes[i];
      let tubeB = tubes[j];
      
      // Sample points from both tubes
      let samplingRate = max(1, floor(max(tubeA.length, tubeB.length) / 30));
      
      for (let a = 0; a < tubeA.length; a += samplingRate) {
        for (let b = 0; b < tubeB.length; b += samplingRate) {
          let dist = p5.Vector.dist(tubeA[a], tubeB[b]);
          if (dist < threshold) {
            // Found an intersection - store both the position and nearby points for direction
            let midpoint = p5.Vector.lerp(tubeA[a], tubeB[b], 0.5);
            
            // Check if we already have a nearby intersection
            let isDuplicate = false;
            for (let existing of intersections) {
              if (p5.Vector.dist(midpoint, existing.pos) < threshold) {
                isDuplicate = true;
                break;
              }
            }
            
            if (!isDuplicate) {
              // Calculate normal direction (perpendicular to the strokes)
              let dirA = createVector(0, 0, 0);
              let dirB = createVector(0, 0, 0);
              
              if (a > 0 && a < tubeA.length - 1) {
                dirA = p5.Vector.sub(tubeA[a+1], tubeA[a-1]);
              }
              if (b > 0 && b < tubeB.length - 1) {
                dirB = p5.Vector.sub(tubeB[b+1], tubeB[b-1]);
              }
              
              dirA.normalize();
              dirB.normalize();
              
              // Average direction at intersection
              let avgDir = p5.Vector.add(dirA, dirB);
              avgDir.normalize();
              
              intersections.push({
                pos: midpoint,
                dir: avgDir
              });
            }
          }
        }
      }
    }
  }
  
  return intersections;
}

// Add tendrils as additional points to tubes at intersections
function addTendrilsToTubes() {
  if (brushEffect !== "tendrils" || tubes.length < 2) return;
  
  let intersections = findIntersections();
  
  // For each intersection, create one single spiral tendril
  for (let intersection of intersections) {
    let tendrilTube = [];
    
    // Start exactly at the intersection point
    tendrilTube.push(intersection.pos.copy());
    
    // Calculate perpendicular direction for the spiral plane
    let perpVec = createVector(1, 0, 0);
    if (abs(intersection.dir.dot(perpVec)) > 0.9) {
      perpVec = createVector(0, 1, 0);
    }
    let perpVec2 = p5.Vector.cross(intersection.dir, perpVec);
    perpVec2.normalize();
    perpVec = p5.Vector.cross(perpVec2, intersection.dir);
    perpVec.normalize();
    
    // Generate a single spiral that curls inward
    let segments = floor(tendrilDiameter / (basePixelSize * 0.4));
    let maxRadius = tendrilDiameter * 0.5; // Half diameter = radius
    
    for (let s = 1; s <= segments; s++) {
      let t = s / segments; // 0 to 1
      
      // Spiral angle - multiple rotations while shrinking inward
      let angle = t * PI * 6; // 3 full rotations (6 * PI)
      
      // Radius starts at max and spirals inward
      let radius = maxRadius * (1 - t * 0.7); // Spiral inward, but not completely to center
      
      // Position in the perpendicular plane - drawing a circle that curls inward
      let offsetX = cos(angle) * radius;
      let offsetY = sin(angle) * radius;
      
      let pos = intersection.pos.copy();
      pos.add(p5.Vector.mult(perpVec, offsetX));
      pos.add(p5.Vector.mult(perpVec2, offsetY));
      
      tendrilTube.push(pos.copy());
    }
    
    // Add this tendril as a new tube
    if (tendrilTube.length > 1) {
      tubes.push(tendrilTube);
    }
  }
}

function applyTendrilEffect(tube) {
  // This function is no longer used for tendrils
  // Tendrils are now added as separate tubes
  return tube;
}

function drawSimpleTube(tube, type) {
  // Don't apply effect here anymore - it's applied before calling this function
  let effectTube = tube;
  
  if (effectTube.length === 0) return;
  
  if (type === "surface") {
    // Surface mode: filled 3D shape with automatic closing
    if (effectTube.length < 3) return;
    
    // Draw filled shape
    noStroke();
    
    // Set material for shading and transparency
    if (enableShading) {
      let alpha = 200;
      ambientMaterial(255, 255, 255, alpha);
      emissiveMaterial(50, 50, 50, alpha);
      specularMaterial(200, 200, 200);
      shininess(50);
    } else {
      fill(255, 200);
      emissiveMaterial(255, 255, 255, 200);
    }
    
    beginShape();
    for (let p of effectTube) {
      vertex(p.x, p.y, p.z);
    }
    endShape(CLOSE);
    
    // Add outline for definition
    stroke(255, 255);
    strokeWeight(1);
    noFill();
    beginShape();
    for (let p of effectTube) {
      vertex(p.x, p.y, p.z);
    }
    endShape(CLOSE);
    
    // Project text onto surface if enabled
    if (cubeConfig.textOnSurface && cubeConfig.brushText && effectTube.length >= 3) {
      projectTextOnSurface(effectTube);
    }
    
    // Draw outlines if enabled for surface brush
    if (outlineLevels >= 1 && effectTube.length > 2) {
      console.log('SURFACE BRUSH: Drawing outlines, levels=' + outlineLevels + ', tube length=' + effectTube.length);
      stroke(255);
      strokeWeight(2);
      noFill();
      
      for (let level = 1; level <= outlineLevels; level++) {
        let outlineOffset = basePixelSize * 1.5 + (level * outlineSpacing);
        
        let leftOutline = [];
        let rightOutline = [];
        
        for (let i = 0; i < effectTube.length; i++) {
          let p = effectTube[i];
          let offsetX = outlineOffset;
          let offsetY = 0;
          
          let dx = 0, dy = 0;
          
          let next = effectTube[(i + 1) % effectTube.length];
          let prev = effectTube[(i - 1 + effectTube.length) % effectTube.length];
          dx = next.x - prev.x;
          dy = next.y - prev.y;
          
          let len = sqrt(dx * dx + dy * dy);
          if (len > 0.01) {
            offsetX = -dy / len * outlineOffset;
            offsetY = dx / len * outlineOffset;
          }
          
          leftOutline.push(createVector(p.x - offsetX, p.y - offsetY, p.z));
          rightOutline.push(createVector(p.x + offsetX, p.y + offsetY, p.z));
        }
        
        // Apply smoothing to outline points if smoothness > 0
        if (outlineSmoothness > 0) {
          let smoothingPasses = floor(map(outlineSmoothness, 0, 100, 0, 4));
          for (let pass = 0; pass < smoothingPasses; pass++) {
            leftOutline = smoothOutlinePoints(leftOutline);
            rightOutline = smoothOutlinePoints(rightOutline);
          }
        }
        
        // Draw closed outlines
        beginShape();
        if (outlineSmoothness > 0 && leftOutline.length > 2) {
          curveVertex(leftOutline[0].x, leftOutline[0].y, leftOutline[0].z);
          for (let p of leftOutline) {
            curveVertex(p.x, p.y, p.z);
          }
          curveVertex(leftOutline[0].x, leftOutline[0].y, leftOutline[0].z);
        } else {
          for (let p of leftOutline) {
            vertex(p.x, p.y, p.z);
          }
        }
        endShape(CLOSE);
        
        beginShape();
        if (outlineSmoothness > 0 && rightOutline.length > 2) {
          curveVertex(rightOutline[0].x, rightOutline[0].y, rightOutline[0].z);
          for (let p of rightOutline) {
            curveVertex(p.x, p.y, p.z);
          }
          curveVertex(rightOutline[0].x, rightOutline[0].y, rightOutline[0].z);
        } else {
          for (let p of rightOutline) {
            vertex(p.x, p.y, p.z);
          }
        }
        endShape(CLOSE);
      }
    }

    return; // Skip other rendering
  }
  
  if (type === "smooth") {
    // Smooth mode: continuous tube with speed-based thickness and tapering
    if (effectTube.length < 2) return;
    
    // Calculate speeds for thickness variation with fine sensitivity
    let speeds = [];
    for (let i = 0; i < effectTube.length; i++) {
      if (i === 0) {
        speeds.push(0);
      } else {
        // Convert objects to vectors for dist calculation
        let p1 = createVector(effectTube[i].x, effectTube[i].y, effectTube[i].z);
        let p2 = createVector(effectTube[i-1].x, effectTube[i-1].y, effectTube[i-1].z);
        let dist = p5.Vector.dist(p1, p2);
        speeds.push(dist);
      }
    }
    
    // Normalize speeds with smoother curve and better range preservation
    let maxSpeed = Math.max(...speeds, 0.01);
    let normalizedSpeeds = speeds.map(s => {
      let normalized = s / maxSpeed;
      // Gentler curve so fast strokes stay thinner and more visible
      // Fast (normalized=1) → 0.1 (thin but visible)
      // Slow (normalized=0) → 1.0 (thick)
      return Math.pow(1 - normalized, 0.8); // Gentler power curve
    });
    
    // Draw as connected spheres with varying radius
    noStroke();
    
    // Set material properties for shading and transparency
    if (enableShading) {
      // Emissive material shows color even in shadow and supports alpha
      let alpha = 255;
      ambientMaterial(255, 255, 255, alpha);
      emissiveMaterial(50, 50, 50, alpha);
      specularMaterial(200, 200, 200);
      shininess(50);
    } else {
      // Without shading, use emissive for flat color with transparency
      fill(255, 255);
      emissiveMaterial(255, 255, 255, 255);
    }
    
    // Calculate dynamics strength once
    let dynamicsAmount = map(waveAmpAndBlurRadius, 5, 60, 0.0, 1.0); // 0 = uniform, 1 = maximum variation
    
    // Interpolate between points for smooth continuous line
    for (let i = 0; i < effectTube.length - 1; i++) {
      let p1 = effectTube[i];
      let p2 = effectTube[i + 1];
      
      // Calculate distance and create intermediate points
      let v1 = createVector(p1.x, p1.y, p1.z);
      let v2 = createVector(p2.x, p2.y, p2.z);
      let dist = p5.Vector.dist(v1, v2);
      let steps = Math.max(3, Math.ceil(dist / (basePixelSize * 0.15)));
      
      for (let step = 0; step <= steps; step++) {
        let t = step / steps;
        let interpolatedIndex = i + t;
        
        // Interpolate position
        let x = lerp(p1.x, p2.x, t);
        let y = lerp(p1.y, p2.y, t);
        let z = lerp(p1.z, p2.z, t);
        
        // Calculate speed factor with minimal smoothing to preserve variations
        // Use nearest speed value instead of interpolating when dynamics is high
        let nearestSpeedIndex = t < 0.5 ? i : i + 1;
        let speedValue = dynamicsAmount > 0.3 ? normalizedSpeeds[nearestSpeedIndex] : 
                         lerp(normalizedSpeeds[i], normalizedSpeeds[i + 1], t);
        
        // Apply dynamics with minimum thickness so thin strokes stay visible
        // Low dynamics = uniform, high dynamics = dramatic but with visible thin parts
        let dynamicsStrength = map(dynamicsAmount, 0, 1, 0.1, 3.0);
        let minThicknessFactor = 0.3; // Minimum 30% of base size for thin strokes
        let speedFactor = minThicknessFactor + (1 - minThicknessFactor) + speedValue * dynamicsStrength * dynamicsAmount;
        
        // Add wave animation (peristaltic movement) if enabled
        let waveFactor = 1.0;
        if (waveAnimationEnabled) {
          // Create traveling wave along the stroke length
          let wavePhase = interpolatedIndex * 0.3 - frameCount * 0.1;
          let waveAmplitude = map(waveAmpAndBlurRadius, 5, 60, 0.1, 0.4);
          waveFactor = 1 + sin(wavePhase) * waveAmplitude;
        }
        
        // Calculate taper factor (fade in at start, fade out at end)
        let taperFactor = 1.0;
        let taperLength = Math.min(10, effectTube.length / 4);
        
        if (interpolatedIndex < taperLength) {
          taperFactor = interpolatedIndex / taperLength;
        } else if (interpolatedIndex > effectTube.length - 1 - taperLength) {
          taperFactor = (effectTube.length - 1 - interpolatedIndex) / taperLength;
        }
        
        // Combine speed, wave, and taper
        let finalRadius = basePixelSize * speedFactor * waveFactor * taperFactor * 0.5;
        
        // Draw sphere at this interpolated point
        push();
        translate(x, y, z);
        sphere(finalRadius);
        pop();
      }
    }
    
    // Draw outlines if enabled for smooth brush
    if (outlineLevels >= 1 && effectTube.length > 1) {
      console.log('SMOOTH BRUSH: Drawing outlines, levels=' + outlineLevels + ', tube length=' + effectTube.length);
      stroke(255);
      strokeWeight(2);
      noFill();
      
      for (let level = 1; level <= outlineLevels; level++) {
        let outlineOffset = basePixelSize * 1.5 + (level * outlineSpacing);
        
        let leftOutline = [];
        let rightOutline = [];
        
        for (let i = 0; i < effectTube.length; i++) {
          let p = effectTube[i];
          let offsetX = outlineOffset;
          let offsetY = 0;
          
          let dx = 0, dy = 0;
          
          if (i < effectTube.length - 1) {
            let next = effectTube[i + 1];
            dx += next.x - p.x;
            dy += next.y - p.y;
          }
          if (i > 0) {
            let prev = effectTube[i - 1];
            dx += p.x - prev.x;
            dy += p.y - prev.y;
          }
          
          let len = sqrt(dx * dx + dy * dy);
          if (len > 0.01) {
            offsetX = -dy / len * outlineOffset;
            offsetY = dx / len * outlineOffset;
          }
          
          let wave = waveAnimationEnabled ? map(sin(i * 0.3 - frameCount * 0.1), -1, 1, 0.7, 1.3) : 1.0;
          let waveOffsetX = offsetX * wave;
          let waveOffsetY = offsetY * wave;
          
          leftOutline.push(createVector(p.x - waveOffsetX, p.y - waveOffsetY, p.z));
          rightOutline.push(createVector(p.x + waveOffsetX, p.y + waveOffsetY, p.z));
        }
        
        // Apply smoothing to outline points if smoothness > 0
        if (outlineSmoothness > 0) {
          let smoothingPasses = floor(map(outlineSmoothness, 0, 100, 0, 4));
          for (let pass = 0; pass < smoothingPasses; pass++) {
            leftOutline = smoothOutlinePoints(leftOutline);
            rightOutline = smoothOutlinePoints(rightOutline);
          }
        }
        
        beginShape();
        if (outlineSmoothness > 0 && leftOutline.length > 2) {
          curveVertex(leftOutline[0].x, leftOutline[0].y, leftOutline[0].z);
          for (let p of leftOutline) {
            curveVertex(p.x, p.y, p.z);
          }
          let last = leftOutline[leftOutline.length - 1];
          curveVertex(last.x, last.y, last.z);
        } else {
          for (let p of leftOutline) {
            vertex(p.x, p.y, p.z);
          }
        }
        endShape();
        
        beginShape();
        if (outlineSmoothness > 0 && rightOutline.length > 2) {
          curveVertex(rightOutline[0].x, rightOutline[0].y, rightOutline[0].z);
          for (let p of rightOutline) {
            curveVertex(p.x, p.y, p.z);
          }
          let last = rightOutline[rightOutline.length - 1];
          curveVertex(last.x, last.y, last.z);
        } else {
          for (let p of rightOutline) {
            vertex(p.x, p.y, p.z);
          }
        }
        endShape();
      }
    }
  } else if (type === "simple") {
    // Simple mode: just draw boxes without wave effects (like preview)
    noStroke();
    if (enableShading) {
      let alpha = 255;
      ambientMaterial(255, 255, 255, alpha);
      emissiveMaterial(50, 50, 50, alpha);
      specularMaterial(200, 200, 200);
      shininess(50);
    } else {
      fill(255, 255);
      emissiveMaterial(255, 255, 255, 255);
    }
    
    // Draw all points for smooth appearance
    for (let i = 0; i < effectTube.length; i++) {
      let pos = effectTube[i];
      push();
      translate(pos.x, pos.y, pos.z);
      box(basePixelSize);
      pop();
    }
  } else if (type === "pixel") {
    // Check if weingart effect is active
    if (weingartActive) {
      // Draw weingart cubes instead of normal pixels
      let step = max(1, floor(effectTube.length / 500));
      for (let i = 0; i < effectTube.length; i += step) {
        let pos = effectTube[i];
        let wave = waveAnimationEnabled ? 
          map(sin(i * 0.3 - frameCount * 0.1), -1, 1, basePixelSize * 0.5, basePixelSize + waveAmpAndBlurRadius) :
          basePixelSize + waveAmpAndBlurRadius * 0.5;
        push();
        translate(pos.x, pos.y, pos.z);
        drawMiniTextCube(0, 0, 0, wave);
        pop();
      }
    } else {
      // Normal pixel rendering
      // Set material for boxes
      noStroke();
      if (enableShading) {
        let alpha = 255;
        ambientMaterial(255, 255, 255, alpha);
        emissiveMaterial(50, 50, 50, alpha);
        specularMaterial(200, 200, 200);
        shininess(50);
      } else {
        fill(255, 255);
        emissiveMaterial(255, 255, 255, 255);
      }
      
      // Adaptive step - draw fewer points for better performance
      let step = max(1, floor(effectTube.length / 500));
      for (let i = 0; i < effectTube.length; i += step) {
        let pos = effectTube[i];
        let wave = waveAnimationEnabled ? 
          map(sin(i * 0.3 - frameCount * 0.1), -1, 1, basePixelSize * 0.5, basePixelSize + waveAmpAndBlurRadius) :
          basePixelSize + waveAmpAndBlurRadius * 0.5;
        push();
        translate(pos.x, pos.y, pos.z);
        box(wave);
        pop();
      }
    }
    
    // Draw outlines if enabled
    if (outlineLevels >= 1 && effectTube.length > 1) {
      stroke(255);
      strokeWeight(2);
      noFill();
      
      for (let level = 1; level <= outlineLevels; level++) {
        let outlineOffset = basePixelSize * 1.5 + (level * outlineSpacing);
        
        let leftOutline = [];
        let rightOutline = [];
        
        for (let i = 0; i < effectTube.length; i++) {
          let p = effectTube[i];
          let offsetX = outlineOffset;
          let offsetY = 0;
          
          let dx = 0, dy = 0;
          
          if (i < effectTube.length - 1) {
            let next = effectTube[i + 1];
            dx += next.x - p.x;
            dy += next.y - p.y;
          }
          if (i > 0) {
            let prev = effectTube[i - 1];
            dx += p.x - prev.x;
            dy += p.y - prev.y;
          }
          
          let len = sqrt(dx * dx + dy * dy);
          if (len > 0.01) {
            offsetX = -dy / len * outlineOffset;
            offsetY = dx / len * outlineOffset;
          }
          
          let wave = waveAnimationEnabled ? map(sin(i * 0.3 - frameCount * 0.1), -1, 1, 0.7, 1.3) : 1.0;
          let waveOffsetX = offsetX * wave;
          let waveOffsetY = offsetY * wave;
          
          leftOutline.push(createVector(p.x - waveOffsetX, p.y - waveOffsetY, p.z));
          rightOutline.push(createVector(p.x + waveOffsetX, p.y + waveOffsetY, p.z));
        }
        
        // Apply smoothing to outline points if smoothness > 0
        if (outlineSmoothness > 0) {
          let smoothingPasses = floor(map(outlineSmoothness, 0, 100, 0, 4)); // Even more passes for stronger effect
          for (let pass = 0; pass < smoothingPasses; pass++) {
            leftOutline = smoothOutlinePoints(leftOutline);
            rightOutline = smoothOutlinePoints(rightOutline);
          }
        }
        
        beginShape();
        if (outlineSmoothness > 0 && leftOutline.length > 2) {
          // Use curve vertices for smooth corners
          curveVertex(leftOutline[0].x, leftOutline[0].y, leftOutline[0].z);
          for (let p of leftOutline) {
            curveVertex(p.x, p.y, p.z);
          }
          let last = leftOutline[leftOutline.length - 1];
          curveVertex(last.x, last.y, last.z);
        } else {
          // Sharp corners
          for (let p of leftOutline) {
            vertex(p.x, p.y, p.z);
          }
        }
        endShape();
        
        beginShape();
        if (outlineSmoothness > 0 && rightOutline.length > 2) {
          // Use curve vertices for smooth corners
          curveVertex(rightOutline[0].x, rightOutline[0].y, rightOutline[0].z);
          for (let p of rightOutline) {
            curveVertex(p.x, p.y, p.z);
          }
          let last = rightOutline[rightOutline.length - 1];
          curveVertex(last.x, last.y, last.z);
        } else {
          for (let p of rightOutline) {
            vertex(p.x, p.y, p.z);
          }
        }
        endShape();
        
        if (leftOutline.length > 0 && rightOutline.length > 0) {
          beginShape();
          vertex(leftOutline[0].x, leftOutline[0].y, leftOutline[0].z);
          vertex(rightOutline[0].x, rightOutline[0].y, rightOutline[0].z);
          endShape();
          
          let lastIdx = leftOutline.length - 1;
          beginShape();
          vertex(leftOutline[lastIdx].x, leftOutline[lastIdx].y, leftOutline[lastIdx].z);
          vertex(rightOutline[lastIdx].x, rightOutline[lastIdx].y, rightOutline[lastIdx].z);
          endShape();
        }
      }
    }
  } else if (type === "smooth-outline") {
    // Smooth outline mode - organic worm-like outline with smooth curves
    if (effectTube.length < 2) return;
    
    stroke(255, 255);
    strokeWeight(2);
    noFill();
    
    // Draw multiple outline levels (like ripples in water)
    for (let level = 0; level < outlineLevels; level++) {
      let outlineOffset = basePixelSize * 1.5 + (level * outlineSpacing);
      
      // Smooth the path first using averaging
      let smoothedTube = [];
      let smoothWindow = 5;
      
      for (let i = 0; i < effectTube.length; i++) {
        let sum = createVector(0, 0, 0);
        let count = 0;
        
        for (let j = -smoothWindow; j <= smoothWindow; j++) {
          let idx = constrain(i + j, 0, effectTube.length - 1);
          sum.add(effectTube[idx]);
          count++;
        }
        
        smoothedTube.push(p5.Vector.div(sum, count));
      }
      
      let leftOutline = [];
      let rightOutline = [];
      
      for (let i = 0; i < smoothedTube.length; i++) {
        let p = smoothedTube[i];
        let offsetX = outlineOffset;
        let offsetY = 0;
        
        let dx = 0, dy = 0;
        
        if (i < smoothedTube.length - 1) {
          let next = smoothedTube[i + 1];
          dx += next.x - p.x;
          dy += next.y - p.y;
        }
        if (i > 0) {
          let prev = smoothedTube[i - 1];
          dx += p.x - prev.x;
          dy += p.y - prev.y;
        }
        
        let len = sqrt(dx * dx + dy * dy);
        if (len > 0.01) {
          offsetX = -dy / len * outlineOffset;
          offsetY = dx / len * outlineOffset;
        }
        
        // Smooth organic variation with wave animation
        let organic = map(sin(i * 0.15) * cos(i * 0.08), -1, 1, 0.85, 1.15);
        let pixelWave = waveAnimationEnabled ? 
          map(sin(i * 0.3 - frameCount * 0.1), -1, 1, 0.7, 1.3 + waveAmpAndBlurRadius / (basePixelSize * 10)) : 
          1.0;
        let combinedEffect = organic * pixelWave;
        let organicOffsetX = offsetX * combinedEffect;
        let organicOffsetY = offsetY * combinedEffect;
      
        leftOutline.push(createVector(p.x - organicOffsetX, p.y - organicOffsetY, p.z));
        rightOutline.push(createVector(p.x + organicOffsetX, p.y + organicOffsetY, p.z));
      }
      
      // Draw smooth curves using curveVertex
      beginShape();
      curveVertex(leftOutline[0].x, leftOutline[0].y, leftOutline[0].z);
      for (let p of leftOutline) {
        curveVertex(p.x, p.y, p.z);
      }
      let lastIdx = leftOutline.length - 1;
      curveVertex(leftOutline[lastIdx].x, leftOutline[lastIdx].y, leftOutline[lastIdx].z);
      endShape();
      
      beginShape();
      curveVertex(rightOutline[0].x, rightOutline[0].y, rightOutline[0].z);
      for (let p of rightOutline) {
        curveVertex(p.x, p.y, p.z);
      }
      curveVertex(rightOutline[lastIdx].x, rightOutline[lastIdx].y, rightOutline[lastIdx].z);
      endShape();
      
      // Close the outline at start and end
      if (leftOutline.length > 0 && rightOutline.length > 0) {
        beginShape();
        vertex(leftOutline[0].x, leftOutline[0].y, leftOutline[0].z);
        vertex(rightOutline[0].x, rightOutline[0].y, rightOutline[0].z);
        endShape();
        
        beginShape();
        vertex(leftOutline[lastIdx].x, leftOutline[lastIdx].y, leftOutline[lastIdx].z);
        vertex(rightOutline[lastIdx].x, rightOutline[lastIdx].y, rightOutline[lastIdx].z);
        endShape();
      }
    } // End of level loop
  } else if (type === "outline") {
    // Smooth outline mode - organic worm-like outline with smooth curves
    if (tube.length < 2) return;
    
    stroke(255, 255);
    strokeWeight(2);
    noFill();
    
    let outlineOffset = basePixelSize * 1.5;
    
    // Smooth the path first using averaging
    let smoothedTube = [];
    let smoothWindow = 5;
    
    for (let i = 0; i < tube.length; i++) {
      let sum = createVector(0, 0, 0);
      let count = 0;
      
      for (let j = -smoothWindow; j <= smoothWindow; j++) {
        let idx = constrain(i + j, 0, tube.length - 1);
        sum.add(tube[idx]);
        count++;
      }
      
      smoothedTube.push(p5.Vector.div(sum, count));
    }
    
    let leftOutline = [];
    let rightOutline = [];
    
    for (let i = 0; i < smoothedTube.length; i++) {
      let p = smoothedTube[i];
      let offsetX = outlineOffset;
      let offsetY = 0;
      
      let dx = 0, dy = 0;
      
      if (i < smoothedTube.length - 1) {
        let next = smoothedTube[i + 1];
        dx += next.x - p.x;
        dy += next.y - p.y;
      }
      if (i > 0) {
        let prev = smoothedTube[i - 1];
        dx += p.x - prev.x;
        dy += p.y - prev.y;
      }
      
      let len = sqrt(dx * dx + dy * dy);
      if (len > 0.01) {
        offsetX = -dy / len * outlineOffset;
        offsetY = dx / len * outlineOffset;
      }
      
      // Smooth organic variation instead of sharp wave
      let organic = map(sin(i * 0.15) * cos(i * 0.08), -1, 1, 0.85, 1.15);
      let organicOffsetX = offsetX * organic;
      let organicOffsetY = offsetY * organic;
      
      leftOutline.push(createVector(p.x - organicOffsetX, p.y - organicOffsetY, p.z));
      rightOutline.push(createVector(p.x + organicOffsetX, p.y + organicOffsetY, p.z));
    }
    
    // Draw smooth curves using curveVertex
    beginShape();
    curveVertex(leftOutline[0].x, leftOutline[0].y, leftOutline[0].z);
    for (let p of leftOutline) {
      curveVertex(p.x, p.y, p.z);
    }
    let lastIdx = leftOutline.length - 1;
    curveVertex(leftOutline[lastIdx].x, leftOutline[lastIdx].y, leftOutline[lastIdx].z);
    endShape();
    
    beginShape();
    curveVertex(rightOutline[0].x, rightOutline[0].y, rightOutline[0].z);
    for (let p of rightOutline) {
      curveVertex(p.x, p.y, p.z);
    }
    curveVertex(rightOutline[lastIdx].x, rightOutline[lastIdx].y, rightOutline[lastIdx].z);
    endShape();
    
    // Close the outline at start and end with rounded caps
    if (leftOutline.length > 0 && rightOutline.length > 0) {
      // Start cap - draw semicircle
      let startL = leftOutline[0];
      let startR = rightOutline[0];
      let startMid = createVector((startL.x + startR.x) / 2, (startL.y + startR.y) / 2, (startL.z + startR.z) / 2);
      let startRadius = dist(startL.x, startL.y, startL.z, startR.x, startR.y, startR.z) / 2;
      
      beginShape();
      for (let i = 0; i <= 10; i++) {
        let angle = PI + (i / 10) * PI;
        let dx = startR.x - startL.x;
        let dy = startR.y - startL.y;
        let len = sqrt(dx * dx + dy * dy);
        let perpX = -dy / len;
        let perpY = dx / len;
        vertex(
          startMid.x + cos(angle) * startRadius * (dx / len) + sin(angle) * startRadius * perpX,
          startMid.y + cos(angle) * startRadius * (dy / len) + sin(angle) * startRadius * perpY,
          startMid.z
        );
      }
      endShape();
      
      // End cap - draw semicircle
      let endL = leftOutline[lastIdx];
      let endR = rightOutline[lastIdx];
      let endMid = createVector((endL.x + endR.x) / 2, (endL.y + endR.y) / 2, (endL.z + endR.z) / 2);
      let endRadius = dist(endL.x, endL.y, endL.z, endR.x, endR.y, endR.z) / 2;
      
      beginShape();
      for (let i = 0; i <= 10; i++) {
        let angle = (i / 10) * PI;
        let dx = endR.x - endL.x;
        let dy = endR.y - endL.y;
        let len = sqrt(dx * dx + dy * dy);
        let perpX = -dy / len;
        let perpY = dx / len;
        vertex(
          endMid.x + cos(angle) * endRadius * (dx / len) + sin(angle) * endRadius * perpX,
          endMid.y + cos(angle) * endRadius * (dy / len) + sin(angle) * endRadius * perpY,
          endMid.z
        );
      }
      endShape();
    }
  } else if (type === "outline") {
    // Outline mode - draw two parallel lines around the stroke path
    if (effectTube.length < 2) return;
    
    stroke(255, 255);
    strokeWeight(2);
    noFill();
    
    // Draw multiple outline levels
    for (let level = 0; level < outlineLevels; level++) {
      let outlineOffset = basePixelSize * 1.5 + (level * outlineSpacing);
      
      let leftOutline = [];
      let rightOutline = [];
      
      for (let i = 0; i < effectTube.length; i++) {
        let p = effectTube[i];
        let offsetX = outlineOffset;
        let offsetY = 0;
        
        let dx = 0, dy = 0;
        
        if (i < effectTube.length - 1) {
          let next = effectTube[i + 1];
          dx += next.x - p.x;
        dy += next.y - p.y;
      }
      if (i > 0) {
        let prev = effectTube[i - 1];
        dx += p.x - prev.x;
        dy += p.y - prev.y;
      }
      
      let len = sqrt(dx * dx + dy * dy);
      if (len > 0.01) {
        offsetX = -dy / len * outlineOffset;
        offsetY = dx / len * outlineOffset;
      }
      
      let wave = waveAnimationEnabled ? map(sin(i * 0.3 - frameCount * 0.1), -1, 1, 0.7, 1.3) : 1.0;
      let waveOffsetX = offsetX * wave;
      let waveOffsetY = offsetY * wave;
      
      leftOutline.push(createVector(p.x - waveOffsetX, p.y - waveOffsetY, p.z));
      rightOutline.push(createVector(p.x + waveOffsetX, p.y + waveOffsetY, p.z));
    }
    
    // Draw left outline
    beginShape();
    for (let p of leftOutline) {
      vertex(p.x, p.y, p.z);
    }
    endShape();
    
    // Draw right outline
    beginShape();
    for (let p of rightOutline) {
      vertex(p.x, p.y, p.z);
    }
    endShape();
    
    // Close the outline at start and end
    if (leftOutline.length > 0 && rightOutline.length > 0) {
      // Start cap
      beginShape();
      vertex(leftOutline[0].x, leftOutline[0].y, leftOutline[0].z);
      vertex(rightOutline[0].x, rightOutline[0].y, rightOutline[0].z);
      endShape();
      
      // End cap
      let lastIdx = leftOutline.length - 1;
      beginShape();
      vertex(leftOutline[lastIdx].x, leftOutline[lastIdx].y, leftOutline[lastIdx].z);
      vertex(rightOutline[lastIdx].x, rightOutline[lastIdx].y, rightOutline[lastIdx].z);
      endShape();
    }
    } // End of level loop
  } else if (type === "pixel") {
    // Adaptive step - draw fewer points for better performance
    let step = max(1, floor(tube.length / 500));
    for (let i = 0; i < tube.length; i += step) {
      let pos = tube[i];
      let wave = map(sin(i * 0.3 - frameCount * 0.1), -1, 1, basePixelSize * 0.5, basePixelSize + waveAmpAndBlurRadius);
      push();
      translate(pos.x, pos.y, pos.z);
      sphere(wave * 0.5);
      pop();
    }
  } else {
    let step = max(1, floor(effectTube.length / 500));
    for (let i = 0; i < effectTube.length; i += step) {
      push();
      translate(effectTube[i].x, effectTube[i].y, effectTube[i].z);
      box(basePixelSize);
      pop();
    }
  }
}

function drawBlockTube(tube, type) {
  // Don't apply effect here anymore - it's applied before calling this function
  let effectTube = tube;
  
  if (effectTube.length === 0) return; // Skip if pixelate effect already drew
  
  let blurRadius = waveAmpAndBlurRadius * 2.5;
  
  // Skip more cubes if there are many for better performance
  let skipFactor = effectTube.length > 500 ? 3 : 2;

  if (type === "smooth-outline") {
    // Smooth outline mode - organic worm-like outline
    if (effectTube.length < 2) return;
    
    stroke(255, 255);
    strokeWeight(2);
    noFill();
    
    let outlineOffset = basePixelSize * 1.5;
    
    let smoothedTube = [];
    let smoothWindow = 5;
    
    for (let i = 0; i < effectTube.length; i++) {
      let sum = createVector(0, 0, 0);
      let count = 0;
      
      for (let j = -smoothWindow; j <= smoothWindow; j++) {
        let idx = constrain(i + j, 0, effectTube.length - 1);
        sum.add(effectTube[idx]);
        count++;
      }
      
      smoothedTube.push(p5.Vector.div(sum, count));
    }
    
    let leftOutline = [];
    let rightOutline = [];
    
    for (let i = 0; i < smoothedTube.length; i++) {
      let p = smoothedTube[i];
      let offsetX = outlineOffset;
      let offsetY = 0;
      
      let dx = 0, dy = 0;
      
      if (i < smoothedTube.length - 1) {
        let next = smoothedTube[i + 1];
        dx += next.x - p.x;
        dy += next.y - p.y;
      }
      if (i > 0) {
        let prev = smoothedTube[i - 1];
        dx += p.x - prev.x;
        dy += p.y - prev.y;
      }
      
      let len = sqrt(dx * dx + dy * dy);
      if (len > 0.01) {
        offsetX = -dy / len * outlineOffset;
        offsetY = dx / len * outlineOffset;
      }
      
      // Smooth organic variation with pixel wave effect for wabbling
      let organic = map(sin(i * 0.15) * cos(i * 0.08), -1, 1, 0.85, 1.15);
      let pixelWave = map(sin(i * 0.3 - frameCount * 0.1), -1, 1, 0.7, 1.3 + waveAmpAndBlurRadius / (basePixelSize * 10));
      let combinedEffect = organic * pixelWave;
      let organicOffsetX = offsetX * combinedEffect;
      let organicOffsetY = offsetY * combinedEffect;
      
      leftOutline.push(createVector(p.x - organicOffsetX, p.y - organicOffsetY, p.z));
      rightOutline.push(createVector(p.x + organicOffsetX, p.y + organicOffsetY, p.z));
    }
    
    beginShape();
    curveVertex(leftOutline[0].x, leftOutline[0].y, leftOutline[0].z);
    for (let p of leftOutline) {
      curveVertex(p.x, p.y, p.z);
    }
    let lastIdx = leftOutline.length - 1;
    curveVertex(leftOutline[lastIdx].x, leftOutline[lastIdx].y, leftOutline[lastIdx].z);
    endShape();
    
    beginShape();
    curveVertex(rightOutline[0].x, rightOutline[0].y, rightOutline[0].z);
    for (let p of rightOutline) {
      curveVertex(p.x, p.y, p.z);
    }
    curveVertex(rightOutline[lastIdx].x, rightOutline[lastIdx].y, rightOutline[lastIdx].z);
    endShape();
    
    if (leftOutline.length > 0 && rightOutline.length > 0) {
      // Start cap - draw semicircle
      let startL = leftOutline[0];
      let startR = rightOutline[0];
      let startMid = createVector((startL.x + startR.x) / 2, (startL.y + startR.y) / 2, (startL.z + startR.z) / 2);
      let startRadius = dist(startL.x, startL.y, startL.z, startR.x, startR.y, startR.z) / 2;
      
      beginShape();
      for (let i = 0; i <= 10; i++) {
        let angle = PI + (i / 10) * PI;
        let dx = startR.x - startL.x;
        let dy = startR.y - startL.y;
        let len = sqrt(dx * dx + dy * dy);
        let perpX = -dy / len;
        let perpY = dx / len;
        vertex(
          startMid.x + cos(angle) * startRadius * (dx / len) + sin(angle) * startRadius * perpX,
          startMid.y + cos(angle) * startRadius * (dy / len) + sin(angle) * startRadius * perpY,
          startMid.z
        );
      }
      endShape();
      
      // End cap - draw semicircle
      let endL = leftOutline[lastIdx];
      let endR = rightOutline[lastIdx];
      let endMid = createVector((endL.x + endR.x) / 2, (endL.y + endR.y) / 2, (endL.z + endR.z) / 2);
      let endRadius = dist(endL.x, endL.y, endL.z, endR.x, endR.y, endR.z) / 2;
      
      beginShape();
      for (let i = 0; i <= 10; i++) {
        let angle = (i / 10) * PI;
        let dx = endR.x - endL.x;
        let dy = endR.y - endL.y;
        let len = sqrt(dx * dx + dy * dy);
        let perpX = -dy / len;
        let perpY = dx / len;
        vertex(
          endMid.x + cos(angle) * endRadius * (dx / len) + sin(angle) * endRadius * perpX,
          endMid.y + cos(angle) * endRadius * (dy / len) + sin(angle) * endRadius * perpY,
          endMid.z
        );
      }
      endShape();
    }
  } else if (type === "outline") {
    // Outline mode - draw two parallel lines around the stroke path (like outlining the pixel brush)
    if (effectTube.length < 2) return;
    
    stroke(255, 255);
    noFill();
    
    // Draw multiple outline levels
    for (let level = 0; level < outlineLevels; level++) {
      let outlineOffset = basePixelSize * 1.5 + (level * outlineSpacing); // Distance from center path
    
    // Draw left and right outlines as line segments with varying thickness
    for (let i = 0; i < effectTube.length - 1; i++) {
      let p = effectTube[i];
      let nextP = effectTube[i + 1];
      
      // Calculate perpendicular direction
      let dx = nextP.x - p.x;
      let dy = nextP.y - p.y;
      
      let len = sqrt(dx * dx + dy * dy);
      if (len < 0.01) continue;
      
      // Perpendicular vector (rotate 90 degrees)
      let offsetX = -dy / len * outlineOffset;
      let offsetY = dx / len * outlineOffset;
      
      // Apply wave effect to offset distance AND stroke weight
      let wave = waveAnimationEnabled ? 
        map(sin(i * 0.3 - frameCount * 0.1), -1, 1, 0.3, 1.5 + (waveAmpAndBlurRadius / (basePixelSize * 5))) : 1.0;
      let waveOffsetX = offsetX * wave;
      let waveOffsetY = offsetY * wave;
      
      // Set varying stroke weight
      let weight = waveAnimationEnabled ? 
        map(sin(i * 0.3 - frameCount * 0.1), -1, 1, 1, 3 + (waveAmpAndBlurRadius / 10)) : 2;
      strokeWeight(weight);
      
      // Draw left outline segment
      let leftP1 = createVector(p.x - waveOffsetX, p.y - waveOffsetY, p.z);
      let leftP2 = createVector(nextP.x - waveOffsetX, nextP.y - waveOffsetY, nextP.z);
      line(leftP1.x, leftP1.y, leftP1.z, leftP2.x, leftP2.y, leftP2.z);
      
      // Draw right outline segment
      let rightP1 = createVector(p.x + waveOffsetX, p.y + waveOffsetY, p.z);
      let rightP2 = createVector(nextP.x + waveOffsetX, nextP.y + waveOffsetY, nextP.z);
      line(rightP1.x, rightP1.y, rightP1.z, rightP2.x, rightP2.y, rightP2.z);
    }
    
    // Close the outline at start and end
    if (leftOutline.length > 0 && rightOutline.length > 0) {
      // Start cap
      beginShape();
      vertex(leftOutline[0].x, leftOutline[0].y, leftOutline[0].z);
      vertex(rightOutline[0].x, rightOutline[0].y, rightOutline[0].z);
      endShape();
      
      // End cap
      let lastIdx = leftOutline.length - 1;
      beginShape();
      vertex(leftOutline[lastIdx].x, leftOutline[lastIdx].y, leftOutline[lastIdx].z);
      vertex(rightOutline[lastIdx].x, rightOutline[lastIdx].y, rightOutline[lastIdx].z);
      endShape();
    }
    } // End of level loop
  } else if (type === "point") {
    for (let i = 0; i < effectTube.length; i += skipFactor) {
      let pos = effectTube[i].copy();
      let pullForce = createVector(0, 0, 0);
      let nearbyCount = 0;
      let totalInfluence = 0;
      
      let checkRange = min(20, effectTube.length);
      for (let j = max(0, i - checkRange); j < min(effectTube.length, i + checkRange); j++) {
        if (abs(i - j) > 2) {
          let other = effectTube[j];
          let d = dist(pos.x, pos.y, pos.z, other.x, other.y, other.z);
          
          if (d < blurRadius && d > 0) {
            let direction = p5.Vector.sub(other, pos).normalize();
            let easedInfluence = pow(1 - d / blurRadius, 3);
            direction.mult(easedInfluence * 12);
            pullForce.add(direction);
            totalInfluence += easedInfluence;
            if (d < blurRadius * 0.5) nearbyCount++;
          }
        }
      }
      
      if (totalInfluence > 0) pullForce.mult(0.3);
      pos.add(pullForce);
      
      // Add wave animation
      let waveSize = waveAnimationEnabled ? 
        map(sin(i * 0.3 - frameCount * 0.1), -1, 1, 0, waveAmpAndBlurRadius * 0.5) : 
        waveAmpAndBlurRadius * 0.25;
      let mergeSize = basePixelSize * (1 + nearbyCount * 0.4) + waveSize;
      drawMiniTextCube(pos.x, pos.y, pos.z, mergeSize);
    }
    
    // Draw outlines if enabled
    if (outlineLevels >= 1 && effectTube.length > 1) {
      stroke(255);
      strokeWeight(2);
      noFill();
      
      for (let level = 1; level <= outlineLevels; level++) {
        let outlineOffset = basePixelSize * 2 + (level * outlineSpacing);
        
        let leftOutline = [];
        let rightOutline = [];
        
        for (let i = 0; i < effectTube.length; i++) {
          let p = effectTube[i];
          let offsetX = outlineOffset;
          let offsetY = 0;
          
          let dx = 0, dy = 0;
          
          if (i < effectTube.length - 1) {
            let next = effectTube[i + 1];
            dx += next.x - p.x;
            dx += next.x - p.x;
            dy += next.y - p.y;
          }
          if (i > 0) {
            let prev = effectTube[i - 1];
            dx += p.x - prev.x;
            dy += p.y - prev.y;
          }
          
          let len = sqrt(dx * dx + dy * dy);
          if (len > 0.01) {
            offsetX = -dy / len * outlineOffset;
            offsetY = dx / len * outlineOffset;
          }
          
          leftOutline.push(createVector(p.x - offsetX, p.y - offsetY, p.z));
          rightOutline.push(createVector(p.x + offsetX, p.y + offsetY, p.z));
        }
        
        // Apply smoothing
        if (outlineSmoothness > 0) {
          let smoothingPasses = floor(map(outlineSmoothness, 0, 100, 0, 4));
          for (let pass = 0; pass < smoothingPasses; pass++) {
            leftOutline = smoothOutlinePoints(leftOutline);
            rightOutline = smoothOutlinePoints(rightOutline);
          }
        }
        
        beginShape();
        if (outlineSmoothness > 0 && leftOutline.length > 2) {
          curveVertex(leftOutline[0].x, leftOutline[0].y, leftOutline[0].z);
          for (let p of leftOutline) {
            curveVertex(p.x, p.y, p.z);
          }
          let last = leftOutline[leftOutline.length - 1];
          curveVertex(last.x, last.y, last.z);
        } else {
          for (let p of leftOutline) {
            vertex(p.x, p.y, p.z);
          }
        }
        endShape();
        
        beginShape();
        if (outlineSmoothness > 0 && rightOutline.length > 2) {
          curveVertex(rightOutline[0].x, rightOutline[0].y, rightOutline[0].z);
          for (let p of rightOutline) {
            curveVertex(p.x, p.y, p.z);
          }
          let last = rightOutline[rightOutline.length - 1];
          curveVertex(last.x, last.y, last.z);
        } else {
          for (let p of rightOutline) {
            vertex(p.x, p.y, p.z);
          }
        }
        endShape();
      }
    }
  } else if (type === "stroke") {
    let positions = [];
    let sizes = [];
    
    // Sample fewer points for better performance
    let step = max(1, floor(effectTube.length / 200));
    
    for (let i = 0; i < effectTube.length; i += step) {
      let pos = effectTube[i].copy();
      let pullForce = createVector(0, 0, 0);
      let nearbyCount = 0;
      let totalInfluence = 0;
      
      let checkRange = min(20, effectTube.length);
      for (let j = max(0, i - checkRange); j < min(effectTube.length, i + checkRange); j++) {
        if (abs(i - j) > 2) {
          let other = effectTube[j];
          let d = dist(pos.x, pos.y, pos.z, other.x, other.y, other.z);
          
          if (d < blurRadius && d > 0) {
            let direction = p5.Vector.sub(other, pos).normalize();
            let easedInfluence = pow(1 - d / blurRadius, 3);
            direction.mult(easedInfluence * 12);
            pullForce.add(direction);
            totalInfluence += easedInfluence;
            if (d < blurRadius * 0.5) nearbyCount++;
          }
        }
      }
      
      if (totalInfluence > 0) pullForce.mult(0.3);
      pos.add(pullForce);
      
      // Add wave animation
      let waveSize = waveAnimationEnabled ? 
        map(sin(i * 0.3 - frameCount * 0.1), -1, 1, 0, waveAmpAndBlurRadius * 0.5) : 
        waveAmpAndBlurRadius * 0.25;
      let mergeSize = basePixelSize * (1 + nearbyCount * 0.4) + waveSize;
      
      positions.push(pos);
      sizes.push(mergeSize);
    }
    
    for (let i = 0; i < positions.length; i++) {
      drawMiniTextCube(positions[i].x, positions[i].y, positions[i].z, sizes[i]);
      
      if (i < positions.length - 1) {
        let current = positions[i];
        let next = positions[i + 1];
        let d = dist(current.x, current.y, current.z, next.x, next.y, next.z);
        let steps = ceil(d / (basePixelSize * 1.2));
        
        for (let s = 1; s < steps; s++) {
          let t = s / steps;
          drawMiniTextCube(
            lerp(current.x, next.x, t),
            lerp(current.y, next.y, t),
            lerp(current.z, next.z, t),
            lerp(sizes[i], sizes[i + 1], t)
          );
        }
      }
    }
    
    // Draw outlines if enabled
    if (outlineLevels >= 1 && positions.length > 1) {
      stroke(255);
      strokeWeight(2);
      noFill();
      
      for (let level = 1; level <= outlineLevels; level++) {
        let outlineOffset = basePixelSize * 2 + (level * outlineSpacing);
        
        let leftOutline = [];
        let rightOutline = [];
        
        for (let i = 0; i < positions.length; i++) {
          let p = positions[i];
          let offsetX = outlineOffset;
          let offsetY = 0;
          
          let dx = 0, dy = 0;
          
          if (i < positions.length - 1) {
            let next = positions[i + 1];
            dx += next.x - p.x;
            dy += next.y - p.y;
          }
          if (i > 0) {
            let prev = positions[i - 1];
            dx += p.x - prev.x;
            dy += p.y - prev.y;
          }
          
          let len = sqrt(dx * dx + dy * dy);
          if (len > 0.01) {
            offsetX = -dy / len * outlineOffset;
            offsetY = dx / len * outlineOffset;
          }
          
          leftOutline.push(createVector(p.x - offsetX, p.y - offsetY, p.z));
          rightOutline.push(createVector(p.x + offsetX, p.y + offsetY, p.z));
        }
        
        // Apply smoothing to outline points if smoothness > 0
        if (outlineSmoothness > 0) {
          let smoothingPasses = floor(map(outlineSmoothness, 0, 100, 0, 4)); // Even more passes for stronger effect
          for (let pass = 0; pass < smoothingPasses; pass++) {
            leftOutline = smoothOutlinePoints(leftOutline);
            rightOutline = smoothOutlinePoints(rightOutline);
          }
        }
        
        beginShape();
        if (outlineSmoothness > 0 && leftOutline.length > 2) {
          // Use curve vertices for smooth corners
          curveVertex(leftOutline[0].x, leftOutline[0].y, leftOutline[0].z);
          for (let p of leftOutline) {
            curveVertex(p.x, p.y, p.z);
          }
          let last = leftOutline[leftOutline.length - 1];
          curveVertex(last.x, last.y, last.z);
        } else {
          // Sharp corners
          for (let p of leftOutline) {
            vertex(p.x, p.y, p.z);
          }
        }
        endShape();
        
        beginShape();
        if (outlineSmoothness > 0 && rightOutline.length > 2) {
          // Use curve vertices for smooth corners
          curveVertex(rightOutline[0].x, rightOutline[0].y, rightOutline[0].z);
          for (let p of rightOutline) {
            curveVertex(p.x, p.y, p.z);
          }
          let last = rightOutline[rightOutline.length - 1];
          curveVertex(last.x, last.y, last.z);
        } else {
          for (let p of rightOutline) {
            vertex(p.x, p.y, p.z);
          }
        }
        endShape();
      }
    }
  } else if (type === "pixel") {
    // Pixel mode - adaptive skip for better performance
    let skipFactor = effectTube.length > 500 ? 3 : 2;
    for (let i = 0; i < effectTube.length; i += skipFactor) {
      let pos = effectTube[i];
      let wave = map(sin(i * 0.3 - frameCount * 0.1), -1, 1, basePixelSize * 0.7, basePixelSize * 1.3 + waveAmpAndBlurRadius);
      drawMiniTextCube(pos.x, pos.y, pos.z, wave);
    }
    
    // Draw outlines if enabled
    if (outlineLevels >= 1 && effectTube.length > 1) {
      stroke(255);
      strokeWeight(2);
      noFill();
      
      for (let level = 1; level <= outlineLevels; level++) {
        let outlineOffset = basePixelSize * 1.5 + (level * outlineSpacing);
        
        let leftOutline = [];
        let rightOutline = [];
        
        for (let i = 0; i < effectTube.length; i++) {
          let p = effectTube[i];
          let offsetX = outlineOffset;
          let offsetY = 0;
          
          let dx = 0, dy = 0;
          
          if (i < effectTube.length - 1) {
            let next = effectTube[i + 1];
            dx += next.x - p.x;
            dy += next.y - p.y;
          }
          if (i > 0) {
            let prev = effectTube[i - 1];
            dx += p.x - prev.x;
            dy += p.y - prev.y;
          }
          
          let len = sqrt(dx * dx + dy * dy);
          if (len > 0.01) {
            offsetX = -dy / len * outlineOffset;
            offsetY = dx / len * outlineOffset;
          }
          
          let wave = waveAnimationEnabled ? map(sin(i * 0.3 - frameCount * 0.1), -1, 1, 0.7, 1.3) : 1.0;
          let waveOffsetX = offsetX * wave;
          let waveOffsetY = offsetY * wave;
          
          leftOutline.push(createVector(p.x - waveOffsetX, p.y - waveOffsetY, p.z));
          rightOutline.push(createVector(p.x + waveOffsetX, p.y + waveOffsetY, p.z));
        }
        
        // Apply smoothing to outline points if smoothness > 0
        if (outlineSmoothness > 0) {
          let smoothingPasses = floor(map(outlineSmoothness, 0, 100, 0, 4)); // Even more passes for stronger effect
          for (let pass = 0; pass < smoothingPasses; pass++) {
            leftOutline = smoothOutlinePoints(leftOutline);
            rightOutline = smoothOutlinePoints(rightOutline);
          }
        }
        
        beginShape();
        if (outlineSmoothness > 0 && leftOutline.length > 2) {
          // Use curve vertices for smooth corners
          curveVertex(leftOutline[0].x, leftOutline[0].y, leftOutline[0].z);
          for (let p of leftOutline) {
            curveVertex(p.x, p.y, p.z);
          }
          let last = leftOutline[leftOutline.length - 1];
          curveVertex(last.x, last.y, last.z);
        } else {
          // Sharp corners
          for (let p of leftOutline) {
            vertex(p.x, p.y, p.z);
          }
        }
        endShape();
        
        beginShape();
        if (outlineSmoothness > 0 && rightOutline.length > 2) {
          // Use curve vertices for smooth corners
          curveVertex(rightOutline[0].x, rightOutline[0].y, rightOutline[0].z);
          for (let p of rightOutline) {
            curveVertex(p.x, p.y, p.z);
          }
          let last = rightOutline[rightOutline.length - 1];
          curveVertex(last.x, last.y, last.z);
        } else {
          for (let p of rightOutline) {
            vertex(p.x, p.y, p.z);
          }
        }
        endShape();
        
        if (leftOutline.length > 0 && rightOutline.length > 0) {
          beginShape();
          vertex(leftOutline[0].x, leftOutline[0].y, leftOutline[0].z);
          vertex(rightOutline[0].x, rightOutline[0].y, rightOutline[0].z);
          endShape();
          
          let lastIdx = leftOutline.length - 1;
          beginShape();
          vertex(leftOutline[lastIdx].x, leftOutline[lastIdx].y, leftOutline[lastIdx].z);
          vertex(rightOutline[lastIdx].x, rightOutline[lastIdx].y, rightOutline[lastIdx].z);
          endShape();
        }
      }
    }
  }
}

// ===== EVENT HANDLERS =====

function mouseReleased() {
  // Get panel element to check if mouse is over it
  let panel = document.getElementById('cubeConfigPanel');
  let panelRect = panel.getBoundingClientRect();
  
  // Only finish tube if in freehand mode and NOT over the panel
  if (isDrawing && drawingMethod === "freehand" && currentTube.length > 1 && mouseX < panelRect.left) {
    // Copy tube and preserve tubeId
    let finishedTube = [...currentTube];
    finishedTube.tubeId = tubeIdCounter++;
    tubes.push(finishedTube);
    currentTube = [];
    
    // Open preview window on first stroke
    if (!hasDrawnOnce) {
      hasDrawnOnce = true;
      let previewWindow = document.getElementById('previewWindow');
      if (previewWindow && previewWindow.classList.contains('minimized')) {
        previewWindow.classList.remove('minimized');
        document.getElementById('previewToggle').textContent = '▼';
      }
    }
    
    // Save to history
    saveToHistory();
    
    // Update preview
    updatePreview();
  } else if (isDrawing && drawingMethod === "freehand") {
    currentTube = [];
  }
}

function keyPressed() {
  // Check if user is typing in an input field
  let activeElement = document.activeElement;
  if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA' || activeElement.tagName === 'SELECT')) {
    // User is in an input field - don't intercept
    return true;
  }
  
  if (key === ' ') {
    // Hide welcome text on first space press
    let welcomeText = document.getElementById('welcomeText');
    if (welcomeText && welcomeText.classList.contains('show')) {
      welcomeText.classList.remove('show');
    }
    
    // Hide Clippy intro and move to corner on first space press
    let clippelieWindow = document.getElementById('clippelieWindow');
    let tipWindow = document.getElementById('tipWindow');
    let tipClose = document.getElementById('tipClose');
    
    if (clippelieWindow && clippelieWindow.classList.contains('intro')) {
      // Hide tip window immediately - no transition
      tipWindow.style.display = 'none';
      tipWindow.classList.remove('intro');
      tipWindow.classList.remove('visible');
      
      // Fade out Clippy in center, then move to corner
      clippelieWindow.style.opacity = '0';
      clippelieWindow.style.transition = 'opacity 0.4s ease';
      
      setTimeout(() => {
        // Remove intro class (moves to corner position)
        clippelieWindow.classList.remove('intro');
        // Fade back in at corner
        clippelieWindow.style.opacity = '1';
        clippelieWindow.style.transition = 'opacity 0.3s ease';
        
        setTimeout(() => {
          clippelieWindow.style.opacity = '';
          clippelieWindow.style.transition = '';
          
          // Show close button for future tips
          if (tipClose) tipClose.style.display = 'flex';
        }, 300);
      }, 400);
    }
    
    
    // Mark as started on first space press
    if (!hasStarted) {
      hasStarted = true;
      // Enable all canvas controls
      enableCanvasControls();
      
      // Open Brush Settings section
      let brushHeader = document.getElementById('brushHeader');
      let brushSection = document.getElementById('brushSection');
      if (brushHeader && brushSection) {
        brushHeader.classList.remove('collapsed');
        brushSection.style.display = 'block';
      }
      
      // Schedule tips immediately
      if (typeof scheduleLaterTips === 'function') {
        scheduleLaterTips();
      }
    }
    
    // Don't toggle drawing mode if paused
    if (animationPaused) {
      return false;
    }
    
    isDrawing = !isDrawing;
    
    // Update interaction mode to match drawing state
    interactionMode = isDrawing ? "draw" : "rotate";
    updateCursor();
    
    if (isDrawing) {
      voxelRotX = 0;
      voxelRotY = 0;
      
      // Initialize for arrow mode
      if (drawingMethod === "arrow") {
        arrowPos = createVector(0, 0, 0);
        
        // If grid is active, snap initial position to grid
        if (showGrid) {
          let gridPos = worldToGrid(0, 0, 0);
          let halfX = (gridDimensions.x * gridSize) / 2;
          let halfY = (gridDimensions.y * gridSize) / 2;
          let halfZ = (gridDimensions.z * gridSize) / 2;
          
          arrowPos.x = gridPos.x * gridSize - halfX + gridSize / 2;
          arrowPos.y = gridPos.y * gridSize - halfY + gridSize / 2;
          arrowPos.z = gridPos.z * gridSize - halfZ + gridSize / 2;
          
          fillCellAtPosition(arrowPos.x, arrowPos.y, arrowPos.z);
        }
        
        currentTube = [arrowPos.copy()];
        arrowDirection = null;
      } else {
        // Initialize for freehand mode
        currentTube = [];
      }
    } else {
      // Save current line when turning off drawing
      if (currentTube.length > 1) {
        tubes.push([...currentTube]);
        currentTube = [];
        
        // Add tendrils at intersections if effect is enabled
        if (brushEffect === "tendrils") {
          addTendrilsToTubes();
        }
        
        // Update preview
        updatePreview();
      }
      
      // Save to history
      saveToHistory();
      
      arrowDirection = null;
    }
    return false; // Prevent default space bar behavior (scrolling)
  }

  if (key === 'c' || key === 'C') {
    tubes = [];
    currentTube = [];
    filledCells.clear(); // Clear grid cells
    voxelRotX = 0;
    voxelRotY = 0;
    showCubeMode = false;
    select("#combineButton").html("🎲 Kombiniere Zeichnung mit Würfeln");
    background(0);
  }
  
  // Arrow key controls - only in arrow drawing mode
  if (isDrawing && drawingMethod === "arrow") {
    // Use grid size as step size when grid is active, otherwise use arrowSpeed
    let stepSize = showGrid ? gridSize : arrowSpeed;
    
    if (keyCode === LEFT_ARROW) {
      arrowDirection = createVector(-stepSize, 0, 0);
      return false; // Prevent default arrow key behavior
    } else if (keyCode === RIGHT_ARROW) {
      arrowDirection = createVector(stepSize, 0, 0);
      return false;
    } else if (keyCode === UP_ARROW) {
      arrowDirection = createVector(0, -stepSize, 0);
      return false;
    } else if (keyCode === DOWN_ARROW) {
      arrowDirection = createVector(0, stepSize, 0);
      return false;
    } else if (key === 'w' || key === 'W') {
      arrowDirection = createVector(0, 0, -stepSize);
    } else if (key === 'q' || key === 'Q') {
      arrowDirection = createVector(0, 0, stepSize);
    }
  }
}

function keyReleased() {
  // Stop arrow movement when key is released
  if (isDrawing && drawingMethod === "arrow") {
    if (keyCode === LEFT_ARROW || keyCode === RIGHT_ARROW || 
        keyCode === UP_ARROW || keyCode === DOWN_ARROW ||
        key === 'w' || key === 'W' || key === 'q' || key === 'Q') {
      arrowDirection = null;
    }
  }
}

function windowResized() {
  let container = document.getElementById('canvasContainer');
  let w = container.offsetWidth;
  let h = container.offsetHeight;
  resizeCanvas(w, h);
}

// Send data to preview window
function updatePreview() {
  let previewFrame = document.getElementById('previewFrame');
  if (previewFrame && previewFrame.contentWindow) {
    // Convert p5.Vector objects to plain objects for postMessage
    let serializedTubes = tubes.map(tube => 
      tube.map(v => ({x: v.x, y: v.y, z: v.z}))
    );
    
    previewFrame.contentWindow.postMessage({
      tubes: serializedTubes,
      brushType: brushType,
      basePixelSize: basePixelSize
    }, '*');
  }
}

// Continuous preview update (called every frame)
function renderPreview() {
  let previewFrame = document.getElementById('previewFrame');
  if (previewFrame && previewFrame.contentWindow) {
    let serializedTubes, serializedCurrentTube;
    
    // If grid is active, send world coordinates of filled cells
    if (showGrid) {
      // Convert filled cells world coords to array
      let cellsArray = Array.from(filledCells).map(cellKey => {
        let [x, y, z] = cellKey.split(',').map(Number);
        return { x, y, z };
      });
      
      // Send world coordinates and current grid size
      previewFrame.contentWindow.postMessage({
        gridCellsWorld: cellsArray,
        gridSize: gridSize,
        isGridMode: true,
        basePixelSize: gridSize
      }, '*');
      return;
    }
    
    // Normal mode: Convert p5.Vector objects to plain objects
    serializedTubes = tubes.map(tube => 
      tube.map(v => ({x: v.x, y: v.y, z: v.z}))
    );
    
    // Always send currentTube if it exists (for arrow key drawing)
    serializedCurrentTube = currentTube.length > 0 ? currentTube.map(v => ({x: v.x, y: v.y, z: v.z})) : [];
    
    // Send all current settings to preview
    previewFrame.contentWindow.postMessage({
      tubes: serializedTubes,
      currentTube: serializedCurrentTube,
      isDrawing: isDrawing,
      brushType: brushType,
      basePixelSize: basePixelSize,
      waveAnimationEnabled: waveAnimationEnabled,
      waveAmpAndBlurRadius: waveAmpAndBlurRadius,
      isGridMode: false
    }, '*');
  }
}

// Export PNG with specific angle
function exportPNG(rotXDegrees, rotYDegrees) {
  // Save current rotation
  let savedRotX = voxelRotX;
  let savedRotY = voxelRotY;
  
  // Set export rotation (convert degrees to radians)
  voxelRotX = rotXDegrees * Math.PI / 180;
  voxelRotY = rotYDegrees * Math.PI / 180;
  
  // Redraw with export rotation
  redraw();
  
  // Save the canvas
  save('drawing_export.png');
  
  // Restore original rotation
  voxelRotX = savedRotX;
  voxelRotY = savedRotY;
}

// ===== UNDO/REDO FUNCTIONALITY =====

function saveToHistory() {
  // Remove any history after current index (if we undid and then drew new)
  tubesHistory = tubesHistory.slice(0, historyIndex + 1);
  
  // Deep copy tubes array and grid cells
  let tubeCopy = tubes.map(tube => tube.map(v => createVector(v.x, v.y, v.z)));
  let cellsCopy = new Set(filledCells);
  
  tubesHistory.push({
    tubes: tubeCopy,
    gridCells: cellsCopy
  });
  
  // Limit history size
  if (tubesHistory.length > maxHistorySize) {
    tubesHistory.shift();
  } else {
    historyIndex++;
  }
  
  updateHistoryButtons();
}

function undo() {
  if (historyIndex > 0) {
    historyIndex--;
    // Restore both tubes and grid cells from history
    let historyState = tubesHistory[historyIndex];
    tubes = historyState.tubes.map(tube => tube.map(v => createVector(v.x, v.y, v.z)));
    filledCells = new Set(historyState.gridCells);
    updateHistoryButtons();
    updatePreview();
  }
}

function redo() {
  if (historyIndex < tubesHistory.length - 1) {
    historyIndex++;
    // Restore both tubes and grid cells from history
    let historyState = tubesHistory[historyIndex];
    tubes = historyState.tubes.map(tube => tube.map(v => createVector(v.x, v.y, v.z)));
    filledCells = new Set(historyState.gridCells);
    updateHistoryButtons();
    updatePreview();
  }
}

function updateHistoryButtons() {
  let undoBtn = document.getElementById('undoBtn');
  let redoBtn = document.getElementById('redoBtn');
  
  if (undoBtn) {
    undoBtn.disabled = historyIndex <= 0;
  }
  
  if (redoBtn) {
    redoBtn.disabled = historyIndex >= tubesHistory.length - 1;
  }
}

// Smooth outline points by averaging neighbors
function smoothOutlinePoints(points) {
  if (points.length < 3) return points;
  
  let smoothed = [];
  for (let i = 0; i < points.length; i++) {
    if (i === 0 || i === points.length - 1) {
      // Keep first and last points unchanged
      smoothed.push(points[i].copy());
    } else {
      // Stronger average with neighbors for more smoothing
      let prev = points[i - 1];
      let curr = points[i];
      let next = points[i + 1];
      
      // More weight on neighbors for stronger smoothing
      let smoothX = (prev.x + curr.x + next.x) / 3;
      let smoothY = (prev.y + curr.y + next.y) / 3;
      let smoothZ = (prev.z + curr.z + next.z) / 3;
      
      smoothed.push(createVector(smoothX, smoothY, smoothZ));
    }
  }
  
  return smoothed;
}

// Smoothing function for Outline2 points (X/Y format instead of x/y)
function smoothOutlinePointsOutline2(points) {
  if (points.length < 3) return points;
  
  let smoothed = [];
  for (let i = 0; i < points.length; i++) {
    if (i === 0 || i === points.length - 1) {
      // Keep first and last points unchanged
      smoothed.push({ X: points[i].X, Y: points[i].Y, z: points[i].z });
    } else {
      // Stronger average with neighbors for more smoothing
      let prev = points[i - 1];
      let curr = points[i];
      let next = points[i + 1];
      
      // More weight on neighbors for stronger smoothing
      let smoothX = (prev.X + curr.X + next.X) / 3;
      let smoothY = (prev.Y + curr.Y + next.Y) / 3;
      let smoothZ = (prev.z + curr.z + next.z) / 3;
      
      smoothed.push({ X: smoothX, Y: smoothY, z: smoothZ });
    }
  }
  
  return smoothed;
}

// ===== VECTOR INK BRUSH (OUTLINE 2) =====

// Create offset curve from polyline
function createOffsetCurve(points, offset, side = 'left') {
  if (points.length < 2) return [];
  
  let offsetPoints = [];
  
  for (let i = 0; i < points.length; i++) {
    let p = points[i];
    let dx = 0, dy = 0;
    
    // Calculate tangent direction
    if (i < points.length - 1) {
      let next = points[i + 1];
      dx += next.x - p.x;
      dy += next.y - p.y;
    }
    if (i > 0) {
      let prev = points[i - 1];
      dx += p.x - prev.x;
      dy += p.y - prev.y;
    }
    
    // Perpendicular direction
    let len = sqrt(dx * dx + dy * dy);
    if (len > 0.01) {
      let perpX = -dy / len;
      let perpY = dx / len;
      
      // Flip for right side
      if (side === 'right') {
        perpX = -perpX;
        perpY = -perpY;
      }
      
      offsetPoints.push({
        X: round((p.x + perpX * offset) * 1000), // Scale for Clipper precision
        Y: round((p.y + perpY * offset) * 1000),
        z: p.z
      });
    }
  }
  
  return offsetPoints;
}

// Create closed polygon from stroke with round caps
function createStrokePolygon(points, strokeWidth) {
  if (points.length < 2) return [];
  
  let halfWidth = strokeWidth / 2;
  let leftCurve = createOffsetCurve(points, halfWidth, 'left');
  let rightCurve = createOffsetCurve(points, halfWidth, 'right');
  
  if (leftCurve.length === 0 || rightCurve.length === 0) return [];
  
  // Create closed polygon: left curve + round end cap + right curve (reversed) + round start cap
  let polygon = [...leftCurve];
  
  // Round end cap
  let endPoint = points[points.length - 1];
  let capSteps = 8;
  for (let i = 0; i <= capSteps; i++) {
    let angle = PI * i / capSteps;
    let lastLeft = leftCurve[leftCurve.length - 1];
    let lastRight = rightCurve[rightCurve.length - 1];
    
    let centerX = (lastLeft.X + lastRight.X) / 2;
    let centerY = (lastLeft.Y + lastRight.Y) / 2;
    
    let dx = lastLeft.X - centerX;
    let dy = lastLeft.Y - centerY;
    
    polygon.push({
      X: round(centerX + dx * cos(angle) - dy * sin(angle)),
      Y: round(centerY + dx * sin(angle) + dy * cos(angle)),
      z: endPoint.z
    });
  }
  
  // Right curve reversed
  for (let i = rightCurve.length - 1; i >= 0; i--) {
    polygon.push(rightCurve[i]);
  }
  
  // Round start cap
  let startPoint = points[0];
  for (let i = 0; i <= capSteps; i++) {
    let angle = PI + PI * i / capSteps;
    let firstLeft = leftCurve[0];
    let firstRight = rightCurve[0];
    
    let centerX = (firstLeft.X + firstRight.X) / 2;
    let centerY = (firstLeft.Y + firstRight.Y) / 2;
    
    let dx = firstLeft.X - centerX;
    let dy = firstLeft.Y - centerY;
    
    polygon.push({
      X: round(centerX + dx * cos(angle) - dy * sin(angle)),
      Y: round(centerY + dx * sin(angle) + dy * cos(angle)),
      z: startPoint.z
    });
  }
  
  return polygon;
}

// Union two polygons using Clipper
function unionPolygons(poly1, poly2) {
  if (!poly1) return poly2;
  if (!poly2) return poly1;
  
  try {
    let cpr = new ClipperLib.Clipper();
    let solution = new ClipperLib.Paths();
    
    cpr.AddPath(poly1, ClipperLib.PolyType.ptSubject, true);
    cpr.AddPath(poly2, ClipperLib.PolyType.ptClip, true);
    
    cpr.Execute(ClipperLib.ClipType.ctUnion, solution, 
                ClipperLib.PolyFillType.pftNonZero, 
                ClipperLib.PolyFillType.pftNonZero);
    
    // Return only the outer boundary (largest polygon)
    if (solution.length > 0) {
      let largest = solution[0];
      let maxArea = ClipperLib.Clipper.Area(largest);
      
      for (let i = 1; i < solution.length; i++) {
        let area = ClipperLib.Clipper.Area(solution[i]);
        if (area > maxArea) {
          maxArea = area;
          largest = solution[i];
        }
      }
      
      return largest;
    }
    
    return poly1;
  } catch (e) {
    console.error("Clipper union failed:", e);
    return poly1;
  }
}

// Group strokes by Z-depth into layers
function groupStrokesByZDepth(allStrokes, tolerance) {
  if (allStrokes.length === 0) return [];
  
  let layers = [];
  
  for (let stroke of allStrokes) {
    if (stroke.length < 2) continue;
    
    // Calculate average Z-depth of this stroke
    let avgZ = stroke.reduce((sum, pt) => sum + pt.z, 0) / stroke.length;
    
    // Find existing layer within tolerance
    let foundLayer = null;
    for (let layer of layers) {
      if (abs(layer.avgZ - avgZ) < tolerance) {
        foundLayer = layer;
        break;
      }
    }
    
    if (foundLayer) {
      foundLayer.strokes.push(stroke);
      // Update average Z
      let totalZ = foundLayer.avgZ * (foundLayer.strokes.length - 1) + avgZ;
      foundLayer.avgZ = totalZ / foundLayer.strokes.length;
    } else {
      // Create new layer
      layers.push({
        avgZ: avgZ,
        strokes: [stroke]
      });
    }
  }
  
  // Sort layers by Z-depth (back to front)
  layers.sort((a, b) => a.avgZ - b.avgZ);
  
  return layers;
}

// Find clusters of strokes that are spatially close (magnetic attraction)
function findMagneticClusters(allStrokes, attractionRadius) {
  if (allStrokes.length === 0) return [];
  
  let clusters = [];
  let assigned = new Set();
  
  for (let i = 0; i < allStrokes.length; i++) {
    if (assigned.has(i)) continue;
    
    let cluster = [allStrokes[i]];
    assigned.add(i);
    
    // Find all strokes within attraction radius
    for (let j = i + 1; j < allStrokes.length; j++) {
      if (assigned.has(j)) continue;
      
      // Check if stroke j is close to any stroke in current cluster
      let isClose = false;
      for (let clusterStroke of cluster) {
        if (strokesAreClose(clusterStroke, allStrokes[j], attractionRadius)) {
          isClose = true;
          break;
        }
      }
      
      if (isClose) {
        cluster.push(allStrokes[j]);
        assigned.add(j);
      }
    }
    
    clusters.push(cluster);
  }
  
  return clusters;
}

// Check if two strokes are spatially close (3D distance)
function strokesAreClose(stroke1, stroke2, radius) {
  // Sample points from both strokes and check minimum distance
  let sampleRate = max(1, floor(min(stroke1.length, stroke2.length) / 10));
  
  for (let i = 0; i < stroke1.length; i += sampleRate) {
    for (let j = 0; j < stroke2.length; j += sampleRate) {
      let p1 = stroke1[i];
      let p2 = stroke2[j];
      let dist3D = dist(p1.x, p1.y, p1.z, p2.x, p2.y, p2.z);
      
      if (dist3D < radius) {
        return true;
      }
    }
  }
  
  return false;
}

// ===== VECTOR INK OUTLINE 2 WITH BOOLEAN UNION =====

// Global storage for merged polygon (persistent across frames)
let mergedVectorInkPoly = null;

function renderVectorInkOutline2(allStrokes) {
  if (allStrokes.length === 0) {
    mergedVectorInkPoly = null;
    return;
  }
  
  // Don't group by Z - instead keep individual Z values per vertex
  stroke(255);
  strokeWeight(2);
  noFill();
  
  // Draw each stroke separately instead of merging them
  for (let strokePath of allStrokes) {
    if (strokePath.length < 2) continue;
    
    let strokePoly = create2DStrokePolygonWithZ(strokePath, basePixelSize * 2);
    if (!strokePoly || !strokePoly.polygon || strokePoly.polygon.length === 0) continue;
    
    let mergedWithZ = reconstructZValues(strokePoly.polygon, [strokePoly]);
    
    // Apply wave animation to this stroke if enabled
    if (waveAnimationEnabled) {
      for (let i = 0; i < mergedWithZ.length; i++) {
        let pt = mergedWithZ[i];
        
        // Calculate wave effect based on position along the shape
        let wavePhase = i * 0.3 - frameCount * 0.1;
        let waveStrength = map(sin(wavePhase), -1, 1, 0.9625, 1.0375);
        
        // Find the center of the shape to apply radial wave
        let centerX = 0, centerY = 0;
        for (let p of mergedWithZ) {
          centerX += p.X;
          centerY += p.Y;
        }
        centerX /= mergedWithZ.length;
        centerY /= mergedWithZ.length;
        
        // Apply wave by moving points toward/away from center
        let dx = pt.X - centerX;
        let dy = pt.Y - centerY;
        
        pt.X = centerX + dx * waveStrength;
        pt.Y = centerY + dy * waveStrength;
      }
    }
    
    // Draw this stroke with depth-based coloring if shading enabled
    if (enableShading) {
      // Draw with grayscale gradient based on Z depth
      noFill();
      strokeWeight(2);
      for (let i = 0; i < mergedWithZ.length - 1; i++) {
        let pt = mergedWithZ[i];
        let nextPt = mergedWithZ[i + 1];
        
        // Map Z to grayscale - closer is brighter, further is darker
        let grayValue = map(pt.z, -100, 100, 150, 255);
        stroke(grayValue);
        
        line(pt.X / 1000, pt.Y / 1000, pt.z, nextPt.X / 1000, nextPt.Y / 1000, nextPt.z);
      }
    } else {
      // Normal white stroke
      stroke(255);
      strokeWeight(2);
      noFill();
      beginShape();
      for (let pt of mergedWithZ) {
        vertex(pt.X / 1000, pt.Y / 1000, pt.z);
      }
      endShape(CLOSE);
    }
    
    // Draw outlines if enabled for this stroke
    if (outlineLevels >= 1 && mergedWithZ.length > 2) {
      for (let level = 1; level <= outlineLevels; level++) {
        let outlineOffset = basePixelSize * 2 + (level * outlineSpacing);
        
        let leftOutline = [];
        let rightOutline = [];
        
        for (let i = 0; i < mergedWithZ.length; i++) {
          let p = mergedWithZ[i];
          let offsetX = outlineOffset;
          let offsetY = 0;
          
          let dx = 0, dy = 0;
          
          // Use circular indexing for closed shape
          let next = mergedWithZ[(i + 1) % mergedWithZ.length];
          let prev = mergedWithZ[(i - 1 + mergedWithZ.length) % mergedWithZ.length];
          dx = next.X - prev.X;
          dy = next.Y - prev.Y;
          
          let len = sqrt(dx * dx + dy * dy);
          if (len > 0.01) {
            offsetX = -dy / len * outlineOffset * 1000;
            offsetY = dx / len * outlineOffset * 1000;
          }
          
          // Add wave animation if enabled
          let wave = waveAnimationEnabled ? 
            map(sin(i * 0.3 - frameCount * 0.1), -1, 1, 0.7, 1.3) : 
            1.0;
          let waveOffsetX = offsetX * wave;
          let waveOffsetY = offsetY * wave;
          
          leftOutline.push({ X: p.X - waveOffsetX, Y: p.Y - waveOffsetY, z: p.z });
          rightOutline.push({ X: p.X + waveOffsetX, Y: p.Y + waveOffsetY, z: p.z });
        }
        
        // Apply smoothing to outline points if smoothness > 0
        if (outlineSmoothness > 0) {
          let smoothingPasses = floor(map(outlineSmoothness, 0, 100, 0, 4));
          for (let pass = 0; pass < smoothingPasses; pass++) {
            leftOutline = smoothOutlinePointsOutline2(leftOutline);
            rightOutline = smoothOutlinePointsOutline2(rightOutline);
          }
        }
        
        // Draw outlines with depth-based coloring if shading enabled
        if (enableShading) {
          noFill();
          strokeWeight(2);
          
          // Left outline with grayscale gradient
          for (let i = 0; i < leftOutline.length - 1; i++) {
            let p = leftOutline[i];
            let nextP = leftOutline[i + 1];
            
            let grayValue = map(p.z, -100, 100, 150, 255);
            stroke(grayValue);
            
            line(p.X / 1000, p.Y / 1000, p.z, nextP.X / 1000, nextP.Y / 1000, nextP.z);
          }
          
          // Right outline with grayscale gradient
          for (let i = 0; i < rightOutline.length - 1; i++) {
            let p = rightOutline[i];
            let nextP = rightOutline[i + 1];
            
            let grayValue = map(p.z, -100, 100, 150, 255);
            stroke(grayValue);
            
            line(p.X / 1000, p.Y / 1000, p.z, nextP.X / 1000, nextP.Y / 1000, nextP.z);
          }
        } else {
          // Normal white outlines
          stroke(255);
          strokeWeight(2);
          noFill();
          
          // Draw closed outlines
          beginShape();
          if (outlineSmoothness > 0 && leftOutline.length > 2) {
            curveVertex(leftOutline[0].X / 1000, leftOutline[0].Y / 1000, leftOutline[0].z);
            for (let p of leftOutline) {
              curveVertex(p.X / 1000, p.Y / 1000, p.z);
            }
            curveVertex(leftOutline[0].X / 1000, leftOutline[0].Y / 1000, leftOutline[0].z);
          } else {
            for (let p of leftOutline) {
              vertex(p.X / 1000, p.Y / 1000, p.z);
            }
          }
          endShape(CLOSE);
          
          beginShape();
          if (outlineSmoothness > 0 && rightOutline.length > 2) {
            curveVertex(rightOutline[0].X / 1000, rightOutline[0].Y / 1000, rightOutline[0].z);
            for (let p of rightOutline) {
              curveVertex(p.X / 1000, p.Y / 1000, p.z);
            }
            curveVertex(rightOutline[0].X / 1000, rightOutline[0].Y / 1000, rightOutline[0].z);
          } else {
            for (let p of rightOutline) {
              vertex(p.X / 1000, p.Y / 1000, p.z);
            }
          }
          endShape(CLOSE);
        }
      }
    }
  }
  
  // Project text along path if enabled
  if (cubeConfig.textOnOutline && allStrokes.length > 0) {
    // Use the first stroke as the text path
    let mainStroke = allStrokes[0];
    if (mainStroke.length >= 2) {
      projectTextOnPath(mainStroke);
    }
  }
}

// Create 2D stroke polygon but keep Z values for each point
function create2DStrokePolygonWithZ(points, width) {
  if (points.length < 2) return null;
  
  let halfWidth = width / 2;
  let leftSide = [];
  let rightSide = [];
  let zValues = []; // Store original Z values
  
  // Create offset curves along the path
  for (let i = 0; i < points.length; i++) {
    let p = points[i];
    let tangent;
    
    // Calculate tangent direction (XY only)
    if (i === 0) {
      tangent = createVector(points[1].x - p.x, points[1].y - p.y, 0);
    } else if (i === points.length - 1) {
      tangent = createVector(p.x - points[i-1].x, p.y - points[i-1].y, 0);
    } else {
      tangent = createVector(points[i+1].x - points[i-1].x, points[i+1].y - points[i-1].y, 0);
    }
    
    tangent.normalize();
    
    // Create perpendicular in XY plane
    let normal = createVector(-tangent.y, tangent.x, 0);
    normal.normalize();
    normal.mult(halfWidth);
    
    leftSide.push({
      X: Math.round((p.x + normal.x) * 1000),
      Y: Math.round((p.y + normal.y) * 1000),
      z: p.z,
      sourceX: p.x,
      sourceY: p.y
    });
    
    rightSide.push({
      X: Math.round((p.x - normal.x) * 1000),
      Y: Math.round((p.y - normal.y) * 1000),
      z: p.z,
      sourceX: p.x,
      sourceY: p.y
    });
  }
  
  // Add round caps with interpolated Z
  let capSegments = 8;
  let startCap = [];
  let endCap = [];
  
  // Start cap
  let startCenter = points[0];
  let startDir = createVector(points[1].x - startCenter.x, points[1].y - startCenter.y, 0);
  startDir.normalize();
  for (let i = 0; i <= capSegments; i++) {
    let angle = PI + (i / capSegments) * PI;
    let offset = createVector(
      cos(angle) * (-startDir.y) - sin(angle) * startDir.x,
      cos(angle) * startDir.x + sin(angle) * (-startDir.y),
      0
    );
    offset.mult(halfWidth);
    startCap.push({
      X: Math.round((startCenter.x + offset.x) * 1000),
      Y: Math.round((startCenter.y + offset.y) * 1000),
      z: startCenter.z,
      sourceX: startCenter.x,
      sourceY: startCenter.y
    });
  }
  
  // End cap
  let endCenter = points[points.length - 1];
  let endDir = createVector(endCenter.x - points[points.length - 2].x, endCenter.y - points[points.length - 2].y, 0);
  endDir.normalize();
  for (let i = 0; i <= capSegments; i++) {
    let angle = (i / capSegments) * PI;
    let offset = createVector(
      cos(angle) * (-endDir.y) - sin(angle) * endDir.x,
      cos(angle) * endDir.x + sin(angle) * (-endDir.y),
      0
    );
    offset.mult(halfWidth);
    endCap.push({
      X: Math.round((endCenter.x + offset.x) * 1000),
      Y: Math.round((endCenter.y + offset.y) * 1000),
      z: endCenter.z,
      sourceX: endCenter.x,
      sourceY: endCenter.y
    });
  }
  
  // Combine polygon
  let fullPolygon = [...leftSide, ...endCap, ...rightSide.reverse(), ...startCap];
  
  return {
    polygon: fullPolygon,
    pointsWithZ: fullPolygon // Keep Z info for reconstruction
  };
}

// Reconstruct Z values for merged polygon by interpolating from original points
function reconstructZValues(merged2D, originalPolygons) {
  let result = [];
  
  for (let pt of merged2D) {
    let x = pt.X / 1000;
    let y = pt.Y / 1000;
    
    // Find nearest original point with Z value
    let nearestZ = 0;
    let minDist = Infinity;
    
    for (let polyData of originalPolygons) {
      for (let origPt of polyData.pointsWithZ) {
        if (origPt.sourceX !== undefined && origPt.sourceY !== undefined) {
          let dist = Math.sqrt(
            Math.pow(x - origPt.sourceX, 2) + 
            Math.pow(y - origPt.sourceY, 2)
          );
          
          if (dist < minDist) {
            minDist = dist;
            nearestZ = origPt.z;
          }
        }
      }
    }
    
    result.push({
      X: pt.X,
      Y: pt.Y,
      z: nearestZ
    });
  }
  
  return result;
}

// Group strokes by Z depth
function groupStrokesByZ(allStrokes, tolerance) {
  let groups = [];
  
  for (let stroke of allStrokes) {
    if (stroke.length === 0) continue;
    
    // Calculate average Z for this stroke
    let avgZ = stroke.reduce((sum, pt) => sum + pt.z, 0) / stroke.length;
    
    // Find existing group within tolerance
    let foundGroup = null;
    for (let group of groups) {
      if (Math.abs(group.avgZ - avgZ) < tolerance) {
        foundGroup = group;
        break;
      }
    }
    
    if (foundGroup) {
      foundGroup.strokes.push(stroke);
      // Recalculate average Z
      let allPoints = foundGroup.strokes.flat();
      foundGroup.avgZ = allPoints.reduce((sum, pt) => sum + pt.z, 0) / allPoints.length;
    } else {
      groups.push({
        avgZ: avgZ,
        strokes: [stroke]
      });
    }
  }
  
  // Sort by Z depth (back to front for proper rendering)
  groups.sort((a, b) => a.avgZ - b.avgZ);
  
  return groups;
}

// Create 2D stroke polygon (flattened to XY plane)
function create2DStrokePolygonFlat(points, width) {
  if (points.length < 2) return null;
  
  let halfWidth = width / 2;
  let leftSide = [];
  let rightSide = [];
  
  // Create offset curves along the path (in XY plane only)
  for (let i = 0; i < points.length; i++) {
    let p = points[i];
    let tangent;
    
    // Calculate tangent direction (XY only)
    if (i === 0) {
      tangent = createVector(points[1].x - p.x, points[1].y - p.y, 0);
    } else if (i === points.length - 1) {
      tangent = createVector(p.x - points[i-1].x, p.y - points[i-1].y, 0);
    } else {
      tangent = createVector(points[i+1].x - points[i-1].x, points[i+1].y - points[i-1].y, 0);
    }
    
    tangent.normalize();
    
    // Create perpendicular in XY plane
    let normal = createVector(-tangent.y, tangent.x, 0);
    normal.normalize();
    normal.mult(halfWidth);
    
    leftSide.push({
      X: Math.round((p.x + normal.x) * 1000),
      Y: Math.round((p.y + normal.y) * 1000)
    });
    
    rightSide.push({
      X: Math.round((p.x - normal.x) * 1000),
      Y: Math.round((p.y - normal.y) * 1000)
    });
  }
  
  // Add round caps
  let capSegments = 8;
  let startCap = [];
  let endCap = [];
  
  // Start cap
  let startCenter = points[0];
  let startDir = createVector(points[1].x - startCenter.x, points[1].y - startCenter.y, 0);
  startDir.normalize();
  for (let i = 0; i <= capSegments; i++) {
    let angle = PI + (i / capSegments) * PI;
    let offset = createVector(
      cos(angle) * (-startDir.y) - sin(angle) * startDir.x,
      cos(angle) * startDir.x + sin(angle) * (-startDir.y),
      0
    );
    offset.mult(halfWidth);
    startCap.push({
      X: Math.round((startCenter.x + offset.x) * 1000),
      Y: Math.round((startCenter.y + offset.y) * 1000)
    });
  }
  
  // End cap
  let endCenter = points[points.length - 1];
  let endDir = createVector(endCenter.x - points[points.length - 2].x, endCenter.y - points[points.length - 2].y, 0);
  endDir.normalize();
  for (let i = 0; i <= capSegments; i++) {
    let angle = (i / capSegments) * PI;
    let offset = createVector(
      cos(angle) * (-endDir.y) - sin(angle) * endDir.x,
      cos(angle) * endDir.x + sin(angle) * (-endDir.y),
      0
    );
    offset.mult(halfWidth);
    endCap.push({
      X: Math.round((endCenter.x + offset.x) * 1000),
      Y: Math.round((endCenter.y + offset.y) * 1000)
    });
  }
  
  // Combine: left side + end cap + right side reversed + start cap
  return [...leftSide, ...endCap, ...rightSide.reverse(), ...startCap];
}

// Create stroke polygon from 3D path with offset curves
function create3DStrokePolygon(points, width) {
  if (points.length < 2) return null;
  
  let halfWidth = width / 2;
  let leftSide = [];
  let rightSide = [];
  
  // Create offset curves along the path
  for (let i = 0; i < points.length; i++) {
    let p = points[i];
    let tangent;
    
    // Calculate tangent direction
    if (i === 0) {
      tangent = createVector(points[1].x - p.x, points[1].y - p.y, points[1].z - p.z);
    } else if (i === points.length - 1) {
      tangent = createVector(p.x - points[i-1].x, p.y - points[i-1].y, p.z - points[i-1].z);
    } else {
      tangent = createVector(points[i+1].x - points[i-1].x, points[i+1].y - points[i-1].y, points[i+1].z - points[i-1].z);
    }
    
    tangent.normalize();
    
    // Create perpendicular in XY plane (ignoring Z for offset)
    let normal = createVector(-tangent.y, tangent.x, 0);
    normal.normalize();
    normal.mult(halfWidth);
    
    leftSide.push({
      X: Math.round((p.x + normal.x) * 1000),
      Y: Math.round((p.y + normal.y) * 1000),
      z: p.z
    });
    
    rightSide.push({
      X: Math.round((p.x - normal.x) * 1000),
      Y: Math.round((p.y - normal.y) * 1000),
      z: p.z
    });
  }
  
  // Add round caps (8 segments each)
  let capSegments = 8;
  let startCap = [];
  let endCap = [];
  
  // Start cap (round)
  let startCenter = points[0];
  let startDir = createVector(points[1].x - startCenter.x, points[1].y - startCenter.y, 0);
  startDir.normalize();
  for (let i = 0; i <= capSegments; i++) {
    let angle = PI + (i / capSegments) * PI;
    let offset = createVector(
      cos(angle) * (-startDir.y) - sin(angle) * startDir.x,
      cos(angle) * startDir.x + sin(angle) * (-startDir.y),
      0
    );
    offset.mult(halfWidth);
    startCap.push({
      X: Math.round((startCenter.x + offset.x) * 1000),
      Y: Math.round((startCenter.y + offset.y) * 1000),
      z: startCenter.z
    });
  }
  
  // End cap (round)
  let endCenter = points[points.length - 1];
  let endDir = createVector(endCenter.x - points[points.length - 2].x, endCenter.y - points[points.length - 2].y, 0);
  endDir.normalize();
  for (let i = 0; i <= capSegments; i++) {
    let angle = (i / capSegments) * PI;
    let offset = createVector(
      cos(angle) * (-endDir.y) - sin(angle) * endDir.x,
      cos(angle) * endDir.x + sin(angle) * (-endDir.y),
      0
    );
    offset.mult(halfWidth);
    endCap.push({
      X: Math.round((endCenter.x + offset.x) * 1000),
      Y: Math.round((endCenter.y + offset.y) * 1000),
      z: endCenter.z
    });
  }
  
  // Combine: left side + end cap + right side reversed + start cap
  return [...leftSide, ...endCap, ...rightSide.reverse(), ...startCap];
}

// Union two polygons using Clipper.js
function unionPolygonsClipper(poly1, poly2) {
  if (!window.ClipperLib) {
    console.warn("ClipperLib not loaded");
    return poly1;
  }
  
  try {
    let cpr = new ClipperLib.Clipper();
    let solution = new ClipperLib.Paths();
    
    cpr.AddPath(poly1, ClipperLib.PolyType.ptSubject, true);
    cpr.AddPath(poly2, ClipperLib.PolyType.ptClip, true);
    
    let success = cpr.Execute(ClipperLib.ClipType.ctUnion, solution,
                              ClipperLib.PolyFillType.pftNonZero,
                              ClipperLib.PolyFillType.pftNonZero);
    
    if (!success || solution.length === 0) {
      return poly1;
    }
    
    // Extract outer boundary (largest polygon)
    let largest = solution[0];
    let maxArea = Math.abs(ClipperLib.Clipper.Area(largest));
    
    for (let i = 1; i < solution.length; i++) {
      let area = Math.abs(ClipperLib.Clipper.Area(solution[i]));
      if (area > maxArea) {
        maxArea = area;
        largest = solution[i];
      }
    }
    
    return largest;
  } catch (e) {
    console.error("Clipper union failed:", e);
    return poly1;
  }
}

// Draw 3D outline from merged polygon
function draw3DVectorOutline(poly) {
  if (poly.length < 3) return;
  
  // Group points by similar Z depth to create multiple layers
  let zLayers = groupByZDepth(poly, basePixelSize * 2);
  
  stroke(255);
  strokeWeight(2);
  noFill();
  
  // Draw each Z-layer
  for (let layer of zLayers) {
    if (layer.points.length < 3) continue;
    
    beginShape();
    for (let pt of layer.points) {
      vertex(pt.X / 1000, pt.Y / 1000, pt.z);
    }
    endShape(CLOSE);
  }
  
  // If multiple layers, connect them with vertical lines for 3D effect
  if (zLayers.length > 1) {
    strokeWeight(1);
    
    for (let i = 0; i < zLayers.length - 1; i++) {
      let layer1 = zLayers[i].points;
      let layer2 = zLayers[i + 1].points;
      
      // Connect corresponding points (sample every Nth point for cleaner look)
      let step = Math.max(1, Math.floor(Math.min(layer1.length, layer2.length) / 12));
      
      for (let j = 0; j < Math.min(layer1.length, layer2.length); j += step) {
        let pt1 = layer1[j];
        let pt2 = layer2[Math.min(j, layer2.length - 1)];
        
        beginShape();
        vertex(pt1.X / 1000, pt1.Y / 1000, pt1.z);
        vertex(pt2.X / 1000, pt2.Y / 1000, pt2.z);
        endShape();
      }
    }
  }
}

// Group polygon points by Z depth into layers
function groupByZDepth(poly, tolerance) {
  if (poly.length === 0) return [];
  
  let layers = [];
  
  for (let pt of poly) {
    let z = pt.z !== undefined ? pt.z : 0;
    
    // Find existing layer within tolerance
    let foundLayer = null;
    for (let layer of layers) {
      if (Math.abs(layer.avgZ - z) < tolerance) {
        foundLayer = layer;
        break;
      }
    }
    
    if (foundLayer) {
      foundLayer.points.push(pt);
      // Update average Z
      let sum = foundLayer.points.reduce((s, p) => s + (p.z || 0), 0);
      foundLayer.avgZ = sum / foundLayer.points.length;
    } else {
      layers.push({
        avgZ: z,
        points: [pt]
      });
    }
  }
  
  // Sort layers by Z depth (front to back)
  layers.sort((a, b) => b.avgZ - a.avgZ);
  
  return layers;
}

// ===== 3D WORM/TUBE RENDERING (OLD VERSION) =====

// Render 3D worm tubes with blob intersections
function renderVectorInkStrokes(allStrokes) {
  if (allStrokes.length === 0) return;
  
  // Convert all 3D strokes to 2D screen coordinates and create stroke polygons
  let allPolygons = [];
  let strokeWidth = basePixelSize * 2;
  
  for (let stroke of allStrokes) {
    if (stroke.length < 2) continue;
    
    // Project 3D points to 2D screen space
    let screenPoints = [];
    for (let pt of stroke) {
      let screenPt = project3DToScreen(pt.x, pt.y, pt.z);
      if (screenPt) {
        screenPoints.push(screenPt);
      }
    }
    
    if (screenPoints.length < 2) continue;
    
    // Create offset polygons for this stroke
    let strokePoly = createStrokePolygon(screenPoints, strokeWidth);
    if (strokePoly && strokePoly.length > 0) {
      allPolygons.push(strokePoly);
    }
  }
  
  // Merge all polygons using boolean union
  if (allPolygons.length === 0) return;
  
  let mergedPoly = allPolygons[0];
  for (let i = 1; i < allPolygons.length; i++) {
    mergedPoly = unionPolygons(mergedPoly, allPolygons[i]);
  }
  
  // Draw the merged outline
  if (mergedPoly && mergedPoly.length > 0) {
    drawPolygonOutline(mergedPoly);
  }
}

// Project 3D point to 2D screen coordinates
function project3DToScreen(x, y, z) {
  // Create a copy of the point
  let vec = createVector(x, y, z);
  
  // Apply rotation (same as in draw loop)
  let cosX = cos(-voxelRotX);
  let sinX = sin(-voxelRotX);
  let cosY = cos(-voxelRotY);
  let sinY = sin(-voxelRotY);
  
  // Rotate Y
  let xTemp = vec.x * cosY + vec.z * sinY;
  let zTemp = -vec.x * sinY + vec.z * cosY;
  vec.x = xTemp;
  vec.z = zTemp;
  
  // Rotate X
  let yTemp = vec.y * cosX - vec.z * sinX;
  zTemp = vec.y * sinX + vec.z * cosX;
  vec.y = yTemp;
  vec.z = zTemp;
  
  // Apply zoom
  vec.mult(voxelZoom);
  
  // Apply pan offset
  vec.x += panOffsetX;
  vec.y += panOffsetY;
  
  // Simple orthographic projection to screen space
  return { x: vec.x + width / 2, y: vec.y + height / 2 };
}

// Convert screen coordinates to 3D world coordinates (inverse of project3DToScreen)
function screenTo3D(screenX, screenY, z = 0) {
  // Start with screen coordinates relative to canvas center
  let x = screenX - width / 2;
  let y = screenY - height / 2;
  
  // First remove pan offset (in screen space)
  x -= panOffsetX;
  y -= panOffsetY;
  
  // Then remove zoom
  x /= voxelZoom;
  y /= voxelZoom;
  z /= voxelZoom;
  
  // Create vector for rotation
  let vec = createVector(x, y, z);
  
  // Apply inverse rotation (reverse order, opposite angles)
  let cosX = cos(-voxelRotX);
  let sinX = sin(-voxelRotX);
  let cosY = cos(-voxelRotY);
  let sinY = sin(-voxelRotY);
  
  // Inverse rotate Y first (opposite order from forward transform)
  let xTemp = vec.x * cosY - vec.z * sinY;
  let zTemp = vec.x * sinY + vec.z * cosY;
  vec.x = xTemp;
  vec.z = zTemp;
  
  // Then inverse rotate X
  let yTemp = vec.y * cosX + vec.z * sinX;
  zTemp = -vec.y * sinX + vec.z * cosX;
  vec.y = yTemp;
  vec.z = zTemp;
  
  return vec;
}

// Create stroke outline polygon from path points
function createStrokePolygon(points, width) {
  if (points.length < 2) return null;
  
  let halfWidth = width / 2;
  let leftSide = [];
  let rightSide = [];
  
  for (let i = 0; i < points.length; i++) {
    let p = points[i];
    let tangent;
    
    if (i === 0) {
      tangent = createVector(points[1].x - p.x, points[1].y - p.y);
    } else if (i === points.length - 1) {
      tangent = createVector(p.x - points[i - 1].x, p.y - points[i - 1].y);
    } else {
      tangent = createVector(points[i + 1].x - points[i - 1].x, points[i + 1].y - points[i - 1].y);
    }
    
    tangent.normalize();
    let normal = createVector(-tangent.y, tangent.x);
    
    leftSide.push({ x: p.x + normal.x * halfWidth, y: p.y + normal.y * halfWidth });
    rightSide.push({ x: p.x - normal.x * halfWidth, y: p.y - normal.y * halfWidth });
  }
  
  // Add round caps
  let capSegments = 8;
  let startCap = [];
  let endCap = [];
  
  // Start cap
  let startTangent = createVector(points[1].x - points[0].x, points[1].y - points[0].y);
  startTangent.normalize();
  for (let i = 0; i <= capSegments; i++) {
    let angle = PI + (i / capSegments) * PI;
    let offset = createVector(
      cos(angle) * (-startTangent.y) - sin(angle) * startTangent.x,
      cos(angle) * startTangent.x + sin(angle) * (-startTangent.y)
    );
    offset.mult(halfWidth);
    startCap.push({ x: points[0].x + offset.x, y: points[0].y + offset.y });
  }
  
  // End cap
  let endIdx = points.length - 1;
  let endTangent = createVector(points[endIdx].x - points[endIdx - 1].x, points[endIdx].y - points[endIdx - 1].y);
  endTangent.normalize();
  for (let i = 0; i <= capSegments; i++) {
    let angle = (i / capSegments) * PI;
    let offset = createVector(
      cos(angle) * (-endTangent.y) - sin(angle) * endTangent.x,
      cos(angle) * endTangent.x + sin(angle) * (-endTangent.y)
    );
    offset.mult(halfWidth);
    endCap.push({ x: points[endIdx].x + offset.x, y: points[endIdx].y + offset.y });
  }
  
  // Combine into closed polygon
  return [...leftSide, ...endCap, ...rightSide.reverse(), ...startCap];
}

// Union two polygons using Clipper.js
function unionPolygons(poly1, poly2) {
  if (!window.ClipperLib) {
    console.warn("ClipperLib not loaded");
    return poly1;
  }
  
  let cpr = new ClipperLib.Clipper();
  let scale = 1000; // Scale for integer coordinates
  
  // Convert to Clipper format
  let subj = poly1.map(p => ({ X: Math.round(p.x * scale), Y: Math.round(p.y * scale) }));
  let clip = poly2.map(p => ({ X: Math.round(p.x * scale), Y: Math.round(p.y * scale) }));
  
  cpr.AddPath(subj, ClipperLib.PolyType.ptSubject, true);
  cpr.AddPath(clip, ClipperLib.PolyType.ptClip, true);
  
  let solution = new ClipperLib.Paths();
  cpr.Execute(ClipperLib.ClipType.ctUnion, solution);
  
  if (solution.length === 0) return poly1;
  
  // Get outer boundary (largest polygon)
  let largest = solution[0];
  for (let poly of solution) {
    if (ClipperLib.Clipper.Area(poly) > ClipperLib.Clipper.Area(largest)) {
      largest = poly;
    }
  }
  
  // Convert back to normal coordinates
  return largest.map(p => ({ x: p.X / scale, y: p.Y / scale }));
}

// Draw polygon as outline only
function drawPolygonOutline(poly) {
  if (poly.length < 3) return;
  
  push();
  // Reset transformations for 2D overlay
  resetMatrix();
  
  stroke(255);
  strokeWeight(2);
  noFill();
  
  beginShape();
  for (let p of poly) {
    vertex(p.x, p.y);
  }
  endShape(CLOSE);
  
  pop();
}

function render3DWormTubes(allStrokes) {
  if (allStrokes.length === 0) return;
  
  let tubeRadius = basePixelSize * 1.5;
  let intersections = find3DIntersections(allStrokes, tubeRadius * 2.5);
  
  // Draw each stroke as a 3D tube
  for (let stroke of allStrokes) {
    if (stroke.length < 2) continue;
    draw3DTube(stroke, tubeRadius);
  }
  
  // Draw blobs at intersections (much larger for visible merging)
  for (let intersection of intersections) {
    drawBlob(intersection.pos, tubeRadius * 2.5);
  }
}

// Draw a single 3D tube (worm) through space
function draw3DTube(points, radius) {
  if (points.length < 2) return;
  
  noStroke();
  fill(255);
  
  let segments = 16; // More segments for smoother tube
  let subdivisions = 3; // Interpolate between points for denser tube
  
  // Draw tube as connected quad strips between circles
  for (let i = 0; i < points.length - 1; i++) {
    // Interpolate multiple segments between each pair of points
    for (let sub = 0; sub < subdivisions; sub++) {
      let t1 = sub / subdivisions;
      let t2 = (sub + 1) / subdivisions;
      
      let p1 = p5.Vector.lerp(points[i], points[i + 1], t1);
      let p2 = p5.Vector.lerp(points[i], points[i + 1], t2);
    
    // Calculate direction vector
    let dir = p5.Vector.sub(p2, p1);
    dir.normalize();
    
    // Create perpendicular vectors for circle
    let perp1, perp2;
    if (abs(dir.x) < 0.9) {
      perp1 = createVector(1, 0, 0).cross(dir);
    } else {
      perp1 = createVector(0, 1, 0).cross(dir);
    }
    perp1.normalize();
    perp2 = dir.cross(perp1);
    perp2.normalize();
    
    // Draw quad strip connecting two circles
    for (let j = 0; j <= segments; j++) {
      let angle = (j / segments) * TWO_PI;
      
      // Calculate normal for lighting
      let normalX = cos(angle) * perp1.x + sin(angle) * perp2.x;
      let normalY = cos(angle) * perp1.y + sin(angle) * perp2.y;
      let normalZ = cos(angle) * perp1.z + sin(angle) * perp2.z;
      
      // Point on circle at p1
      let x1 = p1.x + normalX * radius;
      let y1 = p1.y + normalY * radius;
      let z1 = p1.z + normalZ * radius;
      
      // Point on circle at p2
      let x2 = p2.x + normalX * radius;
      let y2 = p2.y + normalY * radius;
      let z2 = p2.z + normalZ * radius;
      
      // Simple lighting based on normal direction (facing towards camera)
      let lightAmount = map(normalZ, -1, 1, 0.3, 1.0);
      fill(255 * lightAmount);
      
      // Draw quad
      if (j < segments) {
        let nextAngle = ((j + 1) / segments) * TWO_PI;
        let nextNormalX = cos(nextAngle) * perp1.x + sin(nextAngle) * perp2.x;
        let nextNormalY = cos(nextAngle) * perp1.y + sin(nextAngle) * perp2.y;
        let nextNormalZ = cos(nextAngle) * perp1.z + sin(nextAngle) * perp2.z;
        
        let x1next = p1.x + nextNormalX * radius;
        let y1next = p1.y + nextNormalY * radius;
        let z1next = p1.z + nextNormalZ * radius;
        
        let x2next = p2.x + nextNormalX * radius;
        let y2next = p2.y + nextNormalY * radius;
        let z2next = p2.z + nextNormalZ * radius;
        
        beginShape();
        vertex(x1, y1, z1);
        vertex(x2, y2, z2);
        vertex(x2next, y2next, z2next);
        vertex(x1next, y1next, z1next);
        endShape(CLOSE);
      }
    }
    }
  }
  
  // Draw end caps (spheres)
  push();
  translate(points[0].x, points[0].y, points[0].z);
  fill(255);
  noStroke();
  sphere(radius);
  pop();
  
  push();
  let lastIdx = points.length - 1;
  translate(points[lastIdx].x, points[lastIdx].y, points[lastIdx].z);
  fill(255);
  noStroke();
  sphere(radius);
  pop();
}

// Find 3D intersections between tubes
function find3DIntersections(allStrokes, threshold) {
  let intersections = [];
  
  // Compare each stroke with every other stroke
  for (let i = 0; i < allStrokes.length; i++) {
    for (let j = i + 1; j < allStrokes.length; j++) {
      let strokeA = allStrokes[i];
      let strokeB = allStrokes[j];
      
      if (strokeA.length < 2 || strokeB.length < 2) continue;
      
      // Sample points and find close pairs
      let sampleRate = max(1, floor(max(strokeA.length, strokeB.length) / 20));
      
      for (let a = 0; a < strokeA.length; a += sampleRate) {
        for (let b = 0; b < strokeB.length; b += sampleRate) {
          let dist3D = dist(strokeA[a].x, strokeA[a].y, strokeA[a].z,
                           strokeB[b].x, strokeB[b].y, strokeB[b].z);
          
          if (dist3D < threshold) {
            // Found intersection - check if already recorded nearby
            let midpoint = p5.Vector.lerp(strokeA[a], strokeB[b], 0.5);
            
            let isDuplicate = false;
            for (let existing of intersections) {
              if (p5.Vector.dist(midpoint, existing.pos) < threshold * 0.5) {
                isDuplicate = true;
                break;
              }
            }
            
            if (!isDuplicate) {
              intersections.push({ pos: midpoint });
            }
          }
        }
      }
    }
  }
  
  return intersections;
}

// Draw a blob (sphere) at intersection point
function drawBlob(pos, radius) {
  push();
  translate(pos.x, pos.y, pos.z);
  fill(255);
  noStroke();
  sphere(radius);
  pop();
}

// ===== OLD VECTOR INK FUNCTIONS (kept for reference) =====

// Render magnetic vector ink with clustering
function renderMagneticVectorInk(allStrokes) {
  if (allStrokes.length === 0) return;
  
  let attractionRadius = basePixelSize * 5; // Magnetic pull radius
  
  // Fallback: if clustering fails, just draw each stroke as outline
  try {
    // First: group strokes by XY proximity (ignoring Z)
    let xyClusters = findMagneticClustersXY(allStrokes, attractionRadius);
    
    if (xyClusters.length === 0) {
      // Fallback to simple rendering
      renderSimpleOutlines(allStrokes);
      return;
    }
  
  // For each XY cluster, create Z-layers and connect them vertically
  for (let xyCluster of xyClusters) {
    if (xyCluster.length === 0) continue;
    
    // Sort strokes in this cluster by Z-depth
    xyCluster.sort((a, b) => {
      let avgZA = a.reduce((sum, pt) => sum + pt.z, 0) / a.length;
      let avgZB = b.reduce((sum, pt) => sum + pt.z, 0) / b.length;
      return avgZA - avgZB;
    });
    
    // Create polygon for each stroke and track Z range
    let polygonsWithZ = [];
    let allZValues = [];
    
    for (let stroke of xyCluster) {
      if (stroke.length < 2) continue;
      
      try {
        let avgZ = stroke.reduce((sum, pt) => sum + pt.z, 0) / stroke.length;
        allZValues.push(avgZ);
        let poly = createStrokePolygon(stroke, basePixelSize * 3);
        
        if (poly && poly.length >= 3) {
          polygonsWithZ.push({ polygon: poly, z: avgZ });
        }
      } catch (e) {
        console.warn("Failed to create polygon for stroke:", e);
      }
    }
    
    if (polygonsWithZ.length === 0) continue;
    
    // Merge all polygons in XY plane with error handling
    let mergedPoly = null;
    try {
      mergedPoly = polygonsWithZ[0].polygon;
      for (let i = 1; i < polygonsWithZ.length; i++) {
        mergedPoly = unionPolygons(mergedPoly, polygonsWithZ[i].polygon);
        if (!mergedPoly) break;
      }
    } catch (e) {
      console.warn("Failed to merge polygons:", e);
      continue;
    }
    
    if (!mergedPoly || mergedPoly.length < 3) continue;
    
    // Find min and max Z in this cluster
    let minZ = Math.min(...allZValues);
    let maxZ = Math.max(...allZValues);
    let zRange = maxZ - minZ;
    
    // Only draw 3D structure if there's significant Z variation
    if (zRange > basePixelSize) {
      stroke(255);
      strokeWeight(2);
      noFill();
      
      // Draw front and back outlines
      beginShape();
      for (let pt of mergedPoly) {
        vertex(pt.X / 1000, pt.Y / 1000, maxZ);
      }
      endShape(CLOSE);
      
      beginShape();
      for (let pt of mergedPoly) {
        vertex(pt.X / 1000, pt.Y / 1000, minZ);
      }
      endShape(CLOSE);
      
      // Draw vertical connectors (fewer for cleaner look)
      let step = Math.max(1, Math.floor(mergedPoly.length / 12));
      for (let i = 0; i < mergedPoly.length; i += step) {
        let pt = mergedPoly[i];
        beginShape();
        vertex(pt.X / 1000, pt.Y / 1000, minZ);
        vertex(pt.X / 1000, pt.Y / 1000, maxZ);
        endShape();
      }
    } else {
      // Single Z-layer, just draw outline
      stroke(255);
      strokeWeight(2);
      noFill();
      
      let avgZ = (minZ + maxZ) / 2;
      beginShape();
      for (let pt of mergedPoly) {
        vertex(pt.X / 1000, pt.Y / 1000, avgZ);
      }
      endShape(CLOSE);
    }
  }
  } catch (e) {
    console.error("Vector ink rendering failed:", e);
    renderSimpleOutlines(allStrokes);
  }
}

// Simple fallback rendering for outline2
function renderSimpleOutlines(allStrokes) {
  stroke(255);
  strokeWeight(basePixelSize * 2);
  noFill();
  
  for (let stroke of allStrokes) {
    if (stroke.length < 2) continue;
    
    beginShape();
    for (let pt of stroke) {
      vertex(pt.x, pt.y, pt.z);
    }
    endShape();
  }
}

// Find clusters based only on XY position (ignore Z)
function findMagneticClustersXY(allStrokes, attractionRadius) {
  if (allStrokes.length === 0) return [];
  
  let clusters = [];
  let assigned = new Set();
  
  for (let i = 0; i < allStrokes.length; i++) {
    if (assigned.has(i)) continue;
    
    let cluster = [allStrokes[i]];
    assigned.add(i);
    
    // Find all strokes within XY attraction radius
    for (let j = i + 1; j < allStrokes.length; j++) {
      if (assigned.has(j)) continue;
      
      // Check if stroke j is close to any stroke in current cluster (XY only)
      let isClose = false;
      for (let clusterStroke of cluster) {
        if (strokesAreCloseXY(clusterStroke, allStrokes[j], attractionRadius)) {
          isClose = true;
          break;
        }
      }
      
      if (isClose) {
        cluster.push(allStrokes[j]);
        assigned.add(j);
      }
    }
    
    clusters.push(cluster);
  }
  
  return clusters;
}

// Check if two strokes are spatially close in XY plane only
function strokesAreCloseXY(stroke1, stroke2, radius) {
  // Sample points from both strokes and check minimum XY distance
  let sampleRate = max(1, floor(min(stroke1.length, stroke2.length) / 10));
  
  for (let i = 0; i < stroke1.length; i += sampleRate) {
    for (let j = 0; j < stroke2.length; j += sampleRate) {
      let p1 = stroke1[i];
      let p2 = stroke2[j];
      let distXY = dist(p1.x, p1.y, p2.x, p2.y); // Only XY distance!
      
      if (distXY < radius) {
        return true;
      }
    }
  }
  
  return false;
}

// Render multiple Z-layers of vector ink (old version, kept for reference)
function renderVectorInkLayers(zLayers) {
  for (let layer of zLayers) {
    let mergedPoly = null;
    
    // Union all strokes in this layer
    for (let stroke of layer.strokes) {
      let strokePoly = createStrokePolygon(stroke, basePixelSize * 3);
      mergedPoly = unionPolygons(mergedPoly, strokePoly);
    }
    
    // Render this layer's outline
    if (mergedPoly && mergedPoly.length >= 3) {
      stroke(255);
      strokeWeight(2);
      noFill();
      
      beginShape();
      for (let pt of mergedPoly) {
        vertex(pt.X / 1000, pt.Y / 1000, layer.avgZ); // Use layer's average Z
      }
      endShape(CLOSE);
    }
  }
}

// Render the merged polygon as outline (legacy single-layer version)
function renderVectorInkOutline() {
  if (!mergedInkPolygon || mergedInkPolygon.length < 3) return;
  
  stroke(255);
  strokeWeight(2);
  noFill();
  
  beginShape();
  for (let pt of mergedInkPolygon) {
    vertex(pt.X / 1000, pt.Y / 1000, pt.z || 0); // Unscale from Clipper precision
  }
  endShape(CLOSE);
}

// ===== MAKE ENDS MEET (CLOSED SHAPE) =====

// Animate ends moving towards each other
// Draw a closed shape connecting start and end points (instant version)
function drawClosedShape(points, type) {
  if (points.length < 3) return;
  
  // Different rendering based on brush type
  if (type === "smooth" || type === "pixel") {
    // Draw filled 3D shape
    fill(255);
    noStroke();
    
    // Draw the shape as a filled polygon in 3D
    beginShape();
    for (let p of points) {
      vertex(p.x, p.y, p.z);
    }
    endShape(CLOSE);
    
    // Add outline for better visibility
    stroke(255);
    strokeWeight(1);
    noFill();
    beginShape();
    for (let p of points) {
      vertex(p.x, p.y, p.z);
    }
    endShape(CLOSE);
    
  } else if (type === "outline") {
    // For outline type, draw thick outline around the closed shape
    stroke(255);
    strokeWeight(basePixelSize * 0.5);
    noFill();
    
    beginShape();
    for (let p of points) {
      vertex(p.x, p.y, p.z);
    }
    endShape(CLOSE);
    
  } else {
    // Default: simple filled shape
    fill(255);
    stroke(255);
    strokeWeight(1);
    
    beginShape();
    for (let p of points) {
      vertex(p.x, p.y, p.z);
    }
    endShape(CLOSE);
  }
}

// ===== TEXT PROJECTION FUNCTIONS =====

function projectTextOnSurface(surfacePoints) {
  if (!cubeConfig.brushText || surfacePoints.length < 3) return;
  
  // Calculate bounding box and center of surface
  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;
  let avgZ = 0;
  
  for (let p of surfacePoints) {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
    avgZ += p.z;
  }
  avgZ /= surfacePoints.length;
  
  let centerX = (minX + maxX) / 2;
  let centerY = (minY + maxY) / 2;
  let surfaceWidth = maxX - minX;
  let surfaceHeight = maxY - minY;
  
  // Calculate text size based on surface size and scale
  let calculatedTextSize = Math.min(surfaceWidth, surfaceHeight) * 0.3 * cubeConfig.brushTextScale;
  
  // Draw text at surface center
  push();
  translate(centerX, centerY, avgZ + basePixelSize * 3); // Above surface
  
  // Billboard effect - face camera
  rotateY(-voxelRotX);
  rotateX(-voxelRotY);
  
  // Set text properties
  textFont(cubeConfig.font);
  textSize(calculatedTextSize);
  textAlign(CENTER, CENTER);
  fill(255);
  noStroke();
  
  text(cubeConfig.brushText, 0, 0);
  pop();
}

function projectTextOnPath(pathPoints) {
  if (!cubeConfig.brushText || pathPoints.length < 2) return;
  
  let textString = cubeConfig.brushText;
  let charSpacing = basePixelSize * 2 * cubeConfig.brushTextScale;
  
  // Calculate total path length
  let totalLength = 0;
  let segmentLengths = [];
  for (let i = 0; i < pathPoints.length - 1; i++) {
    let len = p5.Vector.dist(pathPoints[i], pathPoints[i + 1]);
    segmentLengths.push(len);
    totalLength += len;
  }
  
  // Determine text mode
  let textWidth = textString.length * charSpacing;
  let startOffset = 0;
  let textToDisplay = textString;
  
  if (cubeConfig.textRepeat) {
    // Repeat text mode: fill entire path
    let repeatCount = Math.ceil(totalLength / textWidth);
    textToDisplay = textString.repeat(repeatCount);
  } else {
    // Single text mode: center on path
    startOffset = (totalLength - textWidth) / 2;
    if (startOffset < 0) startOffset = 0;
  }
  
  // Place each character along the path
  let currentDist = 0;
  let charIndex = 0;
  let segmentIndex = 0;
  
  textFont(cubeConfig.font || 'Arial');
  textSize(basePixelSize * 3 * cubeConfig.brushTextScale);
  textAlign(CENTER, CENTER);
  fill(255);
  noStroke();
  
  while (segmentIndex < pathPoints.length - 1 && charIndex < textToDisplay.length) {
    let segmentStart = pathPoints[segmentIndex];
    let segmentEnd = pathPoints[segmentIndex + 1];
    let segmentLen = segmentLengths[segmentIndex];
    
    // Check if we need to place a character in this segment
    let charPosition = startOffset + charIndex * charSpacing;
    
    if (charPosition >= currentDist && charPosition < currentDist + segmentLen) {
      // Interpolate position along segment
      let t = (charPosition - currentDist) / segmentLen;
      let x = lerp(segmentStart.x, segmentEnd.x, t);
      let y = lerp(segmentStart.y, segmentEnd.y, t);
      let z = lerp(segmentStart.z, segmentEnd.z, t);
      
      // Calculate rotation from segment direction (in XY plane)
      let dir = p5.Vector.sub(segmentEnd, segmentStart);
      let angle = atan2(dir.y, dir.x);
      
      push();
      translate(x, y, z + basePixelSize * 5); // Significantly above path
      
      // Billboard effect - make text face camera
      // Reset rotations then apply only camera angles
      rotateY(-voxelRotX);
      rotateX(-voxelRotY);
      
      text(textToDisplay.charAt(charIndex), 0, 0);
      pop();
      
      charIndex++;
    } else {
      currentDist += segmentLen;
      segmentIndex++;
    }
  }
}

// ====================
// LETTER TO 3D OUTLINE
// ====================

/**
 * Generates a 3D outline stroke from a letter character
 * @param {string} letter - Single character to convert
 * @param {string} fontFamily - Font family name (e.g., 'Arial')
 * @param {number} size - Font size in pixels
 */
window.generateLetterOutline = function(text, fontFamily, size) {
  console.log('=== generateLetterOutline called ===');
  console.log('Text:', text);
  console.log('Font:', fontFamily);
  console.log('Size:', size);
  
  if (!text || text.length === 0) {
    console.warn('No text provided for outline generation');
    return;
  }
  
  // Limit to 8 characters
  text = text.substring(0, 8);
  
  console.log(`Generating 3D outline for text "${text}" with font ${fontFamily} at size ${size}`);
  
  // Force load the specific font and wait for it
  document.fonts.load(`bold ${size}px ${fontFamily}`).then(() => {
    generateLetterOutlineInternal(text, fontFamily, size);
  }).catch((err) => {
    console.error('Font loading failed:', err);
    // Try anyway with fallback
    generateLetterOutlineInternal(text, fontFamily, size);
  });
}

function generateLetterOutlineInternal(text, fontFamily, size) {
  
  // First pass: measure each letter to calculate actual widths and total width
  let tempCanvas = document.createElement('canvas');
  let tempCtx = tempCanvas.getContext('2d');
  tempCtx.font = `bold ${size}px ${fontFamily}`;
  
  let letterWidths = [];
  let totalWidth = 0;
  for (let i = 0; i < text.length; i++) {
    let metrics = tempCtx.measureText(text.charAt(i));
    let width = metrics.width;
    letterWidths.push(width);
    totalWidth += width;
  }
  
  // Add small spacing between letters (10% of average width)
  let spacing = (totalWidth / text.length) * 0.15;
  totalWidth += spacing * (text.length - 1);
  
  // Calculate starting position to center the text
  let currentX = -totalWidth / 2;
  
  // Generate each letter
  for (let charIndex = 0; charIndex < text.length; charIndex++) {
    let letter = text.charAt(charIndex);
    let letterWidth = letterWidths[charIndex];
    let offsetX = currentX + letterWidth / 2; // Center of current letter
    
    // Create offscreen canvas to extract letter path
    let offscreen = document.createElement('canvas');
    let ctx = offscreen.getContext('2d');
    
    // Set canvas size (needs to be large enough for the letter)
    offscreen.width = size * 3;
    offscreen.height = size * 3;
    
    // Clear canvas
    ctx.clearRect(0, 0, offscreen.width, offscreen.height);
    
    // Disable antialiasing for sharp edges
    ctx.imageSmoothingEnabled = false;
    
    // Set font and measure text
    ctx.font = `bold ${size}px ${fontFamily}`;
    console.log('Canvas font set to:', ctx.font);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    let metrics = ctx.measureText(letter);
    console.log('Text metrics:', metrics);
    
    // Draw letter filled (sharp edges for better contour tracing)
    ctx.fillStyle = '#ffffff';
    ctx.fillText(letter, offscreen.width / 2, offscreen.height / 2);
    
    // Get image data to extract contour points
    let imageData = ctx.getImageData(0, 0, offscreen.width, offscreen.height);
    let points = extractContourPoints(imageData, offscreen.width, offscreen.height);
    
    if (points.length < 3) {
      console.error('Failed to extract enough contour points from letter:', letter);
      continue; // Skip this letter and continue with next
    }
    
    console.log(`Extracted ${points.length} contour points for letter "${letter}"`);
    
    // Convert 2D contour points to 3D tube format
    // Use a scaling factor that preserves the actual letter size relative to the font size
    let scaleFactor = 1.0; // Use 1:1 mapping from canvas pixels to 3D units
    let centerX = offscreen.width / 2;
    let centerY = offscreen.height / 2;
    
    // For speed mode: calculate the centroid of the letter
    let centroidX = 0, centroidY = 0;
    for (let pt of points) {
      centroidX += pt.x;
      centroidY += pt.y;
    }
    centroidX /= points.length;
    centroidY /= points.length;
    
    // Find max distance from centroid for normalization
    let maxDist = 0;
    for (let pt of points) {
      let d = dist(pt.x, pt.y, centroidX, centroidY);
      if (d > maxDist) maxDist = d;
    }
    
    let tube = [];
    for (let i = 0; i < points.length; i++) {
      let pt = points[i];
      // Convert from canvas coords to 3D coords
      // Canvas: +X right, +Y down
      // 3D: +X right, +Y down (keep same orientation)
      let x = (pt.x - centerX) * scaleFactor + offsetX; // Add horizontal offset for letter position
      let y = (pt.y - centerY) * scaleFactor; // Same direction as canvas
      
      // Apply Z-depth based on position along the contour for spatial effect
      // Use zDepthAmplitude to create depth variation
      let t = i / points.length; // 0 to 1 progress along contour
      let z = 0;
      
      if (zMode === "speed") {
        // Speed mode: distance from centroid = "speed"
        // Points near center = slow (backward), points at edge = fast (forward)
        let distFromCenter = dist(pt.x, pt.y, centroidX, centroidY);
        let normalizedDist = maxDist > 0 ? distFromCenter / maxDist : 0; // 0 to 1
        // Map: center (0) -> back (-zDepthAmplitude), edge (1) -> front (0)
        z = -(1 - normalizedDist) * zDepthAmplitude;
      } else if (zMode === "wave") {
        // Wave pattern along the letter outline
        z = sin(t * TWO_PI * 2) * zDepthAmplitude * 0.5;
      } else if (zMode === "linear") {
        // Linear depth from back to front
        z = map(t, 0, 1, -zDepthAmplitude * 0.5, zDepthAmplitude * 0.5);
      } else if (zMode === "linear-back") {
        // Linear depth from front to back
        z = map(t, 0, 1, zDepthAmplitude * 0.5, -zDepthAmplitude * 0.5);
      } else {
        // Static mode: flat letter at z=0
        z = 0;
      }
      
      tube.push(createVector(x, y, z));
    }
    
    // Close the path if not already closed
    if (tube.length > 0) {
      let first = tube[0];
      let last = tube[tube.length - 1];
      let closeDist = dist(first.x, first.y, first.z, last.x, last.y, last.z);
      if (closeDist > basePixelSize * 0.5) {
        tube.push(createVector(first.x, first.y, first.z));
      }
    }
    
    // Only add if we have enough points
    if (tube.length >= 3) {
      // Add to tubes array - it will be drawn with the current brush type automatically
      tubes.push(tube);
      console.log(`Letter "${letter}" outline added successfully`);
    }
    
    // Move to next letter position
    currentX += letterWidth + spacing;
  } // End of for loop over characters
  
  // Save to history once after all letters are generated
  if (text.length > 0) {
    saveToHistory();
    console.log('Text outline added to drawing successfully with current brush:', brushType);
    
    // Update preview
    updatePreview();
  }
}

/**
 * Extract ALL contour points from letter image data (including holes/punches)
 * @param {ImageData} imageData - Canvas image data
 * @param {number} width - Canvas width
 * @param {number} height - Canvas height
 * @returns {Array} Array of contours, where each contour is an array of {x, y} points
 */
function extractAllContours(imageData, width, height) {
  let pixels = imageData.data;
  
  // Create a visited map to track which edge pixels we've already traced
  let visited = new Array(width * height).fill(false);
  
  // Function to check if a pixel is filled
  function isFilled(x, y) {
    if (x < 0 || x >= width || y < 0 || y >= height) return false;
    let idx = (y * width + x) * 4;
    return pixels[idx + 3] > 128;
  }
  
  // Function to check if a pixel is an edge pixel
  function isEdge(x, y) {
    if (!isFilled(x, y)) return false;
    
    // Check if any neighbor is empty
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        if (!isFilled(x + dx, y + dy)) return true;
      }
    }
    return false;
  }
  
  // Find all edge pixels
  let edgePixels = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (isEdge(x, y)) {
        edgePixels.push({x, y});
      }
    }
  }
  
  if (edgePixels.length === 0) return [];
  
  // 8-directional neighbors (clockwise)
  let directions = [
    {x: 1, y: 0},   // right
    {x: 1, y: 1},   // down-right
    {x: 0, y: 1},   // down
    {x: -1, y: 1},  // down-left
    {x: -1, y: 0},  // left
    {x: -1, y: -1}, // up-left
    {x: 0, y: -1},  // up
    {x: 1, y: -1}   // up-right
  ];
  
  // Trace contours starting from unvisited edge pixels
  let allContours = [];
  
  for (let startPixel of edgePixels) {
    let startIdx = startPixel.y * width + startPixel.x;
    
    // Skip if already visited
    if (visited[startIdx]) continue;
    
    // Start tracing this contour
    let contour = [];
    let current = startPixel;
    let direction = 0;
    let maxSteps = Math.min(width * height, 50000); // Limit to prevent infinite loops
    let steps = 0;
    
    do {
      let idx = current.y * width + current.x;
      visited[idx] = true;
      contour.push({x: current.x, y: current.y});
      
      // Find next boundary pixel
      let found = false;
      let searchDir = (direction + 6) % 8; // Start searching from left
      
      for (let i = 0; i < 8; i++) {
        let checkDir = (searchDir + i) % 8;
        let dx = directions[checkDir].x;
        let dy = directions[checkDir].y;
        let nx = current.x + dx;
        let ny = current.y + dy;
        
        if (isEdge(nx, ny)) {
          current = {x: nx, y: ny};
          direction = checkDir;
          found = true;
          break;
        }
      }
      
      if (!found) break;
      steps++;
      
    } while ((current.x !== startPixel.x || current.y !== startPixel.y) && steps < maxSteps);
    
    // Simplify contour
    if (contour.length > 0) {
      let simplified = [contour[0]];
      
      for (let i = 1; i < contour.length; i++) {
        let prev = simplified[simplified.length - 1];
        let curr = contour[i];
        let d = Math.hypot(curr.x - prev.x, curr.y - prev.y);
        
        if (d > 3) { // Slightly more aggressive than 2, but not as much as 4
          simplified.push(curr);
        }
      }
      
      if (simplified.length >= 3) {
        allContours.push(simplified);
      }
    }
  }
  
  return allContours;
}

/**
 * Extract contour points from letter image data (DEPRECATED - use extractAllContours instead)
 * @param {ImageData} imageData - Canvas image data
 * @param {number} width - Canvas width
 * @param {number} height - Canvas height
 * @returns {Array} Array of {x, y} points along the contour
 */
function extractContourPoints(imageData, width, height) {
  let pixels = imageData.data;
  
  // Find the starting point (leftmost pixel of topmost row with content)
  let startPoint = null;
  
  for (let y = 0; y < height && !startPoint; y++) {
    for (let x = 0; x < width; x++) {
      let idx = (y * width + x) * 4;
      let alpha = pixels[idx + 3];
      
      if (alpha > 128) {
        // Found pixel, now find the edge by checking if it has transparent neighbors
        let isEdge = false;
        for (let dy = -1; dy <= 1 && !isEdge; dy++) {
          for (let dx = -1; dx <= 1 && !isEdge; dx++) {
            if (dx === 0 && dy === 0) continue;
            let nx = x + dx;
            let ny = y + dy;
            if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
              let nIdx = (ny * width + nx) * 4;
              if (pixels[nIdx + 3] < 128) {
                isEdge = true;
                startPoint = {x, y};
              }
            }
          }
        }
      }
    }
  }
  
  if (!startPoint) return [];
  
  // Trace the contour using Moore neighborhood tracing
  let contour = [];
  let current = startPoint;
  let direction = 0; // Start facing right
  
  // 8-directional neighbors (clockwise): right, down-right, down, down-left, left, up-left, up, up-right
  let directions = [
    {x: 1, y: 0},   // right
    {x: 1, y: 1},   // down-right
    {x: 0, y: 1},   // down
    {x: -1, y: 1},  // down-left
    {x: -1, y: 0},  // left
    {x: -1, y: -1}, // up-left
    {x: 0, y: -1},  // up
    {x: 1, y: -1}   // up-right
  ];
  
  let maxSteps = width * height; // Prevent infinite loops
  let steps = 0;
  
  do {
    contour.push({x: current.x, y: current.y});
    
    // Find next boundary pixel
    let found = false;
    let searchDir = (direction + 6) % 8; // Start searching from left direction
    
    for (let i = 0; i < 8; i++) {
      let checkDir = (searchDir + i) % 8;
      let dx = directions[checkDir].x;
      let dy = directions[checkDir].y;
      let nx = current.x + dx;
      let ny = current.y + dy;
      
      if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
        let idx = (ny * width + nx) * 4;
        let alpha = pixels[idx + 3];
        
        if (alpha > 128) { // Found next pixel on boundary
          current = {x: nx, y: ny};
          direction = checkDir;
          found = true;
          break;
        }
      }
    }
    
    if (!found) break;
    steps++;
    
  } while ((current.x !== startPoint.x || current.y !== startPoint.y) && steps < maxSteps);
  
  // Simplify contour - remove points that are too close together
  let simplified = [];
  if (contour.length > 0) {
    simplified.push(contour[0]);
    
    for (let i = 1; i < contour.length; i++) {
      let prev = simplified[simplified.length - 1];
      let curr = contour[i];
      let dist = Math.hypot(curr.x - prev.x, curr.y - prev.y);
      
      if (dist > 2) { // Only add point if it's far enough from previous
        simplified.push(curr);
      }
    }
  }
  
  return simplified;
}

// Trackpad/mouse wheel zoom support
function mouseWheel(event) {
  // Check if mouse is over the config panel
  let configPanel = document.getElementById('cubeConfigPanel');
  if (configPanel) {
    let rect = configPanel.getBoundingClientRect();
    if (mouseX >= rect.left && mouseX <= rect.right && 
        mouseY >= rect.top && mouseY <= rect.bottom) {
      // Allow normal scrolling in the panel
      return true;
    }
  }
  
  // Allow zoom even when paused (only when not over config panel)
  let delta = event.delta;
  let zoomChange = delta > 0 ? 0.9 : 1.1; // Zoom out/in
  
  let newZoom = voxelZoom * zoomChange;
  newZoom = constrain(newZoom, 0.2, 5.0);
  
  voxelZoom = newZoom;
  
  // Update on-canvas slider
  let onCanvasZoomSlider = document.getElementById('onCanvasZoomSlider');
  let zoomDisplay = document.getElementById('zoomDisplay');
  
  if (onCanvasZoomSlider) {
    onCanvasZoomSlider.value = newZoom;
  }
  
  if (zoomDisplay) {
    zoomDisplay.textContent = newZoom.toFixed(1) + 'x';
  }
  
  // Prevent page scroll only when zooming
  return false;
}

// ===== WEINGART CUBES ACTIVATION =====

function activateWeingartMode() {
  // Toggle weingart mode
  weingartActive = !weingartActive;
  
  // Update button text
  let btn = document.getElementById('activateWeingartBtn');
  if (btn) {
    btn.textContent = weingartActive ? 'Deactivate Weingart Cubes' : 'Activate Weingart Cubes';
    btn.style.background = weingartActive ? '#6b5e54' : '#8B7E74';
  }
}

// Make globally accessible
window.activateWeingartMode = activateWeingartMode;






