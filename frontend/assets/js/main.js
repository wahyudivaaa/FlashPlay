console.log("Main.js loaded");

const API_BASE_URL =
  window.location.hostname === "localhost" ||
  window.location.hostname === "127.0.0.1"
    ? "http://localhost:5001/api"
    : "/api";
const API_URL = `${API_BASE_URL}/movies`;
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
    console.log("Fetching featured movie...");
    const response = await fetch(`${API_URL}/featured`);
    console.log("Featured movie response:", response);
    const featuredMovie = await response.json();
    console.log("Featured movie data:", featuredMovie);
    updateHeroSection(featuredMovie);
  } catch (error) {
    console.error("Error loading featured movie:", error);
    // Hapus loading screen jika terjadi error
    document.querySelector(".loader").classList.add("hidden");
  }
}

// Tambahkan fungsi untuk menghapus loading screen
function removeLoader() {
  const loader = document.querySelector(".loader");
  if (loader) {
    loader.classList.add("hidden");
  }
}

// Update event listener
window.addEventListener("DOMContentLoaded", async () => {
  console.log("DOM loaded");
  try {
    await loadFeaturedMovie();
    await loadMovies();
  } catch (error) {
    console.error("Error initializing app:", error);
  } finally {
    // Selalu hapus loading screen setelah selesai
    removeLoader();
  }
});

// Event listener untuk scroll
// Event listener untuk scroll
window.addEventListener("scroll", () => {
  const header = document.querySelector("header");
  if (window.scrollY > 50) {
    header.classList.add("scrolled");
  } else {
    header.classList.remove("scrolled");
  }

  // Hanya untuk scroll-to-top button
  const scrollBtn = document.querySelector(".scroll-top");
  if (scrollBtn) {
    if (window.pageYOffset > 500) {
      scrollBtn.classList.add("visible");
    } else {
      scrollBtn.classList.remove("visible");
    }
  }
});

// Update fungsi loadMovies
async function loadMovies(page = 1, categoryId = null, resetMovies = true) {
  if (isLoading || page > totalPages) return;

  try {
    isLoading = true;
    const movieSection = document.querySelector(".movie-section");
    const loadingIndicator = document.createElement("div");
    loadingIndicator.className = "section-loading";
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
    data.results.forEach((movie) => {
      if (!Array.from(loadedMovies).some((m) => m.id === movie.id)) {
        loadedMovies.add(movie);
      }
    });

    // Display movies
    displayMovies(Array.from(loadedMovies), !resetMovies);
    updatePagination(currentPage);

    movieSection.removeChild(loadingIndicator);
  } catch (error) {
    console.error("Error loading movies:", error);
    showError("Failed to load movies. Please try again.");
  } finally {
    isLoading = false;
  }
}

// Update fungsi updatePagination
function updatePagination(currentPage) {
  const paginationContainer = document.querySelector(".pagination");
  const maxVisiblePages = 5;
  let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
  let endPage = Math.min(startPage + maxVisiblePages - 1, totalPages);

  if (endPage - startPage + 1 < maxVisiblePages) {
    startPage = Math.max(1, endPage - maxVisiblePages + 1);
  }

  let paginationHTML = `
        <button class="prev-btn" ${currentPage === 1 ? "disabled" : ""} onclick="switchPage(${currentPage - 1})">
            <i class="fas fa-chevron-left"></i>
        </button>
    `;

  if (startPage > 1) {
    paginationHTML += `
            <button onclick="switchPage(1)">1</button>
            ${startPage > 2 ? '<span class="dots">...</span>' : ""}
        `;
  }

  for (let i = startPage; i <= endPage; i++) {
    paginationHTML += `
            <button class="${i === currentPage ? "active" : ""}" onclick="switchPage(${i})">
                ${i}
            </button>
        `;
  }

  if (endPage < totalPages) {
    paginationHTML += `
            ${endPage < totalPages - 1 ? '<span class="dots">...</span>' : ""}
            <button onclick="switchPage(${totalPages})">${totalPages}</button>
        `;
  }

  paginationHTML += `
        <button class="next-btn" ${currentPage === totalPages ? "disabled" : ""} onclick="switchPage(${currentPage + 1})">
            <i class="fas fa-chevron-right"></i>
        </button>
    `;

  paginationContainer.innerHTML = paginationHTML;
}

// Update fungsi changePage
window.switchPage = async function (page) {
  if (page < 1 || page > totalPages || page === currentPage || isLoading)
    return;

  const movieContainer = document.getElementById("movieContainer");

  // Add fade animation
  movieContainer.style.opacity = "0";

  try {
    currentPage = page;

    if (currentContentType === "series") {
      await loadAllSeries(page);
    } else {
      await loadMovies(page, currentCategory);
    }

    // Fade in new content
    setTimeout(() => {
      movieContainer.style.opacity = "1";
    }, 300);

    // Scroll to top of grid
    const wrapper = document.querySelector(".content-wrapper");
    if (wrapper) {
      wrapper.scrollIntoView({ behavior: "smooth" });
    } else {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  } catch (error) {
    console.error("Error changing page:", error);
    showError("Failed to load page. Please try again.");
    movieContainer.style.opacity = "1";
  }
};

// Add keyboard navigation
document.addEventListener("keydown", (e) => {
  if (e.key === "ArrowLeft") {
    changePage(currentPage - 1);
  } else if (e.key === "ArrowRight") {
    changePage(currentPage + 1);
  }
});

// Update event listener untuk pencarian
// Update event listener untuk pencarian
document.addEventListener("DOMContentLoaded", () => {
  const searchContainer = document.querySelector(".search-container");
  const searchIcon = document.querySelector(".search-icon");
  const searchInput = document.querySelector(".search-input");

    // OLD LISTENER REMOVED - Logic moved to UNIFIED SEARCH HANDLER below
    // Close search when clicking outside (on the overlay background)
    document.addEventListener('click', (e) => {
        if (searchContainer.classList.contains('active')) {
            const cancelBtn = document.querySelector('.search-cancel-btn');
            // Close if clicking overlay background, but NOT input, icon, or cancel button
            if (!searchInput.contains(e.target) && 
                !searchIcon.contains(e.target) && 
                !document.getElementById('ai-toggle-btn').contains(e.target) &&
                (!cancelBtn || !cancelBtn.contains(e.target))) {
                 searchContainer.classList.remove('active');
            }
        }
    });

    // UNIFIED SEARCH HANDLER (AI + STANDARD)
    // Only triggers on Enter Key or Search Icon Click
    
    async function performSearch() {
        const query = searchInput.value.trim();
        if (!query) return;
        
        // 1. Check AI Mode first
        if (FlashBrain && FlashBrain.isAIMode) {
            await FlashBrain.askAI(query);
            return;
        }
        
        // 2. Standard Search
        // Auto-switch to Movies page if getting search results
        const moviesContent = document.getElementById("movies-page-content");
        if (moviesContent && moviesContent.style.display === "none") {
          handleNavigation("movies");
        }

        try {
          const encodedQuery = encodeURIComponent(query);
          const movieContainer = document.getElementById("movieContainer");
          
          // Show loading
          movieContainer.innerHTML = '<div class="loader-spinner"></div>';

          if (currentContentType === "series") {
            // SEARCH SERIES
            const response = await fetch(`${API_BASE_URL}/series/search?query=${encodedQuery}`);
            if (!response.ok) throw new Error("Series search failed");
            const data = await response.json();
            displaySeriesList(data.results);
          } else {
            // SEARCH MOVIES
            const response = await fetch(`${API_URL}/search?query=${encodedQuery}`);
            if (!response.ok) throw new Error("Movie search failed");
            const data = await response.json();
            displayMovies(data.results);
          }

          // Hide pagination during search
          const pagination = document.querySelector(".pagination");
          if (pagination) pagination.style.display = "none";
          
        } catch (error) {
          console.error("Error searching:", error);
          showError("Failed to search. Please try again.");
        }
    }

    // Trigger 1: Enter Key
    searchInput.addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            performSearch();
            searchInput.blur(); // Optional: hide keyboard on mobile
        }
    });

    // Trigger 2: Search Icon Click
    searchIcon.addEventListener('click', (e) => {
        e.stopPropagation();
        
        // If container is closed, open it
        if (!searchContainer.classList.contains('active')) {
            searchContainer.classList.add('active');
            searchInput.focus();
            
            // Add Cancel button logic (same as before)
            let cancelBtn = document.querySelector('.search-cancel-btn');
            if (!cancelBtn) {
                cancelBtn = document.createElement('span');
                cancelBtn.className = 'search-cancel-btn';
                cancelBtn.innerText = 'Cancel';
                searchContainer.appendChild(cancelBtn);
                
                cancelBtn.addEventListener('click', (ev) => {
                    ev.stopPropagation();
                    searchContainer.classList.remove('active');
                    searchInput.value = ''; 
                    searchInput.blur();
                });
            }
        } else {
            // If container is open AND has text, perform search
            if (searchInput.value.trim().length > 0) {
                performSearch();
            } else {
                // If empty, just focus
                searchInput.focus();
            }
        }
    });

    // REMOVED: searchInput.addEventListener("input", ...) -> No more live typing search
});

// Update event listeners untuk kategori
// Update event listeners untuk kategori (Pills)
document.querySelectorAll(".pill-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    const categoryId = btn.dataset.categoryId;
    currentCategory = categoryId === "all" ? null : categoryId;
    currentPage = 1;
    loadedMovies.clear(); // Reset loaded movies when changing category

    // Update active state
    document
      .querySelectorAll(".pill-btn")
      .forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");

    loadMovies(1, currentCategory, true);
  });
});

