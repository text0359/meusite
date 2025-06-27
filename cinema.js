let peer = null;
let conn = null;
let isHost = false;

// Elementos do DOM
const videoPlayer = document.getElementById('videoPlayer');
const friendIdInput = document.getElementById('friendId');
const peerIdLabel = document.querySelector('.id-label');
const statusText = document.getElementById('statusText');
const peerStatusDiv = document.getElementById('peerStatus');
const mainMenu = document.getElementById('mainMenu');
const shareIdPopup = document.getElementById('shareIdPopup');
const myPeerIdDisplay = document.getElementById('myPeerIdDisplay');
const emojiContainer = document.getElementById('emojiContainer');

// Botões
const shareBtn = document.querySelector('.share-btn');
const connectFriendBtn = document.getElementById('connectFriendBtn');
const disconnectBtn = document.getElementById('disconnectBtn'); // Novo botão de desconectar
const retryConnectBtn = document.getElementById('retryConnectBtn');
const videoInput = document.getElementById('videoInput');
const loadStreamVideoBtn = document.getElementById('loadStreamVideoBtn');
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

// Arrays para dados
const scenes = [];
const movieLibrary = [];

// --- Funções de UI/UX ---

function playClickSound() {
    const randomSound = clickSounds[Math.floor(Math.random() * clickSounds.length)];
    randomSound.currentTime = 0;
    randomSound.play().catch(e => console.warn('Erro ao tocar som de clique:', e));
}

function toggleMenu() {
    mainMenu.classList.toggle('show');
    playClickSound();
}

function toggleSharePopup() {
    shareIdPopup.classList.toggle('show');
    if (shareIdPopup.classList.contains('show') && peer) {
        myPeerIdDisplay.value = peer.id;
    }
    playClickSound();
}

function copyMyPeerId() {
    myPeerIdDisplay.select();
    document.execCommand('copy');
    alert('ID copiado para a área de transferência!');
    playClickSound();
}

function setPeerStatus(connected) {
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

function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
}

// Função para animar um emoji na tela do vídeo
function animateEmoji(emojiText) {
    const emojiEl = document.createElement('span');
    emojiEl.classList.add('animated-emoji');
    emojiEl.textContent = emojiText;

    // Posiciona o emoji na parte inferior da tela, aleatoriamente na largura
    emojiEl.style.left = `${Math.random() * 80 + 10}%`; // 10% a 90% da largura
    emojiEl.style.bottom = `-50px`; // Começa abaixo da tela

    emojiContainer.appendChild(emojiEl);

    // Remove o emoji após a animação
    emojiEl.addEventListener('animationend', () => {
        emojiEl.remove();
    });
}

