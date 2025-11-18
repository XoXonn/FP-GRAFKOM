let scene, camera, renderer, controls, stats;
let infoElement;

// Variables for movement physics
let moveForward = false;
let moveBackward = false;
let moveLeft = false;
let moveRight = false;
let canJump = false;
let velocity = new THREE.Vector3();
let direction = new THREE.Vector3();
let prevTime = performance.now();

// Variables for light toggle
let lightsOn = true;
let toggleableLights = []; // Array to hold lights we can turn off

// --- MODIFICATION: Room boundaries for collision ---
const roomWidth = 22;
const roomLength = 34;
const roomHeight = 10;
const collisionPadding = 0.5; // How far from the wall we stop
const boundaries = {
    xMin: -roomWidth / 2 + collisionPadding,
    xMax: roomWidth / 2 - collisionPadding,
    zMin: -roomLength / 2 + collisionPadding,
    zMax: roomLength / 2 - collisionPadding,
};
// ----------------------------------------------------


window.onload = function() {
    try {
        init();
        animate();
    } catch (error) {
        console.error("Error:", error);
        document.getElementById('info').innerHTML = 'Error loading scene. Check console.';
    }
};

function init() {
    // FPS Stats
    stats = new Stats();
    stats.domElement.id = 'stats';
    document.body.appendChild(stats.domElement);

    // Basic Setup
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf5f5f5);

    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
    // Start at human height, near the "front" of the room
    camera.position.set(0, 5, 14); 

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    document.body.appendChild(renderer.domElement);

    // --- First Person Controls (Pointer Lock) ---
    controls = new THREE.PointerLockControls(camera, document.body);
    infoElement = document.getElementById('info');

    infoElement.addEventListener('click', function () {
        controls.lock();
    });

    controls.addEventListener('lock', function () {
        infoElement.classList.add('locked');
    });

    controls.addEventListener('unlock', function () {
        infoElement.classList.remove('locked');
    });

    // Add the controls "body" to the scene
    scene.add(controls.getObject());

    // --- Key Listeners for Movement and Lights ---
    const onKeyDown = function (event) {
        switch (event.code) {
            case 'KeyW':
            case 'ArrowUp':
                moveForward = true;
                break;
            case 'KeyA':
            case 'ArrowLeft':
                moveLeft = true;
                break;
            case 'KeyS':
            case 'ArrowDown':
                moveBackward = true;
                break;
            case 'KeyD':
            case 'ArrowRight':
                moveRight = true;
                break;
            case 'Space':
                if (canJump === true) velocity.y += 150; // Jump force
                canJump = false;
                break;
            case 'KeyL':
                toggleLights(); // Toggle lights on/off
                break;
        }
    };

    const onKeyUp = function (event) {
        switch (event.code) {
            case 'KeyW':
            case 'ArrowUp':
                moveForward = false;
                break;
            case 'KeyA':
            case 'ArrowLeft':
                moveLeft = false;
                break;
            case 'KeyS':
            case 'ArrowDown':
                moveBackward = false;
                break;
            case 'KeyD':
            case 'ArrowRight':
                moveRight = false;
                break;
        }
    };

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);

    // --- Lighting ---
    // Ambient light (won't be toggled, so room is never pitch black)
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5); // Dimmer
    scene.add(ambientLight);

    // Main directional light
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 20, 10);
    directionalLight.castShadow = true;

    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    directionalLight.shadow.camera.left = -25;
    directionalLight.shadow.camera.right = 25;
    directionalLight.shadow.camera.top = 25;
    directionalLight.shadow.camera.bottom = -25;
    // ... (shadow camera settings)
    scene.add(directionalLight);
    toggleableLights.push(directionalLight); // Add to toggle list

    // Recessed ceiling spotlights
    const spotLightPositions = [
        [-8, 0], [-4, 0], [0, 0], [4, 0], [8, 0],
        [-8, -8], [-4, -8], [0, -8], [4, -8], [8, -8],
        [-8, 8], [-4, 8], [0, 8], [4, 8], [8, 8]
    ];

    spotLightPositions.forEach(([x, z]) => {
        const spotLight = new THREE.SpotLight(0xffffff, 0.5); // Brighter spots
        spotLight.position.set(x, roomHeight - 0.5, z);
        spotLight.angle = Math.PI / 3;
        spotLight.penumbra = 0.5;
        spotLight.decay = 1.5;
        spotLight.distance = 25;

        scene.add(spotLight);
        toggleableLights.push(spotLight); // Add to toggle list
        
        const lightGeo = new THREE.CylinderGeometry(0.15, 0.15, 0.1, 16);
        const lightMat = new THREE.MeshStandardMaterial({ 
            color: 0xffffff, 
            emissive: 0xffffff,
            emissiveIntensity: 1 
        });
        const lightMesh = new THREE.Mesh(lightGeo, lightMat);
        lightMesh.position.set(x, roomHeight - 0.15, z);
        scene.add(lightMesh);
    });

    // --- Materials (Same as before) ---
    const floorMaterial = new THREE.MeshStandardMaterial({ 
        color: 0xe8dcc8,
        roughness: 0.3,
        metalness: 0.2 
    });
    const wallMaterial = new THREE.MeshStandardMaterial({ 
        color: 0xfafafa,
        roughness: 0.9
    });
    const accentMaterial = new THREE.MeshStandardMaterial({ 
        color: 0xc9a87c,
        roughness: 0.8
    });
    const deskMaterial = new THREE.MeshStandardMaterial({ 
        color: 0xf5f5f5,
        roughness: 0.6 
    });
    const legMaterial = new THREE.MeshStandardMaterial({ 
        color: 0xffffff,
        roughness: 0.5
    });
    const chairSeatMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x0066cc,
        roughness: 0.7 
    });
    const chairBackMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x0a0a0a,
        roughness: 0.6 
    });
    const monitorMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x0a0a0a,
        roughness: 0.3,
        metalness: 0.1
    });
    const towerMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x1a1a1a,
        roughness: 0.5
    });


    // --- Room Geometry (Same as before) ---
    const floorGeometry = new THREE.PlaneGeometry(roomWidth, roomLength);
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    const gridHelper = new THREE.GridHelper(roomLength, 40, 0xe0e0e0, 0xe8e8e8);
    gridHelper.position.y = 0.01;
    scene.add(gridHelper);

    const wallGeoBack = new THREE.BoxGeometry(roomWidth, roomHeight, 0.3);
    const wallBack = new THREE.Mesh(wallGeoBack, wallMaterial);
    wallBack.position.set(0, roomHeight / 2, -roomLength / 2);
    wallBack.receiveShadow = true;
    scene.add(wallBack);
    
    // ... (All other room geometry: TV, panels, walls, ceiling, clock, AC, logo) ...
    
    // Left Wall with Zigzag Accent
    const wallLeftGroup = new THREE.Group();
    wallLeftGroup.position.set(-roomWidth / 2, roomHeight / 2, 0);
    wallLeftGroup.rotation.y = Math.PI / 2;
    const wallLeftBase = new THREE.Mesh(new THREE.BoxGeometry(roomLength, roomHeight, 0.3), wallMaterial);
    wallLeftBase.receiveShadow = true;
    wallLeftGroup.add(wallLeftBase);

    const centerLineY = 2.0; // Ditingkatkan dari 0.5 ke 1.0
    const bandThickness = 0.7;
    const bandGap = 1.0;
    const extrusionDepth = 0.28;

    // Path baru ini menggunakan 'centerLineY' (bukan baseY lagi)
    const topBandPath = [
        { z: -roomLength / 2,      y: centerLineY + bandThickness },       // Awal datar
        { z: -roomLength / 2 + 10,  y: centerLineY + bandThickness },       // Masih datar
        //{ z: -roomLength / 2 + 8,  y: centerLineY + bandThickness - 1.2 }, // Mulai turun lebih curam (ditingkatkan dari -0.8 ke -1.2)
        { z: -roomLength / 2 + 13, y: centerLineY + bandThickness - 1.7 }, // Titik terendah yang lebih curam (ditingkatkan dari -1.2 ke -1.8)
        //{ z: roomLength / 2 - 10,   y: centerLineY + bandThickness - 1.6 }, // Mulai naik lagi, tapi dari posisi lebih rendah (ditingkatkan dari -1.0 ke -1.6)
        { z: roomLength / 2 - 5,   y: centerLineY + bandThickness - 1.5 }, // Naik lebih tinggi (ditingkatkan dari -0.2 ke -0.7)
        { z: roomLength / 2,       y: centerLineY + bandThickness - 0.7 }  // Akhir datar (ditingkatkan dari -0.2 ke -0.7)
    ];

    const extrudeSettings = { steps: 1, depth: extrusionDepth, bevelEnabled: false };

    const accentTopGeo = new THREE.Shape();
    accentTopGeo.moveTo(topBandPath[0].z, topBandPath[0].y);
    for (let i = 1; i < topBandPath.length; i++) { accentTopGeo.lineTo(topBandPath[i].z, topBandPath[i].y); }
    for (let i = topBandPath.length - 1; i >= 0; i--) { accentTopGeo.lineTo(topBandPath[i].z, topBandPath[i].y + bandThickness); }
    accentTopGeo.lineTo(topBandPath[0].z, topBandPath[0].y + bandThickness);
    const accentTopMesh = new THREE.Mesh(new THREE.ExtrudeGeometry(accentTopGeo, extrudeSettings), accentMaterial);
    accentTopMesh.position.set(0.11, 0, 0);
    wallLeftGroup.add(accentTopMesh);

    const accentBottomGeo = new THREE.Shape();
    accentBottomGeo.moveTo(topBandPath[0].z, topBandPath[0].y - bandGap - bandThickness);
    for (let i = 1; i < topBandPath.length; i++) { accentBottomGeo.lineTo(topBandPath[i].z, topBandPath[i].y - bandGap - bandThickness); }
    for (let i = topBandPath.length - 1; i >= 0; i--) { accentBottomGeo.lineTo(topBandPath[i].z, topBandPath[i].y - bandGap); }
    accentBottomGeo.lineTo(topBandPath[0].z, topBandPath[0].y - bandGap);
    const accentBottomMesh = new THREE.Mesh(new THREE.ExtrudeGeometry(accentBottomGeo, extrudeSettings), accentMaterial);
    accentBottomMesh.position.set(0.11, 0, 0);
    wallLeftGroup.add(accentBottomMesh);
    scene.add(wallLeftGroup);

    // Right Wall (Mirrored)
    const wallRightGroup = new THREE.Group();
    wallRightGroup.position.set(roomWidth / 2, roomHeight / 2, 0);
    wallRightGroup.rotation.y = -Math.PI / 2;
    const wallRightBase = new THREE.Mesh(new THREE.BoxGeometry(roomLength, roomHeight, 0.3), wallMaterial);
    wallRightBase.receiveShadow = true;
    wallRightGroup.add(wallRightBase);
    
    // (Using same path data as left wall)
    const accentTopGeoRight = new THREE.Shape();
    accentTopGeoRight.moveTo(topBandPath[0].z, topBandPath[0].y);
    for (let i = 1; i < topBandPath.length; i++) { accentTopGeoRight.lineTo(topBandPath[i].z, topBandPath[i].y); }
    for (let i = topBandPath.length - 1; i >= 0; i--) { accentTopGeoRight.lineTo(topBandPath[i].z, topBandPath[i].y + bandThickness); }
    accentTopGeoRight.lineTo(topBandPath[0].z, topBandPath[0].y + bandThickness);
    const accentTopMeshRight = new THREE.Mesh(new THREE.ExtrudeGeometry(accentTopGeoRight, extrudeSettings), accentMaterial);
    accentTopMeshRight.position.set(0.11, 0, 0);
    wallRightGroup.add(accentTopMeshRight);

    const accentBottomGeoRight = new THREE.Shape();
    accentBottomGeoRight.moveTo(topBandPath[0].z, topBandPath[0].y - bandGap - bandThickness);
    for (let i = 1; i < topBandPath.length; i++) { accentBottomGeoRight.lineTo(topBandPath[i].z, topBandPath[i].y - bandGap - bandThickness); }
    for (let i = topBandPath.length - 1; i >= 0; i--) { accentBottomGeoRight.lineTo(topBandPath[i].z, topBandPath[i].y - bandGap); }
    accentBottomGeoRight.lineTo(topBandPath[0].z, topBandPath[0].y - bandGap);
    const accentBottomMeshRight = new THREE.Mesh(new THREE.ExtrudeGeometry(accentBottomGeoRight, extrudeSettings), accentMaterial);
    accentBottomMeshRight.position.set(0.11, 0, 0);
    wallRightGroup.add(accentBottomMeshRight);
    scene.add(wallRightGroup);
    
    // ... (Add TV, Ceiling, Clock, AC, Logo objects here) ...
    // Example: TV Screen
    const tvScreenGeo = new THREE.BoxGeometry(7, 4.5, 0.15);
    const tvScreen = new THREE.Mesh(tvScreenGeo, monitorMaterial);
    tvScreen.position.set(0, roomHeight / 2 + 0.5, -roomLength / 2 + 0.12);
    scene.add(tvScreen);
    
    // (Pasting the rest of the geometry)
    const panelWidth = 1.0;
    const panelHeight = roomHeight;
    const panelGeo = new THREE.BoxGeometry(panelWidth, panelHeight, 0.25);
    const panelMaterial = new THREE.MeshStandardMaterial({ color: 0xe0d0b0 });
    const panelPositions = [-9, -5, 5, 9];
    panelPositions.forEach(xPos => {
        const panel = new THREE.Mesh(panelGeo, panelMaterial);
        panel.position.set(xPos, roomHeight / 2, -roomLength / 2 + 0.15);
        scene.add(panel);
    });
    
    const recessDepth = 0.4;
    const recessWidth = roomWidth - 5;
    const recessLength = roomLength - 8;
    const recessGeo = new THREE.BoxGeometry(recessWidth, recessDepth, recessLength);
    const recessMaterial = new THREE.MeshStandardMaterial({ color: 0xe8e8e8 });
    const recess = new THREE.Mesh(recessGeo, recessMaterial);
    recess.position.set(0, roomHeight - recessDepth/2, 0);
    scene.add(recess);
    const ceilingGeometry = new THREE.PlaneGeometry(roomWidth, roomLength);
    const ceiling = new THREE.Mesh(ceilingGeometry, wallMaterial);
    ceiling.position.y = roomHeight;
    ceiling.rotation.x = Math.PI / 2;
    scene.add(ceiling);

    const clockRadius = 0.4;
    const clockGeo = new THREE.CylinderGeometry(clockRadius, clockRadius, 0.1, 32);
    const clockMaterial = new THREE.MeshStandardMaterial({ color: 0xe8e8e8 });
    const clock = new THREE.Mesh(clockGeo, clockMaterial);
    clock.rotation.z = Math.PI / 2;
    clock.position.set(-roomWidth / 2 + 0.35, roomHeight - 1.8, roomLength / 4);
    scene.add(clock);
    const faceGeo = new THREE.CircleGeometry(clockRadius - 0.05, 32);
    const faceMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff });
    const face = new THREE.Mesh(faceGeo, faceMaterial);
    face.rotation.y = Math.PI / 2;
    face.position.set(-roomWidth / 2 + 0.37, roomHeight - 1.8, roomLength / 4);
    scene.add(face);
    const hourHandGeo = new THREE.BoxGeometry(0.02, 0.2, 0.05);
    const minuteHandGeo = new THREE.BoxGeometry(0.02, 0.28, 0.04);
    const handMaterial = new THREE.MeshStandardMaterial({ color: 0x333333 });
    const hourHand = new THREE.Mesh(hourHandGeo, handMaterial);
    hourHand.position.set(-roomWidth / 2 + 0.38, roomHeight - 1.8, roomLength / 4);
    hourHand.rotation.y = Math.PI / 2;
    hourHand.rotation.x = Math.PI / 6;
    scene.add(hourHand);
    const minuteHand = new THREE.Mesh(minuteHandGeo, handMaterial);
    minuteHand.position.set(-roomWidth / 2 + 0.39, roomHeight - 1.8, roomLength / 4);
    minuteHand.rotation.y = Math.PI / 2;
    minuteHand.rotation.x = Math.PI / 3;
    scene.add(minuteHand);

    const acGeo = new THREE.BoxGeometry(2.8, 0.7, 0.9);
    const acMaterial = new THREE.MeshStandardMaterial({ color: 0xf8f8f8 });
    const ac1 = new THREE.Mesh(acGeo, acMaterial);
    ac1.position.set(4, roomHeight - 0.45, -roomLength / 2 + 0.55);
    scene.add(ac1);
    const ac2 = new THREE.Mesh(acGeo, acMaterial);
    ac2.position.set(-4, roomHeight - 0.45, -roomLength / 2 + 0.55);
    scene.add(ac2);
    
    // SE Logo
    const logoCanvas = document.createElement('canvas');
    logoCanvas.width = 512; logoCanvas.height = 512;
    const ctx = logoCanvas.getContext('2d');
    ctx.fillStyle = '#fafafa'; ctx.fillRect(0, 0, 512, 512);
    ctx.fillStyle = '#000000';
    ctx.fillRect(100, 80, 140, 40); ctx.fillRect(100, 80, 40, 100);
    ctx.fillRect(100, 140, 120, 40); ctx.fillRect(200, 140, 40, 100);
    ctx.fillRect(100, 200, 140, 40); ctx.fillRect(280, 80, 40, 160);
    ctx.fillRect(280, 80, 120, 40); ctx.fillRect(280, 140, 100, 40);
    ctx.fillRect(280, 200, 120, 40);
    ctx.font = 'bold 48px Arial'; ctx.textAlign = 'center';
    ctx.fillText('SOFTWARE', 256, 300); ctx.fillText('ENGINEERING', 256, 360);
    const logoTexture = new THREE.CanvasTexture(logoCanvas);
    const logoMat = new THREE.MeshStandardMaterial({ map: logoTexture, color: 0xffffff, transparent: false });
    const logoPlane = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 1.0), logoMat);
    logoPlane.rotation.y = -Math.PI / 2;
    logoPlane.position.set(roomWidth / 2 - 0.32, roomHeight * 0.63, 0);
    scene.add(logoPlane);
    
    // --- END: Pasted geometry code ---
    

    // --- Helper Functions (Same as before) ---
