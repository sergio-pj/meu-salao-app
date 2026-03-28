(() => {
const supabaseClient = window.supabaseClient;
const tabelaValores = {
    corte: 40,
    manicure: 30,
    'trança': 60,
    luzes: 120,
};
const nomesMeses = ['janeiro', 'fevereiro', 'marco', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const metodosPagamentoResumo = ['pix', 'dinheiro', 'debito', 'credito'];
const horariosAgenda = gerarHorariosAgenda('08:00', '23:00');

window.agendamentos = [];
window.pagamentos = [];
window.agendamentoEditando = null;
window.historicoMobileDiaAberto = null;

document.addEventListener('DOMContentLoaded', async () => {
    const form = document.getElementById('agendamento-form');
    const selectMetodoPagamento = document.getElementById('metodo-pagamento');
    const selectMes = document.getElementById('mes-historico');
    const selectModoHistorico = document.getElementById('modo-historico');
    const inputDiaHistorico = document.getElementById('dia-historico');
    const btnDiaAnterior = document.getElementById('historico-dia-anterior');
    const btnDiaProximo = document.getElementById('historico-dia-proximo');
    const btnHoje = document.getElementById('historico-hoje');
    const btnFecharSheetHistorico = document.getElementById('historico-dia-sheet-fechar');
    const selectMesFinanceiro = document.getElementById('mes-financeiro');
    const selectStatusFinanceiro = document.getElementById('status-financeiro');
    const selectMetodoFinanceiro = document.getElementById('metodo-financeiro');

    form.addEventListener('submit', handleSubmitAgendamento);
    selectMetodoPagamento.addEventListener('change', toggleCampoObservacaoFiado);
    selectMes.addEventListener('change', atualizarHistorico);
    selectModoHistorico.addEventListener('change', atualizarHistorico);
    inputDiaHistorico.addEventListener('change', atualizarHistorico);
    btnDiaAnterior.addEventListener('click', () => navegarDiaHistorico(-1));
    btnDiaProximo.addEventListener('click', () => navegarDiaHistorico(1));
    btnHoje.addEventListener('click', () => definirDiaHistorico(getHojeISO()));
    if (btnFecharSheetHistorico) {
        btnFecharSheetHistorico.addEventListener('click', fecharSheetHistoricoDia);
    }
    selectMesFinanceiro.addEventListener('change', atualizarFinanceiro);
    selectStatusFinanceiro.addEventListener('change', atualizarFinanceiro);
    selectMetodoFinanceiro.addEventListener('change', atualizarFinanceiro);
    window.addEventListener('resize', handleViewportChange);
    fecharSheetHistoricoDia();
    window.mostrarAba('agendamento');
    toggleCampoObservacaoFiado();

    if (!supabaseClient) {
        showMensagem('mensagem-agendamento', 'Supabase não foi inicializado.', 'erro');
        return;
    }

    await inicializarPagina();
});

// Função para agrupar agendamentos por semana
function getWeek(dateStr) {
    const date = new Date(dateStr);
    const firstDay = new Date(date.getFullYear(), 0, 1);
    const pastDaysOfYear = (date - firstDay) / 86400000;
    return Math.ceil((pastDaysOfYear + firstDay.getDay() + 1) / 7);
}

function getMesAno(dateStr) {
    const date = new Date(dateStr);
    return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2, '0')}`;
}

function getHojeISO() {
    return formatarDataParaISO(new Date());
}

function criarDataLocal(dataISO) {
    return new Date(`${dataISO}T00:00:00`);
}

function formatarDataParaISO(data) {
    const ano = data.getFullYear();
    const mes = String(data.getMonth() + 1).padStart(2, '0');
    const dia = String(data.getDate()).padStart(2, '0');
    return `${ano}-${mes}-${dia}`;
}

function adicionarDiasDataISO(dataISO, quantidadeDias) {
    const data = criarDataLocal(dataISO);
    data.setDate(data.getDate() + quantidadeDias);
    return formatarDataParaISO(data);
}

function adicionarMesDataISO(dataISO, quantidadeMeses) {
    const data = criarDataLocal(dataISO);
    const diaAtual = data.getDate();
    data.setDate(1);
    data.setMonth(data.getMonth() + quantidadeMeses);
    const ultimoDia = new Date(data.getFullYear(), data.getMonth() + 1, 0).getDate();
    data.setDate(Math.min(diaAtual, ultimoDia));
    return formatarDataParaISO(data);
}

function definirDiaHistorico(dataISO, options = {}) {
    const inputDia = document.getElementById('dia-historico');
    const shouldUpdate = options.atualizar !== false;

    if (!inputDia) {
        return;
    }

    inputDia.value = dataISO;

    if (shouldUpdate) {
        atualizarHistorico();
    }
}

function navegarDiaHistorico(direcao) {
    const inputDia = document.getElementById('dia-historico');
    const diaBase = inputDia?.value || getHojeISO();
    definirDiaHistorico(adicionarDiasDataISO(diaBase, direcao));
}

function gerarHorariosAgenda(inicio, fim) {
    const [horaInicial] = inicio.split(':').map(Number);
    const [horaFinal] = fim.split(':').map(Number);
    const horarios = [];

    for (let hora = horaInicial; hora <= horaFinal; hora += 1) {
        horarios.push(`${String(hora).padStart(2, '0')}:00`);
    }

    return horarios;
}

function isMobileViewport() {
    return window.matchMedia('(max-width: 640px)').matches;
}

function handleViewportChange() {
    if (!isMobileViewport()) {
        fecharSheetHistoricoDia();
    }

    atualizarResumoMobile();
    atualizarHistorico();
    atualizarFinanceiro();
}

async function inicializarPagina() {
    const session = await getSessionOrRedirect();

    if (!session) {
        return;
    }

    await carregarPerfil(session.user.id);
    await carregarDados(session.user.id);
}

async function getSessionOrRedirect() {
    const { data, error } = await supabaseClient.auth.getSession();

    if (error) {
        console.error('Erro ao buscar sessão:', error);
        window.location.replace('../../index.html');
        return null;
    }

    if (!data.session) {
        window.location.replace('../../index.html');
        return null;
    }

    return data.session;
}

async function carregarPerfil(salaoId) {
    const { data, error } = await supabaseClient
        .from('saloes')
        .select('nome_salao')
        .eq('id', salaoId)
        .single();

    if (error) {
        console.error('Erro ao carregar perfil do salão:', error);
        return;
    }

    const boasVindas = document.getElementById('boas-vindas-salao');

    if (boasVindas && data) {
        boasVindas.textContent = `Painel de atendimento de ${data.nome_salao}`;
    }
}

async function carregarDados(salaoId) {
    const [{ data: agendamentosData, error: agendamentosError }, { data: pagamentosData, error: pagamentosError }] = await Promise.all([
        supabaseClient
            .from('agendamentos')
            .select('id, cliente_nome, servico, data, hora, valor, created_at')
            .eq('salao_id', salaoId)
            .order('data', { ascending: false })
            .order('hora', { ascending: false }),
        supabaseClient
            .from('pagamentos')
            .select('id, agendamento_id, valor, status, metodo_pagamento, observacao, created_at')
            .eq('salao_id', salaoId)
            .order('created_at', { ascending: false }),
    ]);

    if (agendamentosError || pagamentosError) {
        console.error('Erro ao carregar dados:', agendamentosError || pagamentosError);
        showMensagem('mensagem-agendamento', buildLoadErrorMessage(agendamentosError || pagamentosError), 'erro');
        return;
    }

    window.agendamentos = (agendamentosData || []).map((item) => ({
        id: item.id,
        nome: item.cliente_nome,
        servico: item.servico,
        data: item.data,
        hora: item.hora,
        valor: Number(item.valor),
    }));

    window.pagamentos = (pagamentosData || []).map((item) => ({
        id: item.id,
        agendamentoId: item.agendamento_id,
        valor: Number(item.valor),
        status: item.status,
        metodoPagamento: item.metodo_pagamento || 'pix',
        observacao: item.observacao || '',
    }));

    atualizarFiltroMes();
    atualizarFiltroFinanceiro();
    atualizarResumoMobile();
    atualizarHistorico();
    atualizarFinanceiro();
}

function atualizarResumoMobile() {
    const container = document.getElementById('mobile-overview');

    if (!container) {
        return;
    }

    if (!isMobileViewport()) {
        container.hidden = true;
        container.innerHTML = '';
        return;
    }

    const hoje = new Date().toISOString().slice(0, 10);
    const atendimentosHoje = window.agendamentos.filter((agendamento) => agendamento.data === hoje);
    const pagamentosPendentes = window.pagamentos.filter((pagamento) => pagamento.status !== 'pago' && pagamento.metodoPagamento !== 'fiado');
    const fiadosAbertos = window.pagamentos.filter((pagamento) => pagamento.metodoPagamento === 'fiado' && pagamento.status !== 'pago');
    const valorHoje = atendimentosHoje.reduce((total, agendamento) => total + Number(agendamento.valor || 0), 0);
    const proximoAtendimento = atendimentosHoje
        .slice()
        .sort((a, b) => a.hora.localeCompare(b.hora))
        .find((agendamento) => agendamento.hora >= new Date().toTimeString().slice(0, 5));

    container.hidden = false;
    container.innerHTML = `
        <div class="mobile-overview-hero">
            <div>
                <span class="mobile-overview-kicker">Resumo rapido</span>
                <strong>${formatarDataBR(hoje)}</strong>
                <p>${proximoAtendimento ? `Proximo atendimento: ${proximoAtendimento.hora} com ${proximoAtendimento.nome}.` : 'Nenhum atendimento futuro cadastrado para hoje.'}</p>
            </div>
        </div>
        <div class="mobile-overview-grid">
            <article class="mobile-overview-card">
                <span>Atendimentos hoje</span>
                <strong>${atendimentosHoje.length}</strong>
                <small>Previsao de R$ ${formatarValor(valorHoje)}</small>
            </article>
            <article class="mobile-overview-card">
                <span>Recebimentos pendentes</span>
                <strong>${pagamentosPendentes.length}</strong>
                <small>Sem contar os fiados</small>
            </article>
            <article class="mobile-overview-card mobile-overview-card-warm">
                <span>Fiados em aberto</span>
                <strong>${fiadosAbertos.length}</strong>
                <small>Acompanhe no financeiro</small>
            </article>
        </div>
    `;
}

async function handleSubmitAgendamento(event) {
    event.preventDefault();

    const session = await getSessionOrRedirect();

    if (!session) {
        return;
    }

    const nome = document.getElementById('cliente-nome').value.trim();
    const servico = document.getElementById('servico').value;
    const data = document.getElementById('data').value;
    const hora = document.getElementById('hora').value;
    const metodoPagamento = document.getElementById('metodo-pagamento').value;
    const observacaoFiado = document.getElementById('observacao-fiado').value.trim();
    const valor = tabelaValores[servico] || 0;

    if (!nome || !servico || !data || !hora || !metodoPagamento) {
        showMensagem('mensagem-agendamento', 'Preencha todos os campos do agendamento.', 'erro');
        return;
    }

    if (metodoPagamento === 'fiado' && !observacaoFiado) {
        showMensagem('mensagem-agendamento', 'Informe a observação do fiado para salvar o atendimento.', 'erro');
        return;
    }

    try {
        if (window.agendamentoEditando) {
            const { error: agendamentoError } = await supabaseClient
                .from('agendamentos')
                .update({
                    cliente_nome: nome,
                    servico,
                    data,
                    hora,
                    valor,
                })
                .eq('id', window.agendamentoEditando.id);

            if (agendamentoError) {
                throw agendamentoError;
            }

            const { error: pagamentoError } = await supabaseClient
                .from('pagamentos')
                .update({
                    valor,
                    metodo_pagamento: metodoPagamento,
                    observacao: metodoPagamento === 'fiado' ? observacaoFiado : null,
                })
                .eq('agendamento_id', window.agendamentoEditando.id);

            if (pagamentoError) {
                throw enrichSchemaError(pagamentoError);
            }

            showMensagem('mensagem-agendamento', 'Agendamento atualizado com sucesso!', 'sucesso');
        } else {
            const { data: agendamentoCriado, error: insertError } = await supabaseClient
                .from('agendamentos')
                .insert({
                    salao_id: session.user.id,
                    cliente_nome: nome,
                    servico,
                    data,
                    hora,
                    valor,
                })
                .select('id')
                .single();

            if (insertError) {
                throw insertError;
            }

            const { error: pagamentoError } = await supabaseClient
                .from('pagamentos')
                .insert({
                    agendamento_id: agendamentoCriado.id,
                    salao_id: session.user.id,
                    valor,
                    metodo_pagamento: metodoPagamento,
                    observacao: metodoPagamento === 'fiado' ? observacaoFiado : null,
                    status: 'pendente',
                });

            if (pagamentoError) {
                throw enrichSchemaError(pagamentoError);
            }

            showMensagem('mensagem-agendamento', 'Horário agendado com sucesso!', 'sucesso');
        }

        window.agendamentoEditando = null;
        mostrarAlertaEdicao(null);
        document.getElementById('agendamento-form').reset();
        toggleCampoObservacaoFiado();
        await carregarDados(session.user.id);
    } catch (error) {
        console.error('Erro ao salvar agendamento:', error);
        showMensagem('mensagem-agendamento', error.message || 'Não foi possível salvar o agendamento.', 'erro');
    }
}

function atualizarFiltroMes() {
    const select = document.getElementById('mes-historico');
    const meses = [...new Set([...window.agendamentos.map((a) => getMesAno(a.data)), getMesAno(getHojeISO())])].sort().reverse();
    const valorAtual = select.value;

    select.innerHTML = '';

    meses.forEach(m => {
        const [ano, mes] = m.split('-');
        const nomeMes = new Date(ano, mes - 1).toLocaleString('pt-BR', { month: 'long' });
        const option = document.createElement('option');
        option.value = m;
        option.textContent = `${nomeMes.charAt(0).toUpperCase() + nomeMes.slice(1)} / ${ano}`;
        select.appendChild(option);
    });

    if (meses.includes(valorAtual)) {
        select.value = valorAtual;
    } else if (meses.length) {
        select.value = meses[0];
    }

    sincronizarFiltroDiaHistorico();
}

function atualizarFiltroFinanceiro() {
    const select = document.getElementById('mes-financeiro');
    const meses = [...new Set(window.agendamentos.map((a) => getMesAno(a.data)))].sort().reverse();
    const valorAtual = select.value;

    select.innerHTML = '<option value="todos">Todos os meses</option>';

    meses.forEach((mesAno) => {
        const [ano, mes] = mesAno.split('-');
        const nomeMes = new Date(ano, mes - 1).toLocaleString('pt-BR', { month: 'long' });
        const option = document.createElement('option');
        option.value = mesAno;
        option.textContent = `${nomeMes.charAt(0).toUpperCase() + nomeMes.slice(1)} / ${ano}`;
        select.appendChild(option);
    });

    if (valorAtual === 'todos' || meses.includes(valorAtual)) {
        select.value = valorAtual || 'todos';
    } else {
        select.value = 'todos';
    }
}

function sincronizarFiltroDiaHistorico() {
    const inputDia = document.getElementById('dia-historico');
    if (!inputDia) {
        return;
    }

    if (!inputDia.value) {
        inputDia.value = getHojeISO();
    }
}

function getConfiguracaoHistorico() {
    const modo = document.getElementById('modo-historico')?.value || 'mensal';
    const grupoMes = document.getElementById('grupo-mes-historico');
    const grupoDia = document.getElementById('grupo-dia-historico');
    const grupoNavegacao = document.getElementById('grupo-navegacao-dia-historico');
    const calendario = document.getElementById('historico-calendario');
    const mobile = isMobileViewport();

    if (grupoMes) {
        grupoMes.hidden = modo !== 'mensal';
    }

    if (grupoDia) {
        grupoDia.hidden = modo !== 'diario' || mobile;
    }

    if (grupoNavegacao) {
        grupoNavegacao.hidden = modo !== 'diario' || mobile;
    }

    if (calendario) {
        calendario.hidden = modo !== 'diario' || !mobile;
    }

    return {
        modo,
        mobile,
        dia: document.getElementById('dia-historico')?.value || '',
        mes: document.getElementById('mes-historico')?.value || '',
    };
}

function atualizarHistorico() {
    const lista = document.getElementById('historico-agendamentos');
    const calendario = document.getElementById('historico-calendario');
    const { modo, mobile, mes } = getConfiguracaoHistorico();
    lista.innerHTML = '';

    let ags = window.agendamentos;

    if (modo === 'diario') {
        sincronizarFiltroDiaHistorico();
        const diaSelecionado = document.getElementById('dia-historico')?.value;

        if (diaSelecionado) {
            ags = ags.filter((a) => a.data === diaSelecionado);
        }

        if (mobile) {
            renderizarCalendarioHistorico(calendario, diaSelecionado);
            renderizarHistoricoMobilePlaceholder(lista);

            if (window.historicoMobileDiaAberto) {
                abrirSheetHistoricoDia(window.historicoMobileDiaAberto);
            } else {
                fecharSheetHistoricoDia({ preservarDia: true });
            }
        } else {
            if (calendario) {
                calendario.innerHTML = '';
                calendario.hidden = true;
            }

            renderizarHistoricoDiario(lista, ags, diaSelecionado);
        }

        return;
    }

    if (calendario) {
        calendario.innerHTML = '';
        calendario.hidden = true;
    }

    if (mes) {
        ags = ags.filter((a) => getMesAno(a.data) === mes);
    }

    if (!ags.length) {
        lista.innerHTML = '<p>Nenhum agendamento encontrado para o período selecionado.</p>';
        return;
    }

    const semanas = {};
    ags.forEach(a => {
        const semana = getWeek(a.data);
        if (!semanas[semana]) semanas[semana] = [];
        semanas[semana].push(a);
    });

    Object.keys(semanas).sort().reverse().forEach(semana => {
        const semanaAgs = semanas[semana];
        const wrapper = document.createElement('div');
        wrapper.className = 'historico-semana';

        const titulo = document.createElement('h3');
        titulo.className = 'historico-semana-titulo';
        titulo.textContent = `Semana ${semana}`;
        wrapper.appendChild(titulo);

        if (isMobileViewport()) {
            const cards = document.createElement('div');
            cards.className = 'lista-cards';
            cards.innerHTML = semanaAgs
                .sort((a, b) => a.data.localeCompare(b.data) || a.hora.localeCompare(b.hora))
                .map((a) => `
                    <article class="registro-card">
                        <div class="registro-card-topo">
                            <strong>${a.nome}</strong>
                            <span class="registro-badge">${a.servico}</span>
                        </div>
                        <div class="registro-linha"><span>Data</span><strong>${formatarDataBR(a.data)}</strong></div>
                        <div class="registro-linha"><span>Hora</span><strong>${a.hora}</strong></div>
                        <div class="registro-linha"><span>Valor</span><strong>R$ ${formatarValor(a.valor)}</strong></div>
                        <div class="registro-acoes">
                            <button class="btn-acao" onclick="editarAgendamento('${a.id}')">Editar</button>
                            <button class="btn-acao btn-excluir" onclick="excluirAgendamento('${a.id}')">Excluir</button>
                        </div>
                    </article>
                `).join('');
            wrapper.appendChild(cards);
            lista.appendChild(wrapper);
            return;
        }

        const tableWrapper = document.createElement('div');
        tableWrapper.className = 'tabela-scroll';
        const table = document.createElement('table');
        table.className = 'tabela-historico';
        table.innerHTML = `
            <thead>
                <tr>
                    <th>Data</th>
                    <th>Hora</th>
                    <th>Cliente</th>
                    <th>Serviço</th>
                    <th>Valor</th>
                    <th>Ação</th>
                </tr>
            </thead>
            <tbody>
                ${semanaAgs
                    .sort((a, b) => a.data.localeCompare(b.data) || a.hora.localeCompare(b.hora))
                    .map(a => `
                        <tr>
                            <td>${formatarDataBR(a.data)}</td>
                            <td>${a.hora}</td>
                            <td>${a.nome}</td>
                            <td>${a.servico}</td>
                            <td>R$ ${a.valor}</td>
                            <td>
                                <button class="btn-acao" onclick="editarAgendamento('${a.id}')">Editar</button>
                                <button class="btn-acao btn-excluir" onclick="excluirAgendamento('${a.id}')">Excluir</button>
                            </td>
                        </tr>
                    `).join('')}
            </tbody>
        `;
        tableWrapper.appendChild(table);
        wrapper.appendChild(tableWrapper);
        lista.appendChild(wrapper);
    });
}

function renderizarCalendarioHistorico(container, diaSelecionado) {
    if (!container || !diaSelecionado) {
        return;
    }

    const mobile = isMobileViewport();

    const dataBase = criarDataLocal(diaSelecionado);
    const primeiroDiaMes = new Date(dataBase.getFullYear(), dataBase.getMonth(), 1);
    const ultimoDiaMes = new Date(dataBase.getFullYear(), dataBase.getMonth() + 1, 0);
    const inicioGrade = new Date(primeiroDiaMes);
    inicioGrade.setDate(primeiroDiaMes.getDate() - primeiroDiaMes.getDay());
    const hoje = getHojeISO();

    const dias = [];
    for (let indice = 0; indice < 42; indice += 1) {
        const dataCorrente = new Date(inicioGrade);
        dataCorrente.setDate(inicioGrade.getDate() + indice);
        const dataISO = formatarDataParaISO(dataCorrente);
        const agendamentosDia = window.agendamentos.filter((agendamento) => agendamento.data === dataISO);
        dias.push({
            dataISO,
            dia: dataCorrente.getDate(),
            foraDoMes: dataCorrente.getMonth() !== dataBase.getMonth(),
            total: agendamentosDia.length,
            livres: Math.max(horariosAgenda.length - new Set(agendamentosDia.map((agendamento) => `${agendamento.hora.slice(0, 2)}:00`)).size, 0),
        });
    }

    container.hidden = false;
    container.innerHTML = `
        <section class="historico-calendario-card">
            <div class="historico-calendario-topo">
                <div>
                    <span class="agenda-diaria-tag">Seleção rápida</span>
                    <h3>${nomesMeses[dataBase.getMonth()].charAt(0).toUpperCase() + nomesMeses[dataBase.getMonth()].slice(1)} / ${dataBase.getFullYear()}</h3>
                    <p>Toque em um dia para abrir a rotina completa com horários livres e ocupados.</p>
                </div>
                <div class="historico-calendario-acoes">
                    <button type="button" class="btn-secundario" data-calendario-nav="-1">Mês anterior</button>
                    <button type="button" class="btn-secundario" data-calendario-nav="1">Próximo mês</button>
                </div>
            </div>
            <div class="historico-calendario-grade-cabecalho">
                <span>Dom</span>
                <span>Seg</span>
                <span>Ter</span>
                <span>Qua</span>
                <span>Qui</span>
                <span>Sex</span>
                <span>Sáb</span>
            </div>
            <div class="historico-calendario-grade">
                ${dias.map((item) => `
                    <button
                        type="button"
                        class="historico-dia-card${mobile ? ' historico-dia-card-mobile' : ''}${item.foraDoMes ? ' historico-dia-card-fora' : ''}${item.dataISO === diaSelecionado ? ' historico-dia-card-ativo' : ''}${item.dataISO === hoje ? ' historico-dia-card-hoje' : ''}${item.total ? ' historico-dia-card-ocupado' : ' historico-dia-card-livre'}"
                        data-dia="${item.dataISO}"
                    >
                        <span class="historico-dia-numero">${item.dia}</span>
                        ${mobile
                            ? `${item.total ? `<span class="historico-dia-badge">${item.total}</span>` : '<span class="historico-dia-ponto"></span>'}`
                            : `<strong>${item.total ? `${item.total} atendimento(s)` : 'Livre'}</strong><small>${item.total ? `${item.livres} horário(s) vagos` : 'Agenda vazia'}</small>`}
                    </button>
                `).join('')}
            </div>
        </section>
    `;

    container.querySelectorAll('[data-dia]').forEach((botao) => {
        botao.addEventListener('click', () => {
            const dataSelecionada = botao.dataset.dia || diaSelecionado;
            definirDiaHistorico(dataSelecionada, { atualizar: false });
            window.historicoMobileDiaAberto = dataSelecionada;

            if (mobile) {
                renderizarCalendarioHistorico(container, dataSelecionada);
                abrirSheetHistoricoDia(dataSelecionada);
                return;
            }

            atualizarHistorico();
        });
    });

    container.querySelectorAll('[data-calendario-nav]').forEach((botao) => {
        botao.addEventListener('click', () => {
            const direcao = Number(botao.dataset.calendarioNav || 0);
            if (mobile) {
                window.historicoMobileDiaAberto = null;
                fecharSheetHistoricoDia({ preservarDia: true });
            }

            definirDiaHistorico(adicionarMesDataISO(diaSelecionado, direcao));
        });
    });
}

function renderizarHistoricoMobilePlaceholder(container) {
    container.innerHTML = `
        <section class="historico-mobile-placeholder">
            <div>
                <span class="agenda-diaria-tag">Agenda móvel</span>
                <h3>Escolha um dia</h3>
                <p>O calendário mostra apenas os dias. Toque em qualquer data para abrir a aba com os compromissos.</p>
            </div>
        </section>
    `;
}

function construirAgendaDiaria(diaSelecionado, agendamentosDia) {
    const agendamentosPorHora = new Map();
    agendamentosDia.forEach((agendamento) => {
        const horaChave = `${agendamento.hora.slice(0, 2)}:00`;
        const existentes = agendamentosPorHora.get(horaChave) || [];
        existentes.push(agendamento);
        agendamentosPorHora.set(horaChave, existentes);
    });

    const metade = Math.ceil(horariosAgenda.length / 2);
    const colunaEsquerda = horariosAgenda.slice(0, metade);
    const colunaDireita = horariosAgenda.slice(metade);
    const totalAtendimentos = agendamentosDia.length;
    const horariosOcupados = new Set(agendamentosDia.map((agendamento) => `${agendamento.hora.slice(0, 2)}:00`));
    const horariosLivres = horariosAgenda.filter((horario) => !horariosOcupados.has(horario)).length;
    const previsaoValor = agendamentosDia.reduce((acumulado, agendamento) => acumulado + Number(agendamento.valor || 0), 0);

    const wrapper = document.createElement('div');
    wrapper.className = 'agenda-diaria';
    wrapper.innerHTML = `
        <div class="agenda-diaria-topo">
            <div class="agenda-diaria-titulo">
                <span class="agenda-diaria-tag">Rotina do dia</span>
                <h3>${formatarDataBR(diaSelecionado)}</h3>
                <p>Organize os horarios e acompanhe os encaixes do dia.</p>
            </div>
            <div class="agenda-diaria-resumo">
                <div class="agenda-resumo-card">
                    <span>Total de atendimentos</span>
                    <strong>${totalAtendimentos}</strong>
                </div>
                <div class="agenda-resumo-card">
                    <span>Horarios livres</span>
                    <strong>${horariosLivres}</strong>
                </div>
                <div class="agenda-resumo-card agenda-resumo-destaque">
                    <span>Previsao do dia</span>
                    <strong>R$ ${formatarValor(previsaoValor)}</strong>
                </div>
            </div>
        </div>
    `;

    if (isMobileViewport()) {
        const listaMobile = document.createElement('div');
        listaMobile.className = 'rotina-mobile-lista';
        listaMobile.innerHTML = horariosAgenda.map((horario) => {
            const agendamentosNoHorario = agendamentosPorHora.get(horario) || [];

            if (!agendamentosNoHorario.length) {
                return `
                    <article class="rotina-mobile-item rotina-mobile-item-livre">
                        <div class="rotina-mobile-hora">${horario}</div>
                        <div class="rotina-mobile-conteudo">
                            <span class="rotina-mobile-status">Horario livre</span>
                            <p>Espaco disponivel para encaixe ou descanso.</p>
                        </div>
                    </article>
                `;
            }

            return `
                <article class="rotina-mobile-item rotina-mobile-item-ocupado">
                    <div class="rotina-mobile-hora">${horario}</div>
                    <div class="rotina-mobile-conteudo">
                        <span class="rotina-mobile-status">${agendamentosNoHorario.length} atendimento(s)</span>
                        <div class="rotina-mobile-blocos">
                            ${agendamentosNoHorario.map((agendamento) => `
                                <div class="rotina-mobile-bloco">
                                    <strong>${agendamento.nome}</strong>
                                    <span>${agendamento.hora} • ${agendamento.servico}</span>
                                    <small>R$ ${formatarValor(agendamento.valor)}</small>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </article>
            `;
        }).join('');

        wrapper.appendChild(listaMobile);
        return wrapper;
    }

    const tableWrapper = document.createElement('div');
    tableWrapper.className = 'tabela-scroll';
    const tabela = document.createElement('table');
    tabela.className = 'tabela-rotina';
    tabela.innerHTML = `
        <thead>
            <tr>
                <th>Horario</th>
                <th>Agenda</th>
                <th>Horario</th>
                <th>Agenda</th>
            </tr>
        </thead>
        <tbody>
            ${colunaEsquerda.map((horaEsquerda, index) => {
                const horaDireita = colunaDireita[index];
                return `
                    <tr>
                        ${montarCelulasRotina(horaEsquerda, agendamentosPorHora.get(horaEsquerda) || [])}
                        ${horaDireita ? montarCelulasRotina(horaDireita, agendamentosPorHora.get(horaDireita) || []) : '<td></td><td></td>'}
                    </tr>
                `;
            }).join('')}
        </tbody>
    `;

    tableWrapper.appendChild(tabela);
    wrapper.appendChild(tableWrapper);
    return wrapper;
}

