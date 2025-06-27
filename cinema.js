let peer = null;
let conn = null;
let isHost = false;
let lastSentTime = -1; // Para otimizar comandos de seek periódicos e evitar redundância.
let hostTimeout = null; // Para gerenciar o timeout de envio de comandos do host após carregar vídeo.

// Elementos do DOM - Garantir que todos existam antes de serem usados
const videoPlayer = document.getElementById('videoPlayer');
const friendIdInput = document.getElementById('friendId');
const peerIdLabel = document.querySelector('.id-label');
const statusText = document.getElementById('statusText');
const peerStatusDiv = document.getElementById('peerStatus');
const mainMenu = document.getElementById('mainMenu');
const shareIdPopup = document.getElementById('shareIdPopup');
const myPeerIdDisplay = document.getElementById('myPeerIdDisplay');
const emojiContainer = document.getElementById('emojiContainer');

// Botões e Inputs - Garantir que todos existam
const shareBtn = document.querySelector('.share-btn');
const connectFriendBtn = document.getElementById('connectFriendBtn');
const disconnectBtn = document.getElementById('disconnectBtn');
const retryConnectBtn = document.getElementById('retryConnectBtn');
const videoInput = document.getElementById('videoInput');
const loadStreamVideoBtn = document.getElementById('loadStreamVideoBtn');
const videoUrlInput = document.getElementById('videoUrlInput');
const loadStreamUrlBtn = document.getElementById('loadStreamUrlBtn');
const addMovieToLibraryBtn = document.getElementById('addMovieToLibraryBtn');
const sceneSelector = document.getElementById('sceneSelector');
const addCurrentTimeAsSceneBtn = document.getElementById('addCurrentTimeAsSceneBtn');
const playBtnSidebar = document.getElementById('playBtn');
const emojiButtons = document.querySelectorAll('.emoji-btn');

// Sons de clique
const clickSounds = [
    new Audio("https://freesound.org/data/previews/171/171671_2437358-lq.mp3"),
    new Audio("https://freesound.org/data/previews/171/171668_2437358-lq.mp3"),
    new Audio("https://freesound.org/data/previews/171/171670_2437358-lq.mp3")
];
clickSounds.forEach(s => s.volume = 0.1);

// Arrays para dados (local storage para persistência)
let scenes = JSON.parse(localStorage.getItem('cinemaScenes')) || [];
let movieLibrary = JSON.parse(localStorage.getItem('cinemaMovieLibrary')) || [];

// --- Funções de UI/UX ---

function playClickSound() {
    try {
        const randomSound = clickSounds[Math.floor(Math.random() * clickSounds.length)];
        randomSound.currentTime = 0;
        randomSound.play().catch(e => console.warn('Erro ao tocar som de clique (provavelmente autoplay bloqueado):', e));
    } catch (e) {
        console.error('Erro na função playClickSound:', e);
    }
}

function toggleMenu() {
    if (mainMenu) {
        mainMenu.classList.toggle('show');
    }
    playClickSound();
}

function toggleSharePopup() {
    if (shareIdPopup) {
        shareIdPopup.classList.toggle('show');
        if (shareIdPopup.classList.contains('show') && peer && peer.id) {
            if (myPeerIdDisplay) myPeerIdDisplay.value = peer.id;
        } else if (myPeerIdDisplay) {
            myPeerIdDisplay.value = 'ID não disponível';
        }
    }
    playClickSound();
}

function copyMyPeerId() {
    if (myPeerIdDisplay) {
        myPeerIdDisplay.select();
        document.execCommand('copy');
        alert('ID copiado para a área de transferência!');
    }
    playClickSound();
}

function setPeerStatus(connected) {
    if (peerStatusDiv && statusText) {
        if (connected) {
            peerStatusDiv.classList.remove('offline');
            peerStatusDiv.classList.add('online');
            statusText.textContent = 'ON';
        } else {
            peerStatusDiv.classList.remove('online');
            peerStatusDiv.classList.add('offline');
            statusText.textContent = 'OFF';
        }
    }
}

function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
}

