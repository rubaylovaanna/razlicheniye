const wordsPoolS = [
    { word: 'сумка', image: 'images/sumka.png' },
    { word: 'санки', image: 'images/sanki.png' },
    { word: 'миска', image: 'images/miska.png' },
    { word: 'собака', image: 'images/sobaka.png' },
    { word: 'кокос', image: 'images/kokos.png' },
    { word: 'ананас', image: 'images/ananas.png' },
    { word: 'маска', image: 'images/maska.png' },
    { word: 'посуда', image: 'images/posuda.png' },
    { word: 'сапоги', image: 'images/sapogi.png' },
    { word: 'сок', image: 'images/sok.png' },
    { word: 'касса', image: 'images/kassa.png' },
    { word: 'кактус', image: 'images/kaktus.png' }
];

const wordsPoolSh = [
    { word: 'шоколад', image: 'images/shokolad.png' },
    { word: 'мышка', image: 'images/myshka.png' },
    { word: 'шкаф', image: 'images/shkaf.png' },
    { word: 'шуба', image: 'images/shuba.png' },
    { word: 'камыш', image: 'images/kamysh.png' },
    { word: 'машина', image: 'images/mashina.png' },
    { word: 'шампунь', image: 'images/shampun.png' },
    { word: 'мешок', image: 'images/meshok.png' },
    { word: 'шапка', image: 'images/shapka.png' },
    { word: 'кошка', image: 'images/koshka.png' }
];

const STORAGE_KEY = 'game_sh_s_progress';
const CARDS_PER_GAME = 6;
const CARDS_PER_CATEGORY = 3;

let draggedElement = null;
let startX = 0, startY = 0;
let correctCount = 0;
let totalCards = 0;
let gameState = null;
let audioContext = null;
let sounds = {};

const cardsContainer = document.getElementById('cardsContainer');
const winModal = document.getElementById('winModal');
const restartBtn = document.getElementById('restartBtn');

// Инициализация аудио (для iOS и кроссбраузерности)
function initAudio() {
    // Создаем AudioContext для iOS
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    
    // Resume AudioContext если он suspended (требование iOS)
    if (audioContext.state === 'suspended') {
        audioContext.resume();
    }
    
    // Инициализируем звуки через Howler
    if (!sounds.magicSound) {
        sounds.magicSound = new Howl({
            src: ['sounds/magic-sound.mp3'],
            volume: 0.7,
            html5: true,
            preload: true
        });
    }
    
    if (!sounds.winSound) {
        sounds.winSound = new Howl({
            src: ['sounds/win.mp3'],
            volume: 0.8,
            html5: true,
            preload: true
        });
    }
}

// Воспроизведение звука успеха
function playSuccessSound() {
    try {
        initAudio();
        if (sounds.magicSound) {
            sounds.magicSound.stop();
            sounds.magicSound.play();
        }
    } catch (e) {
        console.warn('Не удалось воспроизвести звук:', e);
    }
}

// Воспроизведение звука победы
function playWinSound() {
    try {
        initAudio();
        if (sounds.winSound) {
            sounds.winSound.stop();
            sounds.winSound.play();
        }
    } catch (e) {
        console.warn('Не удалось воспроизвести звук:', e);
    }
}

function shuffle(array) {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
}

function getRandomItems(array, count) {
    const shuffled = shuffle(array);
    return shuffled.slice(0, count);
}

function saveGameState() {
    if (!gameState) return;
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(gameState));
    } catch (e) {
        console.warn('Не удалось сохранить прогресс:', e);
    }
}

function loadGameState() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) return JSON.parse(saved);
    } catch (e) {
        console.warn('Не удалось загрузить прогресс:', e);
    }
    return null;
}

function clearGameState() {
    try {
        localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
        console.warn('Не удалось очистить сохранение:', e);
    }
}

function updateCounters() {
    if (!gameState) return;
    const remainingS = gameState.remainingCards.filter(c => c.target === 's').length;
    const remainingSh = gameState.remainingCards.filter(c => c.target === 'sh').length;
    const doneS = CARDS_PER_CATEGORY - remainingS;
    const doneSh = CARDS_PER_CATEGORY - remainingSh;
    document.getElementById('counter-s').textContent = `${doneS}/${CARDS_PER_CATEGORY}`;
    document.getElementById('counter-sh').textContent = `${doneSh}/${CARDS_PER_CATEGORY}`;
}

function createCardElement(item, index) {
    const card = document.createElement('div');
    card.className = 'card spawn';
    card.dataset.target = item.target;
    card.dataset.word = item.word;
    
    const img = document.createElement('img');
    img.className = 'image';
    img.src = item.image;
    img.alt = item.word;
    img.draggable = false;
    
    const wordSpan = document.createElement('span');
    wordSpan.className = 'word';
    wordSpan.textContent = item.word;
    
    card.appendChild(img);
    card.appendChild(wordSpan);
    
    card.addEventListener('pointerdown', handlePointerDown);
    
    return card;
}

function initGame(forceNew = false) {
    initAudio();
    
    cardsContainer.innerHTML = '';
    winModal.classList.remove('active');
    correctCount = 0;
    document.querySelectorAll('.confetti').forEach(c => c.remove());

    if (!forceNew) {
        const savedState = loadGameState();
        if (savedState) {
            gameState = savedState;
            restoreGame();
            return;
        }
    }

    clearGameState();

    const selectedS = getRandomItems(wordsPoolS, CARDS_PER_CATEGORY);
    const selectedSh = getRandomItems(wordsPoolSh, CARDS_PER_CATEGORY);
    
    const allCards = [
        ...selectedS.map(item => ({ ...item, target: 's' })),
        ...selectedSh.map(item => ({ ...item, target: 'sh' }))
    ];
    
    totalCards = allCards.length;
    const shuffledCards = shuffle(allCards);

    gameState = {
        selectedCards: shuffledCards,
        remainingCards: [...shuffledCards]
    };

    shuffledCards.forEach((item, index) => {
        setTimeout(() => {
            const card = createCardElement(item, index);
            cardsContainer.appendChild(card);
        }, index * 100);
    });
    
    saveGameState();
    updateCounters();
}

