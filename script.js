// Google Identity Services & API Keys
const GOOGLE_CLIENT_ID = "YOUR_GOOGLE_CLIENT_ID"; // User needs to replace this
const GOOGLE_API_KEY = "YOUR_GOOGLE_API_KEY"; // User needs to replace this
const SPREADSHEET_SCOPES = "https://www.googleapis.com/auth/spreadsheets"; // Scope for Sheets API
const DRIVE_FILE_SCOPES = "https://www.googleapis.com/auth/drive.file"; // Scope for Picker

let googleUser = null; // To store user information from GSI
let gapiAuthToken = null; // To store the access token for gapi calls
let selectedSpreadsheet = null; // To store selected spreadsheet details

// Constants for DOM elements
const priceInput = document.getElementById('price');
const servicePriceInput = document.getElementById('service-price');
const dateInput = document.getElementById('date');
const consumptionInput = document.getElementById('consumption');
const weeklyConsumptionElement = document.getElementById('weekly-consumption');
const monthlyConsumptionElement = document.getElementById('monthly-consumption');
const entriesTableBody = document.querySelector('#entries-table tbody');
const consumptionChartCanvas = document.getElementById('consumption-chart');
const selectSpreadsheetButton = document.getElementById('select-spreadsheet-button');
const selectedSpreadsheetInfoElement = document.getElementById('selected-spreadsheet-info');


// Load data from localStorage
let dailyConsumptions = JSON.parse(localStorage.getItem('dailyConsumptions')) || [];
let pricePerKwh = parseFloat(localStorage.getItem('pricePerKwh')) || 0;
let servicePricePerDay = parseFloat(localStorage.getItem('servicePricePerDay')) || 0;
let entries = JSON.parse(localStorage.getItem('entries')) || [];

// Set default values for input fields
priceInput.value = pricePerKwh.toFixed(2);
servicePriceInput.value = servicePricePerDay.toFixed(2);
dateInput.value = new Date().toISOString().split('T')[0];

// Utility function to calculate cost
function calculateCost(kwh) {
    const currentPricePerKwh = parseFloat(priceInput.value) || 0;
    const currentServicePricePerDay = parseFloat(servicePriceInput.value) || 0;
    return kwh * currentPricePerKwh + currentServicePricePerDay;
}

function recordConsumption() {
    const currentDate = dateInput.value;
    const newMeterReading = parseFloat(consumptionInput.value);

    if (!currentDate) {
        alert("Veuillez sélectionner une date.");
        return;
    }
    if (isNaN(newMeterReading)) {
        alert("Veuillez entrer une lecture de compteur valide.");
        return;
    }

    pricePerKwh = parseFloat(priceInput.value) || 0;
    servicePricePerDay = parseFloat(servicePriceInput.value) || 0;
    localStorage.setItem('pricePerKwh', pricePerKwh.toString());
    localStorage.setItem('servicePricePerDay', servicePricePerDay.toString());

    let dailyUsageKwh;
    let costOfUsage;

    if (dailyConsumptions.length > 0) {
        const previousMeterReading = dailyConsumptions[dailyConsumptions.length - 1];
        if (newMeterReading < previousMeterReading) {
            alert(`La nouvelle lecture du compteur (${newMeterReading}) ne peut pas être inférieure à la précédente lecture enregistrée (${previousMeterReading}).`);
            return;
        }
        dailyUsageKwh = newMeterReading - previousMeterReading;
    } else {
        dailyUsageKwh = 0; 
    }

    costOfUsage = calculateCost(dailyUsageKwh);

    dailyConsumptions.push(newMeterReading);
    entries.push({
        date: currentDate,
        consumption: dailyUsageKwh,
        cost: costOfUsage
    });

    localStorage.setItem('dailyConsumptions', JSON.stringify(dailyConsumptions));
    localStorage.setItem('entries', JSON.stringify(entries));
    consumptionInput.value = '';
    updateUI();
}

