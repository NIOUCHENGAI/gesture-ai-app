/**
 * GestureAI - AI-Powered Gesture Recognition
 * Real-time hand gesture detection using MediaPipe Hands
 */

// ===========================
// Configuration & Constants
// ===========================
const CONFIG = {
    video: {
        width: 1280,
        height: 720,
        frameRate: 30
    },
    models: {
        handsUrl: 'https://cdn.jsdelivr.net/npm/@mediapipe/hands'
    },
    gestures: {
        thumbsUp: { name: '👍 Thumbs Up', action: '播放' },
        peaceSign: { name: '✌️ Peace Sign', action: '切換' },
        openPalm: { name: '✋ Open Palm', action: '暫停' },
        fist: { name: '👊 Fist', action: '停止' }
    }
};

// ===========================
// Global State Management
// ===========================
const state = {
    camera: {
        active: false,
        stream: null
    },
    model: {
        loaded: false,
        hands: null
    },
    detection: {
        hands: null,
        gesture: '未檢測',
        confidence: 0,
        lastGesture: null,
        gestureTime: 0
    },
    performance: {
        fps: 0,
        frameCount: 0,
        lastTime: Date.now()
    },
    ui: {
        currentSection: 'tracking'
    }
};

// ===========================
// DOM Elements
// ===========================
const DOM = {
    webcam: null,
    canvas: null,
    ctx: null,
    fpsCounter: null,
    currentGesture: null,
    confidenceFill: null,
    confidenceText: null,
    cameraStatus: null,
    modelStatus: null,
    cameraAccessStatus: null,
    detectionStatus: null,
    logContainer: null,
    particlesContainer: null,
    navBtns: null
};

// ===========================
// Initialize DOM References
// ===========================
function initializeDOMElements() {
    DOM.webcam = document.getElementById('webcam');
    DOM.canvas = document.getElementById('canvas');
    DOM.ctx = DOM.canvas.getContext('2d');
    DOM.fpsCounter = document.getElementById('fpsCounter');
    DOM.currentGesture = document.getElementById('currentGesture');
    DOM.confidenceFill = document.getElementById('confidenceFill');
    DOM.confidenceText = document.getElementById('confidenceText');
    DOM.cameraStatus = document.querySelector('.status-badge');
    DOM.modelStatus = document.getElementById('modelStatus');
    DOM.cameraAccessStatus = document.getElementById('cameraAccessStatus');
    DOM.detectionStatus = document.getElementById('detectionStatus');
    DOM.logContainer = document.getElementById('logContainer');
    DOM.particlesContainer = document.querySelector('.particles-container');
    DOM.navBtns = document.querySelectorAll('.nav-btn');
}

// ===========================
// Particle Generation
// ===========================
function generateParticles() {
    const particleCount = window.innerWidth > 768 ? 50 : 20;
    
    for (let i = 0; i < particleCount; i++) {
        const particle = document.createElement('div');
        particle.className = 'particle';
        
        const x = Math.random() * 100;
        const y = Math.random() * 100;
        const size = Math.random() * 3 + 1;
        const duration = Math.random() * 10 + 15;
        const delay = Math.random() * 5;
        
        particle.style.left = x + '%';
        particle.style.top = y + '%';
        particle.style.width = size + 'px';
        particle.style.height = size + 'px';
        particle.style.animationDuration = duration + 's';
        particle.style.animationDelay = delay + 's';
        
        DOM.particlesContainer.appendChild(particle);
    }
}

// ===========================
// Logging System
// ===========================
function addLog(message) {
    if (!DOM.logContainer) return;
    
    const logItem = document.createElement('div');
    logItem.className = 'log-item';
    const timestamp = new Date().toLocaleTimeString('zh-TW');
    logItem.textContent = `[${timestamp}] ${message}`;
    
    DOM.logContainer.insertBefore(logItem, DOM.logContainer.firstChild);
    
    // Keep only last 20 logs
    while (DOM.logContainer.children.length > 20) {
        DOM.logContainer.removeChild(DOM.logContainer.lastChild);
    }
}

