// Reuse global Supabase client (initialised in supabaseClient.js)
const supabase = window.supabaseClient;

        // Popup functionality
        document.addEventListener('DOMContentLoaded', () => {
          const popup = document.getElementById('telegramPopup');
          const closeBtn = document.querySelector('.popup-close');
          popup.style.zIndex = '1000'; // Ensure popup is on top

          // Show popup on page load
          popup.style.display = 'flex';

          // Close popup when close button is clicked
          closeBtn.addEventListener('click', () => {
              popup.style.display = 'none';
          });

          // Close popup when clicking outside the popup content
          window.addEventListener('click', (event) => {
              if (event.target === popup) {
                  popup.style.display = 'none';
              }
          });
      });

var video = document.getElementById('video');
var controls = document.getElementById('controls');
var playpause = document.getElementById('playpause');
var iconPlay = document.getElementById('icon-play');
var iconPause = document.getElementById('icon-pause');
var settings = document.getElementById('settings');
var settingsMenu = document.getElementById('settingsMenu');
var closeSettings = document.getElementById('closeSettings');
var qualitySelect = document.getElementById('qualitySelect');
var speedSelect = document.getElementById('speedSelect');
var seek = document.getElementById('seek');
var current = document.getElementById('current');
var duration = document.getElementById('duration');
var fullscreen = document.getElementById('fullscreen');
var rewind = document.getElementById('rewind');
var forward = document.getElementById('forward');
var viewerCount = document.getElementById('viewerCount');
var loadingScreen = document.getElementById('loadingScreen');
var isUserInteracted = false;
var hls;

// ---- Watermark Visibility Control ----
var watermark = document.querySelector('.video-watermark');
if (watermark) {
  watermark.style.display = 'none'; // Hide watermark until video ready
}
// --------------------------------------

// Mobile detection function
function isMobileDevice() {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || 
         window.innerWidth <= 768 || 
         ('ontouchstart' in window);
}