function restoreGame() {
    totalCards = gameState.selectedCards.length;
    correctCount = gameState.selectedCards.length - gameState.remainingCards.length;

    gameState.remainingCards.forEach((item, index) => {
        setTimeout(() => {
            const card = createCardElement(item, index);
            cardsContainer.appendChild(card);
        }, index * 100);
    });

    updateCounters();

    if (correctCount === totalCards) {
        setTimeout(() => showWin(), 500);
    }
}

function handlePointerDown(e) {
    e.preventDefault();
    draggedElement = e.currentTarget;
    const rect = draggedElement.getBoundingClientRect();
    startX = e.clientX;
    startY = e.clientY;
    draggedElement.style.position = 'fixed';
    draggedElement.style.left = rect.left + 'px';
    draggedElement.style.top = rect.top + 'px';
    draggedElement.style.width = rect.width + 'px';
    draggedElement.style.zIndex = 1000;
    draggedElement.classList.remove('spawn');
    document.addEventListener('pointermove', handlePointerMove);
    document.addEventListener('pointerup', handlePointerUp);
}

function handlePointerMove(e) {
    if (!draggedElement) return;
    e.preventDefault();
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    draggedElement.style.transform = `translate(${dx}px, ${dy}px) scale(1.15) rotate(3deg)`;
    checkHover(e.clientX, e.clientY);
}

function checkHover(x, y) {
    document.querySelectorAll('.drop-zone').forEach(zone => {
        const rect = zone.getBoundingClientRect();
        if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
            zone.classList.add('drag-over');
        } else {
            zone.classList.remove('drag-over');
        }
    });
}

function handlePointerUp(e) {
    if (!draggedElement) return;
    document.removeEventListener('pointermove', handlePointerMove);
    document.removeEventListener('pointerup', handlePointerUp);

    const targetSound = draggedElement.dataset.target;
    let droppedInZone = null;

    document.querySelectorAll('.drop-zone').forEach(zone => {
        zone.classList.remove('drag-over');
        const rect = zone.getBoundingClientRect();
        if (e.clientX >= rect.left && e.clientX <= rect.right && 
            e.clientY >= rect.top && e.clientY <= rect.bottom) {
            droppedInZone = zone.dataset.target;
        }
    });

    if (droppedInZone === targetSound) {
        handleSuccess(draggedElement);
    } else {
        handleError(draggedElement);
    }

    draggedElement = null;
}

function handleSuccess(element) {
    const word = element.dataset.word;
    element.classList.add('vanish');
    
    playSuccessSound();
    
    setTimeout(() => {
        element.remove();
        gameState.remainingCards = gameState.remainingCards.filter(c => c.word !== word);
        correctCount++;
        updateCounters();
        saveGameState();
        if (correctCount === totalCards) {
            setTimeout(showWin, 300);
        }
    }, 500);
}

function handleError(element) {
    element.style.transition = 'all 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55)';
    element.style.transform = 'translate(0, 0) rotate(0deg)';
    element.style.position = 'relative';
    element.style.left = '';
    element.style.top = '';
    element.style.width = '';
    element.style.zIndex = '10';
    
    element.classList.add('shake');
    
    setTimeout(() => {
        element.classList.remove('shake');
        element.style.transition = '';
        element.style.transform = '';
    }, 500);
}

function showWin() {
    winModal.classList.add('active');
    playWinSound();
    createConfetti();
    clearGameState();
}

function createConfetti() {
    const colors = ['#ff9f43', '#0abde3', '#1dd1a1', '#feca57', '#ff6b6b', '#5f27cd', '#00d2d3'];
    const shapes = ['circle', 'square', 'triangle'];
    for (let i = 0; i < 100; i++) {
        setTimeout(() => {
            const confetti = document.createElement('div');
            confetti.className = 'confetti';
            confetti.style.left = Math.random() * 100 + 'vw';
            confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
            confetti.style.animationDuration = (Math.random() * 3 + 2) + 's';
            confetti.style.opacity = Math.random();
            const shape = shapes[Math.floor(Math.random() * shapes.length)];
            if (shape === 'circle') {
                confetti.style.borderRadius = '50%';
            } else if (shape === 'triangle') {
                confetti.style.width = '0';
                confetti.style.height = '0';
                confetti.style.borderLeft = '6px solid transparent';
                confetti.style.borderRight = '6px solid transparent';
                confetti.style.borderBottom = `12px solid ${confetti.style.backgroundColor}`;
                confetti.style.backgroundColor = 'transparent';
            }
            document.body.appendChild(confetti);
            setTimeout(() => confetti.remove(), 5000);
        }, i * 30);
    }
}

restartBtn.addEventListener('click', () => initGame(true));

document.addEventListener('click', function initAudioOnFirstClick() {
    initAudio();
    document.removeEventListener('click', initAudioOnFirstClick);
}, { once: true });

document.addEventListener('touchstart', function initAudioOnFirstTouch() {
    initAudio();
    document.removeEventListener('touchstart', initAudioOnFirstTouch);
}, { once: true });

window.addEventListener('load', initGame);
