const canvas = document.querySelector('#visualizer');
const ctx = canvas.getContext('2d');
const piano = document.querySelector('#piano');
const playButton = document.querySelector('#playButton');
const timeline = document.querySelector('#timeline');
const volumeInput = document.querySelector('#volume');
const tempoInput = document.querySelector('#tempo');
const tempoValue = document.querySelector('#tempoValue');
const metronomeButton = document.querySelector('#metronomeButton');
const midiLibrary = document.querySelector('#midiLibrary');
const titleElement = document.querySelector('#songTitle');
const emptyState = document.querySelector('#emptyState');
const soundStatus = document.querySelector('#soundStatus');
const toast = document.querySelector('#toast');

const COLORS = ['#ff7a4d', '#ffb85f', '#fa6e9e', '#9b7aff', '#55c9c0', '#ef8d88'];
const KEYBOARD = {
  y: 48, s: 49, x: 50, d: 51, c: 52, v: 53, g: 54, b: 55, h: 56, n: 57, j: 58, m: 59, ',': 60,
  q: 60, '2': 61, w: 62, '3': 63, e: 64, r: 65, '5': 66, t: 67, '6': 68, z: 69, '7': 70, u: 71, i: 72
};
const BLACK = new Set([1, 3, 6, 8, 10]);
let audioContext;
let instrument;
let notes = [];
let duration = 24;
let sourceBpm = 120;
let currentTime = 0;
let startedAt = 0;
let playing = false;
let scheduled = [];
let metronomeEnabled = false;
let metronomeTimer;
let nextMetronomeBeat = 0;
let metronomeGeneration = 0;
const metronomeSounds = new Set();
const held = new Map();
const pointerNotes = new Map();
const noteGeometry = new Map();
const arrivingNotes = new Map();
let noteGeometryDirty = true;

function demoNotes() {
  const progression = [[48,55,60,64], [45,52,57,60], [41,48,53,57], [43,50,55,59]];
  const result = [];
  progression.forEach((chord, bar) => {
    chord.forEach((midi, i) => result.push({ midi, time: bar * 4, duration: i ? 3.4 : 3.8, velocity: .46 + i*.05, track: i }));
    [0, .75, 1.5, 2.25, 3].forEach((offset, i) => result.push({ midi: chord[(i+1)%chord.length] + 12, time: bar*4+offset, duration: .38, velocity: .6, track: 4 }));
  });
  return result;
}
notes = demoNotes();
duration = 16;

function setupPiano() {
  piano.innerHTML = '';
  const min = 36, max = 84;
  const whites = [];
  for (let midi = min; midi <= max; midi++) {
    if (!BLACK.has(midi % 12)) {
      const key = document.createElement('button');
      key.className = 'key'; key.dataset.note = midi;
      key.dataset.key = Object.keys(KEYBOARD).find(k => KEYBOARD[k] === midi)?.toUpperCase() || '';
      key.setAttribute('aria-label', `MIDI-Note ${midi}`);
      key.appendChild(Object.assign(document.createElement('span'), { className: 'note-arrival', ariaHidden: 'true' }));
      piano.appendChild(key); whites.push(midi);
    }
  }
  for (let midi = min; midi <= max; midi++) {
    if (BLACK.has(midi % 12)) {
      const lowerWhites = whites.filter(n => n < midi).length;
      const key = document.createElement('button');
      key.className = 'key black'; key.dataset.note = midi;
      key.dataset.key = Object.keys(KEYBOARD).find(k => KEYBOARD[k] === midi)?.toUpperCase() || '';
      key.style.left = `${lowerWhites / whites.length * 100}%`;
      key.setAttribute('aria-label', `MIDI-Note ${midi}`);
      key.appendChild(Object.assign(document.createElement('span'), { className: 'note-arrival', ariaHidden: 'true' }));
      piano.appendChild(key);
    }
  }
  piano.addEventListener('pointerdown', handlePointerDown);
  piano.addEventListener('pointermove', handlePointerMove);
  piano.addEventListener('pointerup', handlePointerEnd);
  piano.addEventListener('pointercancel', handlePointerEnd);
  piano.addEventListener('lostpointercapture', handlePointerEnd);
  noteGeometryDirty = true;
}

