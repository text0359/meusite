// Adiciona um botão flutuante em todas as páginas, exceto na inicial
window.onload = () => {
    const isHomePage = window.location.pathname.includes('index.html') || window.location.pathname === '/';
    
    if (!isHomePage) {
        const backButton = document.createElement('button');
        backButton.textContent = 'Voltar para o Site Principal';
        backButton.className = 'back-button';
        backButton.onclick = () => {
            window.location.href = 'index.html'; // Caminho para a página principal
        };
        document.body.appendChild(backButton);
    }
};
