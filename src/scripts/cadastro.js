document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('cadastro-form');
    const mensagemDiv = document.getElementById('mensagem-cadastro');
    const supabase = window.supabaseClient;

    if (!supabase) {
        mensagemDiv.textContent = 'A conexao com a plataforma nao foi inicializada.';
        mensagemDiv.classList.add('erro');
        return;
    }

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
            mensagemDiv.textContent = 'As senhas informadas nao coincidem.';
            mensagemDiv.classList.add('erro');
            return;
        }

        if (senha.length < 6) {
            mensagemDiv.textContent = 'A senha precisa ter pelo menos 6 caracteres.';
            mensagemDiv.classList.add('erro');
            return;
        }

        try {
            const { data, error } = await supabase.auth.signUp({
                email,
                password: senha,
                options: {
                    data: {
                        nome_salao: nomeSalao,
                    },
                },
            });

            if (error) {
                mensagemDiv.textContent = error.message || 'Ocorreu um erro no cadastro.';
                mensagemDiv.classList.add('erro');
                return;
            }

            if (!data.user) {
                mensagemDiv.textContent = 'Usuário criado, mas não foi possível concluir a sessão.';
                mensagemDiv.classList.add('erro');
                return;
            }

            const { error: profileError } = await supabase
                .from('saloes')
                .upsert({
                    id: data.user.id,
                    nome_salao: nomeSalao,
                    email,
                });

            if (!profileError) {
                const { error: signOutError } = await supabase.auth.signOut();

                if (signOutError) {
                    console.error('Erro ao encerrar sessão após cadastro:', signOutError);
                }

                mensagemDiv.textContent = 'Cadastro concluido com sucesso. Faça o acesso para entrar no painel.';
                mensagemDiv.classList.add('sucesso');

                setTimeout(() => {
                    const destino = `../../index.html?cadastro=sucesso&email=${encodeURIComponent(email)}`;
                    window.location.replace(destino);
                }, 1000);
            } else {
                mensagemDiv.textContent = profileError.message || 'Cadastro criado, mas nao foi possivel salvar os dados do salao.';
                mensagemDiv.classList.add('erro');
            }
        } catch (error) {
            // Se houver um erro de rede ou algo que impeça a comunicação
            console.error('Erro ao cadastrar:', error);

            mensagemDiv.textContent = 'Nao foi possivel conectar a plataforma. Tente novamente em instantes.';
            mensagemDiv.classList.add('erro');
        }
    });
});
