// ============================================================
// app.js — Prescription Checker Frontend Logic
//
// This file handles everything the user DOES on the page:
//   1. Detecting when a file is selected for upload
//   2. Sending data to the backend API
//   3. Displaying the results on the page
//   4. Resetting the form for another check
//
// BEGINNER TIP: JavaScript files linked in HTML run top-to-bottom.
// Code inside functions only runs when that function is CALLED.
// ============================================================


// ── SECTION 1: CONFIGURATION ─────────────────────────────────────────────

// This is the URL of your FastAPI backend server.
// Change this to your actual server address when you deploy.
// Example: "https://your-app.onrender.com" or "http://localhost:8000"
const API_BASE_URL = "https://prescription-checking.onrender.com";

// ── SECTION 2: GETTING REFERENCES TO HTML ELEMENTS ────────────────────────
//
// document.getElementById("some-id") finds an HTML element by its id="..."
// attribute and gives us a JavaScript reference to it.
// We store these in variables so we can reuse them without searching again.

const checkBtn              = document.getElementById("check-btn");
const loadingSpinner        = document.getElementById("loading-spinner");
const resultsSection        = document.getElementById("results-section");
const fileInput             = document.getElementById("prescription-image");
const fileNameDisplay       = document.getElementById("file-name-display");
const drugNamesInput        = document.getElementById("drug-names");
const userEmailInput        = document.getElementById("user-email");
const uploadZone            = document.getElementById("upload-zone");

// Result display elements (where we'll write the API's response)
const resultDrugs           = document.getElementById("result-drugs");
const resultAnalysis        = document.getElementById("result-analysis");
const resultContraindications = document.getElementById("result-contraindications");
const resultEmailStatus     = document.getElementById("result-email-status");
const emailStatusCard       = document.getElementById("email-status-card");


// ── SECTION 3: FILE INPUT LISTENER ────────────────────────────────────────
//
// "addEventListener" watches for a specific event on an element.
// When the event happens, it runs the function we provide.
// Here we listen for "change" — when the user selects a new file.

fileInput.addEventListener("change", function () {
  // "this" refers to the element the event is attached to — the file input.
  // "this.files" is an array-like list of selected files.
  // "this.files[0]" is the first (and usually only) selected file.

  if (this.files && this.files[0]) {
    // If a file was selected, show its name below the upload zone
    fileNameDisplay.textContent = "✓ " + this.files[0].name;
    // .textContent sets the visible text inside an element
  } else {
    // If no file, clear the display
    fileNameDisplay.textContent = "";
  }
});


// ── SECTION 4: DRAG AND DROP ON THE UPLOAD ZONE ───────────────────────────
//
// We add visual feedback when the user drags a file over the upload area.

uploadZone.addEventListener("dragover", function (event) {
  event.preventDefault();
  // event.preventDefault() stops the browser's default behavior.
  // By default, dropping a file would open it in the browser — we don't want that.

  this.classList.add("dragover");
  // classList.add() adds a CSS class to the element.
  // "dragover" is a CSS class we defined to change the border/background color.
});

uploadZone.addEventListener("dragleave", function () {
  // When the user's drag leaves the zone, remove the visual highlight
  this.classList.remove("dragover");
});

