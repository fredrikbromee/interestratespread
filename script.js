// Läs in CSV-filen
d3.text('rates.csv').then(rawData => {
    const rows = rawData.trim().split('\n'); // Dela upp rader
    const headers = rows[0].split(' '); // Första raden som headers
    const data = rows.slice(1).map(row => {
        const values = row.split(' '); // Dela på mellanslag
        return {
            bank: values[0],
            date: new Date(values[1].slice(0, 4), values[1].slice(4, 6) - 1, values[1].slice(6)),
            rate: +values[2]
        };
    });

    // Filtrera ut Riksbankens ränta
    const riksbankRates = data.filter(d => d.bank === 'Riksbanken');

    // Lägg till räntenetto
    const banks = [...new Set(data.map(d => d.bank).filter(bank => bank !== 'Riksbanken'))];
    const colorScale = d3.scaleOrdinal()
        .domain(banks)
        .range(d3.schemeCategory10);

    const netRates = data.filter(d => d.bank !== 'Riksbanken').map(bankEntry => {
        const matchingRiksbank = riksbankRates
            .filter(r => r.date <= bankEntry.date)
            .sort((a, b) => b.date - a.date)[0];
        return {
            ...bankEntry,
            netRate: matchingRiksbank ? bankEntry.rate - matchingRiksbank.rate : null,
        };
    });

    createVisualization(netRates, colorScale);
});

// Skapa en linjediagram-visualisering för räntenetto
function createVisualization(data, colorScale) {
    const svg = d3.select('#chart');
    const margin = { top: 20, right: 20, bottom: 30, left: 50 };
    const width = +svg.attr('width') - margin.left - margin.right;
    const height = +svg.attr('height') - margin.top - margin.bottom;

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    // Skapa skalor
    const x = d3.scaleTime()
        .domain(d3.extent(data, d => d.date))
        .range([0, width]);

    const y = d3.scaleLinear()
        .domain([d3.min(data, d => d.netRate), d3.max(data, d => d.netRate)])
        .nice()
        .range([height, 0]);

    // Rita axlar
    g.append('g')
        .attr('transform', `translate(0,${height})`)
        .call(d3.axisBottom(x));

    g.append('g')
        .call(d3.axisLeft(y));

    // Rita linjer för varje bank
    const groupedData = d3.group(data.filter(d => d.netRate !== null), d => d.bank);
    const currentDate = new Date();

    for (const [bank, values] of groupedData) {
        // Sort data by date
        const sortedValues = values.sort((a, b) => a.date - b.date);
        // Add an extended point to today's date
        const lastPoint = sortedValues[sortedValues.length - 1];
        if (lastPoint.date < currentDate) {
            sortedValues.push({ ...lastPoint, date: currentDate });
        }

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
        .attr('x', width - 100)
        .attr('y', (d, i) => i * 20 + 10)
        .style('fill', 'steelblue')
        .text(d => d)
        .style('font-size', '12px');
 
    // Update the legend to use the same color scale
    legend.style('fill', d => colorScale(d));    
}
