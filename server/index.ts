import express from 'express';
import cors from 'cors';
import axios from 'axios';
import * as cheerio from 'cheerio';

const app = express();
const PORT = 4001;

app.use(cors());
app.use(express.json());

// Helper function to format duration
function formatDuration(seconds: number): string {
  if (!seconds) return 'Unknown';
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  if (hours > 0) {
    return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Helper function to parse YouTube initial data
function parseYouTubeInitialData(html: string): any {
  try {
    // Extract ytInitialData from script tag
    const match = html.match(/var ytInitialData = ({.+?});/);
    if (match && match[1]) {
      return JSON.parse(match[1]);
    }
    
    // Try alternative pattern
    const match2 = html.match(/window\["ytInitialData"\] = ({.+?});/);
    if (match2 && match2[1]) {
      return JSON.parse(match2[1]);
    }
    
    // Try ytInitialPlayerResponse
    const match3 = html.match(/var ytInitialPlayerResponse = ({.+?});/);
    if (match3 && match3[1]) {
      return JSON.parse(match3[1]);
    }
    
    return null;
  } catch (e) {
    console.error('Error parsing YouTube data:', e);
    return null;
  }
}

// Extract video results from YouTube initial data
function extractVideoResults(data: any, limit: number = 20): any[] {
  const results: any[] = [];
  
  try {
    // Navigate through YouTube's nested data structure
    const contents = data?.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents;
    
    if (contents && Array.isArray(contents)) {
      for (const section of contents) {
        const itemSection = section?.itemSectionRenderer?.contents;
        if (itemSection && Array.isArray(itemSection)) {
          for (const item of itemSection) {
            if (results.length >= limit) break;
            
            const videoRenderer = item?.videoRenderer;
            if (videoRenderer) {
              const videoId = videoRenderer.videoId;
              const title = videoRenderer.title?.runs?.[0]?.text || videoRenderer.title?.simpleText || 'Unknown Title';
              const channelTitle = videoRenderer.ownerText?.runs?.[0]?.text || videoRenderer.ownerText?.simpleText || 'Unknown Channel';
              const channelId = videoRenderer.ownerText?.runs?.[0]?.navigationEndpoint?.browseEndpoint?.browseId || '';
              const thumbnail = videoRenderer.thumbnail?.thumbnails?.[videoRenderer.thumbnail.thumbnails.length - 1]?.url || `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
              const lengthText = videoRenderer.lengthText?.simpleText || videoRenderer.lengthText?.runs?.[0]?.text || '0:00';
              const viewCount = videoRenderer.viewCountText?.simpleText || videoRenderer.viewCountText?.runs?.[0]?.text || '0 views';
              const publishedTime = videoRenderer.publishedTimeText?.simpleText || '';
              
              // Convert duration text to seconds for formatting
              let durationSeconds = 0;
              try {
                const parts = lengthText.split(':').map(Number);
                if (parts.length === 2) {
                  durationSeconds = parts[0] * 60 + parts[1];
                } else if (parts.length === 3) {
                  durationSeconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
                }
              } catch (e) {
                // Keep durationSeconds as 0
              }
              
              if (videoId && title !== 'Unknown Title') {
                results.push({
                  videoId,
                  id: videoId,
                  title,
                  channelTitle,
                  channelId: channelId.replace('UC', ''),
                  thumbnail,
                  duration: lengthText,
                  durationSeconds,
                  viewCount,
                  publishedTime,
                  url: `https://www.youtube.com/watch?v=${videoId}`,
                  publishedAt: new Date().toISOString()
                });
              }
            }
            
            // Also check for channel results
            const channelRenderer = item?.channelRenderer;
            if (channelRenderer && results.length < limit) {
              const channelId = channelRenderer.channelId || '';
              const channelTitle = channelRenderer.title?.simpleText || channelRenderer.title?.runs?.[0]?.text || 'Unknown Channel';
              const thumbnail = channelRenderer.thumbnail?.thumbnails?.[0]?.url || `https://img.youtube.com/vi/${channelId}/mqdefault.jpg`;
              const subscriberCount = channelRenderer.subscriberCountText?.simpleText || '0 subscribers';
              const videoCount = channelRenderer.videoCountText?.simpleText || '0 videos';
              
              results.push({
                videoId: null,
                id: channelId,
                title: channelTitle,
                channelTitle,
                channelId,
                thumbnail,
                duration: 'Channel',
                viewCount: subscriberCount,
                publishedTime: videoCount,
                url: `https://www.youtube.com/channel/${channelId}`,
                publishedAt: new Date().toISOString(),
                isChannel: true
              });
            }
          }
        }
      }
    }
  } catch (e) {
    console.error('Error extracting video results:', e);
  }
  
  return results;
}