function renderizarHistoricoDiario(container, agendamentosDia, diaSelecionado) {
    if (!diaSelecionado) {
        container.innerHTML = '<p>Selecione um dia para visualizar a rotina.</p>';
        return;
    }

    container.appendChild(construirAgendaDiaria(diaSelecionado, agendamentosDia));
}

function abrirSheetHistoricoDia(diaSelecionado) {
    const sheet = document.getElementById('historico-dia-sheet');
    const conteudo = document.getElementById('historico-dia-sheet-conteudo');
    const titulo = document.getElementById('historico-dia-sheet-titulo');

    if (!sheet || !conteudo || !titulo) {
        return;
    }

    const agendamentosDia = window.agendamentos
        .filter((agendamento) => agendamento.data === diaSelecionado)
        .sort((a, b) => a.hora.localeCompare(b.hora));
    const horariosOcupados = new Set(agendamentosDia.map((agendamento) => `${agendamento.hora.slice(0, 2)}:00`));
    const horariosLivres = horariosAgenda.filter((horario) => !horariosOcupados.has(horario)).length;

    titulo.textContent = formatarDataBR(diaSelecionado);
    conteudo.innerHTML = `
        <div class="historico-dia-sheet-resumo">
            <article class="agenda-resumo-card">
                <span>Atendimentos</span>
                <strong>${agendamentosDia.length}</strong>
            </article>
            <article class="agenda-resumo-card">
                <span>Horários vagos</span>
                <strong>${horariosLivres}</strong>
            </article>
        </div>
        <div class="historico-dia-sheet-corpo">
            ${agendamentosDia.length
                ? `
                    <div class="historico-dia-sheet-lista">
                        ${agendamentosDia.map((agendamento) => `
                            <article class="historico-dia-sheet-item">
                                <strong>${agendamento.hora}</strong>
                                <div>
                                    <span>${agendamento.nome}</span>
                                    <small>${agendamento.servico}</small>
                                </div>
                            </article>
                        `).join('')}
                    </div>
                `
                : `
                    <div class="historico-dia-sheet-vazio">
                        <strong>Dia livre</strong>
                        <p>Não há compromissos marcados para esta data.</p>
                    </div>
                `}
        </div>
    `;

    sheet.hidden = false;
}

