console.log('Main.js loaded');

const API_URL = window.location.hostname === 'localhost' 
    ? 'http://localhost:5001/api/movies'
    : '/api/movies';
// API Key handled by backend


// Variabel global
let currentPage = 1;
const moviesPerPage = 20;
let totalPages = 1;
let currentCategory = null;
let searchTimeout = null;
let isLoading = false;
let currentMovieId = null;
let loadedMovies = new Set(); // Menggunakan Set untuk menghindari duplikasi
let parallaxHandler = null;
let swimlanesLoaded = false; // Flag to prevent re-fetching // Store reference to parallax listener

async function loadFeaturedMovie() {
    try {
        console.log('Fetching featured movie...');
        const response = await fetch(`${API_URL}/featured`);
        console.log('Featured movie response:', response);
        const featuredMovie = await response.json();
        console.log('Featured movie data:', featuredMovie);
        updateHeroSection(featuredMovie);
    } catch (error) {
        console.error('Error loading featured movie:', error);
        // Hapus loading screen jika terjadi error
        document.querySelector('.loader').classList.add('hidden');
    }
}

// Tambahkan fungsi untuk menghapus loading screen
function removeLoader() {
    const loader = document.querySelector('.loader');
    if (loader) {
        loader.classList.add('hidden');
    }
}

// Update event listener
window.addEventListener('DOMContentLoaded', async () => {
    console.log('DOM loaded');
    try {
        await loadFeaturedMovie();
        await loadMovies();
    } catch (error) {
        console.error('Error initializing app:', error);
    } finally {
        // Selalu hapus loading screen setelah selesai
        removeLoader();
    }
});

// Event listener untuk scroll
// Event listener untuk scroll
window.addEventListener('scroll', () => {
    const header = document.querySelector('header');
    if (window.scrollY > 50) {
        header.classList.add('scrolled');
    } else {
        header.classList.remove('scrolled');
    }

    // Hanya untuk scroll-to-top button
    const scrollBtn = document.querySelector('.scroll-top');
    if (scrollBtn) {
        if (window.pageYOffset > 500) {
            scrollBtn.classList.add('visible');
        } else {
            scrollBtn.classList.remove('visible');
        }
    }
});

// Update fungsi loadMovies
async function loadMovies(page = 1, categoryId = null, resetMovies = true) {
    if (isLoading || page > totalPages) return;
    
    try {
        isLoading = true;
        const movieSection = document.querySelector('.movie-section');
        const loadingIndicator = document.createElement('div');
        loadingIndicator.className = 'section-loading';
        loadingIndicator.innerHTML = '<div class="spinner"></div>';
        movieSection.appendChild(loadingIndicator);

        const url = categoryId 
            ? `${API_URL}/category/${categoryId}?page=${page}`
            : `${API_URL}/popular?page=${page}`;
        
        const response = await fetch(url);
        const data = await response.json();
        
        totalPages = Math.min(data.total_pages, 500); // TMDB limit
        currentPage = page;

        if (resetMovies) {
            loadedMovies.clear(); // Reset movies jika ini adalah request baru
        }

        // Filter dan tambahkan hanya movie yang belum ada
        data.results.forEach(movie => {
            if (!Array.from(loadedMovies).some(m => m.id === movie.id)) {
                loadedMovies.add(movie);
            }
        });

        // Display movies
        displayMovies(Array.from(loadedMovies), !resetMovies);
        updatePagination(currentPage);

        movieSection.removeChild(loadingIndicator);

    } catch (error) {
        console.error('Error loading movies:', error);
        showError('Failed to load movies. Please try again.');
    } finally {
        isLoading = false;
    }
}

// Update fungsi updatePagination
function updatePagination(currentPage) {
    const paginationContainer = document.querySelector('.pagination');
    const maxVisiblePages = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(startPage + maxVisiblePages - 1, totalPages);

    if (endPage - startPage + 1 < maxVisiblePages) {
        startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }

    let paginationHTML = `
        <button class="prev-btn" ${currentPage === 1 ? 'disabled' : ''} onclick="changePage(${currentPage - 1})">
            <i class="fas fa-chevron-left"></i>
        </button>
    `;

    if (startPage > 1) {
        paginationHTML += `
            <button onclick="changePage(1)">1</button>
            ${startPage > 2 ? '<span class="dots">...</span>' : ''}
        `;
    }

    for (let i = startPage; i <= endPage; i++) {
        paginationHTML += `
            <button class="${i === currentPage ? 'active' : ''}" onclick="changePage(${i})">
                ${i}
            </button>
        `;
    }

    if (endPage < totalPages) {
        paginationHTML += `
            ${endPage < totalPages - 1 ? '<span class="dots">...</span>' : ''}
            <button onclick="changePage(${totalPages})">${totalPages}</button>
        `;
    }

    paginationHTML += `
        <button class="next-btn" ${currentPage === totalPages ? 'disabled' : ''} onclick="changePage(${currentPage + 1})">
            <i class="fas fa-chevron-right"></i>
        </button>
    `;

    paginationContainer.innerHTML = paginationHTML;
}

// Update fungsi changePage
async function changePage(page) {
    if (page < 1 || page > totalPages || page === currentPage || isLoading) return;
    
    const movieContainer = document.getElementById('movieContainer');
    
    // Add fade animation
    movieContainer.style.opacity = '0';
    
    try {
        currentPage = page;
        await loadMovies(page, currentCategory);
        
        // Fade in new content
        setTimeout(() => {
            movieContainer.style.opacity = '1';
        }, 300);
        
    } catch (error) {
        console.error('Error changing page:', error);
        showError('Failed to load page. Please try again.');
    }
}

// Add keyboard navigation
document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') {
        changePage(currentPage - 1);
    } else if (e.key === 'ArrowRight') {
        changePage(currentPage + 1);
    }
});

