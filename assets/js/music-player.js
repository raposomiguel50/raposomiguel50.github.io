(() => {
  'use strict';

  const STORAGE_KEY = 'mgdl-music-player-v1';
  const tracks = [
    {
      title: 'Inferno Protocol',
      artist: 'Psychronic',
      durationLabel: '4:00',
      source: 'https://pixabay.com/music/download/id-234864.mp3',
      page: 'https://pixabay.com/music/techno-trance-inferno-protocol-234864/'
    },
    {
      title: 'Neon Nemesis',
      artist: 'Psychronic',
      durationLabel: '1:15',
      source: 'https://pixabay.com/music/download/id-236981.mp3',
      page: 'https://pixabay.com/music/techno-trance-neon-nemesis-236981/'
    }
  ];

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

  function readState() {
    const fallback = { track: 0, volume: 0.28, muted: false, time: 0, wantedPlaying: false };
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      return {
        track: Number.isInteger(stored.track) ? clamp(stored.track, 0, tracks.length - 1) : fallback.track,
        volume: Number.isFinite(stored.volume) ? clamp(stored.volume, 0, 1) : fallback.volume,
        muted: Boolean(stored.muted),
        time: Number.isFinite(stored.time) && stored.time >= 0 ? stored.time : fallback.time,
        wantedPlaying: Boolean(stored.wantedPlaying)
      };
    } catch (_) {
      return fallback;
    }
  }

  const state = readState();
  let lastSavedSecond = -1;
  let sourceFailed = false;

  const shell = document.createElement('aside');
  shell.className = 'terminal-player';
  shell.setAttribute('aria-label', 'Background music player');
  shell.innerHTML = `
    <div class="terminal-player__bar">
      <span class="terminal-player__prompt" aria-hidden="true">audio&gt;</span>
      <span class="terminal-player__status">READY</span>
      <button class="terminal-player__collapse" type="button" aria-expanded="true" aria-label="Minimize music player">[-]</button>
    </div>
    <div class="terminal-player__body">
      <div class="terminal-player__track">
        <span class="terminal-player__label">NOW PLAYING</span>
        <a class="terminal-player__title" target="_blank" rel="noopener noreferrer"></a>
        <span class="terminal-player__artist"></span>
      </div>
      <div class="terminal-player__controls">
        <button type="button" data-action="prev" aria-label="Previous track">[&lt;&lt;]</button>
        <button type="button" data-action="play" aria-label="Play music">[PLAY]</button>
        <button type="button" data-action="next" aria-label="Next track">[&gt;&gt;]</button>
      </div>
      <div class="terminal-player__timeline">
        <span class="terminal-player__time">00:00</span>
        <input class="terminal-player__seek" type="range" min="0" max="100" value="0" step="0.1" aria-label="Track position">
        <span class="terminal-player__duration">00:00</span>
      </div>
      <div class="terminal-player__volume-row">
        <button type="button" data-action="mute" aria-label="Mute music">[VOL]</button>
        <input class="terminal-player__volume" type="range" min="0" max="1" value="0.28" step="0.01" aria-label="Music volume">
        <span class="terminal-player__credit">Psychronic via Pixabay</span>
      </div>
      <p class="terminal-player__notice">Playback starts only after user interaction when required by the browser.</p>
    </div>`;

  const audio = document.createElement('audio');
  audio.preload = 'metadata';
  shell.appendChild(audio);
  document.body.appendChild(shell);

  const statusEl = shell.querySelector('.terminal-player__status');
  const titleEl = shell.querySelector('.terminal-player__title');
  const artistEl = shell.querySelector('.terminal-player__artist');
  const playButton = shell.querySelector('[data-action="play"]');
  const muteButton = shell.querySelector('[data-action="mute"]');
  const prevButton = shell.querySelector('[data-action="prev"]');
  const nextButton = shell.querySelector('[data-action="next"]');
  const collapseButton = shell.querySelector('.terminal-player__collapse');
  const seek = shell.querySelector('.terminal-player__seek');
  const volume = shell.querySelector('.terminal-player__volume');
  const currentTimeEl = shell.querySelector('.terminal-player__time');
  const durationEl = shell.querySelector('.terminal-player__duration');

  function formatTime(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) return '00:00';
    const whole = Math.floor(seconds);
    const mins = Math.floor(whole / 60);
    const secs = whole % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }

  function persist(extra = {}) {
    const snapshot = {
      track: state.track,
      volume: audio.volume,
      muted: audio.muted,
      time: Number.isFinite(audio.currentTime) ? audio.currentTime : 0,
      wantedPlaying: !audio.paused,
      ...extra
    };
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot)); } catch (_) {}
  }

  function updateTransport() {
    playButton.textContent = audio.paused ? '[PLAY]' : '[PAUSE]';
    playButton.setAttribute('aria-label', audio.paused ? 'Play music' : 'Pause music');
    muteButton.textContent = audio.muted || audio.volume === 0 ? '[MUTE]' : '[VOL]';
    statusEl.textContent = sourceFailed ? 'SOURCE ERROR' : (audio.paused ? 'PAUSED' : 'PLAYING');
  }

  function updateTimeline() {
    const duration = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : 0;
    currentTimeEl.textContent = formatTime(audio.currentTime);
    durationEl.textContent = duration ? formatTime(duration) : tracks[state.track].durationLabel;
    seek.value = duration ? String((audio.currentTime / duration) * 100) : '0';
  }

  function loadTrack(index, options = {}) {
    state.track = (index + tracks.length) % tracks.length;
    const track = tracks[state.track];
    sourceFailed = false;
    titleEl.textContent = track.title;
    titleEl.href = track.page;
    artistEl.textContent = `${track.artist} / Pixabay`;
    durationEl.textContent = track.durationLabel;
    statusEl.textContent = 'LOADING';
    audio.src = track.source;
    audio.load();

    const resumeAt = Number.isFinite(options.resumeAt) ? Math.max(0, options.resumeAt) : 0;
    const shouldPlay = Boolean(options.play);
    const onceLoaded = () => {
      if (resumeAt && Number.isFinite(audio.duration)) {
        audio.currentTime = Math.min(resumeAt, Math.max(0, audio.duration - 0.25));
      }
      updateTimeline();
      if (shouldPlay) requestPlay(); else updateTransport();
    };
    audio.addEventListener('loadedmetadata', onceLoaded, { once: true });
    persist({ time: resumeAt, wantedPlaying: shouldPlay });
  }

  async function requestPlay() {
    sourceFailed = false;
    statusEl.textContent = 'STARTING';
    try {
      await audio.play();
      updateTransport();
      persist({ wantedPlaying: true });
    } catch (_) {
      statusEl.textContent = 'PRESS PLAY';
      playButton.textContent = '[PLAY]';
      persist({ wantedPlaying: false });
    }
  }

  playButton.addEventListener('click', () => {
    if (audio.paused) requestPlay();
    else {
      audio.pause();
      updateTransport();
      persist({ wantedPlaying: false });
    }
  });

  prevButton.addEventListener('click', () => loadTrack(state.track - 1, { play: !audio.paused }));
  nextButton.addEventListener('click', () => loadTrack(state.track + 1, { play: !audio.paused }));

  volume.value = String(state.volume);
  audio.volume = state.volume;
  audio.muted = state.muted;

  volume.addEventListener('input', () => {
    audio.volume = clamp(Number(volume.value), 0, 1);
    if (audio.volume > 0 && audio.muted) audio.muted = false;
    updateTransport();
    persist();
  });

  muteButton.addEventListener('click', () => {
    audio.muted = !audio.muted;
    updateTransport();
    persist();
  });

  seek.addEventListener('input', () => {
    if (!Number.isFinite(audio.duration) || audio.duration <= 0) return;
    audio.currentTime = (Number(seek.value) / 100) * audio.duration;
    updateTimeline();
    persist();
  });

  collapseButton.addEventListener('click', () => {
    const collapsed = shell.classList.toggle('terminal-player--collapsed');
    collapseButton.textContent = collapsed ? '[+]' : '[-]';
    collapseButton.setAttribute('aria-expanded', String(!collapsed));
    collapseButton.setAttribute('aria-label', collapsed ? 'Expand music player' : 'Minimize music player');
  });

  audio.addEventListener('play', updateTransport);
  audio.addEventListener('pause', updateTransport);
  audio.addEventListener('timeupdate', () => {
    updateTimeline();
    const second = Math.floor(audio.currentTime || 0);
    if (second !== lastSavedSecond && second % 5 === 0) {
      lastSavedSecond = second;
      persist();
    }
  });
  audio.addEventListener('ended', () => loadTrack(state.track + 1, { play: true }));
  audio.addEventListener('error', () => {
    sourceFailed = true;
    statusEl.textContent = 'SOURCE ERROR';
    playButton.textContent = '[PLAY]';
    shell.classList.add('terminal-player--error');
    persist({ wantedPlaying: false });
  });
  audio.addEventListener('canplay', () => {
    sourceFailed = false;
    shell.classList.remove('terminal-player--error');
    updateTransport();
  });

  window.addEventListener('pagehide', () => persist());

  loadTrack(state.track, { resumeAt: state.time, play: false });
  updateTransport();
})();