function deleteEntry(index) {
    entries.splice(index, 1);
    dailyConsumptions.splice(index, 1);

    for (let i = index; i < entries.length; i++) {
        if (i === 0) {
            entries[i].consumption = 0;
        } else {
            if (dailyConsumptions[i-1] !== undefined) {
                 const newConsumption = dailyConsumptions[i] - dailyConsumptions[i-1];
                 entries[i].consumption = newConsumption < 0 ? 0 : newConsumption;
            } else {
                entries[i].consumption = 0;
            }
        }
        entries[i].cost = calculateCost(entries[i].consumption);
    }
     if (entries.length === 0) {
        dailyConsumptions = [];
    }

    localStorage.setItem('entries', JSON.stringify(entries));
    localStorage.setItem('dailyConsumptions', JSON.stringify(dailyConsumptions));
    updateUI();
}


function updateUI() {
    updateWeeklyConsumption();
    updateMonthlyConsumption();
    updateChart();
    updateEntriesTable();
}

function parseDateEntry(dateString) {
    const parts = dateString.split('-');
    return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
}

function updateWeeklyConsumption() {
    const now = new Date();
    now.setHours(23, 59, 59, 999);
    const oneWeekAgo = new Date(now.getTime());
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 6);
    oneWeekAgo.setHours(0, 0, 0, 0);
    const weeklyEntries = entries.filter(entry => {
        const entryDate = parseDateEntry(entry.date);
        return entryDate >= oneWeekAgo && entryDate <= now;
    });
    let weeklyKwh = weeklyEntries.reduce((sum, entry) => sum + entry.consumption, 0);
    let weeklyCost = weeklyEntries.reduce((sum, entry) => sum + entry.cost, 0);
    weeklyConsumptionElement.textContent = `${weeklyKwh.toFixed(2)} kWh - ${weeklyCost.toFixed(2)} GBP`;
}

function updateMonthlyConsumption() {
    const now = new Date();
    now.setHours(23, 59, 59, 999);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    startOfMonth.setHours(0, 0, 0, 0);
    const monthlyEntries = entries.filter(entry => {
        const entryDate = parseDateEntry(entry.date);
        return entryDate >= startOfMonth && entryDate <= now;
    });
    let monthlyKwh = monthlyEntries.reduce((sum, entry) => sum + entry.consumption, 0);
    let monthlyCost = monthlyEntries.reduce((sum, entry) => sum + entry.cost, 0);
    monthlyConsumptionElement.textContent = `${monthlyKwh.toFixed(2)} kWh - ${monthlyCost.toFixed(2)} GBP`;
}

function updateChart() {
    const ctx = consumptionChartCanvas.getContext('2d');
    if (window.consumptionChart instanceof Chart) {
        window.consumptionChart.destroy();
    }
    window.consumptionChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: entries.map(entry => entry.date),
            datasets: [{
                label: 'Consommation Quotidienne (kWh)',
                data: entries.map(entry => entry.consumption),
                backgroundColor: 'rgba(54, 162, 235, 0.6)',
                borderColor: 'rgba(54, 162, 235, 1)',
                borderWidth: 1
            },
            {
                label: 'Coût Quotidien (GBP)',
                data: entries.map(entry => entry.cost),
                type: 'line',
                backgroundColor: 'rgba(255, 99, 132, 0.6)',
                borderColor: 'rgba(255, 99, 132, 1)',
                yAxisID: 'y-axis-cost',
                tension: 0.1
            }]
        },
        options: { scales: { y: { beginAtZero: true, title: { display: true, text: 'kWh' } }, 'y-axis-cost': { position: 'right', beginAtZero: true, title: { display: true, text: 'GBP' }, grid: { drawOnChartArea: false } } } }
    });
}

function updateEntriesTable() {
    entriesTableBody.innerHTML = '';
    entries.forEach((entry, index) => {
        const row = document.createElement('tr');
        row.innerHTML = `<td>${entry.date}</td><td>${entry.consumption.toFixed(2)}</td><td>${entry.cost.toFixed(2)}</td><td><button class="delete-btn" onclick="deleteEntry(${index})">Supprimer</button></td>`;
        entriesTableBody.appendChild(row);
    });
}

