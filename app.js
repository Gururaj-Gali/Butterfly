const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const selectButton = document.getElementById('selectButton');
const previewImage = document.getElementById('previewImage');
const placeholder = document.getElementById('placeholder');
const loader = document.getElementById('loader');
const predictionsList = document.getElementById('predictions');
const scanCount = document.getElementById('scanCount');
const historyList = document.getElementById('historyList');
const cameraButton = document.getElementById('cameraButton');
const cameraWrapper = document.getElementById('cameraWrapper');
const previewWrapper = document.getElementById('previewWrapper');
const cameraStreamEl = document.getElementById('cameraStream');
const snapButton = document.getElementById('snapButton');
const closeCamera = document.getElementById('closeCamera');
const speciesGrid = document.getElementById('speciesGrid');

let modelPromise;
let scans = 0;
let mediaStream;

const speciesInfo = [
  {
    name: 'Monarch',
    badge: 'Danaus plexippus',
    fact: 'Vivid orange wings with bold black veins. Famous for multi-generation migrations from Canada to Mexico.'
  },
  {
    name: 'Viceroy',
    badge: 'Limenitis archippus',
    fact: 'Mimics monarchs but has an extra black line on the hindwings. Prefers wetlands and willow groves.'
  },
  {
    name: 'Swallowtail',
    badge: 'Family Papilionidae',
    fact: 'Large butterflies with tail-like extensions on hindwings. Often yellow-and-black banded.'
  },
  {
    name: 'Painted Lady',
    badge: 'Vanessa cardui',
    fact: 'Orange, brown, and white with eye spots. One of the most cosmopolitan butterfly species.'
  },
  {
    name: 'Blue Morpho',
    badge: 'Morpho menelaus',
    fact: 'Brilliant iridescent blue dorsal wings. Native to Central and South American rainforests.'
  },
  {
    name: 'Admiral',
    badge: 'Vanessa atalanta',
    fact: 'Dark wings with red-orange band and white spots. Highly territorial and quick flyers.'
  }
];

function renderSpeciesCards() {
  speciesGrid.innerHTML = speciesInfo
    .map(
      ({ name, badge, fact }) => `
        <article class="species-card">
          <span class="badge">${badge}</span>
          <h4>${name}</h4>
          <p>${fact}</p>
        </article>`
    )
    .join('');
}

renderSpeciesCards();

function showLoader(show) {
  loader.classList.toggle('active', show);
  loader.setAttribute('aria-hidden', String(!show));
}

function setPreview(dataUrl) {
  previewImage.src = dataUrl;
  previewImage.style.display = 'block';
  placeholder.style.display = 'none';
}

function resetPreview() {
  previewImage.removeAttribute('src');
  previewImage.style.display = 'none';
  placeholder.style.display = 'block';
}

function updatePredictions(predictions) {
  if (!predictions.length) {
    predictionsList.innerHTML = '<li>Unable to recognize this butterfly. Try a clearer photo.</li>';
    return;
  }

  const markup = predictions
    .map(
      (p) => `
        <li>
          <span>${titleCase(p.className)}</span>
          <span class="confidence">${(p.probability * 100).toFixed(1)}%</span>
        </li>`
    )
    .join('');
  predictionsList.innerHTML = markup;
}

function titleCase(text = '') {
  return text
    .split(',')[0]
    .split(' ')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
    .trim();
}

function addHistoryEntry(predictions) {
  const best = predictions[0];
  if (!best) return;
  const item = document.createElement('li');
  const time = new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date());
  item.textContent = `${titleCase(best.className)} • ${time}`;
  historyList.prepend(item);
  while (historyList.children.length > 5) {
    historyList.removeChild(historyList.lastChild);
  }
}

async function getModel() {
  if (!modelPromise) {
    if (!window.mobilenet || typeof window.mobilenet.load !== 'function') {
      throw new Error('Mobilenet failed to load');
    }
    modelPromise = window.mobilenet.load({ version: 2, alpha: 1.0 });
  }
  return modelPromise;
}

async function classify(dataUrl) {
  showLoader(true);
  try {
    const net = await getModel();
    const img = await createImage(dataUrl);
    const predictions = await net.classify(img);
    updatePredictions(predictions);
    addHistoryEntry(predictions);
    scans += 1;
    scanCount.textContent = scans;
  } catch (error) {
    console.error(error);
    predictionsList.innerHTML = `<li>Something went wrong: ${error.message}</li>`;
  } finally {
    showLoader(false);
  }
}

function createImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not load image'));
    img.src = dataUrl;
  });
}

function handleFile(file) {
  if (!file) return;
  if (!file.type.startsWith('image/')) {
    predictionsList.innerHTML = '<li>Please upload a valid image file.</li>';
    return;
  }
  if (file.size > 10 * 1024 * 1024) {
    predictionsList.innerHTML = '<li>Image is too large. Keep it under 10 MB.</li>';
    return;
  }

  const reader = new FileReader();
  reader.onload = (event) => {
    const dataUrl = event.target?.result;
    if (typeof dataUrl === 'string') {
      setPreview(dataUrl);
      classify(dataUrl);
    }
  };
  reader.readAsDataURL(file);
}

selectButton.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', (event) => handleFile(event.target.files?.[0]));

['dragenter', 'dragover'].forEach((eventName) => {
  dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropZone.classList.add('dragging');
  });
});

['dragleave', 'drop'].forEach((eventName) => {
  dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropZone.classList.remove('dragging');
  });
});

dropZone.addEventListener('drop', (event) => {
  const file = event.dataTransfer?.files?.[0];
  handleFile(file);
});

async function openCamera() {
  if (!navigator.mediaDevices?.getUserMedia) {
    predictionsList.innerHTML = '<li>Your browser does not support camera capture.</li>';
    return;
  }
  try {
    mediaStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
    cameraStreamEl.srcObject = mediaStream;
    cameraWrapper.hidden = false;
    previewWrapper.hidden = true;
  } catch (error) {
    predictionsList.innerHTML = `<li>Camera error: ${error.message}</li>`;
  }
}

function closeCameraStream() {
  cameraWrapper.hidden = true;
  previewWrapper.hidden = false;
  if (mediaStream) {
    mediaStream.getTracks().forEach((track) => track.stop());
    mediaStream = null;
  }
}

function captureFrame() {
  if (!mediaStream) return;
  const track = mediaStream.getVideoTracks()[0];
  const settings = track.getSettings();
  const canvas = document.createElement('canvas');
  canvas.width = settings.width || 640;
  canvas.height = settings.height || 480;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(cameraStreamEl, 0, 0, canvas.width, canvas.height);
  const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
  setPreview(dataUrl);
  classify(dataUrl);
  closeCameraStream();
}

cameraButton.addEventListener('click', openCamera);
snapButton.addEventListener('click', captureFrame);
closeCamera.addEventListener('click', closeCameraStream);

window.addEventListener('beforeunload', closeCameraStream);