function pointerKeyAt(x, y) {
  const key = document.elementFromPoint(x, y)?.closest('.key');
  return key && piano.contains(key) ? key : null;
}

function handlePointerDown(event) {
  const key = event.target.closest('.key');
  if (!key) return;
  event.preventDefault();
  piano.setPointerCapture?.(event.pointerId);
  const id = `pointer-${event.pointerId}`;
  const midi = +key.dataset.note;
  pointerNotes.set(event.pointerId, midi);
  pressNote(midi, id);
}

function handlePointerMove(event) {
  if (!pointerNotes.has(event.pointerId)) return;
  event.preventDefault();
  const key = pointerKeyAt(event.clientX, event.clientY);
  const nextMidi = key ? +key.dataset.note : null;
  const previousMidi = pointerNotes.get(event.pointerId);
  if (nextMidi === previousMidi) return;
  const id = `pointer-${event.pointerId}`;
  releaseNote(id);
  if (nextMidi === null) pointerNotes.set(event.pointerId, null);
  else {
    pointerNotes.set(event.pointerId, nextMidi);
    pressNote(nextMidi, id);
  }
}

function handlePointerEnd(event) {
  if (!pointerNotes.has(event.pointerId)) return;
  event.preventDefault();
  releaseNote(`pointer-${event.pointerId}`);
  pointerNotes.delete(event.pointerId);
}

function updateNoteGeometry() {
  const canvasRect = canvas.getBoundingClientRect();
  noteGeometry.clear();
  piano.querySelectorAll('.key').forEach(key => {
    const keyRect = key.getBoundingClientRect();
    noteGeometry.set(+key.dataset.note, {
      center: keyRect.left - canvasRect.left + keyRect.width / 2,
      width: keyRect.width * .9
    });
  });
  noteGeometryDirty = false;
}

function playbackRate() { return +tempoInput.value / sourceBpm; }

function decodeBase64Midi(value) {
  const binary = atob(value.replace(/\s/g, ''));
  return Uint8Array.from(binary, character => character.charCodeAt(0)).buffer;
}

async function loadMidi(source, name, encoding) {
  try {
    let buffer = source;
    if (!(source instanceof ArrayBuffer)) {
      const response = await fetch(source);
      if (!response.ok) throw new Error('MIDI konnte nicht geladen werden');
      buffer = encoding === 'base64'
        ? decodeBase64Midi(await response.text())
        : await response.arrayBuffer();
    }
    const parsed = parseMidi(buffer);
    notes = parsed.notes;
    sourceBpm = parsed.bpm;
    tempoInput.value = Math.round(sourceBpm);
    tempoValue.value = `${Math.round(sourceBpm)} BPM`;
    if (!notes.length) throw new Error('Keine Noten gefunden');
    duration = Math.max(...notes.map(n => n.time + n.duration)); currentTime = 0;
    titleElement.textContent = name.replace(/\.midi?$/i, ''); emptyState.classList.add('hidden');
    stopPlayback(); updateTransport(); showToast(`${notes.length} Noten geladen`);
  } catch (err) { showToast(err.message || 'MIDI konnte nicht geladen werden'); }
}

async function loadLibrary() {
  try {
    const response = await fetch('midi/manifest.json');
    const entries = await response.json();
    entries.forEach(entry => {
      const option = new Option(entry.title, `midi/${entry.file}`);
      option.dataset.encoding = entry.encoding || 'binary';
      midiLibrary.add(option);
    });
  } catch { midiLibrary.closest('.library-control').hidden = true; }
}

async function ensureAudio() {
  if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)();
  if (audioContext.state === 'suspended') await audioContext.resume();
  if (!instrument && window.Soundfont) {
    soundStatus.innerHTML = '<span></span> Piano wird geladen …';
    try {
      instrument = await window.Soundfont.instrument(audioContext, 'acoustic_grand_piano', { soundfont: 'MusyngKite', gain: +volumeInput.value });
      soundStatus.classList.add('ready'); soundStatus.innerHTML = '<span></span> Soundfont bereit';
    } catch { soundStatus.innerHTML = '<span></span> Synthesizer aktiv'; }
  }
  return audioContext;
}