function fecharSheetHistoricoDia(options = {}) {
    const sheet = document.getElementById('historico-dia-sheet');
    const conteudo = document.getElementById('historico-dia-sheet-conteudo');

    if (!sheet) {
        return;
    }

    if (!options.preservarDia) {
        window.historicoMobileDiaAberto = null;
    }

    sheet.hidden = true;

    if (conteudo) {
        conteudo.innerHTML = '';
    }
}

function montarCelulasRotina(horario, agendamentosNoHorario) {
    if (!agendamentosNoHorario.length) {
        return `
            <td class="horario-rotina">${horario}</td>
            <td class="slot-livre">Horario livre</td>
        `;
    }

    return `
        <td class="horario-rotina">${horario}</td>
        <td>
            <div class="slot-ocupado-lista">
                ${agendamentosNoHorario.map((agendamento) => `
                    <div class="slot-ocupado-item">
                        <strong>${agendamento.nome}</strong>
                        <span>${agendamento.hora} • ${agendamento.servico}</span>
                    </div>
                `).join('')}
            </div>
        </td>
    `;
}

function atualizarFinanceiro() {
    const resumo = document.getElementById('resumo-financeiro');
    const lista = document.getElementById('lista-financeiro');
    const listaFiados = document.getElementById('lista-fiados');
    const filtroMes = document.getElementById('mes-financeiro')?.value || 'todos';
    const filtroStatus = document.getElementById('status-financeiro')?.value || 'todos';
    const filtroMetodo = document.getElementById('metodo-financeiro')?.value || 'todos';
    resumo.innerHTML = '';
    lista.innerHTML = '';
    listaFiados.innerHTML = '';

    if (!window.pagamentos.length) {
        resumo.innerHTML = '<p class="financeiro-vazio">Nenhum resumo disponível até o momento.</p>';
        lista.innerHTML = '<p>Nenhum pagamento registrado até o momento.</p>';
        listaFiados.innerHTML = '<p class="financeiro-vazio">Nenhum fiado registrado até o momento.</p>';
        return;
    }

    const agendamentoPorId = new Map(window.agendamentos.map((agendamento) => [agendamento.id, agendamento]));
    const pagamentosNormais = window.pagamentos.filter((pagamento) => pagamento.metodoPagamento !== 'fiado');
    const pagamentosFiados = window.pagamentos.filter((pagamento) => pagamento.metodoPagamento === 'fiado');
    const pagamentosFiltrados = pagamentosNormais.filter((pagamento) => {
        const agendamento = agendamentoPorId.get(pagamento.agendamentoId);

        if (!agendamento) {
            return false;
        }

        const correspondeMes = filtroMes === 'todos' || getMesAno(agendamento.data) === filtroMes;
        const correspondeStatus = filtroStatus === 'todos' || pagamento.status === filtroStatus;
        const correspondeMetodo = filtroMetodo === 'todos' || pagamento.metodoPagamento === filtroMetodo;

        return correspondeMes && correspondeStatus && correspondeMetodo;
    });

    const fiadosFiltrados = pagamentosFiados.filter((pagamento) => {
        const agendamento = agendamentoPorId.get(pagamento.agendamentoId);

        if (!agendamento) {
            return false;
        }

        return filtroMes === 'todos' || getMesAno(agendamento.data) === filtroMes;
    });

    renderizarFiados(listaFiados, fiadosFiltrados, agendamentoPorId);

    if (!pagamentosFiltrados.length) {
        resumo.innerHTML = '<p class="financeiro-vazio">Nenhum resultado encontrado para os filtros selecionados.</p>';
        lista.innerHTML = '<p>Nenhum pagamento encontrado para os filtros selecionados.</p>';
        return;
    }

    atualizarResumoFinanceiro(resumo, pagamentosFiltrados);

    const pagamentosOrdenados = pagamentosFiltrados.slice().sort((a, b) => {
        const dataA = agendamentoPorId.get(a.agendamentoId)?.data || '';
        const dataB = agendamentoPorId.get(b.agendamentoId)?.data || '';
        return dataA.localeCompare(dataB);
    });

    if (isMobileViewport()) {
        const cards = document.createElement('div');
        cards.className = 'lista-cards lista-cards-financeiro';
        cards.innerHTML = pagamentosOrdenados.map((p) => {
            const agendamento = agendamentoPorId.get(p.agendamentoId);

            if (!agendamento) {
                return '';
            }

            return `
                <article class="registro-card financeiro-card">
                    <div class="registro-card-topo">
                        <strong>${agendamento.nome}</strong>
                        <span class="registro-badge ${p.status === 'pago' ? 'registro-badge-pago' : ''}">${p.status}</span>
                    </div>
                    <div class="registro-linha"><span>Data</span><strong>${formatarDataBR(agendamento.data)}</strong></div>
                    <div class="registro-linha"><span>Serviço</span><strong>${agendamento.servico}</strong></div>
                    <div class="registro-linha"><span>Método</span><strong>${formatarMetodoPagamento(p.metodoPagamento)}</strong></div>
                    <div class="registro-linha"><span>Valor</span><strong>R$ ${formatarValor(p.valor)}</strong></div>
                    <label class="check-pago-card">
                        <input type="checkbox" class="check-pago" ${p.status === "pago" ? "checked" : ""} onchange="togglePago('${p.id}')">
                        <span>Marcar como pago</span>
                    </label>
                </article>
            `;
        }).join('');
        lista.appendChild(cards);
        return;
    }

    const wrapper = document.createElement('div');
    wrapper.className = 'tabela-scroll';
    const table = document.createElement('table');
    table.className = 'tabela-financeiro';
    table.innerHTML = `
        <thead>
            <tr>
                <th>Data</th>
                <th>Cliente</th>
                <th>Serviço</th>
                <th>Método</th>
                <th>Valor</th>
                <th>Status</th>
                <th>Ação</th>
            </tr>
        </thead>
        <tbody>
            ${pagamentosOrdenados.map((p) => {
                const agendamento = agendamentoPorId.get(p.agendamentoId);

                if (!agendamento) {
                    return '';
                }

                return `
                <tr>
                    <td>${formatarDataBR(agendamento.data)}</td>
                    <td>${agendamento.nome}</td>
                    <td>${agendamento.servico}</td>
                    <td>${formatarMetodoPagamento(p.metodoPagamento)}</td>
                    <td>R$ ${p.valor}</td>
                    <td><strong>${p.status}</strong></td>
                    <td>
                        <input type="checkbox" class="check-pago" ${p.status === "pago" ? "checked" : ""} onchange="togglePago('${p.id}')">
                    </td>
                </tr>
            `;
            }).join('')}
        </tbody>
    `;
    wrapper.appendChild(table);
    lista.appendChild(wrapper);
}

