document.addEventListener('DOMContentLoaded', () => {

    // --- Autenticação (Tabs) ---
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

    // Initially show the login form
    if (document.getElementById('login')) {
         document.getElementById('login').classList.add('active');
    }


    // --- Placeholders para Lógica Dinâmica (Página Inicial) ---

    // Simula o carregamento inicial de dados (DEVE SER REALIZADO VIA BACKEND/SUPABASE)
    function loadInitialMetrics() {
        // !! ESTES SÃO DADOS MOCKADOS (FAKE) APENAS PARA VISUALIZAÇÃO !!
        // !! SUBSTITUIR COM CHAMADAS AO BACKEND/SUPABASE !!
        const bancaAtual = 5500.75; // Exemplo
        const rentabilidadeGlobal = 1250.30; // Exemplo
        const metaLucro = 150.00; // Exemplo (calculado pela lógica interna)
        const reservaCapital = rentabilidadeGlobal - metaLucro; // Exemplo

        document.getElementById('bancaAtual').textContent = bancaAtual.toFixed(2);
        // Adiciona cor positiva/negativa dependendo do valor
        const rentabilidadeSpan = document.getElementById('rentabilidadeGlobal');
        rentabilidadeSpan.textContent = rentabilidadeGlobal.toFixed(2);
        rentabilidadeSpan.classList.add(rentabilidadeGlobal >= 0 ? 'positive' : 'negative');


        document.getElementById('metaLucro').textContent = metaLucro.toFixed(2);

        const reservaSpan = document.getElementById('reservaCapital');
         reservaSpan.textContent = reservaCapital.toFixed(2);
         reservaSpan.classList.add(reservaCapital >= 0 ? 'positive' : 'negative');


        const now = new Date();
        document.getElementById('lastUpdate').textContent = now.toLocaleTimeString();

        // !! Em um app real, isso seria atualizado periodicamente via WebSocket ou polling !!
    }

    // Carrega as métricas ao carregar a página se os elementos existirem
    if (document.getElementById('bancaAtual')) {
        loadInitialMetrics();
        // setInterval(loadInitialMetrics, 10000); // Exemplo: atualizar a cada 10 segundos (NÃO RECOMENDADO PARA PRODUÇÃO ASSIM)
    }


    // --- Placeholders para Lógica do Dashboard ---

    // Função para atualizar o painel de operação (DEVE SER POPULADA PELA LÓGICA INTERNA)
    function updateOperationPanel() {
        // !! LÓGICA COMPLEXA DE CÁLCULO (CICLOS, NÍVEIS, VALORES) VAI AQUI !!
        // !! RECEBER DADOS DO BACKEND/SUPABASE !!

        // Exemplo de dados (MOCKADOS)
        const nextAction = "COMPRAR EUR/USD"; // Determinada pela lógica interna
        const recommendedValue = 75.50; // Calculado pela lógica interna
        const statusText = "Aguardando próxima entrada..."; // Determinado pela lógica
        const entriesToday = 5; // Do histórico/BD
        const winsToday = 3; // Do histórico/BD
        const lossesToday = 2; // Do histórico/BD
        const currentPayout = 87; // Da configuração do usuário

        if (document.getElementById('nextAction')) {
             document.getElementById('nextAction').textContent = nextAction;
             document.getElementById('recommendedValue').textContent = `$ ${recommendedValue.toFixed(2)}`;
             document.getElementById('statusText').textContent = statusText;
             document.getElementById('entriesToday').textContent = entriesToday;

             const winsSpan = document.getElementById('winsToday');
             winsSpan.textContent = winsToday;
             winsSpan.classList.add(winsToday > 0 ? 'positive' : ''); // Adiciona cor se houver wins

             const lossesSpan = document.getElementById('lossesToday');
             lossesSpan.textContent = lossesToday;
             lossesSpan.classList.add(lossesToday > 0 ? 'negative' : ''); // Adiciona cor se houver losses

             document.getElementById('currentPayout').textContent = `${currentPayout}%`;

             // Atualizar o indicador de progresso (Exemplo simples)
             const progressIndicator = document.querySelector('.progress-indicator::after');
             // Lógica para definir a largura baseada no progresso real da operação (muito complexo para o placeholder)
             // progressIndicator.style.width = 'XX%';
        }
    }

    // Carrega o painel do dashboard se os elementos existirem
     if (document.getElementById('nextAction')) {
        updateOperationPanel();
     }


    // Placeholder para salvar configurações (DEVE INTERAGIR COM O BACKEND/SUPABASE)
    const settingsForm = document.querySelector('.dashboard-sections form');
    if(settingsForm) {
        settingsForm.addEventListener('submit', (event) => {
            event.preventDefault(); // Impede o envio padrão do formulário

            // !! COLETAR DADOS DO FORMULÁRIO !!
            const bancaInicial = document.getElementById('bancaInicial').value;
            const payout = document.getElementById('payout').value;
            const modoOperacao = document.getElementById('modoOperacao').value;
            const moeda = document.getElementById('moedas').value;
            const exibirValores = document.getElementById('valores').value;

            console.log("Configurações Salvas (DEBUG):", {
                bancaInicial,
                payout,
                modoOperacao,
                moeda,
                exibirValores
            });

            // !! ENVIAR ESTES DADOS PARA O BACKEND/SUPABASE !!
            // !! TRATAR RESPOSTA E DAR FEEDBACK AO USUÁRIO !!

            alert("Configurações salvas! (Implementação de backend necessária)"); // Feedback básico
        });
    }

     // Placeholder para o botão "Iniciar Análise"
     const startOperationButton = document.querySelector('.start-operation');
     if(startOperationButton) {
        startOperationButton.addEventListener('click', () => {
             alert("Iniciando análise... (Lógica de operação precisa ser implementada)");
             // !! ADICIONAR LÓGICA PARA COMEÇAR O CICLO DE OPERAÇÕES !!
        });
     }


    // --- Lógica de Autenticação (Placeholder) ---
    // !! ESTA LÓGICA DEVE INTERAGIR COM O SUPABASE AUTH !!

    const loginForm = document.querySelector('#login form');
    const registerForm = document.querySelector('#register form');

    if(loginForm) {
        loginForm.addEventListener('submit', (event) => {
            event.preventDefault();
            const email = document.getElementById('login-email').value;
            const password = document.getElementById('login-password').value;

            console.log("Tentativa de Login:", { email, password });

            // !! CHAMAR FUNÇÃO DE LOGIN DO SUPABASE AQUI !!
            // ex: const { user, error } = await supabase.auth.signIn({ email, password });

            // !! TRATAR RESPOSTA: redirecionar para dashboard em caso de sucesso, mostrar erro em caso de falha !!
            alert("Login tentado! (Implementação Supabase Auth necessária)"); // Feedback básico
            // if (user) { window.location.href = 'dashboard.html'; } else { alert(error.message); }
        });
    }

     if(registerForm) {
        registerForm.addEventListener('submit', (event) => {
            event.preventDefault();
            const name = document.getElementById('register-name').value;
            const email = document.getElementById('register-email').value;
            const password = document.getElementById('register-password').value;
            const confirmPassword = document.getElementById('register-confirm-password').value;

            if (password !== confirmPassword) {
                 alert("As senhas não coincidem!");
                 return;
            }

            console.log("Tentativa de Cadastro:", { name, email, password });

            // !! CHAMAR FUNÇÃO DE CADASTRO DO SUPABASE AQUI !!
             // ex: const { user, error } = await supabase.auth.signUp({ email, password });
             //    await supabase.from('users').insert([{ id: user.id, name: name }]); // Exemplo: Salvar nome em outra tabela

            // !! TRATAR RESPOSTA: redirecionar ou mostrar mensagem de sucesso/erro !!
            alert("Cadastro tentado! (Implementação Supabase Auth necessária)"); // Feedback básico
             // if (user) { alert("Usuário cadastrado! Faça login agora."); } else { alert(error.message); }

        });
     }

     // Lógica para verificar se o usuário está logado e redirecionar (para o dashboard.html)
     // ou mostrar a página inicial apropriada (para index.html)
     // !! ESSA LÓGICA TAMBÉM PRECISA DO SUPABASE AUTH !!
     function checkAuthStatus() {
        // !! const user = supabase.auth.user(); !!
        // !! if (user && window.location.pathname === '/index.html') { window.location.href = 'dashboard.html'; } !!
        // !! if (!user && window.location.pathname === '/dashboard.html') { window.location.href = 'index.html'; } !!
     }
     // checkAuthStatus(); // Chamar ao carregar a página

});