// ===========================
// Status Updates
// ===========================
function updateStatus(element, status, emoji) {
    if (element) {
        element.textContent = emoji;
        element.style.animation = status === 'success' ? 'pulse 1s ease-in-out' : (status === 'inactive' ? 'blink 1s ease-in-out infinite' : 'none');
    }
}

function updateStatusBadge(isActive) {
    if (DOM.cameraStatus) {
        const dot = DOM.cameraStatus.querySelector('.status-dot');
        const text = DOM.cameraStatus.querySelector('span:last-child');
        
        if (dot && text) {
            if (isActive) {
                dot.classList.add('active');
                text.textContent = '運作中';
            } else {
                dot.classList.remove('active');
                text.textContent = '待命';
            }
        }
    }
}

// ===========================
// Initialize MediaPipe Hands
// ===========================
async function initializeMediaPipe() {
    try {
        updateStatus(DOM.modelStatus, 'loading', '⏳');
        addLog('正在加載 MediaPipe Hands...');
        
        // Load the model
        const hands = new Hands({
            locateFile: (file) => {
                return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
            }
        });
        
        hands.setOptions({
            maxNumHands: 2,
            modelComplexity: 1,
            minDetectionConfidence: 0.5,
            minTrackingConfidence: 0.5
        });
        
        hands.onResults(onHandsResults);
        
        state.model.hands = hands;
        state.model.loaded = true;
        
        updateStatus(DOM.modelStatus, 'success', '✓');
        addLog('✓ MediaPipe Hands 加載完成');
        
    } catch (error) {
        console.error('MediaPipe 加載失敗:', error);
        updateStatus(DOM.modelStatus, 'error', '✗');
        addLog('✗ 模型加載失敗: ' + error.message);
    }
}

// ===========================
// Initialize Webcam
// ===========================
async function initializeWebcam() {
    try {
        updateStatus(DOM.cameraAccessStatus, 'loading', '⏳');
        addLog('正在請求攝像頭訪問...');
        
        const constraints = {
            video: {
                width: { ideal: CONFIG.video.width },
                height: { ideal: CONFIG.video.height },
                facingMode: 'user'
            },
            audio: false
        };
        
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        
        DOM.webcam.srcObject = stream;
        state.camera.stream = stream;
        state.camera.active = true;
        
        // Setup canvas size to match video
        DOM.webcam.onloadedmetadata = () => {
            DOM.canvas.width = DOM.webcam.videoWidth;
            DOM.canvas.height = DOM.webcam.videoHeight;
            
            updateStatus(DOM.cameraAccessStatus, 'success', '✓');
            addLog('✓ 攝像頭已啟用');
            updateStatusBadge(true);
            
            // Start detection loop
            if (state.model.loaded) {
                startDetection();
            }
        };
        
    } catch (error) {
        console.error('攝像頭訪問失敗:', error);
        updateStatus(DOM.cameraAccessStatus, 'error', '✗');
        addLog('✗ 攝像頭訪問被拒絕');
    }
}

// ===========================
// Hand Detection Results Handler
// ===========================
function onHandsResults(results) {
    state.detection.hands = results.multiHandLandmarks;
    
    // Clear canvas
    DOM.ctx.clearRect(0, 0, DOM.canvas.width, DOM.canvas.height);
    
    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        updateStatus(DOM.detectionStatus, 'success', '✓');
        
        // Draw landmarks for each hand
        results.multiHandLandmarks.forEach((landmarks, idx) => {
            drawHandLandmarks(landmarks);
            
            // Recognize gesture
            if (idx === 0) { // Process first hand only
                const gesture = recognizeGesture(landmarks);
                updateGestureDisplay(gesture);
            }
        });
    } else {
        updateStatus(DOM.detectionStatus, 'inactive', '⏳');
        state.detection.gesture = '未檢測';
        state.detection.confidence = 0;
        updateGestureDisplay({ name: '未檢測', confidence: 0 });
    }
}

