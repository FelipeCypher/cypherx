// Substitua pelos seus dados do projeto Supabase
// Copie o 'Project URL' da página Data API no Supabase
const SUPABASE_URL = 'https://vlxuudjpxlnihyvxchmp.supabase.co';
// Copie a chave 'anon' (Public) da seção Project API keys na página Data API
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZseHV1ZGpweGxuaWh5dnhjaG1wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDY4ODM1NzAsImV4cCI6MjA2MjQ1OTU3MH0.p2aSzw1i3S9MqSFgsOvQpwz2_TbH4LSwF87WodGZB0M';

const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);


document.addEventListener('DOMContentLoaded', async () => { // Use async pois vamos fazer chamadas await

    // --- Lógica de Autenticação (AGORA COM SUPABASE) ---

     // Função para verificar o status de autenticação e redirecionar
    async function checkAuthAndRedirect() {
        const { data: { session } } = await supabase.auth.getSession();
        const currentPath = window.location.pathname;

        console.log("Checking auth status. Session:", session);
        console.log("Current path:", currentPath);

        // Se o usuário NÃO está logado
        if (!session) {
            // E está tentando acessar o dashboard, redirecione para a página inicial
            if (currentPath.includes('/dashboard.html')) {
                console.log("No session found, redirecting to index.html");
                window.location.href = 'index.html';
            }
             // Se não está logado e já está na index, pode continuar na index (seção de auth estará visível)
        }
        // Se o usuário ESTÁ logado
        else {
            // E está na página inicial (index.html), redirecione para o dashboard
            if (currentPath.includes('/index.html')) {
                 console.log("Session found, redirecting to dashboard.html");
                 window.location.href = 'dashboard.html';
            }
            // Se está logado e já está no dashboard, continue
            // O email do usuário logado está em session.user.email
             console.log("User logged in:", session.user.email);
             // O ID do usuário é session.user.id. Use este ID para buscar/salvar dados
             // específicos deste usuário nas suas tabelas do banco de dados.
        }
    }

    // Chame a função de verificação ao carregar a página
    checkAuthAndRedirect();


    // --- Autenticação (Tabs) ---
    // (Mantém a lógica de tabs visual do código anterior)
    const tabButtons = document.querySelectorAll('.auth-tabs .tab-button');
    const authForms = document.querySelectorAll('.auth-form');

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            // Remove active class from all buttons and forms
            tabButtons.forEach(btn => btn.classList.remove('active'));
            authForms.forEach(form => form.classList.remove('active'));

            // Add active class to the clicked button and corresponding form
            const targetTab = button.getAttribute('data-tab');
            button.classList.add('active');
            document.getElementById(targetTab).classList.add('active');
        });
    });

    // Initially show the login form if on index.html
    if (document.getElementById('login')) {
         document.getElementById('login').classList.add('active');
    }


    // --- Login (AGORA COM SUPABASE) ---
    const loginForm = document.querySelector('#login form');
    if(loginForm) {
        loginForm.addEventListener('submit', async (event) => { // Use async
            event.preventDefault();
            const email = document.getElementById('login-email').value;
            const password = document.getElementById('login-password').value;

            // Chamada real ao Supabase para login
            const { data, error } = await supabase.auth.signInWithPassword({
              email: email,
              password: password,
            });

            if (error) {
                console.error("Erro no login:", error);
                alert("Erro ao fazer login: " + error.message); // Mostra o erro do Supabase
            } else {
                console.log("Login bem-sucedido:", data);
                // Redirecionar para o dashboard após login bem-sucedido
                // checkAuthAndRedirect() também fará isso na próxima carga de página, mas podemos fazer direto:
                 window.location.href = 'dashboard.html';
            }
        });
    }

     // --- Cadastro (AGORA COM SUPABASE) ---
     const registerForm = document.querySelector('#register form');
     if(registerForm) {
        registerForm.addEventListener('submit', async (event) => { // Use async
            event.preventDefault();
            const name = document.getElementById('register-name').value; // Nome do usuário
            const email = document.getElementById('register-email').value;
            const password = document.getElementById('register-password').value;
            const confirmPassword = document.getElementById('register-confirm-password').value;

            if (password !== confirmPassword) {
                 alert("As senhas não coincidem!");
                 return; // Para a execução se as senhas não batem
            }

            // Chamada real ao Supabase para cadastro
            // Note: o Supabase Auth por padrão envia email de confirmação.
            // Você pode desabilitar isso nas configurações do Supabase Auth > Settings
            const { data, error } = await supabase.auth.signUp({
                email: email,
                password: password,
                 options: {
                    data: {
                        full_name: name // Opcional: salva o nome nos metadados do usuário auth
                    }
                 }
            });

            if (error) {
                console.error("Erro no cadastro:", error);
                alert("Erro ao cadastrar: " + error.message); // Mostra o erro do Supabase
            } else {
                console.log("Cadastro bem-sucedido:", data);
                // O usuário pode precisar confirmar o email (dependendo da configuração Supabase)
                // Se a confirmação de email estiver desabilitada, data.user estará presente e logado automaticamente
                // Se a confirmação estiver habilitada, data.user será null e o usuário receberá um email
                 if (data.user) {
                     alert("Cadastro realizado com sucesso! Você já está logado.");
                      // checkAuthAndRedirect() também fará isso
                     window.location.href = 'dashboard.html'; // Redireciona se logado automaticamente
                 } else {
                     alert("Cadastro realizado! Verifique seu e-mail para confirmar sua conta.");
                     // Opcional: Mantenha o usuário na página de login ou redirecione para uma página de "verificar email"
                     // window.location.href = 'index.html#auth';
                 }
            }
        });
     }

     // --- Logout (AGORA COM SUPABASE) ---
     // Certifique-se de ter um elemento com id="logout-button" no seu dashboard.html
     const logoutButton = document.getElementById('logout-button');
     if (logoutButton) {
         logoutButton.addEventListener('click', async (event) => { // Use async
             event.preventDefault();

             const { error } = await supabase.auth.signOut();

             if (error) {
                 console.error("Erro no logout:", error);
                 alert("Erro ao sair: " + error.message);
             } else {
                 console.log("Logout bem-sucedido.");
                 // Redirecionar para a página inicial após o logout
                 window.location.href = 'index.html';
             }
         });
     }


    // --- Lógica Dinâmica (Página Inicial - MOCKAGEM AINDA, MAS PREPARADA) ---
    // A lógica real aqui dependeria do usuário estar logado e ter dados de trades.
    // Como a página inicial não exige login, manteremos os placeholders ou mostraremos algo genérico.
    // Em um app real, esta seção seria mais dinâmica se o usuário estiver logado.
    function loadInitialMetrics() {
        // !! ESTES AINDA SÃO DADOS MOCKADOS !!
        // !! CARREGAR DADOS REAIS AQUI EXIGIRIA VERIFICAR SE O USUÁRIO ESTÁ LOGADO
        // !! E ENTÃO BUSCAR AS MÉTRICAS DO BANCO DE DADOS SUPABASE RELACIONADAS A ESSE USUÁRIO !!
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
            rentabilidadeEl.classList.add(rentabilidadeGlobal >= 0 ? 'positive' : 'negative');
        }
        if (metaLucroEl) metaLucroEl.textContent = metaLucro.toFixed(2);
        if (reservaCapitalEl) {
            reservaCapitalEl.textContent = reservaCapital.toFixed(2);
            reservaCapitalEl.classList.add(reservaCapital >= 0 ? 'positive' : 'negative');
        }

        if (lastUpdateEl) {
             const now = new Date();
             lastUpdateEl.textContent = now.toLocaleTimeString();
        }
    }

    if (document.getElementById('bancaAtual')) {
        loadInitialMetrics();
    }


    // --- Lógica do Dashboard (AGORA COM SUPABASE PARA CONFIGURAÇÕES) ---

    // Função para carregar configurações do usuário do Supabase
    async function loadUserSettings() {
         const { data: { session } } = await supabase.auth.getSession();
         if (!session) {
             console.log("Usuário não logado, não é possível carregar configurações.");
             return; // Sai da função se não há sessão
         }

         const userId = session.user.id;
         console.log("Loading settings for user ID:", userId);

         // Busca as configurações para o usuário logado na tabela 'settings'
         const { data, error } = await supabase
            .from('settings')
            .select('*')
            .eq('user_id', userId) // Filtra pelo ID do usuário logado
            .single(); // Espera um único resultado (uma linha de configuração por usuário)

         // O código PGRST116 significa "No rows found". Isso acontece no primeiro login do usuário.
         if (error && error.code !== 'PGRST116') {
             console.error("Erro ao carregar configurações:", error);
             alert("Erro ao carregar configurações: " + error.message); // Mostra erro mais amigável
         } else if (data) {
             console.log("Configurações carregadas:", data);
             // Preenche o formulário de configurações com os dados carregados
             const settingsForm = document.querySelector('.dashboard-sections form');
             if (settingsForm) {
                 document.getElementById('bancaInicial').value = data.banca_inicial || '';
                 document.getElementById('payout').value = data.payout_percent || '';
                 document.getElementById('modoOperacao').value = data.modo_operacao || 'equilibrado';
                 document.getElementById('moedas').value = data.moeda || 'BRL';
                 document.getElementById('valores').value = data.exibir_valores || 'original';
             }
             // !! Aqui você também usaria estes dados (data) para calcular
             // !! Margem de Risco, Valor por Ciclo, Meta de Lucro etc.
             // !! E popularia os outros elementos do dashboard (Banca, Rentabilidade, Meta, Reserva)
         } else {
              console.log("Nenhuma configuração encontrada para o usuário. Usando valores padrão do formulário.");
              // Se não encontrou configurações (primeiro login), os campos do formulário ficam com os valores padrão do HTML.
              // Você pode querer preencher com padrões JS mais robustos aqui se necessário.
         }
    }


    // Placeholder: Função para atualizar o painel de operação (LÓGICA COMPLEXA AINDA NECESSÁRIA)
    // Esta função dependerá das configurações do usuário E do estado atual da operação/ciclo salvo no BD
    function updateOperationPanel() {
        // !! A LÓGICA COMPLETA DE CÁLCULO, GERENCIAMENTO DE CICLOS/NÍVEIS
        // !! E BUSCA DE DADOS DE TRADES DO SUPABASE IRIA AQUI !!

        // Exemplo de dados MOCKADOS (apenas para layout)
        const nextAction = "Aguardando Análise...";
        const recommendedValue = 0.00;
        const statusText = "Clique em 'Iniciar Análise'";
        const entriesToday = '--';
        const winsToday = '--';
        const lossesToday = '--';
        const currentPayout = '--';

        if (document.getElementById('nextAction')) {
             document.getElementById('nextAction').textContent = nextAction;
             document.getElementById('recommendedValue').textContent = `$ ${recommendedValue.toFixed(2)}`;
             document.getElementById('statusText').textContent = statusText;
             document.getElementById('entriesToday').textContent = entriesToday;
             document.getElementById('winsToday').textContent = winsToday;
             document.getElementById('lossesToday').textContent = lossesToday;
             document.getElementById('currentPayout').textContent = `${currentPayout}%`;
             // Lógica para o indicador de progresso
        }
    }


    // Ao carregar a página do dashboard:
    if (document.body.classList.contains('dashboard-body')) {
        loadUserSettings(); // Carrega as configurações ao entrar no dashboard
        updateOperationPanel(); // Popula o painel com placeholders ou dados iniciais
         // !! ADICIONAR AQUI CHAMADAS PARA CARREGAR HISTÓRICO DE TRADES, MÉTRICAS GLOBAIS ETC. !!
         // !! ESTAS TAMBÉM PRECISARÃO BUSCAR DADOS DO SUPABASE RELACIONADOS AO USUÁRIO LOGADO !!
    }


    // --- Salvar Configurações (AGORA COM SUPABASE) ---
    const settingsForm = document.querySelector('.dashboard-sections form');
    if(settingsForm) {
        settingsForm.addEventListener('submit', async (event) => { // Use async
            event.preventDefault();

            const { data: { session } } = await supabase.auth.getSession();
             if (!session) {
                 alert("Erro: Usuário não logado para salvar configurações.");
                 return;
             }

            const userId = session.user.id;

            // Coleta dados do formulário
            const bancaInicial = parseFloat(document.getElementById('bancaInicial').value);
            const payout = parseInt(document.getElementById('payout').value, 10);
            const modoOperacao = document.getElementById('modoOperacao').value;
            const moeda = document.getElementById('moedas').value;
            const exibirValores = document.getElementById('valores').value;

            // Validação básica (adicione validações mais robustas conforme necessário)
             if (isNaN(bancaInicial) || bancaInicial <= 0) {
                alert("Por favor, insira uma Banca Inicial válida.");
                return;
            }
             if (isNaN(payout) || payout <= 0 || payout > 100) {
                alert("Por favor, insira um Payout (%) válido entre 1 e 100.");
                return;
            }


            // Salva/Atualiza as configurações no Supabase usando UPSERT
            // UPSERT irá inserir se user_id não existir, ou atualizar se existir.
            const { data, error } = await supabase
                .from('settings')
                .upsert(
                    {
                        user_id: userId,
                        banca_inicial: bancaInicial,
                        payout_percent: payout,
                        modo_operacao: modoOperacao,
                        moeda: moeda,
                        exibir_valores: exibirValores
                    },
                    {
                        onConflict: 'user_id' // Conflito na coluna user_id indica que já existe, então atualize
                    }
                );

            if (error) {
                console.error("Erro ao salvar configurações:", error);
                 alert("Erro ao salvar configurações: " + error.message);
            } else {
                console.log("Configurações salvas com sucesso:", data);
                alert("Configurações salvas!");
                // Opcional: Recarregar métricas ou dashboard se necessário
                // reloadMetricsAndDashboardData(); // Função que você precisaria criar
            }
        });
    }

     // --- Placeholder para o botão "Iniciar Análise" ---
     const startOperationButton = document.querySelector('.start-operation');
     if(startOperationButton) {
        startOperationButton.addEventListener('click', () => {
             alert("Iniciando análise... (Lógica de operação precisa ser implementada, usando configurações do BD)");
             // !! ADICIONAR LÓGICA PARA COMEÇAR O CICLO DE OPERAÇÕES AQUI !!
             // !! ESTA LÓGICA LERÁ AS CONFIGURAÇÕES SALVAS NO SUPABASE (USANDO loadUserSettings() por exemplo) !!
             // !! E SALVARÁ O ESTADO DA OPERAÇÃO (tabela 'trades' ou similar) NO BD SUPABASE !!
        });
     }


    // --- Outros Placeholders ---
    // Mantenha outros placeholders que você julgar úteis para lembrar o que falta
    // (Ex: lógica para botões WIN/LOSS, cálculo de métricas em tempo real, histórico de trades etc.)
    // A lógica de WIN/LOSS também precisará interagir com o BD Supabase para salvar o resultado da trade
    // e atualizar o estado do ciclo/nível.


});
