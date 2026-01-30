
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
    if(titleEl) titleEl.textContent = 'AI Recommendations for: ' + query;
    
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
      
      const recs = await res.json();
      
      if (recs.length === 0) {
         container.innerHTML = '<div class="error-msg">No matches found.</div>'; 
         return;
      }
      
      container.innerHTML = '';
      
      for (const rec of recs) {
          // Fetch TMDB poster
          const tmdbRes = await fetch(API_BASE_URL + '/movies/search?query=' + encodeURIComponent(rec.title));
          const tmdbData = await tmdbRes.json();
          let movie = tmdbData.results && tmdbData.results[0];
          
          if (movie) {
              // Create card using existing function
              // Add reason to overview or create custom card
              // For now, standard card
              const card = document.createElement("div");
              card.className = "movie-card";
            
              const posterPath = movie.poster_path 
                ? `https://image.tmdb.org/t/p/w500${movie.poster_path}`
                : "https://via.placeholder.com/500x750?text=No+Poster";
            
              card.innerHTML = `
                <div class="movie-poster-container">
                    <img src="${posterPath}" class="movie-poster" alt="${movie.title}" loading="lazy">
                    <div class="movie-rating-badge">
                        <div class="rating-value"><i class="fas fa-star"></i> AI</div>
                    </div>
                    <div class="movie-overlay">
                        <h3 class="movie-title">${movie.title}</h3>
                        <p style="font-size:0.75rem; color:#ddd; margin-bottom:10px;">${rec.reason}</p>
                        <div class="movie-actions">
                            <button class="movie-btn watch-btn" onclick="showStream(${movie.id})"><i class="fas fa-tv"></i></button>
                        </div>
                    </div>
                </div>`;
               container.appendChild(card);
          } else {
              // Fallback UI
              const div = document.createElement('div');
              div.className = 'movie-card';
              div.innerHTML = '<div class="poster-container" style="background:#222;display:flex;align-items:center;justify-content:center;height:300px"><i class="fas fa-film fa-2x"></i></div><div class="movie-info" style="padding:10px"><h3 class="movie-title">' + rec.title + '</h3><p style="font-size:12px;color:#aaa">' + rec.reason + '</p></div>';
              container.appendChild(div);
          }
      }
    } catch (e) {
        console.error(e);
        container.innerHTML = '<div class="error-msg">AI Brain Overloaded.</div>';
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
