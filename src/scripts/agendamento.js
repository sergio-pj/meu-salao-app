(() => {
    const supabaseClient = window.supabaseClient;
    const tabelaValores = {
        corte: 40,
        manicure: 30,
        'trança': 60,
        luzes: 120,
    };

    const servicos = [
        { value: 'corte', label: 'Corte', preco: 40 },
        { value: 'manicure', label: 'Manicure', preco: 30 },
        { value: 'trança', label: 'Trança', preco: 60 },
        { value: 'luzes', label: 'Luzes', preco: 120 },
    ];

    const horariosBase = gerarHorariosAgenda('08:00', '23:00');
    const configuracaoPadrao = {
        salaoId: '',
        salaoEmail: '',
        salaoNome: '',
        whatsappNumber: '',
    };

    let configuracaoAtiva = { ...configuracaoPadrao };
    let horariosOcupados = new Set();

    document.addEventListener('DOMContentLoaded', async () => {
        const form = document.getElementById('booking-form');
        const inputData = document.getElementById('booking-date');

        popularServicos();
        definirDataMinima();

        if (!supabaseClient) {
            mostrarStatus('A conexão com o Supabase não foi inicializada.', 'erro');
            bloquearFormulario(true);
            return;
        }

        configuracaoAtiva = lerConfiguracao();

        try {
            const salao = await resolverSalao(configuracaoAtiva);

            if (!salao?.id) {
                bloquearFormulario(true);
                mostrarStatus('Configure o salão na URL para liberar o agendamento.', 'erro');
                return;
            }

            configuracaoAtiva = {
                ...configuracaoAtiva,
                salaoId: salao.id,
                salaoNome: salao.nome_salao || configuracaoAtiva.salaoNome || 'Salão configurado',
            };

            atualizarResumoSalao();
            inputData.addEventListener('change', () => carregarDisponibilidade());
            form.addEventListener('submit', handleSubmitBooking);

            if (inputData.value) {
                await carregarDisponibilidade();
            }
        } catch (error) {
            console.error('Erro ao preparar página de agendamento:', error);
            bloquearFormulario(true);
            mostrarStatus('Não foi possível carregar a agenda online agora.', 'erro');
        }
    });

    function gerarHorariosAgenda(inicio, fim) {
        const [horaInicial] = inicio.split(':').map(Number);
        const [horaFinal] = fim.split(':').map(Number);
        const horarios = [];

        for (let hora = horaInicial; hora <= horaFinal; hora += 1) {
            horarios.push(`${String(hora).padStart(2, '0')}:00`);
        }

        return horarios;
    }

    function lerConfiguracao() {
        const params = new URLSearchParams(window.location.search);

        return {
            salaoId: params.get('salao') || configuracaoPadrao.salaoId,
            salaoEmail: params.get('email') || configuracaoPadrao.salaoEmail,
            salaoNome: params.get('nome') || configuracaoPadrao.salaoNome,
            whatsappNumber: sanitizarWhatsapp(params.get('whatsapp') || configuracaoPadrao.whatsappNumber),
        };
    }

    async function resolverSalao(config) {
        if (config.salaoId) {
            return {
                id: config.salaoId,
                nome_salao: config.salaoNome,
            };
        }

        if (!config.salaoEmail) {
            return null;
        }

        const { data, error } = await supabaseClient
            .from('saloes')
            .select('id, nome_salao')
            .eq('email', config.salaoEmail)
            .single();

        if (error) {
            throw error;
        }

        return data;
    }

    function popularServicos() {
        const selectServico = document.getElementById('booking-service');

        if (!selectServico) {
            return;
        }

        selectServico.innerHTML = '<option value="">Selecione o serviço</option>';

        servicos.forEach((servico) => {
            const option = document.createElement('option');
            option.value = servico.value;
            option.textContent = `${servico.label} - R$ ${formatarValor(servico.preco)}`;
            selectServico.appendChild(option);
        });
    }

    function definirDataMinima() {
        const inputData = document.getElementById('booking-date');

        if (!inputData) {
            return;
        }

        const hoje = new Date().toISOString().slice(0, 10);
        inputData.min = hoje;
        inputData.value = hoje;
    }

    async function carregarDisponibilidade() {
        const inputData = document.getElementById('booking-date');
        const availability = document.getElementById('booking-availability');
        const data = inputData?.value;

        if (!data || !configuracaoAtiva.salaoId) {
            horariosOcupados = new Set();
            renderizarHorarios();
            if (availability) {
                availability.textContent = 'Escolha uma data para carregar os horários disponíveis.';
            }
            return;
        }

        availability.textContent = 'Consultando horários ocupados...';

        try {
            const { data: agendamentos, error } = await supabaseClient
                .from('agendamentos')
                .select('hora')
                .eq('salao_id', configuracaoAtiva.salaoId)
                .eq('data', data)
                .order('hora', { ascending: true });

            if (error) {
                throw error;
            }

            horariosOcupados = new Set((agendamentos || []).map((item) => normalizarHora(item.hora)));
            renderizarHorarios();

            const disponiveis = horariosBase.length - horariosOcupados.size;
            availability.textContent = disponiveis > 0
                ? `${disponiveis} horário(s) livre(s) em ${formatarDataBR(data)}.`
                : `Não há horários livres em ${formatarDataBR(data)}.`;
        } catch (error) {
            console.error('Erro ao consultar disponibilidade:', error);
            horariosOcupados = new Set();
            renderizarHorarios();
            availability.textContent = 'Não foi possível consultar a agenda agora.';
            mostrarStatus('Falha ao carregar os horários ocupados do salão.', 'erro');
        }
    }

    function renderizarHorarios() {
        const selectHorario = document.getElementById('booking-time');

        if (!selectHorario) {
            return;
        }

        selectHorario.innerHTML = '<option value="">Selecione um horário</option>';

        horariosBase.forEach((horario) => {
            const option = document.createElement('option');
            const ocupado = horariosOcupados.has(horario);

            option.value = horario;
            option.disabled = ocupado;
            option.textContent = ocupado ? `${horario} - ocupado` : horario;

            selectHorario.appendChild(option);
        });
    }

    async function handleSubmitBooking(event) {
        event.preventDefault();

        const nome = document.getElementById('booking-name').value.trim();
        const telefone = sanitizarWhatsapp(document.getElementById('booking-phone').value);
        const servico = document.getElementById('booking-service').value;
        const data = document.getElementById('booking-date').value;
        const hora = document.getElementById('booking-time').value;
        const submitButton = document.getElementById('booking-submit');

        if (!nome || !telefone || !servico || !data || !hora) {
            mostrarStatus('Preencha nome, telefone, serviço, data e horário.', 'erro');
            return;
        }

        if (telefone.length < 10) {
            mostrarStatus('Informe um telefone com DDD para seguir com o agendamento.', 'erro');
            return;
        }

        if (!configuracaoAtiva.salaoId) {
            mostrarStatus('A página ainda não está configurada para um salão.', 'erro');
            return;
        }

        submitButton.disabled = true;
        submitButton.textContent = 'Confirmando...';
        mostrarStatus('Validando disponibilidade final do horário...', 'sucesso');

        try {
            const horarioOcupado = await verificarHorarioOcupado(data, hora);

            if (horarioOcupado) {
                await carregarDisponibilidade();
                mostrarStatus('Esse horário acabou de ser reservado. Escolha outro.', 'erro');
                return;
            }

            const valor = tabelaValores[servico] || 0;
            const { error } = await supabaseClient
                .from('agendamentos')
                .insert({
                    salao_id: configuracaoAtiva.salaoId,
                    cliente_nome: nome,
                    servico,
                    data,
                    hora,
                    valor,
                });

            if (error) {
                throw error;
            }

            document.getElementById('booking-form').reset();
            definirDataMinima();
            await carregarDisponibilidade();
            mostrarStatus('Horário reservado com sucesso. Agora confirme no WhatsApp.', 'sucesso');
            renderizarConfirmacaoWhatsapp({ nome, telefone, servico, data, hora });
        } catch (error) {
            console.error('Erro ao criar agendamento externo:', error);
            mostrarStatus(error.message || 'Não foi possível concluir o agendamento.', 'erro');
        } finally {
            submitButton.disabled = false;
            submitButton.textContent = 'Confirmar agendamento';
        }
    }

    async function verificarHorarioOcupado(data, hora) {
        const { data: registro, error } = await supabaseClient
            .from('agendamentos')
            .select('id')
            .eq('salao_id', configuracaoAtiva.salaoId)
            .eq('data', data)
            .eq('hora', hora)
            .limit(1);

        if (error) {
            throw error;
        }

        return Array.isArray(registro) && registro.length > 0;
    }

    function renderizarConfirmacaoWhatsapp({ nome, telefone, servico, data, hora }) {
        const container = document.getElementById('booking-success');
        const numero = configuracaoAtiva.whatsappNumber;
        const servicoLabel = servicos.find((item) => item.value === servico)?.label || servico;
        const telefoneFormatado = formatarTelefoneBR(telefone);
        const mensagem = `Olá! Acabei de solicitar um agendamento.${'\n'}Cliente: ${nome}${'\n'}Telefone: ${telefoneFormatado}${'\n'}Serviço: ${servicoLabel}${'\n'}Data: ${formatarDataBR(data)}${'\n'}Hora: ${hora}`;
        const linkWhatsapp = numero ? `https://wa.me/${numero}?text=${encodeURIComponent(mensagem)}` : '';

        container.hidden = false;
        container.innerHTML = `
            <div class="booking-success-card">
                <strong>Agendamento enviado para a agenda</strong>
                <p>Para fechar a confirmação com o salão, use o botão abaixo.</p>
                <div class="booking-success-details">
                    <span><strong>Cliente:</strong> ${nome}</span>
                    <span><strong>Telefone:</strong> ${telefoneFormatado}</span>
                    <span><strong>Serviço:</strong> ${servicoLabel}</span>
                    <span><strong>Data:</strong> ${formatarDataBR(data)}</span>
                    <span><strong>Hora:</strong> ${hora}</span>
                </div>
                ${linkWhatsapp
                    ? `<a class="booking-whatsapp-link" href="${linkWhatsapp}" target="_blank" rel="noopener noreferrer">Confirmar no WhatsApp</a>`
                    : '<p class="booking-whatsapp-warning">Configure o número de WhatsApp na URL com ?whatsapp=5511999999999 para liberar a confirmação automática.</p>'}
            </div>
        `;
    }

    function atualizarResumoSalao() {
        const salonName = document.getElementById('booking-salon-name');
        const hint = document.getElementById('booking-config-hint');

        if (salonName) {
            salonName.textContent = configuracaoAtiva.salaoNome || 'Salão configurado para agenda pública';
        }

        if (hint) {
            hint.textContent = configuracaoAtiva.whatsappNumber
                ? 'Agenda pronta para salvar no Supabase e gerar confirmação por WhatsApp.'
                : 'Agenda pronta para salvar no Supabase. Se quiser o botão direto, adicione também ?whatsapp=5511999999999.';
        }
    }

    function bloquearFormulario(desabilitado) {
        document.querySelectorAll('#booking-form input, #booking-form select, #booking-form button').forEach((elemento) => {
            elemento.disabled = desabilitado;
        });
    }

    function mostrarStatus(mensagem, tipo) {
        const status = document.getElementById('booking-status');

        if (!status) {
            return;
        }

        status.textContent = mensagem;
        status.className = `booking-status-message ${tipo}`;
    }

    function normalizarHora(hora) {
        return String(hora).slice(0, 5);
    }

    function sanitizarWhatsapp(numero) {
        return String(numero || '').replace(/\D/g, '');
    }

    function formatarDataBR(dataIso) {
        return new Date(`${dataIso}T00:00:00`).toLocaleDateString('pt-BR');
    }

    function formatarValor(valor) {
        return Number(valor || 0).toFixed(2).replace('.', ',');
    }

    function formatarTelefoneBR(numero) {
        const digitos = sanitizarWhatsapp(numero);

        if (digitos.length === 11) {
            return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 7)}-${digitos.slice(7)}`;
        }

        if (digitos.length === 10) {
            return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 6)}-${digitos.slice(6)}`;
        }

        return numero;
    }
})();