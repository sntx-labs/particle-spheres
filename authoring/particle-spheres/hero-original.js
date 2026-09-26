import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'; 
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'; 
import GUI from 'lil-gui';
import lottie from 'lottie-web/build/player/lottie_light.js';

const eyeContainer = document.querySelector('[data-eye-animation]');
if (eyeContainer) {
     const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
     const eyeAnimation = lottie.loadAnimation({
          container: eyeContainer,
          renderer: 'svg',
          loop: false,
          autoplay: !prefersReducedMotion.matches,
          path: '/documents/lf30_editor_1yk6gtfn.json',
          rendererSettings: {
               preserveAspectRatio: 'xMidYMid meet',
          },
     });

     if (prefersReducedMotion.matches) {
          eyeAnimation.addEventListener('DOMLoaded', () => eyeAnimation.goToAndStop(59, true));
     } else {
          eyeContainer.closest('.identity-mark')?.addEventListener('pointerenter', () => {
               eyeAnimation.goToAndPlay(0, true);
          });
     }
}

let spheres = []; // Array to hold multiple sphere data { group, dots }
let normalizedMouseY = 0; // Store normalized Y mouse position (-1 to 1)
let baseCameraZ; // Store the initial camera Z position
let baseFov; // Store the initial vertical FOV
let currentLayoutMode = ''; // New: Track current layout ('horizontal' or 'vertical')

// Shared material for all particles - NOW A TEMPLATE
let baseParticleMaterial = new THREE.MeshBasicMaterial({color: 0x141414});
// Shared material for text - REMOVED
// let textMaterial = new THREE.MeshBasicMaterial({ color: 0xFFFFFF });

// --- Additions for Interactivity ---
// const raycaster = new THREE.Raycaster(); // REMOVE Raycaster
const pointer = new THREE.Vector2(); // Keep for particle interaction
// let clickableTextMeshes = []; // REMOVE - Store meshes that should be interactive
// let intersectedObject = null; // REMOVE - Track the currently hovered object
// const hoverColor = new THREE.Color(0xffffff); // Remove fixed hover color
// --- End Additions ---

// Post-processing pass (defined early for GUI access)
const glowPass = new UnrealBloomPass();

/* --- GUI Removed Start ---
let gui = new GUI();
// Remove absolute positioning - handled by flexbox now
// gui.domElement.style.position = 'absolute';
// gui.domElement.style.right = '10px';
// gui.domElement.style.bottom = '10px';
*/

let settings = {
     distanceAffection : 11.0,
     avoidanceFactor: 21.0,
     avoidRelativeToPivot: true,
     countZAxisDirection: false,
     toggleRotation: true,
     rotationSpeed: 0.0015,
     particleColor: 0x454545,
     particleColorSecondary: 0xffa200,
     colorBlendDistance: 5.0,
     sphereCount: 6,
     sphereRadius: 8.0,
     bloomStrength: 0.55,
     // Add sphere shape controls
     sphereWidthScale: 1.0,
     sphereHeightScale: 1.0,
     navHighlightColor: 0xffffff
}

// Store colors globally for easy access in lerp
let baseColor = new THREE.Color(settings.particleColor);
let secondaryColor = new THREE.Color(settings.particleColorSecondary);
// NO NEED to store navHighlightColor globally unless used elsewhere in JS

// Important: Update initial glowPass strength to match the setting
glowPass.strength = settings.bloomStrength;
// NO LONGER NEEDED here, handled in Dot constructor
// particleMaterial.color.setHex(settings.particleColor);