function updateHeroSection(movie) {
  if (!movie) return;

  const heroElement = document.querySelector(".hero");
  const heroContent = document.createElement("div");
  heroContent.className = "hero-content";

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
  const parallaxBg = heroElement.querySelector(".parallax-bg");

  // Remove existing listener if any
  if (parallaxHandler) {
    window.removeEventListener("scroll", parallaxHandler);
  }

  // Define new handler
  parallaxHandler = () => {
    // Optimization: Don't calculate if hero is hidden
    if (heroElement.style.display === "none") return;

    const scrolled = window.pageYOffset;
    // Optimization: Stop parallaxing if scrolled past hero
    if (scrolled > heroElement.offsetHeight) return;

    parallaxBg.style.transform = `translateY(${scrolled * 0.5}px)`;
  };

  // Add new listener
  window.addEventListener("scroll", parallaxHandler);

  // Add hover effect to hero (Clean up old listener implicitly by overwriting innerHTML? No, that clears children events.
  // Container events persist. We should use a named function for hover too if we want to clean it up,
  // but hover only fires when mouse is OVER the element, so it's less critical than global scroll.
  // However, let's keep it simple for now as scroll is the main CPU hog.)

  // Remove old hover listeners by cloning (trick to strip listeners) or just ignore (less impact)
  // For safety, we'll assign to onmousemove directly which overwrites previous
  heroElement.onmousemove = (e) => {
    const { offsetWidth: width, offsetHeight: height } = heroElement;
    const { clientX: x, clientY: y } = e;
    const moveX = (x - width / 2) * 0.01;
    const moveY = (y - height / 2) * 0.01;
    parallaxBg.style.transform = `translate(${moveX}px, ${moveY}px) scale(1.1)`;
  };

  heroElement.onmouseleave = () => {
    parallaxBg.style.transform = "translate(0, 0) scale(1)";
  };
}

// Update fungsi displayMovies
function displayMovies(movies, append = false) {
  const container = document.getElementById("movieContainer");

  if (!append) {
    container.innerHTML = "";
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

  movies.forEach((movie) => {
    // Skip movie jika tidak memiliki poster
    if (!movie.poster_path) return;

    const card = document.createElement("div");
    card.className = "movie-card";

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
                ${genreName ? `<span class="movie-category-badge">${genreName}</span>` : ""}
                <div class="movie-rating-badge">
                    <div class="rating-value"><i class="fas fa-star"></i> ${movie.vote_average?.toFixed(1) || "N/A"}</div>
                    <div class="year-value">${movie.release_date?.slice(0, 4) || "N/A"}</div>
                </div>
                <div class="movie-overlay">
                    <h3 class="movie-title">${movie.title}</h3>
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
    const watchBtn = card.querySelector(".watch-btn");
    const trailerBtn = card.querySelector(".trailer-btn");
    const detailsBtn = card.querySelector(".details-btn");

    watchBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      showStream(movie.id);
    });

    trailerBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      showTrailer(movie.id);
    });

    detailsBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      showDetail(movie.id);
    });

    container.appendChild(card);
  });
}

// Add genre mapping
const genreMap = {
  28: "Action",
  12: "Adventure",
  16: "Animation",
  35: "Comedy",
  80: "Crime",
  99: "Documentary",
  18: "Drama",
  10751: "Family",
  14: "Fantasy",
  36: "History",
  27: "Horror",
  10402: "Music",
  9648: "Mystery",
  10749: "Romance",
  878: "Sci-Fi",
  10770: "TV Movie",
  53: "Thriller",
  10752: "War",
  37: "Western",
};

function getGenreName(genreId) {
  return genreMap[genreId] || "";
}

// Update fungsi showWatchProviders
async function showWatchProviders(providersData) {
  try {
    if (!providersData) {
      return `<p class="no-providers">No streaming information available.</p>`;
    }

    const countryResults = providersData["ID"] || providersData["US"] || null;

    if (!countryResults) {
      return `<p class="no-providers">No streaming information available for your region.</p>`;
    }

    let providersHTML = "";

    // Streaming providers dengan deep links
    if (countryResults.flatrate?.length > 0) {
      providersHTML += `
                <div class="provider-section">
                    <h4>Stream</h4>
                    <div class="provider-list">
                        ${countryResults.flatrate
                          .map(
                            (provider) => `
                            <a href="${countryResults.deepLinks?.[provider.provider_id] || countryResults.link}" 
                               target="_blank" 
                               class="provider-item" 
                               title="Watch on ${provider.provider_name}">
                                <img src="https://image.tmdb.org/t/p/original${provider.logo_path}" 
                                     alt="${provider.provider_name}">
                                <span class="provider-name">${provider.provider_name}</span>
                            </a>
                        `,
                          )
                          .join("")}
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
                        ${countryResults.rent
                          .map(
                            (provider) => `
                            <a href="${countryResults.deepLinks?.[provider.provider_id] || countryResults.link}" 
                               target="_blank" 
                               class="provider-item" 
                               title="Rent on ${provider.provider_name}">
                                <img src="https://image.tmdb.org/t/p/original${provider.logo_path}" 
                                     alt="${provider.provider_name}">
                                <span class="provider-name">${provider.provider_name}</span>
                            </a>
                        `,
                          )
                          .join("")}
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
                        ${countryResults.buy
                          .map(
                            (provider) => `
                            <a href="${countryResults.deepLinks?.[provider.provider_id] || countryResults.link}" 
                               target="_blank" 
                               class="provider-item" 
                               title="Buy on ${provider.provider_name}">
                                <img src="https://image.tmdb.org/t/p/original${provider.logo_path}" 
                                     alt="${provider.provider_name}">
                                <span class="provider-name">${provider.provider_name}</span>
                            </a>
                        `,
                          )
                          .join("")}
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
    console.error("Error fetching watch providers:", error);
    return '<p class="error-message">Failed to load streaming information.</p>';
  }
}

// Update showDetail function to include watch providers
async function showDetail(movieId) {
  try {
    currentMovieId = movieId;

    const modal = document.querySelector(".detail-modal");
    const detailContent = modal.querySelector(".detail-content");
    detailContent.innerHTML = '<div class="spinner"></div>';
    modal.classList.add("active");

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
    const header = detailContent.querySelector(".detail-header");
    const poster = detailContent.querySelector(".detail-poster");
    const title = detailContent.querySelector(".detail-title");
    const rating = detailContent.querySelector(".rating span");
    const year = detailContent.querySelector(".year span");
    const runtime = detailContent.querySelector(".runtime span");
    const genres = detailContent.querySelector(".detail-genres");
    const overview = detailContent.querySelector(".detail-overview");

    // Set content
    header.style.backgroundImage = data.backdrop_path
      ? `url(https://image.tmdb.org/t/p/original${data.backdrop_path})`
      : "none";

    poster.src = data.poster_path
      ? `https://image.tmdb.org/t/p/w500${data.poster_path}`
      : "https://via.placeholder.com/500x750?text=No+Poster";

    poster.onerror = () => {
      poster.src = "https://via.placeholder.com/500x750?text=No+Poster";
    };

    title.textContent = data.title || "Unknown Title";
    rating.textContent = `${data.vote_average ? data.vote_average.toFixed(1) : "N/A"}/10`;
    year.textContent = data.release_date?.slice(0, 4) || "N/A";
    runtime.textContent = data.runtime ? `${data.runtime} mins` : "N/A";
    overview.textContent = data.overview || "No overview available";

    genres.innerHTML =
      data.genres && data.genres.length > 0
        ? data.genres
            .map((genre) => `<span class="genre-tag">${genre.name}</span>`)
            .join("")
        : '<span class="genre-tag">No genres available</span>';

    // Add event listeners
    const closeBtn = detailContent.querySelector(".close-btn");
    closeBtn.addEventListener("click", () => {
      modal.classList.remove("active");
    });

    // Watch button event listener
    const watchBtn = detailContent.querySelector(".watch-btn");
    if (watchBtn) {
      watchBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        modal.classList.remove("active");
        showStream(movieId);
      });
    }

    const trailerBtn = detailContent.querySelector(".trailer-btn");
    trailerBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      showTrailerFromDetail();
    });
  } catch (error) {
    console.error("Error loading movie details:", error);
    showError("Failed to load movie details. Please try again.");
    document.querySelector(".detail-modal").classList.remove("active");
  }
}

function showTrailerFromDetail() {
  document.querySelector(".detail-modal").classList.remove("active");
  showTrailer(currentMovieId);
}

// Add event listener for closing modal
document.querySelectorAll(".close-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelector(".detail-modal").classList.remove("active");
  });
});

// Fungsi untuk menampilkan trailer
async function showTrailer(movieId) {
  try {
    // Create modal if it doesn't exist
    let modal = document.querySelector(".trailer-modal");
    if (!modal) {
      modal = document.createElement("div");
      modal.className = "trailer-modal";
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

    const videoContainer = modal.querySelector(".video-container");
    modal.classList.add("active");

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
    const trailer =
      data.results.find(
        (video) =>
          video.type === "Trailer" && video.site.toLowerCase() === "youtube",
      ) || data.results.find((video) => video.site.toLowerCase() === "youtube");

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
      const closeBtn = modal.querySelector(".close-btn");
      const closeModal = () => {
        modal.classList.remove("active");
        videoContainer.innerHTML = "";
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
        if (e.key === "Escape") {
          closeModal();
          document.removeEventListener("keydown", escHandler);
        }
      };
      document.addEventListener("keydown", escHandler);
    } else {
      modal.classList.remove("active");
      showError("No trailer available for this movie");
    }
  } catch (error) {
    console.error("Error fetching trailer:", error);
    document.querySelector(".trailer-modal").classList.remove("active");
    showError("Failed to load trailer. Please try again.");
  }
}

// ============================================
// STREAMING FEATURE - Watch Movies Directly
// ============================================

// Stream providers configuration (multiple fallbacks)
// Server 1 = Rebahin21 (default, Indonesian content)
// Other servers ordered by ad-free status
const STREAM_PROVIDERS = [
  // ===== SERVER 1: REBAHIN21 (DEFAULT - Indonesian Content) =====
  {
    name: "Server 1 (Default)",
    url: null, // Dynamic URL - fetched via API
    hasAds: false,
    quality: "best",
    sandboxCompatible: false,
    isRebahin: true, // Flag untuk handling khusus
  },
  // ===== SERVER 2-4: NO POPUPS =====
  {
    name: "Server 2",
    url: (id) => `https://vidsrc.vip/embed/movie/${id}`,
    hasAds: false,
    manyAds: false,
    quality: "best",
    sandboxCompatible: false,
  },
  {
    name: "Server 3",
    url: (id) => `https://player.autoembed.cc/embed/movie/${id}`,
    hasAds: false,
    manyAds: false,
    sandboxCompatible: false,
  },
  {
    name: "Server 4",
    url: (id) => `${API_BASE_URL}/embed?url=${encodeURIComponent(`https://vidsrc.cc/v2/embed/movie/${id}`)}&ns=1`,
    hasAds: false,
    manyAds: false,
    proxied: true,
    noSandbox: true,
  },
  {
    name: "Server 5",
    url: (id) => `https://embed.su/embed/movie/${id}`,
    hasAds: false,
    manyAds: false,
    sandboxCompatible: true,
  },
  // ===== SERVER 6-8: MAY HAVE ADS =====
  {
    name: "Server 6",
    url: (id) => `https://vidsrc.to/embed/movie/${id}`,
    hasAds: true,
    manyAds: true,
  },
  {
    name: "Server 7",
    url: (id) => `https://player.smashy.stream/movie/${id}`,
    hasAds: true,
    manyAds: true,
  },
  { 
    name: "Server 8", 
    url: (id) => `https://www.2embed.cc/embed/${id}`,
    hasAds: true,
  },
];