function exportToCSV() {
    let csvContent = "data:text/csv;charset=utf-8,Date,Consommation (kWh),Coût (GBP)\r\n";
    entries.forEach(entry => { csvContent += `${entry.date},${entry.consumption.toFixed(2)},${entry.cost.toFixed(2)}\r\n`; });
    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csvContent));
    link.setAttribute("download", "consumption_data.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// --- Google Identity Services and Picker API ---
function gsiClientCallback(response) {
    if (response.error) {
        console.error("GSI Client Error:", response.error);
        alert("Error initializing Google Sign-In. Please try again.");
        return;
    }
     // This is the new token client from GSI
    gapiAuthToken = response; // Store the whole token client response
    console.log("Access Token obtained for GAPI:", gapiAuthToken.access_token);
    
    // After obtaining the token, enable GAPI client and load Picker
    gapi.client.setToken(gapiAuthToken); // Set token for GAPI
    loadPickerApi(); 
    updateAuthUIVisibility(true);
}


function handleCredentialResponse(response) {
    console.log("Encoded JWT ID token: " + response.credential);
    try {
        const base64Url = response.credential.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) { return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2); }).join(''));
        googleUser = JSON.parse(jsonPayload); // User profile information
        googleUser.id_token = response.credential; // Keep the ID token
    } catch (e) {
        console.error("Error decoding JWT token:", e);
        googleUser = { id_token: response.credential }; // Store at least the token
    }
    console.log("User info:", googleUser);

    // Request an access token for Picker and Sheets API
    // The token client is initialized in window.onload
    // We need to ensure this token client requests the necessary scopes
    // For now, assume tokenClient is initialized and available globally or passed appropriately.
    if (window.tokenClient) {
        window.tokenClient.requestAccessToken(); // This will trigger gsiClientCallback
    } else {
        console.error("Token client not initialized.");
        alert("Could not obtain access token for Google services.");
    }
}


function initializeGoogleSignIn() {
    if (typeof google !== 'undefined') {
        google.accounts.id.initialize({
            client_id: GOOGLE_CLIENT_ID,
            callback: handleCredentialResponse // This handles the ID token
        });
        google.accounts.id.renderButton(
            document.getElementById("google-signin-button"),
            { theme: "outline", size: "large" }
        );
    } else {
        console.error("Google Identity Services library (accounts.google.com) not loaded.");
    }

    if (typeof gapi !== 'undefined') {
        // Initialize the GAPI client token manager
        // This tokenClient will be used to request access tokens for GAPI calls
        window.tokenClient = google.accounts.oauth2.initTokenClient({
            client_id: GOOGLE_CLIENT_ID,
            scope: `${DRIVE_FILE_SCOPES} ${SPREADSHEET_SCOPES}`, // Scopes for Picker and potentially Sheets API
            callback: gsiClientCallback, // This handles the access token response
            error_callback: (error) => {
                console.error("Token Client Error:", error);
                alert("Error obtaining access token for Google Drive/Sheets. Functionality will be limited.");
            }
        });
    } else {
        console.error("Google API Client library (apis.google.com) not loaded.");
    }
}


function handleSignOut() {
    if (googleUser) {
        googleUser = null;
        gapiAuthToken = null;
        selectedSpreadsheet = null;
        if (typeof gapi !== 'undefined' && gapi.client && gapi.client.getToken()) {
            // gapi.client.setToken(null); // Clear GAPI token, though GIS manages its own sessions
            // More robust sign out for GAPI if using it directly for auth:
            const token = gapi.client.getToken();
            if (token) {
                 google.accounts.oauth2.revoke(token.access_token, () => {console.log('Access token revoked.')});
                 gapi.client.setToken(''); // Clear gapi token
            }
        }
        console.log("User signed out locally.");
        updateAuthUIVisibility(false);
        if (selectedSpreadsheetInfoElement) selectedSpreadsheetInfoElement.textContent = '';
    }
}

function updateAuthUIVisibility(isSignedIn) {
    const signInButton = document.getElementById('google-signin-button');
    let signOutButton = document.getElementById('google-signout-button');
    const selectSpreadsheetBtn = document.getElementById('select-spreadsheet-button');

    if (isSignedIn) {
        if (signInButton) signInButton.style.display = 'none';
        if (!signOutButton) {
            signOutButton = document.createElement('button');
            signOutButton.id = 'google-signout-button';
            signOutButton.onclick = handleSignOut;
            const h1 = document.querySelector('.container h1');
            if (h1 && h1.parentNode) {
                 h1.parentNode.insertBefore(signOutButton, h1.nextSibling.nextSibling);
            } else {
                 document.querySelector('.container').insertBefore(signOutButton, document.querySelector('label[for="price"]'));
            }
        }
        signOutButton.textContent = `Sign out ${googleUser.name || googleUser.email || ''}`;
        signOutButton.style.display = 'block';
        if (selectSpreadsheetBtn) selectSpreadsheetBtn.style.display = 'block';

    } else {
        if (signInButton) signInButton.style.display = 'block';
        if (signOutButton) signOutButton.style.display = 'none';
        if (selectSpreadsheetBtn) selectSpreadsheetBtn.style.display = 'none';
    }
}

