function getCanvas() {
    return document.getElementById('canvas') || document.getElementById('imageCanvas');
}

// Global variables for distortion effect
let currentImageData = null;
let originalImageData = null;
let sourceGrid = []; // Grid for perfect rectangles
let distortedGrid = []; // Grid for distorted quadrilaterals
let sharedVertices = []; // Shared vertex positions for continuity
let fixedVertices = null;
let animationId = null;
let time = 0;
let showGrid = false; // Toggle for grid visualization

// Distortion parameters
let gridSize = 150; // Size of each grid cell (larger for visible effect)
let keepGridFixed = false; // Whether the grid remains static while still rendering the current image
const DISTORTION_STRENGTH = 7; // How much edges can "tear"
const FLOW_SPEED = 0.04; // Animation speed
const RAMP_UP_DURATION = 1.0; // How long to reach full distortion

// Initialize the distortion effect
function initializeEffect() {
    // Get the canvas element and its 2D context
    const canvas = getCanvas();
    const ctx = canvas.getContext('2d');
    const hiddenImage = document.getElementById('warp-image');

    if (!hiddenImage) {
        console.error('Hidden image element not found');
        ctx.fillStyle = '#ff0000';
        ctx.font = '20px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Missing hidden image', canvas.width / 2, canvas.height / 2);
        return;
    }

    // Use the hidden HTML element as the image source
    const image = hiddenImage;

    // Set up the onload event handler
    if (image.complete && image.naturalWidth > 0) {
        loadAndDisplayImage(image);
        return;
    }

    image.onload = function() {
        loadAndDisplayImage(image);
    };

    // Set up error handler
    image.onerror = function() {
        console.error('Failed to load image');

        // Display error message on canvas
        ctx.fillStyle = '#ff0000';
        ctx.font = '20px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Failed to load image.png', canvas.width / 2, canvas.height / 2);
    };
}

// Shared function to load and display an image
function loadAndDisplayImage(image) {
    const canvas = getCanvas();
    const ctx = canvas.getContext('2d');

    canvas.width = image.width;
    canvas.height = image.height;

    // Clear the canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw the image at its native size
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

    // Store the original image data for distortion
    originalImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    currentImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    // Initialize grids
    initializeGrids(canvas.width, canvas.height);

    // Start the paint mixing animation
    startPaintMixingEffect();

    console.log('Image loaded and grid-based melting effect started');
    console.log(`Original image size: ${image.width} x ${image.height}`);
    console.log(`Canvas size: ${canvas.width} x ${canvas.height}`);
}

// Initialize both grids: source and distorted with shared vertices
function initializeGrids(width, height) {
    sourceGrid = [];
    distortedGrid = [];
    sharedVertices = [];
    
    const gridCols = Math.ceil(width / gridSize);
    const gridRows = Math.ceil(height / gridSize);
    
    // Create shared vertex grid - each vertex is shared by up to 4 boxes
    for (let row = 0; row <= gridRows; row++) {
        sharedVertices[row] = [];
        for (let col = 0; col <= gridCols; col++) {
            const x = Math.min(col * gridSize, width);
            const y = Math.min(row * gridSize, height);
            const randomOffsetX = (Math.random() - 0.5) * DISTORTION_STRENGTH * 2;
            const randomOffsetY = (Math.random() - 0.5) * DISTORTION_STRENGTH * 2;
            
            sharedVertices[row][col] = {
                originalX: x,
                originalY: y,
                currentX: x + randomOffsetX,
                currentY: y + randomOffsetY,
                phase: Math.random() * Math.PI * 2,
                frequency: 0.5 + Math.random() * 0.5
            };
        }
    }
    
    // Create source grid using shared vertices
    for (let row = 0; row < gridRows; row++) {
        sourceGrid[row] = [];
        distortedGrid[row] = [];
        
        for (let col = 0; col < gridCols; col++) {
            // Source - references to shared vertices
            sourceGrid[row][col] = {
                topLeft: sharedVertices[row][col],
                topRight: sharedVertices[row][col + 1],
                bottomLeft: sharedVertices[row + 1][col],
                bottomRight: sharedVertices[row + 1][col + 1]
            };
            
            // Distorted - also references the same shared vertices
            distortedGrid[row][col] = {
                topLeft: sharedVertices[row][col],
                topRight: sharedVertices[row][col + 1],
                bottomLeft: sharedVertices[row + 1][col],
                bottomRight: sharedVertices[row + 1][col + 1]
            };
        }
    }

    if (keepGridFixed) {
        fixedVertices = sharedVertices.map(row => row.map(vertex => ({
            currentX: vertex.currentX,
            currentY: vertex.currentY,
            originalX: vertex.originalX,
            originalY: vertex.originalY
        })));
    }
}