let currentStreamProvider = 0;

// ============================================
// POPUP BLOCKER SYSTEM
// Comprehensive protection against popup ads
// ============================================

// Track popup blocker state
const PopupBlocker = {
  isActive: false,
  blockedCount: 0,
  originalWindowOpen: null,
  protectionInterval: null,
  
  // Initialize popup blocker
  // Initialize popup blocker
  init() {
    if (this.isActive) return;
    
    console.log('[PopupBlocker] Initializing popup protection...');
    this.isActive = true;
    this.blockedCount = 0;
    
    // 1. ULTRA-AGGRESSIVE window.open Override
    // Use Object.defineProperty to prevent subsequent scripts from restoring it
    this.originalWindowOpen = window.open;
    
    try {
      Object.defineProperty(window, 'open', {
        configurable: false,
        writable: false,
        value: function(url, name, features) {
          console.log('[PopupBlocker] ⛔ Aggressively blocked popup:', url);
          PopupBlocker.blockedCount++;
          PopupBlocker.updateBadge();
          PopupBlocker.showBlockedNotification(url);
          
          // Return a FROZEN fake window to prevent property access
          const fakeWindow = {
            close: () => {},
            focus: () => {},
            blur: () => {},
            postMessage: () => {},
            addEventListener: () => {},
            document: { write: () => {}, open: () => {}, close: () => {} },
            location: { href: url || '' },
            closed: false
          };
          Object.freeze(fakeWindow);
          return fakeWindow;
        }
      });
    } catch(e) {
      // Fallback if redefine fails
      console.warn('[PopupBlocker] defineProperty failed, using standard override', e);
      window.open = function(url) {
        console.log('[PopupBlocker] ⛔ Blocked popup (fallback):', url);
        return null;
      };
    }
    
    // 2. Block click-based popups via event capture
    document.addEventListener('click', this.handleClick, true);
    
    // 3. Protect against tab hijacking/redirect
    window.addEventListener('beforeunload', this.handleBeforeUnload);
    
    // 4. Monitor for sneaky popup attempts
    this.protectionInterval = setInterval(() => {
      this.checkForNewWindows();
    }, 1000);
    
    // 5. Override document.createElement to catch dynamic script injection
    this.wrapCreateElement();
    
    console.log('[PopupBlocker] Protection active!');
  },
  
  // Cleanup popup blocker
  destroy() {
    if (!this.isActive) return;
    
    console.log('[PopupBlocker] Cleaning up...');
    this.isActive = false;
    
    // Restore original window.open
    if (this.originalWindowOpen) {
      window.open = this.originalWindowOpen;
    }
    
    // Remove event listeners
    document.removeEventListener('click', this.handleClick, true);
    window.removeEventListener('beforeunload', this.handleBeforeUnload);
    
    // Clear interval
    if (this.protectionInterval) {
      clearInterval(this.protectionInterval);
      this.protectionInterval = null;
    }
    
    // Reset counter
    this.blockedCount = 0;
  },
  
  // Handle click events to prevent popup triggers
  handleClick(e) {
    // Check if clicked element is a sneaky popup trigger
    const target = e.target;
    
    // Block clicks on hidden/transparent overlay elements
    if (target.tagName === 'A') {
      const href = target.getAttribute('href');
      const targetAttr = target.getAttribute('target');
      
      // Suspicious external links with _blank
      if (targetAttr === '_blank' && href) {
        const currentHost = window.location.hostname;
        try {
          const linkHost = new URL(href, window.location.origin).hostname;
          if (linkHost !== currentHost && !href.includes('tmdb.org')) {
            console.log('[PopupBlocker] 🚫 Blocked suspicious link:', href);
            e.preventDefault();
            e.stopPropagation();
            PopupBlocker.blockedCount++;
            PopupBlocker.updateBadge();
            PopupBlocker.showBlockedNotification(href);
          }
        } catch (err) {
          // Invalid URL, let it pass
        }
      }
    }
  },
  
  // Protect against beforeunload redirect attacks
  handleBeforeUnload(e) {
    // Get current URL
    const currentUrl = window.location.href;
    
    // If we're on FlashPlay and something tries to navigate away during streaming
    if (currentUrl.includes('localhost') || currentUrl.includes('flashplay')) {
      const modal = document.querySelector('.stream-modal.active');
      if (modal) {
        // We're streaming - block navigation attempts
        console.log('[PopupBlocker] 🚫 Blocked tab redirect attempt');
        e.preventDefault();
        e.returnValue = '';
      }
    }
  },
  
  // Check for any new windows and RE-APPLY protection
  checkForNewWindows() {
    // Some aggressive ads try to restore window.open via delete window.open
    if (window.open !== this.originalWindowOpen && !window.open.toString().includes('Aggressively blocked')) {
        // They overwrote it! Re-apply lock
        try {
            Object.defineProperty(window, 'open', {
                configurable: false,
                writable: false,
                value: function(url) {
                    console.log('[PopupBlocker] ⛔ Re-blocked popup:', url);
                    return null;
                }
            });
        } catch(e) {
            window.open = function() { return null; };
        }
    }
  },
  
  // Wrap createElement to catch dynamic iframe/script injection for ads
  wrapCreateElement() {
    const originalCreateElement = document.createElement.bind(document);
    document.createElement = function(tagName) {
      const element = originalCreateElement(tagName);
      
      // Monitor iframe creations
      if (tagName.toLowerCase() === 'iframe') {
        // Add mutation observer on src attribute
        const observer = new MutationObserver((mutations) => {
          mutations.forEach((mutation) => {
            if (mutation.type === 'attributes' && mutation.attributeName === 'src') {
              const src = element.getAttribute('src');
              // Check for ad/tracking patterns
              if (src && PopupBlocker.isAdUrl(src)) {
                console.log('[PopupBlocker] 🚫 Blocked ad iframe:', src);
                element.src = 'about:blank';
              }
            }
          });
        });
        observer.observe(element, { attributes: true });
      }
      
      return element;
    };
  },
  
  // Check if URL matches known ad patterns
  isAdUrl(url) {
    const adPatterns = [
      'doubleclick', 'googlesyndication', 'adservice',
      'popads', 'popcash', 'propellerads', 'exoclick',
      'juicyads', 'trafficjunky', 'ad.', 'ads.',
      '1xbet', 'stake.com', 'slot', 'casino', 'betting',
      'wps.com/download', 'wonderblock', 'adblocker-offer'
    ];
    
    const lowerUrl = url.toLowerCase();
    return adPatterns.some(pattern => lowerUrl.includes(pattern));
  },
  
  // Update the blocked count badge
  updateBadge() {
    let badge = document.querySelector('.popup-blocked-badge');
    if (badge) {
      const countEl = badge.querySelector('.blocked-count');
      if (countEl) {
        countEl.textContent = this.blockedCount;
      }
      if (this.blockedCount > 0) {
        badge.style.display = 'flex';
        badge.classList.add('pulse');
        setTimeout(() => badge.classList.remove('pulse'), 500);
      }
    }
  },
  
  // Show notification when popup is blocked
  showBlockedNotification(url) {
    // Create toast notification
    let toast = document.querySelector('.popup-blocked-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.className = 'popup-blocked-toast';
      document.body.appendChild(toast);
    }
    
    // Get shortened URL
    let shortUrl = url;
    try {
      shortUrl = new URL(url).hostname;
    } catch (e) {
      shortUrl = url?.substring(0, 30) || 'unknown';
    }
    
    toast.innerHTML = `
      <i class="fas fa-shield-alt"></i>
      <span>Popup diblokir: ${shortUrl}</span>
    `;
    toast.classList.add('show');
    
    setTimeout(() => {
      toast.classList.remove('show');
    }, 2000);
  }
};

