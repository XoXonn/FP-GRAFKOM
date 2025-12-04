let scene, camera, renderer, controls, stats;
let infoElement;
let rgbMaterial;

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
let collisionObstacles = [];
// --- MODIFICATION: Room boundaries for collision ---
const roomWidth = 28;
const roomLength = 36;
const roomHeight = 11;
const collisionPadding = 0.5; // How far from the wall we stop
const boundaries = {
    xMin: -roomWidth / 2 + collisionPadding,
    xMax: roomWidth / 2 - collisionPadding,
    zMin: -roomLength / 2 + collisionPadding,
    zMax: roomLength / 2 - collisionPadding,
};
// ----------------------------------------------------


window.onload = function () {
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
    scene.background = new THREE.Color(0xfafafa);

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
    // Very dim ambient light (room is dark when lights are off)
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.06);
    scene.add(ambientLight);

    // Main directional light (simulating natural daylight from front door - NOT toggleable)
    const directionalLight = new THREE.DirectionalLight(0xfff5e6, 0.2);
    directionalLight.position.set(-8, 12, 18); // From front-left where door is
    directionalLight.castShadow = true;

    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    directionalLight.shadow.camera.left = -25;
    directionalLight.shadow.camera.right = 25;
    directionalLight.shadow.camera.top = 25;
    directionalLight.shadow.camera.bottom = -25;
    scene.add(directionalLight);

    const hemiLight = new THREE.HemisphereLight(0xffffff, 0xb29a7a, 0.4);
    hemiLight.position.set(0, roomHeight, 0);
    scene.add(hemiLight);

    // --- TEXTURE LOADER ---
    const textureLoader = new THREE.TextureLoader();

    // 1. Setup Floor Textures (Tiles)
    const floorColor = textureLoader.load('textures/Tiles107_2K-JPG_Color.jpg');
    const floorRough = textureLoader.load('textures/Tiles107_2K-JPG_Roughness.jpg');
    const floorNorm = textureLoader.load('textures/Tiles107_2K-JPG_NormalGL.jpg');

    // Repeat tiles 14x18 times across the room
    [floorColor, floorRough, floorNorm].forEach(tex => {
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.RepeatWrapping;
        tex.repeat.set(3, 4);
    });

    // 2. Setup Wood Textures (Desk)
    const woodColor = textureLoader.load('textures/Wood094_2K-JPG_Color.jpg');
    const woodRough = textureLoader.load('textures/Wood094_2K-JPG_Roughness.jpg');
    const woodNorm = textureLoader.load('textures/Wood094_2K-JPG_NormalGL.jpg');

    // Repeat wood grain so it's not too big (2x1 looks good for desks)
    [woodColor, woodRough, woodNorm].forEach(tex => {
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.RepeatWrapping;
        tex.repeat.set(2, 1);
    });
    // 3. Setup Wall/Ceiling Texture (Plaster)
    const plasterColor = textureLoader.load('textures/Wallpaper001A_2K-JPG_Color.jpg');
    const plasterRough = textureLoader.load('textures/Wallpaper001A_2K-JPG_Roughness.jpg');
    const plasterNorm = textureLoader.load('textures/Wallpaper001A_2K-JPG_NormalGL.jpg');

    // Configure repeat for Walls (Stretch it out so it doesn't look like tiny tiles)
    [plasterColor, plasterRough, plasterNorm].forEach(tex => {
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.RepeatWrapping;
        tex.repeat.set(4, 2); // Repeat 4 times horizontally, 2 times vertically
    });

    // We need a separate texture settings for the Ceiling (because it's huge)
    const ceilingColorTex = plasterColor.clone();
    const ceilingRoughTex = plasterRough.clone();
    const ceilingNormTex = plasterNorm.clone();

    [ceilingColorTex, ceilingRoughTex, ceilingNormTex].forEach(tex => {
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.RepeatWrapping;
        tex.repeat.set(10, 10); // Repeat more times for the large ceiling
    });

    // 3. Screen Texture (New!)
    const screenTexture = textureLoader.load('textures/screen_code.jpg');
    // MeshBasicMaterial makes it "glow" slightly (unaffected by shadows)
    const screenContentMaterial = new THREE.MeshBasicMaterial({
        map: screenTexture
    });

    // --- Materials ---
    const floorMaterial = new THREE.MeshStandardMaterial({
        map: floorColor, roughnessMap: floorRough, normalMap: floorNorm, color: 0xffffff
    });
    const wallMaterial = new THREE.MeshStandardMaterial({
        map: plasterColor,
        roughnessMap: plasterRough,
        normalMap: plasterNorm,
        color: 0xffffff, // Keep it white
        roughness: 0.9   // Walls are usually matte/rough
    });
    const accentMaterial = new THREE.MeshStandardMaterial({
        color: 0xd4b896,
        roughness: 0.7
    });
    const deskMaterial = new THREE.MeshStandardMaterial({
        map: woodColor,
        roughnessMap: woodRough,
        normalMap: woodNorm,
        color: 0xffffff,
        metalness: 0.0
    });
    const powerStripMaterial = new THREE.MeshStandardMaterial({
        color: 0xf5f5f5,
        roughness: 0.5,
        metalness: 0.05
    });
    const powerHoleMaterial = new THREE.MeshStandardMaterial({
        color: 0x222222,
        roughness: 0.6
    });
    const powerChannelMaterial = new THREE.MeshStandardMaterial({
        color: 0xb3b3b3,
        roughness: 0.35,
        metalness: 0.25
    });
    const powerLedMaterial = new THREE.MeshStandardMaterial({
        color: 0x3fb1ff,
        emissive: 0x3fb1ff,
        emissiveIntensity: 0.7,
        roughness: 0.4,
        metalness: 0.0
    });

    const glassMaterial = new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        metalness: 0,
        roughness: 0,
        transmission: 0.9,
        transparent: true,
        thickness: 0.5
    });
    // const cabinetMaterial = new THREE.MeshStandardMaterial({
    //     color: 0xf0f0f0, roughness: 0.5, metalness: 0.1
    // });
    // const cabinetHandleMat = new THREE.MeshStandardMaterial({ color: 0xcccccc });

    const legMaterial = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.4,
        metalness: 0.1
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
    rgbMaterial = new THREE.MeshStandardMaterial({
        color: 0x000000,
        emissive: 0xff0000, // Red start
        emissiveIntensity: 2.0
    });

    // --- Room Geometry (Same as before) ---
    const floorGeometry = new THREE.PlaneGeometry(roomWidth, roomLength);
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);


    // --- BACK WALL & WINDOWS (Fixed: Brown Backing Behind AC) ---
    const backWallGroup = new THREE.Group();
    const windowHeight = 6.8; // FIXED: 7.0 was too big (Room is only 4.5!)
    const windowY = 2.0;
    const windowWidth = roomWidth - 0.3;

    // 1. Bottom Wall (White)
    const wallBottom = new THREE.Mesh(new THREE.BoxGeometry(roomWidth, windowY, 0.2), wallMaterial);
    wallBottom.position.set(0, windowY / 2, 0);
    backWallGroup.add(wallBottom);

    // 2. Top Wall (Backing behind AC) -> CHANGED TO BROWN (accentMaterial)
    const wallTopH = roomHeight - (windowY + windowHeight);
    // Use Math.max to prevent negative height if numbers are tweaked
    const safeTopH = Math.max(0.1, wallTopH);

    const wallTop = new THREE.Mesh(new THREE.BoxGeometry(roomWidth, safeTopH, 0.2), accentMaterial); // <--- CHANGED MATERIAL
    wallTop.position.set(0, windowY + windowHeight + safeTopH / 2, 0);
    backWallGroup.add(wallTop);

    // --- BROWN CORNER PILLARS ---
    const pillarWidth = 1.6;
    const pillarGeo = new THREE.BoxGeometry(pillarWidth, roomHeight, 0.4); // Depth 0.4 to pop out

    // Left Pillar
    const pillarL = new THREE.Mesh(pillarGeo, accentMaterial);
    pillarL.position.set(-roomWidth / 2 + pillarWidth / 2, roomHeight / 2, 0.4);
    backWallGroup.add(pillarL);

    // Right Pillar
    const pillarR = new THREE.Mesh(pillarGeo, accentMaterial);
    pillarR.position.set(roomWidth / 2 - pillarWidth / 2, roomHeight / 2, 0.4);
    backWallGroup.add(pillarR);

    // --- BROWN TOP BEAM (Connecting Pillars) ---
    // Added this to ensure the brown section looks solid behind the AC
    const topDeco = new THREE.Mesh(new THREE.BoxGeometry(roomWidth, 0.8, 0.25), accentMaterial);
    topDeco.position.set(0, 4.1, 0);
    backWallGroup.add(topDeco);

    // 3. Side Fillers (White parts left/right of window)
    const sideFillerWidth = (roomWidth - windowWidth) / 2;
    const sideGeo = new THREE.BoxGeometry(sideFillerWidth + 0.05, windowHeight, 0.2);

    const sideL = new THREE.Mesh(sideGeo, wallMaterial);
    sideL.position.set(-roomWidth / 2 + sideFillerWidth / 2, windowY + windowHeight / 2, 0);
    backWallGroup.add(sideL);

    const sideR = new THREE.Mesh(sideGeo, wallMaterial);
    sideR.position.set(roomWidth / 2 - sideFillerWidth / 2, windowY + windowHeight / 2, 0);
    backWallGroup.add(sideR);

    backWallGroup.position.z = -roomLength / 2 - 0.1;
    scene.add(backWallGroup);

    // Glass Window
    const glassWindow = new THREE.Mesh(new THREE.PlaneGeometry(windowWidth, windowHeight), glassMaterial);
    glassWindow.position.set(0, windowY + windowHeight / 2, -roomLength / 2);
    glassWindow.material.side = THREE.DoubleSide;
    scene.add(glassWindow);

    // Window frame
    const windowFrameMaterial = new THREE.MeshStandardMaterial({
        color: 0xcccccc,
        roughness: 0.5,
        metalness: 0.3
    });

    const frameThick = 0.08;
    const windowFrameDepth = 0.15;

    // Window outer frame
    const windowFrameTop = new THREE.Mesh(
        new THREE.BoxGeometry(windowWidth, frameThick, windowFrameDepth),
        windowFrameMaterial
    );
    windowFrameTop.position.set(0, windowY + windowHeight - frameThick / 2, -roomLength / 2 + 0.08);
    scene.add(windowFrameTop);

    const windowFrameBottom = new THREE.Mesh(
        new THREE.BoxGeometry(windowWidth, frameThick, windowFrameDepth),
        windowFrameMaterial
    );
    windowFrameBottom.position.set(0, windowY + frameThick / 2, -roomLength / 2 + 0.08);
    scene.add(windowFrameBottom);

    // 6 Rolling curtains (vertical panels) - same color as walls
    const curtainWidth = windowWidth / 6;
    const curtainMaterial = new THREE.MeshStandardMaterial({
        color: 0xffffff, // Same as wall color
        roughness: 0.85,
        side: THREE.DoubleSide
    });

    for (let i = 0; i < 6; i++) {
        const curtainGeo = new THREE.PlaneGeometry(curtainWidth - 0.1, windowHeight - 0.2);
        const curtain = new THREE.Mesh(curtainGeo, curtainMaterial);
        const xPos = -windowWidth / 2 + curtainWidth / 2 + i * curtainWidth;
        curtain.position.set(xPos, windowY + windowHeight / 2, -roomLength / 2 + 0.1);
        curtain.receiveShadow = true;
        curtain.castShadow = true;
        scene.add(curtain);
    }

    // Horizontal light brown pole above curtains (full width)
    const poleGeo = new THREE.CylinderGeometry(0.05, 0.05, roomWidth, 16);
    const poleMat = new THREE.MeshStandardMaterial({
        color: 0xd4b896, // Light brown accent color
        roughness: 0.6,
        metalness: 0.1
    });
    const pole = new THREE.Mesh(poleGeo, poleMat);
    pole.rotation.z = Math.PI / 2;
    pole.position.set(0, windowY + windowHeight + 0.15, -roomLength / 2 + 0.12);
    scene.add(pole);

    // Front wall with door opening on the left
    const doorWidth = 6;
    const doorHeight = 7;
    const doorX = -roomWidth / 2 + doorWidth / 2 + 3.5;

    // Wall sections around door
    // Right section of front wall
    const frontWallRightWidth = roomWidth / 2 - doorWidth / 2 - 2;
    const frontWallRight = new THREE.Mesh(
        new THREE.BoxGeometry(frontWallRightWidth, roomHeight, 0.3),
        wallMaterial
    );
    frontWallRight.position.set(roomWidth / 2 - frontWallRightWidth / 2, roomHeight / 2, roomLength / 2);
    frontWallRight.receiveShadow = true;
    scene.add(frontWallRight);

    // Top section above door
    const frontWallTop = new THREE.Mesh(
        new THREE.BoxGeometry(doorWidth, roomHeight - doorHeight, 0.3),
        wallMaterial
    );
    frontWallTop.position.set(doorX, roomHeight - (roomHeight - doorHeight) / 2, roomLength / 2);
    frontWallTop.receiveShadow = true;
    scene.add(frontWallTop);

    // Left section of front wall
    const frontWallLeftWidth = -roomWidth / 2 + doorX - doorWidth / 2;
    if (frontWallLeftWidth > 0) {
        const frontWallLeft = new THREE.Mesh(
            new THREE.BoxGeometry(frontWallLeftWidth, roomHeight, 0.3),
            wallMaterial
        );
        frontWallLeft.position.set(-roomWidth / 2 + frontWallLeftWidth / 2, roomHeight / 2, roomLength / 2);
        frontWallLeft.receiveShadow = true;
        scene.add(frontWallLeft);
    }

    // Double glass doors with frame


    const doorFrameMaterial = new THREE.MeshStandardMaterial({
        color: 0xdddddd,
        roughness: 0.5,
        metalness: 0.3
    });

    // Door frame
    const frameThickness = 0.15;
    const frameDepth = 0.2;

    // Left door glass
    const leftDoorGlass = new THREE.Mesh(
        new THREE.BoxGeometry(doorWidth / 2 - frameThickness * 1.5, doorHeight - frameThickness * 2, 0.05),
        glassMaterial
    );
    leftDoorGlass.position.set(doorX - doorWidth / 4, doorHeight / 2, roomLength / 2 - 0.1);
    scene.add(leftDoorGlass);

    // Right door glass
    const rightDoorGlass = new THREE.Mesh(
        new THREE.BoxGeometry(doorWidth / 2 - frameThickness * 1.5, doorHeight - frameThickness * 2, 0.05),
        glassMaterial
    );
    rightDoorGlass.position.set(doorX + doorWidth / 4, doorHeight / 2, roomLength / 2 - 0.1);
    scene.add(rightDoorGlass);

    // Door frame - vertical sides
    const leftFrame = new THREE.Mesh(
        new THREE.BoxGeometry(frameThickness, doorHeight, frameDepth),
        doorFrameMaterial
    );
    leftFrame.position.set(doorX - doorWidth / 2 + frameThickness / 2, doorHeight / 2, roomLength / 2);
    scene.add(leftFrame);

    const rightFrame = new THREE.Mesh(
        new THREE.BoxGeometry(frameThickness, doorHeight, frameDepth),
        doorFrameMaterial
    );
    rightFrame.position.set(doorX + doorWidth / 2 - frameThickness / 2, doorHeight / 2, roomLength / 2);
    scene.add(rightFrame);

    // Door frame - top
    const topFrame = new THREE.Mesh(
        new THREE.BoxGeometry(doorWidth, frameThickness, frameDepth),
        doorFrameMaterial
    );
    topFrame.position.set(doorX, doorHeight - frameThickness / 2, roomLength / 2);
    scene.add(topFrame);

    // Center divider
    const centerDivider = new THREE.Mesh(
        new THREE.BoxGeometry(frameThickness, doorHeight, frameDepth),
        doorFrameMaterial
    );
    centerDivider.position.set(doorX, doorHeight / 2, roomLength / 2);
    scene.add(centerDivider);

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
        { z: -roomLength / 2, y: centerLineY + bandThickness },       // Awal datar
        { z: -roomLength / 2 + 10, y: centerLineY + bandThickness },       // Masih datar
        //{ z: -roomLength / 2 + 8,  y: centerLineY + bandThickness - 1.2 }, // Mulai turun lebih curam (ditingkatkan dari -0.8 ke -1.2)
        { z: -roomLength / 2 + 13, y: centerLineY + bandThickness - 1.7 }, // Titik terendah yang lebih curam (ditingkatkan dari -1.2 ke -1.8)
        //{ z: roomLength / 2 - 10,   y: centerLineY + bandThickness - 1.6 }, // Mulai naik lagi, tapi dari posisi lebih rendah (ditingkatkan dari -1.0 ke -1.6)
        { z: roomLength / 2 - 5, y: centerLineY + bandThickness - 1.5 }, // Naik lebih tinggi (ditingkatkan dari -0.2 ke -0.7)
        { z: roomLength / 2, y: centerLineY + bandThickness - 0.7 }  // Akhir datar (ditingkatkan dari -0.2 ke -0.7)
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
    // TV Screen with stand (in front of middle tables)
    const tvGroup = new THREE.Group();

    // TV Screen
    const tvScreenGeo = new THREE.BoxGeometry(7, 4.0, 0.15);
    const tvScreen = new THREE.Mesh(tvScreenGeo, monitorMaterial);
    tvScreen.position.set(0, 5.5, 0); // Higher position on stand
    tvGroup.add(tvScreen);

    // TV Stand (vertical pole)
    const standGeo = new THREE.CylinderGeometry(0.15, 0.15, 5, 16);
    const standMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.5 });
    const stand = new THREE.Mesh(standGeo, standMat);
    stand.position.set(0, 2.5, -0.2); // Moved back behind the screen
    tvGroup.add(stand);

    // TV Base (floor stand)
    const baseGeo = new THREE.CylinderGeometry(0.6, 0.6, 0.15, 32);
    const base = new THREE.Mesh(baseGeo, standMat);
    base.position.set(0, 0.08, -0.2); // Moved back to align with stand
    tvGroup.add(base);

    // Position TV in front of middle tables (facing them)
    tvGroup.position.set(0, 0, -8);
    scene.add(tvGroup);

    // Step ceiling design with border frame (like in photo)
    const ceilingBorderWidth = 2.5;
    const ceilingBorderDepth = 0.4;
    const innerCeilingDepth = 0.3;

    // Border lights (on the stepped border area - lower position)
    const borderLightPositions = [
        // Back side (4 lights)
        [-6, -12], [-2, -12], [2, -12], [6, -12],
        // Front side (4 lights)
        [-6, 12], [-2, 12], [2, 12], [6, 12]
    ];

    borderLightPositions.forEach(([x, z]) => {
        // Point light for each bulb (like real light bulb)
        const pointLight = new THREE.PointLight(0xfff8f0, 0.9, 16, 2);
        pointLight.position.set(x, roomHeight - ceilingBorderDepth - 0.5, z);
        pointLight.castShadow = false;

        scene.add(pointLight);
        toggleableLights.push(pointLight);

        // Recessed ceiling fixture (rim)
        const fixtureRimGeo = new THREE.CylinderGeometry(0.22, 0.25, 0.15, 16);
        const fixtureRimMat = new THREE.MeshStandardMaterial({
            color: 0xe8e8e8,
            roughness: 0.4,
            metalness: 0.3
        });
        const fixtureRim = new THREE.Mesh(fixtureRimGeo, fixtureRimMat);
        fixtureRim.position.set(x, roomHeight - ceilingBorderDepth - innerCeilingDepth - 0.05, z);
        scene.add(fixtureRim);

        // Light bulb (emissive sphere)
        const bulbGeo = new THREE.SphereGeometry(0.12, 16, 16);
        const bulbMat = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            emissive: 0xfff8f0,
            emissiveIntensity: 0.6,
            roughness: 0.2,
            metalness: 0.0
        });
        const bulbMesh = new THREE.Mesh(bulbGeo, bulbMat);
        bulbMesh.position.set(x, roomHeight - ceilingBorderDepth - innerCeilingDepth - 0.25, z);
        scene.add(bulbMesh);

        // Store bulb reference for toggling emissive
        toggleableLights.push({ bulb: bulbMesh, originalEmissive: 0xfff8f0, originalIntensity: 0.8 });
    });

    // Center ceiling lights (on the higher center part - 6 lights: 3 left, 3 right)
    const centerLightPositions = [
        // Left side (3 lights)
        [-10, -6], [-10, 0], [-10, 6],
        // Right side (3 lights)
        [10, -6], [10, 0], [10, 6]
    ];

    centerLightPositions.forEach(([x, z]) => {
        // Point light for each bulb (like real light bulb)
        const pointLight = new THREE.PointLight(0xfff8f0, 0.9, 16, 2);
        pointLight.position.set(x, roomHeight - 0.5, z);
        pointLight.castShadow = false;

        scene.add(pointLight);
        toggleableLights.push(pointLight);

        // Recessed ceiling fixture (rim)
        const fixtureRimGeo = new THREE.CylinderGeometry(0.22, 0.25, 0.15, 16);
        const fixtureRimMat = new THREE.MeshStandardMaterial({
            color: 0xe8e8e8,
            roughness: 0.4,
            metalness: 0.3
        });
        const fixtureRim = new THREE.Mesh(fixtureRimGeo, fixtureRimMat);
        fixtureRim.position.set(x, roomHeight - 0.08, z);
        scene.add(fixtureRim);

        // Light bulb (emissive sphere)
        const bulbGeo = new THREE.SphereGeometry(0.12, 16, 16);
        const bulbMat = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            emissive: 0xfff8f0,
            emissiveIntensity: 0.6,
            roughness: 0.2,
            metalness: 0.0
        });
        const bulbMesh = new THREE.Mesh(bulbGeo, bulbMat);
        bulbMesh.position.set(x, roomHeight - 0.25, z);
        scene.add(bulbMesh);

        // Store bulb reference for toggling emissive
        toggleableLights.push({ bulb: bulbMesh, originalEmissive: 0xfff8f0, originalIntensity: 0.8 });
    });

    // Outer ceiling border frame
    const ceilingGeometry = new THREE.PlaneGeometry(roomWidth, roomLength);
    const ceilingMaterial = new THREE.MeshStandardMaterial({
        map: ceilingColorTex,
        roughnessMap: ceilingRoughTex,
        normalMap: ceilingNormTex,
        color: 0xffffff,
        roughness: 0.8
        // Removed 'emissive' so the texture shadow details are visible
    });
    const ceiling = new THREE.Mesh(ceilingGeometry, ceilingMaterial);
    ceiling.position.y = roomHeight;
    ceiling.rotation.x = Math.PI / 2;
    ceiling.receiveShadow = true;
    scene.add(ceiling);

    // Step down border (running around the perimeter)
    const borderMaterial = new THREE.MeshStandardMaterial({
        color: 0xe8e8e8,
        roughness: 0.7
    });

    // Top border (front)
    const borderTop = new THREE.Mesh(
        new THREE.BoxGeometry(roomWidth, ceilingBorderDepth, ceilingBorderWidth),
        borderMaterial
    );
    borderTop.position.set(0, roomHeight - ceilingBorderDepth / 2, roomLength / 2 - ceilingBorderWidth / 2);
    scene.add(borderTop);

    // Bottom border (back)
    const borderBottom = new THREE.Mesh(
        new THREE.BoxGeometry(roomWidth, ceilingBorderDepth, ceilingBorderWidth),
        borderMaterial
    );
    borderBottom.position.set(0, roomHeight - ceilingBorderDepth / 2, -roomLength / 2 + ceilingBorderWidth / 2);
    scene.add(borderBottom);

    // Left border
    const borderLeft = new THREE.Mesh(
        new THREE.BoxGeometry(ceilingBorderWidth, ceilingBorderDepth, roomLength - ceilingBorderWidth * 2),
        borderMaterial
    );
    borderLeft.position.set(-roomWidth / 2 + ceilingBorderWidth / 2, roomHeight - ceilingBorderDepth / 2, 0);
    scene.add(borderLeft);

    // Right border
    const borderRight = new THREE.Mesh(
        new THREE.BoxGeometry(ceilingBorderWidth, ceilingBorderDepth, roomLength - ceilingBorderWidth * 2),
        borderMaterial
    );
    borderRight.position.set(roomWidth / 2 - ceilingBorderWidth / 2, roomHeight - ceilingBorderDepth / 2, 0);
    scene.add(borderRight);

    // Inner recessed ceiling (center area)
    const innerCeilingWidth = roomWidth - ceilingBorderWidth * 2;
    const innerCeilingLength = roomLength - ceilingBorderWidth * 2;
    const innerCeilingMaterial = new THREE.MeshStandardMaterial({
        map: ceilingColorTex,
        roughnessMap: ceilingRoughTex,
        normalMap: ceilingNormTex,
        color: 0xf0f0f0, // Slightly darker/different shade for contrast
        roughness: 0.9
    });
    const innerCeiling = new THREE.Mesh(
        new THREE.PlaneGeometry(innerCeilingWidth, innerCeilingLength),
        innerCeilingMaterial
    );
    innerCeiling.position.set(0, roomHeight - ceilingBorderDepth - innerCeilingDepth, 0);
    innerCeiling.rotation.x = Math.PI / 2;
    innerCeiling.receiveShadow = true;
    scene.add(innerCeiling);

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

    // --- 2. LOAD THE AC MODEL (New!) ---
    // Make sure you deleted the old "acGroup" code block to avoid duplicates!

    // --- AC UNIT (Updated Position) ---
    const gltfLoader = new THREE.GLTFLoader();
    gltfLoader.load('models/air_condition_daikin.glb', function (gltf) {
        const ac = gltf.scene;
        ac.scale.set(1.5, 1.5, 1.5);
        ac.rotation.y = 0;

        // MOVED Y UP TO 4.2 (Very close to ceiling)
        ac.position.set(0, 9.5, -roomLength / 2 + 0.9);

        ac.traverse(n => { if (n.isMesh) { n.castShadow = true; n.receiveShadow = true; } });
        scene.add(ac);
    }, undefined, function (e) { console.error(e); });
    // SE Logo
    // const logoCanvas = document.createElement('canvas');
    // logoCanvas.width = 512; logoCanvas.height = 512;
    // const ctx = logoCanvas.getContext('2d');
    // ctx.fillStyle = '#fafafa'; ctx.fillRect(0, 0, 512, 512);
    // ctx.fillStyle = '#000000';
    // ctx.fillRect(100, 80, 140, 40); ctx.fillRect(100, 80, 40, 100);
    // ctx.fillRect(100, 140, 120, 40); ctx.fillRect(200, 140, 40, 100);
    // ctx.fillRect(100, 200, 140, 40); ctx.fillRect(280, 80, 40, 160);
    // ctx.fillRect(280, 80, 120, 40); ctx.fillRect(280, 140, 100, 40);
    // ctx.fillRect(280, 200, 120, 40);
    // ctx.font = 'bold 48px Arial'; ctx.textAlign = 'center';
    // ctx.fillText('SOFTWARE', 256, 300); ctx.fillText('ENGINEERING', 256, 360);
    // const logoTexture = new THREE.CanvasTexture(logoCanvas);
    // const logoMat = new THREE.MeshStandardMaterial({ map: logoTexture, color: 0xffffff, transparent: false });
    // const logoPlane = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 1.0), logoMat);
    // logoPlane.rotation.y = -Math.PI / 2;
    // logoPlane.position.set(roomWidth / 2 - 0.32, roomHeight * 0.63, 0);
    // scene.add(logoPlane);

    // SE Logo (Image Texture)
    const seLogoTexture = new THREE.TextureLoader().load('img/logo.png');
    const seLogoMaterial = new THREE.MeshStandardMaterial({
        map: seLogoTexture,
        transparent: true,
        roughness: 0.6,
        metalness: 0.1
    });
    const seLogoPlane = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 1.7), seLogoMaterial);
    seLogoPlane.rotation.y = -Math.PI / 2;
    seLogoPlane.position.set(roomWidth / 2 - 0.32, roomHeight * 0.75, 0);
    scene.add(seLogoPlane);

    // --- END: Pasted geometry code ---


    // --- Helper Functions (Same as before) ---
    function createChair(x, y, z, rotation) {
        const chairGroup = new THREE.Group();
        chairGroup.userData.collidable = true;
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

        // 1. Monitor Casing
        const screen = new THREE.Mesh(new THREE.BoxGeometry(1.7, 1.1, 0.08), monitorMaterial);
        screen.position.set(0, deskHeight + 0.75, 0);
        screen.castShadow = true;
        station.add(screen);

        // 2. Screen Content
        const display = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.0), screenContentMaterial);
        display.position.set(0, deskHeight + 0.75, 0.045);
        station.add(display);

        // 3. Stand
        const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.65, 8), monitorMaterial);
        stand.position.set(0, deskHeight + 0.33, -0.05);
        station.add(stand);

        // 4. Tower (Gaming PC - Bigger & RGB)
        // New Size: 0.6 width, 1.6 height, 1.8 depth
        const towerHeight = 1.6;
        const towerGeo = new THREE.BoxGeometry(0.6, towerHeight, 1.8);
        const tower = new THREE.Mesh(towerGeo, towerMaterial);

        // Position: Sits on floor (Y = height/2)
        tower.position.set(1.0, towerHeight / 2, 0);
        tower.castShadow = true;
        station.add(tower);

        // --- RGB STRIP DETAILS ---
        // A thin vertical glowing line on the front of the case
        const stripGeo = new THREE.BoxGeometry(0.05, 1.4, 0.02);
        const strip = new THREE.Mesh(stripGeo, rgbMaterial);
        // Position it on the front face of the tower
        // (x = relative to tower center, z = front of tower)
        strip.position.set(1.0 + 0.15, towerHeight / 2, 0.91);
        station.add(strip);

        // Optional: Second horizontal strip
        const strip2 = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.05, 0.02), rgbMaterial);
        strip2.position.set(1.0, towerHeight / 2 + 0.5, 0.91);
        station.add(strip2);

        // 5. Keyboard
        const keyboard = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.04, 0.45), monitorMaterial);
        keyboard.position.set(0, deskHeight, 0.7);
        keyboard.rotation.x = 0.08;
        station.add(keyboard);

        station.position.set(x, 0, z);
        station.rotation.y = rotation;
        scene.add(station);
    }


    function createDesk(width, depth, height, options = {}) {
        const powerChannel = options.powerChannel === true;
        const desk = new THREE.Group();
        desk.userData.collidable = true; // <--- TAGGED AS OBSTACLE

        const topThickness = 0.15;
        if (powerChannel) {
            // ---- Split tabletop into two boards with a center gap ----
            const gapWidth = 0.12; // small gap between the two boards
            const boardWidth = (width - gapWidth) / 2;
            const boardGeo = new THREE.BoxGeometry(boardWidth, topThickness, depth);

            const leftTop = new THREE.Mesh(boardGeo, deskMaterial);
            leftTop.position.set(-(gapWidth / 2 + boardWidth / 2), height - 0.08, 0);
            leftTop.castShadow = true;
            leftTop.receiveShadow = true;
            desk.add(leftTop);

            const rightTop = new THREE.Mesh(boardGeo, deskMaterial);
            rightTop.position.set(gapWidth / 2 + boardWidth / 2, height - 0.08, 0);
            rightTop.castShadow = true;
            rightTop.receiveShadow = true;
            desk.add(rightTop);

            // ---- Power channel recessed in the center gap ----
            const surfaceY = leftTop.position.y + topThickness / 2;

            // Metal channel running along table depth, slightly recessed
            const channelWidth = gapWidth * 0.9;
            const channelLength = depth * 0.95;
            const channelThickness = 0.02;
            const channelRecess = 0.012; // sink below surface a bit
            const channel = new THREE.Mesh(
                new THREE.BoxGeometry(channelWidth, channelThickness, channelLength),
                powerChannelMaterial
            );
            channel.position.set(0, surfaceY - channelRecess - channelThickness / 2, 0);
            channel.castShadow = false;
            channel.receiveShadow = true;
            desk.add(channel);

            // End covers similar to photo
            const capHeight = 0.06;
            const capLength = 0.16;
            [-1, 1].forEach(sign => {
                const cap = new THREE.Mesh(
                    new THREE.BoxGeometry(channelWidth, capHeight, capLength),
                    powerStripMaterial
                );
                cap.position.set(0, channel.position.y + channelThickness / 2 + capHeight / 2 + 0.004, sign * (channelLength / 2 - capLength / 2));
                cap.castShadow = true;
                cap.receiveShadow = true;
                desk.add(cap);
            });

            // Reusable geometries for strips
            const stripHeight = 0.05;
            const stripLength = 1.1;
            const stripWidth = 0.18;
            const stripY = channel.position.y + channelThickness / 2 + stripHeight / 2 + 0.01;
            const holeGeo = new THREE.CylinderGeometry(0.045, 0.045, 0.02, 16);
            const ledGeo = new THREE.SphereGeometry(0.02, 12, 12);

            function addStrip(zCenter) {
                const strip = new THREE.Mesh(
                    new THREE.BoxGeometry(stripWidth, stripHeight, stripLength),
                    powerStripMaterial
                );
                strip.position.set(0, stripY, zCenter);
                strip.castShadow = true;
                strip.receiveShadow = true;
                desk.add(strip);

                // Add five sockets
                const socketSpacing = stripLength / 6;
                for (let i = 0; i < 5; i++) {
                    const hole = new THREE.Mesh(holeGeo, powerHoleMaterial);
                    hole.position.set(0, stripHeight / 2 + 0.008, -stripLength / 2 + socketSpacing + i * socketSpacing);
                    strip.add(hole);
                }

                // Small LED indicator near one end
                const led = new THREE.Mesh(ledGeo, powerLedMaterial);
                led.position.set(stripWidth / 2 - 0.035, stripHeight / 2 + 0.01, stripLength / 2 - 0.1);
                strip.add(led);
            }

            // Two strips per table, spaced along the channel
            const stripOffset = depth * 0.25; // place roughly at 1/4 and -1/4 depth
            addStrip(stripOffset);
            addStrip(-stripOffset);
        } else {
            // Plain single-piece top for regular desks
            const topGeo = new THREE.BoxGeometry(width, topThickness, depth);
            const top = new THREE.Mesh(topGeo, deskMaterial);
            top.position.y = height - 0.08;
            top.castShadow = true;
            top.receiveShadow = true;
            desk.add(top);
        }

        // Legs 
        const legHeight = height - 0.1;
        const legGeo = new THREE.BoxGeometry(0.15, legHeight, 0.15);
        const positions = [
            [-width / 2 + 0.08, -depth / 2 + 0.08], [width / 2 - 0.08, -depth / 2 + 0.08],
            [-width / 2 + 0.08, depth / 2 - 0.08], [width / 2 - 0.08, depth / 2 - 0.08]
        ];

        positions.forEach(pos => {
            const leg = new THREE.Mesh(legGeo, legMaterial);
            leg.position.set(pos[0], legHeight / 2, pos[1]);
            desk.add(leg);
        });

        // Bars
        const barHeight = 0.08; const barThickness = 0.15;
        const frontBar = new THREE.Mesh(new THREE.BoxGeometry(width - 0.16, barHeight, barThickness), legMaterial);
        frontBar.position.set(0, barHeight / 2, -depth / 2 + 0.08);
        desk.add(frontBar);
        const backBar = new THREE.Mesh(new THREE.BoxGeometry(width - 0.16, barHeight, barThickness), legMaterial);
        backBar.position.set(0, barHeight / 2, depth / 2 - 0.08);
        desk.add(backBar);

        return desk;
    }

    // --- Layout Furniture ---
    const deskHeight = 2.9;
    const individualDeskWidth = 2.4;
    const individualDeskDepth = 3.6;
    const frontStartX = -roomWidth / 2 + 2;
    const frontSpacing = 2.05;

    // for (let i = 0; i < 14; i++) {
    //     const testX = frontStartX + i * frontSpacing;

    //     // Check distance to door (doorX is 5)
    //     if (Math.abs(testX - doorX) > 3.0 && testX < roomWidth / 2 - 1) {
    //         createCabinet(testX, roomLength / 2 - 0.3, Math.PI);
    //     }
    // }

    // LEFT WALL: 8 individual tables 
    const numLeftTables = 8;
    const leftStartZ = -12;
    const leftSpacingZ = individualDeskDepth; // Gap between tables 

    for (let i = 0; i < numLeftTables; i++) {
        const zPos = leftStartZ + i * leftSpacingZ;
        const xPos = -roomWidth / 2 + individualDeskWidth / 2 + 0.3;

        const desk = createDesk(individualDeskWidth, individualDeskDepth, deskHeight);
        desk.position.set(xPos, 0, zPos);
        scene.add(desk);

        createComputerStation(xPos, deskHeight, zPos, Math.PI / 2);
        createChair(xPos + individualDeskWidth / 2 + 0.6, 0, zPos, Math.PI / 2);
    }

    // RIGHT WALL: 8 individual tables
    const numRightTables = 8;

    for (let i = 0; i < numRightTables; i++) {
        const zPos = leftStartZ + i * leftSpacingZ;
        const xPos = roomWidth / 2 - individualDeskWidth / 2 - 0.3;

        const desk = createDesk(individualDeskWidth, individualDeskDepth, deskHeight);
        desk.position.set(xPos, 0, zPos);
        scene.add(desk);

        createComputerStation(xPos, deskHeight, zPos, -Math.PI / 2);
        createChair(xPos - individualDeskWidth / 2 - 0.6, 0, zPos, -Math.PI / 2);
    }

    // BACK WALL: 4 individual tables
    const numBackTables = 4;
    const backTableSpacingX = individualDeskDepth;
    const backStartX = -individualDeskDepth * 2 + individualDeskDepth / 2;

    for (let i = 0; i < numBackTables; i++) {
        const xPos = backStartX + i * backTableSpacingX;
        const zPos = -roomLength / 2 + individualDeskWidth / 2 + 0.3;

        const desk = createDesk(individualDeskDepth, individualDeskWidth, deskHeight);
        desk.position.set(xPos, 0, zPos);
        scene.add(desk);

        createComputerStation(xPos, deskHeight, zPos, 0);

        // --- CHANGE THIS LINE (0.6 -> 1.0) ---
        createChair(xPos, 0, zPos + individualDeskWidth / 2 + 1.0, 0);
        // -------------------------------------
    }

    // CENTER: single combined table with one channel and 8 strips
    const centerDeskWidth = individualDeskWidth;
    const centerDeskDepth = individualDeskDepth;
    const centerSpacingZ = individualDeskDepth;
    const centerStartZ = -5;
    const centerGap = 0;
    const centerRows = 4;

    // Create one big table covering the center rows
    const combinedWidth = centerDeskWidth * 2;
    const combinedDepth = centerSpacingZ * centerRows;
    const combinedZCenter = centerStartZ + ((centerRows - 1) * centerSpacingZ) / 2;

    const centerDesk = createDesk(combinedWidth, combinedDepth, deskHeight, { powerChannel: true });
    centerDesk.position.set(0, 0, combinedZCenter);
    scene.add(centerDesk);

    // Chairs remain per row on each side
    for (let i = 0; i < centerRows; i++) {
        const zPos = centerStartZ + i * centerSpacingZ;
        const xPosLeft = -centerGap / 2 - centerDeskWidth / 2;
        const xPosRight = centerGap / 2 + centerDeskWidth / 2;

        createChair(xPosLeft - centerDeskWidth / 2 - 0.6, 0, zPos, -Math.PI / 2); // Chair on LEFT side
        createChair(xPosRight + centerDeskWidth / 2 + 0.6, 0, zPos, Math.PI / 2); // Chair on RIGHT side
    }
    scene.updateMatrixWorld(true);

    // Create Bookshelf and Cabinet System
    function createBookshelfAndCabinet() {
        const group = new THREE.Group();

        const woodMaterial = deskMaterial;
        const separatorMaterial = woodMaterial;

        // Dimensions
        const totalTargetWidth = 18.0;
        const separatorWidth = 0.4;
        // const cornerBlockWidth = 0.8;

        const availableWidth = totalTargetWidth - (2 * separatorWidth);
        const baseWidth = availableWidth / 4;

        const leftWidth = baseWidth;
        const middleWidth = baseWidth * 2;
        const rightWidth = baseWidth;

        const depth = 0.8;

        const bottomCabinetHeight = 3.5;
        const bookshelfHeight = 4.0;
        const topCabinetHeight = 2.625;
        const horizontalSeparatorHeight = 0.05;

        const leftDoors = 2;
        const middleDoors = 4;
        const rightDoors = 2;

        function createCabinet(width, height, depth, doors) {
            const cabinetGroup = new THREE.Group();
            const wallThickness = 0.05;
            const back = new THREE.Mesh(new THREE.BoxGeometry(width, height, wallThickness), woodMaterial);
            back.position.z = -depth / 2 + wallThickness / 2;
            cabinetGroup.add(back);

            const sideGeo = new THREE.BoxGeometry(wallThickness, height, depth);
            const leftSide = new THREE.Mesh(sideGeo, woodMaterial);
            leftSide.position.x = -width / 2 + wallThickness / 2;
            cabinetGroup.add(leftSide);
            const rightSide = new THREE.Mesh(sideGeo, woodMaterial);
            rightSide.position.x = width / 2 - wallThickness / 2;
            cabinetGroup.add(rightSide);

            const plateGeo = new THREE.BoxGeometry(width, wallThickness, depth);
            const topPlate = new THREE.Mesh(plateGeo, woodMaterial);
            topPlate.position.y = height / 2 - wallThickness / 2;
            cabinetGroup.add(topPlate);
            const bottomPlate = new THREE.Mesh(plateGeo, woodMaterial);
            bottomPlate.position.y = -height / 2 + wallThickness / 2;
            cabinetGroup.add(bottomPlate);

            const frameThickness = 0.02;
            const doorWidth = (width - frameThickness * (doors + 1)) / doors;
            const doorHeight = height - 2 * frameThickness;
            const doorDepth = 0.03;

            let doorX = -width / 2 + frameThickness + doorWidth / 2;

            for (let i = 0; i < doors; i++) {
                const door = new THREE.Mesh(
                    new THREE.BoxGeometry(doorWidth, doorHeight, doorDepth),
                    woodMaterial
                );
                door.position.set(doorX, 0, depth / 2 - doorDepth / 2);
                door.castShadow = true;
                cabinetGroup.add(door);
                doorX += doorWidth + frameThickness;
            }
            return cabinetGroup;
        }

        function createBookshelf(width, height, depth, isHollow, config) {
            const shelfGroup = new THREE.Group();
            const wallThickness = 0.05;

            const actualDepth = isHollow ? depth + 0.5 : depth;
            const zOffset = isHollow ? -0.25 : 0;

            if (!isHollow) {
                const back = new THREE.Mesh(new THREE.BoxGeometry(width, height, wallThickness), woodMaterial);
                back.position.z = -depth / 2 + wallThickness / 2;
                back.castShadow = true;
                back.receiveShadow = true;
                shelfGroup.add(back);
            } else {
                const back = new THREE.Mesh(new THREE.BoxGeometry(width, height, wallThickness), woodMaterial);
                back.position.z = -actualDepth / 2 + wallThickness / 2 + zOffset;
                back.castShadow = true;
                back.receiveShadow = true;
                shelfGroup.add(back);

                const extDepth = actualDepth;
                const extPlateGeo = new THREE.BoxGeometry(width, wallThickness, extDepth);

                const topPlate = new THREE.Mesh(extPlateGeo, woodMaterial);
                topPlate.position.set(0, height / 2 - wallThickness / 2, zOffset);
                shelfGroup.add(topPlate);

                const bottomPlate = new THREE.Mesh(extPlateGeo, woodMaterial);
                bottomPlate.position.set(0, -height / 2 + wallThickness / 2, zOffset);
                shelfGroup.add(bottomPlate);
            }

            const sideGeo = new THREE.BoxGeometry(wallThickness, height, isHollow ? actualDepth : depth);
            const leftSide = new THREE.Mesh(sideGeo, woodMaterial);
            leftSide.position.set(-width / 2 + wallThickness / 2, 0, isHollow ? zOffset : 0);
            leftSide.castShadow = true;
            shelfGroup.add(leftSide);

            const rightSide = new THREE.Mesh(sideGeo, woodMaterial);
            rightSide.position.set(width / 2 - wallThickness / 2, 0, isHollow ? zOffset : 0);
            rightSide.castShadow = true;
            shelfGroup.add(rightSide);

            // --- INTERNAL SHELVES & DIVIDERS (Spacings) ---
            if (config) {
                // Horizontal Shelves
                if (config.horizontalShelves > 0) {
                    const shelfSpacing = height / (config.horizontalShelves + 1);
                    const shelfGeo = new THREE.BoxGeometry(width - wallThickness * 2, wallThickness, isHollow ? actualDepth - 0.1 : depth - 0.1);

                    for (let i = 1; i <= config.horizontalShelves; i++) {
                        const shelf = new THREE.Mesh(shelfGeo, woodMaterial);
                        shelf.position.set(0, -height / 2 + i * shelfSpacing, isHollow ? zOffset : 0);
                        shelf.castShadow = true;
                        shelf.receiveShadow = true;
                        shelfGroup.add(shelf);
                    }
                }

                // Vertical Dividers
                if (config.verticalDividers > 0) {
                    const divSpacing = width / (config.verticalDividers + 1);
                    const divGeo = new THREE.BoxGeometry(wallThickness, height - wallThickness * 2, isHollow ? actualDepth - 0.1 : depth - 0.1);

                    for (let i = 1; i <= config.verticalDividers; i++) {
                        const div = new THREE.Mesh(divGeo, woodMaterial);
                        div.position.set(-width / 2 + i * divSpacing, 0, isHollow ? zOffset : 0);
                        div.castShadow = true;
                        div.receiveShadow = true;
                        shelfGroup.add(div);
                    }
                }
            }

            if (!isHollow) {
                const plateGeo = new THREE.BoxGeometry(width, wallThickness, depth);
                const topPlate = new THREE.Mesh(plateGeo, woodMaterial);
                topPlate.position.y = height / 2 - wallThickness / 2;
                topPlate.castShadow = true;
                topPlate.receiveShadow = true;
                shelfGroup.add(topPlate);

                const bottomPlate = new THREE.Mesh(plateGeo, woodMaterial);
                bottomPlate.position.y = -height / 2 + wallThickness / 2;
                bottomPlate.castShadow = true;
                bottomPlate.receiveShadow = true;
                shelfGroup.add(bottomPlate);

                const shelfGeo = new THREE.BoxGeometry(width - 2 * wallThickness, wallThickness, depth - wallThickness);
                const shelf = new THREE.Mesh(shelfGeo, woodMaterial);
                shelf.position.z = wallThickness / 2;
                shelf.castShadow = true;
                shelf.receiveShadow = true;
                shelfGroup.add(shelf);
            }

            return shelfGroup;
        }

        function createVerticalSection(width, doors, topDoors, isHollow, shelfConfig) {
            const sectionGroup = new THREE.Group();

            const bottomCabinet = createCabinet(width, bottomCabinetHeight, depth, doors);
            bottomCabinet.position.y = bottomCabinetHeight / 2;
            sectionGroup.add(bottomCabinet);

            const hSeparator1 = new THREE.Mesh(new THREE.BoxGeometry(width, horizontalSeparatorHeight, depth), separatorMaterial);
            hSeparator1.position.y = bottomCabinetHeight + horizontalSeparatorHeight / 2;
            hSeparator1.castShadow = true;
            sectionGroup.add(hSeparator1);

            const bookshelf = createBookshelf(width, bookshelfHeight, depth, isHollow, shelfConfig);
            bookshelf.position.y = bottomCabinetHeight + horizontalSeparatorHeight + bookshelfHeight / 2;
            sectionGroup.add(bookshelf);

            const hSeparator2 = new THREE.Mesh(new THREE.BoxGeometry(width, horizontalSeparatorHeight, depth), separatorMaterial);
            hSeparator2.position.y = bottomCabinetHeight + horizontalSeparatorHeight + bookshelfHeight + horizontalSeparatorHeight / 2;
            hSeparator2.castShadow = true;
            sectionGroup.add(hSeparator2);

            const topCabinet = createCabinet(width, topCabinetHeight, depth, topDoors);
            topCabinet.position.y = bottomCabinetHeight + horizontalSeparatorHeight * 2 + bookshelfHeight + topCabinetHeight / 2;
            sectionGroup.add(topCabinet);

            return sectionGroup;
        }

        const totalHeight = bottomCabinetHeight + bookshelfHeight + topCabinetHeight + 2 * horizontalSeparatorHeight;
        let currentX = -totalTargetWidth / 2;

        // const cornerBlock = new THREE.Mesh(
        //     new THREE.BoxGeometry(cornerBlockWidth, totalHeight, depth),
        //     woodMaterial
        // );
        // cornerBlock.position.set(currentX + cornerBlockWidth / 2, totalHeight / 2, 0);
        // cornerBlock.castShadow = true;
        // group.add(cornerBlock);
        // currentX += cornerBlockWidth;

        const leftSection = createVerticalSection(leftWidth, leftDoors, leftDoors, true, { horizontalShelves: 1, verticalDividers: 0 });
        leftSection.position.x = currentX + leftWidth / 2;
        group.add(leftSection);
        currentX += leftWidth;

        currentX += separatorWidth / 2;
        const separator1 = new THREE.Mesh(new THREE.BoxGeometry(separatorWidth, totalHeight, depth), separatorMaterial);
        separator1.position.x = currentX;
        separator1.position.y = totalHeight / 2;
        group.add(separator1);
        currentX += separatorWidth / 2;

        const middleSection = createVerticalSection(middleWidth, middleDoors, middleDoors, true, { horizontalShelves: 1, verticalDividers: 1 });
        middleSection.position.x = currentX + middleWidth / 2;
        group.add(middleSection);
        currentX += middleWidth;

        currentX += separatorWidth / 2;
        const separator2 = new THREE.Mesh(new THREE.BoxGeometry(separatorWidth, totalHeight, depth), separatorMaterial);
        separator2.position.x = currentX;
        separator2.position.y = totalHeight / 2;
        group.add(separator2);
        currentX += separatorWidth / 2;

        const rightSection = createVerticalSection(rightWidth, rightDoors, rightDoors, true, { horizontalShelves: 1, verticalDividers: 0 });
        rightSection.position.x = currentX + rightWidth / 2;
        group.add(rightSection);

        group.rotation.y = Math.PI;
        group.position.set(4.5, 0, 18);
        group.userData.collidable = true;

        scene.add(group);
    }

    createBookshelfAndCabinet();

    collisionObstacles = [];
    scene.traverse(function (object) {
        if (object.userData.collidable === true) {
            // Create a bounding box that fits the object tight
            const box = new THREE.Box3().setFromObject(object);
            collisionObstacles.push(box);
        }
    });

    // --- 1. ADD BACK WALL CABINETS (New!) ---
    // A row of low storage cabinets under the back window



    // --- 2. DEFINE THE FUNCTION ---
    // function createCabinet(x, z, rotationY) {
    //     const cabGroup = new THREE.Group();
    //     cabGroup.userData.collidable = true;

    //     // Body
    //     const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 1.2, 0.6), cabinetMaterial);
    //     body.position.y = 0.6;
    //     body.castShadow = true;
    //     cabGroup.add(body);

    //     // Gap (Visual detail)
    //     const gap = new THREE.Mesh(new THREE.BoxGeometry(0.02, 1.1, 0.61), new THREE.MeshStandardMaterial({ color: 0xaaaaaa }));
    //     gap.position.set(0, 0.6, 0);
    //     cabGroup.add(gap);

    //     // Handles
    //     const hGeo = new THREE.BoxGeometry(0.05, 0.2, 0.02);
    //     const h1 = new THREE.Mesh(hGeo, cabinetHandleMat); h1.position.set(-0.1, 0.9, 0.31); cabGroup.add(h1);
    //     const h2 = new THREE.Mesh(hGeo, cabinetHandleMat); h2.position.set(0.1, 0.9, 0.31); cabGroup.add(h2);

    //     // Kickplate
    //     const kick = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.1, 0.58), new THREE.MeshStandardMaterial({ color: 0x333333 }));
    //     kick.position.set(0, 0.05, 0);
    //     cabGroup.add(kick);

    //     cabGroup.position.set(x, 0, z);
    //     cabGroup.rotation.y = rotationY;
    //     scene.add(cabGroup);

    //     // Add collision box
    //     scene.updateMatrixWorld(true);
    //     const box = new THREE.Box3().setFromObject(cabGroup);
    //     collisionObstacles.push(box);
    // }
    // Window resize
    window.addEventListener('resize', onWindowResize, false);
}