// Update the shared vertices with distortion
function updateDistortedGrid(width, height) {    
 
    const gridCols = Math.ceil(width / gridSize);
    const gridRows = Math.ceil(height / gridSize);
    
    // Gradual ramp-up effect
    const rampUpFactor = Math.min(1.0, time / RAMP_UP_DURATION);
    const smoothRamp = rampUpFactor * rampUpFactor * (3 - 2 * rampUpFactor);
    
    // Update each shared vertex position
    for (let row = 0; row <= gridRows; row++) {
        for (let col = 0; col <= gridCols; col++) {
            const vertex = sharedVertices[row][col];

            if (keepGridFixed) {
                if (fixedVertices && fixedVertices[row] && fixedVertices[row][col]) {
                    vertex.currentX = fixedVertices[row][col].currentX;
                    vertex.currentY = fixedVertices[row][col].currentY;
                }
                continue;
            }
            
            // Calculate distortion for this vertex based on its position and time
            const timePhase = time * vertex.frequency + vertex.phase;
            const strength = DISTORTION_STRENGTH * smoothRamp;
            
            // Add some spatial variation based on vertex position
            const spatialPhase = (row * 0.3 + col * 0.7) * Math.PI;
            
            const offsetX = Math.sin(timePhase + spatialPhase) * strength;
            const offsetY = Math.cos(timePhase * 1.1 + spatialPhase * 0.8) * strength;
            
            // Apply distortion to vertex
            vertex.currentX = vertex.originalX + offsetX;
            vertex.currentY = vertex.originalY + offsetY;
        }
    }
}

// Start the paint mixing animation
function startPaintMixingEffect() {
    const canvas = getCanvas();
    const ctx = canvas.getContext('2d');
    
    if (!currentImageData) return;
    
    // Reset time when starting
    time = 0;
    
    function animate() {
        time += FLOW_SPEED;
        
        // Update the distorted grid E
        updateDistortedGrid(canvas.width, canvas.height);
        
        // Render the image using grid mapping
        renderGridDistortion(ctx, canvas.width, canvas.height);
        
        animationId = requestAnimationFrame(animate);
    }
    
    animate();
}

// Render the image by mapping source grid to distorted grid
function renderGridDistortion(ctx, width, height) {
    const sourceImageData = currentImageData;

    // Start with the current image as base - never create white pixels
    const newImageData = new ImageData(
        new Uint8ClampedArray(sourceImageData.data),
        width,
        height
    );
    const newData = newImageData.data;
    
    const gridCols = Math.ceil(width / gridSize);
    const gridRows = Math.ceil(height / gridSize);
    
    // Map each grid cell using the shared vertices (which ensure continuity)
    for (let row = 0; row < gridRows; row++) {
        for (let col = 0; col < gridCols; col++) {
            const source = sourceGrid[row][col];
            
            // Get the current positions of the shared vertices
            const topLeft = sharedVertices[row][col];
            const topRight = sharedVertices[row][col + 1];
            const bottomLeft = sharedVertices[row + 1][col];
            const bottomRight = sharedVertices[row + 1][col + 1];
            
            // Create distorted cell using shared vertex positions
            const distorted = {
                topLeft: { x: topLeft.currentX, y: topLeft.currentY },
                topRight: { x: topRight.currentX, y: topRight.currentY },
                bottomLeft: { x: bottomLeft.currentX, y: bottomLeft.currentY },
                bottomRight: { x: bottomRight.currentX, y: bottomRight.currentY }
            };
            
            mapGridCellPixels(source, distorted, sourceImageData.data, newData, width, height);
        }
    }
    
    // Apply the new image data
    ctx.putImageData(newImageData, 0, 0);
    
    // Draw grid overlay if enabled
    if (showGrid) {
        drawGridOverlay(ctx, width, height);
    }
    
    // Update current image data for next iteration
    currentImageData = newImageData;
}