function animateEmoji(emojiText) {
    if (!emojiContainer) {
        console.error("emojiContainer não encontrado.");
        return;
    }
    const emojiEl = document.createElement('span');
    emojiEl.classList.add('animated-emoji');
    emojiEl.textContent = emojiText;
    emojiEl.style.left = `${Math.random() * 80 + 10}%`;
    emojiEl.style.bottom = `-50px`;

    emojiContainer.appendChild(emojiEl);

    emojiEl.addEventListener('animationend', () => {
        emojiEl.remove();
    });
}

function handleEmojiButtonClick(event) {
    const emoji = event.target.dataset.emoji;
    if (emoji) {
        animateEmoji(emoji);
        if (conn && conn.open) { // Verifica se a conexão está aberta
            conn.send({ type: 'emoji', emoji: emoji });
            console.log(`Emoji '${emoji}' enviado para o amigo.`);
        } else {
            console.log("Não conectado para enviar emoji.");
        }
        playClickSound();
    }
}

// --- Funções PeerJS ---

function initializePeer() {
    console.log('Iniciando initializePeer...');
    if (peer && !peer.destroyed) {
        console.log('Destruindo peer existente antes de inicializar um novo...');
        peer.destroy();
        peer = null;
    }

    if (peerIdLabel && myPeerIdDisplay) {
        peerIdLabel.textContent = 'ID: Gerando...';
        myPeerIdDisplay.value = 'Gerando ID...';
    }
    setPeerStatus(false);

    try {
        peer = new Peer({
            host: '0.peerjs.com',
            port: 443,
            path: '/'
        });

        peer.on('open', function(id) {
            console.log('PeerJS: ID gerado: ' + id);
            if (peerIdLabel && myPeerIdDisplay) {
                peerIdLabel.textContent = `ID: ${id}`;
                myPeerIdDisplay.value = id;
            }
            setPeerStatus(false); // Still not connected to a peer, just PeerJS server
        });

        peer.on('connection', function(newConn) {
            console.log('PeerJS: Conexão recebida de: ' + newConn.peer);
            if (conn && conn.open) {
                newConn.close();
                console.warn("PeerJS: Já existe uma conexão ativa. Nova conexão rejeitada.");
                alert("Já existe uma conexão ativa. Nova conexão rejeitada.");
                return;
            }
            conn = newConn;
            isHost = true; // Quem aceita a conexão se torna o host
            handlePeerConnection(conn);
            setPeerStatus(true);
            alert(`Conectado com sucesso ao amigo ID: ${conn.peer}`);
        });

        peer.on('disconnected', function() {
            console.log('PeerJS: Desconectado do servidor PeerJS.');
            setPeerStatus(false);
            conn = null;
            isHost = false;
            alert('Você foi desconectado do servidor PeerJS. Tente reiniciar a conexão.');
            if (peerIdLabel && myPeerIdDisplay) {
                peerIdLabel.textContent = 'ID: Desconectado';
                myPeerIdDisplay.value = 'Desconectado';
            }
        });

        peer.on('close', function() {
            console.log('PeerJS: Fechado (destruído).');
            setPeerStatus(false);
            conn = null;
            isHost = false;
            if (peerIdLabel && myPeerIdDisplay) {
                peerIdLabel.textContent = 'ID: Desconectado';
                myPeerIdDisplay.value = 'Desconectado';
            }
        });

        peer.on('error', function(err) {
            console.error('PeerJS: Erro:', err);
            setPeerStatus(false);
            let errorMessage = 'Erro na conexão PeerJS: ' + err.message;
            if (err.type === 'peer-unavailable') {
                errorMessage = 'Amigo com ID não encontrado. Verifique o ID ou se ele está online.';
            } else if (err.type === 'network') {
                errorMessage = 'Problema de rede. Verifique sua conexão com a internet.';
            } else if (err.type === 'disconnected') {
                errorMessage = 'Conexão PeerJS perdida. Tente novamente.';
            } else if (err.type === 'browser-incompatible') {
                errorMessage = 'Seu navegador não suporta WebRTC/PeerJS.';
            }
            alert(errorMessage + "\nPor favor, recarregue a página ou use 'Tentar Novamente'.");
            if (peerIdLabel && myPeerIdDisplay) {
                peerIdLabel.textContent = 'ID: Erro!';
                myPeerIdDisplay.value = 'Erro ao gerar ID';
            }
        });
    } catch (e) {
        console.error("Erro fatal ao inicializar PeerJS:", e);
        alert("Erro fatal ao iniciar o sistema de conexão. Verifique o console para mais detalhes.");
        if (peerIdLabel) peerIdLabel.textContent = 'ID: Falha!';
        if (myPeerIdDisplay) myPeerIdDisplay.value = 'Falha na inicialização';
    }
}