// ============================================
// CLICK SHIELD - Absorbs first N clicks on ad-heavy iframes
// Used for servers like vidlink.pro that detect sandbox but use click-hijacking
// ============================================
function addClickShield(container, providerIndex) {
  const CLICKS_TO_ABSORB = 3; // Number of clicks to absorb before allowing interaction
  let clicksAbsorbed = 0;
  
  // Create shield overlay
  const shield = document.createElement('div');
  shield.className = 'click-shield';
  shield.innerHTML = `
    <div class="shield-content">
      <div class="shield-icon">
        <i class="fas fa-mouse-pointer"></i>
      </div>
      <p class="shield-text">Klik <span class="clicks-remaining">${CLICKS_TO_ABSORB}</span>x di sini untuk melewati iklan</p>
      <p class="shield-hint">Klik di area ini akan memblokir popup iklan</p>
    </div>
  `;
  
  // Style the shield
  Object.assign(shield.style, {
    position: 'absolute',
    top: '0',
    left: '0',
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    zIndex: '10',
    color: 'white',
    textAlign: 'center',
    transition: 'opacity 0.3s ease'
  });
  
  // Style the content
  const content = shield.querySelector('.shield-content');
  content.style.cssText = 'display: flex; flex-direction: column; align-items: center; gap: 12px;';
  
  const icon = shield.querySelector('.shield-icon');
  icon.style.cssText = 'font-size: 48px; color: #4fc3f7; animation: pulse 1s ease-in-out infinite;';
  
  const text = shield.querySelector('.shield-text');
  text.style.cssText = 'font-size: 18px; font-weight: 600; margin: 0;';
  
  const clicksSpan = shield.querySelector('.clicks-remaining');
  clicksSpan.style.cssText = 'color: #ff5252; font-size: 24px; font-weight: bold;';
  
  const hint = shield.querySelector('.shield-hint');
  hint.style.cssText = 'font-size: 12px; color: #aaa; margin: 0;';
  
  // Make container relative for absolute positioning
  container.style.position = 'relative';
  container.appendChild(shield);
  
  // Handle clicks on shield
  shield.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    clicksAbsorbed++;
    const remaining = CLICKS_TO_ABSORB - clicksAbsorbed;
    
    console.log(`[ClickShield] Absorbed click ${clicksAbsorbed}/${CLICKS_TO_ABSORB}`);
    PopupBlocker.blockedCount++;
    PopupBlocker.updateBadge();
    
    if (remaining > 0) {
      // Update UI
      clicksSpan.textContent = remaining;
      
      // Visual feedback
      shield.style.backgroundColor = 'rgba(0, 150, 0, 0.5)';
      setTimeout(() => {
        shield.style.backgroundColor = 'rgba(0, 0, 0, 0.75)';
      }, 150);
      
      PopupBlocker.showBlockedNotification(`Iklan ${clicksAbsorbed} diblokir`);
    } else {
      // All clicks absorbed, remove shield
      console.log('[ClickShield] All ad clicks absorbed, allowing interaction');
      shield.style.opacity = '0';
      
      setTimeout(() => {
        shield.remove();
        
        // Show success message
        const notice = document.querySelector('.stream-modal .stream-notice');
        if (notice) {
          notice.innerHTML = `
            <i class="fas fa-check-circle" style="color: #00e676"></i>
            <strong style="color:#00e676">Iklan dilewati!</strong> 
            Klik video untuk play/pause.
          `;
        }
      }, 300);
    }
  });
  
  console.log('[ClickShield] Activated for provider:', STREAM_PROVIDERS[providerIndex]?.name);
}

// Function to show stream modal
async function showStream(movieId) {
  try {
    // Create stream modal if it doesn't exist
    let modal = document.querySelector(".stream-modal");
    if (!modal) {
      modal = document.createElement("div");
      modal.className = "stream-modal";
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
                        <div class="popup-blocked-badge" style="display: none">
                            <i class="fas fa-shield-alt"></i>
                            <span class="blocked-count">0</span> popup diblokir
                        </div>
                        <div class="popup-blocked-badge" style="display: none">
                            <i class="fas fa-shield-alt"></i>
                            <span class="blocked-count">0</span> popup diblokir
                        </div>
                    </div>
                </div>
            `;

      document.body.appendChild(modal);
    }

    const streamContainer = modal.querySelector(".stream-container");
    const streamTitle = modal.querySelector(".stream-title");
    const serverButtons = modal.querySelector(".server-buttons");

    // Fetch movie details for title using Backend Proxy
    const response = await fetch(`${API_URL}/${movieId}`);
    const movieData = await response.json();
    streamTitle.textContent = movieData.title || "Now Playing";

    // Create server buttons
    serverButtons.innerHTML = STREAM_PROVIDERS.map(
      (provider, index) => `
            <button class="server-btn ${index === 0 ? "active" : ""}" 
                    data-provider="${index}" 
                    data-movie-id="${movieId}">
                ${provider.name}
            </button>
        `,
    ).join("");

    // Add click handlers for server buttons
    serverButtons.querySelectorAll(".server-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const providerIndex = parseInt(
          btn.dataset.providerId || btn.dataset.provider,
        );
        const tmdbId = btn.dataset.movieId;

        // Update active state
        serverButtons
          .querySelectorAll(".server-btn")
          .forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");

        // Load new stream
        loadStream(streamContainer, tmdbId, providerIndex);
      });
    });

    // Show modal
    modal.classList.add("active");
    document.body.style.overflow = "hidden";

    // 🛡️ ACTIVATE POPUP BLOCKER
    PopupBlocker.init();

    // Track current movie ID for fallback
    window.currentStreamingMovieId = movieId;

    // Save to History
    FlashBrain.addToHistory(movieId, streamTitle.textContent);

    // Load initial stream
    loadStream(streamContainer, movieId, 0);

    // Close button handler
    const closeBtn = modal.querySelector(".close-stream-btn");
    closeBtn.onclick = () => closeStreamModal(modal);

    // Fullscreen button handler
    const fullscreenBtn = modal.querySelector(".fullscreen-btn");
    fullscreenBtn.onclick = () => {
      const iframe = streamContainer.querySelector("iframe");
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
      if (e.key === "Escape") {
        closeStreamModal(modal);
        document.removeEventListener("keydown", escHandler);
      }
    };
    document.addEventListener("keydown", escHandler);
  } catch (error) {
    console.error("Error loading stream:", error);
    showError("Failed to load stream. Please try again.");
  }
}

// Load stream into container
async function loadStream(container, movieId, providerIndex = 0, retryCount = 0) {
  // Show loading state
  container.innerHTML = `
    <div class="stream-loading">
      <div class="spinner"></div>
      <p id="stream-status">Searching Server 1...</p>
    </div>
  `;

  const provider = STREAM_PROVIDERS[providerIndex];
  const statusEl = container.querySelector('#stream-status');
  
  // Handle Primary Server (Server 1)
  if (provider.isRebahin) {
    try {
      statusEl.textContent = retryCount > 0 ? 'Mencoba lagi (Re-attempt)...' : 'Loading...';
      console.log(`[StreamEngine] Fetching source (Attempt ${retryCount + 1})...`);
      
      const response = await fetch(`${API_BASE_URL}/rebahin/movie/${movieId}`);
      
      if (!response.ok) {
        throw new Error(`Server returned ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.success && data.playerUrl) {
        console.log('[StreamEngine] Source found.');
        const proxiedUrl = `${API_BASE_URL}/embed?url=${encodeURIComponent(data.playerUrl)}`;
        
        const iframeHtml = `
          <iframe 
              src="${proxiedUrl}"
              frameborder="0"
              allowfullscreen
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
              referrerpolicy="origin"
              class="stream-iframe"
              sandbox="allow-scripts allow-same-origin allow-forms allow-presentation"
          ></iframe>
        `;
        container.innerHTML = iframeHtml;
        return;
      } else {
        // 404 Not Found - Retry or Fallback
        if (retryCount < 1) {
             console.log('[StreamEngine] Not found, retrying...');
             setTimeout(() => loadStream(container, movieId, providerIndex, retryCount + 1), 1000);
             return;
        }
        
        console.log('[StreamEngine] Source not found, switching...');
        statusEl.textContent = 'Tidak ditemukan, pindah server...';
        setTimeout(() => loadStream(container, movieId, 1), 500);
        return;
      }
    } catch (error) {
      console.warn('[StreamEngine] unavailable:', error.message);
      
      // Error/Timeout - Retry logic
      if (retryCount < 1) {
           console.log('[StreamEngine] Connection failed, retrying...');
           statusEl.textContent = 'Koneksi lambat, mencoba lagi...';
           setTimeout(() => loadStream(container, movieId, providerIndex, retryCount + 1), 2000);
           return;
      }

      statusEl.textContent = 'Server 1 sibuk, mencoba server lain...';
      setTimeout(() => loadStream(container, movieId, 1), 500);
      return;
    }
  }

  // Try ad-free extraction for other servers (only for first few non-Rebahin servers)
  if (providerIndex >= 1 && providerIndex < 3) {
    try {
      statusEl.textContent = 'Mengekstrak stream HD...';
      
      const response = await fetch(`${API_BASE_URL}/stream/movie/${movieId}`);
      const data = await response.json();
      
      if (data.success && data.sources && data.sources.length > 0) {
        console.log('[AdFree] Stream extracted successfully:', data.sources);
        statusEl.textContent = 'Stream ditemukan! Memuat player...';
        
        // Use HLS.js player for ad-free playback
        loadHLSPlayer(container, data.sources[0].url, data.subtitles || [], providerIndex);
        return;
      }
    } catch (error) {
      console.log('[AdFree] Extraction failed, using iframe fallback:', error.message);
    }
  }

  // Fallback to iframe embed
  console.log('[Stream] Using iframe fallback for provider:', providerIndex);
  let streamUrl = provider.url(movieId);

  // Try to force Indonesian subtitles/language for SuperEmbed
  if (provider.name.includes("SuperEmbed")) {
    if (!streamUrl.includes("?")) streamUrl += "?";
    streamUrl += "&lang=id&sub_lang=id&caption=Indonesian";
  }

  // Force Indonesian subtitles for AutoEmbed (Server 3)
  if (provider.name.includes("Server 3")) {
      const separator = streamUrl.includes('?') ? '&' : '?';
      streamUrl += `${separator}caption=Indonesian&sub=id`;
  }

  // 🛡️ PROTECTION STRATEGY:
  // - Servers with sandboxCompatible: false → No sandbox (they detect & block it)
  // - Servers with sandboxCompatible: true/undefined → Use sandbox for popup protection
  // - PopupBlocker.init() is ALWAYS active as backup for servers without sandbox
  const useSandbox = provider.sandboxCompatible !== false;

  const iframeHtml = `
    <iframe 
        src="${streamUrl}"
        frameborder="0"
        allowfullscreen
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
        referrerpolicy="origin"
        class="stream-iframe"
        ${useSandbox ? 'sandbox="allow-scripts allow-same-origin allow-forms allow-presentation"' : ''}
    ></iframe>
  `;

  container.innerHTML = iframeHtml;
  
  // 🛡️ CLICK SHIELD for non-sandbox servers
  // These servers use click-hijacking inside their iframe which we can't block
  // Solution: Absorb the first N clicks before allowing iframe interaction
  if (!useSandbox && provider.hasAds) {
    addClickShield(container, providerIndex);
  }
  
  // Show warning/info for different server types
  const modal = document.querySelector('.stream-modal');
  const notice = modal?.querySelector('.stream-notice');
  if (notice) {
      notice.style.display = 'none';
  }
}


