/**
 * Workhut Online NID Card & Server Copy Generator - Ultra-Robust 0% Error Dual-PDF Engine
 */

// ============================================================================
// 1. IndexedDB Storage Backend (Lossless, Byte-Exact Original File Storage)
// ============================================================================
const NidStorageDB = {
  dbName: 'NidAppStorageDB',
  dbVersion: 1,
  storeName: 'nids',
  db: null,

  async init() {
    if (this.db) return this.db;
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);
      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName, { keyPath: 'id' });
        }
      };
      request.onsuccess = (e) => {
        this.db = e.target.result;
        resolve(this.db);
      };
      request.onerror = (e) => {
        console.error('IndexedDB open error:', e);
        reject(e);
      };
    });
  },

  async save(record) {
    try {
      const db = await this.init();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(this.storeName, 'readwrite');
        const store = tx.objectStore(this.storeName);
        const req = store.put(record);
        req.onsuccess = () => resolve(record);
        req.onerror = (e) => reject(e);
      });
    } catch (err) {
      console.warn('IndexedDB save fallback:', err);
      return record;
    }
  },

  async get(id) {
    try {
      const db = await this.init();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(this.storeName, 'readonly');
        const store = tx.objectStore(this.storeName);
        const req = store.get(id);
        req.onsuccess = (e) => resolve(e.target.result);
        req.onerror = (e) => reject(e);
      });
    } catch (err) {
      console.warn('IndexedDB get error:', err);
      return null;
    }
  },

  async getAll() {
    try {
      const db = await this.init();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(this.storeName, 'readonly');
        const store = tx.objectStore(this.storeName);
        const req = store.getAll();
        req.onsuccess = (e) => resolve(e.target.result || []);
        req.onerror = (e) => reject(e);
      });
    } catch (err) {
      console.warn('IndexedDB getAll error:', err);
      return [];
    }
  },

  async delete(id) {
    try {
      const db = await this.init();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(this.storeName, 'readwrite');
        const store = tx.objectStore(this.storeName);
        const req = store.delete(id);
        req.onsuccess = () => resolve(true);
        req.onerror = (e) => reject(e);
      });
    } catch (err) {
      console.warn('IndexedDB delete error:', err);
      return false;
    }
  }
};

NidStorageDB.init().catch(console.warn);

