document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('search-input');
    const translateBtn = document.getElementById('translate-btn');
    const resultsContainer = document.getElementById('results-container');
    
    let dictionary = [];

    // Load the dictionary data
    fetch('dictionary.json')
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(data => {
            dictionary = data;
        })
        .catch(error => {
            console.error('Error loading dictionary:', error);
            showError("Failed to load dictionary data. Please ensure you are running this on a web server.");
        });

    // Event Listeners
    translateBtn.addEventListener('click', performSearch);
    
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            performSearch();
        }
    });

    function performSearch() {
        const query = searchInput.value.trim().toLowerCase();
        
        if (!query) {
            resultsContainer.innerHTML = `
                <div class="placeholder">
                    <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-search"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                    <p>Enter a word to start translating</p>
                </div>
            `;
            return;
        }

        const results = dictionary.filter(entry => {
            // Check Bribri
            if (entry.bribri.toLowerCase().includes(query)) return true;
            
            // Check English
            if (entry.english.some(word => word.toLowerCase().includes(query))) return true;
            
            // Check Spanish
            if (entry.spanish.some(word => word.toLowerCase().includes(query))) return true;
            
            // Check Hebrew
            if (entry.hebrew.some(word => word.toLowerCase().includes(query))) return true;

            return false;
        });

        renderResults(results, query);
    }

    function renderResults(results, query) {
        if (results.length === 0) {
            showError(`Word "${query}" not found in the current dictionary. Try a different term.`);
            return;
        }

        resultsContainer.innerHTML = '';

        results.forEach(entry => {
            const card = document.createElement('div');
            card.className = 'result-card';
            
            card.innerHTML = `
                <div class="bribri-word">${entry.bribri}</div>
                <div class="context">${entry.context}</div>
                <div class="translations">
                    <div class="lang-group">
                        <div class="lang-label">English</div>
                        <div class="lang-words">${entry.english.join(', ')}</div>
                    </div>
                    <div class="lang-group">
                        <div class="lang-label">Español</div>
                        <div class="lang-words">${entry.spanish.join(', ')}</div>
                    </div>
                    <div class="lang-group">
                        <div class="lang-label">עברית</div>
                        <div class="lang-words hebrew-text">${entry.hebrew.join(', ')}</div>
                    </div>
                </div>
            `;
            
            resultsContainer.appendChild(card);
        });
    }

    function showError(message) {
        resultsContainer.innerHTML = `
            <div class="error-message">
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom: 0.5rem;"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                <p>${message}</p>
            </div>
        `;
    }
});
