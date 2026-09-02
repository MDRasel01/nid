/**
 * NID Information Management & Dynamic PDF Download Engine
 * Strict 13-Field Whitelist, Smart Card Generator & Complete Form-to-PDF Export System
 */

// ============================================================================
// 1. IndexedDB Storage Backend (Persistent & Lossless with LocalStorage Sync)
// ============================================================================
const NidStorageDB = {
  dbName: 'NidAppStrictDB',
  dbVersion: 2,
  storeName: 'nidRecords',
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
        console.warn('IndexedDB open error, fallback to localStorage:', e);
        resolve(null);
      };
    });
  },

  async save(record) {
    try {
      const db = await this.init();
      if (db) {
        await new Promise((resolve, reject) => {
          const tx = db.transaction(this.storeName, 'readwrite');
          const store = tx.objectStore(this.storeName);
          const req = store.put(record);
          req.onsuccess = () => resolve(record);
          req.onerror = (e) => reject(e);
        });
      }
    } catch (err) {
      console.warn('IndexedDB save notice:', err);
    }

    try {
      const records = JSON.parse(localStorage.getItem('allNidRecords') || '[]');
      const idx = records.findIndex(r => r.id === record.id || r.nidNo === record.nidNo);
      const localCopy = { ...record };
      delete localCopy.exactPdf;
      if (idx > -1) records[idx] = localCopy;
      else records.unshift(localCopy);
      localStorage.setItem('allNidRecords', JSON.stringify(records));
    } catch (e) {
      console.warn('localStorage sync notice:', e);
    }

    return record;
  },

  async get(id) {
    try {
      const db = await this.init();
      if (db) {
        const res = await new Promise((resolve, reject) => {
          const tx = db.transaction(this.storeName, 'readonly');
          const store = tx.objectStore(this.storeName);
          const req = store.get(id);
          req.onsuccess = () => resolve(req.result);
          req.onerror = (e) => reject(e);
        });
        if (res) return res;
      }
    } catch (err) {
      console.warn('IndexedDB get notice:', err);
    }

    try {
      const records = JSON.parse(localStorage.getItem('allNidRecords') || '[]');
      return records.find(r => r.id === id) || null;
    } catch (e) {
      return null;
    }
  },

  async getAll() {
    let list = [];
    try {
      const db = await this.init();
      if (db) {
        list = await new Promise((resolve, reject) => {
          const tx = db.transaction(this.storeName, 'readonly');
          const store = tx.objectStore(this.storeName);
          const req = store.getAll();
          req.onsuccess = () => resolve(req.result || []);
          req.onerror = (e) => reject(e);
        });
      }
    } catch (err) {
      console.warn('IndexedDB getAll notice:', err);
    }

    if (!list || list.length === 0) {
      try {
        list = JSON.parse(localStorage.getItem('allNidRecords') || '[]');
      } catch (e) {
        list = [];
      }
    }

    return list || [];
  },

  async delete(id) {
    try {
      const db = await this.init();
      if (db) {
        await new Promise((resolve, reject) => {
          const tx = db.transaction(this.storeName, 'readwrite');
          const store = tx.objectStore(this.storeName);
          const req = store.delete(id);
          req.onsuccess = () => resolve(true);
          req.onerror = (e) => reject(e);
        });
      }
    } catch (err) {
      console.warn('IndexedDB delete notice:', err);
    }

    try {
      let records = JSON.parse(localStorage.getItem('allNidRecords') || '[]');
      records = records.filter(r => r.id !== id);
      localStorage.setItem('allNidRecords', JSON.stringify(records));
    } catch (e) {}

    return true;
  },

  async clearAll() {
    try {
      const db = await this.init();
      if (db) {
        const tx = db.transaction(this.storeName, 'readwrite');
        tx.objectStore(this.storeName).clear();
      }
    } catch (e) {}
    localStorage.removeItem('allNidRecords');
    return true;
  }
};

NidStorageDB.init().catch(console.warn);

