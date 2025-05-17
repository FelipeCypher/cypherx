// Substitua pelos seus dados do projeto Supabase
const SUPABASE_URL = 'https://vlxuudjpxlnihyvxchmp.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZseHV1ZGpweGxuaWh5dnhjaG1wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDY4ODM1NzAsImV4cCI6MjA2MjQ1OTU3MH0.p2aSzw1i3S9MqSFgsOvQpwz2_TbH4LSwF87WodGZB0M';

// Use um nome diferente para a instância do cliente para evitar conflito com a variável global 'supabase' da SDK
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// --- NOVA FUNÇÃO: Função para carregar as configurações do usuário ---
// Colocada aqui fora de outras funções para ser acessível
async function loadUserSettings(userId) {
  console.log('Attempting to load settings for user:', userId);

  // Consulta a tabela 'settings' para a linha com o user_id correspondente
  const { data, error } = await supabaseClient
    .from('settings')
    .select('*') // Seleciona todas as colunas
    .eq('user_id', userId) // Filtra pela coluna user_id
    .single(); // Espera um único resultado (pois cada usuário só tem 1 linha de settings)

  // Tratamento de erro - ignoramos o erro PGRST116 que significa 'nenhuma linha encontrada'
  if (error && error.code !== 'PGRST116') {
    console.error('Erro ao carregar configurações:', error);
    // TODO: Adicionar tratamento de erro na UI, talvez mostrar uma mensagem
    return null; // Retorna null em caso de erro (exceto 'no rows found')
  }

  if (data) {
    console.log('Configurações carregadas com sucesso:', data);
    // Retorna o objeto de configurações
    return data;
  } else {
    // Se 'data' é null, significa que nenhuma linha foi encontrada para este user_id.
    // Isso é o esperado para o primeiro login ou antes do usuário salvar as settings pela primeira vez.
    console.log('Nenhuma configuração encontrada para o usuário. Usar defaults ou prompt.');
    // Retorna null para indicar que não há settings salvas
    return null;
  }
}
// --- FIM NOVA FUNÇÃO ---