// HLS.js player for ad-free streaming
function loadHLSPlayer(container, streamUrl, subtitles = [], providerIndex = 0) {
  const videoId = 'adFreePlayer-' + Date.now();
  
  container.innerHTML = `
    <div class="adfree-player-wrapper">
      <video id="${videoId}" class="adfree-video" controls playsinline>
        ${subtitles.map(sub => `
          <track kind="subtitles" src="${sub.url}" srclang="${sub.lang || 'id'}" label="${sub.lang || 'Indonesian'}">
        `).join('')}
      </video>
      <div class="adfree-badge">
        <i class="fas fa-shield-alt"></i> Bebas Iklan
      </div>
    </div>
  `;
  
  const video = document.getElementById(videoId);
  
  // Add ad-free player styles
  addAdFreePlayerStyles();
  
  if (Hls.isSupported()) {
    const hls = new Hls({
      maxBufferLength: 30,
      maxMaxBufferLength: 60,
    });
    
    hls.loadSource(streamUrl);
    hls.attachMedia(video);
    
    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      console.log('[HLS] Manifest parsed, starting playback');
      video.play().catch(e => console.log('[HLS] Autoplay blocked:', e.message));
    });
    
    hls.on(Hls.Events.ERROR, (event, data) => {
      if (data.fatal) {
        console.error('[HLS] Fatal error:', data.type, data.details);
        // On fatal error, fall back to iframe
        showError('Stream error. Menggunakan player backup...');
        const movieId = window.currentStreamingMovieId;
        if (movieId) {
          loadStreamFallback(container, movieId, providerIndex); // Use correct provider fallback
        }
      }
    });
    
    // Store HLS instance for cleanup
    container.hlsInstance = hls;
  } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
    // Native HLS support (Safari)
    video.src = streamUrl;
    video.addEventListener('loadedmetadata', () => {
      video.play().catch(e => console.log('[Native HLS] Autoplay blocked:', e.message));
    });
  } else {
    console.error('[HLS] HLS not supported');
    showError('Browser tidak mendukung HLS. Menggunakan player backup...');
    loadStreamFallback(container, window.currentStreamingMovieId, providerIndex);
  }
}

// Direct iframe fallback (skips ad-free attempt)
function loadStreamFallback(container, movieId, providerIndex) {
  const provider = STREAM_PROVIDERS[providerIndex] || STREAM_PROVIDERS[0];
  const streamUrl = provider.url(movieId);
  
  // Apply sandbox for ad-heavy servers
  const useSandbox = provider.hasAds;
  
  container.innerHTML = `
    <iframe 
        src="${streamUrl}"
        frameborder="0"
        allowfullscreen
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        referrerpolicy="origin"
        class="stream-iframe"
        ${provider.sandboxCompatible !== false ? 'sandbox="allow-scripts allow-same-origin allow-forms allow-presentation"' : ''}
    ></iframe>
  `;
}

// Add styles for ad-free player
function addAdFreePlayerStyles() {
  if (document.getElementById('adfree-player-styles')) return;
  
  const styles = document.createElement('style');
  styles.id = 'adfree-player-styles';
  styles.textContent = `
    .adfree-player-wrapper {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: #000;
    }
    
    .adfree-video {
      width: 100%;
      height: 100%;
      object-fit: contain;
    }
    
    .adfree-badge {
      position: absolute;
      top: 15px;
      left: 15px;
      background: linear-gradient(135deg, #00c853, #00e676);
      color: white;
      padding: 6px 12px;
      border-radius: 20px;
      font-size: 0.75rem;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 6px;
      box-shadow: 0 2px 10px rgba(0, 200, 83, 0.4);
      z-index: 10;
      animation: fadeInBadge 0.5s ease;
    }
    
    .adfree-badge i {
      font-size: 0.85rem;
    }
    
    @keyframes fadeInBadge {
      from { opacity: 0; transform: translateY(-10px); }
      to { opacity: 1; transform: translateY(0); }
    }
  `;
  document.head.appendChild(styles);
}

// Close stream modal
function closeStreamModal(modal) {
  // 🛡️ DEACTIVATE POPUP BLOCKER
  PopupBlocker.destroy();
  
  modal.classList.remove("active");
  document.body.style.overflow = "";
  const streamContainer = modal.querySelector(".stream-container");
  streamContainer.innerHTML = ""; // Stop the stream
}

// styles moved to style.css

// ============================================

// Fungsi helper untuk menampilkan error
function showError(message) {
  const errorToast = document.createElement("div");
  errorToast.className = "error-toast";
  errorToast.textContent = message;

  document.body.appendChild(errorToast);

  setTimeout(() => {
    errorToast.classList.add("show");
  }, 10);

  setTimeout(() => {
    errorToast.classList.remove("show");
    setTimeout(() => errorToast.remove(), 300);
  }, 3000);
}

// Update CSS untuk animasi
const style = document.createElement("style");
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
  const navLinks = document.querySelectorAll(".nav-link");

  // Set active berdasarkan current path
  const currentPath = window.location.pathname;
  navLinks.forEach((link) => {
    if (link.getAttribute("href") === currentPath) {
      link.classList.add("active");
    }
  });

  // Event listener untuk setiap link
  navLinks.forEach((link) => {
    link.addEventListener("click", (e) => {
      e.preventDefault();

      // Remove active class dari semua link
      navLinks.forEach((l) => l.classList.remove("active"));

      // Add active class ke link yang diklik
      link.classList.add("active");

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
  const hero = document.querySelector(".hero");
  const homeContent = document.getElementById("home-content");
  const moviesContent = document.getElementById("movies-page-content");
  const aboutSection = document.querySelector(".about-section");
  const oldMovieSection = document.querySelector(".movie-section"); // Fallback
  const searchSection =
    document.querySelector(".search-section") ||
    document.querySelector(".search-container"); // Try to find search

  if (hero) hero.style.display = "none";
  if (homeContent) homeContent.style.display = "none";
  if (moviesContent) moviesContent.style.display = "none";
  if (aboutSection) aboutSection.style.display = "none";
  if (oldMovieSection && !homeContent && !moviesContent)
    oldMovieSection.style.display = "none";

  // Default: Show search
  if (searchSection) searchSection.style.visibility = "visible";

  // Show appropriate section
  switch (page) {
    case "home":
      if (hero) hero.style.display = ""; // Let CSS handle display (flex/block)

      if (homeContent) {
        homeContent.style.display = "";
        // Only load swimlanes if function exists and content block exists
        if (!window.swimlanesLoaded) {
          loadSwimlanes();
        }
      } else if (oldMovieSection) {
        // Fallback for old layout
        oldMovieSection.style.display = "";
        loadFeaturedMovie();
        loadMovies(1);
      }
      break;

    case "movies":
      currentContentType = "movie";
      if (moviesContent) {
        moviesContent.style.display = "";
        const title = document.querySelector(
          "#movies-page-content .section-title",
        );
        if (title) title.textContent = "Popular Movies";

        const pills = document.querySelector(".category-pills");
        if (pills) pills.style.display = "flex";

        if (loadedMovies.size === 0) loadMovies(1);
        loadSeriesSidebar();
      } else if (oldMovieSection) {
        oldMovieSection.style.display = "";
        if (loadedMovies.size === 0) loadMovies(1);
      }
      break;

    case "series":
      currentContentType = "series";
      if (moviesContent) {
        moviesContent.style.display = "";
        const title = document.querySelector(
          "#movies-page-content .section-title",
        );
        if (title) title.textContent = "Popular Series";

        // Hide movie category pills for now
        const pills = document.querySelector(".category-pills");
        if (pills) pills.style.display = "none";

        if (loadedMovies.size === 0 || currentContentType !== "series")
          loadAllSeries(1);
        loadSeriesSidebar();
      }
      break;

    case "about":
      if (aboutSection) aboutSection.style.display = "";
      // Disable search on about page
      if (searchSection) searchSection.style.visibility = "hidden";
      break;
  }

  // Update active nav link
  document.querySelectorAll(".nav-link").forEach((link) => {
    link.classList.remove("active");
    if (link.dataset.page === page) {
      link.classList.add("active");
    }
  });
}

// Handle browser back/forward
window.addEventListener("popstate", (event) => {
  if (event.state && event.state.page) {
    handleNavigation(event.state.page);
  }
});

// Tambahkan initializeNavigation ke event listener DOMContentLoaded yang sudah ada
document.addEventListener("DOMContentLoaded", () => {
  initializeNavigation();

  // Check current page from URL or default to home
  // (This is implicitly handled by initializeNavigation if implemented correctly,
  // but we need to trigger the initial load)
  const activeLink = document.querySelector(".nav-link.active");
  if (activeLink) {
    handleNavigation(activeLink.dataset.page);
  } else {
    handleNavigation("home");
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
      fetch(`${API_URL}/upcoming`),
    ]);

    const trendingData = await trending.json();
    const topRatedData = await topRated.json();
    const upcomingData = await upcoming.json();

    // Render rows
    renderRow("trending-row", trendingData.results);
    renderRow("top-rated-row", topRatedData.results);
    renderRow("upcoming-row", upcomingData.results);
  } catch (error) {
    console.error("Error loading swimlanes:", error);
  }
}

// Function to render a single row
function renderRow(containerId, movies) {
  const container = document.getElementById(containerId);
  container.innerHTML = ""; // Clear loading spinner

  movies.forEach((movie) => {
    if (!movie.poster_path) return;

    // Reuse createMovieCard logic (refactoring displayMovies to be reusable would be ideal, but for now copying structure for speed and adding row-specific class)
    const posterPath = `https://image.tmdb.org/t/p/w500${movie.poster_path}`;
    const card = document.createElement("div");
    card.className = "movie-card";
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
    card.addEventListener("click", () => showDetail(movie.id));

    container.appendChild(card);
  });
}

// Add scroll to top functionality
function addScrollToTop() {
  const scrollBtn = document.createElement("div");
  scrollBtn.className = "scroll-top";
  scrollBtn.innerHTML = '<i class="fas fa-arrow-up"></i>';
  document.body.appendChild(scrollBtn);

  window.addEventListener("scroll", () => {
    if (window.pageYOffset > 500) {
      scrollBtn.classList.add("visible");
    } else {
      scrollBtn.classList.remove("visible");
    }
  });

  scrollBtn.addEventListener("click", () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  });
}

// Smooth loading animation
function showLoadingState() {
  const container = document.getElementById("movieContainer");
  container.innerHTML = `
        <div class="loading-state">
            <div class="spinner"></div>
            <p>Loading amazing movies...</p>
        </div>
    `;
}

// Tambahkan event listener untuk clear button
document.addEventListener("DOMContentLoaded", () => {
  const clearButtons = document.querySelectorAll(".clear-search");

  clearButtons.forEach((button) => {
    button.addEventListener("click", (e) => {
      const searchInput = e.target
        .closest(".search-container")
        .querySelector(".search-input");
      searchInput.value = "";
      searchInput.focus();
      loadMovies(1); // Reset ke tampilan awal
      document.querySelector(".pagination").style.display = "flex";
    });
  });
});

// Update copyright year
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("copyright-year").textContent =
    new Date().getFullYear();
});