function createChair(x, y, z, rotation) {
    const chairGroup = new THREE.Group();

    // --- MATERIAL ---
    const chromeMat = new THREE.MeshStandardMaterial({ 
        color: 0xaaaaaa, metalness: 0.9, roughness: 0.2 
    });
    const seatMat = new THREE.MeshStandardMaterial({ 
        color: 0x0f4c81, roughness: 0.6 
    });
    const backMat = new THREE.MeshStandardMaterial({ 
        color: 0x111111, roughness: 0.5 
    });
    const armPadMat = new THREE.MeshStandardMaterial({ 
        color: 0x111111, roughness: 0.5 
    });

    // --- 1. DUDUKAN & SANDARAN ---
    const seatGeo = new THREE.BoxGeometry(1.3, 0.15, 1.3);
    const seat = new THREE.Mesh(seatGeo, seatMat);
    seat.position.y = 1.4; 
    seat.castShadow = true;
    chairGroup.add(seat);

    const backGeo = new THREE.BoxGeometry(1.3, 0.9, 0.15);
    const back = new THREE.Mesh(backGeo, backMat);
    back.position.set(0, 2.3, 0.45); 
    back.rotation.x = -0.15;
    back.castShadow = true;
    chairGroup.add(back);

    // --- 2. RANGKA BESI "KOTAK" di Lantai ---
    const tubeRadius = 0.04;
    
    // Kiri & Kanan Bawah
    const railGeoSide = new THREE.CylinderGeometry(tubeRadius, tubeRadius, 1.6, 12);
    const railL = new THREE.Mesh(railGeoSide, chromeMat);
    railL.rotation.x = Math.PI / 2; 
    railL.position.set(-0.6, tubeRadius, 0.1);
    chairGroup.add(railL);

    const railR = new THREE.Mesh(railGeoSide, chromeMat);
    railR.rotation.x = Math.PI / 2;
    railR.position.set(0.6, tubeRadius, 0.1);
    chairGroup.add(railR);

    // Depan & Belakang Bawah
    const railGeoFrontBack = new THREE.CylinderGeometry(tubeRadius, tubeRadius, 1.2, 12);
    const railFront = new THREE.Mesh(railGeoFrontBack, chromeMat);
    railFront.rotation.z = Math.PI / 2; 
    railFront.position.set(0, tubeRadius, -0.7); 
    chairGroup.add(railFront);

    const railBack = new THREE.Mesh(railGeoFrontBack, chromeMat);
    railBack.rotation.z = Math.PI / 2; 
    railBack.position.set(0, tubeRadius, 0.9); 
    chairGroup.add(railBack);

    // --- 3. TIANG PENYANGGA (KAKI) ---
    const legGeo = new THREE.CylinderGeometry(tubeRadius, tubeRadius, 1.4, 12);
    const legFL = new THREE.Mesh(legGeo, chromeMat);
    legFL.position.set(-0.6, 0.7, -0.7);
    chairGroup.add(legFL);

    const legFR = new THREE.Mesh(legGeo, chromeMat);
    legFR.position.set(0.6, 0.7, -0.7);
    chairGroup.add(legFR);

    const railGeoSeat = new THREE.CylinderGeometry(tubeRadius, tubeRadius, 1.4, 12);
    const sRailL = new THREE.Mesh(railGeoSeat, chromeMat);
    sRailL.rotation.x = Math.PI / 2;
    sRailL.position.set(-0.6, 1.35, 0);
    chairGroup.add(sRailL);

    const sRailR = new THREE.Mesh(railGeoSeat, chromeMat);
    sRailR.rotation.x = Math.PI / 2;
    sRailR.position.set(0.6, 1.35, 0);
    chairGroup.add(sRailR);

    const backSupGeo = new THREE.CylinderGeometry(tubeRadius, tubeRadius, 1.2, 12);
    const bSupL = new THREE.Mesh(backSupGeo, chromeMat);
    bSupL.position.set(-0.6, 2.0, 0.5); 
    bSupL.rotation.x = -0.15;
    chairGroup.add(bSupL);

    const bSupR = new THREE.Mesh(backSupGeo, chromeMat);
    bSupR.position.set(0.6, 2.0, 0.5);
    bSupR.rotation.x = -0.15;
    chairGroup.add(bSupR);
    
    const backPlateGeo = new THREE.BoxGeometry(1.25, 0.05, 0.02);
    const backPlate = new THREE.Mesh(backPlateGeo, chromeMat);
    backPlate.position.set(0, 2.3, 0.52);
    backPlate.rotation.x = -0.15;
    chairGroup.add(backPlate);

    // --- 4. ARMREST (Sandaran Tangan) - DIPERBAIKI ---
    
    // Jalur Kiri (Dibuat lebih datar dan rendah)
    const armPathLeft = new THREE.CatmullRomCurve3([
        new THREE.Vector3(-0.6, 2.0, 0.5),   // A: Tiang Belakang
        new THREE.Vector3(-0.6, 2.1, 0.2),   // B: Naik SEDIKIT saja (tadinya 2.3)
        new THREE.Vector3(-0.6, 2.1, -0.3),  // C: Maju Datar (Lebih rendah)
        new THREE.Vector3(-0.6, 1.4, -0.7)   // D: Turun ke Kaki Depan
    ]);
    // Tension dinaikkan ke 0.5 agar sudutnya lebih tegas (tidak terlalu melengkung bulat)
    armPathLeft.tension = 0.5; 

    const armTubeGeo = new THREE.TubeGeometry(armPathLeft, 20, 0.04, 8, false);
    // Menggunakan chromeMat agar warna SAMA dengan besi bawah
    const armLeft = new THREE.Mesh(armTubeGeo, chromeMat); 
    armLeft.castShadow = true;
    chairGroup.add(armLeft);

    // Jalur Kanan
    const armPathRight = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0.6, 2.0, 0.5),    // A
        new THREE.Vector3(0.6, 2.1, 0.2),    // B (Tinggi 2.1)
        new THREE.Vector3(0.6, 2.1, -0.3),   // C
        new THREE.Vector3(0.6, 1.4, -0.7)    // D
    ]);
    armPathRight.tension = 0.5;

    const armRight = new THREE.Mesh(new THREE.TubeGeometry(armPathRight, 20, 0.04, 8, false), chromeMat);
    armRight.castShadow = true;
    chairGroup.add(armRight);

    // Bantalan Tangan (Arm Pad) - Posisi disesuaikan turun
    const padGeo = new THREE.BoxGeometry(0.1, 0.04, 0.6);
    
    const padLeft = new THREE.Mesh(padGeo, armPadMat);
    // Turun ke 2.14 (sebelumnya 2.34) mengikuti tinggi pipa baru
    padLeft.position.set(-0.6, 2.14, -0.05); 
    chairGroup.add(padLeft);

    const padRight = new THREE.Mesh(padGeo, armPadMat);
    padRight.position.set(0.6, 2.14, -0.05); 
    chairGroup.add(padRight);

    // --- FINAL ---
    chairGroup.position.set(x, 0, z); 
    chairGroup.rotation.y = rotation;
    scene.add(chairGroup);
    return chairGroup;
}

    function createComputerStation(x, y, z, rotation) {
        const station = new THREE.Group();
        const deskHeight = y;
        const screenGeo = new THREE.BoxGeometry(1.7, 1.1, 0.08);
        const screen = new THREE.Mesh(screenGeo, monitorMaterial);
        screen.position.set(0, deskHeight + 0.75, 0);
        screen.castShadow = true; 
        station.add(screen);
        const standGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.65, 8);
        const stand = new THREE.Mesh(standGeo, monitorMaterial);
        stand.position.set(0, deskHeight + 0.33, 0);
        station.add(stand);
        const towerGeo = new THREE.BoxGeometry(0.45, 1.4, 1.6); // Tinggi tower = 1.4
        const tower = new THREE.Mesh(towerGeo, towerMaterial);
        tower.position.set(0.95, 0.7, 0); 
        
        tower.castShadow = true; 
        station.add(tower);

        // Keyboard
        const keyGeo = new THREE.BoxGeometry(1.4, 0.04, 0.45);
        const keyboard = new THREE.Mesh(keyGeo, monitorMaterial);
        keyboard.position.set(0, deskHeight, 0.7); 
        keyboard.rotation.x = 0.08;
        station.add(keyboard);

        station.position.set(x, 0, z);
        station.rotation.y = rotation;
        scene.add(station);
        return station;
    }

    
    function createDesk(width, depth, height) {
        const desk = new THREE.Group();
        const topGeo = new THREE.BoxGeometry(width, 0.15, depth);
        const top = new THREE.Mesh(topGeo, deskMaterial);
        top.position.y = height - 0.08;
        top.castShadow = true; 
        top.receiveShadow = true; 
        desk.add(top);
        const legGeo = new THREE.BoxGeometry(0.15, height, 0.15);
        const leg1 = new THREE.Mesh(legGeo, legMaterial);
        leg1.position.set(-width/2 + 0.08, height/2, -depth/2 + 0.08);
        desk.add(leg1);
        const leg2 = new THREE.Mesh(legGeo, legMaterial);
        leg2.position.set(width/2 - 0.08, height/2, -depth/2 + 0.08);
        desk.add(leg2);
        const leg3 = new THREE.Mesh(legGeo, legMaterial);
        leg3.position.set(-width/2 + 0.08, height/2, depth/2 - 0.08);
        desk.add(leg3);
        const leg4 = new THREE.Mesh(legGeo, legMaterial);
        leg4.position.set(width/2 - 0.08, height/2, depth/2 - 0.08);
        desk.add(leg4);
        return desk;
    }

    // --- Layout Furniture (Same as before) ---
    const deskHeight = 2.9;

    const sideDeskLength = roomLength - 8; 
    const sideDeskDepth = 2.4; 
    const leftDesk = createDesk(sideDeskDepth, sideDeskLength, deskHeight);
    leftDesk.position.set(-roomWidth / 2 + sideDeskDepth / 2, 0, 0);
    scene.add(leftDesk);

    const numSideStations = 7;
    const sideSpacing = sideDeskLength / numSideStations;
    for (let i = 0; i < numSideStations; i++) {
        const zPos = -sideDeskLength / 2 + sideSpacing / 2 + i * sideSpacing;
        const xPosDesk = -roomWidth / 2 + sideDeskDepth / 2;
        createComputerStation(xPosDesk, deskHeight, zPos, Math.PI / 2); 
        createChair(xPosDesk + sideDeskDepth / 2 + 0.6, 0, zPos, Math.PI / 2);
    }

    const rightDesk = createDesk(sideDeskDepth, sideDeskLength, deskHeight);
    rightDesk.position.set(roomWidth / 2 - sideDeskDepth / 2, 0, 0);
    scene.add(rightDesk);

    for (let i = 0; i < numSideStations; i++) {
        const zPos = -sideDeskLength / 2 + sideSpacing / 2 + i * sideSpacing;
        const xPosDesk = roomWidth / 2 - sideDeskDepth / 2;
        createComputerStation(xPosDesk, deskHeight, zPos, -Math.PI / 2); 
        createChair(xPosDesk - sideDeskDepth / 2 - 0.6, 0, zPos, -Math.PI / 2);
    }

    const centerTableLength = 22;
    const centerTableDepth = 3.8;
    const centerTable = createDesk(centerTableDepth, centerTableLength, deskHeight);
    centerTable.position.set(0, 0, 0); 
    scene.add(centerTable);

    const numCenterChairs = 6;
    const centerSpacing = centerTableLength / numCenterChairs;
    for (let i = 0; i < numCenterChairs; i++) {
        const zPos = -centerTableLength / 2 + centerSpacing / 2 + i * centerSpacing;
        createChair(centerTableDepth / 2 + 1, 0, zPos, Math.PI / 2); 
        createChair(-centerTableDepth / 2 - 1, 0, zPos, -Math.PI / 2); 
    }

    // Window resize
    window.addEventListener('resize', onWindowResize, false);
}