// Function to initialize or update HLS player
function initializeHLS(videoSrc) {
if (hls) {
  hls.destroy();
  hls = null;
}

if (Hls.isSupported()) {
  updateLoadingText('Initializing Player...');
  
  hls = new Hls({
    maxBufferLength: 30,
    maxMaxBufferLength: 60,
    maxBufferSize: 60 * 1000 * 1000, // 60MB
    maxBufferHole: 0.5,
    lowLatencyMode: false,
    backBufferLength: 90,
    enableWorker: true,
    startLevel: -1, // Auto quality selection
    abrEwmaDefaultEstimate: 5000000, // 500kbps default bandwidth estimate
    abrBandWidthFactor: 1,
    abrBandWidthUpFactor: 0.7,
    maxFragLookUpTolerance: 0.25,
    capLevelToPlayerSize: false,
    fragLoadingMaxRetry: 6,
    levelLoadingMaxRetry: 6,
    startFragPrefetch: true,
    maxLoadingDelay: 4, // Maximum loading delay for the first fragment (in seconds)
    xhrSetup: function(xhr, url) {
      var mainUrl = videoSrc;
      var urlObj = new URL(mainUrl);
      var signature = urlObj.searchParams.get('Signature');
      var keyPairId = urlObj.searchParams.get('Key-Pair-Id');
      var policy = urlObj.searchParams.get('Policy');
      
      if (signature && keyPairId && policy) {
        var segmentUrl = new URL(url);
        segmentUrl.searchParams.set('Signature', signature);
        segmentUrl.searchParams.set('Key-Pair-Id', keyPairId);
        segmentUrl.searchParams.set('Policy', policy);
        xhr.open('GET', segmentUrl.toString(), true);
      }
    }
  });
  
  updateLoadingText('Loading Video...');
  hls.loadSource(videoSrc);
  hls.attachMedia(video);
  
  hls.on(Hls.Events.MANIFEST_LOADING, function() {
    updateLoadingText('Loading Stream Manifest...');
  });
  
  hls.on(Hls.Events.MANIFEST_PARSED, function() {
    updateLoadingText('Stream Ready!');
    controls.style.display = 'flex';
    setTimeout(hideLoading, 1000);
    var levels = hls.levels;
    const qualityOptions = document.getElementById('qualityOptions');
    qualityOptions.innerHTML = '';
    const autoOption = document.createElement('label');
    autoOption.className = 'option-item';
    autoOption.innerHTML = '<input type="radio" name="quality" value="auto" checked><span>Auto</span>';
    qualityOptions.appendChild(autoOption);
    for (var i = 0; i < levels.length; i++) {
      var level = levels[i];
      const label = document.createElement('label');
      label.className = 'option-item';
      label.innerHTML = `<input type="radio" name="quality" value="${i}"><span>${level.height}p</span>`;
      qualityOptions.appendChild(label);
    }
  });
  
  hls.on(Hls.Events.LEVEL_LOADING, function() {
    updateLoadingText('Loading Video Quality...');
  });
  
  hls.on(Hls.Events.LEVEL_LOADED, function() {
    updateLoadingText('Video Quality Loaded...');
  });
  
  hls.on(Hls.Events.FRAG_LOADING, function() {
    updateLoadingText('Loading Video Segment...');
  });
  
  hls.on(Hls.Events.ERROR, function(event, data) {
    if (data.fatal) {
      switch(data.type) {
        case Hls.ErrorTypes.NETWORK_ERROR:
          updateLoadingText('Network Error - Retrying...');
          const errorTimeout = setTimeout(() => {
            loadingScreen.innerHTML = '<div class="loading-spinner"></div><div class="loading-text">Live Ended</div>';
          }, 3000);
          hls.on(Hls.Events.LEVEL_LOADED, function() {
            clearTimeout(errorTimeout);
          });
          hls.startLoad();
          break;
        case Hls.ErrorTypes.MEDIA_ERROR:
          updateLoadingText('Media Error - Recovering...');
          hls.recoverMediaError();
          break;
        default:
          updateLoadingText('Error - Please Refresh Page');
          hls.destroy();
          break;
      }
    }
  });
} else if (video.canPlayType('application/vnd.apple.mpegurl')) {
  updateLoadingText('Loading Stream...');
  video.src = videoSrc;
  video.addEventListener('loadedmetadata', function() {
    updateLoadingText('Stream Ready!');
    controls.style.display = 'flex';
    setTimeout(hideLoading, 1000);
    duration.textContent = formatTime(video.duration);
  }, { once: true });
  video.addEventListener('error', function() {
    updateLoadingText('Error Loading Stream');
  });
} else {
  updateLoadingText('Browser Not Supported');
  document.write('<div class="error">Your browser does not support HLS playback.</div>');
}
}

// Listen for video source changes from Supabase
supabase
.channel('video_source')
.on(
  'postgres_changes',
  { event: 'UPDATE', schema: 'public', table: 'admin', filter: 'id=eq.videoSource' },
  (payload) => {
    const videoSrc = payload.new.url;
    initializeHLS(videoSrc);
  }
)
.subscribe();

// Video Live Toggle Function
function applyVideoLive(isLive) {
  const playerWrapper = document.querySelector('.player-wrapper');
  let placeholder = document.getElementById('no-live-placeholder');

  if (!isLive) {
    // Stop and destroy HLS stream completely
    if (hls) {
      hls.destroy();
      hls = null;
    }
    
    // Pause and clear video source
    if (video) {
      video.pause();
      video.src = '';
      video.load(); // Reset video element
    }
    
    // Hide loading screen if visible
    if (loadingScreen) {
      loadingScreen.style.display = 'none';
    }
    
    // Hide entire player wrapper (video container + controls)
    playerWrapper.style.display = 'none';
    
    // Create and show placeholder if it doesn't exist
    if (!placeholder) {
      placeholder = document.createElement('div');
      placeholder.id = 'no-live-placeholder';
      placeholder.style.cssText = `
        color: #87CEEB;
        text-align: center;
        padding: 20px;
        font-size: 1.5em;
        font-weight: bold;
      `;
      placeholder.textContent = 'No Live';
      
      // Insert placeholder after player wrapper
      playerWrapper.parentNode.insertBefore(placeholder, playerWrapper.nextSibling);
    } else {
      placeholder.style.display = 'block';
    }
  } else {
    // Show entire player wrapper (video container + controls)
    playerWrapper.style.display = '';
    
    // Hide placeholder
    if (placeholder) {
      placeholder.style.display = 'none';
    }
    
    // Restart video stream by fetching current video source
    (async () => {
      try {
        const { data, error } = await supabase
          .from('admin')
          .select('url')
          .eq('id', 'videoSource')
          .single();
          
        if (!error && data && data.url) {
          initializeHLS(data.url);
        }
      } catch (err) {
        console.error('Error restarting video:', err);
      }
    })();
  }
}

