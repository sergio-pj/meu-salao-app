document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('cadastro-form');
    const mensagemDiv = document.getElementById('mensagem-cadastro');

    form.addEventListener('submit', async (event) => {
        // Impede o comportamento padrão do formulário (que é recarregar a página)
        event.preventDefault();

        // Limpa mensagens anteriores
        mensagemDiv.textContent = '';
        mensagemDiv.className = '';

        // Pega os valores dos campos do formulário
        const nomeSalao = document.getElementById('nome-salao').value;
        const email = document.getElementById('email-cadastro').value;
        const senha = document.getElementById('senha-cadastro').value;
        const confirmarSenha = document.getElementById('confirmar-senha').value;

        // Validação simples no lado do cliente
        if (senha !== confirmarSenha) {
            mensagemDiv.textContent = 'As senhas não coincidem!';
            mensagemDiv.classList.add('erro');
            return;
        }

        try {
            // Envia os dados para o nosso endpoint da API no backend
            const response = await fetch('/api/cadastro', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    nomeSalao: nomeSalao,
                    email: email,
                    senha: senha
                }),
            });

            // Converte a resposta do servidor para JSON
            const data = await response.json();

            if (response.ok) {
                // Se a resposta for bem-sucedida (status 2xx)
                mensagemDiv.textContent = data.message;
                mensagemDiv.classList.add('sucesso');
                form.reset(); // Limpa o formulário
            } else {
                // Se houver um erro (status 4xx ou 5xx)
                mensagemDiv.textContent = data.message || 'Ocorreu um erro no cadastro.';
                mensagemDiv.classList.add('erro');
            }
        } catch (error) {
            // Se houver um erro de rede ou algo que impeça a comunicação
            console.error('Erro ao cadastrar:', error);
            mensagemDiv.textContent = 'Não foi possível conectar ao servidor. Tente novamente mais tarde.';
            mensagemDiv.classList.add('erro');
        }
    });
});
