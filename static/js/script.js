
document.addEventListener('DOMContentLoaded', () => {
  // ==================== INITIALIZE LUCIDE ICONS ====================
  lucide.createIcons();

  // ==================== PARTICLES.JS (optional but adds wow) ====================
  if (typeof particlesJS !== 'undefined') {
    particlesJS('particles-js', {
      particles: {
        number: { value: 40, density: { enable: true, value_area: 800 } },
        color: { value: '#10b981' },
        shape: { type: 'circle' },
        opacity: { value: 0.2, random: true },
        size: { value: 3, random: true },
        line_linked: { enable: true, distance: 150, color: '#10b981', opacity: 0.15, width: 1 },
        move: { enable: true, speed: 1, direction: 'none', random: true, straight: false, out_mode: 'out' }
      },
      interactivity: {
        detect_on: 'canvas',
        events: { onhover: { enable: true, mode: 'repulse' }, onclick: { enable: true, mode: 'push' } },
        modes: { repulse: { distance: 100, duration: 0.4 }, push: { particles_nb: 4 } }
      },
      retina_detect: true
    });
  }

  // ==================== DOM ELEMENTS ====================
  const views = {
    home: document.getElementById('home-view'),
    input: document.getElementById('input-view'),
    processing: document.getElementById('processing-view'),
    results: document.getElementById('results-view')
  };

  const images = {
    processing: document.getElementById('preview-img-processing'),
    results: document.getElementById('preview-img-results'),
    bg: document.getElementById('processing-bg'),
    thumbnail: document.getElementById('thumbnail-img')
  };

  const previewThumbnail = document.getElementById('preview-thumbnail');
  const clearPreviewBtn = document.getElementById('clear-preview');
  const fileInput = document.getElementById('file-input');
  const cameraInput = document.getElementById('camera-input');
  const dropZone = document.getElementById('drop-zone');
  const browseBtn = document.getElementById('browse-btn');
  const cameraBtn = document.getElementById('camera-btn');
  const backBtn = document.getElementById('back-btn');
  const startBtn = document.getElementById('start-btn');
  const resetBtn = document.getElementById('reset-btn');
  const shareBtn = document.getElementById('share-results');

  // Processing elements
  const processingStepText = document.getElementById('processing-step');
  const techProgressBar = document.getElementById('tech-progress-bar');
  const techProgressLabel = document.querySelector('.tech-progress-label');

  // Results elements
  const confidenceScore = document.getElementById('confidence-score');
  const confidenceBar = document.getElementById('confidence-bar');
  // const confidenceChip = document.getElementById('confidence-chip');
  const diseaseName = document.getElementById('disease-name');
  const severityBadge = document.getElementById('severity-badge');
  const severityText = document.getElementById('severity-text');
  const severityLevel = document.getElementById('severity-level');
  // const gaugeFill = document.getElementById('gauge-fill');
  // const gaugeText = document.getElementById('gauge-text');
  const inferenceTimeSpan = document.getElementById('inference-time');
  const organicContent = document.getElementById('content-organic');
  const chemicalContent = document.getElementById('content-chemical');

  // Tabs
  const tabOrganic = document.getElementById('tab-organic');
  const tabChemical = document.getElementById('tab-chemical');
  const tabContents = document.querySelectorAll('.tab-content');

  // ==================== STATE ====================
  let currentImage = null;
  let processingInterval = null;
  let progressInterval = null; // <-- Ei line ta add korun
  const processingSteps = [
    "Extracting features...",
    "Running CropHeal AI model...",
    "Identifying pathogens...",
    "Calculating severity..."
  ];
  let currentStep = 0;

  // Mock result (same as before, but we can add more fields)
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

  // ==================== HELPER FUNCTIONS ====================
  function switchView(viewName) {
    Object.values(views).forEach(view => {
      view.classList.remove('active');
      view.classList.add('hidden');
    });
    const targetView = views[viewName];
    targetView.classList.remove('hidden');
    targetView.classList.add('active');

    // Re-init icons in case new icons appear
    lucide.createIcons();

    // Special actions per view
    if (viewName === 'input') {
      // Reset preview when entering input view (optional)
      if (!currentImage) {
        previewThumbnail.classList.add('hidden');
      }
    }
  }

  function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
  }

  // function handleFile(file) {
  //   if (!file || !file.type.startsWith('image/')) return;
  //   const reader = new FileReader();
  //   reader.readAsDataURL(file);
  //   reader.onload = () => {
  //     currentImage = reader.result;
  //     // Set images in processing and results
  //     images.processing.src = currentImage;
  //     images.results.src = currentImage;
  //     images.bg.style.backgroundImage = `url(${currentImage})`;
  //     // Show thumbnail in input view
  //     images.thumbnail.src = currentImage;
  //     previewThumbnail.classList.remove('hidden');
  //     // Switch to processing
  //     switchView('processing');
  //   };
  // }

  // ==================== EVENT LISTENERS ====================
  // Home -> Input
  startBtn.addEventListener('click', () => switchView('input'));

  // Input: browse & camera
  browseBtn.addEventListener('click', () => fileInput.click());
  cameraBtn.addEventListener('click', () => cameraInput.click());
  backBtn.addEventListener('click', () => switchView('home'));

  // Drag & drop
  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, preventDefaults, false);
  });
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
    if (this.files[0]) handleFile(this.files[0]);
  });
  cameraInput.addEventListener('change', function () {
    if (this.files[0]) handleFile(this.files[0]);
  });

  // Clear preview thumbnail
  clearPreviewBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    currentImage = null;
    previewThumbnail.classList.add('hidden');
    fileInput.value = '';
    cameraInput.value = '';
    images.thumbnail.src = '';
  });

  // Reset button (scan another)
  resetBtn.addEventListener('click', () => {
    currentImage = null;
    fileInput.value = '';
    cameraInput.value = '';
    previewThumbnail.classList.add('hidden');
    switchView('home');
  });

  // Share button (mock)
  shareBtn.addEventListener('click', () => {
    alert('Share feature coming soon! 🌱');
  });

  // ==================== PROCESSING VIEW ====================
  // function startProcessing() {
  //   if (processingInterval) clearInterval(processingInterval);
  //   if (progressInterval) clearInterval(progressInterval); // Purono progress clear korbe

  //   currentStep = 0;
  //   updateProcessingStep();

  //   // --- NEW PROGRESS BAR LOGIC ---
  //   let currentPercent = 0;
  //   // 60 milliseconds por por update hobe jate animation smooth hoy
  //   progressInterval = setInterval(() => {
  //     currentPercent += 1; // 1% kore barbe
  //     if (currentPercent >= 100) {
  //       currentPercent = 100;
  //       clearInterval(progressInterval);
  //     }

  //     // 10 ta block er modhye koyta fill hobe setar hisab
  //     const filledBlocks = Math.floor(currentPercent / 10);
  //     const emptyBlocks = 10 - filledBlocks;

  //     // ▰ (filled) ar ▱ (empty) diye bar toiri
  //     const barString = '▰'.repeat(filledBlocks) + '▱'.repeat(emptyBlocks);

  //     techProgressLabel.textContent = `CNN inference ${barString} ${currentPercent}%`;
  //   }, 60);
  //   // ------------------------------

  //   processingInterval = setInterval(() => {
  //     currentStep++;
  //     if (currentStep >= processingSteps.length) {
  //       clearInterval(processingInterval);
  //       processingInterval = null;
  //       setTimeout(() => switchView('results'), 800);
  //     } else {
  //       updateProcessingStep();
  //     }
  //   }, 1500);
  // }
  let currentFile = null; // Add this state at the top

  function handleFile(file) {
    if (!file || !file.type.startsWith('image/')) return;

    currentFile = file; // Save the file for uploading

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      currentImage = reader.result;
      images.processing.src = currentImage;
      images.results.src = currentImage;
      images.bg.style.backgroundImage = `url(${currentImage})`;
      images.thumbnail.src = currentImage;
      previewThumbnail.classList.remove('hidden');

      switchView('processing');
      analyzeImageWithFlask(currentFile); // Call the actual backend
    };
  }

  async function analyzeImageWithFlask(file) {
    if (processingInterval) clearInterval(processingInterval);
    if (progressInterval) clearInterval(progressInterval);

    currentStep = 0;
    updateProcessingStep();

    let currentPercent = 0;

    // Animate up to 90% and wait for the API
    progressInterval = setInterval(() => {
      if (currentPercent < 90) {
        currentPercent += 1;
      }

      const filledBlocks = Math.floor(currentPercent / 10);
      const emptyBlocks = 10 - filledBlocks;
      const barString = '▰'.repeat(filledBlocks) + '▱'.repeat(emptyBlocks);

      techProgressLabel.textContent = `CNN inference ${barString} ${currentPercent}%`;
    }, 80);

    // Cycle through text steps slowly
    processingInterval = setInterval(() => {
      if (currentStep < processingSteps.length - 1) {
        currentStep++;
        updateProcessingStep();
      }
    }, 2000);

    const formData = new FormData();
    formData.append('file', file);

    try {
      // Send image to Flask backend
      const response = await fetch('/predict', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) throw new Error('Network response was not ok');

      const data = await response.json();

      // Stop timers
      clearInterval(progressInterval);
      clearInterval(processingInterval);

      // Jump to 100% on success
      techProgressLabel.textContent = `CNN inference ▰▰▰▰▰▰▰▰▰▰ 100%`;
      processingStepText.textContent = "Analysis Complete!";

      // Wait half a second so user can see 100%, then show results
      setTimeout(() => {
        showResults(data);
        switchView('results');
      }, 600);

    } catch (error) {
      console.error('Error analyzing image:', error);
      clearInterval(progressInterval);
      clearInterval(processingInterval);
      processingStepText.textContent = "Error: Could not connect to AI.";
      techProgressLabel.textContent = `CNN inference ▱▱▱▱▱▱▱▱▱▱ FAILED`;
    }
  }

  // Update showResults to accept actual data from Flask
  // Update showResults to accept actual data from Flask
  function showResults(data) {
    const conf = data.confidence;
    confidenceScore.textContent = conf + '%';

    // confidenceChip er line ta ami comment kore dilam jate error na ase
    // if (confidenceChip) confidenceChip.textContent = conf + '%';

    diseaseName.textContent = data.disease;

    // Severity badge
    severityBadge.classList.remove('hidden-badge', 'High-risk', 'Medium-risk', 'Low-risk');
    severityBadge.classList.add(data.severity + '-risk');
    severityText.textContent = data.severity + ' Risk';

    let severityWidth = data.severity === 'High' ? 80 : data.severity === 'Medium' ? 50 : 20;
    severityLevel.style.width = severityWidth + '%';

    setTimeout(() => {
      confidenceBar.style.width = conf + '%';
    }, 200);

    // Random inference time update (jate web app ta real lagbe)
    if (inferenceTimeSpan) {
      inferenceTimeSpan.textContent = (Math.random() * 1.4 + 1.8).toFixed(1) + 's';
    }

    // Build tab contents with Gemini data
    buildTabContent(organicContent, data.organic, 'organic');
    buildTabContent(chemicalContent, data.chemical, 'chemical');

    // Reset tabs
    tabOrganic.classList.add('active');
    tabChemical.classList.remove('active');
    document.getElementById('content-organic').classList.remove('hidden', 'active');
    document.getElementById('content-organic').classList.add('active');
    document.getElementById('content-chemical').classList.add('hidden');
    document.getElementById('content-chemical').classList.remove('active');

    lucide.createIcons();
  }

  function updateProcessingStep() {
    // Text step
    processingStepText.textContent = processingSteps[currentStep];
    processingStepText.classList.remove('animate-text-swap');
    void processingStepText.offsetWidth; // force reflow
    processingStepText.classList.add('animate-text-swap');

    // Update tech progress bar
    const progressPercent = Math.min(100, ((currentStep + 1) / processingSteps.length) * 100);
    techProgressBar.style.width = progressPercent + '%';

    // EIKHAN THEKE RANDOM INFERENCE ER LINE DUTO DELETE KORA HOYECHHE
  }

  // ==================== RESULTS VIEW ====================
  // function showResults() {
  //   // Populate data
  //   const conf = mockResult.confidence;
  //   confidenceScore.textContent = conf + '%';
  //   // confidenceChip.textContent = conf + '%';
  //   diseaseName.textContent = mockResult.disease;

  //   // Severity badge
  //   severityBadge.classList.remove('hidden-badge', 'High-risk', 'Medium-risk', 'Low-risk');
  //   severityBadge.classList.add(mockResult.severity + '-risk');
  //   severityText.textContent = mockResult.severity + ' Risk';

  //   // Severity meter (mock width based on severity)
  //   let severityWidth = mockResult.severity === 'High' ? 80 : mockResult.severity === 'Medium' ? 50 : 20;
  //   severityLevel.style.width = severityWidth + '%';

  //   // Confidence bar animation after a tiny delay
  //   setTimeout(() => {
  //     confidenceBar.style.width = conf + '%';
  //   }, 200);

  //   // Update gauge (circular)
  //   // const gaugeCircumference = 2 * Math.PI * 16; // r=16 -> ~100.53
  //   // const gaugeOffset = gaugeCircumference - (conf / 100) * gaugeCircumference;
  //   // gaugeFill.style.strokeDasharray = gaugeCircumference;
  //   // gaugeFill.style.strokeDashoffset = gaugeOffset;
  //   // gaugeText.textContent = conf + '%';

  //   // Random inference time between 1.8 and 3.2s
  //   inferenceTimeSpan.textContent = (Math.random() * 1.4 + 1.8).toFixed(1) + 's';

  //   // Build tab contents
  //   buildTabContent(organicContent, mockResult.organic, 'organic');
  //   buildTabContent(chemicalContent, mockResult.chemical, 'chemical');

  //   // Re-init icons inside tabs
  //   lucide.createIcons();

  //   // Reset tabs to organic active (in case previously switched)
  //   tabOrganic.classList.add('active');
  //   tabChemical.classList.remove('active');
  //   document.getElementById('content-organic').classList.remove('hidden', 'active');
  //   document.getElementById('content-organic').classList.add('active');
  //   document.getElementById('content-chemical').classList.add('hidden');
  //   document.getElementById('content-chemical').classList.remove('active');
  // }

  function buildTabContent(container, items, type) {
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

  // ==================== TABS SWITCHING ====================
  tabOrganic.addEventListener('click', () => {
    tabOrganic.classList.add('active');
    tabChemical.classList.remove('active');
    document.getElementById('content-organic').classList.remove('hidden', 'active');
    document.getElementById('content-organic').classList.add('active');
    document.getElementById('content-chemical').classList.add('hidden');
    document.getElementById('content-chemical').classList.remove('active');
    lucide.createIcons(); // in case new icons appear (none here but safe)
  });

  tabChemical.addEventListener('click', () => {
    tabChemical.classList.add('active');
    tabOrganic.classList.remove('active');
    document.getElementById('content-chemical').classList.remove('hidden', 'active');
    document.getElementById('content-chemical').classList.add('active');
    document.getElementById('content-organic').classList.add('hidden');
    document.getElementById('content-organic').classList.remove('active');
    lucide.createIcons();
  });

  // ==================== TILT EFFECT ON FEATURE CARDS (simple version) ====================
  const featureCards = document.querySelectorAll('[data-tilt]');
  featureCards.forEach(card => {
    card.addEventListener('mousemove', (e) => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      const rotateX = (y - centerY) / 15;
      const rotateY = (centerX - x) / 15;
      card.style.transform = `perspective(500px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.02, 1.02, 1.02)`;
    });
    card.addEventListener('mouseleave', () => {
      card.style.transform = 'perspective(500px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)';
    });
  });

  // ==================== CLEAN UP INTERVAL ON UNLOAD (optional) ====================
  window.addEventListener('beforeunload', () => {
    if (processingInterval) clearInterval(processingInterval);
  });

  // ==================== INITIAL UI STATE ====================
  // Ensure home is active, others hidden (already set by HTML)
  // But if user refreshes on a different view, we force home? we'll just trust HTML.
  // However, we can set home active explicitly:
  switchView('home');
  // But we don't want to trigger any processing, so call switchView with 'home' but it will re-run animations etc.
  // Actually we need to set home active without calling switchView? We'll just ensure classes correct.
  // Since HTML has home-view active, we just set others hidden.
  // We'll call lucide.createIcons again for safety.
  lucide.createIcons();
  // ==================== SMOOTH SCROLL ====================
  const discoverScrollBtn = document.getElementById('discover-scroll');
  const workingProcessSection = document.getElementById('working-process');

  if (discoverScrollBtn && workingProcessSection) {
    discoverScrollBtn.addEventListener('click', () => {
      workingProcessSection.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });
    });
  }
});