// ===========================
// Draw Hand Landmarks
// ===========================
function drawHandLandmarks(landmarks) {
    const width = DOM.canvas.width;
    const height = DOM.canvas.height;
    
    // Draw connections
    const connections = [
        [0, 1], [1, 2], [2, 3], [3, 4],                           // Thumb
        [0, 5], [5, 6], [6, 7], [7, 8],                           // Index
        [0, 9], [9, 10], [10, 11], [11, 12],                     // Middle
        [0, 13], [13, 14], [14, 15], [15, 16],                   // Ring
        [0, 17], [17, 18], [18, 19], [19, 20],                   // Pinky
        [5, 9], [9, 13], [13, 17]                                // Palm
    ];
    
    // Draw connections
    DOM.ctx.strokeStyle = 'rgba(99, 102, 241, 0.6)';
    DOM.ctx.lineWidth = 2;
    
    connections.forEach(([start, end]) => {
        const p1 = landmarks[start];
        const p2 = landmarks[end];
        
        DOM.ctx.beginPath();
        DOM.ctx.moveTo(p1.x * width, p1.y * height);
        DOM.ctx.lineTo(p2.x * width, p2.y * height);
        DOM.ctx.stroke();
    });
    
    // Draw landmarks
    landmarks.forEach((landmark, idx) => {
        const x = landmark.x * width;
        const y = landmark.y * height;
        const z = landmark.z * width;
        
        // Circle for landmark
        DOM.ctx.fillStyle = idx === 0 ? 'rgba(139, 92, 246, 0.8)' : 'rgba(6, 182, 212, 0.8)';
        DOM.ctx.beginPath();
        DOM.ctx.arc(x, y, 4, 0, Math.PI * 2);
        DOM.ctx.fill();
        
        // Outer ring
        DOM.ctx.strokeStyle = 'rgba(99, 102, 241, 0.4)';
        DOM.ctx.lineWidth = 1;
        DOM.ctx.beginPath();
        DOM.ctx.arc(x, y, 6, 0, Math.PI * 2);
        DOM.ctx.stroke();
    });
}

// ===========================
// Gesture Recognition Algorithm
// ===========================
function recognizeGesture(landmarks) {
    const gestures = {
        thumbsUp: calculateThumbsUp(landmarks),
        peaceSign: calculatePeaceSign(landmarks),
        openPalm: calculateOpenPalm(landmarks),
        fist: calculateFist(landmarks)
    };
    
    // Find gesture with highest confidence
    let maxGesture = 'unknown';
    let maxConfidence = 0;
    
    for (const [gesture, confidence] of Object.entries(gestures)) {
        if (confidence > maxConfidence) {
            maxConfidence = confidence;
            maxGesture = gesture;
        }
    }
    
    return {
        name: maxConfidence > 0.5 ? CONFIG.gestures[maxGesture]?.name || '未知手勢' : '未檢測',
        gesture: maxGesture,
        confidence: Math.round(maxConfidence * 100)
    };
}

// ===========================
// Gesture Detection: Thumbs Up
// ===========================
function calculateThumbsUp(landmarks) {
    // Thumb pointing up, other fingers closed
    const thumbMid = landmarks[2];
    const thumbTip = landmarks[4];
    const palmBase = landmarks[0];
    
    // Index finger closed
    const indexMid = landmarks[6];
    const indexTip = landmarks[8];
    
    // Check thumb is extended
    const thumbExtension = distance(thumbMid, thumbTip);
    
    // Check other fingers are curled
    const indexCurled = Math.abs(indexMid.y - indexTip.y) < 0.05;
    
    // Check thumb is above palm
    const thumbAbovePalm = thumbTip.y < palmBase.y - 0.1;
    
    if (thumbExtension > 0.05 && indexCurled && thumbAbovePalm) {
        return 0.9;
    }
    
    return 0;
}

