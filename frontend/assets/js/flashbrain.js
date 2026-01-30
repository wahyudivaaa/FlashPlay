
// ==========================================
// AI BRAIN & HISTORY MANAGER
// ==========================================
const FlashBrain = {
  isAIMode: false,
  
  init() {
    this.setupAIButton();
  },

  setupAIButton() {
    const aiBtn = document.getElementById('ai-toggle-btn');
    const searchInput = document.getElementById('main-search-input');
    const searchIcon = document.querySelector('.search-icon');
    if (!aiBtn || !searchInput) return;

    aiBtn.addEventListener('click', () => {
      this.isAIMode = !this.isAIMode;
      if (this.isAIMode) {
        aiBtn.classList.add('active');
        searchInput.placeholder = 'Ask AI: Sad movies with happy ending...';
        searchInput.style.borderColor = '#a78bfa';
        searchIcon.className = 'fas fa-sparkles search-icon';
        // Optional: show toast
      } else {
        aiBtn.classList.remove('active');
        searchInput.placeholder = 'Search movies...';
        searchInput.style.borderColor = 'rgba(255, 255, 255, 0.1)';
        searchIcon.className = 'fas fa-search search-icon';
      }
      searchInput.focus();
    });

    // Hook logic is handled in handleSearch() or keypress
    searchInput.addEventListener('keypress', async (e) => {
        if (e.key === 'Enter' && this.isAIMode && searchInput.value.trim().length > 3) {
            e.preventDefault();
            e.stopPropagation();
            await this.askAI(searchInput.value.trim());
        }
    });
  },

  async askAI(query) {
    const container = document.getElementById('movieContainer');
    if (!container) return;
    container.innerHTML = '<div class="loader-spinner"></div>';
    
    // Force switch to movies view
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    document.querySelector('.nav-link[data-page="movies"]')?.classList.add('active');
    document.getElementById('home-content').style.display = 'none';
    document.getElementById('movies-page-content').style.display = 'block';
    
    // Set title safely
    const titleEl = document.querySelector('.section-title');
    if(titleEl) titleEl.textContent = '🌟 AI Recommendations for: ' + query;
    
    const sidebar = document.querySelector('.series-sidebar');
    if(sidebar) sidebar.style.display = 'none';
    
    const mainCol = document.querySelector('.main-content-column');
    if(mainCol) mainCol.style.width = '100%';

    try {
      const res = await fetch(API_BASE_URL + '/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mood: query })
      });
      
      if (!res.ok) throw new Error('AI Busy');
      
      // Data is now ENRICHED TMDB objects from backend
      const recs = await res.json();
      
      if (recs.length === 0) {
         container.innerHTML = '<div class="error-msg">No matches found. AI might be sleeping.</div>'; 
         return;
      }
      
      // Use STANDARD display function for consistent UI
      if (window.displayMovies) {
          window.displayMovies(recs);
          
          // Optional: Add "AI Reason" badges or tooltips dynamically if needed
          // For now, let's inject the reason as a small overlay/toast or just console it
          // Or we can modify the DOM after rendering to insert the reason
          const cards = container.querySelectorAll('.movie-card');
          cards.forEach((card, index) => {
              const rec = recs[index];
              if (rec && rec.ai_reason) {
                  // Create a reason badge
                  const badge = document.createElement('div');
                  badge.className = 'ai-reason-badge';
                  badge.style.cssText = 'position:absolute; bottom:0; left:0; width:100%; background:rgba(124, 58, 237, 0.9); color:white; font-size:11px; padding:5px; transform:translateY(100%); transition:transform 0.3s; z-index:10; pointer-events:none;';
                  badge.innerText = "💡 " + rec.ai_reason;
                  
                  const posterCont = card.querySelector('.movie-poster-container');
                  if (posterCont) {
                      posterCont.style.overflow = 'hidden'; // Ensure badge hides
                      posterCont.appendChild(badge);
                      
                      // Hover effect handled by CSS or JS
                      posterCont.addEventListener('mouseenter', () => badge.style.transform = 'translateY(0)');
                      posterCont.addEventListener('mouseleave', () => badge.style.transform = 'translateY(100%)');
                  }
              }
          });

      } else {
          console.error("displayMovies not found!");
          container.innerHTML = '<div class="error-msg">Error: Display function missing.</div>';
      }

    } catch (e) {
        console.error(e);
        container.innerHTML = '<div class="error-msg">AI Brain Overloaded. Please try again.</div>';
    }
  },
  
  addToHistory(id, title) {
      if(!title) return;
      let hist = JSON.parse(localStorage.getItem('flash_history') || '[]');
      hist = hist.filter(h => h.id != id);
      hist.unshift({ id, title, date: Date.now() });
      if (hist.length > 10) hist.pop();
      localStorage.setItem('flash_history', JSON.stringify(hist));
      console.log('Saved to history:', title);
  }
};

// Auto Init
setTimeout(() => FlashBrain.init(), 1000);