async function playSound(midi, velocity=.7, length) {
  const ac = await ensureAudio();
  if (instrument) return instrument.play(midi, ac.currentTime, { gain: velocity * +volumeInput.value, duration: length });
  const osc = ac.createOscillator(), gain = ac.createGain();
  osc.type = 'triangle'; osc.frequency.value = 440 * 2 ** ((midi - 69) / 12);
  gain.gain.setValueAtTime(.0001, ac.currentTime); gain.gain.exponentialRampToValueAtTime(velocity * .18 * +volumeInput.value, ac.currentTime + .01);
  gain.gain.exponentialRampToValueAtTime(.0001, ac.currentTime + (length || 1.2));
  osc.connect(gain).connect(ac.destination); osc.start(); osc.stop(ac.currentTime + (length || 1.2));
  return { stop: () => { try { osc.stop(); } catch {} } };
}

function playMetronomeClick(when, accented) {
  if (!audioContext) return;
  const osc = audioContext.createOscillator();
  const gain = audioContext.createGain();
  osc.type = 'square';
  osc.frequency.setValueAtTime(accented ? 1320 : 880, when);
  gain.gain.setValueAtTime(.0001, when);
  gain.gain.exponentialRampToValueAtTime((accented ? .16 : .1) * +volumeInput.value, when + .002);
  gain.gain.exponentialRampToValueAtTime(.0001, when + .045);
  osc.connect(gain).connect(audioContext.destination);
  osc.start(when); osc.stop(when + .05);
  metronomeSounds.add(osc);
  osc.addEventListener('ended', () => metronomeSounds.delete(osc), { once: true });
}

function scheduleMetronome() {
  if (!playing || !metronomeEnabled || !audioContext) return;
  const rate = playbackRate();
  const beatDuration = 60 / sourceBpm;
  const songTime = (performance.now() - startedAt) / 1000 * rate;
  const horizon = songTime + .12 * rate;
  while (nextMetronomeBeat * beatDuration <= horizon) {
    const beatTime = nextMetronomeBeat * beatDuration;
    if (beatTime >= songTime - .01) {
      const delay = Math.max(0, (beatTime - songTime) / rate);
      const generation = metronomeGeneration;
      playMetronomeClick(audioContext.currentTime + delay, nextMetronomeBeat % 4 === 0);
      setTimeout(() => {
        if (!metronomeEnabled || !playing || generation !== metronomeGeneration) return;
        metronomeButton.classList.remove('beat');
        void metronomeButton.offsetWidth;
        metronomeButton.classList.add('beat');
      }, delay * 1000);
    }
    nextMetronomeBeat++;
  }
}

function stopMetronome() {
  metronomeGeneration++;
  clearInterval(metronomeTimer);
  metronomeTimer = undefined;
  metronomeButton.classList.remove('beat');
  metronomeSounds.forEach(sound => { try { sound.stop(); } catch {} });
  metronomeSounds.clear();
}

function startMetronome(time = currentTime) {
  stopMetronome();
  if (!metronomeEnabled || !playing) return;
  const beatDuration = 60 / sourceBpm;
  nextMetronomeBeat = Math.ceil((time - .01) / beatDuration);
  scheduleMetronome();
  metronomeTimer = setInterval(scheduleMetronome, 25);
}

async function toggleMetronome() {
  metronomeEnabled = !metronomeEnabled;
  metronomeButton.setAttribute('aria-pressed', metronomeEnabled);
  metronomeButton.setAttribute('aria-label', `Metronom ${metronomeEnabled ? 'ausschalten' : 'einschalten'}`);
  if (metronomeEnabled) {
    await ensureAudio();
    startMetronome();
  } else stopMetronome();
  showToast(`Metronom ${metronomeEnabled ? 'ein' : 'aus'}`);
}

async function pressNote(midi, id) {
  if (held.has(id)) return;
  const note = { midi, sound: null };
  held.set(id, note);
  document.querySelector(`.key[data-note="${midi}"]`)?.classList.add('active');
  const sound = await playSound(midi);
  if (held.get(id) === note) note.sound = sound;
  else sound?.stop?.();
}
function releaseNote(id) {
  const note = held.get(id); if (!note) return;
  note.sound?.stop?.(); held.delete(id);
  if (![...held.values()].some(n => n.midi === note.midi)) document.querySelector(`.key[data-note="${note.midi}"]`)?.classList.remove('active');
}

