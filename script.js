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
let currentBalance = 0; // Armazena o saldo atual da banca (será carregado dos trades)
let currentTradeId = null; // Armazena o ID do trade atual se ele for salvo como 'Pending' antes do resultado

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

// --- FUNÇÃO: Salvar um Trade na Tabela 'trades' ---
// Esta função agora pode INSERIR um novo trade ou ATUALIZAR um trade existente (se currentTradeId estiver definido)
async function saveTrade(tradeData) {
    console.log('Attempting to save trade:', tradeData);

    let query = supabaseClient.from('trades');

    if (currentTradeId) {
        // Se já temos um ID de trade (salvo como 'Pending'), vamos ATUALIZAR esse registro
        console.log('Updating existing trade with ID:', currentTradeId);
        query = query.update(tradeData).eq('id', currentTradeId);
    } else {
        // Se não temos um ID, vamos INSERIR um novo registro
        console.log('Inserting new trade record.');
        query = query.insert([tradeData]);
    }

    const { data, error } = await query;

    if (error) {
        console.error('Erro ao salvar trade:', error);
        // TODO: Adicionar tratamento de erro na UI
        return false; // Indica falha
    } else {
        console.log('Trade salvo com sucesso:', data);
        // Se foi uma inserção, armazena o ID do novo trade (útil se quiser salvar 'Pending' primeiro)
        if (!currentTradeId && data && data.length > 0) {
             currentTradeId = data[0].id; // Armazena o ID do trade recém-criado
             console.log('New trade ID assigned:', currentTradeId);
        }
        return true; // Indica sucesso
    }
}
// --- FIM FUNÇÃO saveTrade ---


// --- FUNÇÃO: Habilitar/Desabilitar Botões de Operação ---
function toggleOperationButtons(enableResults) {
    const startOperationButton = document.querySelector('.start-operation');
    const winButton = document.getElementById('win-button'); // TODO: Adicionar IDs no HTML
    const lossButton = document.getElementById('loss-button'); // TODO: Adicionar IDs no HTML
    const drawButton = document.getElementById('draw-button'); // TODO: Adicionar IDs no HTML (se aplicável)

    if (startOperationButton) startOperationButton.disabled = enableResults; // Desabilita se resultados estão habilitados
    if (winButton) winButton.disabled = !enableResults; // Habilita se enableResults é true
    if (lossButton) lossButton.disabled = !enableResults; // Habilita se enableResults é true
    if (drawButton) drawButton.disabled = !enableResults; // Habilita se enableResults é true
}
// --- FIM FUNÇÃO toggleOperationButtons ---