// Listen for video live status changes
supabase
.channel('video_live')
.on(
  'postgres_changes',
  { event: 'UPDATE', schema: 'public', table: 'admin', filter: 'id=eq.videoLive' },
  (payload) => {
    applyVideoLive(payload.new.enabled);
  }
)
.subscribe();

// Fetch initial video source
(async () => {
const { data, error } = await supabase
  .from('admin')
  .select('url')
  .eq('id', 'videoSource')
  .single();
if (error || !data) {
  const defaultUrl = "https://dga9kme080o0w.cloudfront.net/out/v1/5c7cfedca3df4fc99ea383b5f2e6a7a8/index.m3u8";
  initializeHLS(defaultUrl);
} else {
  initializeHLS(data.url);
}
})();

// Fetch initial video live status
(async () => {
const { data, error } = await supabase
  .from('admin')
  .select('enabled')
  .eq('id', 'videoLive')
  .single();
if (error && error.code !== 'PGRST116') {
  console.error('Error fetching video live status:', error);
  applyVideoLive(true); // Default to live if error
} else {
  applyVideoLive(data?.enabled ?? true); // Default to live if no data
}
})();

// Hide loading screen
function hideLoading() {
  loadingScreen.style.opacity = '0';
  setTimeout(function () {
    loadingScreen.style.display = 'none';
    // Show watermark once loading screen is gone
    if (watermark) watermark.style.display = 'block';
  }, 500);
}

// Show loading screen
function showLoading() {
  loadingScreen.style.display = 'flex';
  loadingScreen.style.opacity = '1';
  // Keep watermark hidden while loading
  if (watermark) watermark.style.display = 'none';
}

// Update loading text
function updateLoadingText(text) {
var loadingText = loadingScreen.querySelector('.loading-text');
loadingText.textContent = text;
}

// Hide default controls
video.controls = false;
video.preload = 'metadata';
video.playsInline = true;
video.autoplay = false;

// Telegram in-app browser: require user gesture to start
function userStart() {
if (!isUserInteracted) {
  video.play().then(function() {
  }).catch(function(error) {
  });
  isUserInteracted = true;
}
}
video.addEventListener('click', userStart);
controls.addEventListener('click', userStart);

// Play/Pause
playpause.onclick = function() {
if (video.paused) {
  video.play().then(function() {
  }).catch(function(error) {
  });
} else {
  video.pause();
}
};
video.addEventListener('play', function() {
iconPlay.style.display = 'none';
iconPause.style.display = '';
});
video.addEventListener('pause', function() {
iconPlay.style.display = '';
iconPause.style.display = 'none';
});

// Rewind/Forward functionality
rewind.onclick = function() {
video.currentTime = Math.max(0, video.currentTime - 10);
};

forward.onclick = function() {
video.currentTime = Math.min(video.duration || Infinity, video.currentTime + 10);
};

// Fullscreen with Telegram support
fullscreen.onclick = function() {
if (document.fullscreenElement) {
  exitFullscreen();
} else {
  enterFullscreen();
}
};

