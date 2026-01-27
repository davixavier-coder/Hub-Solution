
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

    // --- HeadCopy Chat Logic (Gemini AI Powered) ---

    const chatHistory = document.getElementById('chat-history');
    const chatInput = document.getElementById('chat-input');
    const sendBtn = document.getElementById('send-btn');

    const appendMessage = (text, sender = 'user') => {
        if (!chatHistory) return;
        const msgDiv = document.createElement('div');
        msgDiv.className = `message ${sender}-message`;

        let avatarText = sender === 'user' ? (currentUser?.user_metadata?.full_name?.charAt(0) || 'U') : 'HC';

        // If sender is AI, text is likely HTML. 
        // If sender is User, text is plain text (escape it to be safe, but for now innerHTML is used for both for simplicity in this demo context)

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

        // Call Edge Function
        try {
            const { data, error } = await supabaseClient.functions.invoke('headcopy-chat', {
                body: { prompt: text }
            });

            // Remove loading
            const loadingEl = document.getElementById(loadingId);
            if (loadingEl) loadingEl.remove();

            if (error) {
                console.error("Function Error:", error);
                appendMessage("Erro de conexão com o cérebro da Matrix. Tente de novo.", 'ai');
                return;
            }

            // data.result contains the HTML from Gemini
            const aiResponse = data.result || "Ocorreu um erro ao gerar a resposta.";

            // Append with Save Button appended manually if not present
            // The AI is instructed to return HTML, but we might want to ensure the Save button exists for specific topics
            // We can extract topic from input to save it

            // Simple extraction for "Save Idea" button context
            let topic = text.toLowerCase().replace('fale sobre', '').replace('ideias para', '').trim();
            if (topic.length > 20) topic = "Conversa HeadCopy";

            const finalHTML = aiResponse + `
                <div style="margin-top: 15px; pt-top: 10px; border-top: 1px solid rgba(255,255,255,0.1);">
                    <button class="btn-save-idea" onclick="saveGeneratedIdea('${topic}')" style="background: transparent; border: 1px solid var(--accent-color); color: var(--accent-color); padding: 6px 12px; border-radius: 8px; cursor: pointer; font-size: 0.8rem; transition: all 0.2s;">
                        <i class="fas fa-save"></i> Salvar Ideia
                    </button>
                </div>
            `;

            appendMessage(finalHTML, 'ai');

        } catch (err) {
            console.error("Request Error:", err);
            const loadingEl = document.getElementById(loadingId);
            if (loadingEl) loadingEl.remove();
            appendMessage("Erro crítico no sistema. O servidor explodiu.", 'ai');
        }
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

    // --- Media Library Logic ---
    const dropZone = document.getElementById('drop-zone');
    const fileUpload = document.getElementById('file-upload');
    const mediaDescInput = document.getElementById('media-description');
    const btnSaveMedia = document.getElementById('btn-save-media');
    const mediaGallery = document.getElementById('media-gallery');
    const suggestionsList = document.getElementById('prompt-suggestions');

    let pendingFiles = [];

    // Drag & Drop Events
    if (dropZone) {
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, preventDefaults, false);
        });

        function preventDefaults(e) {
            e.preventDefault();
            e.stopPropagation();
        }

        ['dragenter', 'dragover'].forEach(eventName => {
            dropZone.addEventListener(eventName, highlight, false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, unhighlight, false);
        });

        function highlight(e) {
            dropZone.classList.add('dragover');
        }

        function unhighlight(e) {
            dropZone.classList.remove('dragover');
        }

        dropZone.addEventListener('drop', handleDrop, false);
        dropZone.addEventListener('click', () => fileUpload.click());
    }

    if (fileUpload) {
        fileUpload.addEventListener('change', (e) => handleFiles(e.target.files));
    }

    function handleDrop(e) {
        const dt = e.dataTransfer;
        const files = dt.files;
        handleFiles(files);
    }

    function handleFiles(files) {
        if (!currentUser) {
            showAuthModal();
            return;
        }

        pendingFiles = [...files];
        if (pendingFiles.length > 0) {
            // Visual feedback
            const count = pendingFiles.length;
            dropZone.innerHTML = `
                <i class="fas fa-check-circle" style="color: var(--teal);"></i>
                <p>${count} arquivo(s) selecionado(s)</p>
                <span class="small-text">Adicione uma descrição e clique em Salvar</span>
            `;
            btnSaveMedia.disabled = false;
        }
    }

    // Save Media
    if (btnSaveMedia) {
        btnSaveMedia.addEventListener('click', async () => {
            if (pendingFiles.length === 0 || !currentUser) return;

            const description = mediaDescInput.value.trim();
            if (!description) {
                alert('Por favor, adicione uma descrição ou contexto.');
                return;
            }

            const originalText = btnSaveMedia.innerHTML;
            btnSaveMedia.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...';
            btnSaveMedia.disabled = true;

            try {
                const uploadedUrls = [];

                // 1. Upload Files
                for (const file of pendingFiles) {
                    const fileExt = file.name.split('.').pop();
                    const fileName = `${currentUser.id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

                    const { error: uploadError } = await supabaseClient
                        .storage
                        .from('media-library')
                        .upload(fileName, file);

                    if (uploadError) throw uploadError;

                    // Get Public URL
                    const { data: { publicUrl } } = supabaseClient
                        .storage
                        .from('media-library')
                        .getPublicUrl(fileName);

                    uploadedUrls.push(publicUrl);

                    // 2. Save Metadata
                    const { error: dbError } = await supabaseClient
                        .from('media_items')
                        .insert({
                            user_id: currentUser.id,
                            url: publicUrl,
                            description: description
                        });

                    if (dbError) throw dbError;
                }

                // 3. Save Suggestion logic (Smart Auto-complete)
                // Check if exists
                const { data: existing } = await supabaseClient
                    .from('prompt_suggestions')
                    .select('*')
                    .eq('text', description)
                    .single();

                if (existing) {
                    // Update usage count
                    await supabaseClient
                        .from('prompt_suggestions')
                        .update({
                            usage_count: existing.usage_count + 1,
                            last_used_at: new Date()
                        })
                        .eq('id', existing.id);
                } else {
                    // Insert new
                    await supabaseClient
                        .from('prompt_suggestions')
                        .insert({ text: description });
                }

                // 4. Send to Webhook (N8N)
                try {
                    const webhookUrl = 'https://n8n.felpsautomacoes.site/webhook/Saas';
                    await fetch(webhookUrl, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            user: currentUser,
                            description: description,
                            images: uploadedUrls,
                            timestamp: new Date().toISOString()
                        })
                    });
                    console.log('Webhook sent successfully');
                } catch (webhookError) {
                    console.error("Webhook error:", webhookError);
                    // Don't block success message
                }

                alert('Arquivos salvos com sucesso!');

                // Reset UI
                pendingFiles = [];
                mediaDescInput.value = '';
                dropZone.innerHTML = `
                    <i class="fas fa-cloud-upload-alt"></i>
                    <p>Arraste e solte suas imagens aqui</p>
                    <span class="small-text">ou clique para selecionar</span>
                    <input type="file" id="file-upload" multiple accept="image/*" style="display: none;">
                `;
                btnSaveMedia.disabled = true;

                // Reload Gallery & Suggetions
                loadMediaLibrary();
                loadSuggestions();

            } catch (error) {
                console.error(error);
                alert('Erro ao salvar: ' + error.message);
            } finally {
                btnSaveMedia.innerHTML = originalText;
            }
        });
    }

    // Load Media Library
    const loadMediaLibrary = async () => {
        if (!mediaGallery || !currentUser) return;

        mediaGallery.innerHTML = '<p style="color: var(--text-secondary); text-align: center; width: 100%;">Carregando...</p>';

        const { data, error } = await supabaseClient
            .from('media_items')
            .select('*')
            .eq('user_id', currentUser.id)
            .order('created_at', { ascending: false });

        if (error) {
            mediaGallery.innerHTML = '<p>Erro ao carregar galeria.</p>';
            return;
        }

        if (data.length === 0) {
            mediaGallery.innerHTML = '<p style="color: var(--text-secondary); text-align: center; width: 100%;">Nenhuma mídia encontrada. Faça seu primeiro upload!</p>';
            return;
        }

        mediaGallery.innerHTML = '';
        data.forEach(item => {
            const el = document.createElement('div');
            el.className = 'media-item';
            el.innerHTML = `
                <img src="${item.url}" alt="Media" loading="lazy">
                <div class="media-overlay">
                    <p>${item.description}</p>
                </div>
            `;
            mediaGallery.appendChild(el);
        });
    };

    // Load Suggestions
    const loadSuggestions = async () => {
        if (!suggestionsList) return;

        const { data, error } = await supabaseClient
            .from('prompt_suggestions')
            .select('text')
            .order('usage_count', { ascending: false })
            .limit(20);

        if (!error && data) {
            suggestionsList.innerHTML = '';
            data.forEach(item => {
                const option = document.createElement('option');
                option.value = item.text;
                suggestionsList.appendChild(option);
            });
        }
    };

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
            // If media library, load it
            if (targetId === 'media-library') {
                loadMediaLibrary();
                loadSuggestions();
            }

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