function handlePeerConnection(c) {
    c.on('data', function(data) {
        console.log('PeerJS Data: Dados recebidos:', data);
        if (data.type === 'play') {
            if (videoPlayer) videoPlayer.play();
            if (playBtnSidebar) playBtnSidebar.textContent = '⏸️';
        } else if (data.type === 'pause') {
            if (videoPlayer) videoPlayer.pause();
            if (playBtnSidebar) playBtnSidebar.textContent = '▶️';
        } else if (data.type === 'seek') {
            // Aplicar seek apenas se a diferença for significativa para evitar saltos excessivos
            // O host envia a cada 2 segundos, então 1 segundo de tolerância é razoável.
            if (videoPlayer && Math.abs(videoPlayer.currentTime - data.time) > 1) {
                videoPlayer.currentTime = data.time;
                console.log(`Comando seek aplicado. Novo tempo: ${formatTime(videoPlayer.currentTime)}`);
            }
        } else if (data.type === 'videoUrl') {
            // Se o cliente (quem NÃO é host) recebe uma URL, ele a carrega
            if (!isHost && data.url && videoPlayer) {
                console.log(`Recebido URL de vídeo: ${data.url}`);
                videoPlayer.src = data.url;
                videoPlayer.load(); // Apenas carrega, não dá play ainda.
                // O host enviará um comando 'play' e 'seek' explícito quando estiver pronto.
                alert('Vídeo recebido e carregado. Aguardando comando do host para iniciar reprodução.');
                // Envia sinal para o host de que o vídeo foi carregado
                conn.send({ type: 'videoLoaded' });
            } else if (isHost) {
                console.warn('Host recebeu uma URL do peer. Isso pode ser um fluxo inesperado.');
            } else if (!data.url) {
                console.warn('Recebido comando videoUrl, mas a URL está vazia.');
                alert('O host tentou transmitir um vídeo sem uma URL válida.');
            }
        } else if (data.type === 'requestVideoUrl' && isHost) {
            // Host envia a URL do vídeo atual (se não for blob) upon request
            if (videoPlayer && videoPlayer.src && !videoPlayer.src.startsWith('blob:')) {
                c.send({ type: 'videoUrl', url: videoPlayer.src });
                // Envia também o estado de reprodução e o tempo atual um pouco depois.
                // Isso garante que o cliente tenha processado a URL primeiro.
                clearTimeout(hostTimeout); // Clear any previous timeout
                hostTimeout = setTimeout(() => {
                    c.send({ type: 'seek', time: videoPlayer.currentTime });
                    if (!videoPlayer.paused) {
                        c.send({ type: 'play' });
                    } else {
                        c.send({ type: 'pause' });
                    }
                    console.log(`PeerJS Data: URL do vídeo '${videoPlayer.src}' e estado de reprodução enviado em resposta à solicitação.`);
                }, 1000); // Atraso de 1 segundo para o cliente carregar a URL
            } else {
                console.log("PeerJS Data: Nenhum vídeo online carregado para enviar a URL em resposta à solicitação.");
                alert("Nenhum vídeo online carregado no momento para ser transmitido ao seu amigo. Apenas vídeos carregados via URL direta podem ser transmitidos.");
            }
        } else if (data.type === 'videoLoaded' && isHost) {
            // Host recebe confirmação de que o cliente carregou o vídeo
            console.log('Cliente confirmou que o vídeo foi carregado. Enviando comandos de sincronia inicial.');
            // Envia comandos de play e seek iniciais agora que o cliente está pronto
            clearTimeout(hostTimeout); // Clear any pending timeout for initial sync
            conn.send({ type: 'seek', time: videoPlayer.currentTime });
            if (!videoPlayer.paused) {
                conn.send({ type: 'play' });
            } else {
                conn.send({ type: 'pause' });
            }
        } else if (data.type === 'emoji') {
            animateEmoji(data.emoji);
        } else if (data.type === 'message') { // Para mensagens genéricas, como avisos
            alert(`Mensagem do amigo: ${data.text}`);
        }
    });

    c.on('close', function() {
        console.log('PeerJS Data: Conexão de dados encerrada pelo amigo.');
        setPeerStatus(false);
        conn = null;
        alert('A conexão com o amigo foi encerrada.');
    });
}

