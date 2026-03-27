(() => {
    const LOGIN_PAGE = '../../index.html';
    const supabaseClient = window.supabaseClient;
    const sessionStorageKey = window.supabaseSessionStorageKey;

    function redirectToLogin() {
        window.location.replace(LOGIN_PAGE);
    }

    function clearStoredSession() {
        if (!sessionStorageKey) {
            return;
        }

        window.localStorage.removeItem(sessionStorageKey);
        window.sessionStorage.removeItem(sessionStorageKey);
    }

    async function logoutAndRedirect() {
        try {
            if (supabaseClient) {
                const { error } = await supabaseClient.auth.signOut({ scope: 'local' });

                if (error) {
                    console.error('Erro ao encerrar sessão:', error);
                }
            }
        } catch (error) {
            console.error('Falha inesperada ao sair:', error);
        } finally {
            clearStoredSession();
            redirectToLogin();
        }
    }

    async function ensureAuthenticated() {
        if (!supabaseClient) {
            redirectToLogin();
            return;
        }

        const { data, error } = await supabaseClient.auth.getSession();

        if (error) {
            console.error('Erro ao verificar sessão:', error);
            clearStoredSession();
            redirectToLogin();
            return;
        }

        if (!data.session) {
            clearStoredSession();
            redirectToLogin();
        }
    }

    ensureAuthenticated();

    if (supabaseClient) {
        supabaseClient.auth.onAuthStateChange((event, session) => {
            if (event === 'SIGNED_OUT' || !session) {
                redirectToLogin();
            }
        });
    }

    window.handleLogout = function(event) {
        if (event) {
            event.preventDefault();
        }

        logoutAndRedirect();
        return false;
    };

    document.addEventListener('DOMContentLoaded', () => {
        const logoutLink = document.querySelector('[data-action="logout"]');

        if (!logoutLink) {
            return;
        }

        logoutLink.addEventListener('click', window.handleLogout);
    });
})();
