let peer = null;
let conn = null;
let isHost = false; // Indica se você é o "host" da sessão (quem carregou o vídeo ou se conectou primeiro e enviou)

// Elementos do DOM
const videoPlayer = document.getElementById('videoPlayer');
const friendIdInput = document.getElementById('friendId');
const peerIdLabel = document.querySelector('.id-label');
const statusText = document.getElementById('statusText');
const peerStatusDiv = document.getElementById('peerStatus');
const mainMenu = document.getElementById('mainMenu');
const shareIdPopup = document.getElementById('shareIdPopup');
const myPeerIdDisplay = document.getElementById('myPeerIdDisplay');

// Botões
const shareBtn = document.querySelector('.share-btn');
const connectFriendBtn = document.getElementById('connectFriendBtn');
const retryConnectBtn = document.getElementById('retryConnectBtn');
const videoInput = document.getElementById('videoInput');
const loadStreamVideoBtn = document.getElementById('loadStreamVideoBtn');
const syncPlayBtn = document.getElementById('syncPlayBtn');
const syncPauseBtn = document.getElementById('syncPauseBtn');
const addMovieToLibraryBtn = document.getElementById('addMovieToLibraryBtn');
const sceneSelector = document.getElementById('sceneSelector');
const addCurrentTimeAsSceneBtn = document.getElementById('addCurrentTimeAsSceneBtn');
const playBtnSidebar = document.getElementById('playBtn'); // Botão de play na sidebar

// Sons de clique (mesmos da intro, ajuste os caminhos se forem locais)
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

// Toca um som de clique aleatório
function playClickSound() {
    const randomSound = clickSounds[Math.floor(Math.random() * clickSounds.length)];
    randomSound.currentTime = 0;
    randomSound.play().catch(e => console.log('Erro ao tocar som de clique:', e));
}

// Alterna a visibilidade do menu principal
function toggleMenu() {
    mainMenu.classList.toggle('show');
    playClickSound(); // Adiciona som ao abrir/fechar menu
}

// Alterna a visibilidade do pop-up de compartilhamento de ID
function toggleSharePopup() {
    shareIdPopup.classList.toggle('show');
    if (shareIdPopup.classList.contains('show') && peer) {
        myPeerIdDisplay.value = peer.id; // Exibe o ID quando o pop-up abre
    }
    playClickSound();
}

// Copia o ID para a área de transferência
function copyMyPeerId() {
    myPeerIdDisplay.select();
    document.execCommand('copy');
    alert('ID copiado para a área de transferência!');
    playClickSound();
}

// Atualiza o status de conexão visualmente
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

// Formata o tempo (segundos para MM:SS)
function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
}

// --- Funções PeerJS ---