// --- FUNÇÃO: Função para calcular e atualizar as métricas e o painel de operação ---
// Esta função agora usa a variável global currentUserSettings e busca dados REAIS dos trades
async function updateOperationPanel() {
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

        // Desabilitar botões de operação se não há settings
        toggleOperationButtons(false); // Desabilita botões de resultado, habilita Iniciar Análise

        return; // Sai da função se não há settings
    }

    // Se as configurações existem, garantir que o painel está visível e a mensagem oculta
    const operationPanel = document.querySelector('.operation-panel');
    const settingsMessage = document.getElementById('settings-required-message');
    if (operationPanel) operationPanel.style.display = 'block';
    if (settingsMessage) settingsMessage.style.display = 'none';


    // --- 2. Carregar Dados REAIS dos Trades do Usuário ---
    // Busca todos os trades do usuário, ordenados do mais recente para o mais antigo
    const { data: trades, error: tradesError } = await supabaseClient
        .from('trades')
        .select('id, profit_loss, balance_after, created_at, result, cycle_step, entry_value') // Incluído 'id' e 'entry_value'
        .eq('user_id', currentUserSettings.user_id)
        .order('created_at', { ascending: false }); // Ordena para pegar o último trade facilmente

    if (tradesError) {
        console.error('Erro ao buscar trades para métricas e estado:', tradesError);
        // TODO: Tratar erro na UI
        // Continuar com valores iniciais/fallback se houver erro na busca de trades
        currentBalance = currentUserSettings.banca_inicial;
        rentabilidadeGlobal = 0;
        totalEntriesToday = 0;
        totalWinsToday = 0;
        totalLossesToday = 0;
        lastTradeResult = null;
        currentCycle = 0; currentLevel = 0; currentEntry = 0; // Resetar estado da gestão
        currentEntryValue = 0;
        currentTradeId = null; // Reseta ID do trade atual
        // A UI será atualizada com estes fallbacks.
    } else {
        // --- Calcular Métricas Globais com dados de Trades ---
        if (trades && trades.length > 0) {
            // Calcular Banca Atual (saldo do último trade)
            currentBalance = trades[0].balance_after; // Atualiza a variável de estado global

            // Calcular Rentabilidade Global (soma dos profit_loss)
            rentabilidadeGlobal = trades.reduce((sum, trade) => sum + trade.profit_loss, 0);

            // Calcular Entradas, Wins, Losses do dia atual
            const today = new Date();
            today.setHours(0, 0, 0, 0); // Define para o início do dia

            const tradesToday = trades.filter(trade => new Date(trade.created_at) >= today);
            totalEntriesToday = tradesToday.length;
            totalWinsToday = tradesToday.filter(trade => trade.result === 'Win').length;
            totalLossesToday = tradesToday.filter(trade => trade.result === 'Loss').length;

            // --- Determinar o ESTADO ATUAL da Gestão com dados de Trades ---
            // Baseado no ÚLTIMO trade registrado
            const lastTrade = trades[0];
            lastTradeResult = lastTrade.result; // Atualiza a variável de estado global
            currentTradeId = lastTrade.id; // Armazena o ID do último trade (útil se ele estiver 'Pending')

            // !! TODO: Lógica para parsear lastTrade.cycle_step (ex: "C1L2E3") para atualizar
            // as variáveis de estado globais: currentCycle, currentLevel, currentEntry
            // Ex: Se lastTrade.cycle_step for "C1L2E3", então currentCycle=1, currentLevel=2, currentEntry=3
            // Você pode precisar criar uma função auxiliar para isso.
            console.log("Último trade encontrado:", lastTrade);
            console.log("Resultado do último trade:", lastTradeResult);
            console.log("Último cycle_step:", lastTrade.cycle_step);
            console.log("ID do último trade:", currentTradeId);
            // Exemplo BEM SIMPLIFICADO (substituir pela lógica real de parse):
            if (lastTrade.cycle_step) {
                 const parts = lastTrade.cycle_step.match(/C(\d+)L(\d+)E(\d+)/);
                 if (parts) {
                     currentCycle = parseInt(parts[1], 10);
                     currentLevel = parseInt(parts[2], 10);
                     currentEntry = parseInt(parts[3], 10);
                 }
            }
            currentEntryValue = lastTrade.entry_value; // Armazena o valor da última entrada como o valor ATUAL para o próximo cálculo

            // !! TODO: Verificar se o ÚLTIMO trade está 'Pending' ou sem resultado
            // Se estiver, significa que há uma operação em andamento.
            // Manter botões de resultado habilitados e Iniciar Análise desabilitado.
            // Se o último trade tiver resultado (Win/Loss/Draw), a operação anterior foi concluída.
            // A lógica de cálculo do próximo passo abaixo determinará o que fazer (continuar ou iniciar novo ciclo).
            const isOperationPending = (lastTrade.result === null || lastTrade.result === 'Pending'); // Assumindo que você pode salvar 'Pending'
            if (isOperationPending) {
                 toggleOperationButtons(true); // Habilita botões de resultado
                 console.log("Operação em andamento detectada. Botões de resultado habilitados.");
            } else {
                 // A operação anterior foi concluída. A lógica abaixo determinará o próximo estado.
                 // Os botões serão atualizados depois que o próximo estado for calculado.
                 console.log("Última operação concluída.");
            }


        } else {
            // Se não há trades, a banca atual é a inicial e a rentabilidade é 0.
            // O estado inicial da gestão é o começo (C1L1E0 ou similar).
            currentBalance = currentUserSettings.banca_inicial; // Atualiza a variável de estado global
            rentabilidadeGlobal = 0;
            totalEntriesToday = 0;
            totalWinsToday = 0;
            totalLossesToday = 0;
            lastTradeResult = null; // Reinicia o resultado do último trade
            currentCycle = 0; currentLevel = 0; currentEntry = 0; // Reseta estado da gestão
            currentEntryValue = 0;
            currentTradeId = null; // Reseta ID do trade atual

            // Se não há trades, a operação não foi iniciada.
            toggleOperationButtons(false); // Desabilita botões de resultado, habilita Iniciar Análise
            console.log("Nenhum trade encontrado. Botão 'Iniciar Análise' habilitado.");
        }
    }


    // --- 3. Recalcular Métricas Baseadas nas Settings (estas não mudam com trades) ---
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
        bancaAtual: currentBalance, // Agora é o valor real
        rentabilidadeGlobal: rentabilidadeGlobal, // Agora é o valor real
        reservaCapital: reservaCapital // Agora usa rentabilidade real
    });


    // --- 4. Calcular o Próximo Valor Recomendado e Estado (baseado no estado e regras) ---
    // Esta lógica dependerá do estado atual (currentCycle, currentLevel, currentEntry) e lastTradeResult.
    // Se não houver trades (primeiro acesso) OU se o último trade encerrou um ciclo/período,
    // o próximo valor é a Entrada Inicial do novo ciclo.
    // Se houver trades E a gestão não encerrou, calcule baseado no resultado do último trade e no estado atual.

    let recommendedValue = 0;
    let statusText = "";
    let nextAction = "";

    // !! TODO: Lógica REAL de cálculo do próximo valor e estado (cycle, level, entry)
    // baseada no lastTradeResult e no estado derivado do último trade.
    // Use as regras de valor de entrada (x2.17, x1.25, etc.) e as regras de avanço de nível/ciclo.
    // Esta é a parte mais complexa da sua lógica de gestão.

    // Exemplo: Se não há trades OU se o último trade encerrou um ciclo/período:
    // TODO: Adicionar a condição REAL de encerramento de ciclo/período aqui
    const hasNoTrades = (trades === null || trades.length === 0);
    const lastTradeEndedCycle = false; // TODO: Implementar lógica para verificar se o último trade encerrou um ciclo

    if (hasNoTrades || lastTradeEndedCycle) {
         recommendedValue = valorPorCicloCalculado * 0.315; // Entrada Inicial
         currentEntryValue = recommendedValue; // Armazena na variável de estado
         currentCycle = 1; // Inicia o Ciclo 1
         currentLevel = 1; // Inicia o Nível 1
         currentEntry = 1; // Inicia a Entrada 1
         statusText = "Pronto para iniciar o Ciclo 1, Nível 1.";
         nextAction = "Analisar...";
         lastTradeResult = null; // Reseta o resultado do último trade
         currentTradeId = null; // Reseta o ID do trade atual ao iniciar um novo ciclo
         console.log("Estado Definido: C1L1E1 (Início)");

         // Habilitar botão Iniciar Análise, desabilitar botões de resultado
         toggleOperationButtons(false);

    } else {
        // !! TODO: Implementar lógica para calcular recommendedValue, nextAction, statusText e atualizar
        // currentCycle, currentLevel, currentEntry, currentEntryValue
        // baseada no lastTradeResult e nas suas regras de gestão.
        // Use as regras de valor de entrada (x2.17, x1.25, etc.) e as regras de avanço de nível/ciclo.
        // Lembre-se que currentCycle, currentLevel, currentEntry e lastTradeResult já foram atualizados
        // com base no último trade buscado no início desta função.

        console.log("Calculando próximo valor e estado com base nas regras e último resultado.");

        // Exemplo PLACEHOLDER (precisa ser substituído pela sua lógica real):
        // if (lastTradeResult === 'Win') {
        //     // Lógica para WIN (avançar entrada/nível ou encerrar nível)
        //     // Verificar se 2 Wins no nível -> encerrar nível, ir para próximo nível ou ciclo
        //     nextRecommendedValue = currentEntryValue * 1.25; // Exemplo da regra
        //     nextEntry++; // Exemplo: avança entrada
        //     // TODO: Lógica para avançar nível (nextLevel) ou ciclo (nextCycle) se necessário
        // } else if (lastTradeResult === 'Loss') {
        //     // Lógica para LOSS (Martingale ou avançar nível/ciclo)
        //     // Verificar 2 Losses consecutivos no ciclo -> encerrar ciclo
        //     nextRecommendedValue = currentEntryValue * 2.17; // Exemplo da regra
        //     nextEntry++; // Exemplo: avança entrada
        //     // TODO: Lógica para avançar nível (nextLevel) ou ciclo (nextCycle) se necessário
        // } else { // Draw
        //    // Lógica para DRAW
        //    nextRecommendedValue = currentEntryValue; // Mantém o valor
        //    nextEntry++; // Exemplo: avança entrada (ou não, dependendo da regra DRAW)
        // }

        // !! TODO: Lógica de encerramento de Nível/Ciclo e início do próximo, ou fim do período !!
        // Se o resultado do trade anterior (lastTradeResult) encerrou um nível ou ciclo,
        // ajuste currentCycle, currentLevel, currentEntry e currentEntryValue para o início do próximo passo.

         // PLACEHOLDERS - SUBSTITUIR PELA LÓGICA REAL
         recommendedValue = currentEntryValue; // <-- Substituir pelo cálculo real
         statusText = `Continuando no C${currentCycle} / L${currentLevel} / E${currentEntry}`; // <-- Atualizar status real
         nextAction = "Analisar..."; // <-- Pode mudar

         // !! TODO: Lógica para verificar Stop Win / Stop Loss APÓS calcular o próximo passo !!
         // Se rentabilidadeGlobal >= metaDeLucro (Stop Win) ou se atingiu condição de Stop Loss (ex: 2 losses consecutivos no ciclo)
         // Mostrar mensagem de Stop, desabilitar botões de operação, habilitar botão de "Iniciar Novo Período" (se aplicável).
         const stopWinReached = (rentabilidadeGlobal >= metaDeLucro);
         const stopLossReached = false; // TODO: Implementar lógica para verificar Stop Loss

         if (stopWinReached) {
             statusText = "STOP WIN ATINGIDO!";
             nextAction = "Fim do Período"; // Ou "Iniciar Novo Período"
             recommendedValue = 0; // Não há valor recomendado após Stop
             toggleOperationButtons(false); // Desabilita botões de resultado
             const startOperationButton = document.querySelector('.start-operation');
             if (startOperationButton) startOperationButton.disabled = false; // Habilita Iniciar Análise (se for para iniciar novo período)
             console.log("STOP WIN ATINGIDO!");
         } else if (stopLossReached) {
             statusText = "STOP LOSS ATINGIDO!";
             nextAction = "Fim do Período"; // Ou "Iniciar Novo Período"
             recommendedValue = 0; // Não há valor recomendado após Stop
             toggleOperationButtons(false); // Desabilita botões de resultado
             const startOperationButton = document.querySelector('.start-operation');
             if (startOperationButton) startOperationButton.disabled = false; // Habilita Iniciar Análise (se for para iniciar novo período)
             console.log("STOP LOSS ATINGIDO!");
         } else {
             // Se não atingiu Stop, e a operação não está pendente, manter botões de resultado habilitados
             // A menos que a lógica do próximo passo indique encerramento de nível/ciclo que exija ação do usuário.
             // Por enquanto, se não atingiu Stop e não é início, mantém botões de resultado habilitados.
              const isOperationPending = (lastTradeResult === null || lastTradeResult === 'Pending'); // Verificar se o trade anterior estava pendente
              if (!isOperationPending) { // Se o trade anterior teve resultado, a operação continua
                   toggleOperationButtons(true); // Habilita botões de resultado para o próximo trade
              }
         }


    }


    // --- 5. Atualizar a Interface do Usuário (dashboard.html) ---
    const moedaSimbolo = currentUserSettings.moeda === 'BRL' ? 'R$' : currentUserSettings.moeda === 'USD' ? '$' : currentUserSettings.moeda === 'EUR' ? '€' : currentUserSettings.moeda;

    // Elementos de Métricas Globais (agora com dados reais dos trades)
    const bancaEl = document.getElementById('bancaAtual');
    if (bancaEl) bancaEl.textContent = `${moedaSimbolo} ${currentBalance.toFixed(2)}`; // Usando currentBalance (real)

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
    if (statusTextEl) statusTextEl.textContent = statusText; // Usando statusText calculado
    if (nextActionEl) nextActionEl.textContent = nextAction; // Usando nextAction calculado

    // Atualizar Valor Recomendado (usando o valor calculado)
    if (recommendedValueEl) recommendedValueEl.textContent = `${moedaSimbolo} ${recommendedValue.toFixed(2)}`;

    // Atualizar contadores de trades do dia
    if (entriesTodayEl) entriesTodayEl.textContent = totalEntriesToday;
    if (winsTodayEl) winsTodayEl.textContent = totalWinsToday;
    if (lossesTodayEl) lossesTodayEl.textContent = totalLossesToday;

    // Lógica para o indicador de progresso (se existir na UI) também usaria essas métricas (Meta vs Rentabilidade)


    // TODO: Lógica para carregar e exibir o histórico de trades em uma lista na UI (chamada aqui ou em função separada)
}
// --- FIM FUNÇÃO updateOperationPanel ---


