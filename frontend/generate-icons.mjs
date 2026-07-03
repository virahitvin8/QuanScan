import fs from 'fs';
import { createCanvas } from 'canvas';

const width = 1024;
const height = 1024;
const canvas = createCanvas(width, height);
const ctx = canvas.getContext('2d');

// Draw background (Teal to Violet gradient)
const bgGradient = ctx.createLinearGradient(0, 0, width, height);
bgGradient.addColorStop(0, '#00C2A8'); // Teal
bgGradient.addColorStop(1, '#8C7CFF'); // Violet
ctx.fillStyle = bgGradient;
ctx.fillRect(0, 0, width, height);

// Draw central shape / text
ctx.fillStyle = '#FFFFFF';
ctx.font = 'bold 400px sans-serif';
ctx.textAlign = 'center';
ctx.textBaseline = 'middle';
ctx.fillText('QS', width / 2, height / 2);

// Draw a simple scanner frame around the text
ctx.strokeStyle = '#FFFFFF';
ctx.lineWidth = 40;
ctx.beginPath();
ctx.roundRect(150, 150, width - 300, height - 300, 100);
ctx.stroke();

// Add a green scan line
ctx.fillStyle = '#00FFCC';
ctx.fillRect(200, height / 2 - 10, width - 400, 20);
ctx.shadowColor = '#00FFCC';
ctx.shadowBlur = 50;
ctx.fillRect(200, height / 2 - 10, width - 400, 20);

// Save to PNG
const buffer = canvas.toBuffer('image/png');
fs.writeFileSync('assets/icon.png', buffer);
fs.writeFileSync('assets/splash.png', buffer);
console.log('Icon and splash generated successfully in assets folder.');
