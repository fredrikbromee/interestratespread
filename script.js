
var currentData = [];
var colorScale = null;

// Läs in CSV-filen
d3.text('rates.csv').then(rawData => {
    const rows = rawData.trim().split('\n');
    const headers = rows[0].split(' ');

    let data = rows.slice(1).map(row => {
        const values = row.split(' ');
        return {
            bank: values[0],
            date: new Date(values[1].slice(0, 4), values[1].slice(4, 6) - 1, values[1].slice(6)),
            rate: +values[2]
        };
    });

    currentData = calculateNetRates(data);
    console.log(currentData);

    colorScale = d3.scaleOrdinal()
        .domain(data)
        .range(d3.schemeCategory10);

    updateChart(currentData, colorScale);
});
    
function calculateNetRates(data) {
    // Sort by date
    data.sort((a, b) => a.date - b.date);

    const riksbankRates = data.filter(d => d.bank === 'Riksbanken');
    const banks = [...new Set(data.map(d => d.bank).filter(bank => bank !== 'Riksbanken'))];

    let currentRiksRate = null;

    // Iterate through all data in chronological order
    for (const d of data) {
        if (d.bank === 'Riksbanken') {
            // Update current known Riksbanken rate
            currentRiksRate = d.rate;
            // Find last entry for each bank
            const banks = [...new Set(data.map(d => d.bank).filter(bank => bank !== 'Riksbanken'))];
            banks.forEach(bank => {
                const bankEntries = currentData.filter(d => d.bank === bank);
                if (bankEntries.length > 0) {
                    const lastEntry = bankEntries[bankEntries.length - 1];
                    if (lastEntry.netRate !== null) {
                        currentData.push({
                            bank: bank,
                            date: d.date,
                            rate: lastEntry.rate,
                            netRate: lastEntry.rate - d.rate,
                            riksbankChange: true
                        });
                    }
                }
        });
        } else {
            // For bank data points, use last known Riksbanken rate if available
            let netRate = currentRiksRate !== null ? d.rate - currentRiksRate : null;
            currentData.push({
                ...d,
                netRate
            });
        }
    }

    // Add a fictitious "today" data point for each bank to make plotting easier
    const today = new Date();
    banks.forEach(bank => {
        const bankEntries = currentData.filter(d => d.bank === bank);
        if (bankEntries.length > 0) {
            const lastEntry = bankEntries[bankEntries.length - 1];
            if (lastEntry.date < today && currentRiksRate !== null && lastEntry.rate !== null) {
                // Recalculate netRate with the current Riksbanken rate, not the old netRate
                const newNetRate = lastEntry.rate - currentRiksRate;

                currentData.push({
                    bank: bank,
                    date: today,
                    rate: lastEntry.rate,
                    netRate: newNetRate
                });
            }
        }
    });
    return currentData;
}

// Skapa en linjediagram-visualisering för räntenetto
function createVisualization(data, colorScale, width, height) {
    const svg = d3.select('#chart');
    const margin = { top: 20, right: 20, bottom: 30, left: 50 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    // Skapa skalor
    const x = d3.scaleTime()
        .domain(d3.extent(data, d => d.date))
        .range([0, innerWidth]);

    const y = d3.scaleLinear()
        .domain([d3.min(data, d => d.netRate), d3.max(data, d => d.netRate)])
        .nice()
        .range([innerHeight, 0]);

    // Rita axlar
    g.append('g')
        .attr('transform', `translate(0,${innerHeight})`)
        .call(d3.axisBottom(x));

    g.append('g')
        .call(d3.axisLeft(y));

    // Rita linjer för varje bank
    const groupedData = d3.group(data.filter(d => d.netRate !== null), d => d.bank);
    const currentDate = new Date();

    for (const [bank, values] of groupedData) {
        // Sort data by date
        const sortedValues = values.sort((a, b) => a.date - b.date);

        // Use d3.line with curveStepAfter for step effect
        const stepLine = d3.line()
            .x(d => x(d.date))
            .y(d => y(d.netRate))
            .curve(d3.curveStepAfter);

        g.append('path')
            .datum(sortedValues)
            .attr('fill', 'none')
            .attr('stroke', `${colorScale(bank)}`)
            .attr('stroke-width', 1.5)
            .attr('d', stepLine)
            .attr('class', `line-${bank}`);
    }
    // Lägg till legend
    const legend = g.selectAll('.legend')
        .data(Array.from(groupedData.keys()))
        .enter()
        .append('text')
        .attr('x', width - 150)
        .attr('y', (d, i) => i * 15)
        .style('fill', 'steelblue')
        .text(d => d)
        .style('font-size', '12px');
 
    // Update the legend to use the same color scale
    legend.style('fill', d => colorScale(d));
    
    // Add Y-axis label
    g.append('text')
    .attr('transform', 'rotate(-90)')
    .attr('y', -margin.left + 20)
    .attr('x', -innerHeight / 2)
    .attr('text-anchor', 'middle')
    .style('font-size', '12px')
    .text('Spread in % above Riksbanken\'s rate');
}

function updateChart(data, colorScale) {
    // Clear previous chart
    d3.select('#chart').selectAll('*').remove();
    
    // Get container dimensions
    const container = document.querySelector('.chart-container');
    const width = container.clientWidth;
    const height = width * 0.5;  // 2:1 aspect ratio
    
    // Update SVG
    const svg = d3.select('#chart')
        .attr('viewBox', `0 0 ${width} ${height}`);
    
    // Call visualization with new dimensions
    createVisualization(data, colorScale, width, height);
}
// Add resize listener
window.addEventListener('resize', () => {
    updateChart(currentData, colorScale);  // You'll need to make these variables accessible
});