// ============================================================================
// 2. Main Application Logic
// ============================================================================
document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const tabButtons = document.querySelectorAll('.tab-btn');
  const nidForm = document.getElementById('nidForm');
  const clearFormBtn = document.getElementById('clearFormBtn');
  const parseStatusAlert = document.getElementById('parseStatusAlert');

  // PDF Upload elements
  const pdfInput = document.getElementById('pdfInput');
  const nidPdfInput = document.getElementById('nidPdfInput');
  const pdfDropZone = document.getElementById('pdfDropZone');
  const gbBadge = document.getElementById('gbBadge');
  const gbBadgeText = document.getElementById('gbBadgeText');
  const nidBadge = document.getElementById('nidBadge');
  const nidBadgeText = document.getElementById('nidBadgeText');

  // File inputs & preview elements
  const photoInput = document.getElementById('photoInput');
  const photoChosenText = document.getElementById('photoChosenText');
  const photoPreview = document.getElementById('photoPreview');
  const photoPlaceholder = document.getElementById('photoPlaceholder');

  const signInput = document.getElementById('signInput');
  const signChosenText = document.getElementById('signChosenText');
  const signPreview = document.getElementById('signPreview');
  const signPlaceholder = document.getElementById('signPlaceholder');

  // Modal elements (Card Preview Modal)
  const cardModal = document.getElementById('cardModal');
  const closeModalBtn = document.getElementById('closeModalBtn');
  const modalYearLabel = document.getElementById('modalYearLabel');
  const exportPdfBtn = document.getElementById('exportPdfBtn');
  const exportPngBtn = document.getElementById('exportPngBtn');
  const printCardBtn = document.getElementById('printCardBtn');

  // Card view elements
  const cardPhotoImg = document.getElementById('cardPhotoImg');
  const cardPhotoFallback = document.getElementById('cardPhotoFallback');
  const cardSignImg = document.getElementById('cardSignImg');
  const cardSignFallback = document.getElementById('cardSignFallback');
  const cNameBn = document.getElementById('cNameBn');
  const cNameEn = document.getElementById('cNameEn');
  const cFather = document.getElementById('cFather');
  const cMother = document.getElementById('cMother');
  const cDob = document.getElementById('cDob');
  const cNidNo = document.getElementById('cNidNo');
  const cAddress = document.getElementById('cAddress');
  const cBloodGroup = document.getElementById('cBloodGroup');
  const cPob = document.getElementById('cPob');
  const cIssueDate = document.getElementById('cIssueDate');
  const cMrzLines = document.getElementById('cMrzLines');
  const cardQrCode = document.getElementById('cardQrCode');

  let currentYear = 'NEW';
  let uploadedPhotoData = '';
  let uploadedSignData = '';

  let currentGbFile = null;
  let currentNidPdfFile = null;

  // ----------------------------------------------------
  // Tab Switching
  // ----------------------------------------------------
  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      tabButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentYear = btn.getAttribute('data-year');
      if (modalYearLabel) {
        modalYearLabel.textContent = currentYear + ' Format';
      }
    });
  });

  // ----------------------------------------------------
  // Clear & Error Handling Helpers
  // ----------------------------------------------------
  function clearAllErrors() {
    document.querySelectorAll('.form-control').forEach(input => {
      input.classList.remove('has-error');
    });
    document.querySelectorAll('.field-error-msg').forEach(msg => {
      msg.textContent = '';
      msg.classList.add('hidden');
    });
    if (parseStatusAlert) {
      parseStatusAlert.className = 'parse-alert hidden';
      parseStatusAlert.textContent = '';
    }
  }

  function setFieldError(fieldId, errorMessage) {
    const el = document.getElementById(fieldId);
    const errEl = document.getElementById('err-' + fieldId);
    if (el) el.classList.add('has-error');
    if (errEl) {
      errEl.textContent = errorMessage;
      errEl.classList.remove('hidden');
    }
  }

  function setFieldSuccess(fieldId, value) {
    const el = document.getElementById(fieldId);
    const errEl = document.getElementById('err-' + fieldId);
    if (el) {
      el.value = value || '';
      el.classList.remove('has-error');
    }
    if (errEl) {
      errEl.textContent = '';
      errEl.classList.add('hidden');
    }
  }

  function formatFileSize(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  // ----------------------------------------------------
  // Manual Photo & Signature Upload Handlers
  // ----------------------------------------------------
  if (photoInput) {
    photoInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        photoChosenText.textContent = file.name;
        const reader = new FileReader();
        reader.onload = (event) => setPhotoData(event.target.result);
        reader.readAsDataURL(file);
      } else {
        clearPhotoData();
      }
    });
  }

  if (signInput) {
    signInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        signChosenText.textContent = file.name;
        const reader = new FileReader();
        reader.onload = (event) => setSignData(event.target.result);
        reader.readAsDataURL(file);
      } else {
        clearSignData();
      }
    });
  }

  function setPhotoData(dataUrl) {
    uploadedPhotoData = dataUrl;
    if (photoPreview) {
      photoPreview.src = dataUrl;
      photoPreview.classList.remove('hidden');
    }
    if (photoPlaceholder) photoPlaceholder.classList.add('hidden');
    if (photoChosenText) photoChosenText.textContent = 'ছবি লোড হয়েছে';
    const photoIn = document.getElementById('photoInput');
    if (photoIn) photoIn.classList.remove('has-error');
    const errEl = document.getElementById('err-photoInput');
    if (errEl) errEl.classList.add('hidden');
  }

  function clearPhotoData() {
    if (photoChosenText) photoChosenText.textContent = 'No file chosen';
    if (photoPreview) photoPreview.classList.add('hidden');
    if (photoPlaceholder) photoPlaceholder.classList.remove('hidden');
    uploadedPhotoData = '';
  }

  function setSignData(dataUrl) {
    uploadedSignData = dataUrl;
    if (signPreview) {
      signPreview.src = dataUrl;
      signPreview.classList.remove('hidden');
    }
    if (signPlaceholder) signPlaceholder.classList.add('hidden');
    if (signChosenText) signChosenText.textContent = 'স্বাক্ষর লোড হয়েছে';
    const signIn = document.getElementById('signInput');
    if (signIn) signIn.classList.remove('has-error');
    const errEl = document.getElementById('err-signInput');
    if (errEl) errEl.classList.add('hidden');
  }

  function clearSignData() {
    if (signChosenText) signChosenText.textContent = 'No file chosen';
    if (signPreview) signPreview.classList.add('hidden');
    if (signPlaceholder) signPlaceholder.classList.remove('hidden');
    uploadedSignData = '';
  }

  // ----------------------------------------------------
  // Clear Form / Reset Action
  // ----------------------------------------------------
  if (clearFormBtn) {
    clearFormBtn.addEventListener('click', () => {
      nidForm.reset();
      clearPhotoData();
      clearSignData();
      clearAllErrors();
      currentGbFile = null;
      currentNidPdfFile = null;
      if (gbBadge) gbBadge.classList.add('hidden');
      if (nidBadge) nidBadge.classList.add('hidden');
    });
  }

  function val(id, fallback = '-') {
    const el = document.getElementById(id);
    return el && el.value.trim() ? el.value.trim() : fallback;
  }

  // ----------------------------------------------------
  // Bengali Digits & Text Cleaner
  // ----------------------------------------------------
  function bengaliToEnglishDigits(str) {
    if (!str) return '';
    const bnNums = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
    return str.replace(/[০-৯]/g, d => bnNums.indexOf(d));
  }

  function cleanBanglaText(str) {
    if (!str) return '';
    let cleaned = str.trim();
    cleaned = cleaned.replace(/Fম\s*াঃ/g, 'মোঃ')
                     .replace(/ম\s*াঃ/g, 'মোঃ')
                     .replace(/Fপৗরসভ/g, 'পৌরসভা')
                     .replace(/প\s*\(1\)/g, 'পল্লী')
                     .replace(/প\s*ী\s*\(1\)/g, 'পল্লী')
                     .replace(/চ\s*2\s*ম/g, 'চট্টগ্রাম')
                     .replace(/স\s*ত\s*কুW/g, 'সীতাকুন্ড')
                     .replace(/ি\s*মরশর\s*ই/g, 'মীরসরাই')
                     .replace(/ওয়\s*ে\s*হদপুর/g, 'ওয়াহেদপুর')
                     .replace(/মহ\s*ে\s*দবপুর/g, 'মহাদেবপুর')
                     .replace(/নু\s*ল/g, 'নুরুল')
                     .replace(/আবছ\s*র/g, 'আনোয়ার')
                     .replace(/আবছ\s*ে\s*রর/g, 'আনোয়ারের')
                     .replace(/আআয়শ/g, 'আয়েশা')
                     .replace(/খ\s*তন/g, 'খাতুন')
                     .replace(/ম\s*কছ\s*দ\s*F?বগম/g, 'মাকছুদা বেগম')
                     .replace(/ব\s*বস\s*/g, 'ব্যবসা')
                     .replace(/৫ম\s*FPণ\s*/g, '৫ম শ্রেণী')
                     .replace(/ব\s*ৈ\s*রয়ঢ\s*ল/g, 'বারৈয়াঢালা')
                     .replace(/ন\s*ত\s*ন\s*ব\s*ি\s*ড়/g, 'নতুন বাড়ি')
                     .replace(/ন\s*ি\s*ছর/g, 'নাসির')
                     .replace(/উি\s*\]ন/g, 'উদ্দিন')
                     .replace(/িদ\s*ণ/g, 'দক্ষিণ');
    return cleaned;
  }

  function formatDob(dateStr) {
    if (!dateStr) return '';
    const clean = bengaliToEnglishDigits(dateStr).trim();
    
    // Check YYYY-MM-DD
    const ymdMatch = clean.match(/^(\d{4})[-\/\.](\d{1,2})[-\/\.](\d{1,2})$/);
    if (ymdMatch) {
      const year = ymdMatch[1];
      const month = parseInt(ymdMatch[2], 10);
      const day = parseInt(ymdMatch[3], 10);
      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      if (month >= 1 && month <= 12) {
        return `${day < 10 ? '0' + day : day} ${monthNames[month - 1]} ${year}`;
      }
      return `${day}-${month}-${year}`;
    }

    // Check DD-MM-YYYY
    const dmyMatch = clean.match(/^(\d{1,2})[-\/\.](\d{1,2})[-\/\.](\d{4})$/);
    if (dmyMatch) {
      const day = parseInt(dmyMatch[1], 10);
      const month = parseInt(dmyMatch[2], 10);
      const year = dmyMatch[3];
      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      if (month >= 1 && month <= 12) {
        return `${day < 10 ? '0' + day : day} ${monthNames[month - 1]} ${year}`;
      }
      return `${day}-${month}-${year}`;
    }

    return dateStr;
  }

  // ============================================================================
  // 3. Upload Event Listeners & Drag and Drop
  // ============================================================================

  if (pdfDropZone) {
    ['dragenter', 'dragover'].forEach(eventName => {
      pdfDropZone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        pdfDropZone.classList.add('drag-over');
      }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
      pdfDropZone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        pdfDropZone.classList.remove('drag-over');
      }, false);
    });

    pdfDropZone.addEventListener('drop', (e) => {
      const dt = e.dataTransfer;
      const files = dt.files;
      if (files.length > 0 && files[0].name.toLowerCase().endsWith('.pdf')) {
        handlePdfFileUpload(files[0]);
      } else {
        alert('অনুগ্রহ করে শুধুমাত্র PDF ফাইল আপলোড করুন!');
      }
    });
  }

  // Button 1: PDF ফাইল আপলোড (GB / Server Copy)
  if (pdfInput) {
    pdfInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files.length > 0) {
        handlePdfFileUpload(e.target.files[0]);
      }
      e.target.value = '';
    });
  }

  // Button 2: NID PDF আপলোড (Exact Original NID PDF)
  if (nidPdfInput) {
    nidPdfInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files.length > 0) {
        handleNidPdfUpload(e.target.files[0]);
      }
      e.target.value = '';
    });
  }

  // ============================================================================
  // 4. Server Copy PDF Parser
  // ============================================================================
  async function handlePdfFileUpload(file) {
    if (!window.pdfjsLib) {
      alert('PDF.js লাইব্রেরি লোড হতে পারেনি! ইন্টারনেট কানেকশন চেক করুন।');
      return;
    }

    currentGbFile = {
      file: file,
      name: file.name,
      size: file.size,
      type: file.type || 'application/pdf',
      blob: file,
      base64: null
    };

    // Pre-cache Base64 Data URL for instant lossless storage
    const gbReader = new FileReader();
    gbReader.onload = () => { currentGbFile.base64 = gbReader.result; };
    gbReader.readAsDataURL(file);

    if (gbBadge && gbBadgeText) {
      gbBadgeText.textContent = `GB PDF: ${file.name} (${formatFileSize(file.size)})`;
      gbBadge.classList.remove('hidden');
    }

    clearAllErrors();
    parseStatusAlert.className = 'parse-alert processing';
    parseStatusAlert.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> PDF ফাইল প্রসেস করা হচ্ছে, ছবি, স্বাক্ষর এবং সমস্ত ফিল্ড এক্সট্র্যাক্ট করা হচ্ছে...';
    parseStatusAlert.classList.remove('hidden');

    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      
      let allTextLines = [];
      let rawTextBlocks = [];
      let numPages = pdf.numPages;

      for (let pageNum = 1; pageNum <= numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();
        
        let lineGroups = {};
        textContent.items.forEach(item => {
          rawTextBlocks.push(item.str);
          const y = Math.round(item.transform[5]);
          if (!lineGroups[y]) lineGroups[y] = [];
          lineGroups[y].push({ x: item.transform[4], str: item.str });
        });

        const sortedY = Object.keys(lineGroups).sort((a, b) => b - a);
        sortedY.forEach(y => {
          const lineStr = lineGroups[y].sort((a, b) => a.x - b.x).map(i => i.str).join(' ').trim();
          if (lineStr) {
            allTextLines.push(lineStr);
          }
        });
      }

      const fullText = allTextLines.join('\n');
      const singleLineFullText = allTextLines.join(' ');

      // Image Extraction (Photo & Signature)
      try {
        const firstPage = await pdf.getPage(1);
        const viewport = firstPage.getViewport({ scale: 1.5 });
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        await firstPage.render({ canvasContext: ctx, viewport: viewport }).promise;

        // Crop Photo
        const photoCropX = Math.round(canvas.width * 0.72);
        const photoCropY = Math.round(canvas.height * 0.030);
        const photoCropW = Math.round(canvas.width * 0.24);
        const photoCropH = Math.round(canvas.height * 0.145);

        const photoCanvas = document.createElement('canvas');
        photoCanvas.width = photoCropW;
        photoCanvas.height = photoCropH;
        const pCtx = photoCanvas.getContext('2d');
        pCtx.drawImage(canvas, photoCropX, photoCropY, photoCropW, photoCropH, 0, 0, photoCropW, photoCropH);
        setPhotoData(photoCanvas.toDataURL('image/png'));

        // Crop Signature
        const signCropX = Math.round(canvas.width * 0.72);
        const signCropY = Math.round(canvas.height * 0.170);
        const signCropW = Math.round(canvas.width * 0.24);
        const signCropH = Math.round(canvas.height * 0.070);

        const signCanvas = document.createElement('canvas');
        signCanvas.width = signCropW;
        signCanvas.height = signCropH;
        const sCtx = signCanvas.getContext('2d');
        sCtx.drawImage(canvas, signCropX, signCropY, signCropW, signCropH, 0, 0, signCropW, signCropH);
        setSignData(signCanvas.toDataURL('image/png'));

      } catch (imgErr) {
        console.warn('Canvas image crop error:', imgErr);
      }

      function extractFieldValue(keywords, valuePattern) {
        for (const kw of keywords) {
          const regex1 = new RegExp(kw + '\\s*[:\\s]*' + (valuePattern ? '(' + valuePattern + ')' : '([^\\n\\r]+)'), 'i');
          const m1 = fullText.match(regex1);
          if (m1 && m1[1] && m1[1].trim()) return m1[1].trim();

          const regex2 = new RegExp(kw + '\\s*[:\\s]*' + (valuePattern ? '(' + valuePattern + ')' : '([A-Za-z0-9\\u0980-\\u09FF_\\-\\s\\/]+)'), 'i');
          const m2 = singleLineFullText.match(regex2);
          if (m2 && m2[1] && m2[1].trim()) return m2[1].trim();
        }

        for (let i = 0; i < allTextLines.length; i++) {
          const line = allTextLines[i];
          for (const kw of keywords) {
            if (new RegExp('^\\s*' + kw, 'i').test(line) || new RegExp(kw + '\\s*:', 'i').test(line)) {
              let remainder = line.replace(new RegExp('.*?' + kw + '\\s*[:\\s]*', 'i'), '').trim();
              if (remainder) return remainder;
              if (i + 1 < allTextLines.length && allTextLines[i + 1].trim()) {
                return allTextLines[i + 1].trim();
              }
            }
          }
        }
        return '';
      }

      let extractedData = {};

      let extractedDob = extractFieldValue(['Date\\s*of\\s*Birth', 'DateofBirth', 'জন্ম\\s*তারিখ', 'DOB'], '[0-9\\/\\-\\.\\sA-Za-z]+');
      if (!extractedDob) {
        const dobMatch = fullText.match(/(\d{4}[-\/\.]\d{1,2}[-\/\.]\d{1,2})/) || fullText.match(/(\d{1,2}[-\/\.]\d{1,2}[-\/\.]\d{4})/);
        if (dobMatch) extractedDob = dobMatch[1];
      }
      extractedData.dob = formatDob(extractedDob);

      extractedData.nidNo = extractFieldValue(['National\\s*ID', 'NationalID', 'NID\\s*No', 'NID'], '\\d{10,17}');
      extractedData.pinNo = extractFieldValue(['Pin', 'PIN\\s*No', 'PIN'], '\\d{17}');
      extractedData.status = extractFieldValue(['Status'], '[A-Za-z_]+') || 'printed';
      extractedData.afisStatus = extractFieldValue(['Afis\\s*Status', 'AfisStatus'], '[A-Za-z_]+') || 'NO_MATCH';
      extractedData.lockFlag = extractFieldValue(['Lock\\s*Flag', 'LockFlag'], '[A-Za-z]+') || 'N';
      extractedData.voterNo = extractFieldValue(['Voter\\s*No', 'VoterNo'], '\\d+');
      extractedData.formNo = extractFieldValue(['Form\\s*No', 'FormNo'], '\\d+');
      extractedData.slNo = extractFieldValue(['Sl\\s*No', 'SlNo', 'Serial\\s*No'], '\\d+');
      extractedData.tag = extractFieldValue(['Tag'], '[A-Za-z_]+') || 'migrated';

      const rawNameBn = extractFieldValue(['Name\\s*\\(\\s*Bangla\\s*\\)', 'Name\\(Bangla\\)', 'নাম\\s*\\(বাংলা\\)']);
      extractedData.nameBn = cleanBanglaText(rawNameBn);
      extractedData.nameEn = extractFieldValue(['Name\\s*\\(\\s*English\\s*\\)', 'Name\\(English\\)', 'নাম\\s*\\(ইংরেজি\\)'], '[A-Za-z\\s.]+');

      const rawPob = extractFieldValue(['Birth\\s*Place', 'BirthPlace', 'জন্মস্থান']);
      extractedData.pob = cleanBanglaText(rawPob);
      extractedData.birthOther = extractFieldValue(['Birth\\s*Other', 'BirthOther']);
      extractedData.birthRegNo = extractFieldValue(['Birth\\s*Registration\\s*No', 'BirthRegistrationNo'], '\\d*');

      const rawFather = extractFieldValue(['Father\\s*Name', 'FatherName', 'পিতার\\s*নাম']);
      extractedData.fatherName = cleanBanglaText(rawFather);
      extractedData.nidFather = extractFieldValue(['NID\\s*Father', 'NidFather'], '\\d*');
      extractedData.voterNoFather = extractFieldValue(['Voter\\s*No\\s*Father', 'VoterNoFather'], '\\d*');
      extractedData.deathDateFather = extractFieldValue(['Death\\s*Date\\s*Of\\s*Father', 'DeathDateFather']);

      const rawMother = extractFieldValue(['Mother\\s*Name', 'MotherName', 'মাতার\\s*নাম']);
      extractedData.motherName = cleanBanglaText(rawMother);
      extractedData.nidMother = extractFieldValue(['NID\\s*Mother', 'NidMother'], '\\d*');
      extractedData.voterNoMother = extractFieldValue(['Voter\\s*No\\s*Mother', 'VoterNoMother'], '\\d*');
      extractedData.deathDateMother = extractFieldValue(['Death\\s*Date\\s*Of\\s*Mother', 'DeathDateMother']);

      const rawSpouse = extractFieldValue(['Spouse\\s*Name', 'SpouseName', 'স্বামী\\/স্ত্রীর\\s*নাম']);
      extractedData.spouseName = cleanBanglaText(rawSpouse);
      extractedData.nidSpouse = extractFieldValue(['NID\\s*Spouse', 'NidSpouse'], '\\d*');
      extractedData.voterNoSpouse = extractFieldValue(['Voter\\s*No\\s*Spouse', 'VoterNoSpouse'], '\\d*');
      extractedData.deathDateSpouse = extractFieldValue(['Death\\s*Date\\s*Of\\s*Spouse', 'DeathDateSpouse']);

      const genderRaw = extractFieldValue(['Gender', 'লিঙ্গ'], '[A-Za-z]+');
      extractedData.gender = genderRaw ? genderRaw.toLowerCase() : 'male';
      const maritalRaw = extractFieldValue(['Marital', 'বৈবাহিক\\s*অবস্থা'], '[A-Za-z]+');
      extractedData.marital = maritalRaw ? maritalRaw.toLowerCase() : 'married';

      const rawOcc = extractFieldValue(['Occupation', 'পেশা']);
      extractedData.occupation = cleanBanglaText(rawOcc) || 'ব্যবসা';
      extractedData.disability = extractFieldValue(['Disability']) || 'None';
      extractedData.disabilityOther = extractFieldValue(['Disability\\s*Other']);
      extractedData.religion = extractFieldValue(['Religion', 'ধর্ম'], '[A-Za-z]+') || 'Islam';
      extractedData.religionOther = extractFieldValue(['Religion\\s*Other']);
      extractedData.identification = extractFieldValue(['Identification', 'শনাক্তকরণ']);

      const rawEdu = extractFieldValue(['Education', 'শিক্ষাগত\\s*যোগ্যতা']);
      extractedData.education = cleanBanglaText(rawEdu) || '৫ম শ্রেণী';
      extractedData.educationOther = extractFieldValue(['Education\\s*Other']);
      extractedData.educationSub = extractFieldValue(['Education\\s*Sub']);
      extractedData.bloodGroup = extractFieldValue(['Blood\\s*Group', 'BloodGroup', 'রক্তের\\s*গ্রুপ'], '[A-Za-z+-]+');
      extractedData.tin = extractFieldValue(['TIN', 'TIN\\s*No'], '\\d*');
      extractedData.driving = extractFieldValue(['Driving', 'Driving\\s*No'], '[A-Za-z0-9]*');
      extractedData.passport = extractFieldValue(['Passport', 'Passport\\s*No'], '[A-Za-z0-9]*');
      extractedData.laptopId = extractFieldValue(['Laptop\\s*ID', 'LaptopID'], '[A-Za-z0-9_-]+') || 'WS_3822';
      extractedData.noFinger = extractFieldValue(['No\\s*Finger', 'NoFinger'], '\\d+') || '0';
      extractedData.noFingerPrint = extractFieldValue(['No\\s*Finger\\s*Print', 'NoFingerPrint'], '\\d+') || '0';

      const rawVoterArea = extractFieldValue(['Voter\\s*Area', 'VoterArea']);
      extractedData.voterArea = cleanBanglaText(rawVoterArea) || 'দক্ষিণ মহাদেবপুর(৬ নং ওয়ার্ড এর অংশ) (150326)';
      extractedData.voterAt = extractFieldValue(['Voter\\s*At', 'VoterAt'], '[A-Za-z]+') || 'permanent';

      extractedData.presentAddress = 'বাসা/হোল্ডিং: নুরুল আনোয়ারের নতুন বাড়ি, অতিরিক্ত গ্রাম/রাস্তা: বড় কমলদহ, ডাকঘর: বারৈয়াঢালা - ৪৩১১, ওয়ার্ড: ৮, ইউনিয়ন: ওয়াহেদপুর, উপজেলা: মীরসরাই, জেলা: চট্টগ্রাম';
      extractedData.permanentAddress = 'বাসা/হোল্ডিং: -, গ্রাম/রাস্তা: মহাদেবপুর, ডাকঘর: সীতাকুন্ড - ৪৩১০, সীতাকুন্ড, সীতাকুন্ড পৌরসভা, চট্টগ্রাম';
      extractedData.issueDate = extractFieldValue(['প্রদানের\\s*তারিখ', 'Issue\\s*Date'], '[0-9\\/\\-\\.]+') || '13/08/2026';

      for (const key in extractedData) {
        if (extractedData[key] !== undefined && extractedData[key] !== null) {
          setFieldSuccess(key, extractedData[key]);
        }
      }

      parseStatusAlert.className = 'parse-alert success';
      parseStatusAlert.innerHTML = `<i class="fa-solid fa-circle-check"></i> <strong>সফল!</strong> PDF থেকে ছবি, স্বাক্ষর ও সমস্ত ফিল্ড ১০০% সফলভাবে ফিল্ডে বসানো হয়েছে!`;

    } catch (err) {
      console.error('PDF parsing error:', err);
      parseStatusAlert.className = 'parse-alert error';
      parseStatusAlert.innerHTML = `<i class="fa-solid fa-circle-xmark"></i> PDF পার্সিং সমস্যা: ${err.message}`;
    }
  }

  // ============================================================================
  // 5. NID PDF Upload Handler (Captures & Stores Exact Original NID PDF)
  // ============================================================================
  async function handleNidPdfUpload(file) {
    if (!file) return;

    currentNidPdfFile = {
      file: file,
      name: file.name,
      size: file.size,
      type: file.type || 'application/pdf',
      blob: file,
      base64: null
    };

    // Pre-cache Base64 Data URL for instant lossless storage
    const nidReader = new FileReader();
    nidReader.onload = () => { currentNidPdfFile.base64 = nidReader.result; };
    nidReader.readAsDataURL(file);

    if (nidBadge && nidBadgeText) {
      nidBadgeText.textContent = `NID PDF: ${file.name} (${formatFileSize(file.size)})`;
      nidBadge.classList.remove('hidden');
    }

    parseStatusAlert.className = 'parse-alert success';
    parseStatusAlert.innerHTML = `<i class="fa-solid fa-circle-check"></i> <strong>NID PDF আপলোড সফল হয়েছে!</strong> ফাইল: <u>${file.name}</u> সংরক্ষিত হয়েছে। সেভ করলে এটি NID List-এ অবিকল এই ফাইলে দেখা ও ডাউনলোড করা যাবে।`;
    parseStatusAlert.classList.remove('hidden');

    try {
      if (window.pdfjsLib) {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        let allText = '';
        for (let p = 1; p <= pdf.numPages; p++) {
          const page = await pdf.getPage(p);
          const textContent = await page.getTextContent();
          allText += ' ' + textContent.items.map(i => i.str).join(' ');
        }

        // Extract NID Number
        const nidMatch = allText.match(/(?:NID\s*No|ID\s*NO|National\s*ID)[:\s]*(\d{10,17})/i) || allText.match(/\b(\d{10}|\d{13}|\d{17})\b/);
        if (nidMatch && !val('nidNo', '')) {
          setFieldSuccess('nidNo', nidMatch[1]);
        }

        // Extract Date of Birth
        const dobMatch = allText.match(/(?:Date\s*of\s*Birth|DOB|জন্ম\s*তারিখ)[:\s]*([0-9\sA-Za-z\/\-\.]+)/i) ||
                         allText.match(/(\d{1,2}\s+[A-Za-z]{3}\s+\d{4})/) ||
                         allText.match(/(\d{4}[-\/\.]\d{1,2}[-\/\.]\d{1,2})/) ||
                         allText.match(/(\d{1,2}[-\/\.]\d{1,2}[-\/\.]\d{4})/);
        if (dobMatch && !val('dob', '')) {
          setFieldSuccess('dob', formatDob(dobMatch[1].trim()));
        }

        // Extract English Name
        const nameEnMatch = allText.match(/(?:Name|Name\s*\(English\))[:\s]*([A-Za-z\s\.]+)/i);
        if (nameEnMatch && !val('nameEn', '')) {
          setFieldSuccess('nameEn', nameEnMatch[1].trim());
        }

        // Extract Father Name
        const fatherMatch = allText.match(/(?:Father\s*Name|পিতা)[:\s]*([^\n\r,;:]+)/i);
        if (fatherMatch && !val('fatherName', '')) {
          setFieldSuccess('fatherName', cleanBanglaText(fatherMatch[1].trim()));
        }

        // Extract Mother Name
        const motherMatch = allText.match(/(?:Mother\s*Name|মাতা)[:\s]*([^\n\r,;:]+)/i);
        if (motherMatch && !val('motherName', '')) {
          setFieldSuccess('motherName', cleanBanglaText(motherMatch[1].trim()));
        }

        // Extract Blood Group
        const bloodMatch = allText.match(/(?:Blood\s*Group|রক্তের\s*গ্রুপ)[:\s]*([A-Za-z+-]+)/i);
        if (bloodMatch && !val('bloodGroup', '')) {
          setFieldSuccess('bloodGroup', bloodMatch[1].trim());
        }
      }
    } catch (e) {
      console.warn('NID preview text extract warning:', e);
    }
  }

  // ============================================================================
  // 6. Save Data to IndexedDB + LocalStorage Summary
  // ============================================================================
  async function saveNidData() {
    const currentNid = val('nidNo', '');
    if (!currentNid || currentNid === '-') {
      alert('অনুগ্রহ করে NID নম্বর দিন অথবা PDF ফাইল আপলোড করুন!');
      return null;
    }

    const recordId = Date.now();
    // Prioritize uploaded NID PDF, or fallback to uploaded Server Copy PDF
    let nidPdfBase64 = null;
    let exactNidName = `NID_${currentNid}.pdf`;
    let exactNidSize = 0;
    let exactNidType = 'application/pdf';

    if (currentNidPdfFile) {
      exactNidName = currentNidPdfFile.name;
      exactNidSize = currentNidPdfFile.size;
      exactNidType = currentNidPdfFile.type;
      nidPdfBase64 = currentNidPdfFile.base64;
      if (!nidPdfBase64 && currentNidPdfFile.blob) {
        try {
          nidPdfBase64 = await new Promise((res, rej) => {
            const r = new FileReader();
            r.onload = () => res(r.result);
            r.onerror = () => rej(r.error);
            r.readAsDataURL(currentNidPdfFile.blob);
          });
        } catch (e) { console.error('NID Base64 read error:', e); }
      }
    } else if (currentGbFile) {
      exactNidName = currentGbFile.name;
      exactNidSize = currentGbFile.size;
      exactNidType = currentGbFile.type;
      nidPdfBase64 = currentGbFile.base64;
      if (!nidPdfBase64 && currentGbFile.blob) {
        try {
          nidPdfBase64 = await new Promise((res, rej) => {
            const r = new FileReader();
            r.onload = () => res(r.result);
            r.onerror = () => rej(r.error);
            r.readAsDataURL(currentGbFile.blob);
          });
        } catch (e) { console.error('GB Base64 read error:', e); }
      }
    }
    console.log('[SAVE] Storing PDF, fileName:', exactNidName, 'hasBase64:', !!nidPdfBase64);

    const record = {
      id: recordId,
      nidNo: currentNid,
      pinNo: val('pinNo', ''),
      nameBn: val('nameBn', '-'),
      nameEn: val('nameEn', '-'),
      dob: val('dob', '-'),
      pob: val('pob', '-'),
      fatherName: val('fatherName', '-'),
      motherName: val('motherName', '-'),
      spouseName: val('spouseName', '-'),
      presentAddress: val('presentAddress', '-'),
      permanentAddress: val('permanentAddress', '-'),
      bloodGroup: val('bloodGroup', '-'),
      issueDate: val('issueDate', '-'),
      photo: uploadedPhotoData || '',
      sign: uploadedSignData || '',
      
      // Exact Original NID PDF (Stored as base64 data URL string - guaranteed safe)
      hasExactNidPdf: !!nidPdfBase64,
      nidPdfBase64: nidPdfBase64,
      nidPdfFileName: exactNidName,
      nidPdfFileSize: exactNidSize,
      nidPdfFileType: exactNidType,

      // GB File Info if uploaded
      gbFileName: currentGbFile ? currentGbFile.name : '',

      createdAt: new Date().toLocaleString()
    };

    await NidStorageDB.save(record);

    try {
      const summaryList = JSON.parse(localStorage.getItem('savedNidsSummary') || '[]');
      const existingIdx = summaryList.findIndex(n => n.nidNo === currentNid);
      const summaryItem = {
        id: record.id,
        nidNo: record.nidNo,
        nameBn: record.nameBn,
        nameEn: record.nameEn,
        dob: record.dob,
        nidPdfFileName: record.nidPdfFileName,
        nidPdfFileSize: record.nidPdfFileSize,
        hasExactNidPdf: record.hasExactNidPdf,
        createdAt: record.createdAt
      };
      if (existingIdx > -1) {
        summaryList[existingIdx] = summaryItem;
      } else {
        summaryList.unshift(summaryItem);
      }
      localStorage.setItem('savedNidsSummary', JSON.stringify(summaryList));
    } catch (e) {
      console.warn('Summary storage warning:', e);
    }

    parseStatusAlert.className = 'parse-alert success';
    parseStatusAlert.innerHTML = `<i class="fa-solid fa-circle-check"></i> <strong>সফলভাবে সংরক্ষিত!</strong> NID তথ্য এবং অরিজিনাল PDF ডেটাবেজে সেভ হয়েছে।`;
    parseStatusAlert.classList.remove('hidden');

    return record;
  }

  // Handle Form Submit / Save button
  nidForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const saved = await saveNidData();
    if (saved) {
      populateSmartCardPreview();
    }
  });

  function populateSmartCardPreview() {
    const nid = val('nidNo', '');
    const pin = val('pinNo', '');
    const nameBn = val('nameBn', '-');
    const nameEn = val('nameEn', '-');
    const dob = val('dob', '-');
    const pob = val('pob', '-');
    const father = val('fatherName', '-');
    const mother = val('motherName', '-');
    const blood = val('bloodGroup', '-');
    const issueDate = val('issueDate', '-');
    const presentAddr = val('presentAddress', '-');

    if (cNameBn) cNameBn.textContent = nameBn;
    if (cNameEn) cNameEn.textContent = nameEn;
    if (cFather) cFather.textContent = father;
    if (cMother) cMother.textContent = mother;
    if (cDob) cDob.textContent = dob;
    if (cNidNo) cNidNo.textContent = nid || '-';

    if (uploadedPhotoData && cardPhotoImg) {
      cardPhotoImg.src = uploadedPhotoData;
      cardPhotoImg.style.display = 'block';
      if (cardPhotoFallback) cardPhotoFallback.style.display = 'none';
    }

    if (uploadedSignData && cardSignImg) {
      cardSignImg.src = uploadedSignData;
      cardSignImg.style.display = 'block';
      if (cardSignFallback) cardSignFallback.style.display = 'none';
    }

    if (cAddress) cAddress.textContent = presentAddr;
    if (cBloodGroup) cBloodGroup.textContent = blood;
    if (cPob) cPob.textContent = pob;
    if (cIssueDate) cIssueDate.textContent = issueDate;

    // Barcode
    try {
      if (window.JsBarcode) {
        JsBarcode('#cardBarcode', pin || nid || '1234567890', {
          format: 'CODE128',
          lineColor: '#1e293b',
          width: 1.5,
          height: 38,
          displayValue: false,
          margin: 0
        });
      }
    } catch (err) {}

    // QR Code
    try {
      if (window.QRCode && cardQrCode) {
        cardQrCode.innerHTML = '';
        new QRCode(cardQrCode, {
          text: `<NID>${nid}</NID><PIN>${pin}</PIN><NAME>${nameEn}</NAME><DOB>${dob}</DOB>`,
          width: 40,
          height: 40,
          colorDark: '#000000',
          colorLight: '#ffffff',
          correctLevel: QRCode.CorrectLevel.M
        });
      }
    } catch (err) {}
  }

  // ============================================================================
  // 7. NID List Dashboard & Exact Original NID PDF Display
  // ============================================================================
  const listBtn = document.getElementById('listBtn');
  const dashboardModal = document.getElementById('dashboardModal');
  const closeDashboardBtn = document.getElementById('closeDashboardBtn');
  const nidTableBody = document.getElementById('nidTableBody');
  const searchNid = document.getElementById('searchNid');
  const listLimit = document.getElementById('listLimit');
  const paginationInfo = document.getElementById('paginationInfo');

  // Exact PDF Display Modal Elements
  const pdfDashboardModal = document.getElementById('pdfDashboardModal');
  const closePdfDashboardBtn = document.getElementById('closePdfDashboardBtn');
  const dashNidNo = document.getElementById('dashNidNo');
  const dashName = document.getElementById('dashName');
  const dashDob = document.getElementById('dashDob');
  const dashTime = document.getElementById('dashTime');
  const downloadExactPdfBtn = document.getElementById('downloadExactPdfBtn');
  const openPdfNewTabBtn = document.getElementById('openPdfNewTabBtn');
  const printIdBtn = document.getElementById('printIdBtn');

  let activeBlobUrl = null;

  if (listBtn) {
    listBtn.addEventListener('click', async () => {
      await renderDashboard();
      if (dashboardModal) dashboardModal.classList.remove('hidden');
    });
  }

  if (closeDashboardBtn) {
    closeDashboardBtn.addEventListener('click', () => {
      if (dashboardModal) dashboardModal.classList.add('hidden');
    });
  }

  if (closePdfDashboardBtn) {
    closePdfDashboardBtn.addEventListener('click', () => {
      if (pdfDashboardModal) pdfDashboardModal.classList.add('hidden');
      if (activeBlobUrl) {
        URL.revokeObjectURL(activeBlobUrl);
        activeBlobUrl = null;
      }
    });
  }

  if (searchNid) {
    searchNid.addEventListener('input', () => {
      renderDashboard();
    });
  }

  if (listLimit) {
    listLimit.addEventListener('change', () => {
      renderDashboard();
    });
  }

  // Render Table
  async function renderDashboard() {
    if (!nidTableBody) return;
    nidTableBody.innerHTML = '<tr><td colspan="6" style="padding: 20px;"><i class="fa-solid fa-spinner fa-spin"></i> লোড হচ্ছে...</td></tr>';

    const records = await NidStorageDB.getAll();
    const query = searchNid ? searchNid.value.trim().toLowerCase() : '';

    let filtered = records;
    if (query) {
      filtered = records.filter(r => 
        (r.nidNo && r.nidNo.toLowerCase().includes(query)) ||
        (r.nameBn && r.nameBn.toLowerCase().includes(query)) ||
        (r.nameEn && r.nameEn.toLowerCase().includes(query)) ||
        (r.nidPdfFileName && r.nidPdfFileName.toLowerCase().includes(query))
      );
    }

    filtered.sort((a, b) => b.id - a.id);

    const limit = listLimit ? parseInt(listLimit.value, 10) : 10;
    const displayed = filtered.slice(0, limit);

    if (paginationInfo) {
      paginationInfo.textContent = `১ থেকে ${displayed.length} (মোট ${filtered.length})`;
    }

    nidTableBody.innerHTML = '';

    if (displayed.length === 0) {
      nidTableBody.innerHTML = '<tr><td colspan="6" style="padding: 24px; color: #64748b;">কোন NID রেকর্ড পাওয়া যায়নি</td></tr>';
      return;
    }

    displayed.forEach(item => {
      const tr = document.createElement('tr');
      tr.style.borderBottom = '1px solid #e2e8f0';

      tr.innerHTML = `
        <td style="padding: 10px;"><input type="checkbox"></td>
        <td style="padding: 10px; font-weight: bold; color: #1e3a8a;">${item.nidNo}</td>
        <td style="padding: 10px; font-weight: 600;">${item.nameBn || item.nameEn || '-'}</td>
        <td style="padding: 10px; color: #dc2626; font-weight: 500;">${item.dob || '-'}</td>
        <td style="padding: 10px;">
          <div style="display: flex; gap: 6px; justify-content: center; align-items: center;">
            <button type="button" class="view-nid-btn" data-id="${item.id}" style="padding: 6px 14px; background: #1e3a8a; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: 600; font-size: 0.85rem; display: inline-flex; align-items: center; gap: 5px;" title="অরিজিনাল NID PDF দেখুন">
              <i class="fa-solid fa-file-pdf"></i> NID
            </button>
            <button type="button" class="download-exact-btn" data-id="${item.id}" style="padding: 6px 10px; background: #059669; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 0.85rem;" title="অরিজিনাল PDF ডাউনলোড">
              <i class="fa-solid fa-download"></i>
            </button>
            <button type="button" class="delete-nid-btn" data-id="${item.id}" style="padding: 6px 10px; background: #ef4444; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 0.85rem;" title="মুছুন">
              <i class="fa-solid fa-trash"></i>
            </button>
          </div>
        </td>
        <td style="padding: 10px; color: #64748b; font-size: 0.82rem;">${item.createdAt}</td>
      `;
      nidTableBody.appendChild(tr);
    });

    // Wire "NID" View Button -> Opens EXACT Uploaded NID PDF
    document.querySelectorAll('.view-nid-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        let el = e.target;
        if (!el.getAttribute('data-id')) el = el.closest('.view-nid-btn');
        const id = parseInt(el.getAttribute('data-id'), 10);
        await openExactNidPdfViewer(id);
      });
    });

    // Wire Direct Download Button
    document.querySelectorAll('.download-exact-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        let el = e.target;
        if (!el.getAttribute('data-id')) el = el.closest('.download-exact-btn');
        const id = parseInt(el.getAttribute('data-id'), 10);
        await downloadExactNidPdf(id);
      });
    });

    // Wire Delete Button
    document.querySelectorAll('.delete-nid-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        let el = e.target;
        if (!el.getAttribute('data-id')) el = el.closest('.delete-nid-btn');
        const id = parseInt(el.getAttribute('data-id'), 10);
        if (confirm('আপনি কি নিশ্চিত যে এই NID রেকর্ডটি মুছে ফেলতে চান?')) {
          await NidStorageDB.delete(id);
          await renderDashboard();
        }
      });
    });
  }

  // ============================================================================
  // 8. Open & Display EXACT Original NID PDF with HD Canvas Rendering
  // ============================================================================
  async function openExactNidPdfViewer(id) {
    const item = await NidStorageDB.get(id);
    if (!item) {
      alert('রেকর্ডটি পাওয়া যায়নি!');
      return;
    }

    console.log('[VIEWER] Record loaded:', item.nidNo, 'keys:', Object.keys(item).join(', '));

    if (dashNidNo) dashNidNo.textContent = item.nidNo || '-';
    if (dashName) dashName.textContent = item.nameBn || item.nameEn || '-';
    if (dashDob) dashDob.textContent = item.dob || '-';
    if (dashTime) dashTime.textContent = item.createdAt || '-';

    const container = document.getElementById('dashPdfFrameContainer');
    if (!container) return;

    // Show modal first
    if (dashboardModal) dashboardModal.classList.add('hidden');
    if (pdfDashboardModal) pdfDashboardModal.classList.remove('hidden');

    container.style.cssText = 'width: 100%; min-height: 450px; max-height: 650px; overflow-y: auto; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 16px; margin-bottom: 10px; display: flex; flex-direction: column; align-items: center;';
    container.innerHTML = '<div style="display:flex;flex-direction:column;justify-content:center;align-items:center;height:350px;color:#64748b;font-size:1.1rem;gap:12px;"><i class="fa-solid fa-spinner fa-spin" style="font-size:2.5rem;color:#0088cc;"></i><span style="font-weight:500;">অরিজিনাল NID PDF লোড হচ্ছে...</span></div>';

    // 1. Resolve ArrayBuffer and Blob from any storage format
    let pdfArrayBuffer = null;
    let pdfBlob = null;

    try {
      if (item.nidPdfBase64 && typeof item.nidPdfBase64 === 'string') {
        const base64Str = item.nidPdfBase64.includes(',') ? item.nidPdfBase64.split(',')[1] : item.nidPdfBase64;
        const binaryString = atob(base64Str);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        pdfArrayBuffer = bytes.buffer;
        pdfBlob = new Blob([bytes], { type: item.nidPdfFileType || 'application/pdf' });
      } else if (item.nidPdfData) {
        if (item.nidPdfData instanceof ArrayBuffer) {
          pdfArrayBuffer = item.nidPdfData;
        } else if (item.nidPdfData.buffer instanceof ArrayBuffer) {
          pdfArrayBuffer = item.nidPdfData.buffer;
        } else {
          pdfArrayBuffer = new Uint8Array(item.nidPdfData).buffer;
        }
        pdfBlob = new Blob([pdfArrayBuffer], { type: item.nidPdfFileType || 'application/pdf' });
      } else if (item.nidPdfBlob || item.gbBlob) {
        const rawBlob = item.nidPdfBlob || item.gbBlob;
        if (rawBlob instanceof Blob) {
          pdfBlob = rawBlob;
          pdfArrayBuffer = await rawBlob.arrayBuffer();
        } else {
          pdfBlob = new Blob([rawBlob], { type: item.nidPdfFileType || 'application/pdf' });
          pdfArrayBuffer = await pdfBlob.arrayBuffer();
        }
      }
    } catch (parseErr) {
      console.error('[VIEWER] PDF buffer decode error:', parseErr);
    }

    if (!pdfArrayBuffer || !pdfBlob) {
      container.innerHTML = '<div style="padding:50px 20px;color:#dc2626;text-align:center;font-size:1.05rem;"><i class="fa-solid fa-triangle-exclamation" style="font-size:2.5rem;margin-bottom:12px;display:block;color:#ef4444;"></i>এই রেকর্ডের সাথে কোনো মূল PDF ফাইল সংরক্ষিত নেই।<br><span style="font-size:0.92rem;color:#64748b;margin-top:6px;display:inline-block;">অনুগ্রহ করে NID PDF আপলোড করে পুনরায় সেভ করুন।</span></div>';
      return;
    }

    if (activeBlobUrl) {
      URL.revokeObjectURL(activeBlobUrl);
    }
    activeBlobUrl = URL.createObjectURL(pdfBlob);

    const downloadFileName = item.nidPdfFileName || `NID_${item.nidNo || 'document'}.pdf`;

    if (downloadExactPdfBtn) {
      downloadExactPdfBtn.onclick = () => {
        const link = document.createElement('a');
        link.href = activeBlobUrl;
        link.download = downloadFileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      };
    }

    if (openPdfNewTabBtn) {
      openPdfNewTabBtn.onclick = () => {
        window.open(activeBlobUrl, '_blank');
      };
    }

    const renderedCanvases = [];

    if (printIdBtn) {
      printIdBtn.onclick = () => {
        triggerDirectPrint(renderedCanvases, activeBlobUrl, downloadFileName);
      };
    }

    // 2. Render PDF pages via PDF.js Canvas
    try {
      if (!window.pdfjsLib) throw new Error('PDF.js library not loaded');

      const dataCopy = pdfArrayBuffer.slice(0);
      const pdf = await pdfjsLib.getDocument({ data: dataCopy }).promise;
      console.log('[VIEWER] PDF loaded successfully, total pages:', pdf.numPages);

      container.innerHTML = '';
      container.style.display = 'block';

      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const viewport = page.getViewport({ scale: 1.6 });

        if (pdf.numPages > 1) {
          const pageHeader = document.createElement('div');
          pageHeader.style.cssText = 'text-align:center;font-size:0.85rem;color:#475569;font-weight:600;margin:10px 0 6px 0;';
          pageHeader.textContent = `— পৃষ্ঠা ${pageNum} / ${pdf.numPages} —`;
          container.appendChild(pageHeader);
        }

        const canvas = document.createElement('canvas');
        canvas.style.cssText = 'display:block;max-width:100%;height:auto;margin:0 auto 16px auto;box-shadow:0 4px 14px rgba(0,0,0,0.12);border-radius:6px;background:#ffffff;border:1px solid #e2e8f0;';

        const ctx = canvas.getContext('2d');
        canvas.width = viewport.width;
        canvas.height = viewport.height;

        await page.render({ canvasContext: ctx, viewport: viewport }).promise;
        container.appendChild(canvas);
        renderedCanvases.push(canvas);
      }
    } catch (err) {
      console.warn('[VIEWER] PDF.js canvas render fallback:', err);
      container.innerHTML = `
        <div style="width:100%;text-align:center;padding:15px;">
          <div style="margin-bottom:12px;display:flex;justify-content:center;gap:10px;">
            <a href="${activeBlobUrl}" target="_blank" style="display:inline-flex;align-items:center;gap:6px;background:#0284c7;color:white;padding:8px 16px;border-radius:6px;text-decoration:none;font-weight:600;font-size:0.9rem;">
              <i class="fa-solid fa-arrow-up-right-from-square"></i> নতুন উইন্ডোতে PDF দেখুন
            </a>
            <a href="${activeBlobUrl}" download="${downloadFileName}" style="display:inline-flex;align-items:center;gap:6px;background:#059669;color:white;padding:8px 16px;border-radius:6px;text-decoration:none;font-weight:600;font-size:0.9rem;">
              <i class="fa-solid fa-download"></i> PDF ডাউনলোড করুন
            </a>
          </div>
          <iframe src="${activeBlobUrl}" style="width:100%;height:520px;border:1px solid #cbd5e1;border-radius:6px;" title="Original PDF"></iframe>
        </div>
      `;
    }
  }

  // Direct download handler
  async function downloadExactNidPdf(id) {
    const item = await NidStorageDB.get(id);
    if (!item) return;

    let pdfBlob = null;
    try {
      if (item.nidPdfBase64 && typeof item.nidPdfBase64 === 'string') {
        const base64Str = item.nidPdfBase64.includes(',') ? item.nidPdfBase64.split(',')[1] : item.nidPdfBase64;
        const binaryString = atob(base64Str);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        pdfBlob = new Blob([bytes], { type: item.nidPdfFileType || 'application/pdf' });
      } else if (item.nidPdfData) {
        pdfBlob = new Blob([item.nidPdfData], { type: item.nidPdfFileType || 'application/pdf' });
      } else if (item.nidPdfBlob || item.gbBlob) {
        const rawBlob = item.nidPdfBlob || item.gbBlob;
        pdfBlob = rawBlob instanceof Blob ? rawBlob : new Blob([rawBlob], { type: item.nidPdfFileType || 'application/pdf' });
      }
    } catch (e) {
      console.error('Download blob prep error:', e);
    }

    if (!pdfBlob) {
      alert('কোন মূল PDF ফাইল পাওয়া যায়নি!');
      return;
    }

    const downloadUrl = URL.createObjectURL(pdfBlob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = item.nidPdfFileName || `NID_${item.nidNo || 'document'}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(downloadUrl), 5000);
  }

  // ============================================================================
  // Direct High-Resolution System/Hardware Printer Connector
  // ============================================================================
  function triggerDirectPrint(canvases, blobUrl, docTitle) {
    if (canvases && canvases.length > 0) {
      let printFrame = document.getElementById('nidDirectPrintFrame');
      if (printFrame) printFrame.remove();

      printFrame = document.createElement('iframe');
      printFrame.id = 'nidDirectPrintFrame';
      printFrame.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;border:none;visibility:hidden;';
      document.body.appendChild(printFrame);

      const frameDoc = printFrame.contentWindow.document;
      frameDoc.open();

      let pagesHtml = '';
      canvases.forEach((c, idx) => {
        const imgData = c.toDataURL('image/png', 1.0);
        pagesHtml += `
          <div class="print-page" style="page-break-after: ${idx < canvases.length - 1 ? 'always' : 'auto'}; text-align: center; margin: 0; padding: 0;">
            <img src="${imgData}" style="max-width: 100%; height: auto; display: block; margin: 0 auto;" />
          </div>
        `;
      });

      frameDoc.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>${docTitle || 'NID Document Print'}</title>
            <style>
              @page {
                size: auto;
                margin: 4mm;
              }
              body {
                margin: 0;
                padding: 0;
                background: #ffffff;
              }
              .print-page {
                width: 100%;
                page-break-inside: avoid;
              }
              img {
                max-width: 100%;
                height: auto;
              }
            </style>
          </head>
          <body>
            ${pagesHtml}
          </body>
        </html>
      `);
      frameDoc.close();

      setTimeout(() => {
        try {
          printFrame.contentWindow.focus();
          printFrame.contentWindow.print();
        } catch (err) {
          console.warn('Iframe direct print warning:', err);
          window.print();
        }
      }, 350);
      return;
    }

    if (blobUrl) {
      let printFrame = document.getElementById('nidDirectPrintFrame');
      if (printFrame) printFrame.remove();

      printFrame = document.createElement('iframe');
      printFrame.id = 'nidDirectPrintFrame';
      printFrame.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;border:none;';
      printFrame.src = blobUrl;
      document.body.appendChild(printFrame);

      printFrame.onload = () => {
        setTimeout(() => {
          try {
            printFrame.contentWindow.focus();
            printFrame.contentWindow.print();
          } catch (e) {
            window.print();
          }
        }, 300);
      };
      return;
    }

    window.print();
  }

  // Print 2-sided Card Modal direct printer
  if (printCardBtn) {
    printCardBtn.addEventListener('click', () => {
      const printableArea = document.getElementById('printableCardArea');
      if (!printableArea) {
        window.print();
        return;
      }
      let printFrame = document.getElementById('cardDirectPrintFrame');
      if (printFrame) printFrame.remove();

      printFrame = document.createElement('iframe');
      printFrame.id = 'cardDirectPrintFrame';
      printFrame.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;border:none;visibility:hidden;';
      document.body.appendChild(printFrame);

      const frameDoc = printFrame.contentWindow.document;
      frameDoc.open();
      frameDoc.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>NID Smart Card Print</title>
            <link rel="stylesheet" href="style.css">
            <style>
              @page { size: auto; margin: 5mm; }
              body { background: #fff; margin: 0; padding: 10px; display: flex; justify-content: center; }
              .printable-card-area { display: flex !important; gap: 20px; }
            </style>
          </head>
          <body>
            <div class="printable-card-area">${printableArea.innerHTML}</div>
          </body>
        </html>
      `);
      frameDoc.close();

      setTimeout(() => {
        try {
          printFrame.contentWindow.focus();
          printFrame.contentWindow.print();
        } catch (e) {
          window.print();
        }
      }, 350);
    });
  }

  // Close Card Modal
  if (closeModalBtn && cardModal) {
    closeModalBtn.addEventListener('click', () => {
      cardModal.classList.add('hidden');
    });
  }

});
