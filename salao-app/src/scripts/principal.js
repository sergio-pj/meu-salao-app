const BIN_ID = '688b4489ae596e708fbec00d';
const API_KEY = '$2a$10$9hlN9CXBERVniixkCGPV/uws5ojVXRxOSNjbgZgotShZI9DK4U39a'; // Substitua pela sua chave

const BASE_URL = `https://api.jsonbin.io/v3/b/${BIN_ID}`;

window.agendamentos = [];
window.pagamentos = [];
window.agendamentoEditando = null;

document.getElementById('agendamento-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    const nome = document.getElementById('cliente-nome').value;
    const servico = document.getElementById('servico').value;
    const data = document.getElementById('data').value;
    const hora = document.getElementById('hora').value;

    let valor = 0;
    if (servico === "corte") valor = 40;
    if (servico === "manicure") valor = 30;
    if (servico === "trança") valor = 60;
    if (servico === "luzes") valor = 120;

    // Se estiver editando, remove o antigo
    if (window.agendamentoEditando) {
        window.agendamentos = window.agendamentos.filter(a => !(a.data === window.agendamentoEditando.data && a.hora === window.agendamentoEditando.hora && a.nome === window.agendamentoEditando.nome));
        window.pagamentos = window.pagamentos.filter(p => !(p.data === window.agendamentoEditando.data && p.nome === window.agendamentoEditando.nome));
        window.agendamentoEditando = null;
        mostrarAlertaEdicao(null);
    }

    window.agendamentos.push({ nome, servico, data, hora, valor });
    window.pagamentos.push({ nome, servico, data, valor, status: "pendente" });

    document.getElementById('mensagem-agendamento').style.color = "green";
    document.getElementById('mensagem-agendamento').textContent = "Horário agendado com sucesso!";

    atualizarFiltroMes();
    atualizarHistorico();
    atualizarFinanceiro();
    this.reset();

    await salvarAgendamentos();
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

function atualizarFiltroMes() {
    const select = document.getElementById('mes-historico');
    // Pega todos os meses dos agendamentos
    const meses = [...new Set(agendamentos.map(a => getMesAno(a.data)))].sort().reverse();
    select.innerHTML = '';
    meses.forEach(m => {
        const [ano, mes] = m.split('-');
        const nomeMes = new Date(ano, mes-1).toLocaleString('pt-br', { month: 'long' });
        const option = document.createElement('option');
        option.value = m;
        option.textContent = `${nomeMes.charAt(0).toUpperCase() + nomeMes.slice(1)} / ${ano}`;
        select.appendChild(option);
    });
    // Seleciona o mês mais recente
    if (meses.length) select.value = meses[0];
}

function atualizarHistorico() {
    const lista = document.getElementById('historico-agendamentos');
    const select = document.getElementById('mes-historico');
    lista.innerHTML = '';

    let ags = window.agendamentos;
    if (select && select.value) {
        ags = ags.filter(a => getMesAno(a.data) === select.value);
    }

    // Agrupa por semana
    const semanas = {};
    ags.forEach(a => {
        const semana = getWeek(a.data);
        if (!semanas[semana]) semanas[semana] = [];
        semanas[semana].push(a);
    });

    Object.keys(semanas).sort().reverse().forEach(semana => {
        const semanaAgs = semanas[semana];
        const table = document.createElement('table');
        table.className = 'tabela-historico';
        table.innerHTML = `
            <caption><strong>Semana ${semana}</strong></caption>
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
                                <button class="btn-acao" onclick="editarAgendamento('${a.data}','${a.hora}','${a.nome}')">Editar</button>
                                <button class="btn-acao btn-excluir" onclick="excluirAgendamento('${a.data}','${a.hora}','${a.nome}')">Excluir</button>
                            </td>
                        </tr>
                    `).join('')}
            </tbody>
        `;
        lista.appendChild(table);
    });
}

function atualizarFinanceiro() {
    const lista = document.getElementById('lista-financeiro');
    lista.innerHTML = '';

    const pagamentosOrdenados = window.pagamentos.slice().sort((a, b) => a.data.localeCompare(b.data));
    const table = document.createElement('table');
    table.className = 'tabela-financeiro';
    table.innerHTML = `
        <thead>
            <tr>
                <th>Data</th>
                <th>Cliente</th>
                <th>Serviço</th>
                <th>Valor</th>
                <th>Status</th>
                <th>Ação</th>
            </tr>
        </thead>
        <tbody>
            ${pagamentosOrdenados.map((p, idx) => `
                <tr>
                    <td>${formatarDataBR(p.data)}</td>
                    <td>${p.nome}</td>
                    <td>${p.servico}</td>
                    <td>R$ ${p.valor}</td>
                    <td><strong>${p.status}</strong></td>
                    <td>
                        <input type="checkbox" class="check-pago" ${p.status === "pago" ? "checked" : ""} onchange="togglePago(${idx})">
                    </td>
                </tr>
            `).join('')}
        </tbody>
    `;
    lista.appendChild(table);
}

window.marcarPago = function(idx) {
    pagamentos[idx].status = "pago";
    atualizarFinanceiro();
}

// Atualiza histórico ao trocar o mês
document.getElementById('mes-historico').addEventListener('change', atualizarHistorico);

// Inicializa listas e filtro
atualizarFiltroMes();
atualizarHistorico();

function mostrarAba(aba) {
    document.querySelectorAll('.aba-conteudo').forEach(sec => {
        sec.classList.remove('active');
        sec.style.display = 'none';
    });
    const ativa = document.getElementById(aba);
    ativa.classList.add('active');
    ativa.style.display = 'block';

    document.querySelectorAll('.aba-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelector('.aba-btn[onclick*="' + aba + '"]').classList.add('active');
}

// Buscar agendamentos do JSONBin
async function carregarAgendamentos() {
    const res = await fetch(BASE_URL, {
        headers: {
            'X-Master-Key': API_KEY
        }
    });
    const data = await res.json();
    window.agendamentos = data.record.agendamentos || [];
    window.pagamentos = data.record.pagamentos || [];
    atualizarHistorico();
    atualizarFinanceiro();
    atualizarFiltroMes();
}

// Salvar agendamentos no JSONBin
async function salvarAgendamentos() {
    const body = JSON.stringify({
        agendamentos,
        pagamentos
    });
    await fetch(BASE_URL, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'X-Master-Key': API_KEY
        },
        body
    });
}

// Carregar dados ao iniciar
carregarAgendamentos();

function formatarDataBR(dataISO) {
    const [ano, mes, dia] = dataISO.split('-');
    return `${dia}/${mes}/${ano}`;
}

// Excluir agendamento
window.excluirAgendamento = async function(data, hora, nome) {
    window.agendamentos = window.agendamentos.filter(a => !(a.data === data && a.hora === hora && a.nome === nome));
    window.pagamentos = window.pagamentos.filter(p => !(p.data === data && p.nome === nome));
    await salvarAgendamentos();
    atualizarHistorico();
    atualizarFinanceiro();
    atualizarFiltroMes();
}

// Editar agendamento (preenche o formulário e removes o antigo)
window.editarAgendamento = function(data, hora, nome) {
    const ag = window.agendamentos.find(a => a.data === data && a.hora === hora && a.nome === nome);
    if (!ag) return;
    document.getElementById('cliente-nome').value = ag.nome;
    document.getElementById('servico').value = ag.servico;
    document.getElementById('data').value = ag.data;
    document.getElementById('hora').value = ag.hora;
    window.agendamentoEditando = { data, hora, nome, nomeCliente: ag.nome };
    mostrarAlertaEdicao(ag);
}

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
}

window.togglePago = async function(idx) {
    window.pagamentos[idx].status = window.pagamentos[idx].status === "pago" ? "pendente" : "pago";
    await salvarAgendamentos();
    atualizarFinanceiro();
}