/* --- GUI Controls Removed Start ---
// --- GUI Controls ---
const particleFolder = gui.addFolder('Particles');
particleFolder.add(settings, 'distanceAffection', 4.0,16.0,1.0);
particleFolder.add(settings, 'avoidanceFactor', -30.0, 100.0, 1.0);
particleFolder.add(settings, 'avoidRelativeToPivot');
particleFolder.add(settings, 'countZAxisDirection');
particleFolder.addColor(settings, 'particleColor').onChange((value) => {
     // Update the global baseColor used for lerping
     baseColor.setHex(value);
});
// Add Secondary Color Control
particleFolder.addColor(settings, 'particleColorSecondary').name('Color Secondary').onChange((value) => {
     // Update the global secondaryColor used for lerping
     secondaryColor.setHex(value);
});
// Add Blend Distance Control
particleFolder.add(settings, 'colorBlendDistance', 0.1, 20.0, 0.1).name('Color Blend Dist');

const sphereFolder = gui.addFolder('Sphere');
sphereFolder.add(settings, 'sphereCount', 1, 20, 1).name('Sphere Count').onChange((value) => { // Added count slider
    // Update spheres using the current layout mode when count changes
    updateSpheres(value, currentLayoutMode);
});
sphereFolder.add(settings, 'sphereRadius', 1.0, 20.0, 0.5).onChange((value) => {
     // Update pivot positions using the new radius and current scales
     updatePivotPositions(value);
});
// Add width and height sliders
sphereFolder.add(settings, 'sphereWidthScale', 0.1, 5.0, 0.1).name('Width Scale').onChange(() => {
     // Update pivot positions using the current radius and new scale
     updatePivotPositions(settings.sphereRadius);
});
sphereFolder.add(settings, 'sphereHeightScale', 0.1, 5.0, 0.1).name('Height Scale').onChange(() => {
     // Update pivot positions using the current radius and new scale
     updatePivotPositions(settings.sphereRadius);
});
sphereFolder.add(settings, 'toggleRotation').onChange((val) => {
     if(val == false){
          spheres.forEach(sphere => sphere.group.rotation.set(0,0,0));
     }
});
sphereFolder.add(settings, 'rotationSpeed', 0.0, 0.1, 0.001);

// Add Navigation folder for highlight control
const navigationFolder = gui.addFolder('Navigation');
navigationFolder.addColor(settings, 'navHighlightColor').name('Highlight Color').onChange((value) => {
    // Convert the number to a hex string
    const newColorHex = '#' + value.toString(16).padStart(6, '0');
    // Update the CSS variable on the root element
    document.documentElement.style.setProperty('--nav-highlight-bg', newColorHex);
});

const effectsFolder = gui.addFolder('Effects');
effectsFolder.add(settings, 'bloomStrength', 0.0, 3.0, 0.1).onChange((value) => {
    glowPass.strength = value;
});
// --- End GUI Controls ---
*/

class Dot{
     constructor(radius,pivot){

          // Create an INDIVIDUAL material instance for this dot
          this.material = baseParticleMaterial.clone();
          // Assign the initial base color
          this.material.color.set(baseColor);

          // Use the individual material
          this.mesh = new THREE.Mesh(new THREE.BoxGeometry(0.1,0.1,1.0), this.material);
          this.pivot = pivot;
          this.isAvoiding = false;
          this.lerpFactor = 0.0;
          this.lerpSpeed = 0.05;
          this.radius = radius;
          this.targetPos = new THREE.Vector3();
     }

     avoidMouse(mousePos){
          
          let dotGlobalPos = new THREE.Vector3();
          let pivotGlobalPos = new THREE.Vector3();
          this.mesh.getWorldPosition(dotGlobalPos);
          this.pivot.getWorldPosition(pivotGlobalPos);

          if(!settings.countZAxisDirection){
               pivotGlobalPos.setZ(0);
          }

          let distance;
          if(settings.avoidRelativeToPivot){
               distance = pivotGlobalPos.distanceTo(mousePos);
          }
          else{
               distance = dotGlobalPos.distanceTo(mousePos);
          }
          
          if(distance < settings.distanceAffection){

               let dir = new THREE.Vector3();
               
               if(settings.avoidRelativeToPivot){
                    dir = new THREE.Vector3(pivotGlobalPos.x-mousePos.x, pivotGlobalPos.y-mousePos.y, pivotGlobalPos.z);
               }
               else{
                    dir = new THREE.Vector3(dotGlobalPos.x-mousePos.x, dotGlobalPos.y-mousePos.y, dotGlobalPos.z);
               }

               dir.normalize();

               this.targetPos.x = dir.x * (settings.avoidanceFactor - this.radius);
               this.targetPos.y = dir.y * (settings.avoidanceFactor - this.radius);

               if(!this.isAvoiding){
                    this.lerpFactor = 0.0;
                    this.isAvoiding = true;
               }
          }
          else{
               if(this.isAvoiding){
                    this.isAvoiding = false;
                    this.lerpFactor = 0.0;
               }
               this.targetPos.copy(new THREE.Vector3());
               
          }
          
     }

     
     controlMovement(){
          this.mesh.position.lerp(this.targetPos, this.lerpFactor);

          if(this.lerpFactor < 1.0){
               this.lerpFactor += this.lerpSpeed;
          }

          // --- Add Color Blending --- 
          const distance = this.mesh.position.length(); // Distance from pivot (resting point)
          const blendFactor = Math.min(distance / settings.colorBlendDistance, 1.0);

          // Use the global baseColor and secondaryColor objects
          this.material.color.lerpColors(baseColor, secondaryColor, blendFactor);
          // --- End Color Blending ---

     }
     
     

}