document.addEventListener('DOMContentLoaded', async () => { // Use async pois vamos fazer chamadas await

    // --- Lógica de Autenticação (AGORA COM SUPABASE) ---

    // Função para verificar o status de autenticação e redirecionar
    async function checkAuthAndRedirect() { // Já é async, ótimo!
        const { data: { session } } = await supabaseClient.auth.getSession();
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
            const user = session.user; // Obtenha o objeto user da sessão
            console.log("User logged in:", user.email); // Use user.email ou user.id

            // Se está na página inicial (index.html), redirecione para o dashboard
            if (currentPath.includes('/index.html')) {
                 console.log("Session found, redirecting to dashboard.html");
                 window.location.href = 'dashboard.html';
            }
            // --- INTEGRAÇÃO AQUI: Usuário logado E está no dashboard ---
            // Se está logado e a página atual É o dashboard
            else if (currentPath.includes('/dashboard.html')) {
                console.log("Usuário logado no Dashboard. Carregando dados...");

                // O ID do usuário é user.id. Use este ID para buscar/salvar dados
                // específicos deste usuário nas suas tabelas.

                // --- CHAMADA PARA CARREGAR SETTINGS ---
                const userSettings = await loadUserSettings(user.id); // Chama a nova função

                if (userSettings) {
                    // Configurações carregadas com sucesso! O objeto userSettings contém os dados.
                    console.log('Configurações do usuário para Dashboard:', userSettings);
                    // TODO: Agora que você tem userSettings, use-o para:
                    // 1. Preencher os campos do formulário de configurações no dashboard
                    //    (Note: a sua lógica de submit do formulário de settings já faz isso depois de salvar/atualizar,
                    //     mas talvez você queira preencher ao carregar a página também, usando userSettings)
                    // 2. Calcular e popular as métricas globais (Banca Atual, Rentabilidade, Meta Lucro, Reserva Capital)
                    //    usando userSettings.initial_bankroll e buscando dados da tabela 'trades'.
                    // 3. Inicializar a lógica principal do painel de operação (Próximo Valor, Status, etc.).
                    //    Esta lógica também precisará buscar o histórico de trades (tabela 'trades').

                    // Exemplo (adapte conforme sua UI e lógica):
                    // document.getElementById('bancaInicial').value = userSettings.banca_inicial || ''; // Se quiser preencher o formulário ao carregar
                    // Chame a função que popula o painel de operação (que agora usará settings e buscará trades)
                    updateOperationPanel(userSettings); // Precisaremos passar settings para esta função depois

                } else {
                    // Usuário logado, mas não tem configurações salvas no banco de dados.
                    console.log('Usuário logado, mas sem settings carregadas. Executando lógica para primeiro acesso/sem settings.');
                    // TODO: Implemente a lógica para quando não há settings (ex: primeiro acesso)
                    // - Você pode querer mostrar o formulário de settings por padrão, preenchido com valores padrão da UI.
                    // - Talvez mostrar uma mensagem ou modal indicando que ele precisa salvar as configurações iniciais.
                    // - A lógica de salvar settings (seu handler do submit do formulário) criará o primeiro registro com UPSERT.
                    // Chame a função que popula o painel de operação (pode usar defaults ou mostrar "--")
                     updateOperationPanel(null); // Passa null ou um objeto padrão se a função souber lidar
                }
            }
            // --- FIM INTEGRAÇÃO AQUI ---

            // Se está logado mas não é index NEM dashboard (e deveria ser protegida)
            // Adicionar lógica aqui se tiver outras páginas que exigem login além do dashboard
            // else {
            //    console.log("Usuário logado em outra página protegida.");
            //    // Talvez garantir que ele só pode acessar dashboard? Depende da estrutura do app.
            // }
        }
    }

    // Chame a função de verificação ao carregar a página
    checkAuthAndRedirect();


    // --- Autenticação (Tabs) ---
    // (Mantenha sua lógica existente para gerenciar as tabs de login/cadastro, etc.)
    const tabButtons = document.querySelectorAll('.auth-tabs .tab-button');
    const authForms = document.querySelectorAll('.auth-form');

    console.log("DEBUG: Found tab buttons:", tabButtons.length, tabButtons);
    console.log("DEBUG: Found auth forms:", authForms.length, authForms);

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

        // Lógica para exibir o formulário de login por padrão (apenas na página index)
        if (window.location.pathname.includes('/index.html')) {
             const loginForm = document.getElementById('login');
             if (loginForm) {
                 loginForm.classList.add('active');
             } else {
                 console.error("DEBUG: Login form with ID 'login' not found on index page.");
             }
              const loginTabButton = document.querySelector('.auth-tabs .tab-button[data-tab="login"]');
              if(loginTabButton) {
                  loginTabButton.classList.add('active');
              }
        }
    } else {
        console.error("DEBUG: Tab buttons or auth forms not found in the DOM. Check HTML selectors.");
    }


    // --- Login (AGORA COM SUPABASE) ---
    // (Mantenha sua lógica existente para o formulário de login)
    const loginForm = document.querySelector('#login form');
    if(loginForm) {
        loginForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            const email = document.getElementById('login-email').value;
            const password = document.getElementById('login-password').value;

            const { data, error } = await supabaseClient.auth.signInWithPassword({
                 email: email,
                 password: password,
            });

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
     // (Mantenha sua lógica existente para o formulário de cadastro)
     const registerForm = document.querySelector('#register form');
     if(registerForm) {
         registerForm.addEventListener('submit', async (event) => {
             event.preventDefault();
             const name = document.getElementById('register-name').value;
             const email = document.getElementById('register-email').value;
             const password = document.getElementById('register-password').value;
             const confirmPassword = document.getElementById('register-confirm-password').value;

             if (password !== confirmPassword) {
                  alert("As senhas não coincidem!");
                  return;
             }

             const { data, error } = await supabaseClient.auth.signUp({
                 email: email,
                 password: password,
                  options: {
                      data: {
                          full_name: name
                      }
                  }
             });

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
                       // window.location.href = 'index.html#auth';
                   }
             }
         });
     }

     // --- Logout (AGORA COM SUPABASE) ---
     // (Mantenha sua lógica existente para o botão de logout)
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


    // --- Lógica Dinâmica (Página Inicial - MOCKAGEM AINDA, MAS PREPARADA) ---
    // (Mantenha esta lógica se ela for relevante APENAS para a página index.html)
    // Se esta lógica for para o dashboard, ela precisa ser integrada no bloco 'if (user) else if (dashboard)' acima.
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

    // Chama loadInitialMetrics apenas se estiver na página inicial (onde esses elementos existem)
    if (window.location.pathname.includes('/index.html') && document.getElementById('bancaAtual')) {
         loadInitialMetrics();
    }


    // --- Lógica do Dashboard (AGORA COM SUPABASE PARA CONFIGURAÇÕES E TRADES) ---

    // Placeholder: Função para atualizar o painel de operação (LÓGICA COMPLEXA AINDA NECESSÁRIA)
    // Esta função agora receberá userSettings e precisará buscar dados de trades
    function updateOperationPanel(userSettings) { // Adicionado userSettings como parâmetro
        console.log('Updating operation panel with settings:', userSettings);
        // !! A LÓGICA COMPLETA DE CÁLCULO, GERENCIAMENTO DE CICLOS/NÍVEIS
        // !! E BUSCA DE DADOS DE TRADES DO SUPABASE IRIA AQUI !!
        // !! ISSO ENVOLVERIA USAR supabaseClient.from('trades')... !!

        // Exemplo de dados MOCKADOS (apenas para layout) - Adapte para usar userSettings e dados de trades
        const nextAction = "Aguardando Análise...";
        const recommendedValue = 0.00;
        const statusText = "Clique em 'Iniciar Análise'";
        const entriesToday = '--';
        const winsToday = '--';
        const lossesToday = '--';
        const currentPayout = userSettings ? userSettings.payout_percent : '--'; // Exemplo usando settings
        const currentBalance = userSettings ? userSettings.banca_inicial : '--'; // Exemplo inicial

        // Atualize os elementos da UI (painel de operação e métricas globais)
        if (document.getElementById('nextAction')) {
             document.getElementById('nextAction').textContent = nextAction;
             // Use o valor real calculado pela lógica, não o mockado 0.00
             document.getElementById('recommendedValue').textContent = `${userSettings ? userSettings.moeda : '$'} ${recommendedValue.toFixed(2)}`; // Adapte a moeda
             document.getElementById('statusText').textContent = statusText;
             document.getElementById('entriesToday').textContent = entriesToday;
             document.getElementById('winsToday').textContent = winsToday;
             document.getElementById('lossesToday').textContent = lossesToday;
             document.getElementById('currentPayout').textContent = `${currentPayout}%`;
             // Lógica para o indicador de progresso

             // Atualize também as métricas globais no dashboard (se não houver uma função separada)
             // Exemplo (adapte para buscar dados reais de trades):
             if (document.getElementById('bancaAtual')) document.getElementById('bancaAtual').textContent = currentBalance.toFixed(2); // Usando banca inicial ou banca real do último trade
             // Você precisará calcular rentabilidade, meta, reserva com base nos trades do usuário
             // e preencher os outros elementos (rentabilidadeGlobal, metaLucro, reservaCapital, lastUpdate)
        }
    }

    // A chamada a updateOperationPanel agora está dentro do checkAuthAndRedirect,
    // sendo chamada apenas quando o usuário está logado no dashboard.


    // --- Salvar Configurações (AGORA COM SUPABASE) ---
    // (Mantenha sua lógica existente para o formulário de configurações)
    const settingsForm = document.querySelector('.dashboard-sections form');
    if(settingsForm) {
        settingsForm.addEventListener('submit', async (event) => {
            event.preventDefault();

            const { data: { session } } = await supabaseClient.auth.getSession();
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
             if (isNaN(payout) || payout <= 0 || payout > 100) { // Assumindo payout entre 1 e 100
                 alert("Por favor, insira um Payout (%) válido entre 1 e 100.");
                 return;
             }


            // Salva/Atualiza as configurações no Supabase usando UPSERT
            // UPSERT irá inserir se user_id não existir, ou atualizar se existir (baseado em onConflict).
            const { data, error } = await supabaseClient
                 .from('settings')
                 .upsert(
                     {
                         user_id: userId, // É CRUCIAL INCLUIR user_id NO OBJETO PARA O UPSERT E RLS
                         banca_inicial: bancaInicial,
                         payout_percent: payout,
                         modo_operacao: modoOperacao,
                         moeda: moeda,
                         exibir_valores: exibirValores
                     },
                     {
                         onConflict: 'user_id' // Conflito na coluna user_id indica que já existe uma linha para este usuário, então atualize essa linha.
                     }
                 );

            if (error) {
                 console.error("Erro ao salvar configurações:", error);
                 alert("Erro ao salvar configurações: " + error.message);
            } else {
                 console.log("Configurações salvas com sucesso:", data);
                 alert("Configurações salvas!");
                 // Opcional: Recarregar métricas ou painel após salvar settings,
                 // pois os novos valores podem afetar os cálculos.
                 // Você precisaria chamar updateOperationPanel(novasSettings) ou recarregar.
                 // Se o UPSERT retornar os dados salvos (verificar docs/console), pode usá-los:
                 // if (data && data.length > 0) { updateOperationPanel(data[0]); }
                 // Melhor, simplesmente recarregar as settings do banco para ter certeza:
                 supabaseClient.auth.getUser().then(async ({data: { user }}) => {
                     if (user) {
                          const updatedSettings = await loadUserSettings(user.id);
                          if (updatedSettings) {
                               updateOperationPanel(updatedSettings); // Atualiza o painel com as settings recém-salvas/carregadas
                          }
                     }
                 });

            }
        });
    }

     // --- Placeholder para o botão "Iniciar Análise" ---
     // (Mantenha sua lógica existente, mas saiba que ela usará settings e interagirá com 'trades')
     const startOperationButton = document.querySelector('.start-operation');
     if(startOperationButton) {
         startOperationButton.addEventListener('click', () => {
              alert("Iniciando análise... (Lógica de operação precisa ser implementada)");
              // !! ADICIONAR LÓGICA PARA COMEÇAR O CICLO DE OPERAÇÕES AQUI !!
              // !! ESTA LÓGICA LERÁ AS CONFIGURAÇÕES (armazenadas em uma variável ou carregadas) !!
              // !! E SALVARÁ O ESTADO DA PRIMEIRA OPERAÇÃO (tabela 'trades') NO BD SUPABASE !!
              // !! ISSO ENVOLVERÁ USAR supabaseClient.from('trades').insert(...) !!
         });
     }

     // --- Outros Placeholders ---
     // (Mantenha os outros placeholders que você tiver)
     // A lógica de WIN/LOSS também precisará interagir com o BD Supabase para salvar o resultado da trade
     // e atualizar o estado do ciclo/nível, e então chamar updateOperationPanel para recalcular.
     // ISSO ENVOLVERÁ USAR supabaseClient.from('trades').insert(...) ou update(...)
}); // Fim do DOMContentLoaded


// Nota: Funções como loadUserSettings e updateOperationPanel precisam ser acessíveis
// (definidas fora do listener DOMContentLoaded se forem chamadas de outros lugares,
// mas no código acima loadUserSettings está fora, e updateOperationPanel está dentro
// do listener mas é chamada logo após carregar settings. Depende da sua estrutura exata).
// No código integrado acima, ambas loadUserSettings e updateOperationPanel são definidas
// no escopo do DOMContentLoaded listener. Isso funciona se elas só forem chamadas de dentro dele.
// Se você precisar chamá-las de botões (como WIN/LOSS fora deste escopo principal),
// precisará mover a definição delas para fora do addEventListener('DOMContentLoaded', ...)
