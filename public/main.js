"use strict";
class TuberApp {
    constructor() {
        console.log('TuberApp constructor called');
        this.state = {
            query: '',
            results: [],
            current: null,
            loading: false,
            error: null,
            toast: null,
            subscriptions: this.loadSubscriptions(),
            watchLater: this.loadWatchLater(),
            recommendations: [],
            currentView: 'search',
            showSubscribeModal: false,
            showPrivacyModal: false,
            showTourModal: !localStorage.getItem('tuber-tour-completed'),
            showVideoPlayer: false,
            searchHistory: this.loadSearchHistory()
        };
        this.appElement = document.getElementById('app');
        if (!this.appElement) {
            console.error('App element not found!');
            return;
        }
        console.log('App element found:', this.appElement);
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
        // Navigation tab clicks
        this.appElement.addEventListener('click', (e) => {
            const target = e.target;
            const navTab = target.closest('.nav-tab');
            if (navTab) {
                const view = navTab.dataset.view;
                if (view) {
                    this.switchView(view);
                }
            }
        });
        // Search form submission
        this.appElement.addEventListener('submit', (e) => {
            const form = e.target;
            if (form.classList.contains('search-form')) {
                e.preventDefault();
                const input = form.querySelector('.search-input');
                if (input) {
                    this.handleSearch(input.value);
                }
            }
        });
        // Search input changes
        this.appElement.addEventListener('input', (e) => {
            const target = e.target;
            if (target.classList.contains('search-input')) {
                this.state.query = target.value;
            }
        });
        // Action button clicks (subscribe, watch later, etc.)
        this.appElement.addEventListener('click', (e) => {
            const target = e.target;
            const actionBtn = target.closest('.action-btn');
            if (actionBtn) {
                e.preventDefault();
                const action = actionBtn.dataset.action;
                const videoId = actionBtn.dataset.videoId;
                const channelId = actionBtn.dataset.channelId;
                if (action && videoId) {
                    this.handleAction(action, videoId, channelId);
                }
            }
        });
        // History tag clicks
        this.appElement.addEventListener('click', (e) => {
            const target = e.target;
            if (target.classList.contains('history-tag')) {
                const query = target.textContent?.trim();
                if (query) {
                    this.handleSearch(query);
                }
            }
        });
        // Modal close buttons
        this.appElement.addEventListener('click', (e) => {
            const target = e.target;
            if (target.classList.contains('modal-close') || target.classList.contains('modal-overlay')) {
                this.closeModal();
            }
        });
    }
    // Storage methods
    loadSubscriptions() {
        try {
            const subs = localStorage.getItem('tuber-subscriptions');
            return subs ? JSON.parse(subs) : [];
        }
        catch {
            return [];
        }
    }
    saveSubscriptions() {
        localStorage.setItem('tuber-subscriptions', JSON.stringify(this.state.subscriptions));
    }
    loadWatchLater() {
        try {
            const watchLater = localStorage.getItem('tuber-watchlater');
            return watchLater ? JSON.parse(watchLater) : [];
        }
        catch {
            return [];
        }
    }
    saveWatchLater() {
        localStorage.setItem('tuber-watchlater', JSON.stringify(this.state.watchLater));
    }
    loadSearchHistory() {
        try {
            const history = localStorage.getItem('tuber-search-history');
            return history ? JSON.parse(history) : [];
        }
        catch {
            return [];
        }
    }
    saveSearchHistory() {
        localStorage.setItem('tuber-search-history', JSON.stringify(this.state.searchHistory));
    }
    // Subscription methods
    subscribeToChannel(channel) {
        if (!this.state.subscriptions.find(sub => sub.id === channel.id)) {
            this.state.subscriptions.push(channel);
            this.saveSubscriptions();
            this.showToast(`Subscribed to ${channel.title}`);
            this.render();
        }
    }
    unsubscribeFromChannel(channelId) {
        const channel = this.state.subscriptions.find(sub => sub.id === channelId);
        this.state.subscriptions = this.state.subscriptions.filter(sub => sub.id !== channelId);
        this.saveSubscriptions();
        if (channel) {
            this.showToast(`Unsubscribed from ${channel.title}`);
        }
        this.render();
    }
    // Watch later methods
    addToWatchLater(video) {
        if (!this.state.watchLater.find(item => item.id === video.id)) {
            this.state.watchLater.push(video);
            this.saveWatchLater();
            this.showToast(`Added "${video.title}" to Watch Later`);
        }
    }
    removeFromWatchLater(videoId) {
        const video = this.state.watchLater.find(item => item.id === videoId);
        this.state.watchLater = this.state.watchLater.filter(item => item.id !== videoId);
        this.saveWatchLater();
        if (video) {
            this.showToast(`Removed "${video.title}" from Watch Later`);
        }
        this.render();
    }
    // Toast notifications
    showToast(message) {
        this.state.toast = message;
        this.render();
        setTimeout(() => {
            this.state.toast = null;
            this.render();
        }, 3000);
    }
    // View switching
    switchView(view) {
        this.state.currentView = view;
        this.render();
    }
    render() {
        console.log('Render method called');
        this.appElement.innerHTML = `
      <div class="app-container">
        <main class="main-content">
          <div class="hero-section">
            <div class="header-section">
              <div class="logo-section">
                <div class="logo">
                  <span class="logo-text">T</span>
                </div>
                <h1 class="title">Tuber</h1>
                <p class="subtitle">Privacy-first YouTube frontend</p>
              </div>

              <!-- Navigation tabs -->
              <nav class="nav-tabs">
                <button class="nav-tab active" data-view="search">
                  <svg class="nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
                  </svg>
                  Search
                </button>
                <button class="nav-tab" data-view="subscriptions">
                  <svg class="nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path>
                  </svg>
                  Subscriptions (0)
                </button>
                <button class="nav-tab" data-view="watchlater">
                  <svg class="nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                  </svg>
                  Watch Later (0)
                </button>
              </nav>
            </div>

            <div class="search-section">
              <form class="search-form">
                <div class="search-input-container">
                  <input
                    type="text"
                    placeholder="Search videos, channels, or paste YouTube URL..."
                    class="search-input"
                    value=""
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
            </div>

            <!-- Search results -->
            ${this.renderResults()}

            <!-- Loading state -->
            ${this.renderLoading()}

            <!-- Error state -->
            ${this.renderError()}
          </div>
        </main>

        <!-- Toast notifications -->
        ${this.renderToast()}

        <!-- Modals -->
        ${this.renderModals()}
      </div>
    `;
        console.log('HTML set successfully');
        // Add event listeners after rendering
        this.attachEventListeners();
    }
    renderSearchHistory() {
        if (this.state.searchHistory.length === 0)
            return '';
        return `
      <div class="search-history">
        <h3 class="history-title">Recent Searches</h3>
        <div class="history-tags">
          ${this.state.searchHistory.slice(0, 5).map(term => `
            <button class="history-tag" data-search="${term}">${term}</button>
          `).join('')}
        </div>
      </div>
    `;
    }
    renderSubscriptions() {
        if (this.state.subscriptions.length === 0) {
            return `
        <div class="empty-state">
          <div class="empty-icon">
            <svg class="icon-large" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path>
            </svg>
          </div>
          <h3 class="empty-title">No subscriptions yet</h3>
          <p class="empty-description">Search for channels and subscribe to see their latest videos here.</p>
        </div>
      `;
        }
        return `
      <div class="subscriptions-section">
        <h2 class="section-title">Your Subscriptions</h2>
        <div class="subscriptions-grid">
          ${this.state.subscriptions.map(channel => `
            <div class="channel-card" data-channel-id="${channel.id}">
              <div class="channel-avatar">
                <img src="${channel.thumbnail}" alt="${channel.title}" class="channel-image">
              </div>
              <div class="channel-info">
                <h3 class="channel-title">${channel.title}</h3>
                <p class="channel-stats">${channel.subscriberCount || 'N/A'} subscribers</p>
                <div class="channel-actions">
                  <button class="action-btn primary" data-action="view-channel" data-channel-id="${channel.id}">
                    View Channel
                  </button>
                  <button class="action-btn danger" data-action="unsubscribe" data-channel-id="${channel.id}">
                    Unsubscribe
                  </button>
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
    }
    renderWatchLater() {
        if (this.state.watchLater.length === 0) {
            return `
        <div class="empty-state">
          <div class="empty-icon">
            <svg class="icon-large" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
          </div>
          <h3 class="empty-title">No videos saved</h3>
          <p class="empty-description">Save videos to watch later by clicking the clock icon on search results.</p>
        </div>
      `;
        }
        return `
      <div class="watchlater-section">
        <div class="section-header">
          <h2 class="section-title">Watch Later</h2>
          <button class="clear-btn" data-action="clear-watchlater">Clear All</button>
        </div>
        <div class="videos-grid">
          ${this.state.watchLater.map(video => `
            <div class="video-card" data-video-id="${video.id}">
              <div class="video-thumbnail">
                <img src="${video.thumbnail}" alt="${video.title}" class="video-image">
                <div class="video-duration">${video.duration}</div>
                <div class="video-overlay">
                  <button class="play-btn" data-action="play" data-video-id="${video.id}">
                    <svg class="icon" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z"/>
                    </svg>
                  </button>
                </div>
              </div>
              <div class="video-info">
                <h3 class="video-title">${video.title}</h3>
                <p class="video-channel">${video.channel}</p>
                <div class="video-actions">
                  <button class="action-btn primary" data-action="play" data-video-id="${video.id}">Watch Now</button>
                  <button class="action-btn danger" data-action="remove-watchlater" data-video-id="${video.id}">Remove</button>
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
    }
    renderPlayer() {
        if (!this.state.current) {
            return `
        <div class="empty-state">
          <h3 class="empty-title">No video selected</h3>
          <p class="empty-description">Choose a video to watch from search results or your watch later list.</p>
        </div>
      `;
        }
        const video = this.state.current;
        const videoId = this.extractVideoId(video.url);
        return `
      <div class="player-section">
        <div class="player-header">
          <button class="back-btn" data-action="back">
            <svg class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path>
            </svg>
            Back
          </button>
          <div class="video-meta">
            <h2 class="video-title-large">${video.title}</h2>
            <p class="video-channel-large">${video.channel}</p>
          </div>
        </div>

        <div class="video-player-container">
          <div class="video-player">
            <iframe
              src="https://www.youtube-nocookie.com/embed/${videoId}?rel=0&modestbranding=1&iv_load_policy=3&fs=1&autoplay=1"
              frameborder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowfullscreen
              class="video-iframe">
            </iframe>
          </div>
        </div>

        <div class="video-details">
          <div class="video-actions-bar">
            <button class="action-btn ${this.isInWatchLater(video.id) ? 'secondary' : 'primary'}" data-action="toggle-watchlater" data-video-id="${video.id}">
              <svg class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
              ${this.isInWatchLater(video.id) ? 'Remove from Watch Later' : 'Add to Watch Later'}
            </button>
            <button class="action-btn secondary" data-action="share" data-url="${video.url}">
              <svg class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z"></path>
              </svg>
              Share
            </button>
          </div>
        </div>

        <!-- Recommendations -->
        <div class="recommendations-section">
          <h3 class="recommendations-title">Recommended Videos</h3>
          <div class="recommendations-grid">
            ${this.state.recommendations.slice(0, 6).map(rec => `
              <div class="recommendation-card" data-video-id="${rec.id}">
                <div class="rec-thumbnail">
                  <img src="${rec.thumbnail}" alt="${rec.title}" class="rec-image">
                  <div class="rec-duration">${rec.duration}</div>
                </div>
                <div class="rec-info">
                  <h4 class="rec-title">${rec.title}</h4>
                  <p class="rec-channel">${rec.channel}</p>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;
    }
    renderToast() {
        if (!this.state.toast)
            return '';
        return `
      <div class="toast">
        <div class="toast-content">
          <span class="toast-message">${this.state.toast}</span>
          <button class="toast-close" data-action="close-toast">
            <svg class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
        </div>
      </div>
    `;
    }
    renderModals() {
        return `
      ${this.state.showSubscribeModal ? this.renderSubscribeModal() : ''}
      ${this.state.showPrivacyModal ? this.renderPrivacyModal() : ''}
      ${this.state.showTourModal ? this.renderTourModal() : ''}
      ${this.state.showVideoPlayer ? this.renderVideoPlayer() : ''}
    `;
    }
    renderSubscribeModal() {
        return `
      <div class="modal-overlay" data-modal="subscribe">
        <div class="modal">
          <div class="modal-header">
            <h3 class="modal-title">Subscribe to Channel</h3>
            <button class="modal-close" data-action="close-modal" data-modal="subscribe">
              <svg class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
              </svg>
            </button>
          </div>
          <div class="modal-body">
            <p>Subscribe functionality coming soon!</p>
          </div>
        </div>
      </div>
    `;
    }
    renderPrivacyModal() {
        return `
      <div class="modal-overlay" data-modal="privacy">
        <div class="modal">
          <div class="modal-header">
            <h3 class="modal-title">Privacy Settings</h3>
            <button class="modal-close" data-action="close-modal" data-modal="privacy">
              <svg class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
              </svg>
            </button>
          </div>
          <div class="modal-body">
            <p>Privacy settings coming soon!</p>
          </div>
        </div>
      </div>
    `;
    }
    renderTourModal() {
        return `
      <div class="modal-overlay" data-modal="tour">
        <div class="modal">
          <div class="modal-header">
            <h3 class="modal-title">Welcome to Tuber!</h3>
            <button class="modal-close" data-action="close-modal" data-modal="tour">
              <svg class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
              </svg>
            </button>
          </div>
          <div class="modal-body">
            <p>Welcome to Tuber, your privacy-first YouTube frontend!</p>
            <button class="modal-btn primary" data-action="complete-tour">Get Started</button>
          </div>
        </div>
      </div>
    `;
    }
    renderVideoPlayer() {
        if (!this.state.current)
            return '';
        return `
      <div class="modal-overlay video-player-overlay" data-modal="video-player">
        <div class="video-player-modal">
          <div class="video-player-header">
            <div class="video-info">
              <h3 class="video-title">${this.state.current.title}</h3>
              <p class="video-channel">${this.state.current.channel}</p>
            </div>
            <button class="modal-close video-close-btn" data-action="close-video-player">
              <svg class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
              </svg>
            </button>
          </div>
          <div class="video-player-content">
            <div class="video-container">
              <iframe
                src="https://www.youtube.com/embed/${this.state.current.id}?autoplay=1&rel=0"
                frameborder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowfullscreen
                class="video-iframe">
              </iframe>
            </div>
            <div class="video-actions">
              <button class="action-btn primary" data-action="add-to-watchlater" data-video-id="${this.state.current.id}">
                <svg class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
                ${this.isInWatchLater(this.state.current.id) ? 'Remove from Watch Later' : 'Add to Watch Later'}
              </button>
              <button class="action-btn secondary" data-action="subscribe" data-channel-id="${this.state.current.channelId || ''}">
                <svg class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path>
                </svg>
                Subscribe
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
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
        console.log('renderResults called, results length:', this.state.results.length);
        if (this.state.results.length === 0)
            return '';
        return `
      <div class="results-section">
        <div class="results-header">
          <h2 class="results-title">Search Results</h2>
          <span class="results-count">${this.state.results.length} results found</span>
        </div>
        <div class="results-grid">
          ${this.state.results.map((result, index) => `
            <div class="result-card" style="animation-delay: ${index * 50}ms">
              <div class="result-image-container">
                <img src="${result.thumbnail}" alt="${result.title}" class="result-image" loading="lazy">
                <div class="result-overlay"></div>
                <div class="result-duration">${result.duration}</div>
                <div class="result-actions">
                  <button class="action-btn-icon play-btn" data-action="play" data-video-id="${result.id}" title="Play Video">
                    <svg class="icon" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z"/>
                    </svg>
                  </button>
                  <button class="action-btn-icon watchlater-btn ${this.isInWatchLater(result.id) ? 'active' : ''}" data-action="toggle-watchlater" data-video-id="${result.id}" title="${this.isInWatchLater(result.id) ? 'Remove from Watch Later' : 'Add to Watch Later'}">
                    <svg class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                    </svg>
                  </button>
                </div>
              </div>
              <div class="result-content">
                <h3 class="result-title-text">${result.title}</h3>
                <p class="result-channel">${result.channel}</p>
                <div class="result-meta">
                  <span class="result-views">2.1M views</span>
                  <span class="result-date">2 days ago</span>
                </div>
                <div class="result-buttons">
                  <button class="action-btn primary small" data-action="play" data-video-id="${result.id}">
                    <svg class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1.586a1 1 0 01.707.293l.707.707A1 1 0 0012.414 11H15m-3 7.5A9.5 9.5 0 1121.5 12 9.5 9.5 0 0112 2.5z"></path>
                    </svg>
                    Watch
                  </button>
                  ${result.channelId ? `
                    <button class="action-btn secondary small ${this.isSubscribed(result.channelId) ? 'subscribed' : ''}" data-action="toggle-subscribe" data-channel-id="${result.channelId}" data-channel-title="${result.channel}" data-channel-thumbnail="${result.thumbnail}">
                      <svg class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192L5.636 18.364M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                      </svg>
                      ${this.isSubscribed(result.channelId) ? 'Subscribed' : 'Subscribe'}
                    </button>
                  ` : ''}
                </div>
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
        // Search functionality
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
        // Navigation tabs
        this.appElement.querySelectorAll('.nav-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                const view = e.currentTarget.dataset.view;
                this.switchView(view);
            });
        });
        // Search history
        this.appElement.querySelectorAll('.history-tag').forEach(tag => {
            tag.addEventListener('click', (e) => {
                const searchTerm = e.currentTarget.dataset.search;
                this.handleSearch(searchTerm);
            });
        });
        // Video actions
        this.appElement.querySelectorAll('[data-action]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const action = e.currentTarget.dataset.action;
                const videoId = e.currentTarget.dataset.videoId;
                const channelId = e.currentTarget.dataset.channelId;
                const url = e.currentTarget.dataset.url;
                this.handleAction(action, videoId, channelId, url);
            });
        });
        // Modal handling
        this.appElement.querySelectorAll('.modal-overlay').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    const modalType = e.currentTarget.dataset.modal;
                    this.closeModal(modalType);
                }
            });
        });
        this.appElement.querySelectorAll('.modal-close').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const modalType = e.currentTarget.dataset.modal;
                this.closeModal(modalType);
            });
        });
    }
    isSubscribed(channelId) {
        return this.state.subscriptions.some(sub => sub.id === channelId);
    }
    handleAction(action, videoId, channelId, url) {
        switch (action) {
            case 'play':
                if (videoId) {
                    const video = this.findVideoById(videoId);
                    if (video) {
                        this.playVideo(video);
                    }
                }
                break;
            case 'toggle-watchlater':
                if (videoId) {
                    const video = this.findVideoById(videoId);
                    if (video) {
                        if (this.isInWatchLater(videoId)) {
                            this.removeFromWatchLater(videoId);
                        }
                        else {
                            this.addToWatchLater(video);
                        }
                        this.render();
                    }
                }
                break;
            case 'remove-watchlater':
                if (videoId) {
                    this.removeFromWatchLater(videoId);
                    this.render();
                }
                break;
            case 'clear-watchlater':
                this.state.watchLater = [];
                this.saveWatchLater();
                this.showToast('Cleared all watch later videos');
                this.render();
                break;
            case 'subscribe':
                if (this.state.current) {
                    const channel = {
                        id: this.state.current.channelId || `channel_${Date.now()}`,
                        title: this.state.current.channel,
                        thumbnail: 'https://via.placeholder.com/80x80/9333ea/ffffff?text=Channel'
                    };
                    this.subscribeToChannel(channel);
                }
                break;
            case 'toggle-subscribe':
                if (channelId) {
                    const btn = this.appElement.querySelector(`[data-action="toggle-subscribe"][data-channel-id="${channelId}"]`);
                    const channelTitle = btn?.dataset.channelTitle || 'Unknown Channel';
                    const channelThumbnail = btn?.dataset.channelThumbnail || 'https://via.placeholder.com/80x80/9333ea/ffffff?text=Channel';
                    if (this.isSubscribed(channelId)) {
                        this.unsubscribeFromChannel(channelId);
                    }
                    else {
                        const channel = {
                            id: channelId,
                            title: channelTitle,
                            thumbnail: channelThumbnail
                        };
                        this.subscribeToChannel(channel);
                    }
                }
                break;
            case 'view-channel':
                if (channelId) {
                    // TODO: Implement channel view
                    this.showToast('Channel view coming soon!');
                }
                break;
            case 'share':
                if (url) {
                    navigator.clipboard.writeText(url).then(() => {
                        this.showToast('Video URL copied to clipboard!');
                    });
                }
                break;
            case 'back':
                this.switchView('search');
                break;
            case 'close-toast':
                this.state.toast = null;
                this.render();
                break;
            case 'complete-tour':
                this.state.showTourModal = false;
                localStorage.setItem('tuber-tour-completed', 'true');
                this.render();
                break;
            case 'close-video-player':
                this.state.showVideoPlayer = false;
                this.state.current = null;
                this.render();
                break;
            case 'close-modal':
                // Handled by modal event listeners
                break;
        }
    }
    closeModal(modalType) {
        if (modalType === 'subscribe')
            this.state.showSubscribeModal = false;
        if (modalType === 'privacy')
            this.state.showPrivacyModal = false;
        if (modalType === 'tour')
            this.state.showTourModal = false;
        if (modalType === 'video-player') {
            this.state.showVideoPlayer = false;
            this.state.current = null;
        }
        this.render();
    }
    findVideoById(videoId) {
        return this.state.results.find(v => v.id === videoId) ||
            this.state.watchLater.find(v => v.id === videoId) ||
            this.state.recommendations.find(v => v.id === videoId);
    }
    isInWatchLater(videoId) {
        return this.state.watchLater.some(v => v.id === videoId);
    }
    playVideo(video) {
        this.state.current = video;
        this.state.showVideoPlayer = true;
        // Load recommendations
        this.loadRecommendations(video);
        this.render();
    }
    async loadRecommendations(video) {
        // Simple recommendation logic - in a real app, this would call an API
        this.state.recommendations = this.state.results
            .filter(v => v.id !== video.id)
            .slice(0, 6);
        this.render();
    }
    extractVideoId(url) {
        const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/);
        return match ? match[1] : '';
    }
    async handleSearch(query) {
        console.log('handleSearch called with query:', query);
        if (!query.trim())
            return;
        // Add to search history
        if (!this.state.searchHistory.includes(query)) {
            this.state.searchHistory.unshift(query);
            this.state.searchHistory = this.state.searchHistory.slice(0, 10); // Keep only 10 recent searches
            this.saveSearchHistory();
        }
        this.state.loading = true;
        this.state.error = null;
        this.state.query = query;
        this.render();
        try {
            console.log('Attempting API call...');
            const response = await fetch(`http://localhost:4001/api/search?q=${encodeURIComponent(query)}`);
            console.log('API response status:', response.status);
            if (!response.ok) {
                throw new Error('Search failed');
            }
            const data = await response.json();
            console.log('API response data:', data);
            // Handle different API response formats
            let results = [];
            console.log('Processing API data:', data);
            if (Array.isArray(data)) {
                results = data;
                console.log('Data is array, length:', results.length);
            }
            else if (data.feed && Array.isArray(data.feed.entry)) {
                results = data.feed.entry;
                console.log('Data has feed.entry array, length:', results.length);
            }
            else if (data.results && Array.isArray(data.results)) {
                results = data.results;
                console.log('Data has results array, length:', results.length);
            }
            else if (data.feed && data.feed.entry) {
                // Handle case where entry might be a single object
                results = Array.isArray(data.feed.entry) ? data.feed.entry : [data.feed.entry];
                console.log('Data has feed.entry (converted to array), length:', results.length);
            }
            else {
                console.warn('Unexpected API response format:', data);
                results = [];
            }
            console.log('Final results array length:', results.length);
            console.log('First result sample:', results[0]);
            this.state.results = results.map((item) => {
                const mappedItem = {
                    id: item.videoId || item.id || item['yt:videoId'] || Math.random().toString(),
                    title: item.title || item['media:title'] || 'Unknown Title',
                    channel: item.author?.name || item.channelTitle || item['yt:channelTitle'] || 'Unknown Channel',
                    thumbnail: item.thumbnail || item.thumbnails?.[0]?.url || item['media:thumbnail']?.['@url'] || 'https://via.placeholder.com/320x180/9333ea/ffffff?text=Video',
                    duration: item.duration || item.lengthSeconds ? this.formatDuration(item.lengthSeconds) : item['media:content']?.['@duration'] ? this.formatDuration(parseInt(item['media:content']['@duration'])) : 'Unknown',
                    url: item.url || item.link?.[0]?.['@href'] || `https://youtube.com/watch?v=${item.videoId || item.id || item['yt:videoId']}`,
                    channelId: item.channelId || item['yt:channelId']
                };
                console.log('Mapped item:', mappedItem);
                return mappedItem;
            });
            console.log('Final state.results length:', this.state.results.length);
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
                    url: '#',
                    channelId: 'demo'
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
// Initialize the app when DOM is ready
function initApp() {
    const appElement = document.getElementById('app');
    if (appElement) {
        new TuberApp();
    }
    else {
        console.error('App element not found, retrying...');
        setTimeout(initApp, 100);
    }
}
// Try to initialize immediately
initApp();
// Also listen for DOMContentLoaded just in case
document.addEventListener('DOMContentLoaded', () => {
    const appElement = document.getElementById('app');
    if (appElement && !appElement.hasChildNodes()) {
        initApp();
    }
});
