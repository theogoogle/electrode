// Constants for DOM elements
const priceInput = document.getElementById('price');
const servicePriceInput = document.getElementById('service-price');
const dateInput = document.getElementById('date');
const consumptionInput = document.getElementById('consumption');
const weeklyConsumptionElement = document.getElementById('weekly-consumption');
const monthlyConsumptionElement = document.getElementById('monthly-consumption');
const entriesTableBody = document.querySelector('#entries-table tbody');
const consumptionChartCanvas = document.getElementById('consumption-chart');

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
    // This is the MODIFIED deleteEntry from the previous fix
    entries.splice(index, 1);
    dailyConsumptions.splice(index, 1);

    if (entries.length === 0) { // All entries deleted
        dailyConsumptions = []; // Clear all meter readings
    } else if (index < entries.length) { // If there's a subsequent entry (or the list is not empty)
        if (index === 0) { // If the first element was deleted, new first element's consumption is 0
            entries[index].consumption = 0;
            entries[index].cost = calculateCost(0);
        } else { // Recalculate for the entry that shifted into entries[index]
            if (dailyConsumptions.length > index && dailyConsumptions[index - 1] !== undefined) {
                const newConsumption = dailyConsumptions[index] - dailyConsumptions[index-1];
                entries[index].consumption = newConsumption < 0 ? 0 : newConsumption; // Prevent negative
                entries[index].cost = calculateCost(entries[index].consumption);
            } else {
                 // Should not happen if arrays are consistent, but as a fallback
                entries[index].consumption = 0;
                entries[index].cost = calculateCost(0);
            }
        }
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
        options: {
            scales: {
                y: { 
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'kWh'
                    }
                },
                'y-axis-cost': { 
                    position: 'right',
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'GBP'
                    },
                    grid: {
                        drawOnChartArea: false, 
                    },
                }
            }
        }
    });
}

function updateEntriesTable() {
    entriesTableBody.innerHTML = ''; 

    entries.forEach((entry, index) => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${entry.date}</td>
            <td>${entry.consumption.toFixed(2)}</td>
            <td>${entry.cost.toFixed(2)}</td>
            <td><button class="delete-btn" onclick="deleteEntry(${index})">Supprimer</button></td>
        `;
        entriesTableBody.appendChild(row);
    });
}

function exportToCSV() {
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Date,Consommation (kWh),Coût (GBP)\r\n"; 
    entries.forEach(entry => {
        const row = `${entry.date},${entry.consumption.toFixed(2)},${entry.cost.toFixed(2)}`;
        csvContent += row + "\r\n";
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "consumption_data.csv");
    document.body.appendChild(link); 
    link.click();
    document.body.removeChild(link);
}

// Initial update on page load
// This needs to be wrapped in DOMContentLoaded if script is not deferred or placed at end of body
// or if any DOM elements are accessed at the global level before they are declared.
// However, all DOM consts are already declared, and this is called at the end.
// The `defer` attribute on the script tag in index.html handles this.
if (entries.length > 0 || dailyConsumptions.length > 0) {
    updateUI();
} else {
    weeklyConsumptionElement.textContent = `0.00 kWh - 0.00 GBP`;
    monthlyConsumptionElement.textContent = `0.00 kWh - 0.00 GBP`;
    updateChart(); 
}