function disconnectPeer() {
    console.log('Iniciando disconnectPeer...');
    if (conn && conn.open) {
        console.log('Fechando conexão de dados com o amigo...');
        conn.close();
        conn = null;
    }
    if (peer && !peer.destroyed) {
        console.log('Destruindo Peer local...');
        peer.destroy();
        peer = null;
    }
    setPeerStatus(false);
    isHost = false;
    if (peerIdLabel) peerIdLabel.textContent = 'ID: Desconectado';
    if (myPeerIdDisplay) myPeerIdDisplay.value = '';
    alert('Desconectado com sucesso.');
    initializePeer(); // Re-inicializa Peer para obter um novo ID para novas conexões
    playClickSound();
}

// --- Funções de Controle de Vídeo e Sincronização ---

function carregarVideoLocal() {
    if (!videoInput || !videoPlayer) {
        console.error("Elementos de vídeo local não encontrados.");
        alert("Erro interno: Componentes de vídeo local não disponíveis.");
        return;
    }
    const file = videoInput.files[0];
    if (file) {
        const url = URL.createObjectURL(file);
        videoPlayer.src = url;
        videoPlayer.load();
        videoPlayer.play().then(() => {
            if (playBtnSidebar) playBtnSidebar.textContent = '⏸️';
            isHost = true; // Quem carrega o vídeo local é o "host" dessa sessão

            alert('AVISO: Vídeo local carregado. Não pode ser transmitido ao seu amigo diretamente. Use "Carregar & Transmitir URL" com vídeos online (MP4 diretos) para sincronia completa.');
            if (conn && conn.open) {
                console.log("Comandos de sincronia enviados (Play), mas vídeo local não pode ser transmitido.");
                // Opcionalmente, informa o amigo que um vídeo local foi carregado e não pode ser compartilhado
                conn.send({ type: 'message', text: 'O host carregou um vídeo local que não pode ser compartilhado diretamente para reprodução sincronizada.' });
            } else {
                console.log("Vídeo local carregado. Não conectado para sincronizar comandos.");
            }
            playClickSound();
        }).catch(e => {
            console.error("Erro ao tentar reproduzir vídeo local:", e);
            alert(`Não foi possível reproduzir o vídeo local. Erro: ${e.message}.`);
        });
    } else {
        alert('Por favor, selecione um arquivo de vídeo local.');
    }
}

