// Pega o token do localStorage
const token = localStorage.getItem('token');

// Verifica se o token NÃO existe
if (!token) {
    // Se não houver token, o usuário não está logado.
    // Redireciona imediatamente para a página de login.
    // Usamos window.location.replace para que o usuário não possa usar o botão "voltar" do navegador para acessar a página protegida.
    window.location.replace('../../index.html'); 
}