// Update event listener untuk pencarian
// Update event listener untuk pencarian
document.addEventListener('DOMContentLoaded', () => {
    const searchContainer = document.querySelector('.search-container');
    const searchIcon = document.querySelector('.search-icon');
    const searchInput = document.querySelector('.search-input');

    // Expand search on icon click
    searchIcon.addEventListener('click', () => {
        searchContainer.classList.add('active');
        searchInput.focus();
    });

    // Close search on blur if empty
    searchInput.addEventListener('blur', () => {
        if (!searchInput.value) {
            searchContainer.classList.remove('active');
        }
    });

    searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        const query = e.target.value.trim();
        
        searchTimeout = setTimeout(async () => {
            if (query) {  // Jika query tidak kosong
                // FIX: Auto-switch to Movies page if getting search results
                // This ensures the grid is visible (Home page hides the grid)
                const moviesContent = document.getElementById('movies-page-content');
                if (moviesContent && moviesContent.style.display === 'none') {
                    handleNavigation('movies');
                }

                try {
                    const encodedQuery = encodeURIComponent(query); // Encode query string
                    const response = await fetch(`${API_URL}/search?query=${encodedQuery}`);
                    if (!response.ok) {
                        throw new Error('Search failed');
                    }
                    const data = await response.json();
                    
                    // Display results in the grid
                    displayMovies(data.results);
                    
                    // Hide pagination during search
                    const pagination = document.querySelector('.pagination');
                    if (pagination) pagination.style.display = 'none';
                    
                    // Scroll to results
                    // document.querySelector('.movie-section').scrollIntoView({ behavior: 'smooth' }); // Optional, might be annoying if auto-switched
                } catch (error) {
                    console.error('Error searching movies:', error);
                    showError('Failed to search movies. Please try again.');
                }
            } else {
                // If search cleared, reload default movies
                loadMovies(1);
                const pagination = document.querySelector('.pagination');
                if (pagination) pagination.style.display = 'flex';
            }
        }, 500);
    });
});

// Update event listeners untuk kategori
// Update event listeners untuk kategori (Pills)
document.querySelectorAll('.pill-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const categoryId = btn.dataset.categoryId;
        currentCategory = categoryId === 'all' ? null : categoryId;
        currentPage = 1;
        loadedMovies.clear(); // Reset loaded movies when changing category
        
        // Update active state
        document.querySelectorAll('.pill-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        loadMovies(1, currentCategory, true);
    });
});

function updateHeroSection(movie) {
    if (!movie) return;

    const heroElement = document.querySelector('.hero');
    const heroContent = document.createElement('div');
    heroContent.className = 'hero-content';

    // Set background with parallax effect
    heroElement.innerHTML = `
        <div class="hero-parallax">
            <div class="parallax-bg" style="background-image: url(https://image.tmdb.org/t/p/original${movie.backdrop_path})"></div>
        </div>
        <div class="hero-content">
            <h1 class="hero-title">${movie.title}</h1>
            <p class="hero-description">${movie.overview}</p>
            <div class="hero-buttons">
                <button class="hero-btn watch-now-btn" onclick="showStream(${movie.id})">
                    <i class="fas fa-tv"></i>
                    Watch Now
                </button>
                <button class="hero-btn watch-btn" onclick="showTrailer(${movie.id})">
                    <i class="fas fa-play"></i>
                    Trailer
                </button>
                <button class="hero-btn info-btn" onclick="showDetail(${movie.id})">
                    <i class="fas fa-info-circle"></i>
                    More Info
                </button>
            </div>
        </div>
    `;

    // Add parallax effect with cleanup
    const parallaxBg = heroElement.querySelector('.parallax-bg');
    
    // Remove existing listener if any
    if (parallaxHandler) {
        window.removeEventListener('scroll', parallaxHandler);
    }

    // Define new handler
    parallaxHandler = () => {
        // Optimization: Don't calculate if hero is hidden
        if (heroElement.style.display === 'none') return;
        
        const scrolled = window.pageYOffset;
        // Optimization: Stop parallaxing if scrolled past hero
        if (scrolled > heroElement.offsetHeight) return;

        parallaxBg.style.transform = `translateY(${scrolled * 0.5}px)`;
    };

    // Add new listener
    window.addEventListener('scroll', parallaxHandler);

    // Add hover effect to hero (Clean up old listener implicitly by overwriting innerHTML? No, that clears children events. 
    // Container events persist. We should use a named function for hover too if we want to clean it up, 
    // but hover only fires when mouse is OVER the element, so it's less critical than global scroll.
    // However, let's keep it simple for now as scroll is the main CPU hog.)
    
    // Remove old hover listeners by cloning (trick to strip listeners) or just ignore (less impact)
    // For safety, we'll assign to onmousemove directly which overwrites previous
    heroElement.onmousemove = (e) => {
        const { offsetWidth: width, offsetHeight: height } = heroElement;
        const { clientX: x, clientY: y } = e;
        const moveX = (x - width/2) * 0.01;
        const moveY = (y - height/2) * 0.01;
        parallaxBg.style.transform = `translate(${moveX}px, ${moveY}px) scale(1.1)`;
    };

    heroElement.onmouseleave = () => {
        parallaxBg.style.transform = 'translate(0, 0) scale(1)';
    };
}

