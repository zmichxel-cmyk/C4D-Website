document.addEventListener("DOMContentLoaded", () => {
    const container = document.createElement('div');
    container.className = 'ember-container';
    document.body.prepend(container);

    // Reduce count to 15 for a subtle, premium look
    for (let i = 0; i < 15; i++) {
        const ember = document.createElement('div');
        ember.className = 'ember';
        
        // Randomize size, position, and speed
        const size = Math.random() * 8 + 3;
        ember.style.width = size + 'px';
        ember.style.height = size + 'px';
        ember.style.left = Math.random() * 100 + '%';
        ember.style.animationDuration = (Math.random() * 10 + 10) + 's';
        ember.style.animationDelay = Math.random() * 10 + 's';
        
        container.appendChild(ember);
    }
});
