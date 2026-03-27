document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('login-form');
    const mensagemDiv = document.getElementById('mensagem-login');
    const emailInput = document.getElementById('email-login');
    const supabase = window.supabaseClient;
    const params = new URLSearchParams(window.location.search);

    const emailCadastro = params.get('email');
    const cadastroComSucesso = params.get('cadastro') === 'sucesso';

    if (!supabase) {
        mensagemDiv.textContent = 'A conexao com a plataforma nao foi inicializada.';
        mensagemDiv.classList.add('erro');
        return;
    }

    if (emailCadastro) {
        emailInput.value = emailCadastro;
    }

    if (cadastroComSucesso) {
        mensagemDiv.textContent = 'Cadastro concluido. Entre com o e-mail e a senha definidos para acessar o painel.';
        mensagemDiv.classList.add('sucesso');
        window.history.replaceState({}, document.title, window.location.pathname);
    }

    async function redirectIfAuthenticated() {
        const { data, error } = await supabase.auth.getSession();

        if (error) {
            console.error('Erro ao verificar sessão:', error);
            return;
        }

        if (data.session) {
            window.location.replace('src/pages/principal.html');
        }
    }

    redirectIfAuthenticated();

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        mensagemDiv.textContent = '';
        mensagemDiv.className = '';

        const email = document.getElementById('email-login').value;
        const senha = document.getElementById('senha-login').value;

        try {
            const { error } = await supabase.auth.signInWithPassword({
                email,
                password: senha,
            });

            if (!error) {
                mensagemDiv.textContent = 'Acesso confirmado. Redirecionando para o painel...';
                mensagemDiv.classList.add('sucesso');

                setTimeout(() => {
                    window.location.replace('src/pages/principal.html');
                }, 1000);
            } else {
                mensagemDiv.textContent = error.message || 'Nao foi possivel concluir o acesso.';
                mensagemDiv.classList.add('erro');
            }
        } catch (error) {
            console.error('Erro ao fazer login:', error);

            mensagemDiv.textContent = 'Nao foi possivel conectar a plataforma neste momento.';
            mensagemDiv.classList.add('erro');
        }
    });
});
