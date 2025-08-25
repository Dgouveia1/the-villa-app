document.addEventListener('DOMContentLoaded', () => {

    // --- CONFIGURAÇÕES DO SUPABASE ---
    const SUPABASE_URL = 'https://xjxwghcvmrzeuoovamnb.supabase.co'; 
    const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhqeHdnaGN2bXJ6ZXVvb3ZhbW5iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA5NDkwNDIsImV4cCI6MjA2NjUyNTA0Mn0.ajRXJddLF-oTrP19knDB4eEsg-p33F_wi3MU-Xxly3s';

    const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

    // --- ELEMENTOS DO DOM ---
    const clockDisplay = document.getElementById('clock-display');
    const notificationArea = document.getElementById('notification-area');
    const historyContainer = document.getElementById('history-container');

    // --- VARIÁVEIS GLOBAIS ---
    let totalSeconds = 0;
    let timerInterval = null;

    // --- FUNÇÕES ---

    /**
     * Busca a foto de perfil de um usuário do Instagram.
     * Retorna a URL da imagem em caso de sucesso ou null em caso de erro.
     */
    async function fetchInstagramProfilePic(userName) {
        if (!userName || userName.toLowerCase() === 'anônimo') {
            return null;
        }

        const url = `https://instagram-profile1.p.rapidapi.com/getprofileinfo/${userName}`;
        const options = {
            method: 'GET',
            headers: {
                'x-rapidapi-host': 'instagram-profile1.p.rapidapi.com',
                'x-rapidapi-key': '6d85b70eefmsh1bdebe6cd97d022p1aa94fjsna9654c58e6e1' // Sua chave da API
            }
        };

        try {
            console.log(`Buscando foto para @${userName}...`);
            const response = await fetch(url, options);

            if (!response.ok) {
                throw new Error(`Erro na API: ${response.statusText}`);
            }

            const data = await response.json();
            
            if (data.is_private || !data.profile_pic_url_proxy) { // Verificamos a URL de proxy
                console.warn(`Perfil @${userName} é privado ou não tem foto.`);
                return null;
            }

            console.log(`Foto de @${userName} encontrada!`);
            // MUDANÇA PRINCIPAL AQUI: Usamos a URL de proxy
            return data.profile_pic_url_proxy; 

        } catch (error) {
            console.error(`Falha ao buscar perfil @${userName}:`, error.message);
            return null;
        }
    }

    async function showNotification(user, minutes) {
        const userName = user || 'Anônimo';
        const profilePicUrl = await fetchInstagramProfilePic(user);

        const notificationCard = document.createElement('div');
        notificationCard.className = 'notification-card';
        
        if (profilePicUrl) {
            const profileImg = document.createElement('img');
            profileImg.src = profilePicUrl;
            profileImg.className = 'profile-pic';
            notificationCard.appendChild(profileImg);
        }
        
        const textContent = document.createElement('span');
        textContent.textContent = `+${minutes} min por conta de @${userName}! 🍻`;
        notificationCard.appendChild(textContent);
        
        notificationArea.innerHTML = '';
        notificationArea.appendChild(notificationCard);

        setTimeout(() => {
            notificationCard.classList.add('sliding-out');
            setTimeout(() => {
                notificationCard.remove(); 
                
                const historyCard = document.createElement('div');
                historyCard.className = 'history-card';
                
                if (profilePicUrl) {
                    const historyImg = document.createElement('img');
                    historyImg.src = profilePicUrl;
                    historyImg.className = 'profile-pic';
                    historyCard.appendChild(historyImg);
                }

                const historyText = document.createElement('span');
                historyText.textContent = `+${minutes} min por @${userName}`;
                historyCard.appendChild(historyText);
                
                historyContainer.prepend(historyCard);

                if (historyContainer.children.length > 10) {
                    historyContainer.lastElementChild.remove();
                }
            }, 500);
        }, 4500);
    }

    function formatTime(seconds) {
        const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
        const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
        const s = Math.floor(seconds % 60).toString().padStart(2, '0');
        return `${h}:${m}:${s}`;
    }

    function updateClock() {
        if (totalSeconds > 0) totalSeconds--;
        else totalSeconds = 0;
        clockDisplay.textContent = formatTime(totalSeconds);
    }

    function listenForTimeUpdates() {
        supabaseClient
            .channel('timer_state_changes')
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'timer_state' }, (payload) => {
                totalSeconds = payload.new.total_seconds;
            })
            .subscribe();
    }
    
    function listenForNotifications() {
        supabaseClient
            .channel('events_changes')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'events' }, (payload) => {
                showNotification(payload.new.user_name, payload.new.minutes_added);
            })
            .subscribe();
    }

    async function initializeClock() {
        try {
            const { data, error } = await supabaseClient
                .from('timer_state')
                .select('total_seconds')
                .eq('id', 1);

            if (error) throw error;
            totalSeconds = (data && data.length > 0) ? data[0].total_seconds : 0;
            
            if (timerInterval) clearInterval(timerInterval);
            timerInterval = setInterval(updateClock, 1000);

            listenForTimeUpdates();
            listenForNotifications();
        } catch (error) {
            console.error('Erro ao inicializar o relógio:', error.message);
            clockDisplay.textContent = "ERRO";
        }
    }

    initializeClock();
});