// Update fungsi displayMovies
function displayMovies(movies, append = false) {
    const container = document.getElementById('movieContainer');
    
    if (!append) {
        container.innerHTML = '';
    }
    
    if (!movies || movies.length === 0) {
        if (!append) {
            container.innerHTML = `
                <div class="no-results">
                    <i class="fas fa-film"></i>
                    <p>No movies found</p>
                </div>
            `;
        }
        return;
    }

    movies.forEach(movie => {
        // Skip movie jika tidak memiliki poster
        if (!movie.poster_path) return;

        const card = document.createElement('div');
        card.className = 'movie-card';
        
        const posterPath = `https://image.tmdb.org/t/p/w500${movie.poster_path}`;
        const primaryGenre = movie.genre_ids?.[0];
        const genreName = getGenreName(primaryGenre);

        card.innerHTML = `
            <div class="movie-poster-container">
                <img 
                    src="${posterPath}" 
                    class="movie-poster" 
                    alt="${movie.title}"
                    loading="lazy"
                    decoding="async"
                >
                ${genreName ? `<span class="movie-category-badge">${genreName}</span>` : ''}
                <div class="movie-overlay">
                    <h3 class="movie-title">${movie.title}</h3>
                    <div class="movie-meta">
                        <div class="movie-rating">
                            <i class="fas fa-star rating-star"></i>
                            <span>${movie.vote_average?.toFixed(1) || 'N/A'}</span>
                        </div>
                        <span>${movie.release_date?.slice(0,4) || 'N/A'}</span>
                    </div>
                    <div class="movie-actions">
                        <button class="movie-btn watch-btn" data-movie-id="${movie.id}" title="Watch Movie">
                            <i class="fas fa-tv"></i> Watch
                        </button>
                        <button class="movie-btn trailer-btn" data-movie-id="${movie.id}" title="Watch Trailer">
                            <i class="fas fa-play"></i>
                        </button>
                        <button class="movie-btn details-btn" data-movie-id="${movie.id}" title="More Info">
                            <i class="fas fa-info"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;

        // Tambahkan event listeners untuk tombol watch, trailer dan detail
        const watchBtn = card.querySelector('.watch-btn');
        const trailerBtn = card.querySelector('.trailer-btn');
        const detailsBtn = card.querySelector('.details-btn');

        watchBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            showStream(movie.id);
        });

        trailerBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            showTrailer(movie.id);
        });

        detailsBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            showDetail(movie.id);
        });
        
        container.appendChild(card);
    });
}

// Add genre mapping
const genreMap = {
    28: 'Action',
    12: 'Adventure',
    16: 'Animation',
    35: 'Comedy',
    80: 'Crime',
    99: 'Documentary',
    18: 'Drama',
    10751: 'Family',
    14: 'Fantasy',
    36: 'History',
    27: 'Horror',
    10402: 'Music',
    9648: 'Mystery',
    10749: 'Romance',
    878: 'Sci-Fi',
    10770: 'TV Movie',
    53: 'Thriller',
    10752: 'War',
    37: 'Western'
};

function getGenreName(genreId) {
    return genreMap[genreId] || '';
}

// Update fungsi showWatchProviders
async function showWatchProviders(providersData) {
    try {
        if (!providersData) {
            return `<p class="no-providers">No streaming information available.</p>`;
        }
        
        const countryResults = providersData['ID'] || providersData['US'] || null;

        if (!countryResults) {
            return `<p class="no-providers">No streaming information available for your region.</p>`;
        }

        let providersHTML = '';
        
        // Streaming providers dengan deep links
        if (countryResults.flatrate?.length > 0) {
            providersHTML += `
                <div class="provider-section">
                    <h4>Stream</h4>
                    <div class="provider-list">
                        ${countryResults.flatrate.map(provider => `
                            <a href="${countryResults.deepLinks?.[provider.provider_id] || countryResults.link}" 
                               target="_blank" 
                               class="provider-item" 
                               title="Watch on ${provider.provider_name}">
                                <img src="https://image.tmdb.org/t/p/original${provider.logo_path}" 
                                     alt="${provider.provider_name}">
                                <span class="provider-name">${provider.provider_name}</span>
                            </a>
                        `).join('')}
                    </div>
                </div>
            `;
        }

        // Rental providers dengan deep links
        if (countryResults.rent?.length > 0) {
            providersHTML += `
                <div class="provider-section">
                    <h4>Rent</h4>
                    <div class="provider-list">
                        ${countryResults.rent.map(provider => `
                            <a href="${countryResults.deepLinks?.[provider.provider_id] || countryResults.link}" 
                               target="_blank" 
                               class="provider-item" 
                               title="Rent on ${provider.provider_name}">
                                <img src="https://image.tmdb.org/t/p/original${provider.logo_path}" 
                                     alt="${provider.provider_name}">
                                <span class="provider-name">${provider.provider_name}</span>
                            </a>
                        `).join('')}
                    </div>
                </div>
            `;
        }

        // Buy providers dengan deep links
        if (countryResults.buy?.length > 0) {
            providersHTML += `
                <div class="provider-section">
                    <h4>Buy</h4>
                    <div class="provider-list">
                        ${countryResults.buy.map(provider => `
                            <a href="${countryResults.deepLinks?.[provider.provider_id] || countryResults.link}" 
                               target="_blank" 
                               class="provider-item" 
                               title="Buy on ${provider.provider_name}">
                                <img src="https://image.tmdb.org/t/p/original${provider.logo_path}" 
                                     alt="${provider.provider_name}">
                                <span class="provider-name">${provider.provider_name}</span>
                            </a>
                        `).join('')}
                    </div>
                </div>
            `;
        }

        providersHTML += `
            <div class="justwatch-attribution">
                <small>Powered by JustWatch</small>
                <a href="${countryResults.link}" target="_blank" class="view-more">
                    View all watching options <i class="fas fa-external-link-alt"></i>
                </a>
            </div>
        `;

        return providersHTML;
    } catch (error) {
        console.error('Error fetching watch providers:', error);
        return '<p class="error-message">Failed to load streaming information.</p>';
    }
}

// Update showDetail function to include watch providers
async function showDetail(movieId) {
    try {
        currentMovieId = movieId;
        
        const modal = document.querySelector('.detail-modal');
        const detailContent = modal.querySelector('.detail-content');
        detailContent.innerHTML = '<div class="spinner"></div>';
        modal.classList.add('active');

        const response = await fetch(`${API_URL}/${movieId}`);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        const watchProvidersHTML = await showWatchProviders(data.watch_providers);
        
        detailContent.innerHTML = `
            <i class="fas fa-times close-btn"></i>
            <div class="detail-header"></div>
            <div class="detail-body">
                <img src="" class="detail-poster" alt="Movie Poster">
                <div class="detail-info">
                    <h1 class="detail-title"></h1>
                    <div class="detail-meta">
                        <span class="rating"><i class="fas fa-star"></i> <span></span></span>
                        <span class="year"><i class="far fa-calendar-alt"></i> <span></span></span>
                        <span class="runtime"><i class="far fa-clock"></i> <span></span></span>
                    </div>
                    <div class="detail-genres"></div>
                    <p class="detail-overview"></p>
                    <div class="watch-providers">
                        <h3>Where to Watch</h3>
                        ${watchProvidersHTML}
                    </div>
                    <div class="movie-actions detail-actions">
                        <button class="movie-btn watch-btn primary-btn" data-movie-id="${movieId}">
                            <i class="fas fa-tv"></i> Watch Movie
                        </button>
                        <button class="movie-btn trailer-btn" data-movie-id="${movieId}">
                            <i class="fas fa-play"></i> Trailer
                        </button>
                    </div>
                </div>
            </div>
        `;

        // Update elements
        const header = detailContent.querySelector('.detail-header');
        const poster = detailContent.querySelector('.detail-poster');
        const title = detailContent.querySelector('.detail-title');
        const rating = detailContent.querySelector('.rating span');
        const year = detailContent.querySelector('.year span');
        const runtime = detailContent.querySelector('.runtime span');
        const genres = detailContent.querySelector('.detail-genres');
        const overview = detailContent.querySelector('.detail-overview');

        // Set content
        header.style.backgroundImage = data.backdrop_path 
            ? `url(https://image.tmdb.org/t/p/original${data.backdrop_path})`
            : 'none';
        
        poster.src = data.poster_path 
            ? `https://image.tmdb.org/t/p/w500${data.poster_path}`
            : 'https://via.placeholder.com/500x750?text=No+Poster';
        
        poster.onerror = () => {
            poster.src = 'https://via.placeholder.com/500x750?text=No+Poster';
        };

        title.textContent = data.title || 'Unknown Title';
        rating.textContent = `${data.vote_average ? data.vote_average.toFixed(1) : 'N/A'}/10`;
        year.textContent = data.release_date?.slice(0,4) || 'N/A';
        runtime.textContent = data.runtime ? `${data.runtime} mins` : 'N/A';
        overview.textContent = data.overview || 'No overview available';
        
        genres.innerHTML = data.genres && data.genres.length > 0
            ? data.genres.map(genre => `<span class="genre-tag">${genre.name}</span>`).join('')
            : '<span class="genre-tag">No genres available</span>';

        // Add event listeners
        const closeBtn = detailContent.querySelector('.close-btn');
        closeBtn.addEventListener('click', () => {
            modal.classList.remove('active');
        });

        // Watch button event listener
        const watchBtn = detailContent.querySelector('.watch-btn');
        if (watchBtn) {
            watchBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                modal.classList.remove('active');
                showStream(movieId);
            });
        }

        const trailerBtn = detailContent.querySelector('.trailer-btn');
        trailerBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            showTrailerFromDetail();
        });

    } catch (error) {
        console.error('Error loading movie details:', error);
        showError('Failed to load movie details. Please try again.');
        document.querySelector('.detail-modal').classList.remove('active');
    }
}

