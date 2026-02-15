"use strict";
class TuberApp {
    constructor() {
        this.state = {
            query: '',
            results: [],
            current: null,
            loading: false,
            error: null,
            toast: null
        };
        this.appElement = document.getElementById('app');
        this.init();
    }
    init() {
        this.render();
        // Add loaded class after initial render to prevent FOUC
        setTimeout(() => {
            this.appElement.classList.add('loaded');
        }, 50);
        this.setupEventListeners();
    }
    setupEventListeners() {
        // Will be implemented when components are created
    }
    render() {
        this.appElement.innerHTML = `
      <div class="app-container">
        <!-- Animated background elements -->
        <div class="bg-elements">
          <div class="bg-circle bg-circle-1"></div>
          <div class="bg-circle bg-circle-2"></div>
          <div class="bg-circle bg-circle-3"></div>
        </div>

        <main class="main-content">
          <div class="hero-section">
            <!-- Enhanced header with animation -->
            <div class="logo-section">
              <div class="logo">
                <span class="logo-text">T</span>
              </div>
              <h1 class="title">Tuber</h1>
              <p class="subtitle">Privacy-first YouTube frontend</p>
              <p class="tagline">Built with pure TypeScript • No frameworks • Maximum performance</p>
            </div>

            <div class="search-section">
              <form class="search-form">
                <div class="search-input-container">
                  <input
                    type="text"
                    placeholder="Search videos, channels, or paste YouTube URL..."
                    class="search-input"
                    aria-label="Search"
                  />
                  <div class="search-icon">
                    <svg class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
                    </svg>
                  </div>
                </div>
                <button type="submit" class="search-button">
                  <span class="button-content">
                    Search
                    <svg class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6"></path>
                    </svg>
                  </span>
                </button>
              </form>

              <!-- Loading state -->
              ${this.renderLoading()}

              <!-- Error state -->
              ${this.renderError()}

              <!-- Results -->
              ${this.renderResults()}

              <!-- Footer -->
              <footer class="footer">
                <p>🔒 Your privacy matters • Built with ❤️ using pure TypeScript</p>
              </footer>
            </div>
          </div>
        </main>
      </div>
    `;
        // Add event listeners after rendering
        this.attachEventListeners();
    }
    renderLoading() {
        if (!this.state.loading)
            return '';
        return `
      <div class="loading-container">
        <div class="loading-spinner">
          <div class="spinner-ring"></div>
          <div class="spinner-ring spinner-ring-delay"></div>
        </div>
        <h3 class="loading-title">Searching YouTube...</h3>
        <p class="loading-subtitle">Quantum algorithms analyzing the multiverse</p>
      </div>
    `;
    }
    renderError() {
        if (!this.state.error)
            return '';
        return `
      <div class="error-container">
        <div class="error-icon">
          <svg class="error-svg" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"></path>
          </svg>
        </div>
        <h3 class="error-title">Search Error</h3>
        <p class="error-message">${this.state.error}</p>
      </div>
    `;
    }
    renderResults() {
        if (this.state.results.length === 0)
            return '';
        return `
      <div class="results-section">
        <h2 class="results-title">Search Results</h2>
        <div class="results-grid">
          ${this.state.results.map((result, index) => `
            <div class="result-card" style="animation-delay: ${index * 100}ms">
              <div class="result-image-container">
                <img src="${result.thumbnail}" alt="${result.title}" class="result-image">
                <div class="result-overlay"></div>
                <div class="result-duration">${result.duration}</div>
              </div>
              <div class="result-content">
                <h3 class="result-title-text">${result.title}</h3>
                <p class="result-channel">${result.channel}</p>
                <a href="${result.url}" target="_blank" class="result-link">
                  Watch Video
                  <svg class="result-link-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path>
                  </svg>
                </a>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
    }
    attachEventListeners() {
        const searchForm = this.appElement.querySelector('.search-form');
        const searchInput = this.appElement.querySelector('.search-input');
        if (searchForm && searchInput) {
            searchForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleSearch(searchInput.value);
            });
            searchInput.addEventListener('input', (e) => {
                this.state.query = e.target.value;
            });
            searchInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    this.handleSearch(searchInput.value);
                }
            });
        }
    }
    async handleSearch(query) {
        if (!query.trim())
            return;
        this.state.loading = true;
        this.state.error = null;
        this.render();
        try {
            const response = await fetch(`http://localhost:4001/api/search?q=${encodeURIComponent(query)}`);
            if (!response.ok) {
                throw new Error('Search failed');
            }
            const data = await response.json();
            // Handle different API response formats
            let results = [];
            if (Array.isArray(data)) {
                results = data;
            }
            else if (data.feed && Array.isArray(data.feed.entry)) {
                results = data.feed.entry;
            }
            else if (data.results && Array.isArray(data.results)) {
                results = data.results;
            }
            else {
                console.warn('Unexpected API response format:', data);
                results = [];
            }
            this.state.results = results.map((item) => ({
                id: item.videoId || item.id || item['yt:videoId'] || Math.random().toString(),
                title: item.title || item['media:title'] || 'Unknown Title',
                channel: item.author?.name || item.channelTitle || item['yt:channelTitle'] || 'Unknown Channel',
                thumbnail: item.thumbnail || item.thumbnails?.[0]?.url || item['media:thumbnail']?.['@url'] || 'https://via.placeholder.com/320x180/9333ea/ffffff?text=Video',
                duration: item.duration || item.lengthSeconds ? this.formatDuration(item.lengthSeconds) : item['media:content']?.['@duration'] ? this.formatDuration(parseInt(item['media:content']['@duration'])) : 'Unknown',
                url: item.url || item.link?.[0]?.['@href'] || `https://youtube.com/watch?v=${item.videoId || item.id || item['yt:videoId']}`
            }));
        }
        catch (error) {
            console.error('Search error:', error);
            this.state.error = 'Search failed. Please try again.';
            // Fallback to mock data for demo
            this.state.results = [
                {
                    id: '1',
                    title: `Search results for "${query}"`,
                    channel: 'Demo Channel',
                    thumbnail: 'https://via.placeholder.com/320x180/9333ea/ffffff?text=Demo',
                    duration: '5:30',
                    url: '#'
                }
            ];
        }
        finally {
            this.state.loading = false;
            this.render();
        }
    }
    formatDuration(seconds) {
        if (!seconds)
            return 'Unknown';
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }
}
// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new TuberApp();
});