const scene = new THREE.Scene(); 
const renderer = new THREE.WebGLRenderer();
const canvasContainer = document.getElementById('canvas-container'); // Get container

var cursorPos = new THREE.Vector2();
cursorPos = new THREE.Vector3(1000, 1000, 0);
const particleReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
let particleVisible = true;
let particleActive = false;

// Adjust renderer size to container
renderer.setSize( canvasContainer.clientWidth, canvasContainer.clientHeight );

const camera = new THREE.PerspectiveCamera( 75, canvasContainer.clientWidth / canvasContainer.clientHeight, 0.1, 1000 );
baseCameraZ = camera.position.z = 55; // Set initial Z and store as base
baseFov = camera.fov; // Store the initial FOV

const controls = new OrbitControls(camera, renderer.domElement );
controls.enableRotate = false;
controls.enabled = false;

// Append renderer to the container
canvasContainer.appendChild( renderer.domElement );

const composer = new EffectComposer(renderer);

const renderPass = new RenderPass( scene, camera ); 
composer.addPass( renderPass ); 
composer.addPass( glowPass ); 


canvasContainer.addEventListener("pointermove", onDocumentMouseMove, { passive: true });
canvasContainer.addEventListener("pointerleave", () => {
     particleActive = false;
     cursorPos.set(1000, 1000, 0);
});
function onDocumentMouseMove(event){
     if (particleReducedMotion.matches) return;
     particleActive = true;
     const bounds = canvasContainer.getBoundingClientRect();
     // Calculate normalized screen coordinates first
     const normX = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
     const normY = - ((event.clientY - bounds.top) / bounds.height) * 2 + 1;
     normalizedMouseY = normY; // Store the normalized Y for other effects (like original zoom)

     // Update the pointer vector for raycasting
     pointer.x = normX;
     pointer.y = normY;

     // Then calculate the 3D world position for particle interaction
     var vector = new THREE.Vector3(normX, normY, 0.5);
     vector.unproject( camera );
     var dir = vector.sub( camera.position ).normalize();
     var distance = - camera.position.z / dir.z; // Use current camera Z for projection
     cursorPos = camera.position.clone().add( dir.multiplyScalar( distance ) );

}

// Pointer events cover mouse, pen, and touch without blocking page scrolling.
function onDocumentTouchMove(event){
     if (!event.touches.length) return;

     // Calculate normalized screen coordinates first
     const normX = (event.touches[0].clientX / canvasContainer.clientWidth) * 2 - 1;
     const normY = -(event.touches[0].clientY / canvasContainer.clientHeight) * 2 + 1;
     normalizedMouseY = normY; // Store the normalized Y

     // Then calculate the 3D world position for particle interaction
     var vector = new THREE.Vector3(normX, normY, 0.5);
     vector.unproject( camera );
     var dir = vector.sub( camera.position ).normalize();
     var distance = - camera.position.z / dir.z; // Use current camera Z for projection
     cursorPos = camera.position.clone().add( dir.multiplyScalar( distance ) );

}

let resizeFrame = 0;
window.addEventListener("resize", scheduleViewportResize, { passive: true });

const mobileMaxWidth = 760;

function getLayoutMode(width, height) {
    const aspect = height > 0 ? width / height : 1;
    return width <= mobileMaxWidth || aspect < 0.9 ? 'vertical' : 'horizontal';
}

