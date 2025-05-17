// Substitua pelos seus dados do projeto Supabase
const SUPABASE_URL = 'https://vlxuudjpxlnihyvxchmp.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZseHV1ZGpweGxuaWh5dnhjaG1wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDY4ODM1NzAsImV4cCI6MjA2MjQ1OTU3MH0.p2aSzw1i3S9MqSFgsOvQpwz2_TbH4LSwF87WodGZB0M';

// Use um nome diferente para a instância do cliente para evitar conflito com a variável global 'supabase' da SDK
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// --- VARIÁVEIS DE ESTADO DA GESTÃO ---
// Declaradas fora das funções principais para serem acessíveis globalmente dentro do DOMContentLoaded
let currentUserSettings = null; // Armazena as configurações do usuário logado
let currentCycle = 0; // Ciclo atual (começa em 0 ou 1)
let currentLevel = 0; // Nível atual (começa em 0 ou 1)
let currentEntry = 0; // Número da entrada atual dentro do nível (começa em 0 ou 1)
let lastTradeResult = null; // Resultado do último trade ('Win', 'Loss', 'Draw', null)
let currentEntryValue = 0; // Valor da entrada atual (o que será recomendado para a próxima operação)
let valorPorCicloCalculado = 0; // Armazena o Valor por Ciclo calculado das settings

// --- FUNÇÃO: Função para carregar as configurações do usuário ---
async function loadUserSettings(userId) {
    console.log('Attempting to load settings for user:', userId);

    const { data, error } = await supabaseClient
        .from('settings')
        .select('*')
        .eq('user_id', userId)
        .single();

    if (error && error.code !== 'PGRST116') {
        console.error('Erro ao carregar configurações:', error);
        // TODO: Adicionar tratamento de erro na UI, talvez mostrar uma mensagem
        return null;
    }

    if (data) {
        console.log('Configurações carregadas com sucesso:', data);
        // Armazena as configurações carregadas na variável de estado
        currentUserSettings = data;
        return data;
    } else {
        console.log('Nenhuma configuração encontrada para o usuário. Usar defaults ou prompt.');
        currentUserSettings = null; // Garante que a variável de estado está null
        return null;
    }
}
// --- FIM FUNÇÃO loadUserSettings ---