uploadZone.addEventListener("drop", function (event) {
  event.preventDefault();
  this.classList.remove("dragover");

  // event.dataTransfer.files contains the files dropped onto the element
  const droppedFile = event.dataTransfer.files[0];

  if (droppedFile) {
    // Manually assign the dropped file to the real file input.
    // DataTransfer is a browser API that lets us do this.
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(droppedFile);
    fileInput.files = dataTransfer.files;

    // Show the dropped file's name
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

// ── SECTION 5: MAIN BUTTON CLICK HANDLER ─────────────────────────────────
//
// When the user clicks "Run Prescription Check", this function runs.

checkBtn.addEventListener("click", async function () {
  // "async function" means this function can use "await" inside it.
  // await pauses execution until a slow task (like an API call) finishes,
  // without freezing the browser.

  // ── Step 5a: Validate Input ──────────────────────────
  // Make sure the user provided at least one of: image OR drug names text

  const hasImage     = fileInput.files && fileInput.files[0];
  // Checks if a file was selected

  const hasDrugNames = drugNamesInput.value.trim() !== "";
  // .value gets the text typed into an input/textarea
  // .trim() removes whitespace from both ends
  // !=="": checks that it's not empty after trimming

  if (!hasImage && !hasDrugNames) {
    // If neither was provided, show a Bootstrap alert and stop
    alert("Please upload a prescription image OR enter drug names.");
    return;
    // "return" exits the function immediately — nothing below this runs
  }

  // ── Step 5b: Show Loading State ──────────────────────
  // Disable the button and show the spinner while we wait for the API

  checkBtn.disabled = true;
  // Grays out the button so the user can't click again while loading

  loadingSpinner.style.display = "block";
  // .style.display = "block" overrides CSS to make the spinner visible

  resultsSection.style.display = "none";
  // Hide any old results from a previous check

  // ── Step 5c: Build the FormData Object ───────────────
  //
  // FormData is a browser API for building form submissions.
  // It works like a key-value dictionary. Our backend expects:
  //   - "file"       (the image, optional)
  //   - "drug_names" (text, optional)
  //   - "email"      (text, optional)

  const formData = new FormData();

  if (hasImage) {
    formData.append("file", fileInput.files[0]);
    // .append(key, value) adds a field to the FormData object
  }

  if (hasDrugNames) {
    formData.append("drug_names", drugNamesInput.value.trim());
  }

  const email = userEmailInput.value.trim();
  if (email !== "") {
    formData.append("email", email);
  }

  // ── Step 5d: Call the Backend API ────────────────────
  //
  // fetch() is the modern browser API for making HTTP requests.
  // It's built into all modern browsers — no library needed.
  // 
  // We use "try...catch" to handle errors gracefully.
  // "try" runs the code. If anything fails, "catch" handles it.

  try {
    const response = await fetch(`${API_BASE_URL}/full-check`, {
      // Template literal: backticks `` allow us to embed variables with ${}
      // This produces a string like: "http://localhost:8000/full-check"

      method: "POST",
      // HTTP method — POST means we are SENDING data to the server

      body: formData,
      // The FormData we built above is sent as the request body.
      // NOTE: Do NOT set "Content-Type" header manually when using FormData.
      //       The browser sets it automatically with the correct boundary.
    });

    // ── Step 5e: Handle Non-OK HTTP Responses ────────────
    //
    // response.ok is true if the status code is 200–299 (success).
    // If the server returned a 400 or 500 error, we throw an error.

    if (!response.ok) {
      const errorData = await response.json();
      // .json() parses the response body as JSON (JavaScript Object Notation)
      // await waits for the async parsing to complete

      throw new Error(errorData.detail || "An unknown error occurred.");
      // throw creates an Error and sends it to the "catch" block below
    }

    // ── Step 5f: Parse the Successful Response ───────────

    const data = await response.json();
    // "data" is now a JavaScript object with the API's response.
    // Based on the backend, it looks like:
    // {
    //   extracted_drugs: "...",
    //   analysis: "...",
    //   contraindications: "...",
    //   email_status: "..."  (only if email was provided)
    // }

    // ── Step 5g: Display the Results ─────────────────────

    displayResults(data);
    // Calls our display function (defined below) with the data

  } catch (error) {
    // If anything went wrong (network error, server error, etc.)
    // "error" is the Error object we threw or a browser network error

    alert("Error: " + error.message);
    // Show the error message to the user
    console.error("API Error:", error);
    // console.error() writes to the browser's developer console.
    // Open it with F12 → Console tab — useful for debugging.

  } finally {
    // "finally" ALWAYS runs, whether try succeeded or catch ran.
    // Perfect for cleanup code — hiding the spinner, re-enabling the button.

    checkBtn.disabled  = false;
    loadingSpinner.style.display = "none";
  }
});


// ── SECTION 6: DISPLAY RESULTS FUNCTION ──────────────────────────────────
//
// This function receives the API response object and writes
// each piece of data into the correct HTML element.

function displayResults(data) {
  // data.extracted_drugs — drug names found in image or typed
  // data.analysis        — AI research on the drugs
  // data.contraindications — interaction check results
  // data.email_status    — email send result (may not exist)

  // Write drug names into the "Drugs Identified" result card
  resultDrugs.textContent = data.extracted_drugs || "No drug information returned.";
  // The "||" (OR) operator: if extracted_drugs is undefined/null/empty,
  // use the fallback string on the right instead.

  // Write analysis into the "Drug Analysis" result card
  resultAnalysis.textContent = data.analysis || "No analysis available.";

  // Write contraindications into the "Contraindications" result card
  resultContraindications.textContent = data.contraindications || "No interaction data returned.";

  // Handle the email status card — only show it if email was provided
  if (data.email_status) {
    resultEmailStatus.textContent = data.email_status;
    emailStatusCard.style.display = "block";
    // Make the email card visible
  } else {
    emailStatusCard.style.display = "none";
    // Keep it hidden if no email was used
  }

  // Make the entire results section visible
  resultsSection.style.display = "block";

  // Smoothly scroll the page down to show the results
  resultsSection.scrollIntoView({ behavior: "smooth" });
  // scrollIntoView() scrolls the page until this element is visible.
  // behavior: "smooth" animates the scroll instead of jumping.
}


// ── SECTION 7: RESET FORM FUNCTION ───────────────────────────────────────
//
// Called when the user clicks "Check Another Prescription".
// Clears all inputs and hides the results.

function resetForm() {
  // Clear the file input (can't directly set its value, so we replace it)
  fileInput.value = "";
  // Setting value to "" clears the selected file

  fileNameDisplay.textContent = "";
  // Clear the file name display text

  drugNamesInput.value = "";
  // Clear the textarea

  userEmailInput.value = "";
  // Clear the email input

  resultsSection.style.display = "none";
  // Hide the results section

  // Scroll back up to the form smoothly
  document.getElementById("checker").scrollIntoView({ behavior: "smooth" });
  // document.getElementById() finds an element — same as we used at the top
}