function showTrailerFromDetail() {
    document.querySelector('.detail-modal').classList.remove('active');
    showTrailer(currentMovieId);
}

// Add event listener for closing modal
document.querySelectorAll('.close-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelector('.detail-modal').classList.remove('active');
    });
});

// Fungsi untuk menampilkan trailer
async function showTrailer(movieId) {
    try {
        // Create modal if it doesn't exist
        let modal = document.querySelector('.trailer-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.className = 'trailer-modal';
            modal.innerHTML = `
                <div class="trailer-content">
                    <i class="fas fa-times close-btn"></i>
                    <div class="video-container">
                        <div class="trailer-loading">
                            <div class="spinner"></div>
                            <p>Loading trailer...</p>
                        </div>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
        }

        const videoContainer = modal.querySelector('.video-container');
        modal.classList.add('active');
        
        // Show loading spinner
        videoContainer.innerHTML = `
            <div class="trailer-loading">
                <div class="spinner"></div>
                <p>Loading trailer...</p>
            </div>
        `;

        // Fetch trailer from Backend Proxy
        const response = await fetch(`${API_URL}/${movieId}/videos`);
        const data = await response.json();
        
        // Find official trailer
        const trailer = data.results.find(video => 
            video.type === 'Trailer' && 
            video.site.toLowerCase() === 'youtube'
        ) || data.results.find(video => 
            video.site.toLowerCase() === 'youtube'
        );

        if (trailer) {
            videoContainer.innerHTML = `
                <iframe 
                    src="https://www.youtube.com/embed/${trailer.key}?autoplay=1&mute=0" 
                    frameborder="0" 
                    allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture" 
                    allowfullscreen>
                </iframe>
            `;
            
            // Event listener for close button
            const closeBtn = modal.querySelector('.close-btn');
            const closeModal = () => {
                modal.classList.remove('active');
                videoContainer.innerHTML = '';
            };

            closeBtn.onclick = closeModal;

            // Event listener for clicking outside modal
            modal.onclick = (e) => {
                if (e.target === modal) {
                    closeModal();
                }
            };

            // Event listener for ESC key
            const escHandler = (e) => {
                if (e.key === 'Escape') {
                    closeModal();
                    document.removeEventListener('keydown', escHandler);
                }
            };
            document.addEventListener('keydown', escHandler);
        } else {
            modal.classList.remove('active');
            showError('No trailer available for this movie');
        }
    } catch (error) {
        console.error('Error fetching trailer:', error);
        document.querySelector('.trailer-modal').classList.remove('active');
        showError('Failed to load trailer. Please try again.');
    }
}

// ============================================
// STREAMING FEATURE - Watch Movies Directly
// ============================================

// Stream providers configuration (multiple fallbacks)
// Stream providers configuration (multiple fallbacks)
const STREAM_PROVIDERS = [
    { name: 'Server 1 (Sub Indo HD)', url: (id) => `https://multiembed.mov/?video_id=${id}&tmdb=1` },
    { name: 'Server 2 (Fast + Ads)', url: (id) => `https://vidlink.pro/movie/${id}` },
    { name: 'Server 3 (Stable)', url: (id) => `https://vidsrc.vip/embed/movie/${id}` },
    { name: 'Server 4 (Aggregator)', url: (id) => `https://player.smashy.stream/movie/${id}` },
    { name: 'Backup Server 1', url: (id) => `https://vidsrc.cc/v2/embed/movie/${id}` },
    { name: 'Backup Server 2', url: (id) => `https://vidsrc.to/embed/movie/${id}` },
    { name: 'Backup Server 3', url: (id) => `https://www.2embed.cc/embed/${id}` },
];

let currentStreamProvider = 0;

// Function to show stream modal
async function showStream(movieId) {
    try {
        // Create stream modal if it doesn't exist
        let modal = document.querySelector('.stream-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.className = 'stream-modal';
            modal.innerHTML = `
                <div class="stream-content">
                    <div class="stream-header">
                        <!-- Top Row: Title & Window Controls -->
                        <div class="stream-app-bar">
                            <div class="stream-title-group">
                                <h3 class="stream-title">Now Playing</h3>
                            </div>
                            <div class="stream-controls">
                                <button class="fullscreen-btn" title="Fullscreen">
                                    <i class="fas fa-expand"></i>
                                </button>
                                <button class="close-stream-btn" title="Close">
                                    <i class="fas fa-times"></i>
                                </button>
                            </div>
                        </div>

                        <!-- Bottom Row: Server List (Scrollable) -->
                        <div class="server-selector-row">
                            <span class="server-label">Server:</span>
                            <div class="server-buttons"></div>
                        </div>
                    </div>
                    <div class="stream-container">
                        <div class="stream-loading">
                            <div class="spinner"></div>
                            <p>Loading stream...</p>
                        </div>
                    </div>
                    <div class="stream-info">
                        <p class="stream-notice">
                            <i class="fas fa-info-circle"></i>
                            Jika video tidak muncul, coba ganti server di atas. Klik beberapa kali jika ada overlay iklan.
                        </p>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);

            // Add stream modal styles
            addStreamStyles();
        }

        const streamContainer = modal.querySelector('.stream-container');
        const streamTitle = modal.querySelector('.stream-title');
        const serverButtons = modal.querySelector('.server-buttons');
        
        // Fetch movie details for title using Backend Proxy
        const response = await fetch(`${API_URL}/${movieId}`);
        const movieData = await response.json();
        streamTitle.textContent = movieData.title || 'Now Playing';

        // Create server buttons
        serverButtons.innerHTML = STREAM_PROVIDERS.map((provider, index) => `
            <button class="server-btn ${index === 0 ? 'active' : ''}" 
                    data-provider="${index}" 
                    data-movie-id="${movieId}">
                ${provider.name}
            </button>
        `).join('');

        // Add click handlers for server buttons
        serverButtons.querySelectorAll('.server-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const providerIndex = parseInt(btn.dataset.providerId || btn.dataset.provider);
                const tmdbId = btn.dataset.movieId;
                
                // Update active state
                serverButtons.querySelectorAll('.server-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                
                // Load new stream
                loadStream(streamContainer, tmdbId, providerIndex);
            });
        });

        // Show modal
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';

        // Load initial stream
        loadStream(streamContainer, movieId, 0);

        // Close button handler
        const closeBtn = modal.querySelector('.close-stream-btn');
        closeBtn.onclick = () => closeStreamModal(modal);

        // Fullscreen button handler
        const fullscreenBtn = modal.querySelector('.fullscreen-btn');
        fullscreenBtn.onclick = () => {
            const iframe = streamContainer.querySelector('iframe');
            if (iframe) {
                if (iframe.requestFullscreen) {
                    iframe.requestFullscreen();
                } else if (iframe.webkitRequestFullscreen) {
                    iframe.webkitRequestFullscreen();
                } else if (iframe.msRequestFullscreen) {
                    iframe.msRequestFullscreen();
                }
            }
        };

        // Click outside to close
        modal.onclick = (e) => {
            if (e.target === modal) {
                closeStreamModal(modal);
            }
        };

        // ESC key to close
        const escHandler = (e) => {
            if (e.key === 'Escape') {
                closeStreamModal(modal);
                document.removeEventListener('keydown', escHandler);
            }
        };
        document.addEventListener('keydown', escHandler);

    } catch (error) {
        console.error('Error loading stream:', error);
        showError('Failed to load stream. Please try again.');
    }
}

// Load stream into container
function loadStream(container, movieId, providerIndex = 0) {
    const provider = STREAM_PROVIDERS[providerIndex];
    let streamUrl = provider.url(movieId);

    // Try to force Indonesian subtitles/language for SuperEmbed
    if (provider.name.includes('SuperEmbed')) {
        if (!streamUrl.includes('?')) streamUrl += '?';
        streamUrl += '&lang=id&sub_lang=id&caption=Indonesian'; 
    }
    
    container.innerHTML = `
        <iframe 
            src="${streamUrl}"
            frameborder="0"
            allowfullscreen
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            referrerpolicy="origin"
            class="stream-iframe"
        ></iframe>
    `;
}

// Close stream modal
function closeStreamModal(modal) {
    modal.classList.remove('active');
    document.body.style.overflow = '';
    const streamContainer = modal.querySelector('.stream-container');
    streamContainer.innerHTML = ''; // Stop the stream
}

// Add stream modal styles dynamically
function addStreamStyles() {
    if (document.getElementById('stream-styles')) return;
    
    const styles = document.createElement('style');
    styles.id = 'stream-styles';
    styles.textContent = `
        .stream-modal {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.95);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 10000;
            opacity: 0;
            visibility: hidden;
            transition: all 0.3s ease;
        }
        
        .stream-modal.active {
            opacity: 1;
            visibility: visible;
        }
        
        .stream-content {
            width: 95%;
            max-width: 1200px;
            background: #181818;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 25px 50px rgba(0, 0, 0, 0.5);
        }
        
        .stream-header {
            display: flex;
            flex-direction: column;
            gap: 15px;
            padding: 15px 20px;
            background: #141414;
            border-bottom: 1px solid #333;
        }
        
        .stream-app-bar {
            display: flex;
            justify-content: space-between;
            align-items: center;
            width: 100%;
        }
        
        .stream-title-group {
            display: flex;
            align-items: center;
            gap: 10px;
            overflow: hidden;
        }

        .stream-title {
            color: white;
            font-size: 1.1rem;
            font-weight: 600;
            margin: 0;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        
        .stream-controls {
            display: flex;
            align-items: center;
            gap: 10px;
            flex-shrink: 0;
        }
        
        .server-selector-row {
            display: flex;
            align-items: center;
            width: 100%;
            gap: 10px;
            background: rgba(255,255,255,0.05);
            padding: 8px 12px;
            border-radius: 8px;
        }

        .server-label {
            color: #aaa;
            font-size: 0.85rem;
            white-space: nowrap;
        }
        
        .server-buttons {
            display: flex;
            gap: 8px;
            overflow-x: auto;
            padding-bottom: 2px;
            -webkit-overflow-scrolling: touch;
            scrollbar-width: thin;
        }

        .server-buttons::-webkit-scrollbar {
            height: 4px;
        }

        .server-buttons::-webkit-scrollbar-thumb {
            background: #e50914;
            border-radius: 2px;
        }
        
        .server-btn {
            padding: 5px 12px;
            background: rgba(255,255,255,0.1);
            border: 1px solid rgba(255,255,255,0.1);
            border-radius: 4px;
            color: #ddd;
            cursor: pointer;
            font-size: 0.8rem;
            white-space: nowrap;
            transition: all 0.2s ease;
            flex-shrink: 0;
        }
        
        .server-btn:hover {
            background: rgba(255,255,255,0.2);
            border-color: rgba(255,255,255,0.3);
            color: white;
        }
        
        .server-btn.active {
            background: #e50914;
            border-color: #e50914;
            color: white;
            font-weight: 500;
        }
        
        .fullscreen-btn, .close-stream-btn {
            width: 36px;
            height: 36px;
            border-radius: 50%;
            border: none;
            background: rgba(255,255,255,0.2);
            color: white;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s ease;
        }
        
        .fullscreen-btn:hover, .close-stream-btn:hover {
            background: rgba(255,255,255,0.3);
            transform: scale(1.1);
        }
        
        .close-stream-btn:hover {
            background: #e50914;
        }
        
        .stream-container {
            position: relative;
            width: 100%;
            padding-top: 56.25%; /* 16:9 Aspect Ratio */
            background: #000;
        }
        
        .stream-iframe {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            border: none;
        }
        
        .stream-loading {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 15px;
            color: white;
            z-index: 5;
        }

        /* Mobile Responsive Styles */
        @media screen and (max-width: 768px) {
            .stream-modal {
                align-items: center; /* Center vertically */
                padding: 10px;
            }
            
            .stream-content {
                width: 100%;
                max-width: 100%;
                border-radius: 8px;
            }
            
            .stream-header {
                padding: 10px;
                gap: 10px;
            }
            
            .stream-app-bar {
                margin-bottom: 5px;
            }

            .stream-title {
                font-size: 0.9rem;
                max-width: 180px;
            }

            .server-selector-row {
                flex-direction: column;
                align-items: flex-start;
                gap: 8px;
                padding: 8px;
            }
            
            .server-label {
                font-size: 0.75rem; 
                opacity: 0.8;
            }
            
            .server-buttons {
                width: 100%;
                padding-bottom: 5px; /* Space for scrollbar */
            }
            
            .server-btn {
                padding: 6px 10px;
                font-size: 0.75rem;
            }
            
            .fullscreen-btn, .close-stream-btn {
                width: 30px;
                height: 30px;
                font-size: 0.9rem;
            }
        }
    `;
        
        .stream-info {
            padding: 12px 20px;
            background: #181818;
        }
        
        .stream-notice {
            display: flex;
            align-items: center;
            gap: 8px;
            color: #ffc107;
            font-size: 0.85rem;
            margin: 0;
        }
        
        .stream-notice i {
            font-size: 1rem;
        }
        
        @media (max-width: 768px) {
            .stream-content {
                width: 100%;
                height: 100%;
                border-radius: 0;
                display: flex;
                flex-direction: column;
            }
            
            .stream-header {
                flex-wrap: wrap;
                gap: 10px;
            }
            
            .stream-title {
                max-width: 100%;
                order: 1;
                flex-basis: 100%;
            }
            
            .stream-controls {
                order: 2;
                width: 100%;
                justify-content: space-between;
            }
            
            .server-selector {
                flex-wrap: wrap;
            }
            
            .stream-container {
                flex: 1;
                padding-top: 0;
            }
            
            .stream-iframe {
                position: relative;
                height: 100%;
            }
        }
    `;
    document.head.appendChild(styles);
}

// ============================================

// Fungsi helper untuk menampilkan error
function showError(message) {
    const errorToast = document.createElement('div');
    errorToast.className = 'error-toast';
    errorToast.textContent = message;
    
    document.body.appendChild(errorToast);
    
    setTimeout(() => {
        errorToast.classList.add('show');
    }, 10);

    setTimeout(() => {
        errorToast.classList.remove('show');
        setTimeout(() => errorToast.remove(), 300);
    }, 3000);
}

// Update CSS untuk animasi
const style = document.createElement('style');
style.textContent = `
    .fade-out {
        opacity: 0;
        transition: opacity 0.3s ease;
    }
    
    .fade-in {
        opacity: 1;
        transition: opacity 0.3s ease;
    }
    
    .movie-grid {
        min-height: 200px; /* Prevent layout shift */
    }
`;
document.head.appendChild(style);

// Navigasi menu
function initializeNavigation() {
    const navLinks = document.querySelectorAll('.nav-link');
    
    // Set active berdasarkan current path
    const currentPath = window.location.pathname;
    navLinks.forEach(link => {
        if (link.getAttribute('href') === currentPath) {
            link.classList.add('active');
        }
    });

    // Event listener untuk setiap link
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            
            // Remove active class dari semua link
            navLinks.forEach(l => l.classList.remove('active'));
            
            // Add active class ke link yang diklik
            link.classList.add('active');
            
            // Get page dari data attribute
            const page = link.dataset.page;
            
            // Handle navigasi
            handleNavigation(page);
        });
    });
}