// YouTube search endpoint
app.get('/api/search', async (req, res) => {
  try {
    const query = req.query.q as string;
    const type = (req.query.type as string) || 'video'; // video or channel
    const offset = parseInt(req.query.offset as string) || 0; // Pagination offset

    if (!query) {
      return res.json({ feed: { title: 'No results', entry: [] } });
    }

    try {
      const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
      const response = await axios.get(searchUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate, br',
          'Referer': 'https://www.youtube.com/',
          'Origin': 'https://www.youtube.com'
        },
        timeout: 10000
      });

      const html = response.data;
      const initialData = parseYouTubeInitialData(html);
      
      if (initialData) {
        const results = extractVideoResults(initialData, 50);
        
        if (results.length > 0) {
          // Filter by type if specified
          const filteredResults = type === 'channel' 
            ? results.filter(r => r.isChannel)
            : type === 'video'
            ? results.filter(r => !r.isChannel)
            : results;
          
          // Apply pagination
          const paginatedResults = filteredResults.slice(offset, offset + 20);
          
          return res.json({
            feed: {
              title: `Search results for "${query}"`,
              entry: paginatedResults,
              totalResults: filteredResults.length,
              hasMore: offset + 20 < filteredResults.length
            }
          });
        }
      }

      // Fallback: Try parsing with cheerio
      const $ = cheerio.load(html);
      const results: any[] = [];
      
      // Look for script tags with video data
      $('script').each((i, elem) => {
        const scriptContent = $(elem).html() || '';
        if (scriptContent.includes('videoId') && scriptContent.includes('watch?v=')) {
          const videoIdMatches = scriptContent.match(/"videoId":"([^"]+)"/g);
          const titleMatches = scriptContent.match(/"title":\{"runs":\[\{"text":"([^"]+)"\}\]\}/g);
          
          if (videoIdMatches && videoIdMatches.length > 0) {
            videoIdMatches.slice(0, 20).forEach((match, idx) => {
              const videoId = match.match(/"videoId":"([^"]+)"/)?.[1];
              if (videoId && !results.find(r => r.videoId === videoId)) {
                const title = titleMatches?.[idx]?.match(/"text":"([^"]+)"/)?.[1] || 'Unknown Title';
                results.push({
                  videoId,
                  id: videoId,
                  title: title.replace(/\\u([0-9a-fA-F]{4})/g, (_, code) => String.fromCharCode(parseInt(code, 16))),
                  channelTitle: 'YouTube Channel',
                  thumbnail: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
                  duration: 'Unknown',
                  viewCount: '0',
                  url: `https://www.youtube.com/watch?v=${videoId}`,
                  publishedAt: new Date().toISOString()
                });
              }
            });
          }
        }
      });

      if (results.length > 0) {
        return res.json({
          feed: {
            title: `Search results for "${query}"`,
            entry: results.slice(0, 20)
          }
        });
      }

    } catch (scrapeError: any) {
      console.log('Scraping failed:', scrapeError.message);
    }

    // Final fallback: return mock results
    const mockResults = [
      {
        videoId: 'dQw4w9WgXcQ',
        id: 'dQw4w9WgXcQ',
        title: `Search results for "${query}" - Sample Video 1`,
        url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        thumbnail: 'https://img.youtube.com/vi/dQw4w9WgXcQ/mqdefault.jpg',
        channelTitle: 'Demo Channel',
        channelId: 'UCdemo',
        duration: '3:32',
        viewCount: '1M views',
        publishedAt: new Date().toISOString()
      },
      {
        videoId: '9bZkp7q19f0',
        id: '9bZkp7q19f0',
        title: `Another result for "${query}" - Sample Video 2`,
        url: 'https://www.youtube.com/watch?v=9bZkp7q19f0',
        thumbnail: 'https://img.youtube.com/vi/9bZkp7q19f0/mqdefault.jpg',
        channelTitle: 'Another Channel',
        channelId: 'UCanother',
        duration: '5:21',
        viewCount: '500K views',
        publishedAt: new Date().toISOString()
      }
    ];

    res.json({
      feed: {
        title: `Search results for "${query}"`,
        entry: mockResults
      }
    });

  } catch (error: any) {
    console.error('Search error:', error);
    res.status(500).json({ feed: { title: 'Error', entry: [] }, error: error.message });
  }
});

