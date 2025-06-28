document.addEventListener('DOMContentLoaded', () => {
    // --- SELEÇÃO DE ELEMENTOS DO HTML ---
    const powerButton = document.getElementById('powerButton');
    const powerButtonImg = powerButton.querySelector('img');
    const roomIdDisplay = document.getElementById('roomIdDisplay');
    const currentRoomIdSpan = document.getElementById('currentRoomId');
    const copyRoomIdBtn = document.getElementById('copyRoomIdBtn');
    const videoPlayer = document.getElementById('videoPlayer');
    const overlayText = document.getElementById('overlayText');
    const emojiContainer = document.getElementById('emoji-container');

    // Botões do Menu
    const openMenuBtn = document.getElementById('openMenuBtn');
    const closeMenuPopupBtn = document.getElementById('closeMenuPopupBtn');
    const mainMenuPopup = document.getElementById('mainMenuPopup');
    const friendIdInput = document.getElementById('friendIdInput');
    const connectFriendBtn = document.getElementById('connectFriendBtn');
    const disconnectFriendBtn = document.getElementById('disconnectFriendBtn');
    const loadUrlBtn = document.getElementById('loadUrlBtn');
    const videoUrlInput = document.getElementById('videoUrlInput');
    const loadLocalFileBtn = document.getElementById('loadLocalFileBtn');
    const videoUploadInput = document.getElementById('videoUploadInput');

    // Controles do Player
    const playPauseBtn = document.getElementById('playPauseBtn');
    const playPauseBtnImg = playPauseBtn.querySelector('img');
    const volumeBtn = document.getElementById('volumeBtn');
    const volumeControl = document.getElementById('volumeControl');
    const volumeSlider = document.getElementById('volumeSlider');
    const muteToggleBtn = document.getElementById('muteToggleBtn');
    const muteToggleImg = muteToggleBtn.querySelector('img');

    // --- VARIÁVEIS DE ESTADO E CONTROLE ---
    let peer = null;
    let dataConnection = null;
    let mediaCall = null;
    let isServerOn = false;
    let isHost = false;
    let videoStream = null;

    // Configuração do PeerJS
    const peerConfig = {
        host: '0.peerjs.com',
        port: 443,
        secure: true,
        config: { 'iceServers': [{ urls: 'stun:stun.l.google.com:19302' }] }
    };

    // --- FUNÇÕES PRINCIPAIS DO PEERJS ---

    function startPeer() {
        if (peer && peer.open) return;

        currentRoomIdSpan.textContent = 'Gerando...';
        powerButtonImg.src = 'icons/power-button on.svg';
        roomIdDisplay.style.display = 'flex';

        peer = new Peer(undefined, peerConfig);

        peer.on('open', id => {
            console.log('PeerJS conectado com ID:', id);
            currentRoomIdSpan.textContent = id;
            isServerOn = true;
        });

        peer.on('connection', conn => {
            console.log('Recebendo conexão de dados de:', conn.peer);
            dataConnection = conn;
            setupDataConnectionEvents(dataConnection);
            if (isHost && videoStream) {
                startMediaCall(conn.peer);
            }
        });

        peer.on('call', call => {
            console.log('Recebendo chamada de vídeo de:', call.peer);
            mediaCall = call;
            mediaCall.answer();
            mediaCall.on('stream', remoteStream => {
                console.log('Stream de vídeo remoto recebido!');
                videoPlayer.srcObject = remoteStream;
                videoPlayer.play().catch(e => console.error("Erro no play automático:", e));
                overlayText.style.display = 'none';
                isHost = false;
            });
             mediaCall.on('close', () => {
                console.log('Chamada de vídeo encerrada.');
                videoPlayer.srcObject = null;
                overlayText.style.display = 'block';
            });
        });

        peer.on('error', err => {
            console.error('Erro no PeerJS:', err);
            stopPeer();
        });
    }

    function stopPeer() {
        if (peer) peer.destroy();
        peer = null;
        isServerOn = false;
        powerButtonImg.src = 'icons/power-button off.svg';
        roomIdDisplay.style.display = 'none';
        currentRoomIdSpan.textContent = '';
        dataConnection = null;
        mediaCall = null;
        isHost = false;
        videoStream = null;
        videoPlayer.src = '';
        videoPlayer.srcObject = null;
        overlayText.style.display = 'block';
        console.log('Servidor PeerJS desligado.');
    }

    // --- FUNÇÕES DE CONEXÃO E STREAMING ---

    function startMediaCall(friendId) {
        if (!peer || !videoStream) return;
        console.log(`Iniciando chamada de vídeo para ${friendId}...`);
        mediaCall = peer.call(friendId, videoStream);
    }
    
    function setupDataConnectionEvents(conn) {
        conn.on('data', data => {
            if (data.type === 'video_control' && !isHost) {
                handleControlMessage(data);
            } else if (data.type === 'emoji_reaction') {
                explodeEmojis(emojiSymbols[data.emoji] || data.emoji);
            }
        });
        conn.on('open', () => alert(`Conexão de dados estabelecida com ${conn.peer}!`));
        conn.on('close', () => {
            alert(`Conexão de dados com ${conn.peer} perdida.`);
            dataConnection = null;
        });
    }

    function sendData(data) {
        if (dataConnection && dataConnection.open) {
            dataConnection.send(data);
        }
    }
    
    function handleControlMessage(data) {
        console.log('Comando recebido:', data.action);
        switch (data.action) {
            case 'play': videoPlayer.play(); break;
            case 'pause': videoPlayer.pause(); break;
            case 'seek': videoPlayer.currentTime = data.time; break;
        }
    }

    function sendControlCommand(command) {
        if (isHost) sendData({ type: 'video_control', ...command });
    }
    
    function loadVideoAndBecomeHost(source) {
        isHost = true;
        videoPlayer.srcObject = null; // Limpa stream antigo, se houver
        videoPlayer.src = source;
        videoPlayer.load();
        
        videoPlayer.oncanplay = () => {
            videoPlayer.play();
            overlayText.style.display = 'none';
            if (videoPlayer.captureStream) {
                videoStream = videoPlayer.captureStream();
                console.log('Stream de vídeo capturado!');
                if (dataConnection && dataConnection.open) {
                    startMediaCall(dataConnection.peer);
                }
            } else {
                alert('Seu navegador não suporta a captura de stream.');
            }
        };
    }

    // --- EVENTOS DE INTERFACE DO USUÁRIO ---

    powerButton.addEventListener('click', () => isServerOn ? stopPeer() : startPeer());
    copyRoomIdBtn.addEventListener('click', () => navigator.clipboard.writeText(currentRoomIdSpan.textContent).then(() => alert('ID copiado!')));
    openMenuBtn.addEventListener('click', () => mainMenuPopup.classList.add('active'));
    closeMenuPopupBtn.addEventListener('click', () => mainMenuPopup.classList.remove('active'));

    connectFriendBtn.addEventListener('click', () => {
        const friendId = friendIdInput.value.trim();
        if (!friendId || !peer || !peer.open) return;
        dataConnection = peer.connect(friendId);
        setupDataConnectionEvents(dataConnection);
        mainMenuPopup.classList.remove('active');
    });
    
    disconnectFriendBtn.addEventListener('click', () => {
        if (dataConnection) dataConnection.close();
        if (mediaCall) mediaCall.close();
        mainMenuPopup.classList.remove('active');
    });

    loadLocalFileBtn.addEventListener('click', () => videoUploadInput.click());
    videoUploadInput.addEventListener('change', e => {
        if (e.target.files[0]) loadVideoAndBecomeHost(URL.createObjectURL(e.target.files[0]));
        mainMenuPopup.classList.remove('active');
    });

    loadUrlBtn.addEventListener('click', () => {
        if (videoUrlInput.value.trim()) loadVideoAndBecomeHost(videoUrlInput.value.trim());
        mainMenuPopup.classList.remove('active');
    });
    
    // --- CONTROLES DO PLAYER E SINCRONIZAÇÃO ---

    playPauseBtn.addEventListener('click', () => videoPlayer.paused ? videoPlayer.play() : videoPlayer.pause());
    videoPlayer.addEventListener('play', () => {
        playPauseBtnImg.src = 'icons/pause-button.svg';
        sendControlCommand({ action: 'play' });
    });
    videoPlayer.addEventListener('pause', () => {
        playPauseBtnImg.src = 'icons/play-button.svg';
        sendControlCommand({ action: 'pause' });
    });
    videoPlayer.addEventListener('seeked', () => sendControlCommand({ action: 'seek', time: videoPlayer.currentTime }));

    // --- LÓGICA DE VOLUME ---
    let volumeHideTimeout;
    function showVolumeControl() {
        clearTimeout(volumeHideTimeout);
        volumeControl.classList.remove('hidden');
        volumeHideTimeout = setTimeout(() => volumeControl.classList.add('hidden'), 3000);
    }
    
    volumeBtn.addEventListener('click', showVolumeControl);
    volumeSlider.addEventListener('input', e => {
        videoPlayer.volume = e.target.value;
        showVolumeControl(); 
    });
    muteToggleBtn.addEventListener('click', () => videoPlayer.muted = !videoPlayer.muted);
    videoPlayer.addEventListener('volumechange', () => {
        volumeSlider.value = videoPlayer.volume;
        muteToggleImg.src = (videoPlayer.muted || videoPlayer.volume === 0) ? 'icons/volume-mute.svg' : 
                            (videoPlayer.volume > 0.5) ? 'icons/volume-high.svg' : 'icons/volume-low.svg';
    });

    // --- LÓGICA COMPLETA DE REAÇÕES (Emoji) ---
    const emojiSymbols = {
        'laugh': '😂', 'sleep': '😴', 'cry': '😭', 'cold': '🥶', 'clap': '👏', 'heart': '❤️'
    };
    const reactionButtons = document.querySelectorAll('.reaction-button');

    function explodeEmojis(symbol) {
        const numberOfEmojis = Math.floor(Math.random() * 6) + 5;
        for (let i = 0; i < numberOfEmojis; i++) {
            const emojiElement = document.createElement('div');
            emojiElement.textContent = symbol;
            emojiElement.classList.add('emoji');
            
            const startX = window.innerWidth / 2;
            const startY = window.innerHeight;
            emojiElement.style.left = `${startX}px`;
            emojiElement.style.top = `${startY}px`;

            const finalXOffset = (Math.random() - 0.5) * (window.innerWidth * 0.7);
            const finalYOffset = -(window.innerHeight * 0.8 + Math.random() * window.innerHeight * 0.2);
            const rotateStart = (Math.random() * 90 - 45);
            const rotateEnd = (Math.random() * 720 - 360);
            const scaleStart = (0.7 + Math.random() * 0.3);
            const scaleEnd = (1 + Math.random() * 0.5);
            const duration = (2 + Math.random() * 1.5);
            const delay = (Math.random() * 0.3);

            emojiElement.style.setProperty('--initial-x-offset', `-${emojiElement.offsetWidth / 2}px`);
            emojiElement.style.setProperty('--initial-y-offset', `-${emojiElement.offsetHeight / 2}px`);
            emojiElement.style.setProperty('--final-x-offset', `${finalXOffset}px`);
            emojiElement.style.setProperty('--final-y-offset', `${finalYOffset}px`);
            emojiElement.style.setProperty('--rotate-start', `${rotateStart}deg`);
            emojiElement.style.setProperty('--rotate-end', `${rotateEnd}deg`);
            emojiElement.style.setProperty('--scale-start', `${scaleStart}`);
            emojiElement.style.setProperty('--scale-end', `${scaleEnd}`);
            emojiElement.style.setProperty('--anim-duration', `${duration}s`);
            emojiElement.style.setProperty('--anim-delay', `${delay}s`);
            emojiElement.style.fontSize = `${22 + Math.random() * 20}px`;
            
            emojiContainer.appendChild(emojiElement);

            emojiElement.addEventListener('animationend', () => emojiElement.remove());
        }
    }

    reactionButtons.forEach(button => {
        button.addEventListener('click', () => {
            const emojiType = button.dataset.emoji;
            const symbol = emojiSymbols[emojiType];
            if (symbol) {
                explodeEmojis(symbol); // Mostra localmente
                sendData({ type: 'emoji_reaction', emoji: emojiType }); // Envia para o amigo
            }
        });
    });

    // Inicia o PeerJS ao carregar
    startPeer();
});
