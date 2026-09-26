import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'; 
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'; 

let spheres = []; // Array to hold multiple sphere data { group, dots }
let normalizedMouseY = 0; // Store normalized Y mouse position (-1 to 1)
let baseCameraZ; // Store the initial camera Z position
let baseFov; // Store the initial vertical FOV
let currentLayoutMode = ''; // New: Track current layout ('horizontal' or 'vertical')

let baseParticleMaterial = new THREE.MeshBasicMaterial({color: 0x141414});




const pointer = new THREE.Vector2(); // Keep for particle interaction





const glowPass = new UnrealBloomPass();



let settings = {
     distanceAffection : 11.0,
     avoidanceFactor: 21.0,
     avoidRelativeToPivot: true,
     countZAxisDirection: false,
     toggleRotation: true,
     rotationSpeed: 0.0015,
     particleColor: '#454545',
     particleColorSecondary: '#ffa200',
     colorBlendDistance: 5.0,
     sphereCount: 6,
     sphereRadius: 8.0,
     bloomStrength: 0.55,

     sphereWidthScale: 1.0,
     sphereHeightScale: 1.0,
     spread: 24, cameraDistance: 55, cameraFov: 75
}

let baseColor = new THREE.Color(settings.particleColor);
let secondaryColor = new THREE.Color(settings.particleColorSecondary);


glowPass.strength = settings.bloomStrength;





class Dot{
     constructor(radius,pivot){

          this.material = baseParticleMaterial.clone();

          this.material.color.set(baseColor);

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

          const distance = this.mesh.position.length(); // Distance from pivot (resting point)
          const blendFactor = Math.min(distance / settings.colorBlendDistance, 1.0);

          this.material.color.lerpColors(baseColor, secondaryColor, blendFactor);


     }
     
     

}



const scene = new THREE.Scene(); 
const renderer = new THREE.WebGLRenderer({ antialias: true }); renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
const canvasContainer = document.getElementById('canvas-container'); // Get container

var cursorPos = new THREE.Vector2();
cursorPos = new THREE.Vector3(1000, 1000, 0);
const particleReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
let particleVisible = true;
let particleActive = false;

renderer.setSize( canvasContainer.clientWidth, canvasContainer.clientHeight );

const camera = new THREE.PerspectiveCamera( 75, canvasContainer.clientWidth / canvasContainer.clientHeight, 0.1, 1000 );
baseCameraZ = camera.position.z = 55; // Set initial Z and store as base
baseFov = camera.fov; // Store the initial FOV

const controls = new OrbitControls(camera, renderer.domElement );
controls.enableRotate = false;
controls.enabled = false;

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

     const normX = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
     const normY = - ((event.clientY - bounds.top) / bounds.height) * 2 + 1;
     normalizedMouseY = normY; // Store the normalized Y for other effects (like original zoom)

     pointer.x = normX;
     pointer.y = normY;

     var vector = new THREE.Vector3(normX, normY, 0.5);
     vector.unproject( camera );
     var dir = vector.sub( camera.position ).normalize();
     var distance = - camera.position.z / dir.z; // Use current camera Z for projection
     cursorPos = camera.position.clone().add( dir.multiplyScalar( distance ) );

}

function onDocumentTouchMove(event){
     if (!event.touches.length) return;

     const normX = (event.touches[0].clientX / canvasContainer.clientWidth) * 2 - 1;
     const normY = -(event.touches[0].clientY / canvasContainer.clientHeight) * 2 + 1;
     normalizedMouseY = normY; // Store the normalized Y

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

    const requiredLayoutMode = getLayoutMode(width, height);
    if (requiredLayoutMode !== currentLayoutMode) {
        currentLayoutMode = requiredLayoutMode;
        updateSpheres(settings.sphereCount, currentLayoutMode); // Rebuild layout
    }

}

