// Nunjucks setup and custom filters

// Configure Nunjucks environment
const nunjucksEnv = nunjucks.configure({ autoescape: true });

// Interest rates by year for security deposit calculation
const DEPOSIT_INTEREST_RATES = {
    2023: 0.0195,
    2024: 0.027,
    2025: 0.0095,
    2026: 0.0
};

/**
 * Calculate deposit return amount with compound interest
 * Compounds annually based on the number of days held each year
 * @param {number} deposit - Initial deposit amount
 * @param {string} startDateStr - Tenancy start date (YYYY-MM-DD)
 * @returns {number|null} - Calculated total or null if outside supported range
 */
function calculateDepositWithInterest(deposit, startDateStr) {
    const startDate = new Date(startDateStr);
    const startYear = startDate.getFullYear();

    // Only support 2023 onwards
    if (startYear < 2023) {
        return null;
    }

    const today = new Date();
    const currentYear = today.getFullYear();

    let principal = parseFloat(deposit);

    // Process each year from start to current
    for (let year = startYear; year <= currentYear; year++) {
        const rate = DEPOSIT_INTEREST_RATES[year];
        if (rate === undefined) {
            // If we don't have a rate for this year, use 0%
            continue;
        }

        // Calculate days held in this year
        let yearStart, yearEnd;

        if (year === startYear) {
            yearStart = startDate;
        } else {
            yearStart = new Date(year, 0, 1); // Jan 1
        }

        if (year === currentYear) {
            yearEnd = today;
        } else {
            yearEnd = new Date(year, 11, 31); // Dec 31
        }

        // Calculate days in this period
        const daysInYear = isLeapYear(year) ? 366 : 365;
        const daysHeld = Math.floor((yearEnd - yearStart) / (1000 * 60 * 60 * 24)) + 1;

        // Apply interest for this period (simple interest within year, compounds at year end)
        const interest = principal * rate * (daysHeld / daysInYear);
        principal += interest;
    }

    return principal;
}

function isLeapYear(year) {
    return (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
}

// Register custom filter: depositInterest
nunjucksEnv.addFilter('depositInterest', function(deposit, startDate) {
    const result = calculateDepositWithInterest(deposit, startDate);
    return result !== null ? result : deposit;
});

// Register custom filter: money (format as currency)
nunjucksEnv.addFilter('money', function(value) {
    const num = parseFloat(value);
    if (isNaN(num)) return value;
    return '$' + num.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
});

// Register custom filter: formatDate (format YYYY-MM-DD to readable format)
nunjucksEnv.addFilter('formatDate', function(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr + 'T00:00:00'); // Ensure local timezone
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return date.toLocaleDateString('en-CA', options);
});

/**
 * Render a letter template with data
 * @param {string} template - Nunjucks template string
 * @param {object} data - Data to render into template
 * @returns {object} - { html: rendered HTML, text: plain text }
 */
function renderLetter(template, data) {
    // Add current date to data
    const today = new Date();
    const dateOptions = { year: 'numeric', month: 'long', day: 'numeric' };
    data.date = today.toLocaleDateString('en-CA', dateOptions);

    // Render with Nunjucks
    let renderedMarkdown = nunjucksEnv.renderString(template, data);

    // Collapse multiple consecutive blank lines into one (but preserve &nbsp; lines)
    renderedMarkdown = renderedMarkdown.replace(/\n(\s*\n){2,}/g, '\n\n');

    // Convert markdown to HTML (breaks: true converts single newlines to <br>)
    const html = marked.parse(renderedMarkdown, { breaks: true });

    // Also return plain text version (strip markdown syntax)
    const text = renderedMarkdown
        .replace(/&nbsp;/g, '')           // HTML entities (used for spacing in HTML, blank in plain text)
        .replace(/\*\*(.*?)\*\*/g, '$1') // Bold
        .replace(/\*(.*?)\*/g, '$1')     // Italic
        .replace(/^#+\s*/gm, '')          // Headers
        .replace(/^\*\s+/gm, '- ')        // List items
        .trim();

    return { html, text };
}