function readVar(view, state) { let value=0, byte; do { byte=view.getUint8(state.i++); value=(value<<7)+(byte&127); } while(byte&128); return value; }
function parseMidi(buffer) {
  const view = new DataView(buffer); const text = (pos,n) => String.fromCharCode(...new Uint8Array(buffer,pos,n));
  if (text(0,4) !== 'MThd') throw new Error('Keine gültige MIDI-Datei');
  const tracks = view.getUint16(10), division = view.getUint16(12); let pos = 8 + view.getUint32(4); const events=[]; let tempo=500000;
  for (let track=0; track<tracks; track++) {
    if (text(pos,4) !== 'MTrk') break; const end = pos + 8 + view.getUint32(pos+4); const state={i:pos+8}; let tick=0, status=0; const active={};
    while(state.i < end) {
      tick += readVar(view,state); let b=view.getUint8(state.i++); if(b<128) state.i--; else status=b;
      if(status===0xff) { const type=view.getUint8(state.i++), len=readVar(view,state); if(type===0x51 && len===3) tempo=(view.getUint8(state.i)<<16)|(view.getUint8(state.i+1)<<8)|view.getUint8(state.i+2); state.i+=len; continue; }
      if(status===0xf0 || status===0xf7) { state.i+=readVar(view,state); continue; }
      const command=status&0xf0, note=view.getUint8(state.i++), velocity=(command===0xc0||command===0xd0)?0:view.getUint8(state.i++);
      const key=`${status&15}-${note}`;
      if(command===0x90 && velocity) active[key]={tick,velocity};
      else if((command===0x80 || (command===0x90&&!velocity)) && active[key]) { const start=active[key]; events.push({midi:note,tick:start.tick,durationTicks:tick-start.tick,velocity:start.velocity/127,track}); delete active[key]; }
    } pos=end;
  }
  const secondsPerTick=tempo/1000000/division;
  return { notes: events.map(n => ({...n,time:n.tick*secondsPerTick,duration:Math.max(.08,n.durationTicks*secondsPerTick)})), bpm: 60000000/tempo };
}

document.querySelector('#midiInput').addEventListener('change', async e => {
  const file=e.target.files[0]; if(!file) return;
  await loadMidi(await file.arrayBuffer(), file.name);
});

async function togglePlay() {
  await ensureAudio();
  if (playing) { currentTime=(performance.now()-startedAt)/1000*playbackRate(); stopPlayback(); }
  else { if(currentTime>=duration-.05) currentTime=0; playing=true; startedAt=performance.now()-currentTime/playbackRate()*1000; playButton.innerHTML='<span>Ⅱ</span>'; scheduleFrom(currentTime); startMetronome(currentTime); }
}
function scheduleFrom(time) {
  scheduled.forEach(s=>s.stop?.()); scheduled=[];
  const rate=playbackRate();
  notes.filter(n=>n.time>=time).forEach(n => { const timer=setTimeout(async()=>scheduled.push(await playSound(n.midi,n.velocity,n.duration/rate)), (n.time-time)/rate*1000); scheduled.push({stop:()=>clearTimeout(timer)}); });
}
function stopPlayback() { playing=false; playButton.innerHTML='<span>▶</span>'; scheduled.forEach(s=>s.stop?.()); scheduled=[]; stopMetronome(); }
function seek(value) { currentTime=value*duration/1000; if(playing) { startedAt=performance.now()-currentTime/playbackRate()*1000; scheduleFrom(currentTime); startMetronome(currentTime); } updateTransport(); }
function formatTime(t) { return `${Math.floor(t/60)}:${String(Math.floor(t%60)).padStart(2,'0')}`; }
function updateTransport() { const rate=playbackRate(); timeline.value=duration?currentTime/duration*1000:0; document.querySelector('#currentTime').textContent=formatTime(currentTime/rate); document.querySelector('#duration').textContent=formatTime(duration/rate); }
function showToast(message) { toast.textContent=message; toast.classList.add('show'); clearTimeout(showToast.timer); showToast.timer=setTimeout(()=>toast.classList.remove('show'),2200); }