function updatePivotPositions(radius) {
    spheres.forEach(sphere => {
        sphere.group.children.forEach(pivot => {
            if (pivot.userData.direction) {

                const basePosition = pivot.userData.direction.clone();

                basePosition.multiplyScalar(radius);

                basePosition.x *= settings.sphereWidthScale;
                basePosition.y *= settings.sphereHeightScale;

                pivot.position.copy(basePosition);
            }
        });
    });
}

function createParticleSphere(positionOffset, initialRadius) {
    const sphereGroup = new THREE.Group();
    sphereGroup.position.copy(positionOffset);
    const dots = [];

    const tempSphereGeometry = new THREE.SphereGeometry(1, 16, 16); // Base radius of 1
    let positionAttribute = tempSphereGeometry.attributes.position;

    for(let i = 0; i < positionAttribute.count; i++){
        const vertex = new THREE.Vector3();
        vertex.fromBufferAttribute(positionAttribute, i);
        const direction = vertex.normalize(); // Normalized direction (length 1)

        let pivot = new THREE.Group();
        pivot.userData.direction = direction.clone(); // Store normalized direction

        const initialPosition = direction.clone();

        initialPosition.multiplyScalar(initialRadius);

        initialPosition.x *= settings.sphereWidthScale;
        initialPosition.y *= settings.sphereHeightScale;

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



function updateSpheres(count, layoutMode) {

    spheres.forEach(sphere => {
        scene.remove(sphere.group); sphere.dots.forEach(dot => { dot.mesh.geometry.dispose(); dot.material.dispose(); });

    });
    spheres = []; // Clear the array

    const totalSpread = settings.spread;
    const numSpheres = count; // Use argument directly

    for (let i = 0; i < numSpheres; i++) {
        let positionOffset;
        const radius = settings.sphereRadius; // Use the setting directly

        if (layoutMode === 'vertical') {

            const startY = (numSpheres > 1) ? -totalSpread / 2 : 0; // Center single sphere
            const spacing = (numSpheres > 1) ? totalSpread / (numSpheres - 1) : 0;
            const x = 0;
            const y = startY + i * spacing;
            const z = 0;
            positionOffset = new THREE.Vector3(x, y, z);
        } else { // Default to horizontal

            const startX = (numSpheres > 1) ? -totalSpread / 2 : 0; // Center single sphere
            const spacing = (numSpheres > 1) ? totalSpread / (numSpheres - 1) : 0;
            const x = startX + i * spacing;
            const y = 0;
            const z = 0;
            positionOffset = new THREE.Vector3(x, y, z);
        }

        spheres.push(createParticleSphere(positionOffset, radius));
    }


}



currentLayoutMode = getLayoutMode(canvasContainer.clientWidth, canvasContainer.clientHeight);
updateSpheres(settings.sphereCount, currentLayoutMode); // Create initial spheres based on setting and initial mode
onWindowResize();

let lastParticleTime = 0;
function animate(time = 0) {
    const elapsed = lastParticleTime ? Math.min((time - lastParticleTime) / 16.667, 2) : 1;
    lastParticleTime = time;









    spheres.forEach(sphere => {
        if(settings.toggleRotation && !particleReducedMotion.matches){
            const speed = settings.rotationSpeed * elapsed * (particleActive ? 2.5 : 1);
            sphere.group.rotation.x += speed;
            sphere.group.rotation.y += speed * 0.8;
            sphere.group.rotation.z += speed * 0.6;
        }

        sphere.dots.forEach(dot => {
            dot.avoidMouse(cursorPos); // Interaction is still global
            dot.controlMovement();
        });
    });






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









const panelHost = document.getElementById('panel');
const panel = new SHPanel(panelHost);
const defaults = structuredClone(settings);
const bindings = [];
function bind(folder, kind, key, options, change = () => {}) {
    const control = folder[kind](settings, key, options).on('change', change);
    bindings.push([key, control]);
}
const geometry = panel.folder('Particle spheres');
bind(geometry, 'slider', 'sphereCount', { label: 'Spheres', min: 1, max: 20, step: 1 }, () => updateSpheres(settings.sphereCount, currentLayoutMode));
bind(geometry, 'slider', 'sphereRadius', { label: 'Radius', min: 2, max: 14, step: 0.1 }, () => updatePivotPositions(settings.sphereRadius));
for (const key of ['sphereWidthScale', 'sphereHeightScale']) bind(geometry, 'slider', key, { min: 0.2, max: 2, step: 0.01 }, () => updatePivotPositions(settings.sphereRadius));
bind(geometry, 'slider', 'spread', { label: 'Spacing', min: 0, max: 65, step: 1 }, () => updateSpheres(settings.sphereCount, currentLayoutMode));
const motion = panel.folder('Motion and interaction');
bind(motion, 'toggle', 'toggleRotation', { label: 'Rotate' });
bind(motion, 'slider', 'rotationSpeed', { label: 'Rotation speed', min: 0, max: 0.025, step: 0.0005 });
bind(motion, 'slider', 'distanceAffection', { label: 'Pointer radius', min: 1, max: 25, step: 0.1 });
bind(motion, 'slider', 'avoidanceFactor', { label: 'Repulsion', min: 10, max: 40, step: 0.1 });
bind(motion, 'toggle', 'avoidRelativeToPivot', { label: 'Repel from resting position' });
bind(motion, 'toggle', 'countZAxisDirection', { label: 'Include depth' });
const color = panel.folder('Color and glow');
bind(color, 'color', 'particleColor', { label: 'Resting color' }, () => baseColor.set(settings.particleColor));
bind(color, 'color', 'particleColorSecondary', { label: 'Active color' }, () => secondaryColor.set(settings.particleColorSecondary));
bind(color, 'slider', 'colorBlendDistance', { label: 'Color response', min: 0.5, max: 20, step: 0.1 });
bind(color, 'slider', 'bloomStrength', { label: 'Bloom', min: 0, max: 2.5, step: 0.05 }, () => { glowPass.strength = settings.bloomStrength; });
const framing = panel.folder('Camera');
bind(framing, 'slider', 'cameraDistance', { label: 'Distance', min: 25, max: 100, step: 1 }, () => { baseCameraZ = settings.cameraDistance; onWindowResize(); });
bind(framing, 'slider', 'cameraFov', { label: 'Field of view', min: 30, max: 100, step: 1 }, () => { baseFov = settings.cameraFov; onWindowResize(); });
const actions = panel.folder('Save and reset');
actions.button('Copy JSON', async () => {
    const json = JSON.stringify({ project: 'portfolio-particle-spheres', version: 1, settings }, null, 2);
    let copied = false;
    try { await navigator.clipboard.writeText(json); copied = true; } catch {
        const field = document.createElement('textarea');
        field.value = json; panelHost.append(field); field.select();
        copied = document.execCommand('copy'); field.remove();
    }
    const button = [...panelHost.querySelectorAll('button')].find(button => button.textContent === 'Copy JSON');
    if (button) { button.textContent = copied ? 'Copied' : 'Copy failed'; setTimeout(() => button.textContent = 'Copy JSON', 1600); }
});
actions.button('Reset', () => {
    Object.assign(settings, defaults);
    bindings.forEach(([key, control]) => control.setValue(settings[key]));
    baseColor.set(settings.particleColor); secondaryColor.set(settings.particleColorSecondary);
    glowPass.strength = settings.bloomStrength;
    baseCameraZ = settings.cameraDistance; baseFov = settings.cameraFov;
    updateSpheres(settings.sphereCount, currentLayoutMode); onWindowResize();
});
actions.button('Hide panel · ` to reopen', () => document.dispatchEvent(new KeyboardEvent('keydown', { code: 'Backquote' })));
for (const event of ['pointerdown', 'pointermove', 'wheel']) panelHost.addEventListener(event, event => event.stopPropagation(), { passive: true });
