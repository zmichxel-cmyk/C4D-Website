document.addEventListener("DOMContentLoaded", () => {
    // Create the container if it doesn't exist
    const container = document.createElement('div');
    container.className = 'ember-container';
    document.body.prepend(container);

    // Generate embers
    for (let i = 0; i < 20; i++) {
        const ember = document.createElement('div');
        ember.className = 'ember';
        ember.style.left = Math.random() * 100 + '%';
        ember.style.animationDelay = Math.random() * 10 + 's';
        container.appendChild(ember);
    }
});
