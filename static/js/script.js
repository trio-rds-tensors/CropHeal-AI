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
  const diseaseName = document.getElementById('disease-name');
  const severityBadge = document.getElementById('severity-badge');
  const severityText = document.getElementById('severity-text');
  const severityLevel = document.getElementById('severity-level');
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
  let progressInterval = null;
  let currentFile = null;

  const processingSteps = [
    "Extracting features...",
    "Running CropHeal AI model...",
    "Identifying pathogens...",
    "Calculating severity..."
  ];
  let currentStep = 0;

  // PDF er jonno global state
  window.latestScanData = null;
  window.currentImageUrl = "";

  // ==================== HELPER FUNCTIONS ====================
  function switchView(viewName) {
    Object.values(views).forEach(view => {
      view.classList.remove('active');
      view.classList.add('hidden');
    });
    const targetView = views[viewName];
    targetView.classList.remove('hidden');
    targetView.classList.add('active');

    lucide.createIcons();

    if (viewName === 'input') {
      if (!currentImage) {
        previewThumbnail.classList.add('hidden');
      }
    }
  }

  function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
  }

  function handleFile(file) {
    if (!file || !file.type.startsWith('image/')) return;

    currentFile = file;
    window.currentImageUrl = URL.createObjectURL(file); // Save for PDF

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
      analyzeImageWithFlask(currentFile);
    };
  }

  async function analyzeImageWithFlask(file) {
    if (processingInterval) clearInterval(processingInterval);
    if (progressInterval) clearInterval(progressInterval);

    currentStep = 0;
    updateProcessingStep();

    let currentPercent = 0;

    progressInterval = setInterval(() => {
      if (currentPercent < 90) {
        currentPercent += 1;
      }
      const filledBlocks = Math.floor(currentPercent / 10);
      const emptyBlocks = 10 - filledBlocks;
      const barString = '▰'.repeat(filledBlocks) + '▱'.repeat(emptyBlocks);
      techProgressLabel.textContent = `CNN inference ${barString} ${currentPercent}%`;
    }, 80);

    processingInterval = setInterval(() => {
      if (currentStep < processingSteps.length - 1) {
        currentStep++;
        updateProcessingStep();
      }
    }, 2000);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/predict', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) throw new Error('Network response was not ok');
      const data = await response.json();

      clearInterval(progressInterval);
      clearInterval(processingInterval);

      techProgressLabel.textContent = `CNN inference ▰▰▰▰▰▰▰▰▰▰ 100%`;
      processingStepText.textContent = "Analysis Complete!";

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

  function showResults(data) {
    window.latestScanData = data; // PDF e pathanor jonno save korlam

    const conf = data.confidence;
    confidenceScore.textContent = conf + '%';
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

    if (inferenceTimeSpan) {
      inferenceTimeSpan.textContent = (Math.random() * 1.4 + 1.8).toFixed(1) + 's';
    }

    buildTabContent(organicContent, data.organic, 'organic');
    buildTabContent(chemicalContent, data.chemical, 'chemical');

    tabOrganic.classList.add('active');
    tabChemical.classList.remove('active');
    document.getElementById('content-organic').classList.remove('hidden', 'active');
    document.getElementById('content-organic').classList.add('active');
    document.getElementById('content-chemical').classList.add('hidden');
    document.getElementById('content-chemical').classList.remove('active');

    lucide.createIcons();
  }

  function updateProcessingStep() {
    processingStepText.textContent = processingSteps[currentStep];
    processingStepText.classList.remove('animate-text-swap');
    void processingStepText.offsetWidth;
    processingStepText.classList.add('animate-text-swap');

    const progressPercent = Math.min(100, ((currentStep + 1) / processingSteps.length) * 100);
    techProgressBar.style.width = progressPercent + '%';
  }

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

  // ==================== EVENT LISTENERS ====================
  startBtn.addEventListener('click', () => switchView('input'));
  browseBtn.addEventListener('click', () => fileInput.click());
  cameraBtn.addEventListener('click', () => cameraInput.click());
  backBtn.addEventListener('click', () => switchView('home'));

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

  clearPreviewBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    currentImage = null;
    previewThumbnail.classList.add('hidden');
    fileInput.value = '';
    cameraInput.value = '';
    images.thumbnail.src = '';
  });

  resetBtn.addEventListener('click', () => {
    currentImage = null;
    fileInput.value = '';
    cameraInput.value = '';
    previewThumbnail.classList.add('hidden');
    switchView('home');
  });

  shareBtn.addEventListener('click', () => {
    alert('Share feature coming soon! 🌱');
  });

  tabOrganic.addEventListener('click', () => {
    tabOrganic.classList.add('active');
    tabChemical.classList.remove('active');
    document.getElementById('content-organic').classList.remove('hidden', 'active');
    document.getElementById('content-organic').classList.add('active');
    document.getElementById('content-chemical').classList.add('hidden');
    document.getElementById('content-chemical').classList.remove('active');
    lucide.createIcons();
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

  window.addEventListener('beforeunload', () => {
    if (processingInterval) clearInterval(processingInterval);
  });

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

  // Initial state setup
  switchView('home');
  lucide.createIcons();

  // ===================================================================
  // MODAL LOGIC (Email Popup er jonno DOM theke elements nawa)
  // ===================================================================
  const emailOverlay = document.getElementById('email-modal-overlay');
  const stateInput = document.getElementById('email-input-state');
  const stateLoading = document.getElementById('email-loading-state');
  const stateResult = document.getElementById('email-result-state');
  const emailInputBox = document.getElementById('custom-email-input');

  if (emailOverlay) {
    // Cancel Button logic
    document.getElementById('cancel-email-btn').addEventListener('click', () => {
      emailOverlay.classList.add('hidden');
    });

    // Close Button logic
    document.getElementById('close-modal-btn').addEventListener('click', () => {
      emailOverlay.classList.add('hidden');
    });

    // Confirm (Send) Button logic
    document.getElementById('confirm-email-btn').addEventListener('click', () => {
      const userEmail = emailInputBox.value.trim();
      const data = window.latestScanData;

      if (!userEmail || !userEmail.includes('@') || !userEmail.includes('.')) {
        emailInputBox.style.borderColor = "red";
        setTimeout(() => emailInputBox.style.borderColor = "#cbd5e1", 1500);
        return;
      }

      stateInput.classList.add('hidden');
      stateLoading.classList.remove('hidden');

      fetch('/send_email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: userEmail,
          disease: data.disease,
          severity: data.severity,
          organic: data.organic,
          chemical: data.chemical
        })
      })
        .then(response => response.json())
        .then(responseObj => {
          stateLoading.classList.add('hidden');
          stateResult.classList.remove('hidden');

          const resultIcon = document.getElementById('result-icon');
          const resultTitle = document.getElementById('result-title');
          const resultMessage = document.getElementById('result-message');

          if (responseObj.success) {
            resultIcon.innerText = "✅";
            resultTitle.innerText = "Success!";
            resultTitle.style.color = "#10b981";
            resultMessage.innerText = "Report has been sent to " + userEmail;
          } else {
            resultIcon.innerText = "❌";
            resultTitle.innerText = "Failed";
            resultTitle.style.color = "#ef4444";
            resultMessage.innerText = responseObj.error || "Could not send the email.";
          }
        })
        .catch(error => {
          stateLoading.classList.add('hidden');
          stateResult.classList.remove('hidden');

          document.getElementById('result-icon').innerText = "⚠️";
          document.getElementById('result-title').innerText = "Error";
          document.getElementById('result-title').style.color = "#f59e0b";
          document.getElementById('result-message').innerText = "A network error occurred.";
        });
    });
  }

}); // <==== DOMContentLoaded sesh