function updateArrivingNotes(time) {
  const next = new Map();
  notes.forEach(note => {
    if (note.time <= time && time < note.time + note.duration) {
      next.set(note.midi, COLORS[note.track % COLORS.length]);
    }
  });

  arrivingNotes.forEach((color, midi) => {
    if (!next.has(midi)) document.querySelector(`.key[data-note="${midi}"]`)?.classList.remove('incoming');
  });
  next.forEach((color, midi) => {
    if (arrivingNotes.get(midi) === color) return;
    const key = document.querySelector(`.key[data-note="${midi}"]`);
    if (!key) return;
    key.style.setProperty('--arrival-color', color);
    key.classList.add('incoming');
  });
  arrivingNotes.clear();
  next.forEach((color, midi) => arrivingNotes.set(midi, color));
}

function draw() {
  const dpr=Math.min(devicePixelRatio,2), rect=canvas.getBoundingClientRect();
  if(canvas.width!==rect.width*dpr || canvas.height!==rect.height*dpr) { canvas.width=rect.width*dpr; canvas.height=rect.height*dpr; noteGeometryDirty=true; }
  if(noteGeometryDirty) updateNoteGeometry();
  ctx.setTransform(dpr,0,0,dpr,0,0); const w=rect.width,h=rect.height,pianoH=innerWidth<720?90:112, hitY=h-pianoH;
  ctx.clearRect(0,0,w,h);
  if(playing) { currentTime=(performance.now()-startedAt)/1000*playbackRate(); if(currentTime>=duration){currentTime=duration;stopPlayback();} updateTransport(); }
  updateArrivingNotes(currentTime);
  const pxPerSec=105;
  notes.forEach(n => {
    const geometry=noteGeometry.get(n.midi); if(!geometry)return;
    const width=Math.max(5,geometry.width), x=geometry.center-width/2, y=hitY-(n.time-currentTime)*pxPerSec-n.duration*pxPerSec;
    const nh=Math.max(8,n.duration*pxPerSec); if(y>hitY||y+nh<0)return;
    const color=COLORS[n.track%COLORS.length]; ctx.shadowColor=color; ctx.shadowBlur=(y+nh>=hitY-5)?16:0; ctx.fillStyle=color; ctx.globalAlpha=.93;
    ctx.beginPath(); ctx.roundRect(x,y,width,nh,Math.min(7,width/2)); ctx.fill();
  });
  ctx.globalAlpha=1; ctx.shadowBlur=0; requestAnimationFrame(draw);
}

new ResizeObserver(() => { noteGeometryDirty=true; }).observe(piano);

playButton.addEventListener('click',togglePlay); timeline.addEventListener('input',e=>seek(+e.target.value));
metronomeButton.addEventListener('click', toggleMetronome);
midiLibrary.addEventListener('change', e => {
  if (!e.target.value) return;
  const option = e.target.selectedOptions[0];
  loadMidi(e.target.value, option.textContent, option.dataset.encoding);
});
tempoInput.addEventListener('input', () => {
  tempoValue.value=`${tempoInput.value} BPM`;
  if (playing) { startedAt=performance.now()-currentTime/playbackRate()*1000; scheduleFrom(currentTime); startMetronome(currentTime); }
  updateTransport();
});
document.querySelector('#restartButton').addEventListener('click',()=>seek(0));
document.querySelector('#helpButton').addEventListener('click',()=>document.querySelector('#helpDialog').showModal());
document.querySelector('#closeHelp').addEventListener('click',()=>document.querySelector('#helpDialog').close());
window.addEventListener('keydown',e=>{ if(e.repeat||e.target.matches('input'))return; const key=e.key.toLowerCase(); if(KEYBOARD[key]) pressNote(KEYBOARD[key],key); else if(e.code==='Space'){e.preventDefault();togglePlay();} else if(key==='r')seek(0); });
window.addEventListener('keyup',e=>releaseNote(e.key.toLowerCase()));
setupPiano(); loadLibrary(); updateTransport(); draw();