function enterFullscreen() {
var videoContainer = document.querySelector('.video-container');

if (video.requestFullscreen) {
  video.requestFullscreen();
} else if (video.webkitRequestFullscreen) {
  video.webkitRequestFullscreen();
} else if (video.mozRequestFullScreen) {
  video.mozRequestFullScreen();
} else if (video.msRequestFullscreen) {
  video.msRequestFullscreen();
} else {
  togglePseudoFullscreen();
}

if (screen.orientation && screen.orientation.lock) {
  screen.orientation.lock('landscape').catch(err => {
    console.warn("Could not lock screen orientation:", err);
  });
}
}

function exitFullscreen() {
if (document.exitFullscreen) {
  document.exitFullscreen();
} else if (document.webkitExitFullscreen) {
  document.webkitExitFullscreen();
} else if (document.mozCancelFullScreen) {
  document.mozCancelFullScreen();
} else if (document.msExitFullscreen) {
  document.msExitFullscreen();
} else {
  togglePseudoFullscreen();
}

if (screen.orientation && screen.orientation.unlock) {
  screen.orientation.unlock();
}
}

function togglePseudoFullscreen() {
var videoContainer = document.querySelector('.video-container');

if (videoContainer.classList.contains('pseudo-fullscreen')) {
  videoContainer.classList.remove('pseudo-fullscreen');
  document.body.classList.remove('fullscreen-active');
  controls.style.display = 'flex';
} else {
  videoContainer.classList.add('pseudo-fullscreen');
  document.body.classList.add('fullscreen-active');
  controls.style.display = 'flex';
}
}

document.addEventListener('fullscreenchange', handleFullscreenChange);
document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
document.addEventListener('mozfullscreenchange', handleFullscreenChange);
document.addEventListener('MSFullscreenChange', handleFullscreenChange);

function handleFullscreenChange() {
var isFullscreen = !!(document.fullscreenElement || document.webkitFullscreenElement || 
                      document.mozFullScreenElement || document.msFullscreenElement);

if (isFullscreen) {
  document.body.classList.add('fullscreen-active');
} else {
  document.body.classList.remove('fullscreen-active');
  document.querySelector('.video-container').classList.remove('pseudo-fullscreen');
}
}

// Format time helper
function formatTime(sec) {
if (isNaN(sec) || !isFinite(sec)) return '00:00';
var m = Math.floor(sec / 60);
var s = Math.floor(sec % 60);
return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
}

// Set initial state
iconPlay.style.display = '';
iconPause.style.display = 'none';

// Settings functionality
settings.onclick = function(e) {
  e.stopPropagation();
  if (settingsMenu.style.display === 'block') {
    // When closing, reset submenus
    document.querySelectorAll('.settings-submenu.expanded').forEach(menu => {
      menu.classList.remove('expanded');
      menu.style.display = 'none';
    });
    settingsMenu.style.display = 'none';
  } else {
    // When opening, ensure only main menu shows
    settingsMenu.style.display = 'block';
    document.getElementById('settingsMain').style.display = 'block';
    document.querySelectorAll('.settings-submenu').forEach(menu => {
      menu.classList.remove('expanded');
      menu.style.display = 'none';
    });
  }
};

closeSettings.onclick = function(e) {
e.stopPropagation();
settingsMenu.style.display = 'none';
};

document.addEventListener('click', function(e) {
if (settingsMenu.style.display === 'block' && 
    !settingsMenu.contains(e.target) && 
    e.target !== settings) {
  settingsMenu.style.display = 'none';
}
});

document.querySelectorAll('.menu-btn').forEach(btn => {
btn.addEventListener('click', function(e) {
  e.stopPropagation();
  const targetMenu = document.getElementById(this.dataset.target);
  document.getElementById('settingsMain').style.display = 'none';
  targetMenu.style.display = 'block';
  setTimeout(() => targetMenu.classList.add('expanded'), 0);
});
});

document.querySelectorAll('.submenu-header[data-action="back"]').forEach(btn => {
btn.addEventListener('click', function(e) {
  e.stopPropagation();
  const submenu = btn.closest('.settings-submenu');
  submenu.classList.remove('expanded');
  setTimeout(() => {
    submenu.style.display = 'none';
    document.getElementById('settingsMain').style.display = 'block';
  }, 300);
});
});