function carregarVideoUrl() {
    if (!videoUrlInput || !videoPlayer) {
        console.error("Elementos de URL de vídeo não encontrados.");
        alert("Erro interno: Componentes de URL de vídeo não disponíveis.");
        return;
    }
    const url = videoUrlInput.value.trim();
    if (url) {
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
            alert('Por favor, insira uma URL válida que comece com "http://" ou "https://".');
            return;
        }

        // Validação adicional para URLs de plataformas de streaming populares
        if (url.includes('youtube.com') || url.includes('youtu.be') || url.includes('vimeo.com') || url.includes('netflix.com') || url.includes('twitch.tv')) {
            alert('AVISO: URLs de plataformas como YouTube, Vimeo, Netflix, Twitch NÃO são suportadas diretamente com esta função. Elas requerem o uso de suas APIs de embed específicas. Por favor, use APENAS URLs diretas para arquivos de vídeo (ex: .mp4, .webm) e que permitam CORS.');
            console.warn('Tentativa de carregar URL de plataforma de streaming diretamente:', url);
            return;
        }

        videoPlayer.src = url;
        videoPlayer.load();
        videoPlayer.play().then(() => {
            if (playBtnSidebar) playBtnSidebar.textContent = '⏸️';
            isHost = true; // Quem carrega o vídeo online é o host

            if (conn && conn.open) {
                conn.send({ type: 'videoUrl', url: url });
                console.log('URL do vídeo transmitida ao amigo.');

                // A mensagem "Aguardando amigo carregar..." para dar feedback ao usuário host
                alert('URL do vídeo carregada e transmitida ao amigo para reprodução sincronizada! Aguardando amigo carregar e confirmar...');
                // O host aguardará o sinal 'videoLoaded' do cliente para enviar o play/seek inicial.
            } else {
                alert('URL do vídeo carregada. Conecte-se a um amigo para sincronizar.');
            }
            playClickSound();
        }).catch(e => {
            console.error("Erro ao tentar reproduzir URL de vídeo:", e);
            alert(`Não foi possível reproduzir a URL do vídeo. Erro: ${e.message}. Verifique se a URL é direta para um arquivo de vídeo (ex: .mp4, .webm) e se o servidor permite acesso de outros domínios (CORS).`);
        });
    } else {
        alert('Por favor, insira uma URL de vídeo válida.');
    }
}

function togglePlayPauseSync() {
    if (!videoPlayer) return;

    // Se é o host e está conectado, envia comandos de sincronia
    if (isHost && conn && conn.open) {
        if (videoPlayer.paused) {
            syncPlay();
        } else {
            syncPause();
        }
    } else { // Se não é host ou não está conectado, apenas controle localmente
        if (videoPlayer.paused) {
            videoPlayer.play();
        } else {
            videoPlayer.pause();
        }
        if (playBtnSidebar) playBtnSidebar.textContent = videoPlayer.paused ? '▶️' : '⏸️';
        console.log("Apenas controle local do vídeo (não host ou não conectado).");
    }
    playClickSound();
}

function syncPlay() {
    if (conn && conn.open) {
        conn.send({ type: 'play' });
        // Incluir o tempo atual no comando de play para correção de sincronia
        conn.send({ type: 'seek', time: videoPlayer.currentTime });
        console.log("Comando 'play' enviado.");
    }
    if (videoPlayer) videoPlayer.play();
    if (playBtnSidebar) playBtnSidebar.textContent = '⏸️';
}

function syncPause() {
    if (conn && conn.open) {
        conn.send({ type: 'pause' });
        // Incluir o tempo atual no comando de pause para correção de sincronia
        conn.send({ type: 'seek', time: videoPlayer.currentTime });
        console.log("Comando 'pause' enviado.");
    }
    if (videoPlayer) videoPlayer.pause();
    if (playBtnSidebar) playBtnSidebar.textContent = '▶️';
}

function addCurrentTimeAsScene() {
    if (!videoPlayer || !sceneSelector) return;
    if (videoPlayer.src) {
        const currentTime = videoPlayer.currentTime;
        let sceneName = prompt("Nome para a cena atual (ex: 'Começo do Diálogo', 'Cena Engraçada'):");
        if (sceneName) {
            sceneName = sceneName.trim() || `Cena ${scenes.length + 1}`;
            scenes.push({ name: sceneName, time: currentTime });
            updateSceneSelector();
            localStorage.setItem('cinemaScenes', JSON.stringify(scenes));
            alert(`Cena "${sceneName}" salva em ${formatTime(currentTime)}.`);
        }
    } else {
        alert('Por favor, carregue um vídeo primeiro.');
    }
    playClickSound();
}

