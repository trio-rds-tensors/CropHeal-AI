document.addEventListener('DOMContentLoaded', () => {
  // Initialize icons
  lucide.createIcons();

  // Elements
  const views = {
    home: document.getElementById('home-view'),
    input: document.getElementById('input-view'),
    processing: document.getElementById('processing-view'),
    results: document.getElementById('results-view')
  };

  const images = {
    processing: document.getElementById('preview-img-processing'),
    results: document.getElementById('preview-img-results'),
    bg: document.getElementById('processing-bg')
  };

  // State
  let currentImage = null;

  // Navigation
  function switchView(viewName) {
    Object.values(views).forEach(view => {
      view.classList.remove('active');
      view.classList.add('hidden');
    });
    const targetView = views[viewName];
    targetView.classList.remove('hidden');
    targetView.classList.add('active');

    // Re-initialize icons if new nodes become visible
    lucide.createIcons();

    if (viewName === 'processing') {
      startProcessing();
    } else if (viewName === 'results') {
      showResults();
    }
  }

  // ---- Home View ----
  document.getElementById('start-btn').addEventListener('click', () => {
    switchView('input');
  });

  // ---- Input View ----
  const dropZone = document.getElementById('drop-zone');
  const fileInput = document.getElementById('file-input');
  const cameraInput = document.getElementById('camera-input');

  document.getElementById('browse-btn').addEventListener('click', () => fileInput.click());
  document.getElementById('camera-btn').addEventListener('click', () => cameraInput.click());
  document.getElementById('back-btn').addEventListener('click', () => switchView('home'));

  // Drag & Drop
  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, preventDefaults, false);
  });

  function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
  }

  ['dragenter', 'dragover'].forEach(eventName => {
    dropZone.addEventListener(eventName, () => dropZone.classList.add('drag-active'), false);
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, () => dropZone.classList.remove('drag-active'), false);
  });

  dropZone.addEventListener('drop', (e) => {
    const dt = e.dataTransfer;
    const files = dt.files;
    handleFile(files[0]);
  });

  fileInput.addEventListener('change', function () {
    handleFile(this.files[0]);
  });

  cameraInput.addEventListener('change', function () {
    handleFile(this.files[0]);
  });

  function handleFile(file) {
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      currentImage = reader.result;
      images.processing.src = currentImage;
      images.results.src = currentImage;
      images.bg.style.backgroundImage = `url(${currentImage})`;
      switchView('processing');
    };
  }

  // ---- Processing View ----
  const processingSteps = [
    "Extracting features...",
    "Running CropHeal AI model...",
    "Identifying pathogens..."
  ];
  let currentStep = 0;
  const stepTextElem = document.getElementById('processing-step');
  let processInterval;

  function startProcessing() {
    currentStep = 0;
    stepTextElem.textContent = processingSteps[currentStep];

    // Reset animation
    stepTextElem.classList.remove('animate-text-swap');
    void stepTextElem.offsetWidth;
    stepTextElem.classList.add('animate-text-swap');

    processInterval = setInterval(() => {
      currentStep++;
      if (currentStep >= processingSteps.length) {
        clearInterval(processInterval);
        setTimeout(() => switchView('results'), 1500);
      } else {
        stepTextElem.textContent = processingSteps[currentStep];
        stepTextElem.classList.remove('animate-text-swap');
        void stepTextElem.offsetWidth;
        stepTextElem.classList.add('animate-text-swap');
      }
    }, 1500);
  }

  // ---- Results View ----
  const mockResult = {
    disease: "Late Blight",
    confidence: 96,
    severity: "High",
    organic: [
      "Remove and destroy all infected plant parts immediately.",
      "Apply copper-based fungicides as a preventative measure.",
      "Ensure proper spacing between plants for good air circulation."
    ],
    chemical: [
      "Chlorothalonil (Bravo, Daconil) - Apply 1.5-2.0 pts/acre.",
      "Mancozeb (Dithane, Manzate) - Apply 1.5-2.0 lbs/acre.",
      "Apply every 7-10 days depending on weather conditions."
    ]
  };

  document.getElementById('reset-btn').addEventListener('click', () => {
    currentImage = null;
    fileInput.value = '';
    cameraInput.value = '';
    switchView('home');
  });

  function showResults() {
    // Populate Data
    document.getElementById('confidence-score').textContent = mockResult.confidence + '%';

    // Animate Bar
    setTimeout(() => {
      document.getElementById('confidence-bar').style.width = mockResult.confidence + '%';
    }, 500);

    document.getElementById('disease-name').textContent = mockResult.disease;

    // Severity Badge
    const severityBadge = document.getElementById('severity-badge');
    severityBadge.className = `severity-badge ${mockResult.severity}-risk`;
    document.getElementById('severity-text').textContent = mockResult.severity + ' Risk';

    // Build Tab Contents
    buildTabContent('content-organic', mockResult.organic, 'organic');
    buildTabContent('content-chemical', mockResult.chemical, 'chemical');

    // Initialize icons in newly built tab content
    lucide.createIcons();
  }

  function buildTabContent(containerId, items, type) {
    const container = document.getElementById(containerId);
    container.innerHTML = '';
    items.forEach((item, index) => {
      const div = document.createElement('div');
      div.className = 'tab-item';
      div.style.animationDelay = `${index * 0.1}s`;

      const iconClass = type === 'organic' ? 'tab-item-icon-organic' : 'tab-item-icon-chemical';

      div.innerHTML = `
        <div class="${iconClass}">
          <span class="tab-item-num">${index + 1}</span>
        </div>
        <p class="tab-item-text">${item}</p>
      `;
      container.appendChild(div);
    });
  }

  // Tabs logic
  const tabs = document.querySelectorAll('.tab-btn');
  const contents = document.querySelectorAll('.tab-content');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      const targetId = tab.getAttribute('data-target');
      contents.forEach(content => {
        if (content.id === targetId) {
          content.classList.remove('hidden');
          content.classList.add('active');
        } else {
          content.classList.remove('active');
          content.classList.add('hidden');
        }
      });
    });
  });
});