// ==================== PDF GENERATION ====================
function downloadPDF() {
  const data = window.latestScanData;
  if (!data) return alert("Please scan an image first!");

  const now = new Date();
  document.getElementById('pdf-date').innerText = now.toLocaleDateString('en-GB');
  document.getElementById('pdf-time').innerText = now.toLocaleTimeString('en-US');
  document.getElementById('pdf-report-id').innerText = "CH-" + now.getFullYear() + "-" + Math.floor(Math.random() * 10000);

  document.getElementById('pdf-uploaded-image').src = window.currentImageUrl;

  document.getElementById('pdf-disease-name').innerText = data.disease;
  document.getElementById('pdf-plant-name').innerText = data.disease.split(' ')[0] || "Plant";
  document.getElementById('pdf-confidence').innerText = data.confidence + '%';

  const severityElem = document.getElementById('pdf-severity');
  severityElem.innerText = data.severity;
  if (data.severity.toLowerCase() === 'high') severityElem.style.color = '#E53935';
  else if (data.severity.toLowerCase() === 'medium') severityElem.style.color = '#FFA726';
  else severityElem.style.color = '#2E7D32';

  const organicList = document.getElementById('pdf-organic-list');
  const chemicalList = document.getElementById('pdf-chemical-list');
  const preventionList = document.getElementById('pdf-prevention-list');

  organicList.innerHTML = "";
  chemicalList.innerHTML = "";
  if (preventionList) preventionList.innerHTML = "";

  data.organic.forEach(item => organicList.innerHTML += `<li>${item}</li>`);
  data.chemical.forEach(item => chemicalList.innerHTML += `<li>${item}</li>`);

  document.getElementById('pdf-explanation').innerText = data.explanation || "No explanation available.";
  if (data.prevention && preventionList) {
    data.prevention.forEach(item => preventionList.innerHTML += `<li>${item}</li>`);
  }

  const element = document.getElementById('pdf-report');
  element.parentElement.style.display = 'block';

  const opt = {
    margin: 0,
    filename: 'CropHeal_Report_' + now.getTime() + '.pdf',
    image: { type: 'jpeg', quality: 1 },
    html2canvas: { scale: 2, useCORS: true },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
    pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
  };

  html2pdf().set(opt).from(element).save().then(() => {
    element.parentElement.style.display = 'none';
  });
}

// ==================== EMAIL POPUP TRIGGER ====================
// HTML e email button er sathe ei function ta jora thakbe (onclick="sendEmailReport()")
function sendEmailReport() {
  const data = window.latestScanData;
  if (!data) return alert("⚠️ Please scan a leaf image first!");

  const emailOverlay = document.getElementById('email-modal-overlay');
  const stateInput = document.getElementById('email-input-state');
  const stateLoading = document.getElementById('email-loading-state');
  const stateResult = document.getElementById('email-result-state');
  const emailInputBox = document.getElementById('custom-email-input');

  if (emailOverlay) {
    emailInputBox.value = ""; // Purono text muche deya
    stateInput.classList.remove('hidden');
    stateLoading.classList.add('hidden');
    stateResult.classList.add('hidden');

    emailOverlay.classList.remove('hidden');
    emailInputBox.focus();
  } else {
    alert("Error: Modal structure not found in HTML!");
  }
}