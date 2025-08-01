document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('login-form');
    const mensagemDiv = document.getElementById('mensagem-login');

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        mensagemDiv.textContent = '';
        mensagemDiv.className = '';

        const email = document.getElementById('email-login').value;
        const senha = document.getElementById('senha-login').value;

        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email, senha }),
            });

            const data = await response.json();

            if (response.ok && data.token) {
                // Se a resposta for bem-sucedida E contiver um token...
                
                // ---- SALVANDO O TOKEN ----
                // Guardamos o token no localStorage do navegador.
                localStorage.setItem('token', data.token);
                // --------------------------

                mensagemDiv.textContent = 'Login bem-sucedido! Redirecionando...';
                mensagemDiv.classList.add('sucesso');

                setTimeout(() => {
                    window.location.href = 'src/pages/principal.html';
                }, 1000);

            } else {
                mensagemDiv.textContent = data.message || 'Ocorreu um erro no login.';
                mensagemDiv.classList.add('erro');
            }
        } catch (error) {
            console.error('Erro ao fazer login:', error);
            mensagemDiv.textContent = 'Não foi possível conectar ao servidor.';
            mensagemDiv.classList.add('erro');
        }
    });
});