function scheduleViewportResize() {
    if (resizeFrame) return;
    resizeFrame = requestAnimationFrame(() => {
        resizeFrame = 0;
        onWindowResize();
    });
}

function onWindowResize() {

    // Update based on container size
    const width = canvasContainer.clientWidth;
    const height = canvasContainer.clientHeight;

    if (height === 0) return; // Avoid division by zero

    const currentAspect = width / height;
    camera.aspect = currentAspect;
    camera.fov = baseFov;
    camera.position.z = baseCameraZ;

    camera.updateProjectionMatrix();

    renderer.setSize( width, height );
    composer.setSize( width, height ); // Also update composer size

    // --- Check if layout mode needs to change ---
    const requiredLayoutMode = getLayoutMode(width, height);
    if (requiredLayoutMode !== currentLayoutMode) {
        currentLayoutMode = requiredLayoutMode;
        updateSpheres(settings.sphereCount, currentLayoutMode); // Rebuild layout
    }
    // --- End layout mode check ---
}

// Function to update pivot positions for ALL spheres based on radius and scales
function updatePivotPositions(radius) {
    spheres.forEach(sphere => {
        sphere.group.children.forEach(pivot => {
            if (pivot.userData.direction) {
                // Start with the normalized direction
                const basePosition = pivot.userData.direction.clone();
                // Apply radius
                basePosition.multiplyScalar(radius);
                // Apply width and height scaling
                basePosition.x *= settings.sphereWidthScale;
                basePosition.y *= settings.sphereHeightScale;
                // Z scale could be added if desired (e.g., using width or avg)
                pivot.position.copy(basePosition);
            }
        });
    });
}

// --- Sphere Creation Function ---
function createParticleSphere(positionOffset, initialRadius) {
    const sphereGroup = new THREE.Group();
    sphereGroup.position.copy(positionOffset);
    const dots = [];

    // Use a temporary geometry to get initial directions
    const tempSphereGeometry = new THREE.SphereGeometry(1, 16, 16); // Base radius of 1
    let positionAttribute = tempSphereGeometry.attributes.position;

    for(let i = 0; i < positionAttribute.count; i++){
        const vertex = new THREE.Vector3();
        vertex.fromBufferAttribute(positionAttribute, i);
        const direction = vertex.normalize(); // Normalized direction (length 1)

        let pivot = new THREE.Group();
        pivot.userData.direction = direction.clone(); // Store normalized direction

        // Calculate initial scaled position
        const initialPosition = direction.clone();
        // Apply initial radius
        initialPosition.multiplyScalar(initialRadius);
        // Apply initial width and height scaling from settings
        initialPosition.x *= settings.sphereWidthScale;
        initialPosition.y *= settings.sphereHeightScale;
        // Set initial position based on direction, radius, and scales
        pivot.position.copy(initialPosition);

        let dot = new Dot(10, pivot); // Pass the pivot reference
        dots.push(dot);

        pivot.add(dot.mesh);
        dot.mesh.position.copy(new THREE.Vector3());
        sphereGroup.add(pivot);
    }
    scene.add(sphereGroup);
    return { group: sphereGroup, dots: dots };
}
// --- End Sphere Creation Function ---

// --- Function to Update Sphere Count and Layout ---
// Now accepts layoutMode argument
function updateSpheres(count, layoutMode) {
    // 1. Remove existing spheres
    spheres.forEach(sphere => {
        scene.remove(sphere.group);
        // Consider disposing geometry/material if memory becomes an issue, but start simple
    });
    spheres = []; // Clear the array

    // 2. Create new spheres with distribution based on layoutMode
    const totalSpread = 24;
    const numSpheres = count; // Use argument directly

    for (let i = 0; i < numSpheres; i++) {
        let positionOffset;
        const radius = settings.sphereRadius; // Use the setting directly

        if (layoutMode === 'vertical') {
            // Vertical distribution
            const startY = (numSpheres > 1) ? -totalSpread / 2 : 0; // Center single sphere
            const spacing = (numSpheres > 1) ? totalSpread / (numSpheres - 1) : 0;
            const x = 0;
            const y = startY + i * spacing;
            const z = 0;
            positionOffset = new THREE.Vector3(x, y, z);
        } else { // Default to horizontal
            // Horizontal distribution
            const startX = (numSpheres > 1) ? -totalSpread / 2 : 0; // Center single sphere
            const spacing = (numSpheres > 1) ? totalSpread / (numSpheres - 1) : 0;
            const x = startX + i * spacing;
            const y = 0;
            const z = 0;
            positionOffset = new THREE.Vector3(x, y, z);
        }

        spheres.push(createParticleSphere(positionOffset, radius));
    }
     // Optional: ensure new spheres have correct radius if slider changed before count
     // updatePivotPositions(settings.sphereRadius);
}
// --- End Sphere Update Function ---