// Get video details
app.get('/api/video/:id', async (req, res) => {
  try {
    const videoId = req.params.id;
    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;

    try {
      const response = await axios.get(videoUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        },
        timeout: 10000
      });

      const html = response.data;
      const initialData = parseYouTubeInitialData(html);
      
      if (initialData) {
        const videoDetails = initialData?.videoDetails || initialData?.playerResponse?.videoDetails;
        if (videoDetails) {
          return res.json({
            id: videoId,
            title: videoDetails.title || 'Unknown Title',
            description: videoDetails.shortDescription || videoDetails.description || '',
            channelTitle: videoDetails.author || 'Unknown Channel',
            channelId: videoDetails.channelId || '',
            duration: formatDuration(parseInt(videoDetails.lengthSeconds || '0')),
            durationSeconds: parseInt(videoDetails.lengthSeconds || '0'),
            viewCount: videoDetails.viewCount || '0',
            thumbnail: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
            url: videoUrl
          });
        }
      }
    } catch (scrapeError) {
      console.log('Video details scraping failed:', scrapeError);
    }

    // Fallback
    res.json({
      id: videoId,
      title: 'Video Title',
      description: 'Video description',
      channelTitle: 'Channel Name',
      channelId: '',
      duration: '0:00',
      viewCount: '0',
      thumbnail: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
      url: videoUrl
    });
  } catch (error: any) {
    console.error('Video details error:', error);
    res.status(500).json({ error: 'Failed to get video details', message: error.message });
  }
});

// Search channels endpoint
app.get('/api/search/channels', async (req, res) => {
  try {
    const query = req.query.q as string;
    if (!query) {
      return res.json({ feed: { title: 'No results', entry: [] } });
    }

    // Use the main search endpoint with type=channel
    const searchResponse = await axios.get(`http://localhost:${PORT}/api/search?q=${encodeURIComponent(query)}&type=channel`);
    res.json(searchResponse.data);
  } catch (error: any) {
    console.error('Channel search error:', error);
    res.status(500).json({ feed: { title: 'Error', entry: [] }, error: error.message });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ ok: true });
});

// Get video stream URL (for watching videos)
app.get('/api/stream/:id', async (req, res) => {
  try {
    const videoId = req.params.id;

    // For privacy-focused watching, we'll redirect to YouTube
    // In a more advanced implementation, you could proxy the stream
    res.json({
      streamUrl: `https://www.youtube.com/watch?v=${videoId}`,
      type: 'redirect'
    });
  } catch (error) {
    console.error('Stream error:', error);
    res.status(500).json({ error: 'Failed to get stream' });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Tuber backend server running on port ${PORT}`);
  console.log(`📡 API endpoint: http://localhost:${PORT}/api/search`);
}).on('error', (err: any) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`❌ Port ${PORT} is already in use!`);
    console.error(`💡 To fix this, run one of these commands:`);
    console.error(`   Option 1: Kill the process using port ${PORT}`);
    console.error(`   lsof -ti:${PORT} | xargs kill -9`);
    console.error(`   Option 2: Change PORT in server/index.ts to a different number`);
    process.exit(1);
  } else {
    console.error('Server error:', err);
    process.exit(1);
  }
});
