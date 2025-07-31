// Lista de usuários cadastrados (exemplo)
const usuarios = [
    { usuario: "sergio", senha: "admin" },
    { usuario: "guilherme", senha: "operador" }
];

// Função para validar login
document.getElementById('form-login').addEventListener('submit', function(e) {
    e.preventDefault();
    const usuario = document.getElementById('usuario').value;
    const senha = document.getElementById('senha').value;
    const usuarioValido = usuarios.find(u => u.usuario === usuario && u.senha === senha);

    const mensagem = document.getElementById('mensagem');
    if (usuarioValido) {
        mensagem.style.color = "green";
        mensagem.textContent = "Login realizado com sucesso!";
        setTimeout(() => {
            window.location.href = "principal.html";
        }, 1000);
    } else {
        mensagem.style.color = "red";
        mensagem.textContent = "Usuário ou senha inválidos!";
    }
});