// ===========================
// Gesture Detection: Peace Sign
// ===========================
function calculatePeaceSign(landmarks) {
    // Index and middle fingers extended, others folded
    const indexTip = landmarks[8];
    const indexMid = landmarks[6];
    const middleTip = landmarks[12];
    const middleMid = landmarks[10];
    const ringTip = landmarks[16];
    const palmBase = landmarks[0];
    
    // Check index and middle are extended
    const indexExtended = Math.abs(indexTip.y - indexMid.y) > 0.05;
    const middleExtended = Math.abs(middleTip.y - middleMid.y) > 0.05;
    
    // Check they're above palm
    const bothAbovePalm = indexTip.y < palmBase.y - 0.05 && middleTip.y < palmBase.y - 0.05;
    
    // Check separation between fingers
    const fingerSeparation = Math.abs(indexTip.x - middleTip.x) > 0.03;
    
    // Check ring finger is curled
    const ringCurled = Math.abs(ringTip.y - landmarks[14].y) < 0.03;
    
    if (indexExtended && middleExtended && bothAbovePalm && fingerSeparation && ringCurled) {
        return 0.85;
    }
    
    return 0;
}

// ===========================
// Gesture Detection: Open Palm
// ===========================
function calculateOpenPalm(landmarks) {
    // All fingers extended
    const fingerTips = [8, 12, 16, 20, 4]; // Index, Middle, Ring, Pinky, Thumb
    const fingerMids = [6, 10, 14, 18, 2];
    const palmBase = landmarks[0];
    
    let extendedCount = 0;
    
    for (let i = 0; i < fingerTips.length; i++) {
        const tip = landmarks[fingerTips[i]];
        const mid = landmarks[fingerMids[i]];
        
        // Check if finger is extended
        if (Math.abs(tip.y - mid.y) > 0.04) {
            extendedCount++;
        }
    }
    
    // Most fingers should be extended
    if (extendedCount >= 4) {
        return 0.9;
    }
    
    return 0;
}

// ===========================
// Gesture Detection: Fist
// ===========================
function calculateFist(landmarks) {
    // All fingers curled
    const fingerTips = [8, 12, 16, 20, 4];
    const fingerMids = [6, 10, 14, 18, 2];
    
    let curledCount = 0;
    
    for (let i = 0; i < fingerTips.length; i++) {
        const tip = landmarks[fingerTips[i]];
        const mid = landmarks[fingerMids[i]];
        
        // Check if finger is curled
        if (Math.abs(tip.y - mid.y) < 0.03) {
            curledCount++;
        }
    }
    
    // All fingers should be curled
    if (curledCount >= 4) {
        return 0.85;
    }
    
    return 0;
}

// ===========================
// Utility: Calculate Distance
// ===========================
function distance(p1, p2) {
    const dx = p1.x - p2.x;
    const dy = p1.y - p2.y;
    return Math.sqrt(dx * dx + dy * dy);
}

// ===========================
// Update Gesture Display
// ===========================
function updateGestureDisplay(gesture) {
    state.detection.gesture = gesture.name;
    state.detection.confidence = gesture.confidence;
    
    DOM.currentGesture.textContent = gesture.name;
    DOM.confidenceFill.style.width = gesture.confidence + '%';
    DOM.confidenceText.textContent = `信心度: ${gesture.confidence}%`;
    
    // Log significant gestures
    if (gesture.confidence > 70 && gesture.gesture !== state.detection.lastGesture) {
        state.detection.lastGesture = gesture.gesture;
        addLog(`🎯 檢測到手勢: ${gesture.name} (${gesture.confidence}%)`);
        
        // Trigger action
        triggerGestureAction(gesture.gesture);
    }
}

// ===========================
// Trigger Gesture Actions
// ===========================
function triggerGestureAction(gesture) {
    const actions = {
        thumbsUp: () => {
            addLog('▶️  執行: 播放');
            playGestureAnimation();
        },
        peaceSign: () => {
            addLog('↔️  執行: 切換頁面');
            switchPage();
        },
        openPalm: () => {
            addLog('⏸️  執行: 暫停');
            pauseAnimation();
        },
        fist: () => {
            addLog('⏹️  執行: 停止');
            stopAnimation();
        }
    };
    
    if (actions[gesture]) {
        actions[gesture]();
    }
}