function updateMenuButton(menuId, value) {
const menuBtn = document.querySelector(`[data-target="${menuId}"]`);
if (menuBtn) {
  menuBtn.querySelector('.current-value').textContent = value;
  menuBtn.dataset.current = value;
}
}

document.getElementById('qualityOptions').addEventListener('click', function(e) {
e.stopPropagation();
const radio = e.target.closest('.option-item')?.querySelector('input[type="radio"]');
if (radio && hls) {
  radio.checked = true;
  const value = radio.value === 'auto' ? 'Auto' : `${hls.levels[parseInt(radio.value)].height}p`;
  if (radio.value !== 'auto') {
    hls.currentLevel = parseInt(radio.value);
  } else {
    hls.currentLevel = -1;
  }
  updateMenuButton('qualityMenu', value);
  document.getElementById('qualityMenu').classList.remove('expanded');
  setTimeout(() => {
    document.getElementById('qualityMenu').style.display = 'none';
    document.getElementById('settingsMain').style.display = 'block';
  }, 300);
}
});

document.getElementById('speedOptions').addEventListener('click', function(e) {
e.stopPropagation();
const radio = e.target.closest('.option-item')?.querySelector('input[type="radio"]');
if (radio) {
  radio.checked = true;
  const value = radio.value === '1' ? 'Normal' : `${radio.value}x`;
  video.playbackRate = parseFloat(radio.value);
  updateMenuButton('speedMenu', value);
  document.getElementById('speedMenu').classList.remove('expanded');
  setTimeout(() => {
    document.getElementById('speedMenu').style.display = 'none';
    document.getElementById('settingsMain').style.display = 'block';
  }, 300);
}
});

video.addEventListener('loadedmetadata', function() {
  duration.textContent = formatTime(video.duration);
}, { once: true });

video.addEventListener('timeupdate', function() {
  if (video.duration && isFinite(video.duration)) {
    const percent = (video.currentTime / video.duration) * 100;
    seek.value = percent;
    seek.style.backgroundSize = percent + '% 100%';
    current.textContent = formatTime(video.currentTime);
    duration.textContent = formatTime(video.duration);
  } else {
    seek.value = 0;
    current.textContent = '00:00';
  }
});

video.addEventListener('durationchange', function() {
  duration.textContent = formatTime(video.duration);
});

seek.oninput = function() {
if (video.duration && isFinite(video.duration)) {
  video.currentTime = (seek.value / 100) * video.duration;
  seek.style.backgroundSize = seek.value + '% 100%';
}
};

/* ---------------- Fullscreen Compatibility Helper ---------------- */
(() => {
  const fsBtn = document.getElementById('fullscreen');
  if (!fsBtn) return; // No button – bail out

  // After the existing onclick runs, we check if the browser actually entered
  // fullscreen. If not, we retry with alternative APIs.
  fsBtn.addEventListener('click', () => {
    // Let the original handler run first
    setTimeout(() => {
      const inFs = document.fullscreenElement || document.webkitFullscreenElement ||
                   document.mozFullScreenElement || document.msFullscreenElement;
      const vid = document.getElementById('video');
      const container = document.querySelector('.video-container');

      if (inFs || !vid) return; // Success already, or no video element

      // 1) Try container.requestFullscreen (works on some Android browsers)
      if (container && container.requestFullscreen) {
        container.requestFullscreen().catch(() => {});
        if (document.fullscreenElement) return;
      }

      // 2) Try iOS Safari specific call
      if (vid && vid.webkitEnterFullscreen) {
        try {
          vid.webkitEnterFullscreen();
          return;
        } catch (err) {
          // Ignore and fallback
        }
      }

      // 3) Fallback: pseudo-fullscreen class toggle
      if (container && !container.classList.contains('pseudo-fullscreen')) {
        container.classList.add('pseudo-fullscreen');
        document.body.classList.add('fullscreen-active');
      }
    }, 150); // Slight delay to allow native promise rejection, if any
  });
})();
// ---------------- End Fullscreen Compatibility Helper ----------------