function loadPickerApi() {
    if (typeof gapi !== 'undefined' && gapi.load) {
        gapi.load('picker', { 'callback': onPickerApiLoaded });
    } else {
        console.error("gapi.load is not available. Cannot load Picker API.");
    }
}

function onPickerApiLoaded() {
    console.log("Picker API loaded.");
    // Now that Picker API is loaded, the selectSpreadsheetButton's click can work
    if (selectSpreadsheetButton) {
        selectSpreadsheetButton.onclick = createPicker;
    }
}

function createPicker() {
    if (!gapiAuthToken || !gapiAuthToken.access_token) {
        alert("Authentication token is not available. Please sign in again.");
        console.error("Picker: Missing access token.");
        // Potentially re-trigger token request or sign-in
        // window.tokenClient.requestAccessToken();
        return;
    }
    if (GOOGLE_API_KEY === "YOUR_GOOGLE_API_KEY") {
        alert("Please configure the GOOGLE_API_KEY in script.js");
        return;
    }

    const view = new google.picker.View(google.picker.ViewId.SPREADSHEETS);
    view.setMimeTypes("application/vnd.google-apps.spreadsheet");

    const picker = new google.picker.PickerBuilder()
        .setAppId(GOOGLE_CLIENT_ID.split('-')[0]) // Use App ID derived from Client ID if needed, or remove if not necessary for Picker
        .setOAuthToken(gapiAuthToken.access_token)
        .setDeveloperKey(GOOGLE_API_KEY)
        .addView(view)
        .setCallback(pickerCallback)
        .build();
    picker.setVisible(true);
}

function pickerCallback(data) {
    if (data.action === google.picker.Action.PICKED) {
        const doc = data[google.picker.Response.DOCUMENTS][0];
        selectedSpreadsheet = {
            id: doc[google.picker.Document.ID],
            name: doc[google.picker.Document.NAME],
            url: doc[google.picker.Document.URL]
        };
        console.log("Selected spreadsheet:", selectedSpreadsheet);
        if (selectedSpreadsheetInfoElement) {
            selectedSpreadsheetInfoElement.textContent = `Selected: ${selectedSpreadsheet.name} (ID: ${selectedSpreadsheet.id})`;
        }
        // TODO: Add logic to save/load data from this spreadsheet
    } else if (data.action === google.picker.Action.CANCEL) {
        console.log("Picker cancelled.");
    }
}

// Initial UI setup on page load
function initialUISetup() {
    if (entries.length > 0 || dailyConsumptions.length > 0) {
        updateUI();
    } else {
        weeklyConsumptionElement.textContent = `0.00 kWh - 0.00 GBP`;
        monthlyConsumptionElement.textContent = `0.00 kWh - 0.00 GBP`;
        updateChart();
    }
    updateAuthUIVisibility(false); // User is not signed in initially
}


// Initialize Google Sign-In and other onload actions
window.onload = () => {
    initialUISetup(); // General UI setup first

    // GSI Loader for accounts.google.com
    // The GAPI loader (for apis.google.com) is separate.
    // Both should be loaded via <script> tags in index.html.

    // Check if GAPI is loaded before initializing sign-in components that depend on it
    if (typeof gapi !== 'undefined' && gapi.load) {
        gapi.load('client', initializeGoogleSignIn); // Load GAPI client then init sign-in
    } else {
        // Fallback or error if gapi isn't loaded - though async defer should handle it.
        // This is more of a safeguard.
        console.warn("GAPI client (apis.google.com/js/api.js) not loaded yet, deferring full sign-in initialization or it might fail.");
        // Attempt to initialize GSI part if google.accounts.id is ready
        if (typeof google !== 'undefined' && google.accounts && google.accounts.id) {
            initializeGoogleSignIn(); // This will initialize GSI and try to init tokenClient
        } else {
            console.error("Neither GAPI nor GSI are loaded. Authentication will not work.");
        }
    }
};
