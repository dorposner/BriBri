document.addEventListener('DOMContentLoaded', () => {
    // 1. PWA Service Worker Registration
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('./sw.js').catch(err => {
                console.log('ServiceWorker registration failed: ', err);
            });
        });
    }

    // DOM Elements
    const searchInput = document.getElementById('search-input');
    const translateBtn = document.getElementById('translate-btn');
    const searchResultsContainer = document.getElementById('results-container');
    const suggestionsContainer = document.getElementById('suggestions-container');
    
    const categoryGrid = document.getElementById('category-grid');
    const categoryResults = document.getElementById('category-results');
    
    const indexLangSelect = document.getElementById('index-lang');
    const indexResultsContainer = document.getElementById('index-results');
    const indexWordResult = document.getElementById('index-word-result');

    let dictionary = [];
    let fuse = null;

    // Load Data
    fetch('dictionary.json')
        .then(response => response.json())
        .then(data => {
            dictionary = data;
            initFuse();
            initCategories();
            initIndex();
        })
        .catch(err => {
            console.error('Error loading dictionary:', err);
            searchResultsContainer.innerHTML = `<div class="error-message"><p>Failed to load dictionary data.</p></div>`;
        });

    // --- SPA TABS LOGIC ---
    const tabBtns = document.querySelectorAll('.tab-btn');
    const views = document.querySelectorAll('.view');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // Remove active classes
            tabBtns.forEach(b => b.classList.remove('active'));
            views.forEach(v => {
                v.classList.remove('active');
                v.classList.add('hidden');
            });

            // Add active class to clicked tab and corresponding view
            btn.classList.add('active');
            const targetId = btn.getAttribute('data-target');
            const targetView = document.getElementById(targetId);
            targetView.classList.remove('hidden');
            targetView.classList.add('active');
        });
    });

    // --- FUSE.JS SEARCH LOGIC ---
    function initFuse() {
        // Setup Fuse options for fuzzy searching across all languages
        const options = {
            includeScore: true,
            threshold: 0.3, // 0.0 is exact match, 1.0 is matches everything
            keys: [
                { name: 'bribri', weight: 1.0 },
                { name: 'english', weight: 0.8 },
                { name: 'spanish', weight: 0.8 },
                { name: 'hebrew', weight: 0.8 }
            ]
        };
        fuse = new Fuse(dictionary, options);
    }

    searchInput.addEventListener('input', () => {
        const query = searchInput.value.trim();
        if (query.length < 2) {
            suggestionsContainer.classList.add('hidden');
            return;
        }

        const results = fuse.search(query).slice(0, 5); // top 5 suggestions
        
        if (results.length === 0) {
            suggestionsContainer.classList.add('hidden');
            return;
        }

        suggestionsContainer.innerHTML = '';
        results.forEach(res => {
            const entry = res.item;
            const div = document.createElement('div');
            div.className = 'suggestion-item';
            div.innerHTML = `
                <span class="suggestion-match">${entry.bribri}</span>
                <span class="suggestion-sub">${entry.english.join(', ')} | ${entry.spanish.join(', ')}</span>
            `;
            div.addEventListener('click', () => {
                searchInput.value = entry.bribri;
                suggestionsContainer.classList.add('hidden');
                renderCards([entry], searchResultsContainer);
            });
            suggestionsContainer.appendChild(div);
        });
        suggestionsContainer.classList.remove('hidden');
    });

    translateBtn.addEventListener('click', performSearch);
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            suggestionsContainer.classList.add('hidden');
            performSearch();
        }
    });

    // Hide suggestions on outside click
    document.addEventListener('click', (e) => {
        if (!searchInput.contains(e.target) && !suggestionsContainer.contains(e.target)) {
            suggestionsContainer.classList.add('hidden');
        }
    });

    function performSearch() {
        const query = searchInput.value.trim();
        if (!query) return;

        const results = fuse.search(query).map(r => r.item);
        if (results.length === 0) {
            searchResultsContainer.innerHTML = `<div class="error-message"><p>Word "${query}" not found.</p></div>`;
            return;
        }
        renderCards(results, searchResultsContainer);
    }

    // --- CATEGORIES LOGIC ---
    function initCategories() {
        // Extract unique categories
        const categories = new Set();
        dictionary.forEach(entry => {
            if (entry.category) categories.add(entry.category);
        });

        categories.forEach(cat => {
            const btn = document.createElement('button');
            btn.className = 'category-btn';
            btn.textContent = cat;
            btn.addEventListener('click', () => {
                // Highlight active category
                document.querySelectorAll('.category-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                
                // Filter and show
                const filtered = dictionary.filter(e => e.category === cat);
                renderCards(filtered, categoryResults);
            });
            categoryGrid.appendChild(btn);
        });
    }

    // --- REVERSE INDEX LOGIC ---
    indexLangSelect.addEventListener('change', initIndex);

    function initIndex() {
        const lang = indexLangSelect.value;
        const alphabetGroups = {};

        dictionary.forEach(entry => {
            // Get the target word based on language selected
            let wordsToIndex = [];
            if (lang === 'bribri') wordsToIndex = [entry.bribri];
            else wordsToIndex = entry[lang]; // english, spanish, hebrew are arrays

            wordsToIndex.forEach(word => {
                const firstLetter = getCleanFirstLetter(word);
                if (!alphabetGroups[firstLetter]) {
                    alphabetGroups[firstLetter] = [];
                }
                alphabetGroups[firstLetter].push({ word, entry });
            });
        });

        // Sort keys and generate UI
        const sortedLetters = Object.keys(alphabetGroups).sort();
        indexResultsContainer.innerHTML = '';
        indexWordResult.innerHTML = '';

        sortedLetters.forEach(letter => {
            const groupDiv = document.createElement('div');
            groupDiv.className = 'alpha-group';
            
            const header = document.createElement('div');
            header.className = 'alpha-letter';
            header.textContent = letter;
            groupDiv.appendChild(header);

            // Sort words within the letter
            alphabetGroups[letter].sort((a, b) => a.word.localeCompare(b.word));

            alphabetGroups[letter].forEach(item => {
                const wordDiv = document.createElement('div');
                wordDiv.className = 'alpha-word';
                wordDiv.textContent = item.word;
                wordDiv.addEventListener('click', () => {
                    renderCards([item.entry], indexWordResult);
                    indexWordResult.scrollIntoView({ behavior: 'smooth' });
                });
                groupDiv.appendChild(wordDiv);
            });

            indexResultsContainer.appendChild(groupDiv);
        });
    }

    function getCleanFirstLetter(str) {
        // Handle accented chars for sorting nicely
        const cleanStr = str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/['¿]/g, "").trim();
        return cleanStr.charAt(0).toUpperCase();
    }

    // --- RENDER FUNCTION ---
    function renderCards(results, container) {
        container.innerHTML = '';
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
                ${entry.source ? `<a href="${entry.source}" target="_blank" class="source-link">Source: Haakon Krohn Dictionary</a>` : ''}
            `;
            container.appendChild(card);
        });
    }
});