// ==========================================
// HOME PAGE LOGIC (SWIMLANES)
// ==========================================

async function loadSwimlanes() {
  const homeContent = document.getElementById("home-content");
  if (!homeContent) return;

  // Show loading state for home
  homeContent.innerHTML =
    '<div class="section-loading"><div class="spinner"></div></div>';

  try {
    const [trending, topRated, action, horror] = await Promise.all([
      fetch(`${API_URL}/trending`).then((r) => r.json()),
      fetch(`${API_URL}/top-rated`).then((r) => r.json()),
      fetch(`${API_URL}/category/28`).then((r) => r.json()), // Action
      fetch(`${API_URL}/category/27`).then((r) => r.json()), // Horror
    ]);

    homeContent.innerHTML = ""; // Clear loading

    createSwimlane("Trending Now", trending.results);
    createSwimlane("Top Rated Movies", topRated.results);
    createSwimlane("Action Hits", action.results);
    createSwimlane("Horror Night", horror.results);

    window.swimlanesLoaded = true;
  } catch (error) {
    console.error("Error loading home swimlanes:", error);
    homeContent.innerHTML =
      '<div class="error-message">Failed to load content. Please refresh.</div>';
  }
}

function createSwimlane(title, movies) {
  const homeContent = document.getElementById("home-content");

  const rowSection = document.createElement("section");
  rowSection.className = "movie-row-section";

  // Header
  const header = document.createElement("div");
  header.className = "row-header";
  header.innerHTML = `
        <h3 class="row-title">${title}</h3>
        <div class="swimlane-controls">
            <button class="scroll-btn prev"><i class="fas fa-chevron-left"></i></button>
            <button class="scroll-btn next"><i class="fas fa-chevron-right"></i></button>
        </div>
    `;

  // Row Container (Scrollable)
  const rowContainer = document.createElement("div");
  rowContainer.className = "row-container";

  // Cards
  movies.forEach((movie) => {
    if (!movie.poster_path) return;

    const card = document.createElement("div");
    card.className = "movie-card"; // Reuse existing card styles
    card.innerHTML = createMovieCardHTML(movie);

    // Add listeners (Reuse existing logic or simplified for Home)
    addCardListeners(card, movie);

    rowContainer.appendChild(card);
  });

  rowSection.appendChild(header);
  rowSection.appendChild(rowContainer);
  homeContent.appendChild(rowSection);

  // Add scroll functionality
  const prevBtn = header.querySelector(".prev");
  const nextBtn = header.querySelector(".next");

  prevBtn.addEventListener("click", () => {
    rowContainer.scrollBy({
      left: -window.innerWidth / 1.5,
      behavior: "smooth",
    });
  });

  nextBtn.addEventListener("click", () => {
    rowContainer.scrollBy({
      left: window.innerWidth / 1.5,
      behavior: "smooth",
    });
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
            ${genreName ? `<span class="movie-category-badge">${genreName}</span>` : ""}
            <div class="movie-rating-badge">
                <div class="rating-value"><i class="fas fa-star"></i> ${movie.vote_average?.toFixed(1) || "N/A"}</div>
                <div class="year-value">${movie.release_date?.slice(0, 4) || "N/A"}</div>
            </div>
            <div class="movie-overlay">
                <h3 class="movie-title">${movie.title}</h3>
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
  const watchBtn = card.querySelector(".watch-btn");
  const trailerBtn = card.querySelector(".trailer-btn");
  const detailsBtn = card.querySelector(".details-btn");

  watchBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    showStream(movie.id);
  });

  trailerBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    showTrailer(movie.id);
  });

  detailsBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    showDetail(movie.id);
  });
}

// ============================================
// PERFORMANCE OPTIMIZATION - Connection Warming
// ============================================
function addResourceHints() {
  const domains = [
    "https://multiembed.mov",
    "https://vidlink.pro",
    "https://vidsrc.vip",
    "https://player.smashy.stream",
    "https://vidsrc.cc",
    "https://vidsrc.to",
    "https://www.2embed.cc",
  ];

  const frag = document.createDocumentFragment();

  domains.forEach((domain) => {
    // DNS Prefetch (Early lookup)
    const dns = document.createElement("link");
    dns.rel = "dns-prefetch";
    dns.href = domain;
    frag.appendChild(dns);

    // Preconnect (Handshake: DNS + TCP + TLS)
    const preconnect = document.createElement("link");
    preconnect.rel = "preconnect";
    preconnect.href = domain;
    preconnect.crossOrigin = "anonymous";
    frag.appendChild(preconnect);
  });

  document.head.appendChild(frag);
  console.log("🚀 Stream Connections Warmed Up");
}

// ============================================
// SERIES SIDEBAR LOGIC
// ============================================

let seriesSidebarLoaded = false;

async function loadSeriesSidebar() {
  if (seriesSidebarLoaded) return;

  const sidebarContainer = document.getElementById("seriesSidebarContainer");
  if (!sidebarContainer) return;

  try {
    const response = await fetch(`${API_URL}/series/getTrendingSeries`); // Correct endpoint check needed
    // API_URL is usually localhost:5001/api or empty string if on same origin?
    // Let's assume relative path since frontend is served by backend
    // Or check API_URL definition. defaults to '' in main.js usually?
    // Let's use relative path '/api/series/trending' to be safe
    // adjusting fetch url below
    const res = await fetch("/api/series/trending");

    if (!res.ok) throw new Error("Failed to fetch series");

    const data = await res.json();
    const series = data.results; // Show all available results (usually 20)

    sidebarContainer.innerHTML = series
      .map(
        (item) => `
            <div class="sidebar-item" onclick="showSeriesDetail(${item.id})">
                <img src="${item.poster_path ? "https://image.tmdb.org/t/p/w200" + item.poster_path : "https://via.placeholder.com/60x90"}" 
                     class="sidebar-poster" 
                     alt="${item.name}">
                <div class="sidebar-info">
                    <h4 class="sidebar-title">${item.name}</h4>
                    <div class="sidebar-meta">
                        <span class="sidebar-rating">
                            <i class="fas fa-star"></i> ${item.vote_average.toFixed(1)}
                        </span>
                        <span>${item.first_air_date ? item.first_air_date.substring(0, 4) : "N/A"}</span>
                    </div>
                </div>
            </div>
        `,
      )
      .join("");

    seriesSidebarLoaded = true;
  } catch (error) {
    console.error("Error loading sidebar series:", error);
    sidebarContainer.innerHTML =
      '<div class="error-msg">Failed to load recommendations</div>';
  }
}

function showSeriesDetail(seriesId) {
  showTVDetail(seriesId);
}

async function showTVDetail(seriesId) {
  try {
    const modal = document.querySelector(".detail-modal");
    const detailContent = modal.querySelector(".detail-content");
    // Show spinner inside modal part
    // We might want to clear previous content or show skeleton

    modal.classList.add("active");
    document.body.style.overflow = "hidden";

    const response = await fetch(`${API_BASE_URL}/series/${seriesId}`);
    if (!response.ok) throw new Error("Network response was not ok");
    const data = await response.json();

    // Check if watch providers function exists, otherwise skip
    let watchProvidersHTML = "";
    if (typeof showWatchProviders === "function") {
      watchProvidersHTML = await showWatchProviders(
        data["watch/providers"] || {},
      );
    }

    detailContent.innerHTML = `
            <div class="detail-header" style="background-image: url(${data.backdrop_path ? "https://image.tmdb.org/t/p/original" + data.backdrop_path : ""})"></div>
            <i class="fas fa-times close-btn"></i>
            <div class="detail-body">
                <img src="${data.poster_path ? "https://image.tmdb.org/t/p/w500" + data.poster_path : ""}" class="detail-poster" alt="Poster">
                <div class="detail-info">
                    <h1 class="detail-title">${data.name}</h1>
                    <div class="detail-meta">
                        <span class="rating"><i class="fas fa-star"></i> ${data.vote_average.toFixed(1)}</span>
                        <span class="year"><i class="far fa-calendar-alt"></i> ${data.first_air_date ? data.first_air_date.substring(0, 4) : "N/A"}</span>
                        <span class="runtime"><i class="fas fa-tv"></i> ${data.number_of_seasons} Seasons</span>
                    </div>
                    <div class="detail-genres">
                        ${data.genres.map((g) => `<span class="genre-tag">${g.name}</span>`).join("")}
                    </div>
                    <p class="detail-overview">${data.overview}</p>
                    
                    <div class="watch-providers">
                        <h3>Where to Watch</h3>
                        ${watchProvidersHTML}
                    </div>

                    <div class="movie-actions detail-actions">
                         <button class="movie-btn watch-btn primary-btn" onclick="showSeriesStream(${data.id})">
                            <i class="fas fa-play"></i> Watch Series
                        </button>
                        <button class="movie-btn trailer-btn" onclick="showSeriesTrailer(${data.id})">
                            <i class="fas fa-play"></i> Trailer
                        </button>
                    </div>
                </div>
            </div>
        `;

    modal.querySelector(".close-btn").onclick = () => {
      modal.classList.remove("active");
      document.body.style.overflow = "";
    };
  } catch (error) {
    console.error("Error showing TV detail:", error);
  }
}

// ============================================
// SERIES PAGE LOGIC
// ============================================

let currentContentType = "movie"; // 'movie' or 'series'

