// Substitua pelos seus dados do projeto Supabase
const SUPABASE_URL = 'https://vlxuudjpxlnihyvxchmp.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZseHV1ZGpweGxuaWh5dnhjaG1wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDY4ODM1NzAsImV4cCI6MjA2MjQ1OTU3MH0.p2aSzw1i3S9MqSFgsOvQpwz2_TbH4LSwF87WodGZB0M';

// Use um nome diferente para a instância do cliente para evitar conflito com a variável global 'supabase' da SDK
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// --- VARIÁVEIS DE ESTADO DA GESTÃO ---
// Declaradas fora das funções principais para serem acessíveis globalmente dentro do DOMContentLoaded
let currentUserSettings = null; // Armazena as configurações do usuário logado
let currentCycle = 0; // Ciclo atual (começa em 1)
let currentLevel = 0; // Nível atual (começa em 1)
let currentEntry = 0; // Número da entrada atual dentro do nível (começa em 1)
let lastTradeResult = null; // Resultado do último trade ('Win', 'Loss', 'Draw', null)
let currentEntryValue = 0; // Valor da entrada atual (o que será recomendado para a próxima operação)
let valorPorCicloCalculado = 0; // Armazena o Valor por Ciclo calculado das settings
let currentBalance = 0; // Armazena o saldo atual da banca (será carregado dos trades)
let currentTradeId = null; // Armazena o ID do trade atual se ele for salvo como 'Pending' antes do resultado
let lastEntryValueUsed = 0; // Armazena o valor da última entrada que foi *realmente* usada

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

    // Certifica-se de que o user_id está incluído nos dados a serem salvos
    if (!tradeData.user_id && currentUserSettings && currentUserSettings.user_id) {
        tradeData.user_id = currentUserSettings.user_id;
    } else if (!tradeData.user_id) {
         console.error("Erro: user_id não disponível para salvar o trade.");
         return false;
    }


    if (currentTradeId) {
        // Se já temos um ID de trade (salvo como 'Pending'), vamos ATUALIZAR esse registro
        console.log('Updating existing trade with ID:', currentTradeId);
        query = query.update(tradeData).eq('id', currentTradeId);
    } else {
        // Se não temos um ID, vamos INSERIR um novo registro
        console.log('Inserting new trade record.');
        // Remove o ID dos dados de inserção, pois o BD gera um novo
        const { id, ...insertData } = tradeData;
        query = query.insert([insertData]).select('id'); // Seleciona o ID gerado para atualizar currentTradeId
    }

    const { data, error } = await query;

    if (error) {
        console.error('Erro ao salvar trade:', error);
        // TODO: Adicionar tratamento de erro na UI
        return false; // Indica falha
    } else {
        console.log('Trade salvo com sucesso:', data);
        // Se foi uma inserção, armazena o ID do novo trade (útil se quiser salvar 'Pending' primeiro)
        if (!currentTradeId && data && data.length > 0 && data[0].id) {
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
    const winButton = document.getElementById('win-button');
    const lossButton = document.getElementById('loss-button');
    const drawButton = document.getElementById('draw-button'); // Se tiver botão de DRAW

    if (startOperationButton) startOperationButton.disabled = enableResults; // Desabilita se resultados estão habilitados
    if (winButton) winButton.disabled = !enableResults; // Habilita se enableResults é true
    if (lossButton) lossButton.disabled = !enableResults; // Habilita se enableResults é true
    if (drawButton) drawButton.disabled = !enableResults; // Habilita se enableResults é true
}
// --- FIM FUNÇÃO toggleOperationButtons ---

// --- FUNÇÃO: Analisar a string cycle_step (ex: "C1L2E3") ---
function parseCycleStep(cycleStepString) {
    const regex = /C(\d+)L(\d+)E(\d+)/;
    const match = cycleStepString.match(regex);
    if (match) {
        return {
            cycle: parseInt(match[1], 10),
            level: parseInt(match[2], 10),
            entry: parseInt(match[3], 10)
        };
    }
    return { cycle: 0, level: 0, entry: 0 }; // Retorna 0,0,0 se não conseguir parsear
}
// --- FIM FUNÇÃO parseCycleStep ---


// --- FUNÇÃO: Função para calcular e atualizar as métricas e o painel de operação ---
// Esta função agora usa a variável global currentUserSettings e busca dados REAIS dos trades
async function updateOperationPanel() {
    console.log('Updating operation panel...');

    // --- 1. Verificar se currentUserSettings está disponível ---
    if (!currentUserSettings) {
        console.log("Não há configurações para calcular métricas. Exibindo padrões ou '--'.");
        // Popular a UI com valores padrão ou '--'
        const elementsToClear = ['bancaAtual', 'rentabilidadeGlobal', 'metaLucro', 'reservaCapital', 'currentPayout', 'nextAction', 'recommendedValue', 'statusText', 'entriesToday', 'winsToday', 'lossesToday', 'lastUpdate']; // Adicionado lastUpdate
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

    let totalEntriesToday = 0;
    let totalWinsToday = 0;
    let totalLossesToday = 0;
    let lastTrade = null;

    if (tradesError) {
        console.error('Erro ao buscar trades para métricas e estado:', tradesError);
        // TODO: Tratar erro na UI
        // Continuar com valores iniciais/fallback se houver erro na busca de trades
        currentBalance = currentUserSettings.banca_inicial;
        rentabilidadeGlobal = 0;
        lastTradeResult = null;
        currentCycle = 0; currentLevel = 0; currentEntry = 0; // Resetar estado da gestão
        currentEntryValue = 0;
        currentTradeId = null; // Reseta ID do trade atual
        lastEntryValueUsed = 0;
        // A UI será atualizada com estes fallbacks.
    } else {
        // --- Calcular Métricas Globais com dados de Trades ---
        if (trades && trades.length > 0) {
            lastTrade = trades[0]; // O último trade
            // Calcular Banca Atual (saldo do último trade)
            currentBalance = lastTrade.balance_after; // Atualiza a variável de estado global

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
            lastTradeResult = lastTrade.result; // Atualiza a variável de estado global
            currentTradeId = lastTrade.id; // Armazena o ID do último trade (útil se ele estiver 'Pending')

            // Parsear o cycle_step do último trade para definir o estado atual
            const lastStep = parseCycleStep(lastTrade.cycle_step);
            currentCycle = lastStep.cycle;
            currentLevel = lastStep.level;
            currentEntry = lastStep.entry;
            lastEntryValueUsed = lastTrade.entry_value; // Armazena o valor da última entrada usada

            console.log("Último trade encontrado:", lastTrade);
            console.log("Resultado do último trade:", lastTradeResult);
            console.log("Último cycle_step:", lastTrade.cycle_step);
            console.log("ID do último trade:", currentTradeId);
            console.log(`Estado derivado do último trade: C${currentCycle} L${currentLevel} E${currentEntry}`);
            console.log("Valor da última entrada usada:", lastEntryValueUsed);


            // !! TODO: Verificar se o ÚLTIMO trade está 'Pending' ou sem resultado
            // Se estiver, significa que há uma operação em andamento.
            // Manter botões de resultado habilitados e Iniciar Análise desabilitado.
            // Se o último trade tiver resultado (Win/Loss/Draw), a operação anterior foi concluída.
            // A lógica de cálculo do próximo passo abaixo determinará o que fazer (continuar ou iniciar novo ciclo).
            const isOperationPending = (lastTrade.result === null || lastTrade.result === 'Pending'); // Assumindo que você pode salvar 'Pending'
            if (isOperationPending) {
                 // Se a última operação está pendente, o valor recomendado continua sendo o valor daquela entrada
                 currentEntryValue = lastEntryValueUsed;
                 toggleOperationButtons(true); // Habilita botões de resultado
                 console.log("Operação em andamento detectada. Botões de resultado habilitados.");
            } else {
                 // A operação anterior foi concluída. A lógica abaixo determinará o próximo estado e valor.
                 // Os botões serão atualizados depois que o próximo estado for calculado.
                 console.log("Última operação concluída.");
                 // O próximo valor recomendado será calculado na seção 4
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
            currentEntryValue = 0; // Será definido ao iniciar análise
            currentTradeId = null; // Reseta ID do trade atual
            lastEntryValueUsed = 0;

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
    // Lembre-se que currentCycle, currentLevel, currentEntry e lastTradeResult já foram atualizados
    // com base no último trade buscado no início desta função.

    // Exemplo: Se não há trades OU se o último trade encerrou um ciclo/período:
    // TODO: Adicionar a condição REAL de encerramento de ciclo/período aqui
    const hasNoTrades = (trades === null || trades.length === 0);
    // TODO: Implementar lógica para verificar se o lastTrade (se existir) encerrou um ciclo
    const lastTradeEndedCycle = (lastTrade && lastTrade.result === 'Win' && currentLevel === 2); // Exemplo: Ganhou a Entrada 2 do Nível 2 (encerraria o nível/ciclo?) - Ajustar com sua regra real


    if (hasNoTrades || lastTradeEndedCycle) {
         // Início de um novo ciclo/período
         recommendedValue = valorPorCicloCalculado * 0.315; // Entrada Inicial
         currentEntryValue = recommendedValue; // Armazena na variável de estado
         currentCycle = (lastTradeEndedCycle && lastTrade) ? currentCycle + 1 : 1; // Avança ciclo se encerrou, senão inicia no 1
         currentLevel = 1; // Sempre inicia no Nível 1
         currentEntry = 1; // Sempre inicia na Entrada 1
         statusText = `Pronto para iniciar o Ciclo ${currentCycle}, Nível ${currentLevel}.`;
         nextAction = "Analisar...";
         lastTradeResult = null; // Reseta o resultado do último trade
         currentTradeId = null; // Reseta ID do trade atual ao iniciar um novo ciclo
         lastEntryValueUsed = 0; // Reseta o valor da última entrada usada

         console.log(`Estado Definido: C${currentCycle}L${currentLevel}E${currentEntry} (Início de Ciclo)`);

         // Habilitar botão Iniciar Análise, desabilitar botões de resultado
         toggleOperationButtons(false);

    } else {
        // Se há trades e a última operação não encerrou um ciclo, calculamos o próximo passo
        // O estado atual (currentCycle, currentLevel, currentEntry, lastTradeResult, lastEntryValueUsed)
        // já foi definido com base no último trade na seção 2.

        console.log("Calculando próximo valor e estado com base nas regras e último resultado.");

        let nextCycle = currentCycle;
        let nextLevel = currentLevel;
        let nextEntry = currentEntry;
        let nextRecommendedValue = 0;

        // !! TODO: Substituir esta lógica placeholder pelas suas regras reais !!
        // Use as variáveis globais currentCycle, currentLevel, currentEntry (o estado ANTES deste trade)
        // e o 'lastTradeResult' (o resultado do trade anterior) para calcular o PRÓXIMO estado
        // (nextCycle, nextLevel, nextEntry) e o PRÓXIMO valor recomendado (nextRecommendedValue).
        // Use lastEntryValueUsed para o valor da entrada anterior.

        if (lastTradeResult === 'Win') {
            // Lógica para WIN: avançar entrada/nível ou encerrar nível
            // Verificar se este WIN (o lastTradeResult) completa 2 Wins no nível atual
            // TODO: Implementar contagem de wins/losses no nível atual
            const winsInCurrentLevel = 0; // TODO: Calcular wins no nível atual
            if (winsInCurrentLevel === 2) {
                 // Encerrou o Nível. Avança para o próximo Nível ou Ciclo.
                 // TODO: Lógica de avanço de Nível/Ciclo e cálculo do novo valor inicial para o próximo Nível/Ciclo
                 nextEntry = 1; // Inicia Entrada 1 no novo Nível/Ciclo
                 nextLevel = currentLevel + 1; // Exemplo: Avança Nível
                 // TODO: Recalcular nextRecommendedValue com base na fórmula do próximo Nível (Nível 2 ou 3)
                 nextRecommendedValue = valorPorCicloCalculado * 0.5; // Exemplo: Fórmula Nível 2
                 statusText = `Nível ${nextLevel} Iniciado.`; // Exemplo de status
            } else {
                 // Ganhou, mas não encerrou o Nível. Avança para a próxima Entrada no mesmo Nível.
                 nextEntry = currentEntry + 1;
                 nextLevel = currentLevel;
                 nextCycle = currentCycle;
                 nextRecommendedValue = lastEntryValueUsed * 1.25; // Regra: Valor Anterior * 1.25
                 statusText = `Continuando: C${nextCycle} / L${nextLevel} / E${nextEntry}`;
            }

        } else if (lastTradeResult === 'Loss') {
            // Lógica para LOSS: Martingale ou avançar nível/ciclo
            // Verificar 2 Losses consecutivos no ciclo -> encerrar ciclo
            // TODO: Implementar verificação de 2 Losses consecutivos no ciclo atual
            const consecutiveLossesInCycle = 0; // TODO: Calcular losses consecutivos no ciclo
            if (consecutiveLossesInCycle === 2) {
                 // Encerrou o Ciclo por Stop Loss.
                 // TODO: Lógica de encerramento de Ciclo e início do próximo Ciclo (Entrada Inicial)
                 nextEntry = 1; // Inicia Entrada 1 no novo Ciclo
                 nextLevel = 1; // Inicia Nível 1 no novo Ciclo
                 nextCycle = currentCycle + 1; // Avança Ciclo
                 nextRecommendedValue = valorPorCicloCalculado * 0.315; // Regra: Entrada Inicial do novo Ciclo
                 statusText = `Ciclo ${nextCycle} Iniciado (Após Stop Loss).`; // Exemplo de status
                 // TODO: Verificar se atingiu Stop Loss Global aqui também
            } else {
                 // Perdeu, mas não atingiu 2 Losses consecutivos. Aplica Martingale.
                 nextEntry = currentEntry + 1;
                 nextLevel = currentLevel;
                 nextCycle = currentCycle;
                 nextRecommendedValue = lastEntryValueUsed * 2.17; // Regra: Valor Anterior * 2.17
                 statusText = `Continuando: C${nextCycle} / L${nextLevel} / E${nextEntry}`;
            }

        } else { // Draw
           // Lógica para DRAW ou outros casos
           nextEntry = currentEntry + 1; // Exemplo: avança entrada (ou mantém, dependendo da regra DRAW)
           nextRecommendedValue = lastEntryValueUsed; // Mantém o valor (exemplo para DRAW)
           statusText = `Continuando: C${nextCycle} / L${nextLevel} / E${nextEntry} (DRAW)`; // Status temporário
        }

        // !! TODO: Lógica de encerramento de Nível/Ciclo e início do próximo, ou fim do período !!
        // Se o resultado do trade anterior (lastTradeResult) encerrou um nível ou ciclo,
        // ajuste currentCycle, currentLevel, currentEntry e currentEntryValue para o início do próximo passo.
        // Esta lógica já está parcialmente no IF/ELSE acima, mas pode precisar de refinamento.


        // --- 6. Atualizar Variáveis de Estado Globais para o Próximo Passo ---
        // Atualiza as variáveis de estado com o PRÓXIMO passo calculado pela lógica de gestão
        currentCycle = nextCycle;
        currentLevel = nextLevel;
        currentEntry = nextEntry;
        currentEntryValue = nextRecommendedValue; // O valor recomendado para a PRÓXIMA operação
        lastTradeResult = result; // Armazena o resultado deste trade para o PRÓXIMO cálculo (em updateOperationPanel)
        currentTradeId = null; // Reseta o ID do trade atual, pois este trade foi concluído
        lastEntryValueUsed = entryValue; // Armazena o valor que FOI usado nesta entrada


        // --- 7. Chamar updateOperationPanel para Recarregar Dados e Atualizar UI ---
        // Isso buscará os trades novamente (incluindo o que acabamos de salvar),
        // recalculará as métricas globais (Banca, Rentabilidade, Contadores),
        // e atualizará o painel com o novo estado e valor calculados.
        await updateOperationPanel();

        // !! TODO: Lógica para verificar Stop Win / Stop Loss APÓS recalcular as métricas em updateOperationPanel !!
        // updateOperationPanel já faz uma verificação básica de Stop Win/Loss e habilita/desabilita botões.
        // Você pode precisar refinar essa lógica em updateOperationPanel ou adicionar verificações adicionais aqui.

        console.log(`Processamento de trade concluído. Próximo estado: C${currentCycle} L${currentLevel} E${currentEntry}. Próximo Valor: ${currentEntryValue.toFixed(2)}`);

    }


    // --- 8. Atualizar a Interface do Usuário (dashboard.html) ---
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
    const lastUpdateEl = document.getElementById('lastUpdate'); // Elemento para a última atualização


    // Atualizar Payout e Status/Ação
    if (currentPayoutEl) currentPayoutEl.textContent = `${currentUserSettings.payout_percent}%`;
    if (statusTextEl) statusTextEl.textContent = statusText; // Usando statusText calculado
    if (nextActionEl) nextActionEl.textContent = nextAction; // Usando nextAction calculado

    // Atualizar Valor Recomendado (usando o valor calculado)
    if (recommendedValueEl) {
        // Exibe o valor recomendado apenas se exibirValores for 'original' ou 'arredondado'
        if (currentUserSettings.exibir_valores === 'original') {
             recommendedValueEl.textContent = `${moedaSimbolo} ${currentEntryValue.toFixed(2)}`;
        } else if (currentUserSettings.exibir_valores === 'arredondado') {
             // TODO: Implementar lógica de arredondamento se necessário, ou usar toFixed(0)
             recommendedValueEl.textContent = `${moedaSimbolo} ${Math.round(currentEntryValue).toFixed(2)}`; // Exemplo simples de arredondamento
        } else {
             recommendedValueEl.textContent = '--'; // Se exibirValores for 'oculto' ou outro valor
        }
    }


    // Atualizar contadores de trades do dia
    if (entriesTodayEl) entriesTodayEl.textContent = totalEntriesToday;
    if (winsTodayEl) winsTodayEl.textContent = totalWinsToday;
    if (lossesTodayEl) lossesTodayEl.textContent = totalLossesToday;

    // Atualizar última atualização
    if (lastUpdateEl) {
        const now = new Date();
        lastUpdateEl.textContent = now.toLocaleTimeString();
    }

    // Lógica para o indicador de progresso (se existir na UI) também usaria essas métricas (Meta vs Rentabilidade)


    // TODO: Lógica para carregar e exibir o histórico de trades em uma lista na UI (chamada aqui ou em função separada)
}
// --- FIM FUNÇÃO updateOperationPanel ---


// --- FUNÇÃO: Processar o Resultado de um Trade ---
async function processTradeResult(result) {
    console.log(`Processando resultado: ${result}`);

    // Verifica se uma operação foi iniciada e se há configurações
    if (!currentUserSettings || currentCycle === 0 || currentEntryValue <= 0) {
        console.error("Não é possível processar trade: Configurações ausentes ou operação não iniciada.");
        alert("Erro: Não foi possível processar o trade. Inicie a análise primeiro.");
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
        // id: currentTradeId, // Incluir ID se estiver ATUALIZANDO um trade 'Pending'
        user_id: userId,
        // created_at: será gerado automaticamente pelo BD com now()
        pair: tradePair, // <-- Usar valor real da UI
        direction: tradeDirection, // <-- Usar valor real da UI
        entry_value: entryValue,
        payout_percent: payoutPercent,
        result: result, // 'Win', 'Loss', ou 'Draw'
        profit_loss: profitLoss,
        balance_after: newBalanceAfter, // Salva o saldo após este trade
        cycle_step: currentCycleStep // Ex: "C1L1E1" - Passo da gestão ANTES deste trade
    };
    console.log("Dados do trade para salvar:", tradeDataToSave);


    // --- 4. Salvar o Trade no Supabase ---
    // saveTrade agora lida com INSERT ou UPDATE baseado em currentTradeId
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
    // Use entryValue (o valor usado neste trade) para cálculos baseados no valor anterior.

    if (result === 'Win') {
        // Lógica para WIN: avançar entrada/nível ou encerrar nível
        // TODO: Implementar contagem de wins/losses no nível atual para verificar 2 Wins
        // Por enquanto, apenas avança a entrada e aplica 1.25
        nextEntry = currentEntry + 1;
        nextRecommendedValue = entryValue * 1.25; // Regra: Valor Anterior * 1.25
        statusText = `Continuando: C${nextCycle} / L${nextLevel} / E${nextEntry}`; // Status temporário
        console.log(`Resultado: WIN. Próximo: C${nextCycle} L${nextLevel} E${nextEntry}. Valor: ${nextRecommendedValue.toFixed(2)}`);

    } else if (result === 'Loss') {
        // Lógica para LOSS: Martingale ou avançar nível/ciclo
        // TODO: Implementar verificação de 2 Losses consecutivos no ciclo atual
        // Por enquanto, apenas avança a entrada e aplica 2.17
        nextEntry = currentEntry + 1;
        nextRecommendedValue = entryValue * 2.17; // Regra: Valor Anterior * 2.17
        statusText = `Continuando: C${nextCycle} / L${nextLevel} / E${nextEntry}`; // Status temporário
         console.log(`Resultado: LOSS. Próximo: C${nextCycle} L${nextLevel} E${nextEntry}. Valor: ${nextRecommendedValue.toFixed(2)}`);

    } else { // Draw
       // Lógica para DRAW ou outros casos
       nextEntry = currentEntry + 1; // Exemplo: avança entrada (ou mantém, dependendo da regra DRAW)
       nextRecommendedValue = entryValue; // Mantém o valor (exemplo para DRAW)
       statusText = `Continuando: C${nextCycle} / L${nextLevel} / E${nextEntry} (DRAW)`; // Status temporário
        console.log(`Resultado: DRAW. Próximo: C${nextCycle} L${nextLevel} E${nextEntry}. Valor: ${nextRecommendedValue.toFixed(2)}`);
    }

    // !! TODO: Lógica de encerramento de Nível/Ciclo e início do próximo, ou fim do período !!
    // Se o resultado deste trade (result) encerrou um nível ou ciclo (ex: 2 Wins no Nível, 2 Losses no Ciclo),
    // ajuste nextCycle, nextLevel, nextEntry e recalcule nextRecommendedValue de acordo com as regras de avanço
    // (fórmulas de Nível 2/3 ou início de novo ciclo).
    // Esta lógica de verificação e avanço/reset precisa ser implementada AQUI, após calcular o nextEntry/Value básico.


    // --- 6. Atualizar Variáveis de Estado Globais para o Próximo Passo ---
    // Atualiza as variáveis de estado com o PRÓXIMO passo calculado pela lógica de gestão
    currentCycle = nextCycle;
    currentLevel = nextLevel;
    currentEntry = nextEntry;
    currentEntryValue = nextRecommendedValue; // O valor recomendado para a PRÓXIMA operação
    lastTradeResult = result; // Armazena o resultado deste trade para o PRÓXIMO cálculo (em updateOperationPanel)
    currentTradeId = null; // Reseta o ID do trade atual, pois este trade foi concluído
    lastEntryValueUsed = entryValue; // Armazena o valor que FOI usado nesta entrada


    // --- 7. Chamar updateOperationPanel para Recarregar Dados e Atualizar UI ---
    // Isso buscará os trades novamente (incluindo o que acabamos de salvar),
    // recalculará as métricas globais (Banca, Rentabilidade, Contadores),
    // e atualizará o painel com o novo estado e valor calculados.
    await updateOperationPanel();

    // !! TODO: Lógica para verificar Stop Win / Stop Loss APÓS recalcular as métricas em updateOperationPanel !!
    // updateOperationPanel já faz uma verificação básica de Stop Win/Loss e habilita/desabilita botões.
    // Você pode precisar refinar essa lógica em updateOperationPanel ou adicionar verificações adicionais aqui.

    console.log(`Processamento de trade concluído. Próximo estado: C${currentCycle} L${currentLevel} E${currentEntry}. Próximo Valor: ${currentEntryValue.toFixed(2)}`);

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
            // Se não há sessão, redireciona para index.html APENAS se estiver no dashboard
            if (currentPath.includes('/dashboard.html')) {
                console.log("No session found, redirecting to index.html");
                window.location.href = 'index.html';
            }
            // Se não há sessão e já está na index, não faz nada (permite login/cadastro)
        } else {
            const user = session.user;
            console.log("User logged in:", user.email);

            // Se há sessão, redireciona para dashboard.html APENAS se estiver na index
            if (currentPath.includes('/index.html')) {
                 console.log("Session found, redirecting to dashboard.html");
                 window.location.href = 'dashboard.html';
            } else if (currentPath.includes('/dashboard.html')) {
                // Se há sessão e já está no dashboard, carrega os dados
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
        // Ativa a aba de login por padrão na página index.html
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
                // Redireciona para o dashboard após login bem-sucedido
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
                    // Redireciona para o dashboard após cadastro bem-sucedido e login automático
                    window.location.href = 'dashboard.html';
                } else {
                    alert("Cadastro realizado! Verifique seu e-mail para confirmar sua conta.");
                    // Não redireciona automaticamente se a confirmação por e-mail for necessária
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
                // Redireciona para a página inicial após logout
                window.location.href = 'index.html';
            }
        });
    }

    // --- Lógica Dinâmica (Página Inicial - MOCKAGEM) ---
    function loadInitialMetrics() {
        // Esta função só deve rodar na index.html
        if (!document.getElementById('bancaAtual')) return; // Sai se os elementos não existem

        // !! ESTES AINDA SÃO DADOS MOCKADOS !!
        // !! CARREGAR DADOS REAIS AQUI EXIGIRIA VERIFICAR SE O USUÁRIO ESTÁ LOGADO
        // !! E ENTÃO BUSCAR AS MÉTRICAS DO BANCO DE DADOS SUPABASE RELACIONADAS A ESSE USUÁRIO !!
        // TODO: Se quiser mostrar dados reais na index para usuários logados, implementar busca aqui.
        const bancaAtual = 5500.75; // Exemplo
        const rentabilidadeGlobal = 1250.30; // Exemplo
        const metaLucro = 150.00; // Exemplo (calculado pela lógica interna)
        const reservaCapital = rentabilidadeGlobal - metaLucro; // Exemplo

        const bancaEl = document.getElementById('bancaAtual');
        const rentabilidadeEl = document.getElementById('rentabilidadeGlobal');
        const metaLucroEl = document.getElementById('metaLucro');
        const reservaCapitalEl = document.getElementById('reservaCapital');
        const lastUpdateEl = document.getElementById('lastUpdate');

        if (bancaEl) bancaEl.textContent = bancaAtual.toFixed(2);
        if (rentabilidadeEl) {
            rentabilidadeEl.textContent = rentabilidadeGlobal.toFixed(2);
            rentabilidadeEl.classList.remove('positive', 'negative'); // Remove classes anteriores
            rentabilidadeEl.classList.add(rentabilidadeGlobal >= 0 ? 'positive' : 'negative');
        }
        if (metaLucroEl) metaLucroEl.textContent = metaLucro.toFixed(2);
        if (reservaCapitalEl) {
            reservaCapitalEl.textContent = reservaCapital.toFixed(2);
            reservaCapitalEl.classList.remove('positive', 'negative'); // Remove classes anteriores
            reservaCapitalEl.classList.add(reservaCapital >= 0 ? 'positive' : 'negative');
        }

        if (lastUpdateEl) {
            const now = new Date();
            lastUpdateEl.textContent = now.toLocaleTimeString();
        }
    }

    // Chama loadInitialMetrics apenas se estiver na página inicial (onde esses elementos existem)
    if (window.location.pathname.includes('/index.html') || window.location.pathname === '/') { // Incluído '/' para caso a index seja a raiz
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
                        updateOperationPanel(); // Atualiza o painel (buscará trades e recalculará)
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
            // updateOperationPanel já define o estado currentCycle, currentLevel, currentEntry
            // Se currentCycle > 0 e o último trade não teve um resultado final que encerre o ciclo,
            // a operação já está em andamento e updateOperationPanel já habilitou os botões de resultado.
            // Portanto, se o botão Iniciar Análise está habilitado, significa que não há operação em andamento.


            // --- Lógica para iniciar o PRIMEIRO trade do dia/ciclo ---
            // Usa o Valor por Ciclo calculado em updateOperationPanel (armazenado em valorPorCicloCalculado)
            const firstEntryValue = valorPorCicloCalculado * 0.315; // Regra: 31.5% do Valor por Ciclo

            // Define o estado inicial da gestão
            currentCycle = 1;
            currentLevel = 1;
            currentEntry = 1;
            currentEntryValue = firstEntryValue; // Armazena o valor recomendado para a PRÓXIMA operação
            lastTradeResult = null; // Reseta o resultado do último trade ao iniciar um novo período/ciclo
            currentTradeId = null; // Reseta o ID do trade atual
            lastEntryValueUsed = 0; // Reseta o valor da última entrada usada

            console.log(`Iniciando: Ciclo ${currentCycle}, Nível ${currentLevel}, Entrada ${currentEntry}. Valor recomendado: ${currentEntryValue.toFixed(2)}`);

            // --- Atualizar UI com o estado inicial da operação ---
            // updateOperationPanel será chamada no final para atualizar a UI com o novo estado inicial.
            // Mas podemos atualizar alguns elementos imediatamente para dar feedback visual rápido.
             const moedaSimbolo = currentUserSettings.moeda === 'BRL' ? 'R$' : currentUserSettings.moeda === 'USD' ? '$' : currentUserSettings.moeda === 'EUR' ? '€' : currentUserSettings.moeda;
             const nextActionEl = document.getElementById('nextAction');
             const recommendedValueEl = document.getElementById('recommendedValue');
             const statusTextEl = document.getElementById('statusText');

             if (nextActionEl) nextActionEl.textContent = "Analisando..."; // Ou "Pronto para operar"
             if (recommendedValueEl) {
                 // Exibe o valor recomendado apenas se exibirValores for 'original' ou 'arredondado'
                 if (currentUserSettings.exibir_valores === 'original') {
                      recommendedValueEl.textContent = `${moedaSimbolo} ${currentEntryValue.toFixed(2)}`;
                 } else if (currentUserSettings.exibir_valores === 'arredondado') {
                      recommendedValueEl.textContent = `${moedaSimbolo} ${Math.round(currentEntryValue).toFixed(2)}`; // Exemplo simples de arredondamento
                 } else {
                      recommendedValueEl.textContent = '--'; // Se exibirValores for 'oculto' ou outro valor
                 }
             }
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
            //     entry_value: currentEntryValue, // O valor da entrada que VAI ser usada
            //     payout_percent: currentUserSettings.payout_percent,
            //     result: 'Pending', // ou null
            //     balance_after: currentBalance, // Saldo ANTES desta operação
            //     cycle_step: `C${currentCycle}L${currentLevel}E${currentEntry}` // O passo que está sendo iniciado
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

            // Após iniciar, chame updateOperationPanel para garantir que a UI reflita o estado inicial
            // Isso também recalculará as métricas globais (embora não mudem no primeiro trade)
            await updateOperationPanel();

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

// Nota: As variáveis de estado e as funções loadUserSettings, saveTrade, toggleOperationButtons, updateOperationPanel, processTradeResult, parseCycleStep
// são definidas no escopo do DOMContentLoaded listener. Isso significa que elas só são acessíveis DENTRO deste listener
// e de funções definidas DENTRO dele. Para a estrutura atual, onde os listeners dos botões (WIN/LOSS/DRAW) estão DENTRO
// deste listener, a configuração atual das variáveis de estado e funções deve funcionar.