// --- FUNÇÃO: Função para calcular e atualizar as métricas e o painel de operação ---
// Esta função agora usa a variável global currentUserSettings
async function updateOperationPanel() { // Removido userSettings como parâmetro
    console.log('Updating operation panel...');

    // --- 1. Verificar se currentUserSettings está disponível ---
    if (!currentUserSettings) {
        console.log("Não há configurações para calcular métricas. Exibindo padrões ou '--'.");
        // Popular a UI com valores padrão ou '--'
        const elementsToClear = ['bancaAtual', 'rentabilidadeGlobal', 'metaLucro', 'reservaCapital', 'currentPayout', 'nextAction', 'recommendedValue', 'statusText', 'entriesToday', 'winsToday', 'lossesToday'];
        elementsToClear.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.textContent = '--';
        });
        const rentabilidadeEl = document.getElementById('rentabilidadeGlobal');
        if(rentabilidadeEl) rentabilidadeEl.classList.remove('positive', 'negative');
        const reservaEl = document.getElementById('reservaCapital');
        if(reservaEl) reservaEl.classList.remove('positive', 'negative');

        // Ocultar o painel de operação ou mostrar mensagem para configurar settings
        const operationPanel = document.querySelector('.operation-panel'); // Assumindo que existe um container para o painel
        const settingsMessage = document.getElementById('settings-required-message'); // Assumindo que existe um elemento para a mensagem
        if (operationPanel) operationPanel.style.display = 'none';
        if (settingsMessage) settingsMessage.style.display = 'block';


        return; // Sai da função se não há settings
    }

    // Se as configurações existem, garantir que o painel está visível e a mensagem oculta
    const operationPanel = document.querySelector('.operation-panel');
    const settingsMessage = document.getElementById('settings-required-message');
    if (operationPanel) operationPanel.style.display = 'block';
    if (settingsMessage) settingsMessage.style.display = 'none';


    // --- 2. Calcular as Métricas Globais (baseado nas settings e nos trades) ---
    // Estes valores precisam ser buscados dos trades reais do usuário

    // !! TODO: Lógica para buscar Banca Atual REAL e Rentabilidade Global REAL da tabela 'trades' !!
    // Consulta a tabela 'trades' para o usuário logado, ordena por data e pega o último 'balance_after' para a banca atual.
    // Consulta a tabela 'trades' para o usuário logado e soma todos os 'profit_loss' para a rentabilidade global.
    // Exemplo de busca do último trade para a banca atual:
    let bancaAtual = currentUserSettings.banca_inicial; // Valor inicial/fallback
    let rentabilidadeGlobal = 0; // Valor inicial/fallback
    let totalEntriesToday = 0;
    let totalWinsToday = 0;
    let totalLossesToday = 0;


    const { data: trades, error: tradesError } = await supabaseClient
        .from('trades')
        .select('profit_loss, balance_after, created_at, result')
        .eq('user_id', currentUserSettings.user_id)
        .order('created_at', { ascending: false }); // Ordena para pegar o último trade facilmente

    if (tradesError) {
        console.error('Erro ao buscar trades para métricas:', tradesError);
        // TODO: Tratar erro na UI
    } else if (trades && trades.length > 0) {
        // Calcular Banca Atual (saldo do último trade)
        bancaAtual = trades[0].balance_after;

        // Calcular Rentabilidade Global (soma dos profit_loss)
        rentabilidadeGlobal = trades.reduce((sum, trade) => sum + trade.profit_loss, 0);

        // Calcular Entradas, Wins, Losses do dia atual
        const today = new Date();
        today.setHours(0, 0, 0, 0); // Define para o início do dia

        const tradesToday = trades.filter(trade => new Date(trade.created_at) >= today);
        totalEntriesToday = tradesToday.length;
        totalWinsToday = tradesToday.filter(trade => trade.result === 'Win').length;
        totalLossesToday = tradesToday.filter(trade => trade.result === 'Loss').length;

        // !! TODO: Lógica para determinar o ESTADO ATUAL da gestão (currentCycle, currentLevel, currentEntry, lastTradeResult)
        // com base no ÚLTIMO trade registrado (trades[0].cycle_step, trades[0].result) !!
        // Isso definirá de onde a lógica de cálculo do PRÓXIMO valor deve partir.
        const lastTrade = trades[0];
        lastTradeResult = lastTrade.result; // Atualiza a variável de estado global
        // Precisamos extrair ciclo/nível/entrada de lastTrade.cycle_step (ex: "C1L2E3")
        // TODO: Criar uma função para parsear cycle_step string para { cycle, level, entry }
        // Ex: { cycle: 1, level: 2, entry: 3 }
        // E atualizar as variáveis de estado globais: currentCycle, currentLevel, currentEntry
        console.log("Último trade:", lastTrade);
        console.log("Resultado do último trade:", lastTradeResult);
        // TODO: Atualizar currentCycle, currentLevel, currentEntry com base em lastTrade.cycle_step
    } else {
        // Se não há trades, a banca atual é a inicial e a rentabilidade é 0.
        // O estado inicial da gestão é o começo (C1L1E0 ou similar).
        bancaAtual = currentUserSettings.banca_inicial;
        rentabilidadeGlobal = 0;
        totalEntriesToday = 0;
        totalWinsToday = 0;
        totalLossesToday = 0;
        lastTradeResult = null; // Reinicia o resultado do último trade
        // O estado inicial da gestão será definido ao clicar em "Iniciar Análise"
    }


    // Recalcular Margem de Risco, Valor por Ciclo, Meta de Lucro, Reserva
    // Estes dependem da Banca INICIAL e Modo de Operação, não mudam com os trades (a menos que a Banca Inicial seja alterada nas settings)
    let margemDeRiscoPercentage = 0;
    switch (currentUserSettings.modo_operacao) {
        case 'conservador': margemDeRiscoPercentage = 1; break;
        case 'equilibrado': margemDeRiscoPercentage = 3; break;
        case 'agressivo': margemDeRiscoPercentage = 12; break;
        case 'extremo': margemDeRiscoPercentage = 100; break;
        default: margemDeRiscoPercentage = 3;
    }
    const margemDeRiscoMultiplier = (currentUserSettings.modo_operacao === 'extremo') ? 1 : 3;
    const margemDeRisco = (margemDeRiscoPercentage / 100) * currentUserSettings.banca_inicial * margemDeRiscoMultiplier;
    valorPorCicloCalculado = margemDeRisco / 6; // Armazena na variável de estado
    const metaDeLucro = valorPorCicloCalculado * 1.25;
    const reservaCapital = rentabilidadeGlobal - metaDeLucro; // Reserva usa a rentabilidade REAL

    console.log('Métricas Calculadas (Com dados de Trades, se houver):', {
        margemDeRisco: margemDeRisco,
        valorPorCiclo: valorPorCicloCalculado,
        metaDeLucro: metaDeLucro,
        bancaAtual: bancaAtual, // Agora pode ser o valor real
        rentabilidadeGlobal: rentabilidadeGlobal, // Agora pode ser o valor real
        reservaCapital: reservaCapital // Agora usa rentabilidade real
    });


    // --- 3. Calcular o Próximo Valor Recomendado (baseado no estado e regras) ---
    // !! TODO: Implementar as regras de cálculo de valor que você descreveu !!
    // Esta lógica dependerá do estado atual (currentCycle, currentLevel, currentEntry) e lastTradeResult.
    // Se não houver trades (primeiro acesso), o próximo valor é a Entrada Inicial.
    // Se houver trades, calcule baseado no resultado do último trade e no estado atual derivado do último trade.

    let recommendedValue = 0;
    let statusText = "";
    let nextAction = "";

    // Lógica para determinar o Próximo Valor e Estado (simplificado para começar)
    if (totalEntriesToday === 0) { // Se não há trades hoje, é o início
        recommendedValue = valorPorCicloCalculado * 0.315; // Entrada Inicial
        currentEntryValue = recommendedValue; // Armazena na variável de estado
        currentCycle = 1; // Inicia o Ciclo 1
        currentLevel = 1; // Inicia o Nível 1
        currentEntry = 1; // Inicia a Entrada 1
        statusText = "Pronto para iniciar o Ciclo 1, Nível 1.";
        nextAction = "Analisar...";
        lastTradeResult = null; // Garante que o estado inicial não tem resultado anterior
        console.log("Estado Inicial: C1L1E1");

    } else {
        // !! TODO: Lógica REAL de cálculo do próximo valor e estado (cycle, level, entry)
        // baseada no lastTradeResult e no estado derivado do último trade.
        // Use as regras de valor de entrada (x2.17, x1.25, etc.) e as regras de avanço de nível/ciclo.
        // Esta é a parte mais complexa da sua lógica de gestão.
        console.log("Lógica para calcular próximo valor e estado baseada no último trade e regras.");
        // Exemplo PLACEHOLDER (precisa ser substituído pela sua lógica real):
        recommendedValue = 0; // Calcular valor real aqui
        currentEntryValue = recommendedValue; // Atualiza a variável de estado
        statusText = `Continuando no ${currentCycle} / ${currentLevel} / ${currentEntry}`; // Atualizar status real
        nextAction = "Analisar..."; // Pode mudar dependendo do estado (ex: "Aguardando...")
    }


    // --- 4. Atualizar a Interface do Usuário (dashboard.html) ---
    // Use os valores CALCULADOS (ou os placeholders/iniciais) para preencher a UI.

    const moedaSimbolo = currentUserSettings.moeda === 'BRL' ? 'R$' : currentUserSettings.moeda === 'USD' ? '$' : currentUserSettings.moeda === 'EUR' ? '€' : currentUserSettings.moeda;

    // Elementos de Métricas Globais (agora com dados reais dos trades, se houver)
    const bancaEl = document.getElementById('bancaAtual');
    if (bancaEl) bancaEl.textContent = `${moedaSimbolo} ${bancaAtual.toFixed(2)}`;

    const rentabilidadeEl = document.getElementById('rentabilidadeGlobal');
    if (rentabilidadeEl) {
        rentabilidadeEl.textContent = `${moedaSimbolo} ${rentabilidadeGlobal.toFixed(2)}`;
        rentabilidadeEl.classList.remove('positive', 'negative');
        rentabilidadeEl.classList.add(rentabilidadeGlobal >= 0 ? 'positive' : 'negative');
    }

    const metaLucroEl = document.getElementById('metaLucro');
    if (metaLucroEl) metaLucroEl.textContent = `${moedaSimbolo} ${metaDeLucro.toFixed(2)}`;

    const reservaCapitalEl = document.getElementById('reservaCapital');
    if (reservaCapitalEl) {
        reservaCapitalEl.textContent = `${moedaSimbolo} ${reservaCapital.toFixed(2)}`;
        reservaCapitalEl.classList.remove('positive', 'negative');
        reservaCapitalEl.classList.add(reservaCapital >= 0 ? 'positive' : 'negative');
    }

    // Elementos do Painel de Operação
    const nextActionEl = document.getElementById('nextAction');
    const recommendedValueEl = document.getElementById('recommendedValue');
    const statusTextEl = document.getElementById('statusText');
    const entriesTodayEl = document.getElementById('entriesToday');
    const winsTodayEl = document.getElementById('winsToday');
    const lossesTodayEl = document.getElementById('lossesToday');
    const currentPayoutEl = document.getElementById('currentPayout');


    // Atualizar Payout e Status/Ação
    if (currentPayoutEl) currentPayoutEl.textContent = `${currentUserSettings.payout_percent}%`;
    if (statusTextEl) statusTextEl.textContent = statusText;
    if (nextActionEl) nextActionEl.textContent = nextAction;

    // Atualizar Valor Recomendado (usando o valor calculado)
    if (recommendedValueEl) recommendedValueEl.textContent = `${moedaSimbolo} ${recommendedValue.toFixed(2)}`;

    // Atualizar contadores de trades do dia
    if (entriesTodayEl) entriesTodayEl.textContent = totalEntriesToday;
    if (winsTodayEl) winsTodayEl.textContent = totalWinsToday;
    if (lossesTodayEl) lossesTodayEl.textContent = totalLossesToday;

    // Lógica para o indicador de progresso (se existir na UI) também usaria essas métricas (Meta vs Rentabilidade)

    // !! TODO: ADICIONAR LISTENERS PARA OS BOTÕES WIN/LOSS/DRAW AQUI !!
    // Quando clicados, eles precisam:
    // 1. Obter o resultado do trade (WIN/LOSS/DRAW).
    // 2. Obter os dados do trade (par, valor de entrada - do painel, payout - das settings).
    // 3. Chamar a lógica de gestão para CALCULAR o lucro/prejuízo e determinar o PRÓXIMO cycle_step e recommendedValue.
    // 4. Salvar o trade COMPLETO (com todos os dados, including user_id, created_at, profit_loss, cycle_step, balance_after) na tabela 'trades' via supabaseClient.from('trades').insert({...}).
    // 5. Chamar updateOperationPanel() novamente para recarregar os dados dos trades, recalcular métricas e atualizar a UI com o próximo passo.
    // 6. Verificar condições de Stop Win / Stop Loss.
    // 7. Lógica de encerramento de Nível / Ciclo.

    // TODO: Lógica para carregar e exibir o histórico de trades em uma lista na UI (chamada aqui ou em função separada)
}
// --- FIM FUNÇÃO updateOperationPanel ---