async function loadAllSeries(page = 1) {
  if (isLoading) return;
  isLoading = true;

  // Show spinner if first load
  const movieGrid = document.getElementById("movieContainer");
  if (page === 1) {
    movieGrid.innerHTML = '<div class="spinner"></div>';
    loadedMovies.clear();
  }

  try {
    const response = await fetch(`${API_BASE_URL}/series/popular?page=${page}`);
    if (!response.ok) throw new Error("Failed to fetch series");

    const data = await response.json();

    // Always clear grid for standard pagination (Replace behavior)
    movieGrid.innerHTML = "";
    loadedMovies.clear();

    displaySeriesList(data.results);

    currentPage = page;
    totalPages = data.total_pages || 500; // Fallback or use API data
    currentContentType = "series";
    updatePagination(currentPage); // Crucial: Re-render pagination buttons
  } catch (error) {
    console.error("Error loading series:", error);
    if (page === 1)
      movieGrid.innerHTML =
        '<p class="error-msg">Error loading series. Please try again.</p>';
  } finally {
    isLoading = false;
  }
}

function displaySeriesList(seriesList) {
  const movieGrid = document.getElementById("movieContainer");

  if (!seriesList || seriesList.length === 0) {
    if (movieGrid.children.length === 0) {
      movieGrid.innerHTML = '<p class="error-msg">No series found.</p>';
    }
    return;
  }

  seriesList.forEach((series) => {
    // Use loadedMovies Set to prevent duplicates if needed (optional for search but good for pagination)
    // For search results, we often just want to show them, but maintaining the Set is fine.
    // Actually for search, we usually replace content.
    // Here we just append.

    const card = createSeriesCard(series);
    movieGrid.appendChild(card);
    // Note: We might not want to add to loadedMovies for search results to avoid interfering with pagination
    // but for now keeping it simple.
  });
}

function createSeriesCard(series) {
  const card = document.createElement("div");
  card.className = "movie-card";
  const posterPath = series.poster_path
    ? `https://image.tmdb.org/t/p/w500${series.poster_path}`
    : "https://via.placeholder.com/500x750?text=No+Poster";

  card.innerHTML = `
        <div class="movie-poster-container">
            <img 
                src="${posterPath}" 
                class="movie-poster" 
                alt="${series.name}"
                loading="lazy"
                decoding="async"
            >
            <div class="movie-rating-badge">
                <div class="rating-value"><i class="fas fa-star"></i> ${series.vote_average?.toFixed(1) || "N/A"}</div>
                <div class="year-value">${series.first_air_date?.slice(0, 4) || "N/A"}</div>
            </div>
            <div class="movie-overlay">
                <h3 class="movie-title">${series.name}</h3>
                <div class="movie-actions">
                    <button class="movie-btn watch-btn" title="Watch Series">
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

  // Add event listeners (matching movie card behavior)
  const watchBtn = card.querySelector(".watch-btn");
  const trailerBtn = card.querySelector(".trailer-btn");
  const detailsBtn = card.querySelector(".details-btn");

  watchBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    showSeriesStream(series.id);
  });

  trailerBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    showSeriesTrailer(series.id);
  });

  detailsBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    showSeriesDetail(series.id);
  });

  // Add click event for entire card
  card.addEventListener("click", () => showSeriesDetail(series.id));

  return card;
}

// Function to show Series Trailer
async function showSeriesTrailer(seriesId) {
  try {
    // Create modal if it doesn't exist (reusing trailer-modal class)
    let modal = document.querySelector(".trailer-modal");
    if (!modal) {
      modal = document.createElement("div");
      modal.className = "trailer-modal";
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

    const videoContainer = modal.querySelector(".video-container");
    modal.classList.add("active");

    // Show loading spinner
    videoContainer.innerHTML = `
            <div class="trailer-loading">
                <div class="spinner"></div>
                <p>Loading trailer...</p>
            </div>
        `;

    // Fetch trailer from Series API
    const response = await fetch(`${API_BASE_URL}/series/${seriesId}/videos`);
    const data = await response.json();

    // Find official trailer
    const trailer =
      data.results.find(
        (video) =>
          video.type === "Trailer" && video.site.toLowerCase() === "youtube",
      ) || data.results.find((video) => video.site.toLowerCase() === "youtube");

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
      const closeBtn = modal.querySelector(".close-btn");
      const closeModal = () => {
        modal.classList.remove("active");
        videoContainer.innerHTML = "";
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
        if (e.key === "Escape") {
          closeModal();
          document.removeEventListener("keydown", escHandler);
        }
      };
      document.addEventListener("keydown", escHandler);
    } else {
      modal.classList.remove("active");
      showError("No trailer available for this series");
    }
  } catch (error) {
    console.error("Error fetching series trailer:", error);
    document.querySelector(".trailer-modal").classList.remove("active");
    showError("Failed to load trailer. Please try again.");
  }
}

// ============================================
// SERIES STREAMING LOGIC
// ============================================

const SERIES_SERVERS = [
  // ===== SERVER 1: REBAHIN21 (DEFAULT - Indonesian Content) =====
  {
    name: "Server 1 (Default)",
    url: null, // Dynamic URL - fetched via API
    hasAds: false,
    quality: "best",
    sandboxCompatible: false,
    isRebahin: true, // Flag untuk handling khusus
  },
  // ===== SERVER 2-4: NO POPUPS =====
  {
    name: "Server 2",
    url: (id, s, e) => `https://vidsrc.vip/embed/tv/${id}/${s}/${e}`,
    hasAds: false,
    quality: "best",
    sandboxCompatible: false,
  },
  {
    name: "Server 3",
    url: (id, s, e) => `https://player.autoembed.cc/embed/tv/${id}/${s}/${e}`,
    hasAds: false,
    sandboxCompatible: false,
  },
  {
    name: "Server 4",
    url: (id, s, e) => `${API_BASE_URL}/embed?url=${encodeURIComponent(`https://vidsrc.cc/v2/embed/tv/${id}/${s}/${e}`)}&ns=1`,
    hasAds: false,
    proxied: true,
    noSandbox: true,
  },
  {
    name: "Server 5",
    url: (id, s, e) => `https://embed.su/embed/tv/${id}/${s}/${e}`,
    hasAds: false,
    sandboxCompatible: true,
  },
  // ===== SERVER 6-7: PROXIED =====
  {
    name: "Server 6",
    url: (id, s, e) => `${API_BASE_URL}/embed?url=${encodeURIComponent(`https://vidsrc.to/embed/tv/${id}/${s}/${e}`)}`,
    hasAds: false,
    proxied: true,
  },
  {
    name: "Server 7",
    url: (id, s, e) => `${API_BASE_URL}/embed?url=${encodeURIComponent(`https://player.smashy.stream/tv/${id}/${s}/${e}`)}`,
    hasAds: false,
    proxied: true,
  },
];

let currentSeriesId = null;
let currentSeason = 1;
let currentEpisode = 1;
let currentSeriesServerIndex = 0; // Index based now

async function showSeriesStream(seriesId) {
  try {
    currentSeriesId = seriesId;
    const modal = document.querySelector(".detail-modal");
    const detailContent = modal.querySelector(".detail-content");
    detailContent.innerHTML = '<div class="spinner"></div>';
    modal.classList.add("active");
    document.body.style.overflow = "hidden";

    // Fetch Series Details
    const response = await fetch(`${API_BASE_URL}/series/${seriesId}`);
    if (!response.ok) throw new Error("Failed to fetch series details");
    const series = await response.json();

    if (!series.seasons || series.seasons.length === 0) {
      detailContent.innerHTML =
        '<p class="error-msg">No seasons found for this series.</p>';
      return;
    }

    detailContent.innerHTML = `
            <div class="series-player-container">
                <div class="stream-header">
                    <!-- Top Row: Title & Window Controls -->
                    <div class="stream-app-bar">
                        <div class="stream-title-group">
                            <h2 class="stream-title">${series.name}</h2>
                            <span id="current-episode-info" style="background: #e50914; color: white; padding: 2px 8px; border-radius: 4px; font-weight: bold; font-size: 0.8rem; margin-left: 10px;">S1:E1</span>
                        </div>
                        <div class="stream-controls">
                            <button class="fullscreen-btn" id="series-fullscreen-btn" title="Fullscreen">
                                <i class="fas fa-expand"></i>
                            </button>
                            <button class="close-stream-btn" title="Close">
                                <i class="fas fa-times"></i>
                            </button>
                        </div>
                    </div>
                </div>
                
                <div class="player-wrapper">
                    <!-- 🛡️ Sandbox is applied DYNAMICALLY based on server compatibility -->
                    <iframe id="series-iframe" 
                        src="" 
                        allowfullscreen 
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
                    ></iframe>
                </div>

                <div class="series-controls-container">
                    <div class="sc-group">
                        <label><i class="fas fa-server"></i> Server</label>
                        <select id="server-select" class="modern-select">
                            ${SERIES_SERVERS.map(
                              (server, index) =>
                                `<option value="${index}">${server.name}</option>`,
                            ).join("")}
                        </select>
                    </div>
                    <div class="sc-group">
                        <label><i class="fas fa-list-ol"></i> Season</label>
                        <select id="season-select" class="modern-select">
                            ${series.seasons
                              .map(
                                (s) =>
                                  `<option value="${s.season_number}">Season ${s.season_number}</option>`,
                              )
                              .join("")}
                        </select>
                    </div>
                </div>

                <div class="episodes-section">
                    <h3>Episodes</h3>
                    <div id="episodes-grid" class="episodes-grid custom-scrollbar">
                        <div class="spinner"></div>
                    </div>
                </div>
            </div>
        `;

    // 🛡️ ACTIVATE POPUP BLOCKER
    PopupBlocker.init();

    // Close button logic
    const closeBtn = detailContent.querySelector(".close-stream-btn");
    closeBtn.onclick = () => {
      // 🛡️ DEACTIVATE POPUP BLOCKER
      PopupBlocker.destroy();
      
      modal.classList.remove("active");
      document.body.style.overflow = "";
      // Clear iframe
      const iframe = document.getElementById("series-iframe");
      if (iframe) iframe.src = "";
    };

    // Fullscreen logic
    const fullscreenBtn = document.getElementById('series-fullscreen-btn');
    const playerWrapper = modal.querySelector('.player-wrapper');
    
    fullscreenBtn.onclick = () => {
        if (!document.fullscreenElement) {
            playerWrapper.requestFullscreen().catch(err => {
                console.error(`Error attempting to enable fullscreen: ${err.message}`);
            });
            fullscreenBtn.innerHTML = '<i class="fas fa-compress"></i>';
        } else {
            document.exitFullscreen();
            fullscreenBtn.innerHTML = '<i class="fas fa-expand"></i>';
        }
    };

    document.addEventListener('fullscreenchange', () => {
        if (!document.fullscreenElement) {
            fullscreenBtn.innerHTML = '<i class="fas fa-expand"></i>';
        }
    });

    // Event Listeners
    const seasonSelect = document.getElementById("season-select");
    const serverSelect = document.getElementById("server-select");

    seasonSelect.addEventListener("change", (e) => {
      loadSeasonEpisodes(seriesId, e.target.value);
    });

    serverSelect.addEventListener("change", (e) => {
      currentSeriesServerIndex = parseInt(e.target.value);
      updateSeriesVideoSource();
    });

    // Initialize: Load Season 1 (or first available)
    const firstSeason =
      series.seasons.find((s) => s.season_number > 0) || series.seasons[0];
    if (firstSeason) {
      seasonSelect.value = firstSeason.season_number;
      loadSeasonEpisodes(seriesId, firstSeason.season_number);
    }
  } catch (error) {
    console.error("Error opening series player:", error);
    alert("Failed to open player");
    document.body.style.overflow = "";
  }
}

