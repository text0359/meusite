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
    let lastReactionTimestamp = 0;
    const REACTION_COOLDOWN = 2000;

    const peerConfig = {
        host: '0.peerjs.com', port: 443, secure: true,
        config: { 'iceServers': [{ urls: 'stun:stun.l.google.com:19302' }] }
    };

    // --- SETUP DO PLAYER DE IFRAME ---
    const iframePlayer = document.createElement('iframe');
    iframePlayer.id = 'iframe-player';
    iframePlayer.style.position = 'absolute';
    iframePlayer.style.top = '0';
    iframePlayer.style.left = '0';
    iframePlayer.style.width = '100%';
    iframePlayer.style.height = '100%';
    iframePlayer.style.border = '0';
    iframePlayer.style.display = 'none';
    iframePlayer.setAttribute('allow', 'autoplay; fullscreen; picture-in-picture');
    videoPlayer.parentNode.insertBefore(iframePlayer, videoPlayer.nextSibling);

    function hideAllPlayers() {
        videoPlayer.style.display = 'none';
        iframePlayer.style.display = 'none';
        videoPlayer.src = '';
        iframePlayer.src = '';
        videoPlayer.srcObject = null;
    }

    // --- FUNÇÕES DE CONEXÃO PEER-TO-PEER ---
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
            if (isHost && videoStream) {
                 startMediaCall(conn.peer);
            }
        });
        peer.on('call', call => {
            mediaCall = call;
            mediaCall.answer();
            mediaCall.on('stream', remoteStream => {
                hideAllPlayers();
                videoPlayer.style.display = 'block';
                videoPlayer.srcObject = remoteStream;
                videoPlayer.play().catch(e => console.error("Erro no play:", e));
                overlayText.style.display = 'none';
                isHost = false;
            });
             mediaCall.on('close', () => {
                hideAllPlayers();
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
        hideAllPlayers();
        overlayText.style.display = 'block';
    }

    function startMediaCall(friendId) {
        if (peer && videoStream) mediaCall = peer.call(friendId, videoStream);
    }
    
    function setupDataConnectionEvents(conn) {
        conn.on('data', data => {
            if (data.type === 'load_url' && !isHost) {
                loadVideoByUrl(data.url);
            }
            else if (data.type === 'video_control' && !isHost) {
                 handleControlMessage(data);
            }
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

    // --- CARREGAMENTO DE VÍDEOS ---

    function loadVideoFromFile(file) {
        const fileUrl = URL.createObjectURL(file);
        isHost = true;
        videoStream = null; 
        
        hideAllPlayers();
        videoPlayer.style.display = 'block';
        videoPlayer.src = fileUrl;
        videoPlayer.load();
        videoPlayer.oncanplay = () => {
            videoPlayer.play();
            overlayText.style.display = 'none';
            if (videoPlayer.captureStream) {
                videoStream = videoPlayer.captureStream();
                if (dataConnection && dataConnection.open) startMediaCall(dataConnection.peer);
            } else {
                alert('Seu navegador não suporta captura de stream para sincronização.');
            }
        };
        sendData({ type: 'load_url', url: fileUrl });
    }
    
    // =========================================================================
    // ===== FUNÇÃO DE CARREGAR URL TOTALMENTE REFEITA E CORRIGIDA =========
    // =========================================================================
    function loadVideoByUrl(url) {
        isHost = true;
        videoStream = null; // iframes não geram stream para sincronizar play/pause
        
        hideAllPlayers();
        let embedUrl = '';
        let videoLoaded = false;

        // **Lógica de conversão de links robusta e correta**
        
        // 1. Link direto de arquivo (.mp4, etc)
        if (url.match(/\.(mp4|webm|ogg|mov)$/i)) {
            videoPlayer.src = url;
            videoPlayer.style.display = 'block';
            videoLoaded = true;
            videoPlayer.oncanplay = () => {
                videoPlayer.play();
                if (videoPlayer.captureStream) {
                    videoStream = videoPlayer.captureStream();
                    if (dataConnection && dataConnection.open) startMediaCall(dataConnection.peer);
                }
            };
        }
        // 2. YouTube (formato oficial)
        else if (url.includes('youtube.com') || url.includes('youtu.be')) {
            const videoId = url.match(/(?:v=|\/embed\/|youtu\.be\/|watch\?v=)([\w-]{11})/);
            if (videoId && videoId[1]) {
                embedUrl = `https://www.youtube.com/embed/${videoId[1]}?autoplay=1&rel=0&iv_load_policy=3`;
            }
        }
        // 3. Vimeo
        else if (url.includes('vimeo.com')) {
            const videoId = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
            if (videoId && videoId[1]) {
                embedUrl = `https://player.vimeo.com/video/${videoId[1]}?autoplay=1&title=0&byline=0&portrait=0`;
            }
        }
        // 4. Dailymotion
        else if (url.includes('dailymotion.com') || url.includes('dai.ly')) {
            const videoId = url.match(/dailymotion\.com\/(?:video|embed\/video)\/([\w-]+)/);
            if (videoId && videoId[1]) {
                embedUrl = `https://www.dailymotion.com/embed/video/${videoId[1]}?autoplay=1`;
            }
        }
        // 5. Facebook
        else if (url.includes('facebook.com')) {
            // Facebook precisa do link completo codificado
            embedUrl = `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(url)}&show_text=0&autoplay=true`;
        }
        
        // Se um embedUrl foi criado com sucesso, usa o iframe
        if (embedUrl) {
            iframePlayer.src = embedUrl;
            iframePlayer.style.display = 'block';
            videoLoaded = true;
        }

        // Finaliza o carregamento
        if (videoLoaded) {
            overlayText.style.display = 'none';
            if (isHost) {
                sendData({ type: 'load_url', url: url });
            }
        } else {
            alert('URL de vídeo inválida ou não suportada.');
            overlayText.style.display = 'block';
        }
    }

    // --- EVENTOS DE BOTÕES E CONTROLES ---
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
        if (e.target.files[0]) {
            loadVideoFromFile(e.target.files[0]);
        }
        mainMenuPopup.classList.remove('active');
    });

    loadUrlBtn.addEventListener('click', () => {
        const url = videoUrlInput.value.trim();
        if (url) {
            loadVideoByUrl(url);
        }
        mainMenuPopup.classList.remove('active');
    });
    
    // Controles de Play/Pause/Seek (só para o <video>)
    playPauseBtn.addEventListener('click', () => videoPlayer.paused ? videoPlayer.play() : videoPlayer.pause());
    videoPlayer.addEventListener('play', () => { playPauseBtnImg.src = 'icons/pause-button.svg'; sendControlCommand({ action: 'play' }); });
    videoPlayer.addEventListener('pause', () => { playPauseBtnImg.src = 'icons/play-button.svg'; sendControlCommand({ action: 'pause' }); });
    videoPlayer.addEventListener('seeked', () => sendControlCommand({ action: 'seek', time: videoPlayer.currentTime }));

    // Controles de Volume (só para o <video>)
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
    
    // Barra de Progresso (só para o <video>)
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

    // --- LÓGICA DE EMOJIS ---
    const emojiSymbols = { 'laugh': '😂', 'sleep': '😴', 'cry': '😭', 'cold': '🥶', 'clap': '👏', 'heart': '❤️' };
    const reactionButtons = document.querySelectorAll('.reaction-button');

    function explodeEmojis(symbol) {
        const numberOfEmojis = Math.floor(Math.random() * 8) + 5;
        for (let i = 0; i < numberOfEmojis; i++) {
            setTimeout(() => {
                const emojiElement = document.createElement('div');
                emojiElement.textContent = symbol;
                emojiElement.classList.add('emoji');
                
                emojiElement.style.left = `${window.innerWidth / 2}px`;
                emojiElement.style.top = `${window.innerHeight}px`;

                const finalXOffset = (Math.random() - 0.5) * (window.innerWidth * 0.7);
                const finalYOffset = -(window.innerHeight * 0.8 + Math.random() * window.innerHeight * 0.2);
                
                emojiElement.style.setProperty('--final-x-offset', `${finalXOffset}px`);
                emojiElement.style.setProperty('--final-y-offset', `${finalYOffset}px`);
                emojiElement.style.setProperty('--rotate-end', `${(Math.random() * 720 - 360)}deg`);
                emojiElement.style.setProperty('--anim-duration', `${(2 + Math.random() * 1.5)}s`);
                
                emojiContainer.appendChild(emojiElement);

                emojiElement.addEventListener('animationend', () => emojiElement.remove());
            }, i * 40);
        }
    }

    reactionButtons.forEach(button => {
        button.addEventListener('click', () => {
            const now = Date.now();
            if (now - lastReactionTimestamp < REACTION_COOLDOWN) {
                button.classList.add('shake-animation');
                setTimeout(() => button.classList.remove('shake-animation'), 400);
                return;
            }
            lastReactionTimestamp = now;

            const emojiType = button.dataset.emoji;
            const symbol = emojiSymbols[emojiType];
            if (symbol) {
                explodeEmojis(symbol);
                sendData({ type: 'emoji_reaction', emoji: emojiType });
            }
        });
    });
    
    // Inicia a conexão ao carregar a página
    startPeer();
});
