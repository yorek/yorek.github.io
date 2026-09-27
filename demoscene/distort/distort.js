function getCanvas() {
    return document.getElementById('canvas') || document.getElementById('imageCanvas');
}

// Global variables for distortion effect
let currentImageData = null;
let originalImageData = null;
let sourceGrid = []; // Grid for perfect rectangles
let distortedGrid = []; // Grid for distorted quadrilaterals
let sharedVertices = []; // Shared vertex positions for continuity
let animationId = null;
let time = 0;
let showGrid = false; // Toggle for grid visualization

// Distortion parameters
const GRID_SIZE = 50; // Size of each grid cell (larger for visible effect)
const DISTORTION_STRENGTH = 7; // How much edges can "tear"
const FLOW_SPEED = 0.04; // Animation speed
const RAMP_UP_DURATION = 1.0; // How long to reach full distortion

let file = "images/warpmap.jpg";

// Initialize the distortion effect
function initializeEffect() {
    // Get the canvas element and its 2D context
    const canvas = getCanvas();
    const ctx = canvas.getContext('2d');
    
    // Create a new image object
    const image = new Image();
    
    // Set up the onload event handler
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
    
    // Start loading the image
    image.src = file;
}

// Shared function to load and display an image
function loadAndDisplayImage(image) {
    const canvas = getCanvas();
    const ctx = canvas.getContext('2d');
    
    // Clear the canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Scale image to completely fill canvas (crop if necessary to avoid white areas)
    const canvasAspect = canvas.width / canvas.height;
    const imageAspect = image.width / image.height;
    
    let drawWidth, drawHeight, drawX, drawY;
    
    if (imageAspect > canvasAspect) {
        // Image is wider - scale to fill height, crop width
        drawHeight = canvas.height;
        drawWidth = canvas.height * imageAspect;
        drawX = (canvas.width - drawWidth) / 2;
        drawY = 0;
    } else {
        // Image is taller - scale to fill width, crop height
        drawWidth = canvas.width;
        drawHeight = canvas.width / imageAspect;
        drawX = 0;
        drawY = (canvas.height - drawHeight) / 2;
    }
    
    // Draw the image on the canvas - this will fill the entire canvas
    ctx.drawImage(image, drawX, drawY, drawWidth, drawHeight);
    
    // Store the original image data for distortion
    originalImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    currentImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    
    // Initialize grids
    initializeGrids(canvas.width, canvas.height);
    
    // Start the paint mixing animation
    startPaintMixingEffect();
    
    console.log('Image loaded and grid-based melting effect started');
    console.log(`Original image size: ${image.width} x ${image.height}`);
    console.log(`Display size: ${drawWidth} x ${drawHeight}`);
}

// Initialize both grids: source and distorted with shared vertices
function initializeGrids(width, height) {
    sourceGrid = [];
    distortedGrid = [];
    sharedVertices = [];
    
    const gridCols = Math.ceil(width / GRID_SIZE);
    const gridRows = Math.ceil(height / GRID_SIZE);
    
    // Create shared vertex grid - each vertex is shared by up to 4 boxes
    for (let row = 0; row <= gridRows; row++) {
        sharedVertices[row] = [];
        for (let col = 0; col <= gridCols; col++) {
            const x = Math.min(col * GRID_SIZE, width);
            const y = Math.min(row * GRID_SIZE, height);
            
            sharedVertices[row][col] = {
                originalX: x,
                originalY: y,
                currentX: x,
                currentY: y,
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
}

// Update the shared vertices with distortion
function updateDistortedGrid(width, height) {    
 
    const gridCols = Math.ceil(width / GRID_SIZE);
    const gridRows = Math.ceil(height / GRID_SIZE);
    
    // Gradual ramp-up effect
    const rampUpFactor = Math.min(1.0, time / RAMP_UP_DURATION);
    const smoothRamp = rampUpFactor * rampUpFactor * (3 - 2 * rampUpFactor);
    
    // Update each shared vertex position
    for (let row = 0; row <= gridRows; row++) {
        for (let col = 0; col <= gridCols; col++) {
            const vertex = sharedVertices[row][col];
            
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
    // Start with the current image as base - never create white pixels
    const newImageData = new ImageData(
        new Uint8ClampedArray(currentImageData.data),
        width,
        height
    );
    const newData = newImageData.data;
    
    const gridCols = Math.ceil(width / GRID_SIZE);
    const gridRows = Math.ceil(height / GRID_SIZE);
    
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
            
            mapGridCellPixels(source, distorted, currentImageData.data, newData, width, height);
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
    const gridCols = Math.ceil(width / GRID_SIZE);
    const gridRows = Math.ceil(height / GRID_SIZE);
    
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
    const sampleDensity = 1; // Reduced for better performance
    
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
                
                // Always blend colors - never create white pixels
                const blendFactor = 0.4; // Gentle blending
                
                targetData[targetIndex] = Math.round(
                    targetData[targetIndex] * (1 - blendFactor) + sourceData[sourceIndex] * blendFactor
                );
                targetData[targetIndex + 1] = Math.round(
                    targetData[targetIndex + 1] * (1 - blendFactor) + sourceData[sourceIndex + 1] * blendFactor
                );
                targetData[targetIndex + 2] = Math.round(
                    targetData[targetIndex + 2] * (1 - blendFactor) + sourceData[sourceIndex + 2] * blendFactor
                );
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

document.getElementById('reset')?.addEventListener('click', resetImage);
document.getElementById('toggle-grid')?.addEventListener('click', toggleGrid);

// Wait for the DOM to be fully loaded
document.addEventListener('DOMContentLoaded', () => initializeEffect());