// --- FUNÇÃO: Processar o Resultado de um Trade ---
async function processTradeResult(result) {
    console.log(`Processando resultado: ${result}`);

    if (!currentUserSettings || currentEntryValue <= 0 || currentCycle === 0) {
        console.error("Não é possível processar trade: Configurações ausentes ou operação não iniciada.");
        alert("Erro: Não foi possível processar o trade. Verifique as configurações e inicie a análise.");
        // Desabilitar botões de resultado e reabilitar "Iniciar Análise" em caso de erro grave
        toggleOperationButtons(false);
        return;
    }

    const userId = currentUserSettings.user_id;
    const payoutPercent = currentUserSettings.payout_percent;
    const entryValue = currentEntryValue; // Valor que foi usado nesta entrada
    const currentCycleStep = `C${currentCycle}L${currentLevel}E${currentEntry}`; // Passo da gestão atual ANTES de avançar

    // !! TODO: Obter o Par e a Direção (Higher/Lower) da UI se o usuário os seleciona !!
    const tradePair = "Par Exemplo"; // <-- Substituir por valor real da UI
    const tradeDirection = "Direção Exemplo"; // <-- Substituir por valor real da UI


    // --- 1. Calcular Lucro/Prejuízo ---
    let profitLoss = 0;
    if (result === 'Win') {
        // Lucro = Valor de Entrada * (Payout / 100)
        profitLoss = entryValue * (payoutPercent / 100);
    } else if (result === 'Loss') {
        // Prejuízo = -Valor de Entrada
        profitLoss = -entryValue;
    } else { // Draw
        // Draw = 0 Lucro/Prejuízo
        profitLoss = 0;
    }
    console.log(`Trade: ${result}, Valor: ${entryValue.toFixed(2)}, Payout: ${payoutPercent}%, Profit/Loss: ${profitLoss.toFixed(2)}`);


    // --- 2. Calcular Novo Saldo da Banca ---
    // Precisamos do saldo ATUAL antes de adicionar o profit/loss.
    // A variável global currentBalance já deve ter sido atualizada pela última chamada de updateOperationPanel.
    const newBalanceAfter = currentBalance + profitLoss;
    console.log(`Saldo Anterior: ${currentBalance.toFixed(2)}, Profit/Loss: ${profitLoss.toFixed(2)}, Novo Saldo: ${newBalanceAfter.toFixed(2)}`);

    // Atualiza a variável de estado global do saldo
    // currentBalance = newBalanceAfter; // Esta atualização será feita DENTRO de updateOperationPanel ao recarregar os trades


    // --- 3. Preparar Dados para Salvar o Trade ---
    const tradeDataToSave = {
        user_id: userId,
        // created_at: será gerado automaticamente pelo BD com now()
        pair: tradePair, // <-- Usar valor real da UI
        direction: tradeDirection, // <-- Usar valor real da UI
        entry_value: entryValue,
        payout_percent: payoutPercent,
        result: result, // 'Win', 'Loss', ou 'Draw'
        profit_loss: profitLoss,
        balance_after: newBalanceAfter, // Salva o saldo após este trade
        cycle_step: currentCycleStep // Ex: "C1L1E1"
    };
    console.log("Dados do trade para salvar:", tradeDataToSave);


    // --- 4. Salvar o Trade no Supabase ---
    // Se currentTradeId estiver definido (trade 'Pending'), saveTrade vai atualizar.
    // Se não, saveTrade vai inserir e definir currentTradeId (se quisermos salvar 'Pending' primeiro).
    // Como estamos salvando o trade COMPLETO com resultado aqui, currentTradeId provavelmente será null
    // e saveTrade fará uma INSERÇÃO.
    const saveSuccess = await saveTrade(tradeDataToSave);

    if (!saveSuccess) {
        // Se falhou ao salvar, alertar o usuário e NÃO avançar na lógica de gestão.
        console.error("Falha ao salvar o trade. A lógica de gestão não avançará.");
        alert("Erro ao registrar o trade. Por favor, tente novamente.");
        // Manter botões de resultado habilitados para que o usuário possa tentar novamente ou corrigir.
        // TODO: Adicionar um estado de erro na UI
        return; // Para a execução se falhou ao salvar
    }

    // --- 5. Lógica de Gestão: Calcular o Próximo Passo e Valor ---
    // !! TODO: Implementar as regras de cálculo do PRÓXIMO valor e determinação do PRÓXIMO cycle_step
    // baseada no 'result' deste trade, no 'currentCycleStep' (antes de avançar), e nas suas regras de gestão.
    // Esta é a parte mais complexa que você descreveu (regras de x2.17, x1.25, avanço de nível/ciclo, encerramento).
    console.log("Calculando próximo passo da gestão...");

    let nextCycle = currentCycle;
    let nextLevel = currentLevel;
    let nextEntry = currentEntry; // Começa igual ao atual, será incrementado/resetado pela lógica
    let nextRecommendedValue = 0;

    // !! TODO: Substituir esta lógica placeholder pelas suas regras reais !!
    // Use as variáveis globais currentCycle, currentLevel, currentEntry (o estado ANTES deste trade)
    // e o 'result' deste trade para calcular o PRÓXIMO estado (nextCycle, nextLevel, nextEntry)
    // e o PRÓXIMO valor recomendado (nextRecommendedValue).

    // Exemplo da lógica de avanço de entrada:
    nextEntry = currentEntry + 1; // Avança para a próxima entrada por padrão

    // Exemplo da lógica de cálculo de valor baseado no resultado:
    // if (result === 'Win') {
    //     // Lógica para WIN (avançar entrada/nível ou encerrar nível)
    //     // Verificar se 2 Wins no nível -> encerrar nível, ir para próximo nível ou ciclo
    //     nextRecommendedValue = entryValue * 1.25; // Exemplo da regra
    // } else if (result === 'Loss') {
    //     // Lógica para LOSS (Martingale ou avançar nível/ciclo)
    //     // Verificar 2 Losses consecutivos no ciclo -> encerrar ciclo
    //     nextRecommendedValue = entryValue * 2.17; // Exemplo da regra
    // } else { // Draw
    //    // Lógica para DRAW
    //    nextRecommendedValue = entryValue; // Mantém o valor
    // }

    // !! TODO: Lógica de encerramento de Nível/Ciclo e início do próximo, ou fim do período !!
    // Se o resultado deste trade encerrou um nível ou ciclo, ajuste nextCycle, nextLevel, nextEntry
    // e recalcule nextRecommendedValue de acordo com as regras de avanço (fórmulas de Nível 2/3 ou início de novo ciclo).


    // --- 6. Atualizar Variáveis de Estado Globais para o Próximo Passo ---
    currentCycle = nextCycle;
    currentLevel = nextLevel;
    currentEntry = nextEntry;
    currentEntryValue = nextRecommendedValue; // O valor recomendado para a PRÓXIMA operação
    lastTradeResult = result; // Armazena o resultado deste trade para o PRÓXIMO cálculo
    currentTradeId = null; // Reseta o ID do trade atual, pois este trade foi concluído


    // --- 7. Chamar updateOperationPanel para Recarregar Dados e Atualizar UI ---
    // Isso buscará os trades novamente (incluindo o que acabamos de salvar),
    // recalculará as métricas globais (Banca, Rentabilidade, Contadores),
    // e atualizará o painel com o novo estado e valor calculados.
    await updateOperationPanel();

    // !! TODO: Lógica para verificar Stop Win / Stop Loss APÓS calcular o próximo passo !!
    // updateOperationPanel já faz uma verificação básica de Stop Win/Loss e habilita/desabilita botões.
    // Você pode precisar refinar essa lógica em updateOperationPanel ou adicionar verificações adicionais aqui.


    console.log(`Próximo passo calculado: C${currentCycle} L${currentLevel} E${currentEntry}. Próximo Valor: ${currentEntryValue.toFixed(2)}`);

}
// --- FIM FUNÇÃO processTradeResult ---


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

                // --- CHAMADA PARA CARREGAR SETTINGS E ATUALIZAR PAINEL ---
                await loadUserSettings(user.id); // Carrega settings e atualiza currentUserSettings
                updateOperationPanel(); // Atualiza o painel (buscará trades e calculará métricas/estado)

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
            // updateOperationPanel já faz essa verificação ao carregar.
            // Se updateOperationPanel habilitou os botões de resultado, não devemos iniciar uma nova análise.
            // Podemos verificar o estado dos botões de resultado ou uma flag interna.

            // Uma maneira mais robusta: verificar o estado interno da gestão ou o último trade
            // Se currentCycle > 0 e o último trade não encerrou um ciclo, a operação já está em andamento.
            // TODO: Refinar esta verificação para ser mais precisa com base no estado da gestão.
            const { data: latestTrades, error: latestTradesError } = await supabaseClient
                 .from('trades')
                 .select('result')
                 .eq('user_id', currentUserSettings.user_id)
                 .order('created_at', { ascending: false })
                 .limit(1);

            let isOperationAlreadyStarted = false;
            if (latestTrades && latestTrades.length > 0) {
                 const lastResult = latestTrades[0].result;
                 // Consideramos em andamento se o último trade não teve resultado final (Win/Loss/Draw)
                 // ou se ele teve resultado mas NÃO encerrou um ciclo/período.
                 // TODO: Adicionar lógica para verificar se o lastResult encerrou um ciclo/período
                 const lastTradeEndedCycle = false; // Placeholder
                 if (lastResult === null || lastResult === 'Pending' || !lastTradeEndedCycle) {
                      isOperationAlreadyStarted = true;
                 }
            }


            if (isOperationAlreadyStarted) {
                 alert("Já existe uma operação em andamento. Conclua o trade atual ou reinicie o período.");
                 console.log("Operação já em andamento. Não iniciando nova análise.");
                 // Garantir que os botões corretos estão habilitados/desabilitados
                 toggleOperationButtons(true); // Habilita botões de resultado
                 return;
            }


            // --- Lógica para iniciar o PRIMEIRO trade do dia/ciclo ---
            // Usa o Valor por Ciclo calculado em updateOperationPanel (armazenado em valorPorCicloCalculado)
            const firstEntryValue = valorPorCicloCalculado * 0.315; // Regra: 31.5% do Valor por Ciclo

            // Define o estado inicial da gestão
            currentCycle = 1;
            currentLevel = 1;
            currentEntry = 1;
            currentEntryValue = firstEntryValue; // Armazena o valor da entrada atual para a próxima operação
            lastTradeResult = null; // Reseta o resultado do último trade ao iniciar um novo período/ciclo
            currentTradeId = null; // Reseta o ID do trade atual

            console.log(`Iniciando: Ciclo ${currentCycle}, Nível ${currentLevel}, Entrada ${currentEntry}. Valor recomendado: ${currentEntryValue.toFixed(2)}`);

            // --- Atualizar UI com o estado inicial da operação ---
            const moedaSimbolo = currentUserSettings.moeda === 'BRL' ? 'R$' : currentUserSettings.moeda === 'USD' ? '$' : currentUserSettings.moeda === 'EUR' ? '€' : currentUserSettings.moeda;

            const nextActionEl = document.getElementById('nextAction');
            const recommendedValueEl = document.getElementById('recommendedValue');
            const statusTextEl = document.getElementById('statusText');

            if (nextActionEl) nextActionEl.textContent = "Analisando..."; // Ou "Pronto para operar"
            if (recommendedValueEl) recommendedValueEl.textContent = `${moedaSimbolo} ${currentEntryValue.toFixed(2)}`;
            if (statusTextEl) statusTextEl.textContent = `C${currentCycle} / L${currentLevel} / E${currentEntry}`; // Formato C1/L1/E1

            // Habilitar botões WIN/LOSS/DRAW e desabilitar "Iniciar Análise"
            toggleOperationButtons(true);

            // !! TODO: Opcional: Salvar um registro inicial na tabela 'trades' para esta operação
            // antes mesmo de saber o resultado. Pode ser um registro com resultado 'Pending' ou null.
            // Isso ajudaria a carregar o estado em andamento se o usuário sair e voltar.
            // Se você optar por salvar 'Pending', precisará capturar o ID retornado pela inserção
            // e armazená-lo em currentTradeId para poder ATUALIZAR o registro depois com o resultado.
            // Exemplo (se decidir salvar 'Pending'):
            // const pendingTradeData = {
            //     user_id: currentUserSettings.user_id,
            //     pair: "Aguardando", // ou um valor padrão
            //     direction: "Aguardando", // ou um valor padrão
            //     entry_value: currentEntryValue,
            //     payout_percent: currentUserSettings.payout_percent,
            //     result: 'Pending', // ou null
            //     balance_after: currentBalance, // Saldo ANTES desta operação
            //     cycle_step: `C${currentCycle}L${currentLevel}E${currentEntry}`
            // };
            // const { data: newTrade, error: newTradeError } = await supabaseClient.from('trades').insert([pendingTradeData]).select('id'); // Usar .select('id') para pegar o ID
            // if (newTradeError) {
            //      console.error("Erro ao salvar trade pendente:", newTradeError);
            //      alert("Erro ao iniciar operação. Não foi possível salvar o trade inicial.");
            //      // TODO: Lidar com falha (desabilitar botões de resultado, reabilitar Iniciar Análise)
            //      toggleOperationButtons(false); // Desabilita botões de resultado
            //      return; // Interrompe o processo
            // }
            // if (newTrade && newTrade.length > 0) {
            //     currentTradeId = newTrade[0].id; // Armazena o ID do trade pendente
            //     console.log("Trade pendente salvo com ID:", currentTradeId);
            // }
        });
    }

    // --- Lógica dos botões WIN/LOSS/DRAW ---
    // TODO: Adicionar IDs aos botões WIN/LOSS/DRAW no HTML se ainda não tiver
    const winButton = document.getElementById('win-button');
    const lossButton = document.getElementById('loss-button');
    const drawButton = document.getElementById('draw-button'); // Se tiver botão de DRAW

    // Adicionar event listener para o botão WIN
    if (winButton) {
        winButton.addEventListener('click', async () => {
            console.log("Botão WIN clicado.");
            // Chamar a função para processar o resultado do trade
            await processTradeResult('Win');
        });
    }

    // Adicionar event listener para o botão LOSS
    if (lossButton) {
        lossButton.addEventListener('click', async () => {
            console.log("Botão LOSS clicado.");
            // Chamar a função para processar o resultado do trade
            await processTradeResult('Loss');
        });
    }

    // Adicionar event listener para o botão DRAW (se aplicável)
    if (drawButton) {
        drawButton.addEventListener('click', async () => {
            console.log("Botão DRAW clicado.");
            // Chamar a função para processar o resultado do trade
            await processTradeResult('Draw');
        });
    }


    // --- TODO: Lógica para exibir Histórico de Trades ---
    // Criar uma função para buscar os trades do usuário na tabela 'trades' e popular uma lista na UI.
    // Esta função seria chamada ao carregar o dashboard e após cada novo trade ser salvo.

}); // Fim do DOMContentLoaded

// Nota: As variáveis de estado e as funções loadUserSettings, saveTrade, toggleOperationButtons, updateOperationPanel, processTradeResult
// são definidas no escopo do DOMContentLoaded listener. Isso significa que elas só são acessíveis DENTRO deste listener
// e de funções definidas DENTRO dele. Para a estrutura atual, onde os listeners dos botões (WIN/LOSS/DRAW) estão DENTRO
// deste listener, a configuração atual das variáveis de estado e funções deve funcionar.