// ============================================================================
// 2. Main Application Logic & Dynamic PDF Engine
// ============================================================================
document.addEventListener('DOMContentLoaded', () => {

  // Form & Inputs
  const nidForm = document.getElementById('nidForm');
  const clearFormBtn = document.getElementById('clearFormBtn');
  const parseStatusAlert = document.getElementById('parseStatusAlert');
  const pdfInput = document.getElementById('pdfInput');
  const nidPdfInput = document.getElementById('nidPdfInput');
  const pdfDropZone = document.getElementById('pdfDropZone');
  const gbBadge = document.getElementById('gbBadge');
  const gbBadgeText = document.getElementById('gbBadgeText');
  const nidBadge = document.getElementById('nidBadge');
  const nidBadgeText = document.getElementById('nidBadgeText');

  // Photo & Signature
  const photoInput = document.getElementById('photoInput');
  const photoPreview = document.getElementById('photoPreview');
  const photoPlaceholder = document.getElementById('photoPlaceholder');
  const removePhotoBtn = document.getElementById('removePhotoBtn');
  const photoChosenText = document.getElementById('photoChosenText');

  const signInput = document.getElementById('signInput');
  const signPreview = document.getElementById('signPreview');
  const signPlaceholder = document.getElementById('signPlaceholder');

  // Action Buttons
  const saveBtn = document.getElementById('saveBtn');
  const generatePdfBtn = document.getElementById('generatePdfBtn');
  const listBtn = document.getElementById('listBtn');



  // Exact NID PDF Viewer Modal Elements
  const pdfDashboardModal = document.getElementById('pdfDashboardModal');
  const closePdfDashboardBtn = document.getElementById('closePdfDashboardBtn');
  const dashNidNo = document.getElementById('dashNidNo');
  const dashName = document.getElementById('dashName');
  const dashDob = document.getElementById('dashDob');
  const dashFileName = document.getElementById('dashFileName');
  const dashTime = document.getElementById('dashTime');
  const downloadExactPdfBtn = document.getElementById('downloadExactPdfBtn');
  const openPdfNewTabBtn = document.getElementById('openPdfNewTabBtn');
  const printIdBtn = document.getElementById('printIdBtn');
  const dashPdfFrameContainer = document.getElementById('dashPdfFrameContainer');

  // ID Card List Dashboard Elements
  const dashboardModal = document.getElementById('dashboardModal');
  const closeDashboardBtn = document.getElementById('closeDashboardBtn');
  const nidTableBody = document.getElementById('nidTableBody');
  const searchNid = document.getElementById('searchNid');
  const listLimit = document.getElementById('listLimit');
  const paginationInfo = document.getElementById('paginationInfo');
  const paginationControls = document.getElementById('paginationControls');
  const selectAll = document.getElementById('selectAll');
  const downloadSelectedPdfBtn = document.getElementById('downloadSelectedPdfBtn');
  const deleteSelectedBtn = document.getElementById('deleteSelectedBtn');
  const selectedCountSpan = document.getElementById('selectedCount');
  const clearAllRecordsBtn = document.getElementById('clearAllRecordsBtn');
  const loadSampleDataBtn = document.getElementById('loadSampleDataBtn');

  let currentUploadedPhotoData = '';
  let currentUploadedSignData = '';
  let currentExactNidPdfBlob = null;
  let currentPdfFileName = '';
  let currentSelectedYear = 'NEW';
  let activeModalRecord = null;
  let dashboardCurrentPage = 1;
  let selectedRecordIds = new Set();



  // ----------------------------------------------------
  // Year Tab Navigation
  // ----------------------------------------------------
  const tabButtons = document.querySelectorAll('.tab-btn');
  tabButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      tabButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentSelectedYear = btn.getAttribute('data-year') || 'NEW';
    });
  });

  // ----------------------------------------------------
  // Photo & Signature Handlers
  // ----------------------------------------------------
  if (photoInput) {
    photoInput.addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (ev) => setPhotoData(ev.target.result);
        reader.readAsDataURL(file);
      }
    });
  }

  if (removePhotoBtn) {
    removePhotoBtn.addEventListener('click', () => clearPhotoData());
  }

  function setPhotoData(dataUrl) {
    currentUploadedPhotoData = dataUrl || '';
    if (photoPreview && currentUploadedPhotoData) {
      photoPreview.src = currentUploadedPhotoData;
      photoPreview.classList.remove('hidden');
    }
    if (photoPlaceholder) photoPlaceholder.classList.add('hidden');
    if (removePhotoBtn) removePhotoBtn.classList.remove('hidden');
    if (photoChosenText) photoChosenText.textContent = 'ছবি লোড হয়েছে';
  }

  function clearPhotoData() {
    currentUploadedPhotoData = '';
    if (photoPreview) {
      photoPreview.src = '';
      photoPreview.classList.add('hidden');
    }
    if (photoPlaceholder) photoPlaceholder.classList.remove('hidden');
    if (removePhotoBtn) removePhotoBtn.classList.add('hidden');
    if (photoInput) photoInput.value = '';
    if (photoChosenText) photoChosenText.textContent = 'PDF থেকে অটো লোড হবে';
  }

  if (signInput) {
    signInput.addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (ev) => setSignData(ev.target.result);
        reader.readAsDataURL(file);
      }
    });
  }

  function setSignData(dataUrl) {
    currentUploadedSignData = dataUrl || '';
    if (signPreview && currentUploadedSignData) {
      signPreview.src = currentUploadedSignData;
      signPreview.classList.remove('hidden');
    }
    if (signPlaceholder) signPlaceholder.classList.add('hidden');
  }

  function clearSignData() {
    currentUploadedSignData = '';
    if (signPreview) {
      signPreview.src = '';
      signPreview.classList.add('hidden');
    }
    if (signPlaceholder) signPlaceholder.classList.remove('hidden');
    if (signInput) signInput.value = '';
  }

  // ----------------------------------------------------
  // Reset Form
  // ----------------------------------------------------
  if (clearFormBtn) {
    clearFormBtn.addEventListener('click', () => {
      nidForm.reset();
      clearPhotoData();
      clearSignData();
      currentExactNidPdfBlob = null;
      currentPdfFileName = '';
      if (gbBadge) gbBadge.classList.add('hidden');
      if (nidBadge) nidBadge.classList.add('hidden');
      if (parseStatusAlert) parseStatusAlert.classList.add('hidden');
    });
  }

  function val(id, fallback = '') {
    const el = document.getElementById(id);
    return el && el.value.trim() ? el.value.trim() : fallback;
  }

  function setFieldValue(id, value) {
    const el = document.getElementById(id);
    if (el && value !== undefined && value !== null && value !== '') {
      el.value = value.trim();
    }
  }

  // ----------------------------------------------------
  // Text Cleaning Utilities
  // ----------------------------------------------------
  function bengaliToEnglishDigits(str) {
    if (!str) return '';
    const bnNums = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
    return str.toString().replace(/[০-৯]/g, d => bnNums.indexOf(d));
  }

  function cleanBanglaText(str) {
    if (!str) return '';
    let cleaned = str.toString().trim();
    cleaned = cleaned.replace(/Fম\s*াঃ/g, 'মোঃ')
                     .replace(/ম\s*াঃ/g, 'মোঃ')
                     .replace(/Fপৗরসভ/g, 'পৌরসভা')
                     .replace(/প\s*\(1\)/g, 'পল্লী')
                     .replace(/চ\s*2\s*ম/g, 'চট্টগ্রাম')
                     .replace(/স\s*ত\s*কুW/g, 'সীতাকুন্ড')
                     .replace(/আবছ\s*র/g, 'আনোয়ার')
                     .replace(/আআয়শ/g, 'আয়েশা')
                     .replace(/খ\s*তন/g, 'খাতুন')
                     .replace(/উি\s*\]ন/g, 'উদ্দিন')
                     .replace(/িদ\s*ণ/g, 'দক্ষিণ');
    return cleaned.trim();
  }

  function formatDob(dateStr) {
    if (!dateStr) return '';
    const clean = bengaliToEnglishDigits(dateStr).trim();
    
    const ymdMatch = clean.match(/^(\d{4})[-\/\.](\d{1,2})[-\/\.](\d{1,2})$/);
    if (ymdMatch) {
      const year = ymdMatch[1];
      const month = parseInt(ymdMatch[2], 10);
      const day = parseInt(ymdMatch[3], 10);
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      if (month >= 1 && month <= 12) {
        return `${day < 10 ? '0' + day : day} ${monthNames[month - 1]} ${year}`;
      }
      return `${day < 10 ? '0' + day : day}/${month < 10 ? '0' + month : month}/${year}`;
    }

    const dmyMatch = clean.match(/^(\d{1,2})[-\/\.](\d{1,2})[-\/\.](\d{4})$/);
    if (dmyMatch) {
      const day = parseInt(dmyMatch[1], 10);
      const month = parseInt(dmyMatch[2], 10);
      const year = dmyMatch[3];
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      if (month >= 1 && month <= 12) {
        return `${day < 10 ? '0' + day : day} ${monthNames[month - 1]} ${year}`;
      }
      return `${day < 10 ? '0' + day : day}/${month < 10 ? '0' + month : month}/${year}`;
    }

    return dateStr;
  }

  // ----------------------------------------------------
  // Drag & Drop Listeners
  // ----------------------------------------------------
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
      if (files && files.length > 0 && files[0].name.toLowerCase().endsWith('.pdf')) {
        handlePdfUpload(files[0], 'server');
      } else {
        alert('অনুগ্রহ করে শুধুমাত্র PDF ফাইল আপলোড করুন!');
      }
    });
  }

  if (pdfInput) {
    pdfInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files.length > 0) {
        handlePdfUpload(e.target.files[0], 'server');
      }
      e.target.value = '';
    });
  }

  if (nidPdfInput) {
    nidPdfInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files.length > 0) {
        handlePdfUpload(e.target.files[0], 'nid');
      }
      e.target.value = '';
    });
  }

  // ============================================================================
  // 3. STRICT 13-FIELD INTELLIGENT WHITELIST PDF EXTRACTOR & OCR ENGINE
  // ============================================================================
  async function handlePdfUpload(file, uploadType = 'server') {
    if (!file) return;
    if (!window.pdfjsLib) {
      alert('PDF.js লাইব্রেরি লোড হতে পারেনি! অনুগ্রহ করে ইন্টারনেট সংযোগ চেক করুন।');
      return;
    }

    currentExactNidPdfBlob = file;
    currentPdfFileName = file.name || 'document.pdf';

    if (uploadType === 'nid') {
      if (nidBadge && nidBadgeText) {
        nidBadgeText.textContent = `NID PDF লোড হয়েছে: ${file.name}`;
        nidBadge.classList.remove('hidden');
      }
    } else {
      if (gbBadge && gbBadgeText) {
        gbBadgeText.textContent = `PDF লোড হয়েছে: ${file.name}`;
        gbBadge.classList.remove('hidden');
      }
    }

    if (parseStatusAlert) {
      parseStatusAlert.className = 'parse-alert processing';
      parseStatusAlert.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> PDF ফাইল প্রসেস করা হচ্ছে, ছবি ও ১৩টি নির্ধারিত ফিল্ড এক্সট্র্যাক্ট করা হচ্ছে...';
      parseStatusAlert.classList.remove('hidden');
    }

    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const numPages = pdf.numPages;

      let allTextLines = [];
      let fullTextCombined = '';

      for (let pageNum = 1; pageNum <= numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();
        
        let lineGroups = {};
        textContent.items.forEach(item => {
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

      fullTextCombined = allTextLines.join('\n');

      // Crop Photo & Signature
      try {
        const firstPage = await pdf.getPage(1);
        const viewport = firstPage.getViewport({ scale: 2.0 });
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        await firstPage.render({ canvasContext: ctx, viewport: viewport }).promise;

        // Crop Photo
        const photoCropX = Math.round(canvas.width * 0.70);
        const photoCropY = Math.round(canvas.height * 0.025);
        const photoCropW = Math.round(canvas.width * 0.26);
        const photoCropH = Math.round(canvas.height * 0.155);

        const photoCanvas = document.createElement('canvas');
        photoCanvas.width = photoCropW;
        photoCanvas.height = photoCropH;
        const pCtx = photoCanvas.getContext('2d');
        pCtx.drawImage(canvas, photoCropX, photoCropY, photoCropW, photoCropH, 0, 0, photoCropW, photoCropH);
        
        const photoDataUrl = photoCanvas.toDataURL('image/png');
        if (photoDataUrl && photoDataUrl.length > 500) {
          setPhotoData(photoDataUrl);
        }

        // Crop Signature
        const signCropX = Math.round(canvas.width * 0.70);
        const signCropY = Math.round(canvas.height * 0.18);
        const signCropW = Math.round(canvas.width * 0.26);
        const signCropH = Math.round(canvas.height * 0.06);

        const signCanvas = document.createElement('canvas');
        signCanvas.width = signCropW;
        signCanvas.height = signCropH;
        const sCtx = signCanvas.getContext('2d');
        sCtx.drawImage(canvas, signCropX, signCropY, signCropW, signCropH, 0, 0, signCropW, signCropH);

        const signDataUrl = signCanvas.toDataURL('image/png');
        if (signDataUrl && signDataUrl.length > 300) {
          setSignData(signDataUrl);
        }

      } catch (imgErr) {
        console.warn('Image extraction notice:', imgErr);
      }

      // OCR for scanned PDF
      if (fullTextCombined.trim().length < 25 && window.Tesseract) {
        if (parseStatusAlert) {
          parseStatusAlert.className = 'parse-alert processing';
          parseStatusAlert.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> স্ক্যান করা PDF শনাক্ত হয়েছে, OCR এর মাধ্যমে পড়া হচ্ছে...';
        }
        try {
          const page = await pdf.getPage(1);
          const viewport = page.getViewport({ scale: 2.0 });
          const ocrCanvas = document.createElement('canvas');
          ocrCanvas.width = viewport.width;
          ocrCanvas.height = viewport.height;
          const ctx = ocrCanvas.getContext('2d');
          await page.render({ canvasContext: ctx, viewport: viewport }).promise;

          const ocrResult = await Tesseract.recognize(ocrCanvas, 'ben+eng');
          if (ocrResult && ocrResult.data && ocrResult.data.text) {
            fullTextCombined = ocrResult.data.text;
            allTextLines = fullTextCombined.split('\n').map(l => l.trim()).filter(Boolean);
          }
        } catch (ocrErr) {
          console.warn('OCR Fallback notice:', ocrErr);
        }
      }

      // Strict Whitelist Matcher for the 13 fields
      const extractedData = extractWhitelistedFields(fullTextCombined, allTextLines);

      if (extractedData.nidNo) setFieldValue('nidNo', extractedData.nidNo);
      if (extractedData.nameBn) setFieldValue('nameBn', extractedData.nameBn);
      if (extractedData.dob) setFieldValue('dob', extractedData.dob);
      if (extractedData.fatherName) setFieldValue('fatherName', extractedData.fatherName);
      if (extractedData.bloodGroup) setFieldValue('bloodGroup', extractedData.bloodGroup);
      
      if (extractedData.idIdentify) setFieldValue('idIdentify', extractedData.idIdentify);
      if (extractedData.pinNo) setFieldValue('pinNo', extractedData.pinNo);
      if (extractedData.nameEn) setFieldValue('nameEn', extractedData.nameEn);
      if (extractedData.pob) setFieldValue('pob', extractedData.pob);
      if (extractedData.motherName) setFieldValue('motherName', extractedData.motherName);
      if (extractedData.issueDate) setFieldValue('issueDate', extractedData.issueDate);
      if (extractedData.address) setFieldValue('address', extractedData.address);

      if (parseStatusAlert) {
        parseStatusAlert.className = 'parse-alert success';
        parseStatusAlert.innerHTML = '<i class="fa-solid fa-circle-check"></i> <strong>সফল!</strong> PDF থেকে ছবি ও ১৩টি নির্ধারিত ফিল্ডের তথ্য সফলভাবে লোড হয়েছে।';
      }

    } catch (err) {
      console.error('PDF parsing error:', err);
      if (parseStatusAlert) {
        parseStatusAlert.className = 'parse-alert error';
        parseStatusAlert.innerHTML = `<i class="fa-solid fa-circle-xmark"></i> PDF পড়তে সমস্যা হয়েছে: ${err.message}`;
      }
    }
  }

  function extractWhitelistedFields(fullText, lines) {
    const singleLineText = lines.join(' ');
    const result = {
      nidNo: '',
      nameBn: '',
      dob: '',
      fatherName: '',
      bloodGroup: '',
      idIdentify: '',
      pinNo: '',
      nameEn: '',
      pob: '',
      motherName: '',
      issueDate: '',
      address: ''
    };

    function searchAliases(patterns, valPattern = null) {
      for (const p of patterns) {
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          const lineRegex = new RegExp('^\\s*' + p + '\\s*(?:[:=]|\b)(.*)$', 'i');
          const m = line.match(lineRegex);
          if (m && m[1] !== undefined) {
            let valStr = m[1].trim();
            valStr = valStr.replace(/^(?:No|নং|Number|নাম্বার|নম্বর)?\s*[:=\-\.]*\s*/i, '').trim();
            if (valStr) {
              if (valPattern) {
                const vMatch = valStr.match(new RegExp('^' + valPattern, 'i'));
                if (vMatch && vMatch[0]) return vMatch[0].trim();
              }
              return valStr;
            }
          }

          if (new RegExp('^\\s*' + p + '\\s*(?:No|নং|Number|নাম্বার|নম্বর)?\s*[:=]?\\s*$', 'i').test(line)) {
            if (i + 1 < lines.length && lines[i + 1].trim()) {
              let nextVal = lines[i + 1].trim();
              if (valPattern) {
                const vMatch = nextVal.match(new RegExp('^' + valPattern, 'i'));
                if (vMatch && vMatch[0]) return vMatch[0].trim();
              }
              return nextVal;
            }
          }
        }

        const regex1 = new RegExp('(?:^|[\\n\\r])\\s*' + p + '\\s*[:\\s=-]+\\s*([^\\n\\r]+)', 'i');
        const m1 = fullText.match(regex1);
        if (m1 && m1[1] && m1[1].trim()) {
          let valStr = m1[1].trim();
          valStr = valStr.replace(/^(?:No|নং|Number|নাম্বার|নম্বর)?\s*[:=\-\.]*\s*/i, '').trim();
          if (valPattern) {
            const vMatch = valStr.match(new RegExp('^' + valPattern, 'i'));
            if (vMatch && vMatch[0]) return vMatch[0].trim();
          }
          return valStr;
        }
      }
      return '';
    }

    // 1. NID No
    let rawNid = searchAliases(['National\\s*ID\\s*No', 'National\\s*ID', 'NationalID', 'NID\\s*No', 'জাতীয়\\s*পরিচয়পত্র\\s*নম্বর', 'আইডি\\s*নম্বর', 'আইডি\\s*নাম্বার', 'ID\\s*No', 'NID'], '\\d{10,17}');
    if (!rawNid) {
      const matchNid = fullText.match(/(?:NID|National\s*ID|ID\s*No)[:\s]*(\d{10,17})/i) || fullText.match(/\b(\d{10}|\d{13}|\d{17})\b/);
      if (matchNid) rawNid = matchNid[1];
    }
    result.nidNo = rawNid;

    // 2. PIN No
    let rawPin = searchAliases(['PIN\\s*No', 'PIN\\s*Number', 'পিন\\s*নম্বর', 'পিন\\s*নাম্বার', 'Pin', 'PIN', 'পিন'], '\\d{17}');
    if (!rawPin) {
      const matchPin = fullText.match(/Pin[:\s]*(\d{17})/i);
      if (matchPin) rawPin = matchPin[1];
    }
    result.pinNo = rawPin;

    // 3. Name (Bangla)
    const rawNameBn = searchAliases(['Name\\s*\\(?\\s*Bangla\\s*\\)?', 'Name\\(Bangla\\)', 'নাম\\s*\\(?\\s*বাংলা\\s*\\)?', 'বাংলা\\s*নাম', 'নাম']);
    result.nameBn = cleanBanglaText(rawNameBn);

    // 4. Name (English)
    const rawNameEn = searchAliases(['Name\\s*\\(?\\s*English\\s*\\)?', 'Name\\(English\\)', 'নাম\\s*\\(?\\s*ইংরেজি\\s*\\)?', 'English\\s*Name'], '[A-Za-z\\s\\.]+');
    result.nameEn = rawNameEn;

    // 5. DOB
    let rawDob = searchAliases(['Date\\s*of\\s*Birth', 'DateofBirth', 'জন্ম\\s*তারিখ', 'DOB', 'জন্মতারিখ'], '[0-9\\/\\-\\.\\sA-Za-z]+');
    if (!rawDob) {
      const dobMatch = fullText.match(/(\d{4}[-\/\.]\d{1,2}[-\/\.]\d{1,2})/) || fullText.match(/(\d{1,2}[-\/\.]\d{1,2}[-\/\.]\d{4})/) || fullText.match(/(\d{1,2}\s+[A-Za-z]{3}\s+\d{4})/);
      if (dobMatch) rawDob = dobMatch[1];
    }
    result.dob = formatDob(rawDob);

    // 6. POB
    const rawPob = searchAliases(['Place\\s*of\\s*Birth', 'Birth\\s*Place', 'BirthPlace', 'জন্মস্থান']);
    result.pob = cleanBanglaText(rawPob);

    // 7. Father
    const rawFather = searchAliases(['Father\'s\\s*Name', 'Father\\s*Name', 'FatherName', 'পিতার\\s*নাম', 'পিতা']);
    result.fatherName = cleanBanglaText(rawFather);

    // 8. Mother
    const rawMother = searchAliases(['Mother\'s\\s*Name', 'Mother\\s*Name', 'MotherName', 'মাতার\\s*নাম', 'মাতা']);
    result.motherName = cleanBanglaText(rawMother);

    // 9. Blood Group
    const rawBlood = searchAliases(['Blood\\s*Group', 'BloodGroup', 'রক্তের\\s*গ্রুপ', 'রক্ত\\s*গ্রুপ'], '[A-Za-z+-]+');
    result.bloodGroup = rawBlood;

    // 10. ID Identify
    const rawIdentify = searchAliases(['Identification\\s*Mark', 'Identification', 'শনাক্তকরণ\\s*চিহ্ন', 'আইডি\\s*সনাক্ত', 'Afis\\s*Status', 'Status']);
    result.idIdentify = cleanBanglaText(rawIdentify);

    // 11. Issue Date
    let rawIssueDate = searchAliases(['Date\\s*of\\s*Issue', 'Issue\\s*Date', 'ইস্যুর\\s*তারিখ', 'ইস্যু\\s*তারিখ', 'প্রদানের\\s*তারিখ', 'বিতরণের\\s*তারিখ'], '[0-9\\/\\-\\.]+');
    if (!rawIssueDate) {
      const issueMatch = fullText.match(/প্রদানের\s*তারিখ[:\s]*([0-9\/\-\.]+)/i) || fullText.match(/Issue\s*Date[:\s]*([0-9\/\-\.]+)/i);
      if (issueMatch) rawIssueDate = issueMatch[1];
    }
    result.issueDate = formatDob(rawIssueDate);

    // 12. Address
    let extractedAddr = '';
    const rawPresent = searchAliases(['Present\\s*Address', 'বর্তমান\\s*ঠিকানা']);
    const rawPermanent = searchAliases(['Permanent\\s*Address', 'স্থায়ী\\s*ঠিকানা', 'ঠিকানা']);
    if (rawPresent) {
      extractedAddr = rawPresent;
    } else if (rawPermanent) {
      extractedAddr = rawPermanent;
    } else {
      const addrLines = lines.filter(l => /(?:বাসা|হোল্ডিং|গ্রাম|রাস্তা|ডাকঘর|উপজেলা|থানা|জেলা|ওয়ার্ড|ইউনিয়ন)/i.test(l));
      if (addrLines.length > 0) {
        extractedAddr = addrLines.join(', ');
      }
    }
    result.address = cleanBanglaText(extractedAddr);

    return result;
  }

  // ============================================================================
  // 4. Save Record to Database
  // ============================================================================
  async function saveRecordData() {
    const currentNid = val('nidNo', '');
    if (!currentNid) {
      alert('অনুগ্রহ করে আইডি নাম্বার লিখুন অথবা PDF আপলোড করুন!');
      return null;
    }

    const record = {
      id: Date.now(),
      nidNo: currentNid,
      pinNo: val('pinNo', ''),
      nameBn: val('nameBn', ''),
      nameEn: val('nameEn', ''),
      dob: val('dob', ''),
      pob: val('pob', ''),
      fatherName: val('fatherName', ''),
      motherName: val('motherName', ''),
      bloodGroup: val('bloodGroup', ''),
      idIdentify: val('idIdentify', ''),
      issueDate: val('issueDate', ''),
      address: val('address', ''),
      photo: currentUploadedPhotoData || '',
      sign: currentUploadedSignData || '',
      exactPdf: currentExactNidPdfBlob || null,
      pdfFileName: currentPdfFileName || `NID_${currentNid}.pdf`,
      yearFormat: currentSelectedYear || 'NEW',
      createdAt: new Date().toLocaleString('bn-BD', { hour12: true })
    };

    await NidStorageDB.save(record);

    if (parseStatusAlert) {
      parseStatusAlert.className = 'parse-alert success';
      parseStatusAlert.innerHTML = `<i class="fa-solid fa-circle-check"></i> <strong>সফলভাবে সংরক্ষিত!</strong> আইডি কার্ড ও মূল PDF ডাটাবেজে সেভ হয়েছে।`;
      parseStatusAlert.classList.remove('hidden');
    }

    if (dashboardModal && !dashboardModal.classList.contains('hidden')) {
      renderDashboard();
    }

    return record;
  }

  nidForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    await saveRecordData();
  });

  // ============================================================================
  // 5. Original PDF Download & Form Preview Actions
  // ============================================================================
  function downloadOriginalPdf(record, buttonElement = null) {
    if (!record || !record.exactPdf) {
      alert('এই রেকর্ডের জন্য কোনো মূল আপলোডকৃত PDF ফাইল সংরক্ষিত নেই।');
      return;
    }

    let originalBtnHtml = '';
    if (buttonElement) {
      originalBtnHtml = buttonElement.innerHTML;
      buttonElement.disabled = true;
      buttonElement.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> ডাউনলোড হচ্ছে...';
    }

    try {
      const blob = record.exactPdf instanceof Blob 
        ? record.exactPdf 
        : new Blob([record.exactPdf], { type: 'application/pdf' });
      
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = record.pdfFileName || `NID_${record.nidNo || record.id}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      console.error('Download error:', err);
      alert('PDF ডাউনলোড করতে সমস্যা হয়েছে: ' + err.message);
    } finally {
      if (buttonElement && originalBtnHtml) {
        buttonElement.disabled = false;
        buttonElement.innerHTML = originalBtnHtml;
      }
    }
  }

  // Main Form Preview Button (Previews currently uploaded PDF)
  if (generatePdfBtn) {
    generatePdfBtn.addEventListener('click', () => {
      if (!currentExactNidPdfBlob) {
        alert('অনুগ্রহ করে প্রথমে একটি NID PDF ফাইল আপলোড করুন!');
        return;
      }
      const tempRecord = {
        id: Date.now(),
        nidNo: val('nidNo', '-'),
        pinNo: val('pinNo', '-'),
        nameBn: val('nameBn', '-'),
        nameEn: val('nameEn', '-'),
        dob: val('dob', '-'),
        exactPdf: currentExactNidPdfBlob,
        pdfFileName: currentPdfFileName || 'Uploaded_NID.pdf',
        createdAt: new Date().toLocaleString('bn-BD', { hour12: true })
      };
      openExactNidPdfViewer(tempRecord);
    });
  }

  // ============================================================================
  // 6. EXACT ORIGINAL NID PDF VIEWER MODAL (LOSSLESS PDF DISPLAY)
  // ============================================================================
  if (closePdfDashboardBtn && pdfDashboardModal) {
    closePdfDashboardBtn.addEventListener('click', () => {
      pdfDashboardModal.classList.add('hidden');
    });
  }

  async function openExactNidPdfViewer(record) {
    if (!record) return;
    activeModalRecord = record;

    if (dashNidNo) dashNidNo.textContent = record.nidNo || '-';
    if (dashName) dashName.textContent = record.nameBn || record.nameEn || '-';
    if (dashDob) dashDob.textContent = record.dob || '-';
    if (dashFileName) dashFileName.textContent = record.pdfFileName || (record.exactPdf ? 'NID_Document.pdf' : 'ফাইল নেই');
    if (dashTime) dashTime.textContent = record.createdAt || new Date().toLocaleString('bn-BD');

    if (dashPdfFrameContainer) {
      dashPdfFrameContainer.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 350px; color: #64748b; gap: 12px;">
          <i class="fa-solid fa-spinner fa-spin" style="font-size: 2.2rem; color: #0088cc;"></i>
          <span style="font-size: 1rem; font-weight: 500;">মূল NID PDF লোড হচ্ছে...</span>
        </div>
      `;
    }

    if (pdfDashboardModal) pdfDashboardModal.classList.remove('hidden');

    if (record.exactPdf && window.pdfjsLib) {
      try {
        let arrayBuffer;
        if (record.exactPdf instanceof Blob) {
          arrayBuffer = await record.exactPdf.arrayBuffer();
        } else if (record.exactPdf instanceof ArrayBuffer) {
          arrayBuffer = record.exactPdf;
        } else {
          arrayBuffer = await new Blob([record.exactPdf], { type: 'application/pdf' }).arrayBuffer();
        }

        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        dashPdfFrameContainer.innerHTML = '';

        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const viewport = page.getViewport({ scale: 1.8 });

          const pageWrapper = document.createElement('div');
          pageWrapper.style.cssText = 'margin-bottom: 24px; display: flex; flex-direction: column; align-items: center; width: 100%; max-width: 800px;';

          if (pdf.numPages > 1) {
            const pageLabel = document.createElement('div');
            pageLabel.style.cssText = 'font-size: 0.82rem; color: #64748b; margin-bottom: 6px; font-weight: 600; background: #e2e8f0; padding: 2px 10px; border-radius: 12px;';
            pageLabel.textContent = `পৃষ্ঠা ${i} / ${pdf.numPages}`;
            pageWrapper.appendChild(pageLabel);
          }

          const canvas = document.createElement('canvas');
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          canvas.style.maxWidth = '100%';
          canvas.style.height = 'auto';
          canvas.style.boxShadow = '0 3px 12px rgba(0,0,0,0.12)';
          canvas.style.borderRadius = '6px';
          canvas.style.background = '#ffffff';

          const ctx = canvas.getContext('2d');
          await page.render({ canvasContext: ctx, viewport: viewport }).promise;
          pageWrapper.appendChild(canvas);

          dashPdfFrameContainer.appendChild(pageWrapper);
        }
      } catch (err) {
        console.error('PDF render error:', err);
        dashPdfFrameContainer.innerHTML = `
          <div style="padding: 30px; text-align: center; color: #ef4444;">
            <i class="fa-solid fa-triangle-exclamation" style="font-size: 2rem; margin-bottom: 10px;"></i>
            <p style="font-weight: 600;">PDF রেন্ডার করতে সমস্যা হয়েছে: ${err.message}</p>
          </div>
        `;
      }
    } else {
      dashPdfFrameContainer.innerHTML = `
        <div style="background: #ffffff; border: 1.5px dashed #cbd5e1; border-radius: 8px; padding: 36px 20px; text-align: center; max-width: 550px; margin: 40px auto;">
          <i class="fa-solid fa-file-circle-xmark" style="font-size: 3rem; color: #94a3b8; margin-bottom: 14px;"></i>
          <h3 style="color: #334155; margin-bottom: 8px; font-size: 1.15rem;">কোনো মূল NID PDF ফাইল পাওয়া যায়নি</h3>
          <p style="color: #64748b; font-size: 0.92rem; line-height: 1.5;">
            এই রেকর্ডটির সাথে কোনো মূল NID PDF ফাইল সংযুক্ত নেই। মূল PDF ফাইল আপলোড করে সেভ করলে এখানে হুবহু সেই PDF ফাইলটি প্রিভিউ হিসেবে প্রদর্শিত হবে।
          </p>
        </div>
      `;
    }
  }

  if (downloadExactPdfBtn) {
    downloadExactPdfBtn.addEventListener('click', () => {
      if (activeModalRecord) {
        downloadOriginalPdf(activeModalRecord, downloadExactPdfBtn);
      }
    });
  }

  if (openPdfNewTabBtn) {
    openPdfNewTabBtn.addEventListener('click', () => {
      if (activeModalRecord && activeModalRecord.exactPdf) {
        const blob = activeModalRecord.exactPdf instanceof Blob 
          ? activeModalRecord.exactPdf 
          : new Blob([activeModalRecord.exactPdf], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
      } else {
        alert('এই রেকর্ডের জন্য কোনো মূল আপলোডকৃত PDF ফাইল সংরক্ষিত নেই।');
      }
    });
  }

  if (printIdBtn) {
    printIdBtn.addEventListener('click', () => {
      if (activeModalRecord && activeModalRecord.exactPdf) {
        const blob = activeModalRecord.exactPdf instanceof Blob 
          ? activeModalRecord.exactPdf 
          : new Blob([activeModalRecord.exactPdf], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const printWindow = window.open(url, '_blank');
        if (printWindow) {
          printWindow.focus();
        }
      } else {
        window.print();
      }
    });
  }

  // ============================================================================
  // 7. FULLY FUNCTIONAL ID CARD LIST & EXACT PDF DOWNLOAD SYSTEM
  // ============================================================================
  if (listBtn) {
    listBtn.addEventListener('click', async () => {
      dashboardCurrentPage = 1;
      selectedRecordIds.clear();
      await renderDashboard();
      if (dashboardModal) dashboardModal.classList.remove('hidden');
    });
  }

  if (closeDashboardBtn && dashboardModal) {
    closeDashboardBtn.addEventListener('click', () => {
      dashboardModal.classList.add('hidden');
    });
  }

  // Close modals on overlay click or Escape key
  [pdfDashboardModal, dashboardModal].forEach(modal => {
    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          modal.classList.add('hidden');
        }
      });
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (pdfDashboardModal) pdfDashboardModal.classList.add('hidden');
      if (dashboardModal) dashboardModal.classList.add('hidden');
    }
  });

  if (searchNid) {
    searchNid.addEventListener('input', () => {
      dashboardCurrentPage = 1;
      renderDashboard();
    });
  }

  if (listLimit) {
    listLimit.addEventListener('change', () => {
      dashboardCurrentPage = 1;
      renderDashboard();
    });
  }

  if (selectAll) {
    selectAll.addEventListener('change', () => {
      const checkboxes = document.querySelectorAll('.record-checkbox');
      checkboxes.forEach(cb => {
        cb.checked = selectAll.checked;
        const id = parseInt(cb.getAttribute('data-id'), 10);
        if (selectAll.checked) selectedRecordIds.add(id);
        else selectedRecordIds.delete(id);
      });
      updateSelectedCount();
    });
  }

  // Batch PDF Download of exact original uploaded files
  if (downloadSelectedPdfBtn) {
    downloadSelectedPdfBtn.addEventListener('click', async () => {
      if (selectedRecordIds.size === 0) return;
      
      const records = await NidStorageDB.getAll();
      const selectedRecords = records.filter(r => selectedRecordIds.has(r.id));
      
      if (selectedRecords.length === 0) return;

      downloadSelectedPdfBtn.disabled = true;
      downloadSelectedPdfBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> ডাউনলোড হচ্ছে...';

      let downloadedCount = 0;
      for (let i = 0; i < selectedRecords.length; i++) {
        const rec = selectedRecords[i];
        if (rec.exactPdf) {
          downloadOriginalPdf(rec);
          downloadedCount++;
          await new Promise(r => setTimeout(r, 400));
        }
      }

      if (downloadedCount === 0) {
        alert('নির্বাচিত রেকর্ডগুলোর জন্য কোনো মূল PDF ফাইল পাওয়া যায়নি।');
      }

      downloadSelectedPdfBtn.disabled = false;
      updateSelectedCount();
    });
  }

  // Batch Delete
  if (deleteSelectedBtn) {
    deleteSelectedBtn.addEventListener('click', async () => {
      if (selectedRecordIds.size === 0) return;
      if (confirm(`আপনি কি নিশ্চিত যে নির্বাচিত ${selectedRecordIds.size} টি রেকর্ড মুছে ফেলতে চান?`)) {
        for (const id of selectedRecordIds) {
          await NidStorageDB.delete(id);
        }
        selectedRecordIds.clear();
        await renderDashboard();
      }
    });
  }

  if (clearAllRecordsBtn) {
    clearAllRecordsBtn.addEventListener('click', async () => {
      if (confirm('আপনি কি নিশ্চিত যে সমস্ত সংরক্ষিত NID রেকর্ড মুছে ফেলতে চান?')) {
        await NidStorageDB.clearAll();
        selectedRecordIds.clear();
        await renderDashboard();
      }
    });
  }

  function updateSelectedCount() {
    const count = selectedRecordIds.size;
    if (selectedCountSpan) selectedCountSpan.textContent = count;
    if (downloadSelectedPdfBtn) {
      downloadSelectedPdfBtn.style.display = count > 0 ? 'inline-flex' : 'none';
      downloadSelectedPdfBtn.innerHTML = `<i class="fa-solid fa-file-arrow-down"></i> নির্বাচিত PDF ডাউনলোড (${count})`;
    }
    if (deleteSelectedBtn) {
      deleteSelectedBtn.style.display = count > 0 ? 'inline-flex' : 'none';
    }
  }

  async function renderDashboard() {
    if (!nidTableBody) return;
    nidTableBody.innerHTML = '<tr><td colspan="6" style="padding: 24px;"><i class="fa-solid fa-spinner fa-spin"></i> ডাটাবেজ লোড হচ্ছে...</td></tr>';

    const records = await NidStorageDB.getAll();
    const query = searchNid ? searchNid.value.trim().toLowerCase() : '';

    let filtered = records;
    if (query) {
      filtered = records.filter(r => 
        (r.nidNo && r.nidNo.toLowerCase().includes(query)) ||
        (r.nameBn && r.nameBn.toLowerCase().includes(query)) ||
        (r.nameEn && r.nameEn.toLowerCase().includes(query)) ||
        (r.dob && r.dob.toLowerCase().includes(query)) ||
        (r.fatherName && r.fatherName.toLowerCase().includes(query)) ||
        (r.motherName && r.motherName.toLowerCase().includes(query))
      );
    }

    filtered.sort((a, b) => b.id - a.id);

    const limit = listLimit ? parseInt(listLimit.value, 10) : 10;
    const totalItems = filtered.length;
    const totalPages = Math.ceil(totalItems / limit) || 1;

    if (dashboardCurrentPage > totalPages) dashboardCurrentPage = totalPages;
    if (dashboardCurrentPage < 1) dashboardCurrentPage = 1;

    const startIndex = (dashboardCurrentPage - 1) * limit;
    const endIndex = Math.min(startIndex + limit, totalItems);
    const displayed = filtered.slice(startIndex, endIndex);

    if (paginationInfo) {
      paginationInfo.textContent = totalItems > 0 
        ? `${startIndex + 1} থেকে ${endIndex} (মোট ${totalItems})` 
        : '১ থেকে ০ (মোট ০)';
    }

    // Pagination Buttons
    if (paginationControls) {
      paginationControls.innerHTML = '';
      
      const prevBtn = document.createElement('button');
      prevBtn.innerHTML = '<i class="fa-solid fa-chevron-left"></i> আগে';
      prevBtn.style.cssText = `padding: 5px 12px; border: 1px solid #cbd5e1; background: ${dashboardCurrentPage === 1 ? '#f1f5f9' : '#ffffff'}; border-radius: 4px; cursor: ${dashboardCurrentPage === 1 ? 'not-allowed' : 'pointer'}; color: ${dashboardCurrentPage === 1 ? '#94a3b8' : '#334155'}; font-size: 0.85rem; font-weight: 500;`;
      prevBtn.disabled = dashboardCurrentPage === 1;
      prevBtn.addEventListener('click', () => {
        if (dashboardCurrentPage > 1) {
          dashboardCurrentPage--;
          renderDashboard();
        }
      });
      paginationControls.appendChild(prevBtn);

      for (let p = 1; p <= totalPages; p++) {
        const pageBtn = document.createElement('button');
        pageBtn.textContent = p;
        pageBtn.style.cssText = `padding: 5px 12px; border: none; border-radius: 4px; font-weight: bold; font-size: 0.85rem; cursor: pointer; background: ${p === dashboardCurrentPage ? '#1e3a8a' : '#e2e8f0'}; color: ${p === dashboardCurrentPage ? '#ffffff' : '#334155'};`;
        pageBtn.addEventListener('click', () => {
          dashboardCurrentPage = p;
          renderDashboard();
        });
        paginationControls.appendChild(pageBtn);
      }

      const nextBtn = document.createElement('button');
      nextBtn.innerHTML = 'পরে <i class="fa-solid fa-chevron-right"></i>';
      nextBtn.style.cssText = `padding: 5px 12px; border: 1px solid #cbd5e1; background: ${dashboardCurrentPage === totalPages ? '#f1f5f9' : '#ffffff'}; border-radius: 4px; cursor: ${dashboardCurrentPage === totalPages ? 'not-allowed' : 'pointer'}; color: ${dashboardCurrentPage === totalPages ? '#94a3b8' : '#334155'}; font-size: 0.85rem; font-weight: 500;`;
      nextBtn.disabled = dashboardCurrentPage === totalPages;
      nextBtn.addEventListener('click', () => {
        if (dashboardCurrentPage < totalPages) {
          dashboardCurrentPage++;
          renderDashboard();
        }
      });
      paginationControls.appendChild(nextBtn);
    }

    nidTableBody.innerHTML = '';

    if (displayed.length === 0) {
      nidTableBody.innerHTML = `
        <tr>
          <td colspan="6" style="padding: 32px; color: #64748b;">
            <div style="display: flex; flex-direction: column; align-items: center; gap: 8px;">
              <i class="fa-solid fa-folder-open" style="font-size: 2.2rem; color: #cbd5e1;"></i>
              <span style="font-weight: 600;">কোন সংরক্ষিত NID রেকর্ড পাওয়া যায়নি</span>
            </div>
          </td>
        </tr>
      `;
      return;
    }

    displayed.forEach(item => {
      const tr = document.createElement('tr');
      tr.style.borderBottom = '1px solid #e2e8f0';
      const isChecked = selectedRecordIds.has(item.id);

      tr.innerHTML = `
        <td style="padding: 10px;"><input type="checkbox" class="record-checkbox" data-id="${item.id}" ${isChecked ? 'checked' : ''} style="cursor: pointer;"></td>
        <td style="padding: 10px; font-weight: bold; color: #1e3a8a; font-family: var(--font-mono); font-size: 0.92rem;">${item.nidNo}</td>
        <td style="padding: 10px; font-weight: 600; font-family: var(--font-bn);">${item.nameBn || item.nameEn || '-'}</td>
        <td style="padding: 10px; color: #dc2626; font-weight: 600;">${item.dob || '-'}</td>
        <td style="padding: 10px;">
          <div style="display: flex; gap: 6px; justify-content: center; align-items: center; flex-wrap: wrap;">
            
            <!-- EXACT ORIGINAL PDF PREVIEW BUTTON -->
            <button type="button" class="btn-preview-pdf" data-id="${item.id}" style="padding: 6px 12px; background: #0088cc; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 0.85rem; font-weight: 700; display: inline-flex; align-items: center; gap: 5px; box-shadow: 0 1px 3px rgba(0,136,204,0.3);" title="মূল আপলোডকৃত PDF প্রিভিউ দেখুন">
              <i class="fa-solid fa-file-pdf"></i> প্রিভিউ
            </button>

            <!-- EXACT ORIGINAL PDF DOWNLOAD BUTTON -->
            <button type="button" class="btn-download-pdf-row" data-id="${item.id}" style="padding: 6px 12px; background: #059669; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 0.85rem; font-weight: 700; display: inline-flex; align-items: center; gap: 5px; box-shadow: 0 1px 3px rgba(5,150,105,0.3);" title="মূল আপলোডকৃত PDF ডাউনলোড করুন">
              <i class="fa-solid fa-download"></i> ডাউনলোড
            </button>

            <!-- OPEN ORIGINAL PDF IN NEW TAB -->
            <button type="button" class="btn-open-tab" data-id="${item.id}" style="padding: 6px 8px; background: #0284c7; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 0.82rem;" title="নতুন ট্যাবে মূল PDF খুলুন">
              <i class="fa-solid fa-arrow-up-right-from-square"></i>
            </button>

            <!-- Load into Form Button -->
            <button type="button" class="load-nid-btn" data-id="${item.id}" style="padding: 6px 8px; background: #1e3a8a; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 0.82rem;" title="ফর্মে লোড">
              <i class="fa-solid fa-pen-to-square"></i>
            </button>

            <!-- Delete Button -->
            <button type="button" class="delete-nid-btn" data-id="${item.id}" style="padding: 6px 8px; background: #ef4444; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 0.82rem;" title="মুছুন">
              <i class="fa-solid fa-trash"></i>
            </button>
          </div>
        </td>
        <td style="padding: 10px; color: #64748b; font-size: 0.82rem;">${item.createdAt || '-'}</td>
      `;
      nidTableBody.appendChild(tr);
    });

    // Checkbox events
    document.querySelectorAll('.record-checkbox').forEach(cb => {
      cb.addEventListener('change', (e) => {
        const id = parseInt(e.target.getAttribute('data-id'), 10);
        if (e.target.checked) selectedRecordIds.add(id);
        else selectedRecordIds.delete(id);
        updateSelectedCount();
      });
    });

    // Wire Exact Original PDF Preview button in row
    document.querySelectorAll('.btn-preview-pdf').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        let el = e.target;
        if (!el.getAttribute('data-id')) el = el.closest('.btn-preview-pdf');
        const id = parseInt(el.getAttribute('data-id'), 10);
        const item = await NidStorageDB.get(id);
        if (item) {
          openExactNidPdfViewer(item);
        }
      });
    });

    // Wire Exact Original PDF Download button in row
    document.querySelectorAll('.btn-download-pdf-row').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        let el = e.target;
        if (!el.getAttribute('data-id')) el = el.closest('.btn-download-pdf-row');
        const id = parseInt(el.getAttribute('data-id'), 10);
        const item = await NidStorageDB.get(id);
        if (item) {
          downloadOriginalPdf(item, el);
        }
      });
    });

    // Wire Open Original PDF in New Tab button in row
    document.querySelectorAll('.btn-open-tab').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        let el = e.target;
        if (!el.getAttribute('data-id')) el = el.closest('.btn-open-tab');
        const id = parseInt(el.getAttribute('data-id'), 10);
        const item = await NidStorageDB.get(id);
        if (item && item.exactPdf) {
          const blob = item.exactPdf instanceof Blob 
            ? item.exactPdf 
            : new Blob([item.exactPdf], { type: 'application/pdf' });
          const url = URL.createObjectURL(blob);
          window.open(url, '_blank');
        } else {
          alert('এই রেকর্ডের জন্য কোনো মূল আপলোডকৃত PDF ফাইল সংরক্ষিত নেই।');
        }
      });
    });

    // Wire Load into form button
    document.querySelectorAll('.load-nid-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        let el = e.target;
        if (!el.getAttribute('data-id')) el = el.closest('.load-nid-btn');
        const id = parseInt(el.getAttribute('data-id'), 10);
        const item = await NidStorageDB.get(id);
        if (item) {
          setFieldValue('nidNo', item.nidNo);
          setFieldValue('pinNo', item.pinNo);
          setFieldValue('nameBn', item.nameBn);
          setFieldValue('nameEn', item.nameEn);
          setFieldValue('dob', item.dob);
          setFieldValue('pob', item.pob);
          setFieldValue('fatherName', item.fatherName);
          setFieldValue('motherName', item.motherName);
          setFieldValue('bloodGroup', item.bloodGroup);
          setFieldValue('idIdentify', item.idIdentify);
          setFieldValue('issueDate', item.issueDate);
          setFieldValue('address', item.address);
          if (item.photo) setPhotoData(item.photo);
          else clearPhotoData();
          if (item.sign) setSignData(item.sign);
          else clearSignData();
          if (item.exactPdf) {
            currentExactNidPdfBlob = item.exactPdf;
            currentPdfFileName = item.pdfFileName || `NID_${item.nidNo}.pdf`;
            if (gbBadge && gbBadgeText) {
              gbBadgeText.textContent = `PDF লোড হয়েছে: ${currentPdfFileName}`;
              gbBadge.classList.remove('hidden');
            }
          }

          if (dashboardModal) dashboardModal.classList.add('hidden');

          if (parseStatusAlert) {
            parseStatusAlert.className = 'parse-alert success';
            parseStatusAlert.innerHTML = `<i class="fa-solid fa-circle-check"></i> <strong>আইডি (${item.nidNo})</strong> এর তথ্য ও মূল PDF ফর্মে লোড হয়েছে।`;
            parseStatusAlert.classList.remove('hidden');
          }
        }
      });
    });

    // Wire Delete button
    document.querySelectorAll('.delete-nid-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        let el = e.target;
        if (!el.getAttribute('data-id')) el = el.closest('.delete-nid-btn');
        const id = parseInt(el.getAttribute('data-id'), 10);
        if (confirm('আপনি কি নিশ্চিত যে এই রেকর্ডটি মুছে ফেলতে চান?')) {
          await NidStorageDB.delete(id);
          selectedRecordIds.delete(id);
          updateSelectedCount();
          await renderDashboard();
        }
      });
    });

    updateSelectedCount();
  }

});