function updateSceneSelector() {
    if (!sceneSelector) return;
    sceneSelector.innerHTML = '<option value="">Selecionar Cena</option>';
    scenes.forEach((scene, index) => {
        const option = document.createElement('option');
        option.value = index;
        option.textContent = `${scene.name} (${formatTime(scene.time)})`;
        sceneSelector.appendChild(option);
    });
}

function jumpToScene() {
    if (!sceneSelector || !videoPlayer) return;
    const selectedIndex = sceneSelector.value;
    if (selectedIndex !== "" && scenes[selectedIndex]) {
        const scene = scenes[selectedIndex];
        videoPlayer.currentTime = scene.time;
        if (conn && conn.open && isHost) {
            conn.send({ type: 'seek', time: scene.time });
            conn.send({ type: 'play' }); // Envia play após seek para garantir que a reprodução comece
            console.log(`Comando 'seek' e 'play' enviado para ${formatTime(scene.time)}.`);
        }
        videoPlayer.play();
        if (playBtnSidebar) playBtnSidebar.textContent = '⏸️';
    }
    playClickSound();
}

function addMovieToLibrary() {
    const movieName = prompt("Nome do filme (Ex: 'Filme A', 'Série B Ep. C'):");
    if (!movieName) {
        alert("Nome do filme é obrigatório.");
        return;
    }

    const videoSourceChoice = prompt("Você quer adicionar um arquivo local ou uma URL?\nDigite 'local' para arquivo ou 'url' para URL:");

    if (videoSourceChoice && videoSourceChoice.toLowerCase() === 'local') {
        const fileInputForMovie = document.createElement('input');
        fileInputForMovie.type = 'file';
        fileInputForMovie.accept = 'video/*';
        fileInputForMovie.style.display = 'none';
        document.body.appendChild(fileInputForMovie);

        fileInputForMovie.addEventListener('change', () => {
            const file = fileInputForMovie.files[0];
            if (file) {
                movieLibrary.push({ name: movieName, type: 'local', fileName: file.name });
                localStorage.setItem('cinemaMovieLibrary', JSON.stringify(movieLibrary));
                updateMovieLibraryDisplay();
                alert(`"${movieName}" (Local) adicionado à sua biblioteca. Você precisará selecionar o arquivo novamente ao carregar.`);
            } else {
                alert("Nenhum arquivo de vídeo selecionado.");
            }
            document.body.removeChild(fileInputForMovie);
        });
        fileInputForMovie.click();
    } else if (videoSourceChoice && videoSourceChoice.toLowerCase() === 'url') {
        const url = prompt("Cole a URL do vídeo (Ex: https://exemplo.com/video.mp4):");
        if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
            // Validação básica para URLs de vídeo diretas
            if (url.includes('youtube.com') || url.includes('youtu.be') || url.includes('vimeo.com') || url.includes('netflix.com') || url.includes('twitch.tv')) {
                alert('AVISO: URLs de plataformas como YouTube, Vimeo, Netflix, Twitch NÃO são suportadas diretamente. Apenas URLs diretas para arquivos de vídeo (ex: .mp4, .webm) são suportadas para sincronização.');
                return;
            }
            movieLibrary.push({ name: movieName, url: url, type: 'url' });
            localStorage.setItem('cinemaMovieLibrary', JSON.stringify(movieLibrary));
            updateMovieLibraryDisplay();
            alert(`"${movieName}" (URL) adicionado à sua biblioteca.`);
        } else {
            alert("URL inválida ou não fornecida. Certifique-se de que começa com 'http://' ou 'https://' e é uma URL direta para o arquivo de vídeo.");
        }
    } else {
        alert("Opção inválida. Por favor, digite 'local' ou 'url'.");
    }
    playClickSound();
}