/**
 * Toggles the visibility of all lights in the toggleableLights array.
 */
function toggleLights() {
    lightsOn = !lightsOn;
    toggleableLights.forEach(light => {
        light.visible = lightsOn;
    });
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// --- NEW Animation Loop with Physics ---
function animate() {
    requestAnimationFrame(animate);

    const time = performance.now();
    const delta = (time - prevTime) / 1000;

    // Only update movement if controls are locked
    if (controls.isLocked === true) {
        // Apply friction
        velocity.x -= velocity.x * 10.0 * delta;
        velocity.z -= velocity.z * 10.0 * delta;

        // Apply gravity
        velocity.y -= 9.8 * 50.0 * delta; // 50.0 = mass

        // Get movement direction
        direction.z = Number(moveForward) - Number(moveBackward);
        direction.x = Number(moveRight) - Number(moveLeft);
        direction.normalize(); // ensures consistent speed in all directions

        // --- MODIFICATION: Reduced movement speed from 400.0 to 150.0 ---
        if (moveForward || moveBackward) velocity.z -= direction.z * 150.0 * delta;
        if (moveLeft || moveRight) velocity.x -= direction.x * 150.0 * delta;
        // -----------------------------------------------------------------

        // Move the controls "body"
        controls.moveRight(-velocity.x * delta);
        controls.moveForward(-velocity.z * delta);

        // Apply gravity to camera
        controls.getObject().position.y += (velocity.y * delta);

        // Simple floor collision
        if (controls.getObject().position.y < 5) { // 5 is "human height"
            velocity.y = 0;
            controls.getObject().position.y = 5;
            canJump = true;
        }

        // --- MODIFICATION: Add wall collisions ---
        const camPos = controls.getObject().position;

        if (camPos.x < boundaries.xMin) {
            camPos.x = boundaries.xMin;
            velocity.x = 0; // Stop x-axis momentum
        }
        if (camPos.x > boundaries.xMax) {
            camPos.x = boundaries.xMax;
            velocity.x = 0;
        }
        if (camPos.z < boundaries.zMin) {
            camPos.z = boundaries.zMin;
            velocity.z = 0; // Stop z-axis momentum
        }
        if (camPos.z > boundaries.zMax) {
            camPos.z = boundaries.zMax;
            velocity.z = 0;
        }
        // -----------------------------------------
    }

    prevTime = time;

    stats.update();
    renderer.render(scene, camera);
}