// Draw the distortion grid overlay
function drawGridOverlay(ctx, width, height) {
    const gridCols = Math.ceil(width / gridSize);
    const gridRows = Math.ceil(height / gridSize);
    
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 2]); // Dashed line
    
    // Draw distorted grid using shared vertices
    for (let row = 0; row < gridRows; row++) {
        for (let col = 0; col < gridCols; col++) {
            // Get the current positions of the shared vertices
            const topLeft = sharedVertices[row][col];
            const topRight = sharedVertices[row][col + 1];
            const bottomLeft = sharedVertices[row + 1][col];
            const bottomRight = sharedVertices[row + 1][col + 1];
            
            ctx.beginPath();
            // Draw the quadrilateral using shared vertex positions
            ctx.moveTo(topLeft.currentX, topLeft.currentY);
            ctx.lineTo(topRight.currentX, topRight.currentY);
            ctx.lineTo(bottomRight.currentX, bottomRight.currentY);
            ctx.lineTo(bottomLeft.currentX, bottomLeft.currentY);
            ctx.closePath();
            ctx.stroke();
        }
    }
    
    ctx.setLineDash([]); // Reset line dash
}

// Toggle grid visualization
function toggleGrid() {
    showGrid = !showGrid;
    const button = document.getElementById('toggle-grid');
    if (button) {
        button.textContent = showGrid ? 'Hide Grid' : 'Show Grid';
    }
}

function syncUiFromState() {
    const gridSizeInput = document.getElementById('grid-size');
    const keepGridFixedInput = document.getElementById('keep-grid-fixed');
    const toggleGridButton = document.getElementById('toggle-grid');

    if (gridSizeInput) gridSizeInput.value = String(gridSize);
    if (keepGridFixedInput) keepGridFixedInput.checked = keepGridFixed;
    if (toggleGridButton) toggleGridButton.textContent = showGrid ? 'Hide Grid' : 'Show Grid';
}

// Bilinear interpolation helper function
function bilinearInterpolate(topLeft, topRight, bottomLeft, bottomRight, u, v) {
    const top = topLeft * (1 - u) + topRight * u;
    const bottom = bottomLeft * (1 - u) + bottomRight * u;
    return top * (1 - v) + bottom * v;
}

