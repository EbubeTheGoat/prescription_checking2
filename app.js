// ============================================================
// app.js — Prescription Checker Frontend Logic
// ============================================================

const API_BASE_URL = "https://prescription-checking.onrender.com";

const checkBtn              = document.getElementById("check-btn");
const loadingSpinner        = document.getElementById("loading-spinner");
const resultsSection        = document.getElementById("results-section");
const fileInput             = document.getElementById("prescription-image");
const fileNameDisplay       = document.getElementById("file-name-display");
const drugNamesInput        = document.getElementById("drug-names");
const userEmailInput        = document.getElementById("user-email");
const uploadZone            = document.getElementById("upload-zone");

const resultDrugs           = document.getElementById("result-drugs");
const resultAnalysis        = document.getElementById("result-analysis");
const resultContraindications = document.getElementById("result-contraindications");
const resultEmailStatus     = document.getElementById("result-email-status");
const emailStatusCard       = document.getElementById("email-status-card");

// ── SECTION 3: FILE INPUT LISTENER ────────────────────────────────────────

fileInput.addEventListener("change", function () {
  if (this.files && this.files[0]) {
    fileNameDisplay.textContent = "✓ " + this.files[0].name;
  } else {
    fileNameDisplay.textContent = "";
  }
});

// ── SECTION 4: DRAG AND DROP ON THE UPLOAD ZONE ───────────────────────────

uploadZone.addEventListener("dragover", function (event) {
  event.preventDefault();
  this.classList.add("dragover");
});

uploadZone.addEventListener("dragleave", function () {
  this.classList.remove("dragover");
});

uploadZone.addEventListener("drop", function (event) {
  event.preventDefault();
  this.classList.remove("dragover");
  const droppedFile = event.dataTransfer.files[0];

  if (droppedFile) {
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(droppedFile);
    fileInput.files = dataTransfer.files;
    fileNameDisplay.textContent = "✓ " + droppedFile.name;
  }
});

// ── SECTION 4b: PASTE IMAGE SUPPORT ──────────────────────────────────────

document.addEventListener("paste", function (event) {
  const items = event.clipboardData && event.clipboardData.items;
  if (!items) return;

  for (let i = 0; i < items.length; i++) {
    if (items[i].type.startsWith("image/")) {
      const file = items[i].getAsFile();
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);
      fileInput.files = dataTransfer.files;
      fileNameDisplay.textContent = "✓ Pasted image";
      break;
    }
  }
});

// ── SECTION 5: MAIN BUTTON CLICK HANDLER (MODIFIED FOR STREAMING) ─────────

checkBtn.addEventListener("click", async function () {
  const hasImage     = fileInput.files && fileInput.files[0];
  const hasDrugNames = drugNamesInput.value.trim() !== "";

  if (!hasImage && !hasDrugNames) {
    alert("Please upload a prescription image OR enter drug names.");
    return;
  }

  checkBtn.disabled = true;
  loadingSpinner.style.display = "block";

  const formData = new FormData();
  if (hasImage) {
    formData.append("file", fileInput.files[0]);
  }
  if (hasDrugNames) {
    formData.append("drug_names", drugNamesInput.value.trim());
  }
  const email = userEmailInput.value.trim();
  if (email !== "") {
    formData.append("email", email);
  }

  try {
    const response = await fetch(`${API_BASE_URL}/full-check`, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || "An unknown error occurred.");
    }

    // ── Pre-Stream Setup ──
    resultDrugs.textContent = "Processing...";
    resultAnalysis.textContent = "Waiting for analysis...";
    resultContraindications.textContent = "Waiting for interaction check...";
    emailStatusCard.style.display = "none";
    resultsSection.style.display = "block";
    resultsSection.scrollIntoView({ behavior: "smooth" });

    // ── Stream Reading Logic ──
    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let done = false;
    let buffer = "";

    while (!done) {
      const { value, done: readerDone } = await reader.read();
      done = readerDone;

      if (value) {
        buffer += decoder.decode(value, { stream: true });
        let messages = buffer.split("\n\n");
        buffer = messages.pop();

        for (let message of messages) {
          if (message.startsWith("data: ")) {
            const jsonStr = message.replace("data: ", "").trim();
            
            try {
              const data = JSON.parse(jsonStr);

              // Update UI dynamically as data arrives
              if (data.error) {
                  throw new Error(data.error);
              }
              if (data.status) {
                  console.log("Status:", data.status); 
              }
              if (data.extracted_drugs) {
                  resultDrugs.textContent = data.extracted_drugs;
              }
              if (data.analysis) {
                  resultAnalysis.textContent = data.analysis;
              }
              if (data.contraindications) {
                  resultContraindications.textContent = data.contraindications;
              }
              if (data.email_status) {
                  resultEmailStatus.textContent = data.email_status;
                  emailStatusCard.style.display = "block";
              }

            } catch (e) {
              console.error("Error parsing stream chunk:", e, message);
            }
          }
        }
      }
    }

  } catch (error) {
    alert("Error: " + error.message);
    console.error("API Error:", error);
  } finally {
    checkBtn.disabled  = false;
    loadingSpinner.style.display = "none";
  }
});

// ── SECTION 6: RESET FORM FUNCTION ───────────────────────────────────────

function resetForm() {
  fileInput.value = "";
  fileNameDisplay.textContent = "";
  drugNamesInput.value = "";
  userEmailInput.value = "";
  resultsSection.style.display = "none";
  document.getElementById("checker").scrollIntoView({ behavior: "smooth" });
}