document.addEventListener('DOMContentLoaded', async () => {

    // --- Lógica de Autenticação (AGORA COM SUPABASE) ---
    async function checkAuthAndRedirect() {
        const { data: { session } } = await supabaseClient.auth.getSession();
        const currentPath = window.location.pathname;

        console.log("Checking auth status. Session:", session);
        console.log("Current path:", currentPath);

        if (!session) {
            if (currentPath.includes('/dashboard.html')) {
                console.log("No session found, redirecting to index.html");
                window.location.href = 'index.html';
            }
        } else {
            const user = session.user;
            console.log("User logged in:", user.email);

            if (currentPath.includes('/index.html')) {
                 console.log("Session found, redirecting to dashboard.html");
                 window.location.href = 'dashboard.html';
            } else if (currentPath.includes('/dashboard.html')) {
                console.log("Usuário logado no Dashboard. Carregando dados...");

                // --- CHAMADA PARA CARREGAR SETTINGS ---
                // loadUserSettings agora atualiza a variável global currentUserSettings
                await loadUserSettings(user.id);

                // updateOperationPanel agora usa a variável global currentUserSettings
                // Ela será chamada APÓS tentarmos carregar as settings
                updateOperationPanel(); // Não passa mais userSettings como parâmetro

            }
        }
    }

    checkAuthAndRedirect();

    // --- Autenticação (Tabs) ---
    const tabButtons = document.querySelectorAll('.auth-tabs .tab-button');
    const authForms = document.querySelectorAll('.auth-form');
    if (tabButtons.length > 0 && authForms.length > 0) {
        tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                tabButtons.forEach(btn => btn.classList.remove('active'));
                authForms.forEach(form => form.classList.remove('active'));
                const targetTab = button.getAttribute('data-tab');
                button.classList.add('active');
                const targetForm = document.getElementById(targetTab);
                if (targetForm) {
                    targetForm.classList.add('active');
                } else {
                    console.error(`DEBUG: Target form with ID '${targetTab}' not found.`);
                }
            });
        });
        if (window.location.pathname.includes('/index.html')) {
            const loginForm = document.getElementById('login');
            if (loginForm) {
                loginForm.classList.add('active');
            } else {
                console.error("DEBUG: Login form with ID 'login' not found on index page.");
            }
            const loginTabButton = document.querySelector('.auth-tabs .tab-button[data-tab="login"]');
            if (loginTabButton) {
                loginTabButton.classList.add('active');
            }
        }
    } else {
        console.error("DEBUG: Tab buttons or auth forms not found in the DOM. Check HTML selectors.");
    }

    // --- Login (AGORA COM SUPABASE) ---
    const loginForm = document.querySelector('#login form');
    if (loginForm) {
        loginForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            const email = document.getElementById('login-email').value;
            const password = document.getElementById('login-password').value;
            const { data, error } = await supabaseClient.auth.signInWithPassword({ email: email, password: password });
            if (error) {
                console.error("Erro no login:", error);
                alert("Erro ao fazer login: " + error.message);
            } else {
                console.log("Login bem-sucedido:", data);
                window.location.href = 'dashboard.html';
            }
        });
    }

    // --- Cadastro (AGORA COM SUPABASE) ---
    const registerForm = document.querySelector('#register form');
    if (registerForm) {
        registerForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            const name = document.getElementById('register-name').value;
            const email = document.getElementById('register-email').value;
            const password = document.getElementById('register-password').value;
            const confirmPassword = document.getElementById('register-confirm-password').value;
            if (password !== confirmPassword) { alert("As senhas não coincidem!"); return; }
            const { data, error } = await supabaseClient.auth.signUp({ email: email, password: password, options: { data: { full_name: name } } });
            if (error) {
                console.error("Erro no cadastro:", error);
                alert("Erro ao cadastrar: " + error.message);
            } else {
                console.log("Cadastro bem-sucedido:", data);
                if (data.user) {
                    alert("Cadastro realizado com sucesso! Você já está logado.");
                    window.location.href = 'dashboard.html';
                } else {
                    alert("Cadastro realizado! Verifique seu e-mail para confirmar sua conta.");
                }
            }
        });
    }

    // --- Logout (AGORA COM SUPABASE) ---
    const logoutButton = document.getElementById('logout-button');
    if (logoutButton) {
        logoutButton.addEventListener('click', async (event) => {
            event.preventDefault();
            const { error } = await supabaseClient.auth.signOut();
            if (error) {
                console.error("Erro no logout:", error);
                alert("Erro ao sair: " + error.message);
            } else {
                console.log("Logout bem-sucedido.");
                window.location.href = 'index.html';
            }
        });
    }

    // --- Lógica Dinâmica (Página Inicial - MOCKAGEM) ---
    function loadInitialMetrics() {
        const bancaAtual = 5500.75; // Exemplo
        const rentabilidadeGlobal = 1250.30; // Exemplo
        const metaLucro = 150.00; // Exemplo
        const reservaCapital = rentabilidadeGlobal - metaLucro; // Exemplo
        const bancaEl = document.getElementById('bancaAtual');
        const rentabilidadeEl = document.getElementById('rentabilidadeGlobal');
        const metaLucroEl = document.getElementById('metaLucro');
        const reservaCapitalEl = document.getElementById('reservaCapital');
        const lastUpdateEl = document.getElementById('lastUpdate');
        if (bancaEl) bancaEl.textContent = bancaAtual.toFixed(2);
        if (rentabilidadeEl) { rentabilidadeEl.textContent = rentabilidadeGlobal.toFixed(2); rentabilidadeEl.classList.add(rentabilidadeGlobal >= 0 ? 'positive' : 'negative'); }
        if (metaLucroEl) metaLucroEl.textContent = metaLucro.toFixed(2);
        if (reservaCapitalEl) { reservaCapitalEl.textContent = reservaCapital.toFixed(2); reservaCapitalEl.classList.add(reservaCapital >= 0 ? 'positive' : 'negative'); }
        if (lastUpdateEl) { const now = new Date(); lastUpdateEl.textContent = now.toLocaleTimeString(); }
    }

    if (window.location.pathname.includes('/index.html') && document.getElementById('bancaAtual')) {
        loadInitialMetrics();
    }

    // --- Salvar Configurações (AGORA COM SUPABASE) ---
    const settingsForm = document.querySelector('.dashboard-sections form');
    if (settingsForm) {
        settingsForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            const { data: { session } } = await supabaseClient.auth.getSession();
            if (!session) { alert("Erro: Usuário não logado para salvar configurações."); return; }
            const userId = session.user.id;
            const bancaInicial = parseFloat(document.getElementById('bancaInicial').value);
            const payout = parseInt(document.getElementById('payout').value, 10);
            const modoOperacao = document.getElementById('modoOperacao').value;
            const moeda = document.getElementById('moedas').value;
            const exibirValores = document.getElementById('valores').value;
            if (isNaN(bancaInicial) || bancaInicial <= 0) { alert("Por favor, insira uma Banca Inicial válida."); return; }
            if (isNaN(payout) || payout <= 0 || payout > 100) { alert("Por favor, insira um Payout (%) válido entre 1 e 100."); return; }

            const { data, error } = await supabaseClient
                .from('settings')
                .upsert({ user_id: userId, banca_inicial: bancaInicial, payout_percent: payout, modo_operacao: modoOperacao, moeda: moeda, exibir_valores: exibirValores }, { onConflict: 'user_id' });

            if (error) {
                console.error("Erro ao salvar configurações:", error);
                alert("Erro ao salvar configurações: " + error.message);
            } else {
                console.log("Configurações salvas com sucesso:", data);
                alert("Configurações salvas!");
                // Recarrega as settings e atualiza o painel
                supabaseClient.auth.getUser().then(async ({ data: { user } }) => {
                    if (user) {
                        await loadUserSettings(user.id); // Atualiza currentUserSettings
                        updateOperationPanel(); // Atualiza o painel com as novas settings
                    }
                });
            }
        });
    }

    // --- Lógica do botão "Iniciar Análise" ---
    const startOperationButton = document.querySelector('.start-operation');
    if (startOperationButton) {
        startOperationButton.addEventListener('click', async () => { // Torna o listener async
            console.log("Botão 'Iniciar Análise' clicado.");

            if (!currentUserSettings) {
                alert("Por favor, salve suas configurações iniciais antes de começar.");
                console.log("Não é possível iniciar análise sem configurações.");
                return;
            }

            // !! TODO: Verificar se já existe uma operação em andamento para o usuário hoje
            // (Pode ser verificando o último trade do dia que ainda não tem resultado 'Win'/'Loss'/'Draw')
            // Se já houver, carregar o estado dessa operação em andamento em vez de iniciar uma nova.
            // Por enquanto, sempre iniciamos um novo ciclo/nível/entrada.

            // --- Lógica para iniciar o PRIMEIRO trade do dia/ciclo ---
            // Usa o Valor por Ciclo calculado em updateOperationPanel (armazenado em valorPorCicloCalculado)
            const firstEntryValue = valorPorCicloCalculado * 0.315; // Regra: 31.5% do Valor por Ciclo

            // Define o estado inicial da gestão
            currentCycle = 1;
            currentLevel = 1;
            currentEntry = 1;
            currentEntryValue = firstEntryValue; // Armazena o valor da entrada atual
            lastTradeResult = null; // Reseta o resultado do último trade ao iniciar

            console.log(`Iniciando: Ciclo ${currentCycle}, Nível ${currentLevel}, Entrada ${currentEntry}. Valor recomendado: ${currentEntryValue.toFixed(2)}`);

            // --- Atualizar UI com o estado inicial da operação ---
            const moedaSimbolo = currentUserSettings.moeda === 'BRL' ? 'R$' : currentUserSettings.moeda === 'USD' ? '$' : currentUserSettings.moeda === 'EUR' ? '€' : currentUserSettings.moeda;

            const nextActionEl = document.getElementById('nextAction');
            const recommendedValueEl = document.getElementById('recommendedValue');
            const statusTextEl = document.getElementById('statusText');

            if (nextActionEl) nextActionEl.textContent = "Analisando..."; // Ou "Pronto para operar"
            if (recommendedValueEl) recommendedValueEl.textContent = `${moedaSimbolo} ${currentEntryValue.toFixed(2)}`;
            if (statusTextEl) statusTextEl.textContent = `Ciclo ${currentCycle} / Nível ${currentLevel} / Entrada ${currentEntry}`;

            // !! TODO: Habilitar botões WIN/LOSS/DRAW e desabilitar "Iniciar Análise" !!
            // Isso indica que uma operação está em andamento e esperando o resultado.
            // Ex: document.getElementById('win-button').disabled = false;
            // Ex: startOperationButton.disabled = true;

            // !! TODO: Opcional: Salvar um registro inicial na tabela 'trades' para esta operação
            // antes mesmo de saber o resultado. Pode ser um registro com resultado 'Pending' ou null.
            // Isso ajudaria a carregar o estado em andamento se o usuário sair e voltar.
            // const { data, error } = await supabaseClient.from('trades').insert({...});
            // Lembre-se de incluir user_id, created_at, pair (se já souber), direction (se já souber), entry_value, cycle_step.
            // profit_loss e balance_after seriam atualizados DEPOIS que o resultado for conhecido.

        });
    }

    // --- TODO: Lógica dos botões WIN/LOSS/DRAW ---
    // Adicionar event listeners para os botões WIN, LOSS, DRAW.
    // Cada listener deve:
    // 1. Obter o resultado do clique ('Win', 'Loss', 'Draw').
    // 2. Obter os dados da operação atual (currentEntryValue, cycle_step atual, pair, direction, payout_percent).
    // 3. Calcular o profit_loss com base no resultado, currentEntryValue e currentUserSettings.payout_percent.
    // 4. Calcular o novo balance_after (Banca Atual + profit_loss).
    // 5. Salvar o trade COMPLETO na tabela 'trades' (user_id, created_at, pair, direction, entry_value, payout_percent, result, profit_loss, balance_after, cycle_step).
    // 6. Chamar a lógica de gestão para determinar o PRÓXIMO cycle_step e recommendedValue com base no resultado e regras.
    // 7. Chamar updateOperationPanel() para recarregar dados (métricas, contadores) e atualizar a UI com o próximo passo/valor.
    // 8. Verificar Stop Win/Stop Loss.
    // 9. Lógica de encerramento de Nível/Ciclo e início do próximo, ou fim do período.

    // --- TODO: Lógica para exibir Histórico de Trades ---
    // Criar uma função para buscar os trades do usuário na tabela 'trades' e popular uma lista na UI.
    // Esta função seria chamada ao carregar o dashboard e após cada novo trade ser salvo.

}); // Fim do DOMContentLoaded

// Nota: As variáveis de estado (currentCycle, currentLevel, etc.) e as funções loadUserSettings, updateOperationPanel
// são definidas no escopo do DOMContentLoaded listener. Isso significa que elas só são acessíveis DENTRO deste listener
// e de funções definidas DENTRO dele. Se você tiver botões ou outros elementos HTML que precisam chamar updateOperationPanel
// ou acessar as variáveis de estado DIRETAMENTE de um escopo global (o que não é o caso com os listeners definidos aqui),
// você precisaria mover essas variáveis e funções para fora do listener DOMContentLoaded.
// Para a estrutura atual, onde os listeners dos botões (que ainda serão criados) estarão DENTRO deste listener,
// a configuração atual das variáveis de estado e funções deve funcionar.