function updateMovieLibraryDisplay() {
    const movieLibraryDiv = document.getElementById('movieLibrary');
    if (!movieLibraryDiv) return;

    movieLibraryDiv.innerHTML = '';

    if (movieLibrary.length === 0) {
        movieLibraryDiv.innerHTML = '<p>Nenhum filme adicionado ainda.</p>';
    } else {
        movieLibrary.forEach((movie, index) => {
            const movieItem = document.createElement('div');
            movieItem.style.display = 'flex';
            movieItem.style.justifyContent = 'space-between';
            movieItem.style.alignItems = 'center';
            movieItem.style.padding = '8px';
            movieItem.style.cursor = 'pointer';
            movieItem.style.borderBottom = '1px solid rgba(255,255,255,0.1)';

            const textSpan = document.createElement('span');
            textSpan.textContent = `- ${movie.name} (${movie.type === 'local' ? 'Local' + (movie.fileName ? ` (${movie.fileName})` : '') : 'Online'})`;
            textSpan.style.flexGrow = '1';
            textSpan.style.marginRight = '10px';

            const actionsDiv = document.createElement('div');
            actionsDiv.style.display = 'flex';
            actionsDiv.style.alignItems = 'center';

            const loadBtn = document.createElement('button');
            loadBtn.textContent = '▶️ Carregar';
            loadBtn.style.cssText = `
                background: linear-gradient(to right, #7f00ff, #a333ff);
                color: white;
                border: none;
                border-radius: 15px;
                padding: 5px 10px;
                font-size: 0.8em;
                cursor: pointer;
                transition: background 0.2s;
            `;
            loadBtn.onmouseover = () => loadBtn.style.background = 'linear-gradient(to right, #a333ff, #7f00ff)';
            loadBtn.onmouseout = () => loadBtn.style.background = 'linear-gradient(to right, #7f00ff, #a333ff)';

            loadBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (movie.type === 'local') {
                    alert(`Para carregar "${movie.name}" (Local), por favor, selecione o arquivo novamente através do botão "Carregar Vídeo Local" no menu principal. A biblioteca apenas registra o nome.`);
                    toggleMenu();
                } else { // type === 'url'
                    if (videoUrlInput) videoUrlInput.value = movie.url;
                    carregarVideoUrl();
                }
                playClickSound();
            });

            const deleteBtn = document.createElement('button');
            deleteBtn.textContent = '✖';
            deleteBtn.style.cssText = `
                background: #e74c3c;
                color: white;
                border: none;
                border-radius: 50%;
                width: 25px;
                height: 25px;
                font-size: 0.8em;
                cursor: pointer;
                margin-left: 5px;
                transition: background 0.2s;
                display: flex;
                align-items: center;
                justify-content: center;
            `;
            deleteBtn.onmouseover = () => deleteBtn.style.background = '#c0392b';
            deleteBtn.onmouseout = () => deleteBtn.style.background = '#e74c3c';

            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (confirm(`Tem certeza que deseja remover "${movie.name}" da biblioteca?`)) {
                    movieLibrary.splice(index, 1);
                    localStorage.setItem('cinemaMovieLibrary', JSON.stringify(movieLibrary));
                    updateMovieLibraryDisplay();
                    playClickSound();
                }
            });

            actionsDiv.appendChild(loadBtn);
            actionsDiv.appendChild(deleteBtn);
            movieItem.appendChild(textSpan);
            movieItem.appendChild(actionsDiv);
            movieLibraryDiv.appendChild(movieItem);
        });
    }
}

// --- Event Listeners ---