// Map pixels from source rectangle to distorted quadrilateral
function mapGridCellPixels(source, distorted, sourceData, targetData, width, height) {
    // Extract coordinates from vertex objects
    const sourceWidth = source.topRight.originalX - source.topLeft.originalX;
    const sourceHeight = source.bottomLeft.originalY - source.topLeft.originalY;
    
    if (sourceWidth <= 0 || sourceHeight <= 0) return;
    
    // Sample points within the source rectangle and map them to the distorted quad
    const sampleDensity = 1;
    
    for (let sy = 0; sy < sourceHeight; sy += sampleDensity) {
        for (let sx = 0; sx < sourceWidth; sx += sampleDensity) {
            // Source coordinates
            const srcX = source.topLeft.originalX + sx;
            const srcY = source.topLeft.originalY + sy;
            
            if (srcX >= width || srcY >= height || srcX < 0 || srcY < 0) continue;
            
            // Normalized coordinates within the source rectangle (0-1)
            const u = sx / sourceWidth;
            const v = sy / sourceHeight;
            
            // Bilinear interpolation to find corresponding point in distorted quad
            const destX = bilinearInterpolate(
                distorted.topLeft.x, distorted.topRight.x,
                distorted.bottomLeft.x, distorted.bottomRight.x,
                u, v
            );
            
            const destY = bilinearInterpolate(
                distorted.topLeft.y, distorted.topRight.y,
                distorted.bottomLeft.y, distorted.bottomRight.y,
                u, v
            );
            
            // Round to pixel coordinates
            const targetX = Math.round(destX);
            const targetY = Math.round(destY);
            
            if (targetX >= 0 && targetX < width && targetY >= 0 && targetY < height) {
                // Get source pixel
                const sourceIndex = (Math.floor(srcY) * width + Math.floor(srcX)) * 4;
                const targetIndex = (targetY * width + targetX) * 4;
                
                // Apply the full remapped value from the previous image so a static grid
                // still produces progressive deformation when the image is re-warped each frame.
                targetData[targetIndex] = sourceData[sourceIndex];
                targetData[targetIndex + 1] = sourceData[sourceIndex + 1];
                targetData[targetIndex + 2] = sourceData[sourceIndex + 2];
                // Keep original alpha
                targetData[targetIndex + 3] = sourceData[sourceIndex + 3];
            }
        }
    }
}

// Stop the animation
function stopPaintMixingEffect() {
    if (animationId) {
        cancelAnimationFrame(animationId);
        animationId = null;
    }
}

// Reset to original image
function resetImage() {
    const canvas = getCanvas();
    const ctx = canvas.getContext('2d');
    
    stopPaintMixingEffect();
    
    if (originalImageData) {
        // Reset both current and displayed image to original
        currentImageData = new ImageData(
            new Uint8ClampedArray(originalImageData.data),
            originalImageData.width,
            originalImageData.height
        );
        
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.putImageData(originalImageData, 0, 0);
    }
}

const restartButton = document.getElementById('restart');
restartButton?.addEventListener('click', () => {
    stopPaintMixingEffect();
    startPaintMixingEffect();
});

const pauseButton = document.getElementById('pause');
pauseButton?.addEventListener('click', () => {
    if (pauseButton.dataset.paused === 'true') {
        pauseButton.dataset.paused = 'false';
        pauseButton.textContent = 'Pause';
        startPaintMixingEffect();
    } else {
        pauseButton.dataset.paused = 'true';
        pauseButton.textContent = 'Resume';
        stopPaintMixingEffect();
    }
});

const gridSizeInput = document.getElementById('grid-size');
gridSizeInput?.addEventListener('input', () => {
    const nextSize = Number(gridSizeInput.value);
    if (!Number.isFinite(nextSize) || nextSize <= 0) return;
    gridSize = Math.min(Math.max(nextSize, 10), 200);
    if (originalImageData) {
        initializeGrids(originalImageData.width, originalImageData.height);
    }
});

const keepGridFixedInput = document.getElementById('keep-grid-fixed');
keepGridFixedInput?.addEventListener('change', () => {
    keepGridFixed = keepGridFixedInput.checked;
    if (keepGridFixed) {
        fixedVertices = sharedVertices.map(row => row.map(vertex => ({
            currentX: vertex.currentX,
            currentY: vertex.currentY,
            originalX: vertex.originalX,
            originalY: vertex.originalY
        })));
    } else {
        fixedVertices = null;
    }
});

document.getElementById('reset')?.addEventListener('click', resetImage);
document.getElementById('toggle-grid')?.addEventListener('click', toggleGrid);

// Keep the controls in sync with the real state at startup.
document.addEventListener('DOMContentLoaded', () => {
    syncUiFromState();
    initializeEffect();
});
