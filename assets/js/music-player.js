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

  const style = document.createElement('style');
  style.textContent = `
    .terminal-player {
      position: fixed;
      right: max(1rem, env(safe-area-inset-right));
      bottom: max(1rem, env(safe-area-inset-bottom));
      z-index: 1000;
      width: min(390px, calc(100vw - 2rem));
      border: 1px solid rgba(126,231,135,.46);
      background: rgba(7,9,10,.94);
      color: #f2f2f2;
      box-shadow: 0 14px 50px rgba(0,0,0,.42), inset 0 0 30px rgba(126,231,135,.025);
      backdrop-filter: blur(14px);
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      font-size: 12px;
      line-height: 1.35;
    }
    .terminal-player * { box-sizing: border-box; }
    .terminal-player__bar {
      display: grid;
      grid-template-columns: auto 1fr auto;
      align-items: center;
      gap: .65rem;
      padding: .55rem .7rem;
      border-bottom: 1px solid #2a2e35;
      background: rgba(126,231,135,.035);
    }
    .terminal-player__prompt { color: #7ee787; font-weight: 700; }
    .terminal-player__status { color: #79c0ff; font-size: 10px; letter-spacing: .08em; }
    .terminal-player button {
      appearance: none;
      border: 0;
      padding: .25rem .32rem;
      background: transparent;
      color: #a8adb5;
      font: inherit;
      cursor: pointer;
    }
    .terminal-player button:hover,
    .terminal-player button:focus-visible { color: #7ee787; outline: 1px solid rgba(126,231,135,.55); outline-offset: 1px; }
    .terminal-player__body { padding: .75rem; }
    .terminal-player__track { display: grid; grid-template-columns: auto 1fr; gap: .14rem .65rem; align-items: baseline; }
    .terminal-player__label { grid-row: 1 / span 2; color: #8b949e; font-size: 9px; letter-spacing: .08em; writing-mode: vertical-rl; transform: rotate(180deg); }
    .terminal-player__title { color: #f2cc60; font-weight: 700; text-decoration: none; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .terminal-player__title:hover, .terminal-player__title:focus-visible { color: #7ee787; text-decoration: underline; text-underline-offset: 2px; }
    .terminal-player__artist { color: #a8adb5; font-size: 10px; }
    .terminal-player__controls { display: flex; align-items: center; justify-content: center; gap: .55rem; margin: .65rem 0 .45rem; }
    .terminal-player__controls [data-action="play"] { color: #7ee787; min-width: 70px; }
    .terminal-player__timeline { display: grid; grid-template-columns: 42px 1fr 42px; gap: .55rem; align-items: center; color: #8b949e; }
    .terminal-player input[type="range"] { width: 100%; accent-color: #7ee787; cursor: pointer; }
    .terminal-player__duration { text-align: right; }
    .terminal-player__volume-row { display: grid; grid-template-columns: auto 100px 1fr; gap: .45rem; align-items: center; margin-top: .45rem; }
    .terminal-player__credit { color: #79c0ff; text-align: right; font-size: 9px; }
    .terminal-player__notice { margin: .55rem 0 0; padding-top: .45rem; border-top: 1px dashed #2a2e35; color: #6e7681; font-size: 9px; }
    .terminal-player--collapsed { width: 220px; }
    .terminal-player--collapsed .terminal-player__body { display: none; }
    .terminal-player--collapsed .terminal-player__bar { border-bottom: 0; }
    .terminal-player--error { border-color: rgba(255,123,114,.72); }
    .terminal-player--error .terminal-player__status { color: #ff7b72; }
    @media (max-width: 520px) {
      .terminal-player { right: .65rem; bottom: .65rem; width: calc(100vw - 1.3rem); }
      .terminal-player__notice { display: none; }
      .terminal-player__volume-row { grid-template-columns: auto 90px 1fr; }
    }
    @media (prefers-reduced-motion: reduce) {
      .terminal-player * { scroll-behavior: auto !important; transition: none !important; }
    }
  `;
  document.head.appendChild(style);

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