// Inicializa o PeerJS
function initializePeer() {
    peer = new Peer({
        host: '0.peerjs.com',
        port: 443,
        path: '/'
    });

    peer.on('open', function(id) {
        console.log('Meu ID Peer é: ' + id);
        peerIdLabel.textContent = `ID: ${id}`;
        myPeerIdDisplay.value = id; // Define o ID no campo do pop-up também
        setPeerStatus(false); // Inicia como OFF (ainda não conectado a ninguém)
    });

    peer.on('connection', function(newConn) {
        conn = newConn;
        console.log('Conexão recebida de: ' + conn.peer);
        isHost = true; // Você se torna o host se alguém se conecta a você
        handlePeerConnection(conn);
        setPeerStatus(true); // Conectado
        alert(`Conectado com sucesso ao amigo ID: ${conn.peer}`);
    });

    peer.on('disconnected', function() {
        console.log('Peer desconectado.');
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

// Lida com a conexão de dados (receber mensagens)
function handlePeerConnection(c) {
    c.on('data', function(data) {
        console.log('Dados recebidos:', data);
        if (data.type === 'play') {
            videoPlayer.play();
        } else if (data.type === 'pause') {
            videoPlayer.pause();
        } else if (data.type === 'seek') {
            // Ajusta o tempo apenas se a diferença for significativa para evitar loops
            if (Math.abs(videoPlayer.currentTime - data.time) > 2) {
                videoPlayer.currentTime = data.time;
                // videoPlayer.play(); // Opcional: tocar após o seek
            }
        } else if (data.type === 'videoUrl' && !isHost) {
            // Cliente recebe URL do vídeo e carrega
            videoPlayer.src = data.url;
            videoPlayer.load();
            videoPlayer.play(); // Inicia o vídeo no cliente após carregar
            alert('Vídeo recebido e carregado.');
        } else if (data.type === 'requestVideoUrl' && isHost) {
            // Se o cliente pedir a URL e você é o host, envie
            if (videoPlayer.src) {
                c.send({ type: 'videoUrl', url: videoPlayer.src });
            }
        }
    });

    c.on('close', function() {
        console.log('Conexão encerrada.');
        setPeerStatus(false);
        conn = null;
        isHost = false;
        alert('A conexão com o amigo foi encerrada.');
    });
}

// --- Funções de Controle de Vídeo e Sincronização ---

// Carrega e, se host, transmite o vídeo
function carregarVideo() {
    const file = videoInput.files[0];
    if (file) {
        const url = URL.createObjectURL(file);
        videoPlayer.src = url;
        videoPlayer.load();
        videoPlayer.play();
        isHost = true; // Quem carrega o vídeo se torna o host

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

// Sincroniza o comando de Play
function syncPlay() {
    if (conn) {
        conn.send({ type: 'play' });
    }
    videoPlayer.play();
    playClickSound();
}

// Sincroniza o comando de Pausar
function syncPause() {
    if (conn) {
        conn.send({ type: 'pause' });
    }
    videoPlayer.pause();
    playClickSound();
}

// Salva o tempo atual do vídeo como uma cena
function addCurrentTimeAsScene() {
    if (videoPlayer.src) {
        const currentTime = videoPlayer.currentTime;
        let sceneName = prompt("Nome para a cena atual (ex: 'Começo do Diálogo', 'Cena Engraçada'):");
        if (sceneName) {
            sceneName = sceneName.trim() || `Cena ${scenes.length + 1}`; // Garante um nome
            scenes.push({ name: sceneName, time: currentTime });
            updateSceneSelector();
            alert(`Cena "${sceneName}" salva em ${formatTime(currentTime)}.`);
        }
    } else {
        alert('Por favor, carregue um vídeo primeiro.');
    }
    playClickSound();
}

// Atualiza o dropdown de cenas
function updateSceneSelector() {
    sceneSelector.innerHTML = '<option value="">Selecionar Cena</option>';
    scenes.forEach((scene, index) => {
        const option = document.createElement('option');
        option.value = index;
        option.textContent = `${scene.name} (${formatTime(scene.time)})`;
        sceneSelector.appendChild(option);
    });
}

// Pula para a cena selecionada
function jumpToScene() {
    const selectedIndex = sceneSelector.value;
    if (selectedIndex !== "" && scenes[selectedIndex]) {
        const scene = scenes[selectedIndex];
        videoPlayer.currentTime = scene.time;
        if (conn && isHost) { // Apenas o host envia o seek
            conn.send({ type: 'seek', time: scene.time });
            conn.send({ type: 'play' }); // Garante que o cliente também toque
        }
        videoPlayer.play();
    }
    playClickSound();
}

// Adiciona um filme à "biblioteca" (exemplo simplificado, sem persistência)
function addMovieToLibrary() {
    const movieName = prompt("Nome do filme (ex: 'Filme X', 'Série Y Ep. Z'):");
    if (movieName) {
        const fileInputForMovie = document.createElement('input');
        fileInputForMovie.type = 'file';
        fileInputForMovie.accept = 'video/*';
        fileInputForMovie.style.display = 'none';
        document.body.appendChild(fileInputForMovie); // Temporariamente adiciona ao DOM

        fileInputForMovie.onchange = () => {
            const file = fileInputForMovie.files[0];
            if (file) {
                const url = URL.createObjectURL(file);
                movieLibrary.push({ name: movieName, url: url });
                updateMovieLibraryDisplay();
                alert(`"${movieName}" adicionado à sua biblioteca local.`);
            }
            document.body.removeChild(fileInputForMovie); // Remove após o uso
        };
        fileInputForMovie.click(); // Abre o seletor de arquivos
    }
    playClickSound();
}

// Atualiza a exibição da biblioteca de filmes
function updateMovieLibraryDisplay() {
    const movieLibraryDiv = document.getElementById('movieLibrary');
    movieLibraryDiv.innerHTML = ''; // Limpa o conteúdo existente

    if (movieLibrary.length === 0) {
        movieLibraryDiv.innerHTML = '<p>Nenhum filme adicionado ainda.</p>';
    } else {
        movieLibrary.forEach(movie => {
            const movieItem = document.createElement('div');
            movieItem.textContent = `- ${movie.name}`;
            movieItem.addEventListener('click', () => {
                // Carrega o filme selecionado da biblioteca
                videoPlayer.src = movie.url;
                videoPlayer.load();
                videoPlayer.play();
                isHost = true; // Quem carrega o filme se torna o host
                if (conn) {
                    conn.send({ type: 'videoUrl', url: movie.url });
                    alert(`Filme "${movie.name}" carregado e transmitido!`);
                } else {
                    alert(`Filme "${movie.name}" carregado. Conecte-se a um amigo para transmitir.`);
                }
                toggleMenu(); // Fecha o menu após selecionar
                playClickSound();
            });
            movieLibraryDiv.appendChild(movieItem);
        });
    }
}


// --- Event Listeners ---

document.addEventListener('DOMContentLoaded', () => {
    initializePeer();
    updateMovieLibraryDisplay(); // Inicializa a exibição da biblioteca
    updateSceneSelector(); // Inicializa o seletor de cenas
});

// Atribui funções aos botões
shareBtn.addEventListener('click', toggleSharePopup);
connectFriendBtn.addEventListener('click', () => {
    playClickSound();
    const friendId = friendIdInput.value;
    if (peer && friendId) {
        conn = peer.connect(friendId);
        conn.on('open', function() {
            console.log('Conexão estabelecida com: ' + friendId);
            isHost = false; // Você é o cliente nesta conexão
            handlePeerConnection(conn);
            setPeerStatus(true); // Conectado
            alert(`Conectado com sucesso ao amigo ID: ${friendId}`);
            // Solicitar URL do vídeo ao host imediatamente após a conexão
            conn.send({ type: 'requestVideoUrl' });
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
retryConnectBtn.addEventListener('click', () => {
    playClickSound();
    if (peer) {
        peer.destroy();
    }
    initializePeer();
    alert('Tentando reiniciar a conexão...');
});
loadStreamVideoBtn.addEventListener('click', carregarVideo);
syncPlayBtn.addEventListener('click', syncPlay);
syncPauseBtn.addEventListener('click', syncPause);
addCurrentTimeAsSceneBtn.addEventListener('click', addCurrentTimeAsScene);
sceneSelector.addEventListener('change', jumpToScene);
addMovieToLibraryBtn.addEventListener('click', addMovieToLibrary);

// Adiciona som de clique a todos os botões na side-bar e menu (exceto o close-btn, já tratado)
document.querySelectorAll('.side-bar button, .main-menu .btn, .share-popup .copy-btn').forEach(button => {
    // Evita adicionar o listener novamente se já tiver (ex: o toggleMenu já chama playClickSound)
    if (button.id !== 'connectFriendBtn' && button.id !== 'retryConnectBtn' && button.id !== 'loadStreamVideoBtn' &&
        button.id !== 'syncPlayBtn' && button.id !== 'syncPauseBtn' && button.id !== 'addCurrentTimeAsSceneBtn' &&
        button.id !== 'addMovieToLibraryBtn' && button.id !== 'playBtn' && button.className.indexOf('close-btn') === -1) {
        button.addEventListener('click', playClickSound);
    }
});

// Adiciona o som de clique para o botão de play da sidebar especificamente
playBtnSidebar.addEventListener('click', () => {
    syncPlay(); // Usa a função de sincronizar play para garantir que o lado do PeerJS seja acionado
});


// Sincronização de progresso do vídeo (apenas do host para o cliente)
videoPlayer.addEventListener('timeupdate', () => {
    // Envia o tempo atual para o cliente a cada ~2 segundos se for o host e estiver tocando
    if (isHost && conn && !videoPlayer.paused && Math.floor(videoPlayer.currentTime * 10) % 20 === 0) { // Envia a cada 2 segundos
        conn.send({ type: 'seek', time: videoPlayer.currentTime });
    }
});
