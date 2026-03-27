(() => {
const supabaseClient = window.supabaseClient;
const tabelaValores = {
    corte: 40,
    manicure: 30,
    'trança': 60,
    luzes: 120,
};
const metodosPagamento = ['pix', 'dinheiro', 'debito', 'credito'];

window.agendamentos = [];
window.pagamentos = [];
window.agendamentoEditando = null;

document.addEventListener('DOMContentLoaded', async () => {
    const form = document.getElementById('agendamento-form');
    const selectMes = document.getElementById('mes-historico');
    const selectMesFinanceiro = document.getElementById('mes-financeiro');
    const selectStatusFinanceiro = document.getElementById('status-financeiro');
    const selectMetodoFinanceiro = document.getElementById('metodo-financeiro');

    form.addEventListener('submit', handleSubmitAgendamento);
    selectMes.addEventListener('change', atualizarHistorico);
    selectMesFinanceiro.addEventListener('change', atualizarFinanceiro);
    selectStatusFinanceiro.addEventListener('change', atualizarFinanceiro);
    selectMetodoFinanceiro.addEventListener('change', atualizarFinanceiro);
    window.addEventListener('resize', handleViewportChange);
    window.mostrarAba('agendamento');

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

function isMobileViewport() {
    return window.matchMedia('(max-width: 640px)').matches;
}

function handleViewportChange() {
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
            .select('id, agendamento_id, valor, status, metodo_pagamento, created_at')
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
    }));

    atualizarFiltroMes();
    atualizarFiltroFinanceiro();
    atualizarHistorico();
    atualizarFinanceiro();
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
    const valor = tabelaValores[servico] || 0;

    if (!nome || !servico || !data || !hora || !metodoPagamento) {
        showMensagem('mensagem-agendamento', 'Preencha todos os campos do agendamento.', 'erro');
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
                .update({ valor, metodo_pagamento: metodoPagamento })
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
        await carregarDados(session.user.id);
    } catch (error) {
        console.error('Erro ao salvar agendamento:', error);
        showMensagem('mensagem-agendamento', error.message || 'Não foi possível salvar o agendamento.', 'erro');
    }
}

function atualizarFiltroMes() {
    const select = document.getElementById('mes-historico');
    const meses = [...new Set(window.agendamentos.map((a) => getMesAno(a.data)))].sort().reverse();
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

function atualizarHistorico() {
    const lista = document.getElementById('historico-agendamentos');
    const select = document.getElementById('mes-historico');
    lista.innerHTML = '';

    let ags = window.agendamentos;
    if (select && select.value) {
        ags = ags.filter((a) => getMesAno(a.data) === select.value);
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

function atualizarFinanceiro() {
    const resumo = document.getElementById('resumo-financeiro');
    const lista = document.getElementById('lista-financeiro');
    const filtroMes = document.getElementById('mes-financeiro')?.value || 'todos';
    const filtroStatus = document.getElementById('status-financeiro')?.value || 'todos';
    const filtroMetodo = document.getElementById('metodo-financeiro')?.value || 'todos';
    resumo.innerHTML = '';
    lista.innerHTML = '';

    if (!window.pagamentos.length) {
        resumo.innerHTML = '<p class="financeiro-vazio">Nenhum resumo disponível até o momento.</p>';
        lista.innerHTML = '<p>Nenhum pagamento registrado até o momento.</p>';
        return;
    }

    const agendamentoPorId = new Map(window.agendamentos.map((agendamento) => [agendamento.id, agendamento]));
    const pagamentosFiltrados = window.pagamentos.filter((pagamento) => {
        const agendamento = agendamentoPorId.get(pagamento.agendamentoId);

        if (!agendamento) {
            return false;
        }

        const correspondeMes = filtroMes === 'todos' || getMesAno(agendamento.data) === filtroMes;
        const correspondeStatus = filtroStatus === 'todos' || pagamento.status === filtroStatus;
        const correspondeMetodo = filtroMetodo === 'todos' || pagamento.metodoPagamento === filtroMetodo;

        return correspondeMes && correspondeStatus && correspondeMetodo;
    });

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
    const resumoPorMetodo = metodosPagamento.map((metodo) => {
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

function formatarMetodoPagamento(valor) {
    const mapa = {
        pix: 'Pix',
        dinheiro: 'Dinheiro',
        debito: 'Débito',
        credito: 'Crédito',
    };

    return mapa[valor] || valor;
}

function formatarValor(valor) {
    return Number(valor).toFixed(2).replace('.', ',');
}

function buildLoadErrorMessage(error) {
    if (isMetodoPagamentoColumnMissing(error)) {
        return 'Falta atualizar a tabela pagamentos no Supabase com a coluna metodo_pagamento.';
    }

    return 'Não foi possível carregar os dados do salão.';
}

function enrichSchemaError(error) {
    if (isMetodoPagamentoColumnMissing(error)) {
        return new Error('Atualize a tabela pagamentos no Supabase com a coluna metodo_pagamento antes de continuar.');
    }

    return error;
}

function isMetodoPagamentoColumnMissing(error) {
    const message = `${error?.message || ''} ${error?.details || ''} ${error?.hint || ''}`.toLowerCase();
    return message.includes('metodo_pagamento') && (message.includes('column') || message.includes('schema cache'));
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
};

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