// --- Initial Sphere Creation ---
// Determine initial layout mode
currentLayoutMode = getLayoutMode(canvasContainer.clientWidth, canvasContainer.clientHeight);
updateSpheres(settings.sphereCount, currentLayoutMode); // Create initial spheres based on setting and initial mode
onWindowResize();

let lastParticleTime = 0;
function animate(time = 0) {
    const elapsed = lastParticleTime ? Math.min((time - lastParticleTime) / 16.667, 2) : 1;
    lastParticleTime = time;

    // --- Camera Zoom Logic --- (Keep commented out)
    // const zoomAmount = 5; // How much Z position changes (total range is 2 * zoomAmount)
    // const zoomLerpFactor = 0.05; // Smoothing factor (0 to 1)
    // Target Z: baseZ - zoomAmount when mouse is at top (normY=1)
    //           baseZ + zoomAmount when mouse is at bottom (normY=-1)
    // const targetZ = baseCameraZ - (normalizedMouseY * zoomAmount);
    // camera.position.z = THREE.MathUtils.lerp(camera.position.z, targetZ, zoomLerpFactor);
    // --- End Camera Zoom Logic ---

    // Animate each sphere
    spheres.forEach(sphere => {
        if(settings.toggleRotation && !particleReducedMotion.matches){
            const speed = settings.rotationSpeed * elapsed * (particleActive ? 2.5 : 1);
            sphere.group.rotation.x += speed;
            sphere.group.rotation.y += speed * 0.8;
            sphere.group.rotation.z += speed * 0.6;
        }

        // Update dots for this sphere
        sphere.dots.forEach(dot => {
            dot.avoidMouse(cursorPos); // Interaction is still global
            dot.controlMovement();
        });
    });

    // --- Raycasting for Hover Effect --- REMOVE ENTIRE BLOCK
    // raycaster.setFromCamera(pointer, camera);
    // const intersects = raycaster.intersectObjects(clickableTextMeshes);
    // ... rest of raycasting logic ...
    // --- End Raycasting ---

    composer.render();

    controls.update();
} 

function syncParticlePlayback() {
    lastParticleTime = 0;
    const playing = particleVisible && !document.hidden && !document.querySelector('dialog[open]') && !particleReducedMotion.matches;
    renderer.setAnimationLoop(playing ? animate : null);
    if (particleReducedMotion.matches) {
        particleActive = false;
        cursorPos.set(1000, 1000, 0);
        spheres.forEach(sphere => sphere.dots.forEach(dot => {
            dot.mesh.position.set(0, 0, 0);
            dot.targetPos.set(0, 0, 0);
            dot.material.color.copy(baseColor);
        }));
        composer.render();
    }
}
new IntersectionObserver(([entry]) => {
    particleVisible = entry.isIntersecting;
    syncParticlePlayback();
}).observe(canvasContainer);
new ResizeObserver(() => {
    scheduleViewportResize();
    if (particleReducedMotion.matches) requestAnimationFrame(() => composer.render());
}).observe(canvasContainer);
document.querySelectorAll('dialog').forEach(dialog => {
    new MutationObserver(syncParticlePlayback).observe(dialog, { attributes: true, attributeFilter: ['open'] });
});
document.addEventListener('visibilitychange', syncParticlePlayback);
particleReducedMotion.addEventListener('change', syncParticlePlayback);
syncParticlePlayback();

// --- Click Event Listener --- REMOVE ENTIRE BLOCK
// renderer.domElement.addEventListener('click', onClick, false);
// function onClick() {
    // ... click listener logic ...
// }
// --- End Click Event Listener ---

