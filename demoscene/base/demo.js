function initializeEffect() {
  const canvas = document.getElementById('canvas');
  const ctx = canvas.getContext('2d');
  
//   const img = new Image();
//   img.src = 'image.png';
//   img.crossOrigin = 'anonymous';
}

// Wait for the DOM to be fully loaded
document.addEventListener('DOMContentLoaded', () => initializeEffect());

// Controls
const restartButton = document.getElementById('restart');
restartButton.addEventListener('click', () => {
  paused = false;
  startDemo();
});

const pauseBtn = document.getElementById('pause');
pauseBtn.addEventListener('click', () => {
  paused = !paused; 
  pauseBtn.textContent = paused ? 'Resume' : 'Pause';
});