// Function untuk handle navigasi
function handleNavigation(page) {
    // Reset state
    currentPage = 1;
    currentCategory = null;
    loadedMovies.clear();
    
    // Hide all sections first
    // Hide all sections first
    const hero = document.querySelector('.hero');
    const homeContent = document.getElementById('home-content');
    const moviesContent = document.getElementById('movies-page-content');
    const aboutSection = document.querySelector('.about-section');
    const oldMovieSection = document.querySelector('.movie-section'); // Fallback
    const searchSection = document.querySelector('.search-section') || document.querySelector('.search-container'); // Try to find search

    if (hero) hero.style.display = 'none';
    if (homeContent) homeContent.style.display = 'none';
    if (moviesContent) moviesContent.style.display = 'none';
    if (aboutSection) aboutSection.style.display = 'none';
    if (oldMovieSection && !homeContent && !moviesContent) oldMovieSection.style.display = 'none';
    
    // Default: Show search
    if (searchSection) searchSection.style.visibility = 'visible';

    // Show appropriate section
    switch(page) {
        case 'home':
            if (hero) hero.style.display = 'block';
            
            if (homeContent) {
                homeContent.style.display = 'block';
                // Only load swimlanes if function exists and content block exists
                if (!window.swimlanesLoaded) {
                    loadSwimlanes();
                }
            } else if (oldMovieSection) {
                // Fallback for old layout
                oldMovieSection.style.display = 'block';
                loadFeaturedMovie();
                loadMovies(1);
            }
            break;

        case 'movies':
            if (moviesContent) {
                moviesContent.style.display = 'block';
                if (loadedMovies.size === 0) loadMovies(1); 
            } else if (oldMovieSection) {
                 // Fallback: Movies page uses the generic section
                 oldMovieSection.style.display = 'block';
                 if (loadedMovies.size === 0) loadMovies(1);
            }
            break;

        case 'about':
            if (aboutSection) aboutSection.style.display = 'block';
            // Disable search on about page
            if (searchSection) searchSection.style.visibility = 'hidden';
            break;
    }

    // Update active nav link
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
        if (link.dataset.page === page) {
            link.classList.add('active');
        }
    });
}