/**
 * Toggles the visibility of all lights in the toggleableLights array.
 */
function toggleLights() {
    lightsOn = !lightsOn;
    toggleableLights.forEach(item => {
        if (item.bulb) {
            // Toggle bulb emissive
            if (lightsOn) {
                item.bulb.material.emissive.setHex(item.originalEmissive);
                item.bulb.material.emissiveIntensity = item.originalIntensity;
            } else {
                item.bulb.material.emissive.setHex(0x000000);
                item.bulb.material.emissiveIntensity = 0;
            }
        } else {
            // Regular light toggle
            item.visible = lightsOn;
        }
    });
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
    requestAnimationFrame(animate);

    const time = performance.now();
    const delta = (time - prevTime) / 1000;

    // --- NEW: RGB ANIMATION ---
    if (rgbMaterial) {
        // Cycle the Hue (0 to 1) over time. 
        // 0.0005 controls the speed (Smaller = Slower)
        const hue = (time * 0.0005) % 1;
        rgbMaterial.emissive.setHSL(hue, 1, 0.5);
    }

    if (controls.isLocked === true) {
        // 1. SAVE OLD POSITION (Safe spot)
        const oldPosition = controls.getObject().position.clone();

        // Physics calculations
        velocity.x -= velocity.x * 10.0 * delta;
        velocity.z -= velocity.z * 10.0 * delta;
        velocity.y -= 9.8 * 50.0 * delta;

        direction.z = Number(moveForward) - Number(moveBackward);
        direction.x = Number(moveRight) - Number(moveLeft);
        direction.normalize();

        if (moveForward || moveBackward) velocity.z -= direction.z * 150.0 * delta;
        if (moveLeft || moveRight) velocity.x -= direction.x * 150.0 * delta;

        // 2. MOVE PLAYER
        controls.moveRight(-velocity.x * delta);
        controls.moveForward(-velocity.z * delta);
        controls.getObject().position.y += (velocity.y * delta);

        // 3. COLLISION CHECK (FIXED!)
        const playerBox = new THREE.Box3();

        // We clone the position so we don't move the actual camera
        const bodyPosition = controls.getObject().position.clone();

        // VITAL FIX: Lower the check to torso height (1.5) instead of head height (5.0)
        bodyPosition.y = 1.5;

        // Create a box 1m wide and 3m tall
        const playerSize = new THREE.Vector3(1.0, 3.0, 1.0);
        playerBox.setFromCenterAndSize(bodyPosition, playerSize);

        for (let i = 0; i < collisionObstacles.length; i++) {
            if (playerBox.intersectsBox(collisionObstacles[i])) {
                // We hit something! Reset to old position.
                controls.getObject().position.copy(oldPosition);
                velocity.x = 0;
                velocity.z = 0;
                break;
            }
        }

        // Floor Collision
        if (controls.getObject().position.y < 5) {
            velocity.y = 0;
            controls.getObject().position.y = 5;
            canJump = true;
        }

        // Wall Boundaries
        const camPos = controls.getObject().position;
        if (camPos.x < boundaries.xMin) { camPos.x = boundaries.xMin; velocity.x = 0; }
        if (camPos.x > boundaries.xMax) { camPos.x = boundaries.xMax; velocity.x = 0; }
        if (camPos.z < boundaries.zMin) { camPos.z = boundaries.zMin; velocity.z = 0; }
        if (camPos.z > boundaries.zMax) { camPos.z = boundaries.zMax; velocity.z = 0; }
    }

    prevTime = time;
    stats.update();
    renderer.render(scene, camera);
}
