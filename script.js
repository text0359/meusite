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
    const playPauseBtn = document.getElementById('playPauseBtn');
    const playPauseBtnImg = playPauseBtn.querySelector('img');
    const volumeBtn = document.getElementById('volumeBtn');
    const volumeControl = document.getElementById('volumeControl');
    const volumeSlider = document.getElementById('volumeSlider');
    const muteToggleBtn = document.getElementById('muteToggleBtn');
    const muteToggleImg = muteToggleBtn.querySelector('img');
    const seekBar = document.getElementById('seekBar');
    const currentTimeDisplay = document.getElementById('currentTimeDisplay');
    const totalDurationDisplay = document.getElementById('totalDurationDisplay');

    // --- VARIÁVEIS DE ESTADO E CONTROLE ---
    let peer = null, dataConnection = null, mediaCall = null;
    let isServerOn = false, isHost = false, videoStream = null;

    // ===================================================
    // ===== NOVAS VARIÁVEIS PARA CONTROLE DE EMOJI =====
    // ===================================================
    let lastReactionTimestamp = 0;
    const REACTION_COOLDOWN = 2000; // Cooldown de 2000ms (2 segundos)

    const peerConfig = {
        host: '0.peerjs.com', port: 443, secure: true,
        config: { 'iceServers': [{ urls: 'stun:stun.l.google.com:19302' }] }
    };

    function startPeer() {
        if (peer && peer.open) return;
        currentRoomIdSpan.textContent = 'Gerando...';
        powerButtonImg.src = 'icons/power-button on.svg';
        roomIdDisplay.style.display = 'flex';
        peer = new Peer(undefined, peerConfig);
        peer.on('open', id => {
            currentRoomIdSpan.textContent = id;
            isServerOn = true;
        });
        peer.on('connection', conn => {
            dataConnection = conn;
            setupDataConnectionEvents(dataConnection);
            if (isHost && videoStream) startMediaCall(conn.peer);
        });
        peer.on('call', call => {
            mediaCall = call;
            mediaCall.answer();
            mediaCall.on('stream', remoteStream => {
                videoPlayer.srcObject = remoteStream;
                videoPlayer.play().catch(e => console.error("Erro no play:", e));
                overlayText.style.display = 'none';
                isHost = false;
            });
             mediaCall.on('close', () => {
                videoPlayer.srcObject = null;
                overlayText.style.display = 'block';
            });
        });
        peer.on('error', err => stopPeer());
    }

    function stopPeer() {
        if (peer) peer.destroy();
        peer = null, isServerOn = false, dataConnection = null, mediaCall = null;
        isHost = false, videoStream = null;
        powerButtonImg.src = 'icons/power-button off.svg';
        roomIdDisplay.style.display = 'none';
        currentRoomIdSpan.textContent = '';
        videoPlayer.src = '', videoPlayer.srcObject = null;
        overlayText.style.display = 'block';
    }

    function startMediaCall(friendId) {
        if (peer && videoStream) mediaCall = peer.call(friendId, videoStream);
    }
    
    function setupDataConnectionEvents(conn) {
        conn.on('data', data => {
            if (data.type === 'video_control' && !isHost) handleControlMessage(data);
            else if (data.type === 'emoji_reaction') {
                explodeEmojis(emojiSymbols[data.emoji] || data.emoji);
            }
        });
        conn.on('open', () => alert(`Conectado com ${conn.peer}!`));
        conn.on('close', () => {
            alert(`Conexão com ${conn.peer} perdida.`);
            dataConnection = null;
        });
    }

    function sendData(data) {
        if (dataConnection && dataConnection.open) dataConnection.send(data);
    }
    
    function handleControlMessage(data) {
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
        isHost = true, videoPlayer.srcObject = null, videoPlayer.src = source;
        videoPlayer.load();
        videoPlayer.oncanplay = () => {
            videoPlayer.play();
            overlayText.style.display = 'none';
            if (videoPlayer.captureStream) {
                videoStream = videoPlayer.captureStream();
                if (dataConnection && dataConnection.open) startMediaCall(dataConnection.peer);
            } else alert('Seu navegador não suporta captura de stream.');
        };
    }

    powerButton.addEventListener('click', () => isServerOn ? stopPeer() : startPeer());
    copyRoomIdBtn.addEventListener('click', () => navigator.clipboard.writeText(currentRoomIdSpan.textContent).then(() => alert('ID copiado!')));
    openMenuBtn.addEventListener('click', () => mainMenuPopup.classList.add('active'));
    closeMenuPopupBtn.addEventListener('click', () => mainMenuPopup.classList.remove('active'));
    connectFriendBtn.addEventListener('click', () => {
        const friendId = friendIdInput.value.trim();
        if (friendId && peer && peer.open) {
            dataConnection = peer.connect(friendId);
            setupDataConnectionEvents(dataConnection);
        }
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
    
    playPauseBtn.addEventListener('click', () => videoPlayer.paused ? videoPlayer.play() : videoPlayer.pause());
    videoPlayer.addEventListener('play', () => { playPauseBtnImg.src = 'icons/pause-button.svg'; sendControlCommand({ action: 'play' }); });
    videoPlayer.addEventListener('pause', () => { playPauseBtnImg.src = 'icons/play-button.svg'; sendControlCommand({ action: 'pause' }); });
    videoPlayer.addEventListener('seeked', () => sendControlCommand({ action: 'seek', time: videoPlayer.currentTime }));

    let volumeHideTimeout;
    function showVolumeControl() {
        clearTimeout(volumeHideTimeout);
        volumeControl.classList.remove('hidden');
        volumeHideTimeout = setTimeout(() => volumeControl.classList.add('hidden'), 3000);
    }
    volumeBtn.addEventListener('click', showVolumeControl);
    volumeSlider.addEventListener('input', e => { videoPlayer.volume = e.target.value; showVolumeControl(); });
    muteToggleBtn.addEventListener('click', () => videoPlayer.muted = !videoPlayer.muted);
    videoPlayer.addEventListener('volumechange', () => {
        volumeSlider.value = videoPlayer.volume;
        muteToggleImg.src = (videoPlayer.muted || videoPlayer.volume === 0) ? 'icons/volume-mute.svg' : 
                            (videoPlayer.volume > 0.5) ? 'icons/volume-high.svg' : 'icons/volume-low.svg';
    });
    
    function formatTime(timeInSeconds) {
        const minutes = Math.floor(timeInSeconds / 60);
        const seconds = Math.floor(timeInSeconds % 60);
        return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }
    videoPlayer.addEventListener('loadedmetadata', () => {
        totalDurationDisplay.textContent = formatTime(videoPlayer.duration);
        seekBar.max = videoPlayer.duration;
    });
    videoPlayer.addEventListener('timeupdate', () => {
        currentTimeDisplay.textContent = formatTime(videoPlayer.currentTime);
        seekBar.value = videoPlayer.currentTime;
    });
    seekBar.addEventListener('input', () => {
        if (isHost) videoPlayer.currentTime = seekBar.value;
        else seekBar.value = videoPlayer.currentTime;
    });

    // --- LÓGICA DE EMOJIS ATUALIZADA ---
    const emojiSymbols = { 'laugh': '😂', 'sleep': '😴', 'cry': '😭', 'cold': '😨', 'clap': '👏', 'heart': '😍' };
    const reactionButtons = document.querySelectorAll('.reaction-button');

    function explodeEmojis(symbol) {
        const numberOfEmojis = Math.floor(Math.random() * 8) + 5; // Entre 5 e 12 emojis
        for (let i = 0; i < numberOfEmojis; i++) {
            // Atraso para criar cada emoji da explosão, deixando a animação mais leve
            setTimeout(() => {
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
            }, i * 40); // Atraso de 40ms entre cada emoji da mesma explosão
        }
    }

    reactionButtons.forEach(button => {
        button.addEventListener('click', () => {
            // ===== VERIFICAÇÃO DE COOLDOWN =====
            const now = Date.now();
            if (now - lastReactionTimestamp < REACTION_COOLDOWN) {
                console.log("Cooldown da reação ativo!");
                // Adiciona a animação de "tremida" para feedback visual
                button.classList.add('shake-animation');
                setTimeout(() => button.classList.remove('shake-animation'), 400);
                return; // Impede a execução se o tempo de espera não passou
            }
            lastReactionTimestamp = now; // Atualiza o tempo do último clique

            const emojiType = button.dataset.emoji;
            const symbol = emojiSymbols[emojiType];
            if (symbol) {
                explodeEmojis(symbol); // Mostra localmente
                sendData({ type: 'emoji_reaction', emoji: emojiType }); // Envia para o amigo
            }
        });
    });
    
    startPeer();
});