async function loadSeasonEpisodes(seriesId, seasonNum) {
  const grid = document.getElementById("episodes-grid");
  grid.innerHTML = '<div class="spinner"></div>';
  currentSeason = seasonNum;

  try {
    const url = `${API_BASE_URL}/series/${seriesId}/season/${seasonNum}`;
    console.log("Fetching Episodes URL:", url); // Debug
    const response = await fetch(url);
    if (!response.ok) throw new Error("Failed to fetch episodes");
    const data = await response.json();

    const episodes = data.episodes;
    grid.innerHTML = "";

    if (!episodes || episodes.length === 0) {
      grid.innerHTML = "<p>No episodes found.</p>";
      return;
    }

    episodes.forEach((ep) => {
      const btn = document.createElement("div");
      btn.className = `episode-btn ${ep.episode_number === 1 ? "active" : ""}`; // Default active first
      btn.innerHTML = `
                <span class="episode-number">${ep.episode_number}</span>
                <span class="episode-name">${ep.name}</span>
            `;
      btn.onclick = () => {
        // Remove active class from all
        document
          .querySelectorAll(".episode-btn")
          .forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");

        playEpisode(ep.episode_number);
      };
      grid.appendChild(btn);
    });

    // Auto play first episode of loaded season
    playEpisode(1);
  } catch (error) {
    console.error("Error loading episodes:", error);
    grid.innerHTML = '<p class="error-msg">Failed to load episodes.</p>';
  }
}

function playEpisode(episodeNum) {
  currentEpisode = episodeNum;

  // Update Info Text
  const infoSpan = document.getElementById("current-episode-info");
  if (infoSpan) infoSpan.textContent = `S${currentSeason}:E${currentEpisode}`;

  updateSeriesVideoSource();
}

async function updateSeriesVideoSource() {
  const iframe = document.getElementById("series-iframe");
  if (!iframe) return;

  const serverConfig = SERIES_SERVERS[currentSeriesServerIndex];
  if (!serverConfig) return;
  
  // Handle Primary server (Server 1)
  if (serverConfig.isRebahin) {
    try {
      // Pass title to ensure backend finds the correct show
      const seriesTitle = document.querySelector('.stream-title')?.textContent || '';
      console.log('[StreamEngine] Fetching series source...');
      
      // Add loading indicator
      const playerWrapper = document.querySelector('.player-wrapper');
      if (playerWrapper) {
        const loadingDiv = document.createElement('div');
        loadingDiv.className = 'stream-loading';
        loadingDiv.id = 'server-loading';
        loadingDiv.innerHTML = '<div class="spinner"></div><p>Loading...</p>';
        playerWrapper.appendChild(loadingDiv);
      }
      
      const response = await fetch(`${API_BASE_URL}/rebahin/series/${currentSeriesId}/${currentSeason}/${currentEpisode}?title=${encodeURIComponent(seriesTitle)}`);
      const data = await response.json();
      
      // Remove loading
      const loadingEl = document.getElementById('server-loading');
      if (loadingEl) loadingEl.remove();
      
      if (data.success && data.playerUrl) {
        console.log('[StreamEngine] Source found.');
        
        // Route through embed proxy for ad blocking
        const proxiedUrl = `${API_BASE_URL}/embed?url=${encodeURIComponent(data.playerUrl)}`;
        
        iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms allow-presentation');
        iframe.src = proxiedUrl;
        return;
      } else {
        console.log('[StreamEngine] Source not found, auto-switching...');
        // Auto-fallback to next server
        currentSeriesServerIndex = 1;
        document.getElementById('server-select').value = '1';
        updateSeriesVideoSource();
        return;
      }
    } catch (error) {
      console.error('[StreamEngine] Error:', error);
      // Remove loading on error
      const loadingEl = document.getElementById('server-loading');
      if (loadingEl) loadingEl.remove();
      // Auto-fallback
      currentSeriesServerIndex = 1;
      document.getElementById('server-select').value = '1';
      updateSeriesVideoSource();
      return;
    }
  }
  
  // Standard server handling
  // Dynamically apply or remove sandbox based on server compatibility
  if (serverConfig.sandboxCompatible !== false) {
    iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms allow-presentation');
  } else {
    iframe.removeAttribute('sandbox');
  }
  
  let finalUrl = serverConfig.url(
    currentSeriesId,
    currentSeason,
    currentEpisode,
  );

  // AutoEmbed Subtitle Fix for Series (Server 3)
  if (serverConfig.name.includes("Server 3")) {
      const separator = finalUrl.includes('?') ? '&' : '?';
      finalUrl += `${separator}caption=Indonesian&sub=id`;
  }

  iframe.src = finalUrl;
}

// ==========================================
// AI BRAIN & HISTORY MANAGER
// ==========================================
const FlashBrain = {
  isAIMode: false,
  
  init() {
    console.log("FlashBrain initialized");
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
        searchInput.placeholder = "Ketik mood kamu...";
        searchInput.style.borderColor = '#a78bfa';
        searchInput.focus();
        this.showToast("Mode AI Aktif! Ketik mood & tekan Enter.");
      } else {
        aiBtn.classList.remove('active');
        searchInput.placeholder = 'Search movies...';
        searchInput.style.borderColor = 'rgba(255, 255, 255, 0.1)';
        if(searchIcon) searchIcon.className = 'fas fa-search search-icon';
      }
    });

    searchInput.addEventListener('keypress', async (e) => {
        if (e.key === 'Enter' && this.isAIMode && searchInput.value.trim().length > 2) {
            e.preventDefault();
            e.stopPropagation();
            await this.askAI(searchInput.value.trim());
        }
    });
  },

  showToast(msg) {
      const toast = document.createElement('div');
      toast.className = 'popup-blocked-toast show';
      toast.innerHTML = '<i class="fas fa-robot"></i> <span>' + msg + '</span>';
      toast.style.borderLeftColor = '#8b5cf6';
      document.body.appendChild(toast);
      setTimeout(() => toast.remove(), 4000);
  },

  async askAI(query) {
    const container = document.getElementById('movieContainer');
    if (!container) return;
    
    container.innerHTML = '<div class="loader-spinner"></div>';
    
    // Switch view logic
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    document.querySelector('.nav-link[data-page="movies"]')?.classList.add('active');
    document.getElementById('home-content').style.display = 'none';
    document.getElementById('movies-page-content').style.display = 'block';
    
    const titleEl = document.querySelector('.section-title');
    if(titleEl) titleEl.textContent = 'AI Results: ' + query;
    
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
      
      if (!recs || recs.length === 0) {
         container.innerHTML = '<div class="error-msg">No matches found.</div>'; 
         return;
      }
      
      container.innerHTML = '';
      
      for (const rec of recs) {
          // Fetch poster
          const tmdbRes = await fetch(API_BASE_URL + '/movies/search?query=' + encodeURIComponent(rec.title));
          const tmdbData = await tmdbRes.json();
          let movie = tmdbData.results && tmdbData.results[0];
          
          if (movie) {
              // Create card manually (since createMovieCard is not defined global)
              const card = document.createElement("div");
              card.className = "movie-card";
            
              const posterPath = movie.poster_path 
                ? `https://image.tmdb.org/t/p/w500${movie.poster_path}`
                : "https://via.placeholder.com/500x750?text=No+Poster";
                
              const rating = movie.vote_average ? movie.vote_average.toFixed(1) : "N/A";
              const year = movie.release_date ? movie.release_date.slice(0, 4) : "N/A";
            
              card.innerHTML = `
                <div class="movie-poster-container">
                    <img src="${posterPath}" class="movie-poster" alt="${movie.title}" loading="lazy">
                    <div class="movie-rating-badge">
                        <div class="rating-value"><i class="fas fa-star"></i> ${rating}</div>
                        <div class="year-value">${year}</div>
                    </div>
                    <div class="movie-overlay">
                        <h3 class="movie-title">${movie.title}</h3>
                        <p style="font-size:0.8rem; color:#ddd; margin-bottom:10px; line-height:1.4;">${rec.reason}</p>
                        <div class="movie-actions">
                            <button class="movie-btn watch-btn" onclick="showStream(${movie.id})">
                                <i class="fas fa-tv"></i> Watch
                            </button>
                            <button class="movie-btn trailer-btn" onclick="showTrailer(${movie.id})">
                                <i class="fas fa-play"></i>
                            </button>
                        </div>
                    </div>
                </div>`;
               container.appendChild(card);
          } else {
              // Fallback
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
      try {
          let hist = JSON.parse(localStorage.getItem('flash_history') || '[]');
          hist = hist.filter(h => h.id != id);
          hist.unshift({ id, title, date: Date.now() });
          if (hist.length > 10) hist.pop();
          localStorage.setItem('flash_history', JSON.stringify(hist));
          console.log('Saved to history:', title);
      } catch(e) {
          console.warn('History save failed');
      }
  }
};

// Auto Init
setTimeout(() => { 
    if(typeof FlashBrain !== 'undefined') FlashBrain.init(); 
}, 1000); 
// End of file