// ===========================
// Animation Triggers
// ===========================
function playGestureAnimation() {
    const canvas = DOM.canvas;
    canvas.style.animation = 'pulse 0.5s ease-out';
    setTimeout(() => {
        canvas.style.animation = '';
    }, 500);
}

function pauseAnimation() {
    addLog('⏸️ 應用程式暫停');
}

function stopAnimation() {
    addLog('⏹️ 應用程式停止');
}

function switchPage() {
    const sections = ['tracking', 'showcase', 'copilot'];
    const currentIdx = sections.indexOf(state.ui.currentSection);
    const nextIdx = (currentIdx + 1) % sections.length;
    const nextSection = sections[nextIdx];
    
    switchToSection(nextSection);
}

// ===========================
// Detection Loop
// ===========================
async function startDetection() {
    async function detect() {
        if (state.camera.active && state.model.hands && DOM.webcam.readyState === DOM.webcam.HAVE_FUTURE_DATA) {
            await state.model.hands.send({ image: DOM.webcam });
        }
        
        updateFPS();
        requestAnimationFrame(detect);
    }
    
    detect();
}

// ===========================
// FPS Counter
// ===========================
function updateFPS() {
    state.performance.frameCount++;
    const now = Date.now();
    const delta = now - state.performance.lastTime;
    
    if (delta > 1000) {
        state.performance.fps = state.performance.frameCount;
        state.performance.frameCount = 0;
        state.performance.lastTime = now;
        
        if (DOM.fpsCounter) {
            DOM.fpsCounter.textContent = `FPS: ${state.performance.fps}`;
        }
    }
}

// ===========================
// Navigation
// ===========================
function setupNavigation() {
    DOM.navBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const section = btn.getAttribute('data-section');
            switchToSection(section);
        });
    });
}

function switchToSection(sectionId) {
    // Update state
    state.ui.currentSection = sectionId;
    
    // Hide all sections
    document.querySelectorAll('.section').forEach(section => {
        section.classList.remove('active');
    });
    
    // Show target section
    const targetSection = document.getElementById(sectionId);
    if (targetSection) {
        targetSection.classList.add('active');
    }
    
    // Update active nav button
    DOM.navBtns.forEach(btn => {
        btn.classList.remove('active');
        if (btn.getAttribute('data-section') === sectionId) {
            btn.classList.add('active');
        }
    });
    
    addLog(`📄 切換到: ${sectionId}`);
}

// ===========================
// Cleanup
// ===========================
function cleanup() {
    if (state.camera.stream) {
        state.camera.stream.getTracks().forEach(track => track.stop());
    }
}

// ===========================
// Main Initialization
// ===========================
async function initialize() {
    try {
        addLog('初始化應用程式...');
        
        initializeDOMElements();
        generateParticles();
        setupNavigation();
        
        // Load MediaPipe
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js';
        script.crossOrigin = 'anonymous';
        script.onload = async () => {
            await initializeMediaPipe();
            
            // Request webcam after model loads
            await initializeWebcam();
        };
        document.body.appendChild(script);
        
        addLog('✓ 應用程式初始化完成');
        
    } catch (error) {
        console.error('初始化失敗:', error);
        addLog('✗ 初始化失敗: ' + error.message);
    }
}

// ===========================
// Event Listeners
// ===========================
window.addEventListener('beforeunload', cleanup);

// Handle window resize
window.addEventListener('resize', () => {
    if (DOM.canvas && DOM.webcam) {
        DOM.canvas.width = DOM.webcam.videoWidth;
        DOM.canvas.height = DOM.webcam.videoHeight;
    }
});

// ===========================
// Start Application
// ===========================
document.addEventListener('DOMContentLoaded', initialize);