window.mostrarAba = function(aba) {
    fecharSheetHistoricoDia();

    document.querySelectorAll('.aba-conteudo').forEach(sec => {
        sec.classList.remove('active');
        sec.style.display = 'none';
    });
    const ativa = document.getElementById(aba);
    ativa.classList.add('active');
    ativa.style.display = 'block';

    document.querySelectorAll('.aba-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelector('.aba-btn[onclick*="' + aba + '"]').classList.add('active');
};

function formatarDataBR(dataISO) {
    const [ano, mes, dia] = dataISO.split('-');
    return `${dia}/${mes}/${ano}`;
}

function showMensagem(elementId, texto, tipo) {
    const elemento = document.getElementById(elementId);

    if (!elemento) {
        return;
    }

    elemento.textContent = texto;
    elemento.className = tipo;
}

function atualizarResumoFinanceiro(container, pagamentosReferencia = window.pagamentos) {
    const resumoPorMetodo = metodosPagamentoResumo.map((metodo) => {
        const pagamentosMetodo = pagamentosReferencia.filter((pagamento) => pagamento.metodoPagamento === metodo);
        const total = pagamentosMetodo.reduce((acumulado, pagamento) => acumulado + pagamento.valor, 0);
        const pagos = pagamentosMetodo
            .filter((pagamento) => pagamento.status === 'pago')
            .reduce((acumulado, pagamento) => acumulado + pagamento.valor, 0);
        const pendentes = pagamentosMetodo
            .filter((pagamento) => pagamento.status !== 'pago')
            .reduce((acumulado, pagamento) => acumulado + pagamento.valor, 0);

        return {
            metodo,
            total,
            pagos,
            pendentes,
            quantidade: pagamentosMetodo.length,
        };
    });

    const totalRecebido = pagamentosReferencia
        .filter((pagamento) => pagamento.status === 'pago')
        .reduce((acumulado, pagamento) => acumulado + pagamento.valor, 0);
    const totalPendente = pagamentosReferencia
        .filter((pagamento) => pagamento.status !== 'pago')
        .reduce((acumulado, pagamento) => acumulado + pagamento.valor, 0);

    container.innerHTML = `
        <div class="resumo-card resumo-card-total">
            <span class="resumo-label">Recebido</span>
            <strong>R$ ${formatarValor(totalRecebido)}</strong>
        </div>
        <div class="resumo-card resumo-card-total">
            <span class="resumo-label">Pendente</span>
            <strong>R$ ${formatarValor(totalPendente)}</strong>
        </div>
        ${resumoPorMetodo.map((item) => `
            <div class="resumo-card">
                <span class="resumo-label">${formatarMetodoPagamento(item.metodo)}</span>
                <strong>R$ ${formatarValor(item.total)}</strong>
                <small>${item.quantidade} pagamento(s) • recebido R$ ${formatarValor(item.pagos)} • pendente R$ ${formatarValor(item.pendentes)}</small>
            </div>
        `).join('')}
    `;
}

function renderizarFiados(container, pagamentosFiados, agendamentoPorId) {
    if (!pagamentosFiados.length) {
        container.innerHTML = '<p class="financeiro-vazio">Nenhum fiado registrado para o período selecionado.</p>';
        return;
    }

    const fiadosOrdenados = pagamentosFiados.slice().sort((a, b) => {
        const dataA = agendamentoPorId.get(a.agendamentoId)?.data || '';
        const dataB = agendamentoPorId.get(b.agendamentoId)?.data || '';
        return dataA.localeCompare(dataB);
    });

    if (isMobileViewport()) {
        const cards = document.createElement('div');
        cards.className = 'lista-cards lista-cards-fiados';
        cards.innerHTML = fiadosOrdenados.map((pagamento) => {
            const agendamento = agendamentoPorId.get(pagamento.agendamentoId);

            if (!agendamento) {
                return '';
            }

            return `
                <article class="registro-card registro-card-fiado">
                    <div class="registro-card-topo">
                        <strong>${agendamento.nome}</strong>
                        <span class="registro-badge registro-badge-fiado">Fiado</span>
                    </div>
                    <div class="registro-linha"><span>Data</span><strong>${formatarDataBR(agendamento.data)}</strong></div>
                    <div class="registro-linha"><span>Serviço</span><strong>${agendamento.servico}</strong></div>
                    <div class="registro-linha"><span>Valor</span><strong>R$ ${formatarValor(pagamento.valor)}</strong></div>
                    <div class="registro-linha"><span>Status</span><strong>${pagamento.status}</strong></div>
                    <div class="observacao-fiado-card">
                        <span>Observação</span>
                        <p>${pagamento.observacao || 'Sem observações registradas.'}</p>
                    </div>
                    <label class="check-pago-card">
                        <input type="checkbox" class="check-pago" ${pagamento.status === "pago" ? "checked" : ""} onchange="togglePago('${pagamento.id}')">
                        <span>Marcar como pago</span>
                    </label>
                </article>
            `;
        }).join('');
        container.appendChild(cards);
        return;
    }

    const wrapper = document.createElement('div');
    wrapper.className = 'tabela-scroll';
    const tabela = document.createElement('table');
    tabela.className = 'tabela-financeiro tabela-fiados';
    tabela.innerHTML = `
        <thead>
            <tr>
                <th>Data</th>
                <th>Cliente</th>
                <th>Serviço</th>
                <th>Valor</th>
                <th>Status</th>
                <th>Observação</th>
                <th>Ação</th>
            </tr>
        </thead>
        <tbody>
            ${fiadosOrdenados.map((pagamento) => {
                const agendamento = agendamentoPorId.get(pagamento.agendamentoId);

                if (!agendamento) {
                    return '';
                }

                return `
                    <tr>
                        <td>${formatarDataBR(agendamento.data)}</td>
                        <td>${agendamento.nome}</td>
                        <td>${agendamento.servico}</td>
                        <td>R$ ${formatarValor(pagamento.valor)}</td>
                        <td><strong>${pagamento.status}</strong></td>
                        <td>${pagamento.observacao || 'Sem observações'}</td>
                        <td>
                            <input type="checkbox" class="check-pago" ${pagamento.status === "pago" ? "checked" : ""} onchange="togglePago('${pagamento.id}')">
                        </td>
                    </tr>
                `;
            }).join('')}
        </tbody>
    `;
    wrapper.appendChild(tabela);
    container.appendChild(wrapper);
}

function formatarMetodoPagamento(valor) {
    const mapa = {
        pix: 'Pix',
        dinheiro: 'Dinheiro',
        debito: 'Débito',
        credito: 'Crédito',
        fiado: 'Fiado',
    };

    return mapa[valor] || valor;
}

function formatarValor(valor) {
    return Number(valor).toFixed(2).replace('.', ',');
}

function buildLoadErrorMessage(error) {
    if (isPagamentoSchemaOutdated(error)) {
        return 'Falta atualizar a tabela pagamentos no Supabase para suportar fiado e observações.';
    }

    return 'Não foi possível carregar os dados do salão.';
}

function enrichSchemaError(error) {
    if (isPagamentoSchemaOutdated(error)) {
        return new Error('Atualize a tabela pagamentos no Supabase para suportar fiado e observações antes de continuar.');
    }

    return error;
}

function isPagamentoSchemaOutdated(error) {
    const message = `${error?.message || ''} ${error?.details || ''} ${error?.hint || ''}`.toLowerCase();
    return (
        (message.includes('metodo_pagamento') && (message.includes('column') || message.includes('schema cache') || message.includes('check constraint'))) ||
        (message.includes('observacao') && (message.includes('column') || message.includes('schema cache')))
    );
}

window.excluirAgendamento = async function(id) {
    const session = await getSessionOrRedirect();

    if (!session) {
        return;
    }

    const { error } = await supabaseClient
        .from('agendamentos')
        .delete()
        .eq('id', id);

    if (error) {
        console.error('Erro ao excluir agendamento:', error);
        showMensagem('mensagem-agendamento', error.message || 'Não foi possível excluir o agendamento.', 'erro');
        return;
    }

    showMensagem('mensagem-agendamento', 'Agendamento excluído com sucesso!', 'sucesso');
    await carregarDados(session.user.id);
};

window.editarAgendamento = function(id) {
    const ag = window.agendamentos.find((item) => item.id === id);
    const pagamento = window.pagamentos.find((item) => item.agendamentoId === id);

    if (!ag) return;

    document.getElementById('cliente-nome').value = ag.nome;
    document.getElementById('servico').value = ag.servico;
    document.getElementById('data').value = ag.data;
    document.getElementById('hora').value = ag.hora;
    document.getElementById('metodo-pagamento').value = pagamento?.metodoPagamento || 'pix';
    document.getElementById('observacao-fiado').value = pagamento?.observacao || '';
    toggleCampoObservacaoFiado();
    window.agendamentoEditando = { id: ag.id };
    mostrarAlertaEdicao(ag);
};

function mostrarAlertaEdicao(ag) {
    const alerta = document.getElementById('alerta-edicao');
    if (ag) {
        alerta.style.display = 'block';
        alerta.className = 'editando-alerta';
        alerta.innerHTML = `✏️ <span>Editando agendamento de <strong>${ag.nome}</strong> em <strong>${formatarDataBR(ag.data)}</strong> às <strong>${ag.hora}</strong></span>
        <button class="btn-acao" onclick="cancelarEdicao()">Cancelar edição</button>`;
    } else {
        alerta.style.display = 'none';
    }
}

window.cancelarEdicao = function() {
    window.agendamentoEditando = null;
    mostrarAlertaEdicao(null);
    document.getElementById('agendamento-form').reset();
    toggleCampoObservacaoFiado();
};

function toggleCampoObservacaoFiado() {
    const metodoPagamento = document.getElementById('metodo-pagamento');
    const campoObservacao = document.getElementById('campo-observacao-fiado');
    const inputObservacao = document.getElementById('observacao-fiado');

    if (!metodoPagamento || !campoObservacao || !inputObservacao) {
        return;
    }

    const isFiado = metodoPagamento.value === 'fiado';
    campoObservacao.hidden = !isFiado;
    campoObservacao.style.display = isFiado ? 'flex' : 'none';

    if (!isFiado) {
        inputObservacao.value = '';
    }
}

window.togglePago = async function(id) {
    const session = await getSessionOrRedirect();

    if (!session) {
        return;
    }

    const pagamento = window.pagamentos.find((item) => item.id === id);

    if (!pagamento) {
        return;
    }

    const novoStatus = pagamento.status === 'pago' ? 'pendente' : 'pago';
    const { error } = await supabaseClient
        .from('pagamentos')
        .update({ status: novoStatus })
        .eq('id', id);

    if (error) {
        console.error('Erro ao atualizar pagamento:', error);
        showMensagem('mensagem-agendamento', error.message || 'Não foi possível atualizar o pagamento.', 'erro');
        return;
    }

    await carregarDados(session.user.id);
};

})();