document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM Content Loaded. Initializing PeerJS and UI components.');
    initializePeer();
    updateMovieLibraryDisplay();
    updateSceneSelector();

    // Adiciona listener para colar URL e tentar carregar automaticamente
    if (videoUrlInput && loadStreamUrlBtn) {
        videoUrlInput.addEventListener('paste', (event) => {
            setTimeout(() => {
                if (videoUrlInput.value.trim() !== '') {
                    loadStreamUrlBtn.click();
                }
            }, 100);
        });
    }

    // Adiciona listeners de forma mais robusta, verificando se o elemento existe
    if (shareBtn) shareBtn.addEventListener('click', toggleSharePopup);

    if (connectFriendBtn && friendIdInput) {
        connectFriendBtn.addEventListener('click', () => {
            playClickSound();
            const friendId = friendIdInput.value.trim();
            if (!peer || !peer.open) {
                alert('O PeerJS não está pronto. Por favor, aguarde alguns segundos ou use "Tentar Novamente".');
                return;
            }
            if (!friendId) {
                alert('Por favor, insira o ID do amigo.');
                return;
            }
            if (conn && conn.open) {
                alert("Você já está conectado a um amigo. Desconecte primeiro para conectar a outro.");
                return;
            }

            console.log(`Tentando conectar ao amigo ID: ${friendId}`);
            conn = peer.connect(friendId);
            conn.on('open', function() {
                console.log('Conexão estabelecida com: ' + friendId);
                isHost = false; // Quem inicia a conexão se torna o cliente
                handlePeerConnection(conn);
                setPeerStatus(true);
                alert(`Conectado com sucesso ao amigo ID: ${friendId}`);
                // Assim que conectado, o cliente solicita a URL do vídeo ao host
                conn.send({ type: 'requestVideoUrl' });
            });
            conn.on('error', function(err) {
                console.error('Erro ao conectar ao amigo:', err);
                setPeerStatus(false);
                alert('Não foi possível conectar ao amigo: ' + err.message + "\nVerifique o ID ou a conexão.");
            });
        });
    }
    if (disconnectBtn) disconnectBtn.addEventListener('click', disconnectPeer);
    if (retryConnectBtn) {
        retryConnectBtn.addEventListener('click', () => {
            playClickSound();
            disconnectPeer(); // Isso também chamará initializePeer()
            alert('Reiniciando PeerJS e gerando novo ID...');
        });
    }

    if (loadStreamVideoBtn) loadStreamVideoBtn.addEventListener('click', carregarVideoLocal);
    if (loadStreamUrlBtn) loadStreamUrlBtn.addEventListener('click', carregarVideoUrl);

    if (addCurrentTimeAsSceneBtn) addCurrentTimeAsSceneBtn.addEventListener('click', addCurrentTimeAsScene);
    if (sceneSelector) sceneSelector.addEventListener('change', jumpToScene);
    if (addMovieToLibraryBtn) addMovieToLibraryBtn.addEventListener('click', addMovieToLibrary);

    // Adiciona listeners para os botões de emoji
    emojiButtons.forEach(button => {
        if (button) button.addEventListener('click', handleEmojiButtonClick);
    });

    if (playBtnSidebar) playBtnSidebar.addEventListener('click', togglePlayPauseSync);

    if (videoPlayer) {
        // Evento 'timeupdate' para sincronização periódica (apenas o host envia)
        videoPlayer.addEventListener('timeupdate', () => {
            if (isHost && conn && conn.open && !videoPlayer.paused) {
                // Envia comando 'seek' a cada 2 segundos para garantir sincronia
                // Usa Math.floor para trabalhar com segundos inteiros e evitar múltiplos envios na mesma fração de segundo
                const currentSecond = Math.floor(videoPlayer.currentTime);
                if (currentSecond % 2 === 0 && currentSecond !== lastSentTime) {
                    conn.send({ type: 'seek', time: videoPlayer.currentTime });
                    lastSentTime = currentSecond; // Atualiza o último tempo enviado
                    console.log(`Host enviando seek periódico: ${formatTime(videoPlayer.currentTime)}`);
                }
            }
        });

        // Atualiza o texto do botão de play/pause localmente
        videoPlayer.addEventListener('play', () => {
            if (playBtnSidebar) playBtnSidebar.textContent = '⏸️';
        });

        videoPlayer.addEventListener('pause', () => {
            if (playBtnSidebar) playBtnSidebar.textContent = '▶️';
        });

        // Resetar o botão quando o vídeo terminar
        videoPlayer.addEventListener('ended', () => {
            if (playBtnSidebar) playBtnSidebar.textContent = '▶️';
            // Opcionalmente, o host pode enviar um comando 'ended' para o amigo para resetar
            // No entanto, o `seek` para o tempo 0 ou um `pause` já seria suficiente.
            // Se precisar de um estado de "vídeo terminado" para o amigo, adicione um `data.type === 'ended'`
            // e sua respectiva lógica em `handlePeerConnection`.
        });
    }
});
