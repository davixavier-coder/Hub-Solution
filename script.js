
// Supabase Configuration (PUBLIC - Anon Key is safe for client-side use with RLS)
const SB_URL = 'https://eynifdmidipyhvdwmfes.supabase.co';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV5bmlmZG1pZGlweWh2ZHdtZmVzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDA1ODU1NjcsImV4cCI6MjA1NjE2MTU2N30.supU_B28UDHLXCPWifaHgS200_xn_6gYTgxVgchRWJ0';

document.addEventListener('DOMContentLoaded', async () => {

    // --- Initialize Supabase ---
    let supabaseClient;
    try {
        if (typeof supabase !== 'undefined') {
            supabaseClient = supabase.createClient(SB_URL, SB_KEY);
            console.log("Supabase initialized");
        } else {
            console.error("Supabase library not loaded");
            return;
        }
    } catch (e) {
        console.error("Init Error:", e);
    }

    // --- UI Elements ---
    const authOverlay = document.getElementById('auth-overlay');
    const authForm = document.getElementById('auth-form');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    // New Fields
    const signupFields = document.getElementById('signup-fields');
    const fullNameInput = document.getElementById('full-name');
    const phoneInput = document.getElementById('phone');
    const expectationsInput = document.getElementById('expectations');

    const authBtnText = document.getElementById('auth-btn-text');
    const authError = document.getElementById('auth-error');
    const toggleAuthLink = document.querySelector('#toggle-auth .link');
    const toggleAuthText = document.getElementById('toggle-auth');

    const userProfileEl = document.querySelector('.user-profile');
    const userNameEl = userProfileEl.querySelector('.name');
    const userStatusEl = userProfileEl.querySelector('.status');
    const avatarEl = userProfileEl.querySelector('.avatar');

    const generateBtn = document.getElementById('generate-btn');
    const topicInput = document.getElementById('topic');
    const resultsGrid = document.getElementById('results-grid');
    const resultsContainer = document.getElementById('results-area');

    // --- State ---
    let currentUser = null;
    let isLoginMode = true;

    // --- Auth Logic ---

    // Check Session on Start
    const checkSession = async () => {
        const { data: { session } } = await supabaseClient.auth.getSession();
        if (session) {
            handleLoginSuccess(session.user);
        } else {
            showAuthModal();
        }

        // Listen for changes
        supabaseClient.auth.onAuthStateChange((_event, session) => {
            if (session) {
                handleLoginSuccess(session.user);
            } else {
                handleLogoutSuccess();
            }
        });
    };

    // UI Toggles
    const authBox = document.querySelector('.auth-box'); // Select auth-box

    const showAuthModal = () => {
        authOverlay.classList.add('active');
        document.body.style.overflow = 'hidden'; // Prevent scrolling
    };

    const hideAuthModal = () => {
        authOverlay.classList.remove('active');
        document.body.style.overflow = '';
    };

    const toggleAuthMode = () => {
        isLoginMode = !isLoginMode;
        authError.innerText = '';

        if (isLoginMode) {
            // Login Mode
            authBox.classList.remove('signup-mode'); // Remove grid class
            authBtnText.innerText = 'Entrar';
            toggleAuthText.innerHTML = 'Não tem conta? <span class="link">Criar conta</span>';
            signupFields.style.display = 'none';
            // Remove required from hidden fields
            fullNameInput.required = false;
        } else {
            // Signup Mode
            authBox.classList.add('signup-mode'); // Add grid class
            authBtnText.innerText = 'Criar Conta';
            toggleAuthText.innerHTML = 'Já tem conta? <span class="link">Entrar</span>';
            signupFields.style.display = 'contents'; // Use contents to respect grid
            // Add required
            fullNameInput.required = true;
        }
        // Re-attach listener
        authOverlay.querySelector('.link').addEventListener('click', toggleAuthMode);
    };

    toggleAuthLink.addEventListener('click', toggleAuthMode);

    // Form Submission
    authForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = emailInput.value;
        const password = passwordInput.value;

        const fullName = fullNameInput.value;
        const phone = phoneInput.value;
        const expectations = expectationsInput.value;

        authError.innerText = '';
        authBtnText.innerText = 'Processando...';

        try {
            if (isLoginMode) {
                // Login
                const { data, error } = await supabaseClient.auth.signInWithPassword({
                    email,
                    password
                });
                if (error) throw error;
            } else {
                // Signup
                const { data, error } = await supabaseClient.auth.signUp({
                    email,
                    password,
                    options: {
                        data: {
                            full_name: fullName
                        }
                    }
                });
                if (error) throw error;
                alert("Cadastro realizado! Verifique seu email para confirmar (se necessário) e faça login.");
            }
            hideAuthModal();
        } catch (error) {
            console.error(error);
            let msg = error.message;

            if (msg === "Invalid login credentials") msg = "Email ou senha incorretos.";
            if (msg === "User already registered") msg = "Este email já está cadastrado. Tente fazer login.";
            if (msg === "Load failed" || msg === "Failed to fetch") msg = "Erro de conexão. Verifique se o servidor local está rodando.";

            alert("Erro: " + msg);
        } finally {
            authBtnText.innerText = isLoginMode ? 'Entrar' : 'Criar Conta';
        }
    });

    // Handle Logged In State
    const handleLoginSuccess = async (user) => {
        currentUser = user;
        hideAuthModal();

        // Fetch Profile Data
        let { data: profile } = await supabaseClient
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();

        // Self-Healing: Create profile if missing (Zombie User Fix)
        if (!profile) {
            console.log("Profile missing for user, creating now...");
            const fullName = user.user_metadata?.full_name || "Usuário";
            const { error: insertError } = await supabaseClient
                .from('profiles')
                .insert({
                    id: user.id,
                    username: fullName.split(' ')[0],
                    full_name: fullName,
                    is_premium: false
                });

            if (!insertError) {
                // Fetch again
                const { data: newProfile } = await supabaseClient
                    .from('profiles')
                    .select('*')
                    .eq('id', user.id)
                    .single();
                profile = newProfile;
            }
        }

        if (profile) {
            userNameEl.innerText = profile.full_name || profile.username || "Usuário";
            userStatusEl.innerText = profile.is_premium ? "Premium" : "Free Tier";
            avatarEl.innerText = (profile.username || "U")[0].toUpperCase();
        } else {
            userNameEl.innerText = "Usuário";
        }
    };

    const handleLogoutSuccess = () => {
        currentUser = null;
        userNameEl.innerText = "Visitante";
        showAuthModal();
    };

    // Logout Action (Click on Profile)
    userProfileEl.addEventListener('click', async () => {
        if (currentUser) {
            const confirmLogout = confirm("Deseja sair da sua conta?");
            if (confirmLogout) {
                await supabaseClient.auth.signOut();
            }
        }
    });

    // --- Content Generator Logic (Updated) ---

    // --- HeadCopy Chat Logic (Advanced Rant Engine) ---

    const rants = [
        {
            title: "{topic} e a Audácia do Atropelo",
            paragraphs: [
                "{topic} é o maior 'foda-se' que tu pode dar pra quem passou cinco anos numa faculdade pra aprender algo que tu faz em dois segundos com um prompt.",
                "A malandragem é rir na cara do perigo: tu usa {topic} sem entender metade do que tá ali, mas com a confiança de quem sabe que vai dar certo se a casa cair.",
                "É a delícia de ser um impostor profissional, entregando soluções com {topic} que parecem coisa de outro planeta enquanto tu só foi o cara de pau que teve coragem de dar o 'Enter'.",
                "A gente não busca perfeição em {topic}, a gente busca o que funciona e o que fatura, porque código limpo não paga o teu lifestyle de luxo nem a tua cerveja gelada."
            ]
        },
        {
            title: "{topic} de quem não tem vergonha",
            paragraphs: [
                "{topic} é o maior soco na cara do sistema porque tu levanta um projeto inteiro sem precisar ser o gênio que o mercado quer que tu seja.",
                "É a malandragem de luxo: tu usa {topic} ser o teu braço direito e entrega um trampo que o cliente acha que levou meses, mas tu resolveu enquanto via série no sofá.",
                "A gente não quer saber de teoria; se a porra do {topic} funciona e o Pix cai na conta, o resto é conversa fiada de quem gosta de sofrer.",
                "É um prazer doentio ver os puristas chorando porque o {topic} é 'sujo', enquanto tu já tá na fase de gastar o lucro."
            ]
        },
        {
            title: "O Império da Preguiça Rentável com {topic}",
            paragraphs: [
                "{topic} é o teu escravo digital de alta performance que não pede aumento, não reclama e ainda faz tu parecer um gênio pros teus clientes otários.",
                "A sem-vergonhice aqui é o padrão: tu pega uma ideia bosta de {topic}, dá um tapa e vende como se fosse a última maravilha tecnológica da humanidade.",
                "A gente não usa {topic} pra 'evoluir a espécie', a gente usa pra automatizar o tédio e transformar tempo livre em saldo positivo na conta corrente.",
                "No fundo, a gente é tudo um bando de preguiçoso esperto que descobriu que é muito melhor ser o mestre do {topic} do que ser escravo do sistema."
            ]
        },
        {
            title: "Niilismo pra quem quer lucrar com {topic}",
            paragraphs: [
                "O mundo tá girando rápido demais pra tu se preocupar com ética em {topic}: o negócio é garantir o teu agora, porque amanhã tudo pode mudar.",
                "Nada disso vai durar, então seja o cara mais sem vergonha no {topic}, ganhe o máximo que puder e viva a vida como se o servidor fosse cair a qualquer segundo.",
                "Aproveita a bagunça desse mercado de {topic} pra subir no topo, porque lá de cima o caos é muito mais bonito de se ver enquanto tu toma um drink pago com o dinheiro dos lentos."
            ]
        }
    ];

    const headlines = [
        "Por que {topic} é a mentira que você conta para dormir em paz",
        "A ruína de {topic}: Como você está destruindo tudo sem saber",
        "Ninguém se importa com seu {topic}, e aqui está o porquê",
        "Lucre alto com {topic} enquanto os idiotas seguem as regras",
        "O segredo sujo de {topic} que 'eles' não querem que você saiba",
        "Venda {topic} como um deus, entregue como um mortal",
        "Como fingir {topic} até que acreditem em você",
        "Minta sobre {topic} e fique rico rápido",
        "{topic}: O prazer culposo que ninguém admite",
        "A sedução oculta em {topic}"
    ];

    const chatHistory = document.getElementById('chat-history');
    const chatInput = document.getElementById('chat-input');
    const sendBtn = document.getElementById('send-btn');

    const appendMessage = (text, sender = 'user') => {
        if (!chatHistory) return;
        const msgDiv = document.createElement('div');
        msgDiv.className = `message ${sender}-message`;

        let avatarText = sender === 'user' ? (currentUser?.user_metadata?.full_name?.charAt(0) || 'U') : 'HC';

        msgDiv.innerHTML = `
            <div class="message-avatar">${avatarText}</div>
            <div class="message-content">${text}</div>
        `;

        chatHistory.appendChild(msgDiv);
        chatHistory.scrollTop = chatHistory.scrollHeight;
    };

    const handleChatSubmit = async () => {
        if (!chatInput) return;
        const text = chatInput.value.trim();
        if (!text) return;

        // User Message
        appendMessage(text, 'user');
        chatInput.value = '';

        // AI "Thinking"
        const loadingId = 'loading-' + Date.now();
        const loadingDiv = document.createElement('div');
        loadingDiv.className = 'message ai-message';
        loadingDiv.id = loadingId;
        loadingDiv.innerHTML = `
            <div class="message-avatar">HC</div>
            <div class="message-content"><i class="fas fa-ellipsis-h fa-spin"></i></div>
        `;
        chatHistory.appendChild(loadingDiv);
        chatHistory.scrollTop = chatHistory.scrollHeight;

        // Simulate AI Delay
        setTimeout(() => {
            const el = document.getElementById(loadingId);
            if (el) el.remove();
            generateAIResponse(text);
        }, 1500);
    };

    const generateAIResponse = (input) => {
        // Smart Topic Extraction (Regex)
        // Removes common prefixes to find the "meat" of the topic
        let topic = input.toLowerCase();
        const prefixes = [
            "fale sobre", "me de ideias de", "me dê ideias de", "ideias para",
            "quero saber sobre", "o que você acha de", "me diga sobre", "escreva sobre",
            "titulos para", "headlines para", "copy para", "vibecoding"
        ];

        // Remove prefixes
        prefixes.forEach(p => {
            if (topic.includes(p)) topic = topic.replace(p, "");
        });

        topic = topic.trim();

        // Formatting the topic for display (Capitalize first letter)
        const displayTopic = topic.charAt(0).toUpperCase() + topic.slice(1) || "o Vazio";

        // 1. Select a Random Rant Template
        const randomRant = rants[Math.floor(Math.random() * rants.length)];

        // 2. Select 3 Random Headlines
        const shuffledHeadlines = headlines.sort(() => 0.5 - Math.random());
        const selectedHeadlines = shuffledHeadlines.slice(0, 3);

        // 3. Construct the HTML
        let responseHTML = "";

        // Intro (Acidic)
        const intros = [
            `Bora, vou injetar mais ácido nessa tua veia de malandro. O papo é pra quem cansou de ser o cara que "estuda" e decidiu ser o cara que "manda".`,
            `Vou moer no ${displayTopic} agora. O papo é ácido, sem massagem e pra quem tem a cara de pau de usar o sistema a favor do bolso.`,
            `Ah, ${displayTopic}... Quer ouvir a verdade ou quer um abraço? Vou te dar a verdade, porque abraço não paga boleto.`
        ];
        responseHTML += `<p style="margin-bottom: 15px;">${intros[Math.floor(Math.random() * intros.length)]}</p>`;

        // Rant Title
        responseHTML += `<h3 style="color: var(--accent-color); font-size: 1.1rem; margin-bottom: 10px; font-weight: bold;">${randomRant.title.replace(/{topic}/g, displayTopic)}</h3>`;

        // Rant Paragraphs
        randomRant.paragraphs.forEach(p => {
            responseHTML += `<p style="margin-bottom: 10px; line-height: 1.6;">${p.replace(/{topic}/g, `<strong>${displayTopic}</strong>`)}</p>`;
        });

        // Headlines Section
        responseHTML += `<br><p style="margin-bottom: 5px; font-weight: bold; color: white;">Ideias Rápidas:</p>`;
        responseHTML += `<ul style="margin: 5px 0 15px 20px;">`;
        selectedHeadlines.forEach(h => {
            responseHTML += `<li style="margin-bottom: 8px;">${h.replace(/{topic}/g, displayTopic)}</li>`;
        });
        responseHTML += `</ul>`;

        // Save Button
        responseHTML += `
            <div style="margin-top: 10px;">
                <button class="btn-save-idea" onclick="saveGeneratedIdea('${displayTopic}')" style="background: transparent; border: 1px solid var(--accent-color); color: var(--accent-color); padding: 8px 15px; border-radius: 8px; cursor: pointer; font-size: 0.9rem; transition: all 0.2s;">
                    <i class="fas fa-save"></i> Salvar Essa Vibe
                </button>
            </div>
        `;

        appendMessage(responseHTML, 'ai');
    };

    // Listeners
    if (sendBtn) {
        sendBtn.addEventListener('click', handleChatSubmit);
    }
    if (chatInput) {
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleChatSubmit();
            }
        });
    }

    // Helper to Save from Chat
    window.saveGeneratedIdea = async (topic) => {
        if (!currentUser) alert('Faça login para salvar.');

        // Just save the topic as a generic entry for now
        const { error } = await supabaseClient
            .from('saved_titles')
            .insert({
                user_id: currentUser.id,
                topic: topic,
                style: 'HeadCopy Chat',
                generated_titles: ['Ver histórico do chat'] // Placeholder
            });

        if (error) alert('Erro ao salvar.');
        else alert('Ideia salva no banco.');
    };

    // --- Saved Ideas Logic ---
    const savedIdeasGrid = document.getElementById('saved-ideas-grid');

    const loadSavedTitles = async () => {
        if (!currentUser) {
            savedIdeasGrid.innerHTML = '<p style="color: var(--text-secondary);">Faça login para ver seus títulos salvos.</p>';
            return;
        }

        savedIdeasGrid.innerHTML = '<p style="color: var(--auth-secondary);">Carregando...</p>';

        const { data, error } = await supabaseClient
            .from('saved_titles')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            console.error("Erro ao carregar", error);
            savedIdeasGrid.innerHTML = '<p style="color: #ff5252;">Erro ao carregar dados.</p>';
            return;
        }

        if (data.length === 0) {
            savedIdeasGrid.innerHTML = '<p style="color: var(--text-secondary);">Nenhum título salvo ainda.</p>';
            return; // Add return here to stop execution
        }

        savedIdeasGrid.innerHTML = '';
        data.forEach(item => {
            const card = document.createElement('div');
            card.classList.add('result-card');
            // Parse date
            const date = new Date(item.created_at).toLocaleDateString('pt-BR');

            card.innerHTML = `
                <div style="display:flex; justify-content:space-between; margin-bottom:10px;">
                    <span class="tag">${item.style.toUpperCase()}</span>
                    <span style="font-size:0.7rem; color: var(--text-secondary);">${date}</span>
                </div>
                <p>${item.title}</p>
                <div style="margin-top:15px; display:flex; justify-content:flex-end;">
                    <i class="fas fa-trash" style="color: var(--text-secondary); cursor:pointer; font-size:0.9rem;"></i>
                </div>
            `;

            // Delete action
            card.querySelector('.fa-trash').addEventListener('click', async (e) => {
                e.stopPropagation();
                if (confirm('Deletar este título?')) {
                    await supabaseClient.from('saved_titles').delete().eq('id', item.id);
                    card.remove();
                }
            });

            savedIdeasGrid.appendChild(card);
        });
    };

    // --- Community Logic ---
    const postsContainer = document.getElementById('posts-container');
    const btnNewTopic = document.getElementById('btn-new-topic');
    const newTopicModal = document.getElementById('new-topic-modal');
    const newTopicForm = document.getElementById('new-topic-form');
    const cancelTopicBtn = document.getElementById('cancel-topic');

    // Toggle New Topic Modal
    if (btnNewTopic) {
        btnNewTopic.addEventListener('click', () => {
            if (!currentUser) {
                showAuthModal(); // Force login
                return;
            }
            newTopicModal.classList.add('active');
        });
    }

    if (cancelTopicBtn) {
        cancelTopicBtn.addEventListener('click', () => {
            newTopicModal.classList.remove('active');
        });
    }

    // Create Topic
    if (newTopicForm) {
        newTopicForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const title = document.getElementById('topic-title').value;
            const category = document.getElementById('topic-category').value;
            const content = document.getElementById('topic-content').value;

            const submitBtn = newTopicForm.querySelector('button[type="submit"]');
            const originalText = submitBtn.innerText;
            submitBtn.innerText = 'Publicando...';
            submitBtn.disabled = true;

            const { error } = await supabaseClient
                .from('community_posts')
                .insert({
                    user_id: currentUser.id,
                    title,
                    category,
                    content
                });

            if (error) {
                alert('Erro ao publicar: ' + error.message);
            } else {
                newTopicModal.classList.remove('active');
                newTopicForm.reset();
                loadCommunityPosts(); // Refresh
            }
            submitBtn.innerText = originalText;
            submitBtn.disabled = false;
        });
    }

    // Load Posts
    const loadCommunityPosts = async (filter = 'recent', category = 'all') => {
        // Ensure list is visible, details hidden
        document.getElementById('post-details-view').classList.add('hidden');
        document.querySelector('.category-tabs').classList.remove('hidden');
        document.querySelector('.posts-list-header').classList.remove('hidden');
        postsContainer.classList.remove('hidden');
        document.querySelector('.community-hero').style.display = 'block';

        postsContainer.innerHTML = '<p style="text-align:center; color: var(--text-secondary); margin-top: 40px;">Carregando discussões...</p>';

        let query = supabaseClient
            .from('community_posts')
            .select(`
                *,
                profiles(username, full_name, is_premium)
            `)
            .order('created_at', { ascending: false });

        if (category !== 'all') {
            query = query.eq('category', category);
        }

        const { data, error } = await query;

        if (error) {
            console.error(error);
            postsContainer.innerHTML = '<p style="text-align:center; color: #ff5252;">Erro ao carregar tópicos.</p>';
            return;
        }

        if (data.length === 0) {
            postsContainer.innerHTML = `
                <div style="text-align:center; padding: 40px; color: var(--text-secondary);">
                    <i class="fas fa-comments" style="font-size: 3rem; margin-bottom: 20px; opacity: 0.5;"></i>
                    <p>Nenhuma discussão encontrada.</p>
                    <p>Seja o primeiro a criar um tópico!</p>
                </div>
            `;
            return;
        }

        postsContainer.innerHTML = '';
        data.forEach(post => {
            const el = document.createElement('div');
            el.className = 'post-card';

            // Safe profile access
            const profile = post.profiles || {};
            const userName = profile.full_name || profile.username || 'Usuário';
            const initial = userName.charAt(0).toUpperCase();

            // Time config
            const timeDate = new Date(post.created_at);
            const timeString = timeDate.toLocaleDateString('pt-BR') + ' às ' + timeDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

            el.innerHTML = `
                <div class="post-header">
                    <div class="post-avatar">${initial}</div>
                    <div class="post-meta">
                        <span style="color: white; font-weight: 500;">${userName}</span>
                        ${profile.is_premium ? '<i class="fas fa-crown" style="color: gold; margin-left: 5px; font-size: 0.8rem;"></i>' : ''}
                        <br>
                        <span style="font-size: 0.75rem;">${timeString}</span>
                    </div>
                </div>
                <h3 class="post-title">${post.title}</h3>
                <div class="post-body" style="color: var(--text-secondary); font-size: 0.95rem; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">
                    ${post.content}
                </div>
                <div class="post-stats">
                    <span class="post-category-badge">${post.category}</span>
                    <span><i class="fas fa-eye"></i> ${post.views}</span>
                    <span><i class="fas fa-comment"></i> <span class="comment-count-badge">Ver</span></span>
                </div>
            `;
            // Click to View Details
            el.addEventListener('click', () => viewPostDetails(post));
            postsContainer.appendChild(el);
        });
    };

    // --- Post Details Logic ---
    let currentPostId = null;

    const viewPostDetails = async (post) => {
        currentPostId = post.id;

        // Hide List, Show Details
        postsContainer.classList.add('hidden');
        document.querySelector('.category-tabs').classList.add('hidden');
        document.querySelector('.posts-list-header').classList.add('hidden');
        // Optionally hide hero or shrink it. For now, let's keep it but maybe hide filters?
        // Let's hide the big hero content for focus
        document.querySelector('.community-hero').style.display = 'none';

        const detailsView = document.getElementById('post-details-view');
        detailsView.classList.remove('hidden');

        // Render Selected Post
        const contentDiv = document.getElementById('selected-post-content');
        const profile = post.profiles || {};
        const userName = profile.full_name || profile.username || 'Usuário';
        const initial = userName.charAt(0).toUpperCase();
        const timeDate = new Date(post.created_at);
        const timeString = timeDate.toLocaleDateString('pt-BR') + ' às ' + timeDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

        contentDiv.innerHTML = `
            <div class="post-card" style="cursor: default; border-color: var(--teal); background: rgba(0, 229, 255, 0.05);">
                <div class="post-header">
                    <div class="post-avatar" style="width: 48px; height: 48px; font-size: 1.2rem;">${initial}</div>
                    <div class="post-meta">
                        <span style="color: white; font-weight: 600; font-size: 1.1rem;">${userName}</span>
                        ${profile.is_premium ? '<i class="fas fa-crown" style="color: gold; margin-left: 5px;"></i>' : ''}
                        <br>
                        <span style="font-size: 0.85rem;">${timeString}</span>
                    </div>
                </div>
                <h1 style="font-size: 1.8rem; margin: 20px 0 15px; color: white;">${post.title}</h1>
                <div class="post-body" style="color: var(--text-primary); font-size: 1rem; line-height: 1.6; white-space: pre-wrap;">${post.content}</div>
                <div class="post-stats" style="margin-top: 25px; pt-top: 15px; border-top: 1px solid rgba(255,255,255,0.1);">
                    <span class="post-category-badge">${post.category}</span>
                    <span><i class="fas fa-eye"></i> ${post.views} visualizações</span>
                </div>
            </div>
        `;

        // Increment Views
        await supabaseClient.from('community_posts').update({ views: post.views + 1 }).eq('id', post.id);

        loadComments(post.id);
    };

    const loadComments = async (postId) => {
        const commentsContainer = document.getElementById('comments-container');
        const countHeader = document.getElementById('comments-count');

        commentsContainer.innerHTML = '<p>Carregando respostas...</p>';

        const { data, error } = await supabaseClient
            .from('community_comments')
            .select(`*, profiles(username, full_name, is_premium)`)
            .eq('post_id', postId)
            .order('created_at', { ascending: true });

        if (error) {
            console.error(error);
            commentsContainer.innerHTML = '<p>Erro ao carregar respostas.</p>';
            return;
        }

        countHeader.innerText = `${data.length} Resposta(s)`;

        if (data.length === 0) {
            commentsContainer.innerHTML = '<p style="color: var(--text-secondary); font-style: italic;">Nenhuma resposta ainda. Seja o primeiro!</p>';
            return;
        }

        commentsContainer.innerHTML = '';
        data.forEach(comment => {
            const el = document.createElement('div');
            el.className = 'comment';

            const profile = comment.profiles || {};
            const userName = profile.full_name || profile.username || 'Usuário';
            const initial = userName.charAt(0).toUpperCase();
            const timeDate = new Date(comment.created_at);
            const timeString = timeDate.toLocaleDateString('pt-BR') + ' às ' + timeDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

            el.innerHTML = `
                <div class="post-header">
                    <div class="post-avatar" style="background: var(--surface); border: 1px solid var(--border-light); color: white;">${initial}</div>
                    <div class="post-meta">
                        <span style="color: white; font-weight: 500;">${userName}</span>
                        ${profile.is_premium ? '<i class="fas fa-crown" style="color: gold; margin-left: 5px; font-size: 0.8rem;"></i>' : ''}
                        <br>
                        <span style="font-size: 0.75rem;">${timeString}</span>
                    </div>
                </div>
                <div style="margin-left: 44px; margin-top: 5px; color: var(--text-secondary); line-height: 1.5;">
                    ${comment.content}
                </div>
            `;
            commentsContainer.appendChild(el);
        });
    };

    // Back Button
    document.getElementById('back-to-posts').addEventListener('click', () => {
        loadCommunityPosts();
    });

    // New Comment Submit
    document.getElementById('new-comment-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!currentUser) {
            showAuthModal();
            return;
        }
        if (!currentPostId) return;

        const content = document.getElementById('comment-content').value;
        const btn = e.target.querySelector('button');
        const originalText = btn.innerHTML;

        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enviando...';
        btn.disabled = true;

        const { error } = await supabaseClient
            .from('community_comments')
            .insert({
                post_id: currentPostId,
                user_id: currentUser.id,
                content: content
            });

        if (error) {
            alert('Erro ao enviar resposta: ' + error.message);
        } else {
            document.getElementById('comment-content').value = '';
            loadComments(currentPostId);
        }
        btn.innerHTML = originalText;
        btn.disabled = false;
    });

    // Category Tabs Logic
    document.querySelectorAll('.cat-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.cat-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            const cat = tab.getAttribute('data-cat');
            loadCommunityPosts('recent', cat);
        });
    });

    // --- Navigation ---
    const navItems = document.querySelectorAll('.nav-item');
    const views = document.querySelectorAll('.view');
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = item.getAttribute('data-tab');

            // If checking ideas, load them
            if (targetId === 'ideas') loadSavedTitles();
            // If community, load posts
            if (targetId === 'community') loadCommunityPosts();

            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');
            views.forEach(view => {
                view.classList.remove('active');
                if (view.id === targetId) view.classList.add('active');
            });
        });
    });

    // Input Highlights
    [topicInput, emailInput, passwordInput].forEach(input => {
        if (!input) return;
        input.addEventListener('focus', () => input.parentElement.classList.add('focused'));
        input.addEventListener('blur', () => input.parentElement.classList.remove('focused'));
    });

    // Start
    checkSession();
});
