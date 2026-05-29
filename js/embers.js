document.addEventListener("DOMContentLoaded", () => {
    const container = document.createElement('div');
    container.className = 'ember-container';
    document.body.prepend(container);

    // Increased count from 20 to 50 for more prominence
    for (let i = 0; i < 50; i++) {
        const ember = document.createElement('div');
        ember.className = 'ember';
        // Randomized size for more depth
        const size = Math.random() * 6 + 2; 
        ember.style.width = size + 'px';
        ember.style.height = size + 'px';
        ember.style.left = Math.random() * 100 + '%';
        ember.style.animationDelay = Math.random() * 10 + 's';
        container.appendChild(ember);
    }
});
