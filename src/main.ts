// Pure TypeScript Tuber Application
interface VideoItem {
  id: string;
  title: string;
  channel: string;
  thumbnail: string;
  duration: string;
  url: string;
  channelId?: string;
  publishedAt?: string;
  viewCount?: string;
}

interface Channel {
  id: string;
  title: string;
  thumbnail: string;
  subscriberCount?: string;
  videoCount?: string;
  description?: string;
}

interface AppState {
  query: string;
  results: VideoItem[];
  current: VideoItem | null;
  loading: boolean;
  error: string | null;
  toast: string | null;
  subscriptions: Channel[];
  watchLater: VideoItem[];
  recommendations: VideoItem[];
  currentView: 'search' | 'subscriptions' | 'watchlater' | 'player';
  showSubscribeModal: boolean;
  showPrivacyModal: boolean;
  showTourModal: boolean;
  showVideoPlayer: boolean;
  searchHistory: string[];
  hasMoreResults: boolean;
  currentPage: number;
  isLoadingMore: boolean;
}

class TuberApp {
  private state: AppState;
  private appElement: HTMLElement;

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
      searchHistory: this.loadSearchHistory(),
      hasMoreResults: false,
      currentPage: 1,
      isLoadingMore: false
    };

    this.appElement = document.getElementById('app')!;
    if (!this.appElement) {
      console.error('App element not found!');
      return;
    }
    console.log('App element found:', this.appElement);
    this.init();
  }

  private init(): void {
    this.render();
    // Add loaded class after initial render to prevent FOUC
    setTimeout(() => {
      this.appElement.classList.add('loaded');
    }, 50);
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    // Navigation tab clicks
    this.appElement.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const navTab = target.closest('.nav-tab') as HTMLElement;
      
      if (navTab) {
        const view = navTab.dataset.view as 'search' | 'subscriptions' | 'watchlater' | 'player';
        if (view) {
          this.switchView(view);
        }
      }
    });

    // Search form submission
    this.appElement.addEventListener('submit', (e) => {
      const form = e.target as HTMLFormElement;
      if (form.classList.contains('search-form')) {
        e.preventDefault();
        const input = form.querySelector('.search-input') as HTMLInputElement;
        if (input) {
          this.handleSearch(input.value);
        }
      }
    });

    // Search input changes
    this.appElement.addEventListener('input', (e) => {
      const target = e.target as HTMLInputElement;
      if (target.classList.contains('search-input')) {
        this.state.query = target.value;
      }
    });

    // Action button clicks (subscribe, watch later, etc.)
    this.appElement.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const actionBtn = target.closest('.action-btn') as HTMLElement;
      
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
      const target = e.target as HTMLElement;
      if (target.classList.contains('history-tag')) {
        const query = target.textContent?.trim();
        if (query) {
          this.handleSearch(query);
        }
      }
    });

    // Modal close buttons
    this.appElement.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (target.classList.contains('modal-close') || target.classList.contains('modal-overlay')) {
        this.closeModal();
      }
    });
  }

  // Storage methods
  private loadSubscriptions(): Channel[] {
    try {
      const subs = localStorage.getItem('tuber-subscriptions');
      if (subs) {
        const parsed = JSON.parse(subs);
        console.log('Loaded subscriptions:', parsed);
        return Array.isArray(parsed) ? parsed : [];
      }
      return [];
    } catch (error) {
      console.error('Error loading subscriptions:', error);
      return [];
    }
  }

  private saveSubscriptions(): void {
    try {
      const data = JSON.stringify(this.state.subscriptions);
      localStorage.setItem('tuber-subscriptions', data);
      console.log('Saved subscriptions:', this.state.subscriptions);
    } catch (error) {
      console.error('Error saving subscriptions:', error);
    }
  }

  private loadWatchLater(): VideoItem[] {
    try {
      const watchLater = localStorage.getItem('tuber-watchlater');
      if (watchLater) {
        const parsed = JSON.parse(watchLater);
        console.log('Loaded watch later:', parsed);
        return Array.isArray(parsed) ? parsed : [];
      }
      return [];
    } catch (error) {
      console.error('Error loading watch later:', error);
      return [];
    }
  }

  private saveWatchLater(): void {
    try {
      const data = JSON.stringify(this.state.watchLater);
      localStorage.setItem('tuber-watchlater', data);
      console.log('Saved watch later:', this.state.watchLater);
    } catch (error) {
      console.error('Error saving watch later:', error);
    }
  }

  private loadSearchHistory(): string[] {
    try {
      const history = localStorage.getItem('tuber-search-history');
      return history ? JSON.parse(history) : [];
    } catch {
      return [];
    }
  }

  private saveSearchHistory(): void {
    localStorage.setItem('tuber-search-history', JSON.stringify(this.state.searchHistory));
  }

  // Subscription methods
  private subscribeToChannel(channel: Channel): void {
    if (!this.state.subscriptions.find(sub => sub.id === channel.id)) {
      this.state.subscriptions.push(channel);
      this.saveSubscriptions();
      this.showToast(`✓ Subscribed to ${channel.title}`);
      // Force reload from localStorage to ensure consistency
      this.state.subscriptions = this.loadSubscriptions();
      this.render();
    } else {
      this.showToast(`Already subscribed to ${channel.title}`);
    }
  }

  private unsubscribeFromChannel(channelId: string): void {
    const channel = this.state.subscriptions.find(sub => sub.id === channelId);
    this.state.subscriptions = this.state.subscriptions.filter(sub => sub.id !== channelId);
    this.saveSubscriptions();
    // Force reload from localStorage
    this.state.subscriptions = this.loadSubscriptions();
    if (channel) {
      this.showToast(`Unsubscribed from ${channel.title}`);
    }
    this.render();
  }

  // Watch later methods
  private addToWatchLater(video: VideoItem): void {
    if (!this.state.watchLater.find(item => item.id === video.id)) {
      this.state.watchLater.push(video);
      this.saveWatchLater();
      this.showToast(`✓ Added "${video.title}" to Watch Later`);
      // Force reload from localStorage to ensure consistency
      this.state.watchLater = this.loadWatchLater();
      this.render(); // Re-render to update UI
    } else {
      this.showToast(`"${video.title}" is already in Watch Later`);
    }
  }

  private removeFromWatchLater(videoId: string): void {
    const video = this.state.watchLater.find(item => item.id === videoId);
    this.state.watchLater = this.state.watchLater.filter(item => item.id !== videoId);
    this.saveWatchLater();
    // Force reload from localStorage
    this.state.watchLater = this.loadWatchLater();
    if (video) {
      this.showToast(`Removed "${video.title}" from Watch Later`);
    }
    this.render();
  }

  // Toast notifications
  private showToast(message: string): void {
    this.state.toast = message;
    this.render();
    setTimeout(() => {
      this.state.toast = null;
      this.render();
    }, 3000);
  }

  // View switching
  private switchView(view: 'search' | 'subscriptions' | 'watchlater' | 'player'): void {
    console.log('Switching view to:', view);
    console.log('Current subscriptions count:', this.state.subscriptions.length);
    console.log('Current watch later count:', this.state.watchLater.length);
    
    // Always reload data from localStorage when switching views to ensure fresh data
    const loadedSubs = this.loadSubscriptions();
    const loadedWatchLater = this.loadWatchLater();
    
    console.log('Loaded from localStorage - Subscriptions:', loadedSubs.length, loadedSubs);
    console.log('Loaded from localStorage - Watch Later:', loadedWatchLater.length, loadedWatchLater);
    
    // Update state with fresh data
    this.state.subscriptions = loadedSubs;
    this.state.watchLater = loadedWatchLater;
    
    this.state.currentView = view;
    if (view === 'player' && !this.state.current) {
      // If trying to view player without a video, go back to search
      this.state.currentView = 'search';
    }
    
    // Force render to update UI
    this.render();
    
    // Verify render after a short delay
    setTimeout(() => {
      console.log('After render - Current view:', this.state.currentView);
      console.log('After render - Subscriptions:', this.state.subscriptions.length);
      console.log('After render - Watch Later:', this.state.watchLater.length);
      
      const subsSection = this.appElement.querySelector('.subscriptions-section');
      const watchLaterSection = this.appElement.querySelector('.watchlater-section');
      const subsView = this.appElement.querySelector('.subscriptions-view');
      const watchLaterView = this.appElement.querySelector('.watchlater-view');
      
      console.log('Elements found:', {
        subsSection: !!subsSection,
        watchLaterSection: !!watchLaterSection,
        subsView: !!subsView,
        watchLaterView: !!watchLaterView
      });
    }, 200);
  }

  private render(): void {
    console.log('Render method called');
    const activeView = this.state.currentView;
    
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
                <button class="nav-tab ${activeView === 'search' ? 'active' : ''}" data-view="search">
                  <svg class="nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
                  </svg>
                  Search
                </button>
                <button class="nav-tab ${activeView === 'subscriptions' ? 'active' : ''}" data-view="subscriptions">
                  <svg class="nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"></path>
                  </svg>
                  Subscriptions (${this.state.subscriptions.length})
                </button>
                <button class="nav-tab ${activeView === 'watchlater' ? 'active' : ''}" data-view="watchlater">
                  <svg class="nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                  </svg>
                  Watch Later (${this.state.watchLater.length})
                </button>
              </nav>
            </div>

              ${activeView === 'search' ? `
              <div class="search-section">
                <form class="search-form">
                  <div class="search-input-container">
                    <input
                      type="text"
                      placeholder="Search videos, channels, or paste YouTube URL..."
                      class="search-input"
                      value="${this.state.query || ''}"
                      aria-label="Search"
                      autocomplete="off"
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

              ${this.renderSearchHistory()}

              <!-- Search results -->
              ${this.renderResults()}

              <!-- Loading state -->
              ${this.renderLoading()}

              <!-- Error state -->
              ${this.renderError()}
            ` : ''}

            ${activeView === 'subscriptions' ? `
              <div class="view-content subscriptions-view">
                ${this.renderSubscriptions()}
              </div>
            ` : ''}
            ${activeView === 'watchlater' ? `
              <div class="view-content watchlater-view">
                ${this.renderWatchLater()}
              </div>
            ` : ''}
            ${activeView === 'player' ? `
              <div class="view-content player-view">
                ${this.renderPlayer()}
              </div>
            ` : ''}
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

  private renderSearchHistory(): string {
    if (this.state.searchHistory.length === 0) return '';

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

  private renderSubscriptions(): string {
    console.log('renderSubscriptions called, count:', this.state.subscriptions.length);
    console.log('Subscriptions data:', this.state.subscriptions);
    
    if (!this.state.subscriptions || this.state.subscriptions.length === 0) {
      return `
        <div class="empty-state">
          <div class="empty-icon">
            <svg class="icon-large" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"></path>
            </svg>
          </div>
          <h3 class="empty-title">No subscriptions yet</h3>
          <p class="empty-description">Search for channels and subscribe to see their latest videos here.</p>
        </div>
      `;
    }

    return `
      <div class="subscriptions-section">
        <div class="section-header">
          <h2 class="section-title">Your Subscriptions</h2>
          <span class="section-count">${this.state.subscriptions.length} ${this.state.subscriptions.length === 1 ? 'channel' : 'channels'}</span>
        </div>
        <div class="subscriptions-grid">
          ${this.state.subscriptions.map((channel, index) => `
            <div class="channel-card" data-channel-id="${channel.id}" style="animation-delay: ${index * 100}ms">
              <div class="channel-avatar">
                <img src="${channel.thumbnail || 'https://via.placeholder.com/80x80/9333ea/ffffff?text=Channel'}" alt="${channel.title || 'Channel'}" class="channel-image" onerror="this.src='https://via.placeholder.com/80x80/9333ea/ffffff?text=Channel'">
                <div class="channel-badge">
                  <svg class="icon" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"/>
                  </svg>
                </div>
              </div>
              <div class="channel-info">
                <h3 class="channel-title">${channel.title || 'Unknown Channel'}</h3>
                <p class="channel-stats">${channel.subscriberCount || 'N/A'} subscribers</p>
                <div class="channel-actions">
                  <button class="action-btn primary" data-action="view-channel" data-channel-id="${channel.id}">
                    <svg class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
                    </svg>
                    View Channel
                  </button>
                  <button class="action-btn danger" data-action="unsubscribe" data-channel-id="${channel.id}">
                    <svg class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                    </svg>
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

  private renderWatchLater(): string {
    console.log('renderWatchLater called, count:', this.state.watchLater.length);
    console.log('Watch later data:', this.state.watchLater);
    
    if (!this.state.watchLater || this.state.watchLater.length === 0) {
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
          <div class="section-header-right">
            <span class="section-count">${this.state.watchLater.length} ${this.state.watchLater.length === 1 ? 'video' : 'videos'}</span>
            <button class="clear-btn" data-action="clear-watchlater">
              <svg class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
              </svg>
              Clear All
            </button>
          </div>
        </div>
        <div class="videos-grid">
          ${this.state.watchLater.map((video, index) => `
            <div class="video-card" data-video-id="${video.id}" style="animation-delay: ${index * 100}ms">
              <div class="video-thumbnail">
                <img src="${video.thumbnail || 'https://via.placeholder.com/320x180/9333ea/ffffff?text=Video'}" alt="${video.title || 'Video'}" class="video-image" onerror="this.src='https://via.placeholder.com/320x180/9333ea/ffffff?text=Video'">
                <div class="video-duration">${video.duration || '0:00'}</div>
                <div class="video-overlay">
                  <button class="play-btn" data-action="play" data-video-id="${video.id}">
                    <svg class="icon" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z"/>
                    </svg>
                  </button>
                </div>
              </div>
              <div class="video-info">
                <h3 class="video-title">${video.title || 'Unknown Title'}</h3>
                <p class="video-channel">${video.channel || 'Unknown Channel'}</p>
                ${video.viewCount ? `<p class="video-meta">${video.viewCount}</p>` : ''}
                <div class="video-actions">
                  <button class="action-btn primary" data-action="play" data-video-id="${video.id}">
                    <svg class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"></path>
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                    </svg>
                    Watch Now
                  </button>
                  <button class="action-btn danger" data-action="remove-watchlater" data-video-id="${video.id}">
                    <svg class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                    </svg>
                    Remove
                  </button>
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  private renderPlayer(): string {
    if (!this.state.current) {
      return `
        <div class="empty-state">
          <h3 class="empty-title">No video selected</h3>
          <p class="empty-description">Choose a video to watch from search results or your watch later list.</p>
        </div>
      `;
    }

    const video = this.state.current;
    const videoId = this.extractVideoId(video.url) || video.id;

    // Use youtube-nocookie.com for ad-blocking and privacy
    const embedUrl = `https://www.youtube-nocookie.com/embed/${videoId}?rel=0&modestbranding=1&iv_load_policy=3&fs=1&autoplay=1&controls=1&disablekb=1&playsinline=1`;

    return `
      <div class="player-section">
        <div class="player-header-modern">
          <button class="back-btn-modern" data-action="back">
            <svg class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path>
            </svg>
            <span>Back</span>
          </button>
          <div class="video-meta-modern">
            <h2 class="video-title-large">${video.title}</h2>
            <div class="video-meta-row">
              <p class="video-channel-large">${video.channel}</p>
              ${video.viewCount ? `<span class="video-views-badge">${video.viewCount}</span>` : ''}
            </div>
          </div>
        </div>

        <div class="video-player-container-modern">
          <div class="video-player-wrapper">
            <div class="player-glow"></div>
            <div class="iframe-wrapper-modern">
              <iframe
                src="${embedUrl}"
                frameborder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowfullscreen
                class="video-iframe-modern"
                title="${video.title}">
              </iframe>
            </div>
          </div>
        </div>

        <div class="video-details-modern">
          <div class="video-actions-bar-modern">
            <button class="action-btn-modern ${this.isInWatchLater(video.id) ? 'saved' : 'save'}" data-action="toggle-watchlater" data-video-id="${video.id}">
              <svg class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
              <span>${this.isInWatchLater(video.id) ? 'Saved' : 'Save'}</span>
            </button>
            ${video.channelId ? `
              <button class="action-btn-modern ${this.isSubscribed(video.channelId) ? 'subscribed-modern' : 'subscribe-modern'}" data-action="toggle-subscribe" data-channel-id="${video.channelId}" data-channel-title="${video.channel}" data-channel-thumbnail="${video.thumbnail}">
                <svg class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"></path>
                </svg>
                <span>${this.isSubscribed(video.channelId) ? 'Subscribed' : 'Subscribe'}</span>
              </button>
            ` : ''}
            <button class="action-btn-modern share-modern" data-action="share" data-url="${video.url}">
              <svg class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z"></path>
              </svg>
              <span>Share</span>
            </button>
          </div>
        </div>

        <!-- Recommendations -->
        <div class="recommendations-section-modern">
          <h3 class="recommendations-title-modern">
            <span>Recommended Videos</span>
            <span class="rec-count">${this.state.recommendations.length}</span>
          </h3>
          <div class="recommendations-grid-modern">
            ${this.state.recommendations.slice(0, 6).map(rec => `
              <div class="recommendation-card-modern" data-video-id="${rec.id}">
                <div class="rec-thumbnail-modern">
                  <img src="${rec.thumbnail}" alt="${rec.title}" class="rec-image-modern">
                  <div class="rec-duration-modern">${rec.duration}</div>
                  <div class="rec-play-overlay-modern">
                    <button class="rec-play-btn-modern" data-action="play" data-video-id="${rec.id}">
                      <svg class="icon" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z"/>
                      </svg>
                    </button>
                  </div>
                </div>
                <div class="rec-info-modern">
                  <h4 class="rec-title-modern">${rec.title}</h4>
                  <p class="rec-channel-modern">${rec.channel}</p>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;
  }

  private renderToast(): string {
    if (!this.state.toast) return '';

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

  private renderModals(): string {
    return `
      ${this.state.showSubscribeModal ? this.renderSubscribeModal() : ''}
      ${this.state.showPrivacyModal ? this.renderPrivacyModal() : ''}
      ${this.state.showTourModal ? this.renderTourModal() : ''}
      ${this.state.showVideoPlayer ? this.renderVideoPlayer() : ''}
    `;
  }

  private renderSubscribeModal(): string {
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

  private renderPrivacyModal(): string {
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

  private renderTourModal(): string {
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

  private renderVideoPlayer(): string {
    if (!this.state.current) return '';

    const video = this.state.current;
    const videoId = this.extractVideoId(video.url) || video.id;
    // Use youtube-nocookie.com for ad-blocking
    const embedUrl = `https://www.youtube-nocookie.com/embed/${videoId}?rel=0&modestbranding=1&iv_load_policy=3&fs=1&autoplay=1&controls=1&disablekb=1&playsinline=1`;

    return `
      <div class="modal-overlay video-player-overlay" data-modal="video-player">
        <div class="video-player-modal">
          <div class="video-player-header">
            <div class="video-info">
              <h3 class="video-title">${video.title}</h3>
              <p class="video-channel">${video.channel}</p>
              ${video.viewCount ? `<span class="video-views-small">${video.viewCount}</span>` : ''}
            </div>
            <button class="modal-close video-close-btn" data-action="close-video-player">
              <svg class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
              </svg>
            </button>
          </div>
          <div class="video-player-content">
            <div class="video-container">
              <div class="iframe-wrapper">
                <iframe
                  src="${embedUrl}"
                  frameborder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowfullscreen
                  class="video-iframe"
                  title="${video.title}">
                </iframe>
              </div>
            </div>
            <div class="video-actions">
              <button class="action-btn primary" data-action="toggle-watchlater" data-video-id="${video.id}">
                <svg class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
                ${this.isInWatchLater(video.id) ? 'Remove from Watch Later' : 'Add to Watch Later'}
              </button>
              ${video.channelId ? `
                <button class="action-btn ${this.isSubscribed(video.channelId) ? 'subscribed' : 'secondary'}" data-action="toggle-subscribe" data-channel-id="${video.channelId}" data-channel-title="${video.channel}" data-channel-thumbnail="${video.thumbnail}">
                  <svg class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"></path>
                  </svg>
                  ${this.isSubscribed(video.channelId) ? 'Subscribed' : 'Subscribe'}
                </button>
              ` : ''}
              <button class="action-btn secondary" data-action="share" data-url="${video.url}">
                <svg class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z"></path>
                </svg>
                Share
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  private renderLoading(): string {
    if (!this.state.loading) return '';

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

  private renderError(): string {
    if (!this.state.error) return '';

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

  private renderResults(): string {
    console.log('renderResults called, results length:', this.state.results.length);
    if (this.state.results.length === 0) return '';

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
                  ${result.viewCount ? `<span class="result-views">${result.viewCount}</span>` : ''}
                  ${result.publishedAt ? `<span class="result-date">${result.publishedAt}</span>` : ''}
                </div>
                <div class="result-buttons">
                  <button class="watch-btn" data-action="play" data-video-id="${result.id}">
                    <span class="watch-btn-content">
                      <svg class="watch-icon" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z"/>
                      </svg>
                      <span class="watch-text">Watch</span>
                    </span>
                    <span class="watch-btn-bg"></span>
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
        ${this.state.hasMoreResults || this.state.results.length >= 20 ? `
          <div class="load-more-container">
            <button class="load-more-btn ${this.state.isLoadingMore ? 'loading' : ''}" data-action="load-more">
              ${this.state.isLoadingMore ? `
                <span class="load-more-spinner"></span>
                Loading more...
              ` : `
                <svg class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path>
                </svg>
                Load More Results
              `}
            </button>
          </div>
        ` : ''}
      </div>
    `;
  }

  private attachEventListeners(): void {
    const searchForm = this.appElement.querySelector('.search-form') as HTMLFormElement;
    const searchInput = this.appElement.querySelector('.search-input') as HTMLInputElement;

    // Search functionality
    if (searchForm && searchInput) {
      searchForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.handleSearch(searchInput.value);
      });

      searchInput.addEventListener('input', (e) => {
        this.state.query = (e.target as HTMLInputElement).value;
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
        const view = (e.currentTarget as HTMLElement).dataset.view as 'search' | 'subscriptions' | 'watchlater' | 'player';
        this.switchView(view);
      });
    });

    // Search history
    this.appElement.querySelectorAll('.history-tag').forEach(tag => {
      tag.addEventListener('click', (e) => {
        const searchTerm = (e.currentTarget as HTMLElement).dataset.search!;
        this.handleSearch(searchTerm);
      });
    });

    // Video actions
    this.appElement.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const action = (e.currentTarget as HTMLElement).dataset.action;
        const videoId = (e.currentTarget as HTMLElement).dataset.videoId;
        const channelId = (e.currentTarget as HTMLElement).dataset.channelId;
        const url = (e.currentTarget as HTMLElement).dataset.url;

        this.handleAction(action, videoId, channelId, url);
      });
    });

    // Recommendation card clicks
    this.appElement.querySelectorAll('.recommendation-card').forEach(card => {
      card.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        // Don't trigger if clicking on a button
        if (target.closest('button')) return;
        
        const videoId = (card as HTMLElement).dataset.videoId;
        if (videoId) {
          const video = this.findVideoById(videoId);
          if (video) {
            this.playVideo(video);
          }
        }
      });
    });

    // Modal handling
    this.appElement.querySelectorAll('.modal-overlay').forEach(modal => {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          const modalType = (e.currentTarget as HTMLElement).dataset.modal;
          this.closeModal(modalType);
        }
      });
    });

    this.appElement.querySelectorAll('.modal-close').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const modalType = (e.currentTarget as HTMLElement).dataset.modal;
        this.closeModal(modalType);
      });
    });
  }

  private isSubscribed(channelId: string): boolean {
    return this.state.subscriptions.some(sub => sub.id === channelId);
  }

  private handleAction(action: string | undefined, videoId?: string, channelId?: string, url?: string): void {
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
            } else {
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
          const channel: Channel = {
            id: this.state.current.channelId || `channel_${Date.now()}`,
            title: this.state.current.channel,
            thumbnail: 'https://via.placeholder.com/80x80/9333ea/ffffff?text=Channel'
          };
          this.subscribeToChannel(channel);
        }
        break;
      case 'toggle-subscribe':
        if (channelId) {
          const btn = this.appElement.querySelector(`[data-action="toggle-subscribe"][data-channel-id="${channelId}"]`) as HTMLElement;
          const channelTitle = btn?.dataset.channelTitle || 'Unknown Channel';
          const channelThumbnail = btn?.dataset.channelThumbnail || 'https://via.placeholder.com/80x80/9333ea/ffffff?text=Channel';

          if (this.isSubscribed(channelId)) {
            this.unsubscribeFromChannel(channelId);
          } else {
            const channel: Channel = {
              id: channelId,
              title: channelTitle,
              thumbnail: channelThumbnail
            };
            this.subscribeToChannel(channel);
          }
        }
        break;
      case 'unsubscribe':
        if (channelId) {
          this.unsubscribeFromChannel(channelId);
        }
        break;
      case 'view-channel':
        if (channelId) {
          // Search for videos from this channel
          const channel = this.state.subscriptions.find(sub => sub.id === channelId);
          if (channel) {
            this.state.query = channel.title;
            this.state.currentView = 'search';
            this.handleSearch(channel.title);
          }
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
        this.state.currentView = 'search';
        this.render();
        break;
      case 'load-more':
        if (!this.state.isLoadingMore && this.state.query) {
          this.loadMoreResults();
        }
        break;
      case 'close-modal':
        // Handled by modal event listeners
        break;
    }
  }

  private async loadMoreResults(): Promise<void> {
    if (this.state.isLoadingMore || !this.state.query) {
      console.log('Cannot load more - isLoadingMore:', this.state.isLoadingMore, 'query:', this.state.query);
      return;
    }

    console.log('Loading more results for page:', this.state.currentPage + 1);
    this.state.isLoadingMore = true;
    this.state.currentPage += 1;
    this.render();

    try {
      // Fetch more results with offset
      const offset = this.state.results.length;
      const response = await fetch(`https://tuber.spoass.workers.dev/api/search?q=${encodeURIComponent(this.state.query)}&offset=${offset}`);
      
      if (!response.ok) {
        throw new Error(`Load more failed: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('Load more response:', data);
      
      let newResults: any[] = [];
      if (data.feed && Array.isArray(data.feed.entry)) {
        newResults = data.feed.entry;
      } else if (Array.isArray(data)) {
        newResults = data;
      } else if (data.results && Array.isArray(data.results)) {
        newResults = data.results;
      }

      console.log('New results count:', newResults.length);

      if (newResults.length > 0) {
        const mappedResults = newResults.map((item: any) => {
          const videoId = item.videoId || item.id || item['yt:videoId'] || '';
          return {
            id: videoId || Math.random().toString(),
            title: item.title || item['media:title'] || 'Unknown Title',
            channel: item.channelTitle || item.author?.name || item['yt:channelTitle'] || 'Unknown Channel',
            thumbnail: item.thumbnail || item.thumbnails?.[0]?.url || item['media:thumbnail']?.['@url'] || (videoId ? `https://img.youtube.com/vi/${videoId}/mqdefault.jpg` : 'https://via.placeholder.com/320x180/9333ea/ffffff?text=Video'),
            duration: item.duration || (item.durationSeconds ? this.formatDuration(item.durationSeconds) : 'Unknown') || 'Unknown',
            url: item.url || item.link?.[0]?.['@href'] || (videoId ? `https://youtube.com/watch?v=${videoId}` : '#'),
            channelId: item.channelId || item['yt:channelId'] || '',
            viewCount: item.viewCount || item.viewCountText || '0 views',
            publishedAt: item.publishedTime || item.publishedAt || '',
            isChannel: item.isChannel || false
          };
        });

        // Add new results, avoiding duplicates
        const existingIds = new Set(this.state.results.map(r => r.id));
        const uniqueNewResults = mappedResults.filter(r => !existingIds.has(r.id));
        
        console.log('Unique new results:', uniqueNewResults.length);
        
        if (uniqueNewResults.length > 0) {
          this.state.results = [...this.state.results, ...uniqueNewResults];
          
          // Check if there are more results available
          if (data.feed && typeof data.feed.hasMore === 'boolean') {
            this.state.hasMoreResults = data.feed.hasMore;
          } else {
            this.state.hasMoreResults = uniqueNewResults.length >= 20;
          }
          
          this.showToast(`✓ Loaded ${uniqueNewResults.length} more results`);
        } else {
          this.state.hasMoreResults = false;
          this.showToast('No new results found');
        }
      } else {
        this.state.hasMoreResults = false;
        this.showToast('No more results available');
      }
    } catch (error: any) {
      console.error('Load more error:', error);
      this.showToast(`Failed to load more: ${error.message}`);
      this.state.hasMoreResults = false;
    } finally {
      this.state.isLoadingMore = false;
      this.render();
    }
  }

  private closeModal(modalType?: string): void {
    if (modalType === 'subscribe') this.state.showSubscribeModal = false;
    if (modalType === 'privacy') this.state.showPrivacyModal = false;
    if (modalType === 'tour') this.state.showTourModal = false;
    if (modalType === 'video-player') {
      this.state.showVideoPlayer = false;
      this.state.current = null;
    }
    this.render();
  }

  private findVideoById(videoId: string): VideoItem | undefined {
    return this.state.results.find(v => v.id === videoId) ||
           this.state.watchLater.find(v => v.id === videoId) ||
           this.state.recommendations.find(v => v.id === videoId);
  }

  private isInWatchLater(videoId: string): boolean {
    return this.state.watchLater.some(v => v.id === videoId);
  }

  private playVideo(video: VideoItem): void {
    this.state.current = video;
    this.state.showVideoPlayer = true;
    this.state.currentView = 'player';
    // Load recommendations
    this.loadRecommendations(video);
    this.render();
  }

  private async loadRecommendations(video: VideoItem): Promise<void> {
    // Simple recommendation logic - in a real app, this would call an API
    this.state.recommendations = this.state.results
      .filter(v => v.id !== video.id)
      .slice(0, 6);
    this.render();
  }

  private extractVideoId(url: string): string {
    const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/);
    return match ? match[1] : '';
  }

  private async handleSearch(query: string): Promise<void> {
    console.log('handleSearch called with query:', query);
    if (!query.trim()) return;

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
      const response = await fetch(`https://tuber.spoass.workers.dev/api/search?q=${encodeURIComponent(query)}`);
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
      } else if (data.feed && Array.isArray(data.feed.entry)) {
        results = data.feed.entry;
        console.log('Data has feed.entry array, length:', results.length);
      } else if (data.results && Array.isArray(data.results)) {
        results = data.results;
        console.log('Data has results array, length:', results.length);
      } else if (data.feed && data.feed.entry) {
        // Handle case where entry might be a single object
        results = Array.isArray(data.feed.entry) ? data.feed.entry : [data.feed.entry];
        console.log('Data has feed.entry (converted to array), length:', results.length);
      } else {
        console.warn('Unexpected API response format:', data);
        results = [];
      }

      console.log('Final results array length:', results.length);
      console.log('First result sample:', results[0]);

      this.state.results = results.map((item: any) => {
        const videoId = item.videoId || item.id || item['yt:videoId'] || '';
        const mappedItem = {
          id: videoId || Math.random().toString(),
          title: item.title || item['media:title'] || 'Unknown Title',
          channel: item.channelTitle || item.author?.name || item['yt:channelTitle'] || 'Unknown Channel',
          thumbnail: item.thumbnail || item.thumbnails?.[0]?.url || item['media:thumbnail']?.['@url'] || (videoId ? `https://img.youtube.com/vi/${videoId}/mqdefault.jpg` : 'https://via.placeholder.com/320x180/9333ea/ffffff?text=Video'),
          duration: item.duration || (item.durationSeconds ? this.formatDuration(item.durationSeconds) : 'Unknown') || (item.lengthSeconds ? this.formatDuration(item.lengthSeconds) : 'Unknown') || 'Unknown',
          url: item.url || item.link?.[0]?.['@href'] || (videoId ? `https://youtube.com/watch?v=${videoId}` : '#'),
          channelId: item.channelId || item['yt:channelId'] || '',
          viewCount: item.viewCount || item.viewCountText || '0 views',
          publishedAt: item.publishedTime || item.publishedAt || '',
          isChannel: item.isChannel || false
        };
        console.log('Mapped item:', mappedItem);
        return mappedItem;
      });

      // Set hasMoreResults based on API response or results count
      if (data.feed && typeof data.feed.hasMore === 'boolean') {
        this.state.hasMoreResults = data.feed.hasMore;
      } else {
        this.state.hasMoreResults = results.length >= 20;
      }
      this.state.currentPage = 1;
      console.log('Final state.results length:', this.state.results.length, 'hasMore:', this.state.hasMoreResults);

    } catch (error) {
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
    } finally {
      this.state.loading = false;
      this.render();
    }
  }

  private formatDuration(seconds: number): string {
    if (!seconds) return 'Unknown';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }
}

// Initialize the app when DOM is ready
function initApp() {
  const appElement = document.getElementById('app');
  if (appElement) {
    // Hide the loading page with animation
    const loadingPage = document.getElementById('loading-page');
    if (loadingPage) {
      loadingPage.style.transition = 'opacity 0.5s ease-out';
      loadingPage.style.opacity = '0';
      setTimeout(() => {
        loadingPage.style.display = 'none';
      }, 500);
    }

    new TuberApp();
  } else {
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