// Lida com o clique nos botões de emoji (dispara a animação e envia via PeerJS)
function handleEmojiButtonClick(event) {
    const emoji = event.target.dataset.emoji;
    if (emoji) {
        // Anima localmente
        animateEmoji(emoji);
        // Envia para o peer
        if (conn) {
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
    peer = new Peer({
        host: '0.peerjs.com',
        port: 443,
        path: '/'
    });

    peer.on('open', function(id) {
        console.log('Meu ID Peer é: ' + id);
        peerIdLabel.textContent = `ID: ${id}`;
        myPeerIdDisplay.value = id;
        setPeerStatus(false); // Inicialmente desconectado de um amigo
    });

    peer.on('connection', function(newConn) {
        if (conn && conn.open) { // Se já houver uma conexão aberta, feche a nova
            newConn.close();
            console.warn("Já existe uma conexão ativa. Nova conexão rejeitada.");
            return;
        }
        conn = newConn;
        console.log('Conexão recebida de: ' + conn.peer);
        isHost = true; // Se alguém se conecta a você, você é o host
        handlePeerConnection(conn);
        setPeerStatus(true);
        alert(`Conectado com sucesso ao amigo ID: ${conn.peer}`);
    });

    peer.on('disconnected', function() {
        console.log('Peer desconectado do servidor PeerJS.');
        setPeerStatus(false);
        conn = null;
        isHost = false;
    });

    peer.on('close', function() { // Tratamento para quando o peer local é destruído
        console.log('Peer fechado (destruído).');
        setPeerStatus(false);
        conn = null;
        isHost = false;
    });

    peer.on('error', function(err) {
        console.error('Erro PeerJS:', err);
        setPeerStatus(false);
        alert('Erro na conexão PeerJS: ' + err.message);
    });
}

function handlePeerConnection(c) {
    c.on('data', function(data) {
        console.log('Dados recebidos:', data);
        if (data.type === 'play') {
            videoPlayer.play();
            playBtnSidebar.textContent = '⏸️'; // Atualiza ícone
        } else if (data.type === 'pause') {
            videoPlayer.pause();
            playBtnSidebar.textContent = '▶️'; // Atualiza ícone
        } else if (data.type === 'seek') {
            if (Math.abs(videoPlayer.currentTime - data.time) > 2) { // Evita micro-sincronizações constantes
                videoPlayer.currentTime = data.time;
            }
        } else if (data.type === 'videoUrl' && !isHost) {
            videoPlayer.src = data.url;
            videoPlayer.load();
            videoPlayer.play();
            playBtnSidebar.textContent = '⏸️'; // Assume que vai tocar
            alert('Vídeo recebido e carregado.');
        } else if (data.type === 'requestVideoUrl' && isHost) {
            if (videoPlayer.src) {
                c.send({ type: 'videoUrl', url: videoPlayer.src });
                console.log(`URL do vídeo '${videoPlayer.src}' enviado em resposta à solicitação.`);
            } else {
                console.log("Nenhum vídeo carregado para enviar a URL.");
            }
        } else if (data.type === 'emoji') {
            // Anima o emoji recebido
            animateEmoji(data.emoji);
        }
    });

    c.on('close', function() {
        console.log('Conexão de dados encerrada pelo amigo.');
        setPeerStatus(false);
        conn = null; // Garante que a variável de conexão seja zerada
        // isHost = false; // Não reseta isHost aqui, apenas se o peer inteiro desconectar
        alert('A conexão com o amigo foi encerrada.');
    });
}

function disconnectPeer() {
    if (conn) {
        console.log('Fechando conexão de dados...');
        conn.close(); // Fecha a conexão de dados
        conn = null;
    }
    if (peer) {
        console.log('Destruindo Peer...');
        peer.destroy(); // Destrói o Peer (libera o ID)
        peer = null;
    }
    setPeerStatus(false);
    isHost = false;
    peerIdLabel.textContent = 'ID: Aguardando...';
    myPeerIdDisplay.value = '';
    alert('Desconectado com sucesso.');
    initializePeer(); // Tenta inicializar um novo Peer ID para que o usuário possa se reconectar
    playClickSound();
}


// --- Funções de Controle de Vídeo e Sincronização ---

function carregarVideo() {
    const file = videoInput.files[0];
    if (file) {
        const url = URL.createObjectURL(file);
        videoPlayer.src = url;
        videoPlayer.load();
        videoPlayer.play();
        playBtnSidebar.textContent = '⏸️'; // Atualiza ícone
        isHost = true;

        if (conn) {
            conn.send({ type: 'videoUrl', url: url });
            alert('Vídeo carregado e transmitido ao amigo!');
        } else {
            alert('Vídeo carregado. Conecte-se a um amigo para transmitir.');
        }
        playClickSound();
    } else {
        alert('Por favor, selecione um arquivo de vídeo.');
    }
}

// Alterna play/pause e sincroniza
function togglePlayPauseSync() {
    if (videoPlayer.paused) {
        syncPlay();
    } else {
        syncPause();
    }
    playClickSound();
}

function syncPlay() {
    if (conn) {
        conn.send({ type: 'play' });
        console.log("Comando 'play' enviado.");
    }
    videoPlayer.play();
    playBtnSidebar.textContent = '⏸️'; // Atualiza ícone para pause
}

function syncPause() {
    if (conn) {
        conn.send({ type: 'pause' });
        console.log("Comando 'pause' enviado.");
    }
    videoPlayer.pause();
    playBtnSidebar.textContent = '▶️'; // Atualiza ícone para play
}

function addCurrentTimeAsScene() {
    if (videoPlayer.src) {
        const currentTime = videoPlayer.currentTime;
        let sceneName = prompt("Nome para a cena atual (ex: 'Começo do Diálogo', 'Cena Engraçada'):");
        if (sceneName) {
            sceneName = sceneName.trim() || `Cena ${scenes.length + 1}`;
            scenes.push({ name: sceneName, time: currentTime });
            updateSceneSelector();
            alert(`Cena "${sceneName}" salva em ${formatTime(currentTime)}.`);
        }
    } else {
        alert('Por favor, carregue um vídeo primeiro.');
    }
    playClickSound();
}

function updateSceneSelector() {
    sceneSelector.innerHTML = '<option value="">Selecionar Cena</option>';
    scenes.forEach((scene, index) => {
        const option = document.createElement('option');
        option.value = index;
        option.textContent = `${scene.name} (${formatTime(scene.time)})`;
        sceneSelector.appendChild(option);
    });
}

function jumpToScene() {
    const selectedIndex = sceneSelector.value;
    if (selectedIndex !== "" && scenes[selectedIndex]) {
        const scene = scenes[selectedIndex];
        videoPlayer.currentTime = scene.time;
        if (conn && isHost) { // Apenas o host sincroniza o seek
            conn.send({ type: 'seek', time: scene.time });
            conn.send({ type: 'play' }); // Assume que vai tocar após pular
            console.log(`Comando 'seek' e 'play' enviado para ${formatTime(scene.time)}.`);
        }
        videoPlayer.play();
        playBtnSidebar.textContent = '⏸️'; // Assume que vai tocar
    }
    playClickSound();
}

function addMovieToLibrary() {
    const movieName = prompt("Nome do filme (ex: 'Filme X', 'Série Y Ep. Z'):");
    if (!movieName) {
        alert("Nome do filme é obrigatório.");
        return;
    }

    const fileInputForMovie = document.createElement('input');
    fileInputForMovie.type = 'file';
    fileInputForMovie.accept = 'video/*';
    fileInputForMovie.style.display = 'none'; // Esconde o input de arquivo
    document.body.appendChild(fileInputForMovie); // Anexa ao DOM para que possa ser clicado

    // Adiciona um listener para quando um arquivo for selecionado
    fileInputForMovie.addEventListener('change', () => {
        const file = fileInputForMovie.files[0];
        if (file) {
            const url = URL.createObjectURL(file);
            movieLibrary.push({ name: movieName, url: url });
            updateMovieLibraryDisplay();
            alert(`"${movieName}" adicionado à sua biblioteca local.`);
        } else {
            alert("Nenhum arquivo de vídeo selecionado.");
        }
        document.body.removeChild(fileInputForMovie); // Remove o input após o uso
    });

    // Simula um clique no input de arquivo para abrir a janela de seleção
    fileInputForMovie.click();
    playClickSound();
}


function updateMovieLibraryDisplay() {
    const movieLibraryDiv = document.getElementById('movieLibrary');
    movieLibraryDiv.innerHTML = '';

    if (movieLibrary.length === 0) {
        movieLibraryDiv.innerHTML = '<p>Nenhum filme adicionado ainda.</p>';
    } else {
        movieLibrary.forEach(movie => {
            const movieItem = document.createElement('div');
            movieItem.textContent = `- ${movie.name}`;
            movieItem.addEventListener('click', () => {
                videoPlayer.src = movie.url;
                videoPlayer.load();
                videoPlayer.play();
                playBtnSidebar.textContent = '⏸️'; // Assume que vai tocar
                isHost = true; // Quem carrega o vídeo local se torna o host

                if (conn) {
                    conn.send({ type: 'videoUrl', url: movie.url });
                    alert(`Filme "${movie.name}" carregado e transmitido!`);
                } else {
                    alert(`Filme "${movie.name}" carregado. Conecte-se a um amigo para transmitir.`);
                }
                toggleMenu();
                playClickSound();
            });
            movieLibraryDiv.appendChild(movieItem);
        });
    }
}


// --- Event Listeners ---

document.addEventListener('DOMContentLoaded', () => {
    initializePeer();
    updateMovieLibraryDisplay();
    updateSceneSelector();
});

shareBtn.addEventListener('click', toggleSharePopup);
connectFriendBtn.addEventListener('click', () => {
    playClickSound();
    const friendId = friendIdInput.value;
    if (peer && friendId) {
        if (conn && conn.open) {
            alert("Você já está conectado a um amigo. Desconecte primeiro para conectar a outro.");
            return;
        }
        conn = peer.connect(friendId);
        conn.on('open', function() {
            console.log('Conexão estabelecida com: ' + friendId);
            isHost = false; // Você é o cliente nesta conexão
            handlePeerConnection(conn);
            setPeerStatus(true);
            alert(`Conectado com sucesso ao amigo ID: ${friendId}`);
            conn.send({ type: 'requestVideoUrl' }); // Solicita URL do vídeo ao host
        });
        conn.on('error', function(err) {
            console.error('Erro ao conectar ao amigo:', err);
            setPeerStatus(false);
            alert('Não foi possível conectar ao amigo: ' + err.message);
        });
    } else {
        alert('Por favor, insira o ID do amigo.');
    }
});
disconnectBtn.addEventListener('click', disconnectPeer); // Listener para o novo botão de desconectar
retryConnectBtn.addEventListener('click', () => {
    playClickSound();
    // Reutiliza a lógica de desconexão e inicialização
    disconnectPeer();
    alert('Tentando reiniciar a conexão...');
});
loadStreamVideoBtn.addEventListener('click', carregarVideo);

addCurrentTimeAsSceneBtn.addEventListener('click', addCurrentTimeAsScene);
sceneSelector.addEventListener('change', jumpToScene);
addMovieToLibraryBtn.addEventListener('click', addMovieToLibrary);

// Adiciona listener para os botões de emoji
emojiButtons.forEach(button => {
    button.addEventListener('click', handleEmojiButtonClick);
});

// Listener para o botão de play/pause da sidebar
playBtnSidebar.addEventListener('click', togglePlayPauseSync);

// Sincronização de progresso do vídeo (apenas do host para o cliente)
videoPlayer.addEventListener('timeupdate', () => {
    // Envia o tempo atual para o cliente a cada ~2 segundos se for o host e estiver tocando
    if (isHost && conn && !videoPlayer.paused && Math.floor(videoPlayer.currentTime * 10) % 20 === 0) {
        conn.send({ type: 'seek', time: videoPlayer.currentTime });
    }
});

// Adiciona listener para o evento 'play' e 'pause' do próprio player de vídeo
// para manter o ícone do botão da sidebar atualizado
videoPlayer.addEventListener('play', () => {
    playBtnSidebar.textContent = '⏸️';
});

videoPlayer.addEventListener('pause', () => {
    playBtnSidebar.textContent = '▶️';
});