// Handle browser back/forward
window.addEventListener('popstate', (event) => {
    if (event.state && event.state.page) {
        handleNavigation(event.state.page);
    }
});

// Tambahkan initializeNavigation ke event listener DOMContentLoaded yang sudah ada
document.addEventListener('DOMContentLoaded', () => {
    initializeNavigation();
    
    // Check current page from URL or default to home
    // (This is implicitly handled by initializeNavigation if implemented correctly, 
    // but we need to trigger the initial load)
    const activeLink = document.querySelector('.nav-link.active');
    if (activeLink) {
        handleNavigation(activeLink.dataset.page);
    } else {
        handleNavigation('home');
    }
    
    addScrollToTop();
});

// New Function: Load Swimlanes
async function loadSwimlanes() {
    try {
        swimlanesLoaded = true;
        
        // Parallel requests using Backend Proxy
        const [trending, topRated, upcoming] = await Promise.all([
            fetch(`${API_URL}/trending`),
            fetch(`${API_URL}/top-rated`),
            fetch(`${API_URL}/upcoming`)
        ]);

        const trendingData = await trending.json();
        const topRatedData = await topRated.json();
        const upcomingData = await upcoming.json();

        // Render rows
        renderRow('trending-row', trendingData.results);
        renderRow('top-rated-row', topRatedData.results);
        renderRow('upcoming-row', upcomingData.results);

    } catch (error) {
        console.error('Error loading swimlanes:', error);
    }
}

