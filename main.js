let scene, camera, renderer, controls, stats;
let infoElement;
let rgbMaterial;
let shadowCastingLights = [];

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
let coveLights = [];       // Array for the hidden strip lights
let downLights = [];       // Array for the 4 recessed bulbs
let coveActive = true;     // State for cove lights
let downLightsActive = true; // State for bulbs
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
                toggleMasterSwitch(); // New Master Toggle
                break;
            case 'Digit1': // Press '1'
                toggleCoveLights();
                break;
            case 'Digit2': // Press '2'
                toggleDownLights();
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
    shadowCastingLights.push(directionalLight);

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
        color: 0xaaaaaa, // Keep it white
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
        roughness: 0.02,
        transmission: 1,
        transparent: true,
        opacity: 0.12,
        ior: 1.45,
        thickness: 0.18,
        side: THREE.DoubleSide
    });
    const frostedGlassMaterial = new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        metalness: 0,
        roughness: 0.9,
        transmission: 0.35,
        transparent: true,
        opacity: 0.85,
        thickness: 0.4
    });
    const doorFrameMaterial = new THREE.MeshStandardMaterial({
        color: 0x3b2b20, // dark brown cladding
        roughness: 0.45,
        metalness: 0.25
    });
    const stainlessMaterial = new THREE.MeshStandardMaterial({
        color: 0xb5b5b5,
        roughness: 0.2,
        metalness: 0.85
    });
    const doorLogoMaterial = new THREE.MeshStandardMaterial({
        color: 0x6c5141,
        roughness: 0.6,
        metalness: 0.05,
        transparent: true,
        opacity: 0.95
    });
    // EXIT sign texture with white text on green background
    const exitCanvas = document.createElement('canvas');
    exitCanvas.width = 256;
    exitCanvas.height = 128;
    const exitCtx = exitCanvas.getContext('2d');
    exitCtx.fillStyle = '#0f5d2b';
    exitCtx.fillRect(0, 0, exitCanvas.width, exitCanvas.height);
    exitCtx.fillStyle = '#ffffff';
    exitCtx.font = 'bold 80px sans-serif';
    exitCtx.textAlign = 'center';
    exitCtx.textBaseline = 'middle';
    exitCtx.fillText('EXIT', exitCanvas.width / 2, exitCanvas.height / 2);
    const exitTexture = new THREE.CanvasTexture(exitCanvas);
    exitTexture.needsUpdate = true;
    const exitSignMaterial = new THREE.MeshBasicMaterial({ map: exitTexture, transparent: true, side: THREE.DoubleSide });
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

    // Wall sections around door (fill left/right gaps with the same wall material)
    const frontWallDepth = 0.3;
    const frontWallZ = roomLength / 2;
    const leftEdge = -roomWidth / 2;
    const rightEdge = roomWidth / 2;
    const doorLeft = doorX - doorWidth / 2;
    const doorRight = doorX + doorWidth / 2;

    const frontWallLeftWidth = Math.max(0, doorLeft - leftEdge);
    if (frontWallLeftWidth > 0.01) {
        const frontWallLeft = new THREE.Mesh(
            new THREE.BoxGeometry(frontWallLeftWidth, roomHeight, frontWallDepth),
            wallMaterial
        );
        frontWallLeft.position.set(leftEdge + frontWallLeftWidth / 2, roomHeight / 2, frontWallZ);
        frontWallLeft.receiveShadow = true;
        scene.add(frontWallLeft);
    }

    const frontWallRightWidth = Math.max(0, rightEdge - doorRight);
    if (frontWallRightWidth > 0.01) {
        const frontWallRight = new THREE.Mesh(
            new THREE.BoxGeometry(frontWallRightWidth, roomHeight, frontWallDepth),
            wallMaterial
        );
        frontWallRight.position.set(doorRight + frontWallRightWidth / 2, roomHeight / 2, frontWallZ);
        frontWallRight.receiveShadow = true;
        scene.add(frontWallRight);
    }

    // Top section above door
    const frontWallTop = new THREE.Mesh(
        new THREE.BoxGeometry(doorWidth, roomHeight - doorHeight, 0.3),
        wallMaterial
    );
    frontWallTop.position.set(doorX, roomHeight - (roomHeight - doorHeight) / 2, roomLength / 2);
    frontWallTop.receiveShadow = true;
    scene.add(frontWallTop);

    // Double glass doors with frame + hardware (front entrance)
    const frameThickness = 0.18;
    const frameDepth = 0.35;
    const leafWidth = doorWidth / 2 - frameThickness * 1.4;
    const leafHeight = doorHeight - frameThickness * 1.4;

    // Glass leaves
    const leftDoorGlass = new THREE.Mesh(
        new THREE.BoxGeometry(leafWidth, leafHeight, 0.05),
        glassMaterial
    );
    leftDoorGlass.position.set(doorX - doorWidth / 4, doorHeight / 2, roomLength / 2 - 0.1);
    scene.add(leftDoorGlass);

    const rightDoorGlass = new THREE.Mesh(
        new THREE.BoxGeometry(leafWidth, leafHeight, 0.05),
        glassMaterial
    );
    rightDoorGlass.position.set(doorX + doorWidth / 4, doorHeight / 2, roomLength / 2 - 0.1);
    scene.add(rightDoorGlass);

    // Frosted film + simple stripe motif
    const frostHeight = leafHeight * 0.6;
    const frostWidth = leafWidth * 0.96;
    const frostOffsetZ = 0.03;

    function addFrostPanel(xPos) {
        const frost = new THREE.Mesh(new THREE.PlaneGeometry(frostWidth, frostHeight), frostedGlassMaterial);
        frost.position.set(xPos, doorHeight / 2, roomLength / 2 - 0.1 + frostOffsetZ);
        frost.rotation.y = Math.PI; // face interior
        scene.add(frost);

        // Two stripes to hint the logo layout
        const stripeLength = frostWidth * 0.9;
        const stripeHeight = frostHeight * 0.16;
        const stripeOffsetZ = 0.001;

        const stripeTop = new THREE.Mesh(new THREE.PlaneGeometry(stripeLength, stripeHeight), doorLogoMaterial);
        stripeTop.position.set(xPos, doorHeight / 2 + stripeHeight * 1.6, roomLength / 2 - 0.1 + frostOffsetZ + stripeOffsetZ);
        stripeTop.rotation.y = Math.PI;
        scene.add(stripeTop);

        const stripeBottom = stripeTop.clone();
        stripeBottom.position.y = doorHeight / 2 - stripeHeight * 1.6;
        scene.add(stripeBottom);
    }
    // addFrostPanel(doorX - doorWidth / 4);
    // addFrostPanel(doorX + doorWidth / 4);

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

    // Transom glass (clear) above doors
    const transomHeight = 1.0;
    const transom = new THREE.Mesh(
        new THREE.BoxGeometry(doorWidth, transomHeight, 0.08),
        glassMaterial
    );
    transom.position.set(doorX, doorHeight + transomHeight / 2, roomLength / 2 - 0.11);
    scene.add(transom);

    // Side frosted panels
    const sidePanelWidth = 1.2;
    const sidePanelHeight = doorHeight + transomHeight - 0.2;
    const sidePanelZ = roomLength / 2 - 0.11;

    const leftSidePanel = new THREE.Mesh(
        new THREE.BoxGeometry(sidePanelWidth, sidePanelHeight, 0.05),
        frostedGlassMaterial
    );
    leftSidePanel.position.set(doorX - doorWidth / 2 - sidePanelWidth / 2 - 0.1, sidePanelHeight / 2, sidePanelZ);
    scene.add(leftSidePanel);

    const rightSidePanel = new THREE.Mesh(
        new THREE.BoxGeometry(sidePanelWidth, sidePanelHeight, 0.05),
        frostedGlassMaterial
    );
    rightSidePanel.position.set(doorX + doorWidth / 2 + sidePanelWidth / 2 + 0.1, sidePanelHeight / 2, sidePanelZ);
    scene.add(rightSidePanel);

    // Portal-style cladding inspired by reference photo
    const portalColumnWidth = 0.75;
    const portalColumnDepth = 0.45;
    const portalHeight = doorHeight + transomHeight + 0.35;
    const portalInset = 0.08;
    const portalZ = roomLength / 2 - portalColumnDepth / 2 + 0.02;

    const columnGeo = new THREE.BoxGeometry(portalColumnWidth, portalHeight, portalColumnDepth);
    const leftPortalColumn = new THREE.Mesh(columnGeo, doorFrameMaterial);
    leftPortalColumn.position.set(doorLeft - portalInset - portalColumnWidth / 2, portalHeight / 2, portalZ);
    leftPortalColumn.castShadow = true;
    leftPortalColumn.receiveShadow = true;
    scene.add(leftPortalColumn);

    const rightPortalColumn = leftPortalColumn.clone();
    rightPortalColumn.position.x = doorRight + portalInset + portalColumnWidth / 2;
    scene.add(rightPortalColumn);

    const portalHeaderHeight = portalHeight - doorHeight;
    const portalHeaderWidth = doorWidth + 2 * (portalColumnWidth + portalInset);
    const portalHeader = new THREE.Mesh(
        new THREE.BoxGeometry(portalHeaderWidth, portalHeaderHeight, portalColumnDepth),
        doorFrameMaterial
    );
    portalHeader.position.set(doorX, doorHeight + portalHeaderHeight / 2, portalZ);
    portalHeader.castShadow = true;
    portalHeader.receiveShadow = true;
    scene.add(portalHeader);

    // Access control panel + illuminated button
    const accessPanel = new THREE.Mesh(new THREE.BoxGeometry(0.32, 1.0, 0.06), towerMaterial);
    accessPanel.position.set(leftPortalColumn.position.x + portalColumnWidth / 2 - 0.18, 1.2, portalZ + portalColumnDepth / 2 - 0.03);
    accessPanel.castShadow = true;
    accessPanel.receiveShadow = true;
    scene.add(accessPanel);

    const accessRing = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.05, 32), powerChannelMaterial);
    accessRing.rotation.x = Math.PI / 2;
    accessRing.position.set(accessPanel.position.x, accessPanel.position.y + 0.05, portalZ + portalColumnDepth / 2 + 0.005);
    scene.add(accessRing);

    const accessButton = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.03, 24), powerLedMaterial);
    accessButton.rotation.x = Math.PI / 2;
    accessButton.position.copy(accessRing.position);
    accessButton.position.z += 0.015;
    scene.add(accessButton);

    // Handles (stainless) + push plates
    const handleHeight = 2.2;
    const handleDepth = 0.12;
    const handleWidth = 0.14;
    const handleOffsetX = leafWidth * 0.22;
    const handleY = doorHeight / 2;
    const handleZ = roomLength / 2 - 0.06;

    const leftHandle = new THREE.Mesh(
        new THREE.BoxGeometry(handleWidth, handleHeight, handleDepth),
        stainlessMaterial
    );
    leftHandle.position.set(doorX - doorWidth / 4 + handleOffsetX, handleY, handleZ);
    scene.add(leftHandle);

    const rightHandle = new THREE.Mesh(
        new THREE.BoxGeometry(handleWidth, handleHeight, handleDepth),
        stainlessMaterial
    );
    rightHandle.position.set(doorX + doorWidth / 4 - handleOffsetX, handleY, handleZ);
    scene.add(rightHandle);

    const pushPlateWidth = 0.28;
    const pushPlateHeight = 0.9;
    const pushPlateZ = handleZ + 0.03;

    const leftPush = new THREE.Mesh(new THREE.PlaneGeometry(pushPlateWidth, pushPlateHeight), stainlessMaterial);
    leftPush.position.set(leftHandle.position.x, handleY, pushPlateZ);
    leftPush.rotation.y = Math.PI;
    scene.add(leftPush);

    const rightPush = leftPush.clone();
    rightPush.position.x = rightHandle.position.x;
    scene.add(rightPush);

    // Floor patch hinges (bottom pivot/closer) + top patches
    const patchWidth = 0.35;
    const patchDepth = 0.22;
    const patchHeight = 0.06;
    const patchZ = roomLength / 2 - patchDepth / 2;

    const leftBottomPatch = new THREE.Mesh(
        new THREE.BoxGeometry(patchWidth, patchHeight, patchDepth),
        stainlessMaterial
    );
    leftBottomPatch.position.set(doorX - doorWidth / 4, patchHeight / 2, patchZ);
    scene.add(leftBottomPatch);

    const rightBottomPatch = leftBottomPatch.clone();
    rightBottomPatch.position.x = doorX + doorWidth / 4;
    scene.add(rightBottomPatch);

    const topPatchHeight = 0.07;
    const topPatchZ = roomLength / 2 - 0.09;

    const leftTopPatch = new THREE.Mesh(
        new THREE.BoxGeometry(patchWidth, topPatchHeight, patchDepth * 0.7),
        stainlessMaterial
    );
    leftTopPatch.position.set(doorX - doorWidth / 4, doorHeight - topPatchHeight / 2, topPatchZ);
    scene.add(leftTopPatch);

    const rightTopPatch = leftTopPatch.clone();
    rightTopPatch.position.x = doorX + doorWidth / 4;
    scene.add(rightTopPatch);

    // EXIT signage assembly protruding above the portal
    const exitSignWidth = 1.35;
    const exitSignHeight = 0.45;
    const exitSignDepth = 0.08;
    const exitSignY = portalHeight - exitSignHeight / 2 - 0.08;
    const exitSignZ = portalZ + portalColumnDepth / 2 + exitSignDepth / 2 + 0.05;

    const exitSignBaseMaterial = new THREE.MeshStandardMaterial({
        color: 0x0f5d2b,
        emissive: 0x0f5d2b,
        emissiveIntensity: 0.4,
        roughness: 0.35
    });
    const exitSignBase = new THREE.Mesh(new THREE.BoxGeometry(exitSignWidth, exitSignHeight, exitSignDepth), exitSignBaseMaterial);
    exitSignBase.castShadow = true;
    exitSignBase.receiveShadow = true;

    const exitSignFace = new THREE.Mesh(
        new THREE.PlaneGeometry(exitSignWidth * 0.92, exitSignHeight * 0.6),
        exitSignMaterial
    );
    exitSignFace.position.z = exitSignDepth / 2 + 0.001;

    const exitSignFaceBack = exitSignFace.clone();
    exitSignFaceBack.rotation.y = Math.PI;
    exitSignFaceBack.position.z = -exitSignDepth / 2 - 0.001;

    const exitSignGroup = new THREE.Group();
    exitSignGroup.add(exitSignBase);
    exitSignGroup.add(exitSignFace);
    exitSignGroup.add(exitSignFaceBack);
    exitSignGroup.position.set(doorX, exitSignY, exitSignZ);
    scene.add(exitSignGroup);

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
    const bandGap = 2.0; // Increased spacing (lowers the bottom position)
    const extrusionDepth = 0.28;

    const topBandPath = [
        { z: -roomLength / 2, y: centerLineY + bandThickness + 0.5 },         // 1. Start (High 1)
        { z: -roomLength / 2 + (roomLength * 3 / 8), y: centerLineY + bandThickness + 0.5 }, // 2. Flat until 3/8
        { z: -roomLength / 2 + (roomLength * 3 / 8) + 6, y: centerLineY + bandThickness - 2 }, // 3. Slope down (Longer slope)
        { z: roomLength / 2 - (roomLength * 1 / 8) - 6, y: centerLineY + bandThickness - 2 },  // 4. Flat bottom (Shorter flat)
        { z: roomLength / 2 - (roomLength * 1 / 8), y: centerLineY + bandThickness + 1.0 },      // 5. Slope up (Higher)
        { z: roomLength / 2, y: centerLineY + bandThickness + 1.0 }           // 6. End (High 2)
    ];

    // New Bottom Path (Custom 4-point shape)
    const topFirstSegmentLength = (roomLength * 3 / 8);
    const bottomP2Z = -roomLength / 2 + (topFirstSegmentLength * 0.75); // 3/4 length of point 1-2 in topband

    const bottomBandPath = [
        { z: -roomLength / 2, y: centerLineY - 0.8 },              // 1. Slightly lower than top band start (approx 2.5)
        { z: bottomP2Z, y: centerLineY - 0.8 },                    // 2. Flat until calculated point
        { z: bottomP2Z + 6, y: centerLineY - bandGap - 1.2 },      // 3. Slope down to low point (approx -1.2)
        { z: roomLength / 2, y: centerLineY - bandGap - 1.2 }      // 4. Straight to end
    ];

    const extrudeSettings = { steps: 1, depth: extrusionDepth, bevelEnabled: false };

    // --- CREATE INVERTED PATHS (Reserved for future use) ---
    // We negate Z to flip the pattern vertically/horizontally relative to wall start
    const topBandPathRight = topBandPath.map(p => ({ z: -p.z, y: p.y }));
    const bottomBandPathRight = bottomBandPath.map(p => ({ z: -p.z, y: p.y }));

    // --- LEFT WALL TOP (Uses ORIGINAL Path) ---
    const accentTopGeo = new THREE.Shape();
    accentTopGeo.moveTo(topBandPath[0].z, topBandPath[0].y);
    for (let i = 1; i < topBandPath.length; i++) { accentTopGeo.lineTo(topBandPath[i].z, topBandPath[i].y); }
    // Close shape by going UP (thickness) then back to start
    for (let i = topBandPath.length - 1; i >= 0; i--) { accentTopGeo.lineTo(topBandPath[i].z, topBandPath[i].y + bandThickness); }
    accentTopGeo.lineTo(topBandPath[0].z, topBandPath[0].y + bandThickness);

    const accentTopMesh = new THREE.Mesh(new THREE.ExtrudeGeometry(accentTopGeo, extrudeSettings), accentMaterial);
    accentTopMesh.position.set(0.11, 0, 0);
    wallLeftGroup.add(accentTopMesh);

    // --- LEFT WALL BOTTOM (Uses ORIGINAL Path) ---
    const accentBottomGeo = new THREE.Shape();
    accentBottomGeo.moveTo(bottomBandPath[0].z, bottomBandPath[0].y);
    for (let i = 1; i < bottomBandPath.length; i++) { accentBottomGeo.lineTo(bottomBandPath[i].z, bottomBandPath[i].y); }
    // Close shape by going UP (thickness) then back to start
    for (let i = bottomBandPath.length - 1; i >= 0; i--) { accentBottomGeo.lineTo(bottomBandPath[i].z, bottomBandPath[i].y + bandThickness); }
    accentBottomGeo.lineTo(bottomBandPath[0].z, bottomBandPath[0].y + bandThickness);

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

    // --- RIGHT WALL TOP (Now uses ORIGINAL/Left Path) ---
    const accentTopGeoRight = new THREE.Shape();
    accentTopGeoRight.moveTo(topBandPath[0].z, topBandPath[0].y);
    for (let i = 1; i < topBandPath.length; i++) { accentTopGeoRight.lineTo(topBandPath[i].z, topBandPath[i].y); }
    for (let i = topBandPath.length - 1; i >= 0; i--) { accentTopGeoRight.lineTo(topBandPath[i].z, topBandPath[i].y + bandThickness); }
    accentTopGeoRight.lineTo(topBandPath[0].z, topBandPath[0].y + bandThickness);

    const accentTopMeshRight = new THREE.Mesh(new THREE.ExtrudeGeometry(accentTopGeoRight, extrudeSettings), accentMaterial);
    accentTopMeshRight.position.set(0.11, 0, 0);
    wallRightGroup.add(accentTopMeshRight);

    // --- RIGHT WALL BOTTOM (Now uses ORIGINAL/Left Path) ---
    const accentBottomGeoRight = new THREE.Shape();
    accentBottomGeoRight.moveTo(bottomBandPath[0].z, bottomBandPath[0].y);
    for (let i = 1; i < bottomBandPath.length; i++) { accentBottomGeoRight.lineTo(bottomBandPath[i].z, bottomBandPath[i].y); }
    for (let i = bottomBandPath.length - 1; i >= 0; i--) { accentBottomGeoRight.lineTo(bottomBandPath[i].z, bottomBandPath[i].y + bandThickness); }
    accentBottomGeoRight.lineTo(bottomBandPath[0].z, bottomBandPath[0].y + bandThickness);

    const accentBottomMeshRight = new THREE.Mesh(new THREE.ExtrudeGeometry(accentBottomGeoRight, extrudeSettings), accentMaterial);
    accentBottomMeshRight.position.set(0.11, 0, 0);
    wallRightGroup.add(accentBottomMeshRight);

    scene.add(wallRightGroup);

    // ... (Add TV, Ceiling, Clock, AC, Logo objects here) ...
    // TV Screen with stand (in front of middle tables)
    const tvGroup = new THREE.Group();
    tvGroup.userData.collidable = true;

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

    // ==========================================
    // --- NEW: COVE CEILING (Matches Pic 1) ---
    // ==========================================

    // Configuration for the Ceiling Design
    const dropCeilingHeight = roomHeight - 0.2; // The lower border height (e.g. 9.5)
    const recessedHeight = roomHeight;          // The upper inner ceiling height (e.g. 11)
    const coveWidth = 5.0;                      // How wide the border is
    const stripThickness = 0.15;                // Thickness of the glowing light strip

    // --- 1. Materials (ALL WHITE) ---
    const cleanCeilingMaterial = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.8,
        metalness: 0.05
    });

    // LED Strip Material (White Glow)
    const ledStripMaterial = new THREE.MeshBasicMaterial({
        color: 0xEBD8B5
    });

    // Bulb Materials (On/Off states)
    const bulbOnMaterial = new THREE.MeshStandardMaterial({
        color: 0xEBD8B5,
        emissive: 0xEBD8B5,
        emissiveIntensity: 1.0
    });

    // --- 2. Build the Drop Ceiling (Lower Border) ---
    const sidePlankGeo = new THREE.BoxGeometry(coveWidth, 0.4, roomLength);
    const ceilingLeft = new THREE.Mesh(sidePlankGeo, cleanCeilingMaterial);
    ceilingLeft.position.set(-roomWidth / 2 + coveWidth / 2, dropCeilingHeight, 0);
    ceilingLeft.receiveShadow = true;
    scene.add(ceilingLeft);

    const ceilingRight = new THREE.Mesh(sidePlankGeo, cleanCeilingMaterial);
    ceilingRight.position.set(roomWidth / 2 - coveWidth / 2, dropCeilingHeight, 0);
    ceilingRight.receiveShadow = true;
    scene.add(ceilingRight);

    const fbPlankWidth = roomWidth - (coveWidth * 2);
    const fbPlankGeo = new THREE.BoxGeometry(fbPlankWidth, 0.4, coveWidth);
    const ceilingFront = new THREE.Mesh(fbPlankGeo, cleanCeilingMaterial);
    ceilingFront.position.set(0, dropCeilingHeight, -roomLength / 2 + coveWidth / 2);
    ceilingFront.receiveShadow = true;
    scene.add(ceilingFront);

    const ceilingBack = new THREE.Mesh(fbPlankGeo, cleanCeilingMaterial);
    ceilingBack.position.set(0, dropCeilingHeight, roomLength / 2 - coveWidth / 2);
    ceilingBack.receiveShadow = true;
    scene.add(ceilingBack);

    // --- 3. Build the Recessed Ceiling (Upper Inner Plane) ---
    const innerWidth = roomWidth - (coveWidth * 2);
    const innerLength = roomLength - (coveWidth * 2);

    const innerCeilingMesh = new THREE.Mesh(
        new THREE.PlaneGeometry(innerWidth, innerLength),
        cleanCeilingMaterial
    );
    innerCeilingMesh.rotation.x = Math.PI / 2;
    innerCeilingMesh.position.set(0, recessedHeight, 0);
    innerCeilingMesh.material.side = THREE.DoubleSide;
    innerCeilingMesh.receiveShadow = true;
    scene.add(innerCeilingMesh);

    // --- 4. Vertical Connector Walls ---
    const wallHeight = recessedHeight - dropCeilingHeight;
    const vWallFB = new THREE.BoxGeometry(innerWidth + 0.2, wallHeight, 0.1);
    const vWallLR = new THREE.BoxGeometry(0.1, wallHeight, innerLength + 0.2);

    const vWallFront = new THREE.Mesh(vWallFB, cleanCeilingMaterial);
    vWallFront.position.set(0, dropCeilingHeight + wallHeight / 2, -innerLength / 2 - 0.05);
    scene.add(vWallFront);

    const vWallBack = new THREE.Mesh(vWallFB, cleanCeilingMaterial);
    vWallBack.position.set(0, dropCeilingHeight + wallHeight / 2, innerLength / 2 + 0.05);
    scene.add(vWallBack);

    const vWallLeft = new THREE.Mesh(vWallLR, cleanCeilingMaterial);
    vWallLeft.position.set(-innerWidth / 2 - 0.05, dropCeilingHeight + wallHeight / 2, 0);
    scene.add(vWallLeft);

    const vWallRight = new THREE.Mesh(vWallLR, cleanCeilingMaterial);
    vWallRight.position.set(innerWidth / 2 + 0.05, dropCeilingHeight + wallHeight / 2, 0);
    scene.add(vWallRight);

    // --- 5. THE "SQUARE LAMP" (LED Strip Geometry) - Group 1 ---
    const stripGroup = new THREE.Group();
    const stripGeoTB = new THREE.BoxGeometry(innerWidth, stripThickness, stripThickness);
    const stripGeoLR = new THREE.BoxGeometry(stripThickness, stripThickness, innerLength - stripThickness * 2);

    const stripFront = new THREE.Mesh(stripGeoTB, ledStripMaterial);
    stripFront.position.set(0, 0, -innerLength / 2 + stripThickness / 2);
    stripGroup.add(stripFront);

    const stripBack = new THREE.Mesh(stripGeoTB, ledStripMaterial);
    stripBack.position.set(0, 0, innerLength / 2 - stripThickness / 2);
    stripGroup.add(stripBack);

    const stripLeft = new THREE.Mesh(stripGeoLR, ledStripMaterial);
    stripLeft.position.set(-innerWidth / 2 + stripThickness / 2, 0, 0);
    stripGroup.add(stripLeft);

    const stripRight = new THREE.Mesh(stripGeoLR, ledStripMaterial);
    stripRight.position.set(innerWidth / 2 - stripThickness / 2, 0, 0);
    stripGroup.add(stripRight);

    stripGroup.position.y = dropCeilingHeight + 0.2;
    scene.add(stripGroup);

    // Add strip meshes to 'coveLights' array
    stripGroup.children.forEach(mesh => coveLights.push({ type: 'mesh', obj: mesh }));

    // --- 6. HIDDEN COVE LIGHTS (PointLights) - Group 1 ---
    function createCoveLight(x, z) {
        // Pure White Light
        const light = new THREE.PointLight(0xEBD8B5, 0.5, 14, 1.2);
        light.position.set(x, dropCeilingHeight + 0.5, z);
        scene.add(light);
        coveLights.push({ type: 'light', obj: light });
    }

    const spacing = 5.0;
    // Long sides
    const numZ = Math.floor(innerLength / spacing);
    for (let i = 0; i <= numZ; i++) {
        const z = -innerLength / 2 + (innerLength / numZ) * i;
        createCoveLight(-innerWidth / 2 + 0.5, z);
        createCoveLight(innerWidth / 2 - 0.5, z);
    }
    // Short sides
    const numX = Math.floor(innerWidth / spacing);
    for (let i = 1; i < numX; i++) {
        const x = -innerWidth / 2 + (innerWidth / numX) * i;
        createCoveLight(x, -innerLength / 2 + 0.5);
        createCoveLight(x, innerLength / 2 - 0.5);
    }

    // --- 7. THE 4 RECESSED BULBS (SOFTER & REALISTIC) ---

    // 1. Create the Glow Texture
    const glowTexture = createLightGlowTexture();
    const glowMaterial = new THREE.SpriteMaterial({
        map: glowTexture,
        color: 0xEBD8B5,
        transparent: true,
        opacity: 0.4,         // Lower opacity for a softer look
        blending: THREE.AdditiveBlending
    });

    // 2. Bulb Material 
    const realisticBulbOnMat = new THREE.MeshStandardMaterial({
        color: 0xEBD8B5,
        emissive: 0xEBD8B5,
        emissiveIntensity: 0.5,  // Reduced so the bulb itself isn't blinding
        roughness: 0.1
    });

    // Calculate positions 
    const bulbOffsetX = innerWidth / 2 - 3.5;
    const bulbOffsetZ = innerLength / 2 - 3.5;

    const bulbPositions = [
        { x: -bulbOffsetX, z: -bulbOffsetZ },
        { x: bulbOffsetX, z: -bulbOffsetZ },
        { x: -bulbOffsetX, z: bulbOffsetZ },
        { x: bulbOffsetX, z: bulbOffsetZ }
    ];

    bulbPositions.forEach(pos => {
        // A. Housing
        const housingGeo = new THREE.CylinderGeometry(0.28, 0.28, 0.05, 24);
        const housingMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.5 });
        const housing = new THREE.Mesh(housingGeo, housingMat);
        housing.position.set(pos.x, recessedHeight - 0.025, pos.z);
        scene.add(housing);

        // B. Bulb Lens
        const bulbGeo = new THREE.SphereGeometry(0.18, 16, 16, 0, Math.PI * 2, 0, Math.PI * 0.5);
        const bulb = new THREE.Mesh(bulbGeo, realisticBulbOnMat);
        bulb.rotation.x = Math.PI;
        bulb.position.set(pos.x, recessedHeight - 0.05, pos.z);
        scene.add(bulb);

        // C. Glare Sprite
        const glowSprite = new THREE.Sprite(glowMaterial);
        glowSprite.scale.set(2.0, 2.0, 1.0);
        glowSprite.position.set(pos.x, recessedHeight - 0.35, pos.z);
        scene.add(glowSprite);

        // D. The Actual Light (UPDATED SETTINGS)
        // Intensity 0.5 is much softer.
        const spot = new THREE.SpotLight(0xEBD8B5, 0.35);
        spot.position.set(pos.x, recessedHeight - 0.1, pos.z);
        spot.target.position.set(pos.x, 0, pos.z);

        // Wider angle (PI/2.5) spreads light more, reducing the "hot spot" on floor
        spot.angle = Math.PI / 2.5;
        spot.penumbra = 0.6;
        // 2. ADD THESE LINES TO FIX THE "WHITE FLOOR" 
        spot.decay = 1.0;    // Makes light fade as it travels (physics)
        spot.distance = 15;  // The light stops affecting things after 15 meters    
        spot.castShadow = true;
        spot.shadow.bias = -0.0001;

        scene.add(spot);
        scene.add(spot.target);

        downLights.push({ type: 'mesh', obj: bulb });
        downLights.push({ type: 'sprite', obj: glowSprite });
        downLights.push({ type: 'light', obj: spot });
    });
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
    const seLogoPlane = new THREE.Mesh(new THREE.PlaneGeometry(4.5, 2.55), seLogoMaterial);
    seLogoPlane.rotation.y = -Math.PI / 2;
    seLogoPlane.position.set(roomWidth / 2 - 0.32, roomHeight * 0.80, 5.0);
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


    // Helper to create a soft glow texture programmatically
    // Helper to create a soft glow texture programmatically
    // Helper to create a soft glow texture programmatically
    function createLightGlowTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 64; canvas.height = 64;
        const ctx = canvas.getContext('2d');
        const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);

        // CENTER: Warm Peach (No longer pure white)
        gradient.addColorStop(0, 'rgba(255, 220, 180, 1)');

        // MIDDLE: Deep Warm Beige
        gradient.addColorStop(0.4, 'rgba(255, 200, 130, 0.4)');

        // EDGE: Fade out
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 64, 64);

        const texture = new THREE.CanvasTexture(canvas);
        return texture;
    }

    function createDesk(width, depth, height, options = {}) {
        const powerChannel = options.powerChannel === true;
        const powerStripCount = options.powerStripCount || 2; // default 2 strips unless specified
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
            const edgeClearance = 0.01; // minimal clearance so channel/caps nearly reach table edge
            const channelLength = depth - edgeClearance * 2;
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

            // Place strips along the channel (default 2, customizable)
            if (powerStripCount <= 2) {
                const stripOffset = depth * 0.25; // place roughly at 1/4 and -1/4 depth
                addStrip(stripOffset);
                if (powerStripCount > 1) {
                    addStrip(-stripOffset);
                }
            } else {
                const spacing = channelLength / (powerStripCount + 1);
                for (let i = 0; i < powerStripCount; i++) {
                    const z = -channelLength / 2 + spacing * (i + 1);
                    addStrip(z);
                }
            }
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

    const centerDesk = createDesk(combinedWidth, combinedDepth, deskHeight, { powerChannel: true, powerStripCount: 8 });
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

        // Load Book Textures
        const bookTexture1 = new THREE.TextureLoader().load('img/rakbuku1_1.png');
        const bookMaterial1 = new THREE.MeshStandardMaterial({
            map: bookTexture1,
            transparent: true,
            side: THREE.DoubleSide
        });

        const bookTexture2 = new THREE.TextureLoader().load('img/rakbuku1_2.png');
        const bookMaterial2 = new THREE.MeshStandardMaterial({
            map: bookTexture2,
            transparent: true,
            side: THREE.DoubleSide
        });

        const bookTexture3 = new THREE.TextureLoader().load('img/rakbuku2_1.png');
        const bookMaterial3 = new THREE.MeshStandardMaterial({
            map: bookTexture3,
            transparent: true,
            side: THREE.DoubleSide
        });

        const bookTexture4 = new THREE.TextureLoader().load('img/rakbuku2_2.png');
        const bookMaterial4 = new THREE.MeshStandardMaterial({
            map: bookTexture4,
            transparent: true,
            side: THREE.DoubleSide
        });

        const bookTexture5 = new THREE.TextureLoader().load('img/rakbuku2_3.png');
        const bookMaterial5 = new THREE.MeshStandardMaterial({
            map: bookTexture5,
            transparent: true,
            side: THREE.DoubleSide
        });

        const bookTexture6 = new THREE.TextureLoader().load('img/rakbuku2_4.png');
        const bookMaterial6 = new THREE.MeshStandardMaterial({
            map: bookTexture6,
            transparent: true,
            side: THREE.DoubleSide
        });

        const bookTexture7 = new THREE.TextureLoader().load('img/rakbuku1_4.png');
        const bookMaterial7 = new THREE.MeshStandardMaterial({
            map: bookTexture7,
            transparent: true,
            side: THREE.DoubleSide
        });

        // Dimensions
        const totalTargetWidth = 18.0;
        const separatorWidth = 0.4;
        // const cornerBlockWidth = 0.8;

        const availableWidth = totalTargetWidth - (4 * separatorWidth);
        const baseWidth = availableWidth / 4;

        const leftWidth = baseWidth;
        const middleWidth = baseWidth * 2;
        const rightWidth = baseWidth;

        const depth = 2;

        const bottomCabinetHeight = 3.5;
        const bookshelfHeight = 3.5;
        const topCabinetHeight = 1.5;
        const blankTopHeight = 1.5;
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

            // Equalize depth: hollow parts now have same depth as cabinets
            const actualDepth = depth;
            const zOffset = 0;

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

                    // Add Fake Books (Array of { col: number, material: THREE.Material })
                    if (config.books && config.books.length > 0) {
                        const compartmentHeight = shelfSpacing;
                        const topCompY = -height / 2 + (config.horizontalShelves + 0.5) * shelfSpacing;

                        // Calculate column width/spacing
                        // Total width divided by (verticalDividers + 1) columns
                        const colWidth = width / (config.verticalDividers + 1);

                        config.books.forEach(bookConfig => {
                            const bookConfScale = bookConfig.scale || { x: 1, y: 1 };
                            const bookConfOffset = bookConfig.offset || { x: 0, y: 0, z: 0 };
                            const bookAlign = bookConfig.align || 'center';

                            const bookGeo = new THREE.PlaneGeometry(colWidth * 0.9, compartmentHeight * 0.85);
                            const bookPlane = new THREE.Mesh(bookGeo, bookConfig.material);
                            bookPlane.scale.set(bookConfScale.x, bookConfScale.y, 1);

                            // Calculate X center for the specific column
                            // Col 0 center: -width/2 + colWidth/2
                            let centerX = -width / 2 + colWidth / 2 + bookConfig.col * colWidth;

                            // Alignment Logic
                            const bookWidth = (colWidth * 0.9) * bookConfScale.x;
                            const padding = 0.05; // gap from side

                            if (bookAlign === 'left') {
                                centerX = (-width / 2 + bookConfig.col * colWidth) + bookWidth / 2 + padding;
                            } else if (bookAlign === 'right') {
                                centerX = (-width / 2 + (bookConfig.col + 1) * colWidth) - bookWidth / 2 - padding;
                            }

                            // Apply final position with offsets
                            bookPlane.position.set(
                                centerX + bookConfOffset.x,
                                topCompY + bookConfOffset.y,
                                actualDepth / 2 - 0.2 + (isHollow ? zOffset : 0) + bookConfOffset.z
                            );
                            shelfGroup.add(bookPlane);
                        });
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

            // Blank Top Cabinet (for AC)
            const blankTop = new THREE.Mesh(new THREE.BoxGeometry(width, blankTopHeight, depth), woodMaterial);
            blankTop.position.y = bottomCabinetHeight + horizontalSeparatorHeight * 2 + bookshelfHeight + topCabinetHeight + blankTopHeight / 2;
            blankTop.castShadow = true;
            sectionGroup.add(blankTop);

            return sectionGroup;
        }

        const totalHeight = bottomCabinetHeight + bookshelfHeight + topCabinetHeight + blankTopHeight + 2 * horizontalSeparatorHeight;
        let currentX = -totalTargetWidth / 2;

        // const cornerBlock = new THREE.Mesh(
        //     new THREE.BoxGeometry(cornerBlockWidth, totalHeight, depth),
        //     woodMaterial
        // );
        // cornerBlock.position.set(currentX + cornerBlockWidth / 2, totalHeight / 2, 0);
        // cornerBlock.castShadow = true;
        // group.add(cornerBlock);
        // currentX += cornerBlockWidth;

        // Left Separator (New)
        const separatorLeft = new THREE.Mesh(new THREE.BoxGeometry(separatorWidth, totalHeight, depth), separatorMaterial);
        separatorLeft.position.set(currentX + separatorWidth / 2, totalHeight / 2, 0);
        group.add(separatorLeft);
        currentX += separatorWidth;

        const leftSection = createVerticalSection(leftWidth, leftDoors, leftDoors, true, {
            horizontalShelves: 1,
            verticalDividers: 0,
            books: [
                {
                    col: 0,
                    material: bookMaterial1,
                    align: 'right',
                    scale: { x: 2, y: 2 },
                    offset: { x: +1.1, y: +0.08, z: 0 }
                },
                {
                    col: 0,
                    material: bookMaterial3,
                    align: 'right',
                    scale: { x: 1.5, y: 1.5 },
                    offset: { x: +0.7, y: -2, z: 0 }
                },
            ]
        });
        leftSection.position.x = currentX + leftWidth / 2;
        group.add(leftSection);
        currentX += leftWidth;

        currentX += separatorWidth / 2;
        const separator1 = new THREE.Mesh(new THREE.BoxGeometry(separatorWidth, totalHeight, depth), separatorMaterial);
        separator1.position.x = currentX;
        separator1.position.y = totalHeight / 2;
        group.add(separator1);
        currentX += separatorWidth / 2;

        const middleSection = createVerticalSection(middleWidth, middleDoors, middleDoors, true, {
            horizontalShelves: 1,
            verticalDividers: 1,
            books: [{
                col: 0,
                material: bookMaterial2,
                align: 'center',
                scale: { x: 1.1, y: 1.1 },
                offset: { x: +0.1, y: -0.08, z: 0 }
            },
            {
                col: 0,
                material: bookMaterial4,
                align: 'right',
                scale: { x: 1.3, y: 1.3 },
                offset: { x: +0.3, y: -2, z: 0 }
            },
            {
                col: 0,
                material: bookMaterial5,
                align: 'right',
                scale: { x: 1.3, y: 1.3 },
                offset: { x: +4.35, y: -2, z: 0 }
            }
            ]
        });
        middleSection.position.x = currentX + middleWidth / 2;
        group.add(middleSection);
        currentX += middleWidth;

        currentX += separatorWidth / 2;
        const separator2 = new THREE.Mesh(new THREE.BoxGeometry(separatorWidth, totalHeight, depth), separatorMaterial);
        separator2.position.x = currentX;
        separator2.position.y = totalHeight / 2;
        group.add(separator2);
        currentX += separatorWidth / 2;

        const rightSection = createVerticalSection(rightWidth, rightDoors, rightDoors, true, {
            horizontalShelves: 1,
            verticalDividers: 0,
            books: [{
                col: 0,
                material: bookMaterial6,
                align: 'left',
                scale: { x: 1.3, y: 1.3 },
                offset: { x: -0.6, y: -2, z: 0 }
            },
            {
                col: 0,
                material: bookMaterial7,
                align: 'left',
                scale: { x: 1.3, y: 1.3 },
                offset: { x: -0.6, y: -0.23, z: 0 }
            },
            ]
        });
        rightSection.position.x = currentX + rightWidth / 2;
        group.add(rightSection);
        currentX += rightWidth;

        // Right Separator (New)
        const separatorRight = new THREE.Mesh(new THREE.BoxGeometry(separatorWidth, totalHeight, depth), separatorMaterial);
        separatorRight.position.set(currentX + separatorWidth / 2, totalHeight / 2, 0);
        group.add(separatorRight);

        // --- Air Conditioner (GLTF Model) ---
        const gltfLoader = new THREE.GLTFLoader();
        gltfLoader.load('models/air_condition_daikin.glb', function (gltf) {
            const ac = gltf.scene;
            ac.scale.set(1.5, 1.5, 1.5);

            // Position relative to group
            // X: 0 (Centered)
            // Y: totalHeight - blankTopHeight / 2 (Centered on blank top)
            // Z: depth / 2 (Front face of cabinet) + small offset
            ac.position.set(0, totalHeight - blankTopHeight / 2, depth / 2 + 0.2);

            ac.traverse(n => { if (n.isMesh) { n.castShadow = true; n.receiveShadow = true; } });
            group.add(ac);
        }, undefined, function (e) { console.error(e); });

        group.rotation.y = Math.PI;
        group.position.set(4.5, 0, 17.1);
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
            // Handle Mesh Objects
            if (item.bulb.userData.isLedStrip) {
                // Special handling for the LED Strip (Basic Material)
                if (lightsOn) {
                    item.bulb.material.color.setHex(item.bulb.userData.onColor);
                } else {
                    item.bulb.material.color.setHex(0x111111); // Dark grey when off
                }
            } else {
                // Standard Bulbs (Emissive Material)
                if (lightsOn) {
                    item.bulb.material.emissive.setHex(item.originalEmissive);
                    item.bulb.material.emissiveIntensity = item.originalIntensity;
                } else {
                    item.bulb.material.emissive.setHex(0x000000);
                    item.bulb.material.emissiveIntensity = 0;
                }
            }
        } else {
            // Regular Light Objects (PointLight, etc)
            item.visible = lightsOn;
        }
    });

    // Turn off all shadows when the lights are off
    shadowCastingLights.forEach(light => {
        light.castShadow = lightsOn;
        if (light.shadow) {
            light.shadow.autoUpdate = lightsOn;
            light.shadow.needsUpdate = true;
        }
    });
    renderer.shadowMap.enabled = lightsOn;
    renderer.shadowMap.autoUpdate = lightsOn;
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

function toggleCoveLights() {
    coveActive = !coveActive;
    coveLights.forEach(item => {
        if (item.type === 'mesh') {
            // Toggle visual strip (White vs Dark Grey)
            if (coveActive) item.obj.material.color.setHex(0xEBD8B5);
            else item.obj.material.color.setHex(0x111111);
        } else if (item.type === 'light') {
            // Toggle actual light
            item.obj.visible = coveActive;
        }
    });
}

function toggleDownLights() {
    downLightsActive = !downLightsActive;

    downLights.forEach(item => {
        if (item.type === 'mesh') {
            // Toggle bulb physical material
            if (downLightsActive) {
                item.obj.material.emissive.setHex(0xEBD8B5); // CHANGED: New Color
                item.obj.material.emissiveIntensity = 0.5;   // CHANGED: New Intensity
            } else {
                item.obj.material.emissive.setHex(0x000000);
                item.obj.material.emissiveIntensity = 0;
            }
        }
        else if (item.type === 'sprite') {
            item.obj.visible = downLightsActive;
        }
        else if (item.type === 'light') {
            item.obj.visible = downLightsActive;
            item.obj.castShadow = downLightsActive;
        }
    });
}
