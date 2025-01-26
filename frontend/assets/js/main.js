console.log('Main.js loaded');

const API_URL = window.location.hostname === 'localhost' 
    ? 'http://localhost:5001/api/movies'
    : '/api/movies';
const API_KEY = '3f422bab4df034e4d74d11ecec68fc1a';
const BASE_URL = 'https://api.themoviedb.org/3';

// Variabel global
let currentPage = 1;
const moviesPerPage = 20;
let totalPages = 1;
let currentCategory = null;
let searchTimeout = null;
let isLoading = false;
let currentMovieId = null;
let loadedMovies = new Set(); // Menggunakan Set untuk menghindari duplikasi

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

// Event listener untuk scroll header
window.addEventListener('scroll', () => {
    // Untuk header
    const header = document.querySelector('header');
    if (window.scrollY > 50) {
        header.classList.add('scrolled');
    } else {
        header.classList.remove('scrolled');
    }
    
    // Untuk scroll-to-top button
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
            ? `${BASE_URL}/discover/movie?api_key=${API_KEY}&with_genres=${categoryId}&page=${page}`
            : `${BASE_URL}/movie/popular?api_key=${API_KEY}&page=${page}`;
        
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
document.addEventListener('DOMContentLoaded', () => {
    const searchInputs = document.querySelectorAll('.search-input');
    
    searchInputs.forEach(searchInput => {
        searchInput.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            const query = e.target.value.trim();
            
            searchTimeout = setTimeout(async () => {
                if (query) {  // Jika query tidak kosong
                    try {
                        const encodedQuery = encodeURIComponent(query); // Encode query string
                        const response = await fetch(`${BASE_URL}/search/movie?api_key=${API_KEY}&query=${encodedQuery}`);
                        if (!response.ok) {
                            throw new Error('Search failed');
                        }
                        const data = await response.json();
                        displayMovies(data.results);
                        document.querySelector('.pagination').style.display = 'none';
                    } catch (error) {
                        console.error('Error searching movies:', error);
                        showError('Failed to search movies. Please try again.');
                    }
                } else {
                    loadMovies(1);
                    document.querySelector('.pagination').style.display = 'flex';
                }
            }, 500);
        });
    });
});

// Update event listeners untuk kategori
document.querySelectorAll('.category-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const categoryId = btn.dataset.categoryId;
        currentCategory = categoryId === 'all' ? null : categoryId;
        currentPage = 1;
        loadedMovies.clear(); // Reset loaded movies when changing category
        
        // Update active state
        document.querySelectorAll('.category-btn').forEach(b => b.classList.remove('active'));
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
                <button class="hero-btn watch-btn" onclick="showTrailer(${movie.id})">
                    <i class="fas fa-play"></i>
                    Watch Trailer
                </button>
                <button class="hero-btn info-btn" onclick="showDetail(${movie.id})">
                    <i class="fas fa-info-circle"></i>
                    More Info
                </button>
            </div>
        </div>
    `;

    // Add parallax effect
    let parallaxBg = heroElement.querySelector('.parallax-bg');
    window.addEventListener('scroll', () => {
        let scrolled = window.pageYOffset;
        parallaxBg.style.transform = `translateY(${scrolled * 0.5}px)`;
    });

    // Add hover effect to hero
    heroElement.addEventListener('mousemove', (e) => {
        const { offsetWidth: width, offsetHeight: height } = heroElement;
        const { clientX: x, clientY: y } = e;
        const moveX = (x - width/2) * 0.01;
        const moveY = (y - height/2) * 0.01;
        parallaxBg.style.transform = `translate(${moveX}px, ${moveY}px) scale(1.1)`;
    });

    heroElement.addEventListener('mouseleave', () => {
        parallaxBg.style.transform = 'translate(0, 0) scale(1)';
    });
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

    // Hanya tampilkan movie yang belum ada di container
    const existingMovieIds = new Set(
        Array.from(container.children).map(
            card => card.querySelector('[data-movie-id]')?.dataset.movieId
        )
    );

    movies.forEach(movie => {
        if (existingMovieIds.has(movie.id?.toString())) return;

        const card = document.createElement('div');
        card.className = 'movie-card';
        
        const posterPath = movie.poster_path 
            ? `https://image.tmdb.org/t/p/w500${movie.poster_path}`
            : 'https://via.placeholder.com/500x750?text=No+Poster';

        const primaryGenre = movie.genre_ids?.[0];
        const genreName = getGenreName(primaryGenre);

        card.innerHTML = `
            <div class="movie-poster-container">
                <img 
                    src="${posterPath}" 
                    class="movie-poster" 
                    alt="${movie.title}"
                    loading="lazy"
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
                        <button class="movie-btn trailer-btn" data-movie-id="${movie.id}">
                            <i class="fas fa-play"></i> Trailer
                        </button>
                        <button class="movie-btn details-btn" data-movie-id="${movie.id}">
                            <i class="fas fa-info"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;

        // Add event listeners
        const trailerBtn = card.querySelector('.trailer-btn');
        const detailsBtn = card.querySelector('.details-btn');

        trailerBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            showTrailer(movie.id);
        });

        detailsBtn.addEventListener('click', (e) => {
            e.preventDefault();
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
async function showWatchProviders(movieId) {
    try {
        // Fetch watch providers dengan deep links
        const response = await fetch(
            `${BASE_URL}/movie/${movieId}/watch/providers?api_key=${API_KEY}&append_to_response=external_ids`
        );
        const data = await response.json();
        
        const countryResults = data.results['ID'] || data.results['US'] || null;

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

        const response = await fetch(
            `${BASE_URL}/movie/${movieId}?api_key=${API_KEY}&append_to_response=videos,credits`
        );
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        const watchProvidersHTML = await showWatchProviders(movieId);
        
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
                    <div class="movie-actions">
                        <button class="movie-btn trailer-btn" data-movie-id="${movieId}">
                            <i class="fas fa-play"></i> Watch Trailer
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

        // Fetch trailer from TMDB API
        const response = await fetch(
            `${BASE_URL}/movie/${movieId}/videos?api_key=${API_KEY}`
        );
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
    document.querySelector('.hero').style.display = 'none';
    document.querySelector('.movie-section').style.display = 'none';
    document.querySelector('.about-section').style.display = 'none';
    
    // Show appropriate section
    switch(page) {
        case 'home':
            document.querySelector('.hero').style.display = 'block';
            document.querySelector('.movie-section').style.display = 'block';
            document.querySelector('.movie-section').style.marginTop = '0';
            loadFeaturedMovie();
            loadMovies(1);
            break;
        case 'movies':
            document.querySelector('.movie-section').style.display = 'block';
            document.querySelector('.movie-section').style.marginTop = '80px';
            loadMovies(1);
            break;
        case 'about':
            document.querySelector('.about-section').style.display = 'block';
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
    loadFeaturedMovie();
    loadMovies(1);
    addScrollToTop();
});

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