// Function to render a single row
function renderRow(containerId, movies) {
    const container = document.getElementById(containerId);
    container.innerHTML = ''; // Clear loading spinner

    movies.forEach(movie => {
        if (!movie.poster_path) return;
        
        // Reuse createMovieCard logic (refactoring displayMovies to be reusable would be ideal, but for now copying structure for speed and adding row-specific class)
        const posterPath = `https://image.tmdb.org/t/p/w500${movie.poster_path}`;
        const card = document.createElement('div');
        card.className = 'movie-card';
        // Add content-visibility optimization manually here too if strict
        
        card.innerHTML = `
            <div class="movie-poster-container">
                <img 
                    src="${posterPath}" 
                    class="movie-poster" 
                    alt="${movie.title}"
                    loading="lazy"
                    decoding="async"
                >
                <div class="movie-overlay">
                    <h3 class="movie-title">${movie.title}</h3>
                    <div class="movie-meta">
                         <div class="movie-rating">
                            <i class="fas fa-star rating-star"></i>
                            <span>${movie.vote_average?.toFixed(1)}</span>
                        </div>
                    </div>
                    <div class="movie-actions">
                        <button class="movie-btn watch-btn" onclick="event.stopPropagation(); showStream(${movie.id})">
                            <i class="fas fa-tv"></i>
                        </button>
                        <button class="movie-btn details-btn" onclick="event.stopPropagation(); showDetail(${movie.id})">
                            <i class="fas fa-info"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        // Click whole card for details
        card.addEventListener('click', () => showDetail(movie.id));

        container.appendChild(card);
    });
}

// Add scroll to top functionality
function addScrollToTop() {
    const scrollBtn = document.createElement('div');
    scrollBtn.className = 'scroll-top';
    scrollBtn.innerHTML = '<i class="fas fa-arrow-up"></i>';
    document.body.appendChild(scrollBtn);

    window.addEventListener('scroll', () => {
        if (window.pageYOffset > 500) {
            scrollBtn.classList.add('visible');
        } else {
            scrollBtn.classList.remove('visible');
        }
    });

    scrollBtn.addEventListener('click', () => {
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    });
}

// Smooth loading animation
function showLoadingState() {
    const container = document.getElementById('movieContainer');
    container.innerHTML = `
        <div class="loading-state">
            <div class="spinner"></div>
            <p>Loading amazing movies...</p>
        </div>
    `;
}

// Tambahkan event listener untuk clear button
document.addEventListener('DOMContentLoaded', () => {
    const clearButtons = document.querySelectorAll('.clear-search');
    
    clearButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            const searchInput = e.target.closest('.search-container').querySelector('.search-input');
            searchInput.value = '';
            searchInput.focus();
            loadMovies(1); // Reset ke tampilan awal
            document.querySelector('.pagination').style.display = 'flex';
        });
    });
});

// Update copyright year
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('copyright-year').textContent = new Date().getFullYear();
});

// ==========================================
// HOME PAGE LOGIC (SWIMLANES)
// ==========================================

async function loadSwimlanes() {
    const homeContent = document.getElementById('home-content');
    if (!homeContent) return;

    // Show loading state for home
    homeContent.innerHTML = '<div class="section-loading"><div class="spinner"></div></div>';

    try {
        const [trending, topRated, action, horror] = await Promise.all([
            fetch(`${API_URL}/trending`).then(r => r.json()),
            fetch(`${API_URL}/top-rated`).then(r => r.json()),
            fetch(`${API_URL}/category/28`).then(r => r.json()), // Action
            fetch(`${API_URL}/category/27`).then(r => r.json())  // Horror
        ]);

        homeContent.innerHTML = ''; // Clear loading

        createSwimlane('Trending Now', trending.results);
        createSwimlane('Top Rated Movies', topRated.results);
        createSwimlane('Action Hits', action.results);
        createSwimlane('Horror Night', horror.results);

        window.swimlanesLoaded = true;

    } catch (error) {
        console.error('Error loading home swimlanes:', error);
        homeContent.innerHTML = '<div class="error-message">Failed to load content. Please refresh.</div>';
    }
}

function createSwimlane(title, movies) {
    const homeContent = document.getElementById('home-content');
    
    const rowSection = document.createElement('section');
    rowSection.className = 'movie-row-section';
    
    // Header
    const header = document.createElement('div');
    header.className = 'row-header';
    header.innerHTML = `
        <h3 class="row-title">${title}</h3>
        <div class="swimlane-controls">
            <button class="scroll-btn prev"><i class="fas fa-chevron-left"></i></button>
            <button class="scroll-btn next"><i class="fas fa-chevron-right"></i></button>
        </div>
    `;
    
    // Row Container (Scrollable)
    const rowContainer = document.createElement('div');
    rowContainer.className = 'row-container';
    
    // Cards
    movies.forEach(movie => {
        if (!movie.poster_path) return;
        
        const card = document.createElement('div');
        card.className = 'movie-card'; // Reuse existing card styles
        card.innerHTML = createMovieCardHTML(movie);
        
        // Add listeners (Reuse existing logic or simplified for Home)
        addCardListeners(card, movie);
        
        rowContainer.appendChild(card);
    });

    rowSection.appendChild(header);
    rowSection.appendChild(rowContainer);
    homeContent.appendChild(rowSection);

    // Add scroll functionality
    const prevBtn = header.querySelector('.prev');
    const nextBtn = header.querySelector('.next');
    
    prevBtn.addEventListener('click', () => {
        rowContainer.scrollBy({ left: -window.innerWidth / 1.5, behavior: 'smooth' });
    });
    
    nextBtn.addEventListener('click', () => {
        rowContainer.scrollBy({ left: window.innerWidth / 1.5, behavior: 'smooth' });
    });
}

// Helper to generate Card HTML (DRY principle)
function createMovieCardHTML(movie) {
    const posterPath = `https://image.tmdb.org/t/p/w500${movie.poster_path}`;
    const primaryGenre = movie.genre_ids?.[0];
    const genreName = getGenreName(primaryGenre);

    return `
        <div class="movie-poster-container">
            <img 
                src="${posterPath}" 
                class="movie-poster" 
                alt="${movie.title}"
                loading="lazy"
                decoding="async"
            >
            ${genreName ? `<span class="movie-category-badge">${genreName}</span>` : ''}
            <div class="movie-overlay">
                <h3 class="movie-title">${movie.title}</h3>
                <div class="movie-meta">
                    <div class="movie-rating">
                        <i class="fas fa-star rating-star"></i>
                        <span>${movie.vote_average?.toFixed(1) || 'N/A'}</span>
                    </div>
                    <span>${movie.release_date?.slice(0,4) || 'N/A'}</span>
                </div>
                <div class="movie-actions">
                    <button class="movie-btn watch-btn" title="Watch Movie">
                        <i class="fas fa-play"></i> Watch
                    </button>
                    <button class="movie-btn trailer-btn" title="Watch Trailer">
                        <i class="fas fa-ticket-alt"></i>
                    </button>
                    <button class="movie-btn details-btn" title="More Info">
                        <i class="fas fa-info"></i>
                    </button>
                </div>
            </div>
        </div>
    `;
}

// Extract event listener logic to reuse
function addCardListeners(card, movie) {
    const watchBtn = card.querySelector('.watch-btn');
    const trailerBtn = card.querySelector('.trailer-btn');
    const detailsBtn = card.querySelector('.details-btn');

    watchBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        showStream(movie.id);
    });

    trailerBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        showTrailer(movie.id);
    });

    detailsBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        showDetail(movie.id);
    });
}


// ============================================
// PERFORMANCE OPTIMIZATION - Connection Warming
// ============================================
function addResourceHints() {
    const domains = [
        'https://multiembed.mov',
        'https://vidlink.pro',
        'https://vidsrc.vip',
        'https://player.smashy.stream',
        'https://vidsrc.cc',
        'https://vidsrc.to',
        'https://www.2embed.cc'
    ];

    const frag = document.createDocumentFragment();

    domains.forEach(domain => {
        // DNS Prefetch (Early lookup)
        const dns = document.createElement('link');
        dns.rel = 'dns-prefetch';
        dns.href = domain;
        frag.appendChild(dns);

        // Preconnect (Handshake: DNS + TCP + TLS)
        const preconnect = document.createElement('link');
        preconnect.rel = 'preconnect';
        preconnect.href = domain;
        preconnect.crossOrigin = 'anonymous';
        frag.appendChild(preconnect);
    });

    document.head.appendChild(frag);
    console.log('🚀 Stream Connections Warmed Up');
}